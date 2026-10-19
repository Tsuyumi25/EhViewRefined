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

以下全部都是一般的 DOM，任何腳本、任何 sandbox 讀到的都一樣。Eh View Refined 只描述自己畫了什麼：這裡的一切都不需要腳本先向它註冊或告訴它任何事。它會配合網站上常用腳本對頁面做的事，例如翻譯腳本已經改寫過的標籤，複製時會還原成網站原本的文字，讓那些腳本在它畫出的版型上照常運作。清單用 JSON，單一值用純字串，沒有值就不掛 attribute。attribute 與它們的意義只會增加、不會更改，讀取時請寬容：遇到不認得的欄位與值就略過。

### 偵測 Eh View Refined

本插件執行時，根元素 `<html>` 帶有 `data-evr-version` attribute，值是插件版本。它在 `document-start` 就寫入，套用到插件比對的每個頁面，較晚執行的腳本可以直接讀取。

```js
const evrVersion = document.documentElement.getAttribute('data-evr-version') // 未執行時為 null
```

### 讀取所有標籤

每個圖庫項目的 `data-evr-tags` attribute 提供網站列出的所有標籤的 JSON 陣列，也就是 power 足以被搜尋到的每一個標籤。每筆包含 `name`（原始標籤名稱）與 `tier`，也就是網站自己用來標示標籤確定程度的 class：`gt`（確定）、`gtl`（票數多但尚未確定）、`gtw`（權重低）。日後的版本可能為網站新增的層級加上新的值，遇到不認得的值請當成未知的層級處理。隱藏標籤不影響這份資料。

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
```

### 讀取上傳者

每個圖庫項目的 `data-evr-uploader` attribute 提供上傳者名稱，取自上傳者連結並已解碼。所有視圖都有這份資料，包括本身不顯示上傳者的 Thumbnail；來源列沒有上傳者連結時就沒有這個 attribute。

```js
const uploader = element.getAttribute('data-evr-uploader') // 沒有上傳者連結時為 null
```

### 依名稱找到標籤

列表上畫出的每一個標籤，不論哪種視圖（包括 Extended），都帶有 `data-evr-tag`（原始標籤名稱）與 `data-evr-ns`（namespace）；網站沒有歸到任何 namespace 的標籤沒有 `data-evr-ns`。元素保留網站的 class，標籤文字是它唯一的子節點，腳本可以直接在原元素上改樣式，不必加入節點。

除非讀者關掉「**把上傳者顯示在標籤裡**」（預設開啟），每個有上傳者的圖庫會多一個長得像標籤的元素，帶有 class `evr-uploader-tag`、`data-evr-tag="uploader:<名稱>"` 與 `data-evr-ns="uploader"`。它不在 `data-evr-tags` 裡。開啟「**每個 namespace 一列**」時，模擬視圖會照 Extended 的 namespace 列與順序分列，上傳者放在最後一列。

```js
const tags = document.querySelectorAll('[data-evr-tag]')
const name = tags[0].getAttribute('data-evr-tag') // 上傳者標籤會是 "uploader:<名稱>"
```

### 監看新的圖庫

每一頁圖庫（包括無限滾動載入的頁）都一次插入列表，所以監看列表的 `MutationObserver` 每頁只會收到一筆 `childList` 紀錄。

### 視窗外的圖庫

開啟無限滾動時，離視窗很遠的圖庫會留在文件裡但不繪製：它們帶有 class `evr-parked`，設為 `display: none`。裡面的節點、reference 與表單欄位都維持原樣，回到視窗附近時 class 就會拿掉。列表旁的兩個 `.evr-window-spacer` 撐住這些圖庫的高度。

### 讀取評分

每個圖庫項目的 `data-evr-rating` attribute 提供星星顯示的平均評分，以半顆星為單位，介於 `0` 到 `5`。使用者自己評過分的圖庫，網站的星星改畫使用者自己的評分；這類項目把它放在 `data-evr-my-rating`，不會有 `data-evr-rating`，因為列表上已經看不到平均分。

```js
const rating = element.getAttribute('data-evr-rating') // 例如 "4.5"
const myRating = element.getAttribute('data-evr-my-rating') // 只有使用者評過分時才有
```

### 以 Extended 發送 search request

讓使用者安裝本插件並使用模擬視圖後，網站端的 view mode 會始終維持 Extended。其他腳本可以直接以 Extended mode 發送 search request，取得完整標籤；使用者看到的排版由本插件處理，無須擔心這些請求改變使用者選擇的模擬視圖。

### 打開設定

在 `document` 上發出 `evr:open-settings` 事件，就會打開 Eh View Refined 的設定；只要頁面上有 `data-evr-version` 就能用。listener 從 `document-start` 就已經掛好。這個事件不帶任何資料，所以從任何 sandbox 發出一般的 `Event` 都可以。設定關閉時，焦點會回到發出事件當下持有焦點的元素，通常就是發出事件的那顆按鈕。

```js
if (document.documentElement.hasAttribute('data-evr-version')) {
  document.dispatchEvent(new Event('evr:open-settings'))
}
```

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
├─ listingPipeline.ts     列表流程與目前顯示的版型
├─ listingModes.ts        原生與模擬版型選項
├─ gallerySnapshot.ts     snapshot 資料與具名 DOM 綁定契約
├─ source/                Extended 解析、metadata、來源列與分頁抓取
└─ rendering/             原生 DOM、標籤選取、封面幾何與相容性
```

Adapter 在畫出目前模擬版型的圖庫項目時取得 snapshot。來源列畫好之後只留下 markup；切走的版型直接丟掉，切回來時再從 markup 重建。具名來源節點綁定負責保留 markup 與控制項狀態連結，與 snapshot 的渲染決策資料分開。對外的 `data-evr-tags`、`data-evr-tag`、`data-evr-ns`、`data-evr-uploader`、`data-evr-rating` 與 `data-evr-my-rating` metadata 在收集來源列時取得，`data-evr-tags` 維持既有格式。

`rendering/` 內由 `nativeLayouts.ts` 選取版型定義，`nativeListing.ts` 負責容器建立、去重與追加。`tableLayout.ts` 集中表格欄位順序、class、表頭文字與標籤策略，Minimal 與 Minimal+ 共用結構。`thumbnailLayout.ts` 持有卡片結構與 grid 樣式初始化，共用圖庫片段放在 `galleryFragments.ts`。

## 授權

[MIT](LICENSE)
