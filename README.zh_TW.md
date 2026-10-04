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

## 開發

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm test` 包含離線 DOM 相容性測試，使用 `tests/fixtures/native-listing/` 中從[這個 Non-H 列表](https://e-hentai.org/?f_cats=767&prev=45313)擷取的五份匿名化原生版型 fixture。測試將 Extended 資料渲染為各個模擬版型，與對應的原生 fixture 比較整個 listing 的元素階層、子元素順序與所有 class。原生廣告列排除於比較範圍外，Thumbnail 的完整標籤區則以 Extended fixture 核對。

Fixture 的文字、連結、資源 URL 與事件處理器內容已匿名化，元素結構、class 與排版 style 保留。文字、其他屬性、視覺排版與高亮標籤專屬行為不在這份結構契約的範圍內。測試不需要網路連線。

GitHub Actions 的 `Test` workflow 會在推送至 `main`、以 `main` 為目標的 pull request，以及手動觸發時執行 `pnpm test`。

`pnpm test:live` 從同一個列表網址抓取目前的五種原生版型，以這些回應執行同一份 DOM 契約測試。比較前會驗證選中的模式，以及各版型的圖庫身份與順序一致。這個命令不會覆寫已提交的 fixture。

每次執行會印出 `.scratch/live-native-listing/` 下的擷取目錄，內含回應 HTML、`capture.json`，比較後另有 `tests.json` 與 `result.json`。抓取錯誤（`fetch-failed`）、樣本無效（`validation-failed`）、結構差異（`incompatible`）與測試執行錯誤（`test-runner-failed`）分開回報。離線重播時，將 `EVR_NATIVE_FIXTURE_DIR` 設為該目錄，再執行 `pnpm test src/services/rendering/nativeListing.test.ts`。

`Live native listing` workflow 每日於 UTC 03:17 執行，也支援手動觸發。擷取頁面與已產生的報告以 artifact 保存 14 天，失敗時也保留，不需要登入 cookie 或 repository 寫入權限。GitHub 排程使用預設分支、可能延遲，公開 repository 閒置 60 天後會停用排程；詳見 [GitHub 排程說明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

`src/main.ts` 啟動與停止頁面服務。`src/services/listingPipeline.ts` 串接來源收集、解析、渲染與檢視切換；欄位解讀與 DOM 建構由它呼叫的模組負責。

```text
src/services/
├─ listingPipeline.ts     列表流程與各版型快取
├─ listingModes.ts        原生與模擬版型選項
├─ gallerySnapshot.ts     snapshot 資料與具名 DOM 綁定契約
├─ source/                Extended 解析、metadata、來源列與分頁抓取
└─ rendering/             原生 DOM、標籤選取、封面幾何與相容性
```

Adapter 在每種模擬版型首次建立圖庫項目時取得 snapshot，後續切換沿用既有版型 DOM。具名來源節點綁定負責保留 markup 與控制項狀態連結，與 snapshot 的渲染決策資料分開。對外的 `data-evr-tags` metadata 在收集來源列時取得，維持既有格式。

`rendering/` 內由 `nativeLayouts.ts` 選取版型定義，`nativeListing.ts` 負責容器建立、去重與追加。`tableLayout.ts` 集中表格欄位順序、class、表頭文字與標籤策略，Minimal 與 Minimal+ 共用結構。`thumbnailLayout.ts` 持有卡片結構與 grid 樣式初始化，共用圖庫片段放在 `galleryFragments.ts`。

## 授權

[MIT](LICENSE)
