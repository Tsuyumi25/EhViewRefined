# Eh View Refined

[English](README.md)

讓 E-Hentai 與 ExHentai 使用者取得完整圖庫標籤，同時維持習慣的瀏覽排版。

以網站原生的 **Extended 模式**取得列表資料，再模擬 Minimal、Minimal+、Compact 或 Thumbnail 的樣式與 DOM 結構，將資料來源與顯示排版分開。

## 安裝

1. 在瀏覽器安裝 userscript manager，再從本專案 Releases 安裝 `eh-view-refined.user.js`。
2. 將本插件放在腳本執行順序的最前方。
3. 在列表頁的 **Eh View Refined 排版**群組選擇要模擬的原生排版。

## 相容性

支援與 [EhSyringe](https://github.com/EhTagTranslation/EhSyringe)、[Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer)、[Lolicon E-Hentai / ExHentai Enhancer](https://sleazyfork.org/scripts/516145) 搭配使用。

## 給其他腳本開發者

### 讀取完整標籤

每個圖庫項目的 `data-evr-tags` attribute 提供完整標籤的 JSON 陣列。每筆包含 `name`（原始標籤名稱）與 `borderStyle`（`solid`、`dashed` 或 `dotted`）；隱藏標籤不影響這份資料。

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
```

### 以 Extended 發送 search request

讓使用者安裝本插件並使用模擬視圖後，網站端的 view mode 會始終維持 Extended。其他腳本可以直接以 Extended mode 發送 search request，取得完整標籤；使用者看到的排版由本插件處理，無須擔心這些請求改變使用者選擇的模擬視圖。

## 授權

[MIT](LICENSE)
