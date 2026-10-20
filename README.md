# Eh View Refined

[繁體中文](README.zh_TW.md)

Get complete gallery tags on E-Hentai and ExHentai while keeping a familiar browsing layout.

The listing is always fetched in the site's native **Extended** mode, which is the only one that carries every tag, and then drawn as Minimal, Minimal+, Compact, Extended or Thumbnail with the site's own styles.

## Installation

1. Install a userscript manager in your browser, then install [`eh-view-refined.user.js`](https://github.com/Tsuyumi25/EhViewRefined/releases/latest/download/eh-view-refined.user.js).
2. Place this script first in the userscript execution order, so the listing it draws is in place before other scripts read the page.
   - **Tampermonkey**: on the Dashboard, drag Eh View Refined to the top by the ☰ icon in its **Sort** column, or open the script's **Settings** tab and set **Position** to `1`.
   - **Violentmonkey**: on the **Installed scripts** page, set the sort order to **execution**, then drag Eh View Refined to the top.
3. On a listing page, choose a layout from the **Eh View Refined layouts** group of the layout selector.

## Settings

Open them with the **Settings** button next to the layout selector, or from the userscript manager's menu.

| Setting | Default | |
|---|---|---|
| Infinite scrolling | On | Load the next page as you reach the end of the listing |
| Show every My Tags tag | On | Show all of a gallery's tags that are in My Tags; natively Minimal+, Compact and Thumbnail show at most 12, and Minimal none |
| Show every other tag | On | Show all of its remaining tags too; natively only Compact shows them, in what is left of its 12 |
| One row per namespace | Off | Group tags into the namespace rows Extended shows |
| Show the uploader among the tags | On | Add the uploader as one more tag |
| Language | Browser | English, 繁體中文, 简体中文, 日本語, 한국어 |

## Compatibility

Works with [EhSyringe](https://github.com/EhTagTranslation/EhSyringe), [Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) and [Lolicon E-Hentai / ExHentai Enhancer](https://sleazyfork.org/scripts/516145).

Other scripts can read every tag, the uploader and the rating from the listing it draws; see [Integrating with Eh View Refined](docs/integration.md).

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the native listing compatibility tests.

## License

[MIT](LICENSE)
