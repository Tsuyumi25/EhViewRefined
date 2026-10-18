# Eh View Refined

[繁體中文](README.zh_TW.md)

Get complete gallery tags on E-Hentai and ExHentai while keeping a familiar browsing layout.

Fetch listing data in the site's native **Extended mode**, then simulate the styles and DOM structure of Minimal, Minimal+, Compact or Thumbnail, separating the data source from the displayed layout.

## Installation

1. Install a userscript manager in your browser, then install `eh-view-refined.user.js` from this project's Releases.
2. Place this script first in the userscript execution order.
3. On a listing page, choose the native layout to simulate from the **Eh View Refined layouts** group.

## Compatibility

Works with [EhSyringe](https://github.com/EhTagTranslation/EhSyringe), [Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) and [Lolicon E-Hentai / ExHentai Enhancer](https://sleazyfork.org/scripts/516145).

## For Other Script Developers

Everything below is plain DOM, so it reads the same from any script or sandbox. Eh View Refined only describes what it draws: nothing here needs a script to register with it or tell it anything first. It does follow what widely used scripts for the site do to the page, such as copying tags back to the text the site served when a translation script has already rewritten them, so those scripts keep working on the views it draws. Lists are JSON, single values are plain strings, and a value that does not exist leaves its attribute out. Attributes and their meanings are only ever added to, so read leniently: ignore fields and values you do not know.

### Detecting Eh View Refined

While the script runs, the root `<html>` element carries `data-evr-version` with its version. It is set at `document-start` on every page the script matches, so scripts that run later can read it directly.

```js
const evrVersion = document.documentElement.getAttribute('data-evr-version') // null when not running
```

### Reading All Tags

Each gallery item's `data-evr-tags` attribute contains a JSON array of all its tags the site lists, which is every tag with enough power to be searched. Each entry includes `name` (the original tag name) and `tier`, the site's own class for how settled the tag is: `gt` (confirmed), `gtl` (many votes, not yet confirmed) or `gtw` (little weight). Later versions may add values for tiers the site introduces; treat a value you do not know as an unrecognised tier. Hiding tags does not affect this data.

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
```

### Reading the Uploader

Each gallery item's `data-evr-uploader` attribute contains the uploader's name, decoded from the uploader link. It is present in every view, including Thumbnail, whose layout shows no uploader. Items whose row has no uploader link have no attribute.

```js
const uploader = element.getAttribute('data-evr-uploader') // null without an uploader link
```

### Finding Tags by Name

Every tag drawn in a listing, in any view including Extended, carries `data-evr-tag` with its original name and `data-evr-ns` with its namespace; a tag the site files under no namespace has no `data-evr-ns`. The element keeps the site's classes and holds the tag text as its only child, so a script can restyle it in place without adding nodes.

Unless the reader turns off **Show the uploader among the tags** (on by default), each gallery with an uploader gets one more tag-shaped element with the class `evr-uploader-tag`, `data-evr-tag="uploader:<name>"` and `data-evr-ns="uploader"`. It is not part of `data-evr-tags`. With **One row per namespace**, the simulated views group tags into the namespace rows Extended shows, in the same order, and the uploader gets the last row.

```js
const tags = document.querySelectorAll('[data-evr-tag]')
const name = tags[0].getAttribute('data-evr-tag') // e.g. "uploader:<name>" for the uploader tag
```

### Watching New Galleries

Each page of galleries, including those infinite scrolling loads, is inserted into the listing in one batch, so a `MutationObserver` on the listing sees one `childList` record per page.

### Galleries Outside the Window

With infinite scrolling on, galleries far from the viewport stay in the document but are not drawn: they carry the class `evr-parked`, which sets `display: none`. Nodes, references and form inputs inside them stay as they were, and the class is removed when they come back near the viewport. Two `.evr-window-spacer` elements next to the listing hold the height of the parked galleries.

### Reading the Rating

Each gallery item's `data-evr-rating` attribute contains the average rating its stars show, in half-star steps from `0` to `5`. Once the user has rated a gallery, the site's stars show the user's own rating instead; such items carry it in `data-evr-my-rating` and have no `data-evr-rating`, since the listing no longer shows the average.

```js
const rating = element.getAttribute('data-evr-rating') // e.g. "4.5"
const myRating = element.getAttribute('data-evr-my-rating') // set only when the user has rated it
```

### Sending Search Requests in Extended Mode

Once users install this script and use its simulated views, the site's view mode stays in Extended. Other scripts can send search requests in Extended mode to retrieve complete tags. Eh View Refined handles the displayed layout, so those requests leave the user's chosen simulated view unchanged.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm test` includes offline DOM compatibility tests using five anonymized native listing fixtures in `tests/fixtures/native-listing/`, captured from [this Non-H listing](https://e-hentai.org/?f_cats=767&prev=45313). The tests render Extended data into each simulated view and compare the entire listing's element hierarchy, child order and class tokens with the corresponding native fixture. Native advertisement rows are excluded; Thumbnail's complete-tag region is checked against the Extended fixture.

Fixture text, links, resource URLs and event-handler contents are anonymized while element structure, classes and layout styles are retained. Text, other attributes, visual layout and highlight-specific behavior are outside this structural contract. Tests require no network access.

The `Test` GitHub Actions workflow runs `pnpm test` on pushes to `main`, pull requests targeting `main`, and manual dispatches.

`pnpm test:live` fetches the current five native layouts from the same listing URL and runs the same DOM contract tests against those responses. It validates the selected modes and matching gallery identities and order before comparison. It never replaces the committed fixtures.

Each run prints a capture directory under `.scratch/live-native-listing/`, containing the response HTML, `capture.json`, and, after comparison, `tests.json` and `result.json`. Fetch errors (`fetch-failed`), invalid samples (`validation-failed`), structural differences (`incompatible`) and test execution errors (`test-runner-failed`) are reported separately. To replay a capture offline, set `EVR_NATIVE_FIXTURE_DIR` to that directory and run `pnpm test src/services/rendering/nativeListing.test.ts`.

The `Live native listing` workflow runs daily at 03:17 UTC and supports manual dispatch. It retains captured pages and available reports as artifacts for 14 days, including failed runs. It requires no login cookies or repository write permission. GitHub schedules run on the default branch, can be delayed, and are disabled after 60 days of inactivity in public repositories; see [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

`src/main.ts` starts and stops the page services. `src/services/listingPipeline.ts` coordinates source collection, adaptation, rendering and view switching; field interpretation and DOM construction belong to the modules it calls.

```text
src/services/
├─ listingPipeline.ts     Listing flow and the view on screen
├─ listingModes.ts        Native and simulated view choices
├─ gallerySnapshot.ts     Snapshot data and named DOM binding contracts
├─ source/                Extended parsing, metadata, source rows and pagination
└─ rendering/             Native DOM, tag selection, cover geometry and compatibility
```

The adapter captures a snapshot when an item is built for the simulated view on screen. Once drawn, the source row is kept only as markup; a view switched away from is dropped and built again from that markup when it returns. Named source-node bindings preserve markup and control-state links separately from the snapshot's rendering decisions. Public `data-evr-tags`, `data-evr-tag`, `data-evr-ns`, `data-evr-uploader`, `data-evr-rating` and `data-evr-my-rating` metadata is captured when source rows are collected; `data-evr-tags` retains its existing format.

Within `rendering/`, `nativeLayouts.ts` selects the layout definition, and `nativeListing.ts` handles container setup, deduplication and insertion. `tableLayout.ts` keeps table column order, classes, header labels and tag strategies together; Minimal and Minimal+ share their structure. `thumbnailLayout.ts` owns the card structure and its grid-style initialization. Shared gallery fragments live in `galleryFragments.ts`.

## License

[MIT](LICENSE)
