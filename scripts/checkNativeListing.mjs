import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const repository = fileURLToPath(new URL('../', import.meta.url))
const sourceUrl = 'https://e-hentai.org/?f_cats=767&prev=45313'
const modes = ['e', 'm', 'p', 'l', 't']

async function saveJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function inspectSample(html, url, mode) {
  const dom = new JSDOM(html, { url })
  try {
    const doc = dom.window.document
    const selected = doc.querySelector('select[onchange*="inline_set=dm_"]')?.value
    if (selected !== mode) throw new Error(`Expected mode ${mode}, received ${selected ?? 'no mode selector'}`)
    const listings = doc.querySelectorAll('.itg')
    if (listings.length !== 1) throw new Error(`Expected one listing, received ${listings.length}`)
    const listing = listings[0]
    if (listing.tagName !== (mode === 't' ? 'DIV' : 'TABLE')) throw new Error(`Unexpected listing element: ${listing.tagName}`)
    const items = listing.tagName === 'TABLE' ? Array.from(listing.rows) : Array.from(listing.children)
    const keys = items.flatMap(item => {
      const href = item.querySelector('a[href*="/g/"]')?.getAttribute('href')
      if (!href) return []
      const key = /\/g\/(\d+)\/([^/?#]+)/.exec(new URL(href, url).pathname)
      if (!key) throw new Error('Gallery link has no gallery identity')
      return [`${key[1]}/${key[2]}`]
    })
    if (!keys.length || new Set(keys).size !== keys.length) throw new Error('Listing is empty or contains duplicate galleries')
    return { selected, root: `${listing.tagName.toLowerCase()}.${Array.from(listing.classList).join('.')}`, keys }
  } finally {
    dom.window.close()
  }
}

export async function captureNativeListings({ url = sourceUrl, directory, interval = 3500 }) {
  await mkdir(directory, { recursive: true })
  const report = { sourceUrl: url, startedAt: new Date().toISOString(), status: 'capturing', samples: [] }
  let phase = 'fetch'
  let requested = false
  let reference
  async function request(target, cookie, sample) {
    if (requested) await delay(interval)
    requested = true
    const response = await fetch(target, {
      redirect: 'manual',
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(30000),
    })
    sample.requests.push({ url: String(target), status: response.status, location: response.headers.get('location') })
    const html = await response.text()
    await writeFile(resolve(directory, `${sample.mode}.html`), html)
    return { response, html }
  }
  try {
    for (const mode of modes) {
      phase = 'fetch'
      const target = new URL(url)
      target.searchParams.set('inline_set', `dm_${mode}`)
      const sample = { mode, requests: [] }
      report.samples.push(sample)
      let page = await request(target, null, sample)
      if ([301, 302, 303, 307, 308].includes(page.response.status)) {
        const location = page.response.headers.get('location')
        if (!location) throw new Error('Mode redirect has no Location header')
        const destination = new URL(location, target)
        if (destination.origin !== target.origin) throw new Error('Mode redirect leaves the source origin')
        const cookie = page.response.headers.getSetCookie().find(value => value.startsWith('sl='))?.split(';')[0]
        page = await request(destination, cookie, sample)
      }
      if (!page.response.ok) throw new Error(`Mode ${mode}: HTTP ${page.response.status}`)
      const contentType = page.response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html')) throw new Error(`Mode ${mode}: expected HTML, received ${contentType}`)
      phase = 'validation'
      Object.assign(sample, inspectSample(page.html, page.response.url, mode))
      if (reference && JSON.stringify(sample.keys) !== JSON.stringify(reference)) {
        throw new Error(`Mode ${mode}: gallery identities or order differ from Extended`)
      }
      reference ??= sample.keys
      sample.fetchedAt = new Date().toISOString()
      console.log(`Captured ${mode}: ${sample.keys.length} matching galleries`)
    }
    report.status = 'captured'
  } catch (error) {
    report.status = `${phase}-failed`
    report.error = error instanceof Error ? error.message : String(error)
  }
  await saveJson(resolve(directory, 'capture.json'), report)
  return report
}

export async function compareNativeListings(directory) {
  const output = resolve(directory, 'tests.json')
  const run = spawnSync('pnpm', [
    'exec', 'vitest', 'run', 'src/services/rendering/nativeListing.test.ts',
    '--reporter=default', '--reporter=json', `--outputFile=${output}`,
  ], {
    cwd: repository,
    env: { ...process.env, EVR_NATIVE_FIXTURE_DIR: resolve(directory) },
    stdio: 'inherit',
  })
  const result = { status: 'test-runner-failed', exitCode: run.status, signal: run.signal }
  try {
    if (run.error) throw run.error
    const tests = JSON.parse(await readFile(output, 'utf8'))
    result.passed = tests.numPassedTests
    result.failed = tests.numFailedTests
    if (run.status === 0 && tests.success && tests.numPassedTests === 4) result.status = 'compatible'
    else if (run.status !== 0 && tests.numFailedTests > 0) result.status = 'incompatible'
    else result.error = 'The four native layout checks did not complete'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  await saveJson(resolve(directory, 'result.json'), result)
  return result
}

async function main() {
  const parent = resolve(repository, '.scratch/live-native-listing')
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(`${parent}/run-`)
  console.log(`Live native listing artifacts: ${directory}`)
  const capture = await captureNativeListings({ directory })
  if (capture.status !== 'captured') {
    console.error(`${capture.status}: ${capture.error}`)
    process.exitCode = 2
    return
  }
  const result = await compareNativeListings(directory)
  console.log(`Live native listing result: ${result.status}`)
  if (result.status !== 'compatible') process.exitCode = result.status === 'incompatible' ? 1 : 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 2
  })
}
