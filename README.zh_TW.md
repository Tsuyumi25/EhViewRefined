# Eh View Refined

[English](README.md)

讓 E-Hentai 與 ExHentai 使用者取得完整圖庫標籤，同時維持習慣的瀏覽排版。

列表一律以網站原生的 **Extended 模式**取得，因為只有它帶著每一個標籤，再用網站自己的樣式畫成 Minimal、Minimal+、Compact、Extended 或 Thumbnail。

## 安裝

1. 在瀏覽器安裝 userscript manager，再安裝 [`eh-view-refined.user.js`](https://github.com/Tsuyumi25/EhViewRefined/releases/latest/download/eh-view-refined.user.js)。
2. 將本插件放在腳本執行順序的最前方，讓其他腳本讀取頁面時，本插件畫的列表已經就位。
   - **Tampermonkey**：在 Dashboard 抓住 Eh View Refined 那一列 **Sort** 欄的 ☰ 圖示拖到最上面，或打開腳本的 **Settings** 分頁，把 **Position** 設為 `1`。
   - **Violentmonkey**：在 **Installed scripts** 頁面把排序設為 **execution**，再把 Eh View Refined 拖到最上面。
3. 在列表頁的排版選單中，從 **Eh View Refined 排版**群組選擇排版。

## 設定

從排版選單旁的**設定**按鈕，或 userscript manager 的選單打開。

| 設定 | 預設 | |
|---|---|---|
| 無限滾動 | 開 | 捲到列表底部時自動載入下一頁 |
| 顯示完整的 My Tags 標籤 | 開 | 顯示圖庫在 My Tags 裡的所有標籤；原生的 Minimal+、Compact 與 Thumbnail 最多顯示 12 個，Minimal 不顯示 |
| 顯示完整的非 My Tags 標籤 | 開 | 其餘的標籤也全部顯示；原生只有 Compact 會顯示，而且只填滿 12 個的剩餘空間 |
| 每個 namespace 一列 | 關 | 照 Extended 的 namespace 列分組標籤 |
| 把上傳者顯示在標籤裡 | 開 | 把上傳者多畫成一個標籤 |
| 語言 | 跟隨瀏覽器 | English、繁體中文、简体中文、日本語、한국어 |

## 相容性

支援與 [EhSyringe](https://github.com/EhTagTranslation/EhSyringe)、[Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer)、[Lolicon E-Hentai / ExHentai Enhancer](https://sleazyfork.org/scripts/516145) 搭配使用。

其他腳本可以從本插件畫出的列表讀取完整標籤、上傳者與評分，詳見[與 Eh View Refined 整合](docs/integration.zh_TW.md)。

## 開發

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

原生列表相容性測試的說明見 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。

## 授權

[MIT](LICENSE)
