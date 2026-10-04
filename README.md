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

### Reading Complete Tags

Each gallery item's `data-evr-tags` attribute contains a JSON array of its complete tags. Each entry includes `name` (the original tag name) and `borderStyle` (`solid`, `dashed` or `dotted`). Hiding tags does not affect this data.

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
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

`src/main.ts` starts and stops the page services. `src/services/listingPipeline.ts` coordinates source collection, adaptation, rendering and view switching; field interpretation and DOM construction belong to the modules it calls.

```text
src/services/
├─ listingPipeline.ts     Listing flow and per-view cache
├─ listingModes.ts        Native and simulated view choices
├─ gallerySnapshot.ts     Snapshot data and named DOM binding contracts
├─ source/                Extended parsing, metadata, source rows and pagination
└─ rendering/             Native DOM, tag selection, cover geometry and compatibility
```

The adapter captures a snapshot when an item is first built for each simulated view. Existing view DOM is reused on later switches. Named source-node bindings preserve markup and control-state links separately from the snapshot's rendering decisions. Public `data-evr-tags` metadata is captured when source rows are collected and retains its existing format.

Within `rendering/`, `nativeLayouts.ts` selects the layout definition, and `nativeListing.ts` handles container setup, deduplication and insertion. `tableLayout.ts` keeps table column order, classes, header labels and tag strategies together; Minimal and Minimal+ share their structure. `thumbnailLayout.ts` owns the card structure and its grid-style initialization. Shared gallery fragments live in `galleryFragments.ts`.

## License

[MIT](LICENSE)
