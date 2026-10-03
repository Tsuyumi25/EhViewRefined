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

## License

[MIT](LICENSE)
