# 與 Eh View Refined 整合

[English](integration.md)

以下全部都是一般的 DOM，任何腳本、任何 sandbox 讀到的都一樣。Eh View Refined 只描述自己畫了什麼：這裡的一切都不需要腳本先向它註冊或告訴它任何事。它會配合網站上常用腳本對頁面做的事，例如翻譯腳本已經改寫過的標籤，複製時會還原成網站原本的文字，讓那些腳本在它畫出的版型上照常運作。清單用 JSON，單一值用純字串，沒有值就不掛 attribute。attribute 與它們的意義只會增加、不會更改，讀取時請寬容：遇到不認得的欄位與值就略過。

## 偵測 Eh View Refined

本插件執行時，根元素 `<html>` 帶有 `data-evr-version` attribute，值是插件版本。它在 `document-start` 就寫入，套用到插件比對的每個頁面，較晚執行的腳本可以直接讀取。

```js
const evrVersion = document.documentElement.getAttribute('data-evr-version') // 未執行時為 null
```

## 讀取所有標籤

每個圖庫項目的 `data-evr-tags` attribute 提供網站列出的所有標籤的 JSON 陣列，也就是 power 足以被搜尋到的每一個標籤。每筆包含 `name`（原始標籤名稱）與 `tier`，也就是網站自己用來標示標籤確定程度的 class：`gt`（確定）、`gtl`（票數多但尚未確定）、`gtw`（權重低）。為了以防網站日後更動這些 class，遇到不認得的 `tier` 值請當成未知的層級處理。隱藏標籤不影響這份資料。

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
```

## 讀取上傳者

每個圖庫項目的 `data-evr-uploader` attribute 提供上傳者名稱，取自上傳者連結並已解碼。所有視圖都有這份資料，包括本身不顯示上傳者的 Thumbnail；來源列沒有上傳者連結時就沒有這個 attribute。

```js
const uploader = element.getAttribute('data-evr-uploader') // 沒有上傳者連結時為 null
```

## 依名稱找到標籤

列表上畫出的每一個標籤，不論哪種視圖（包括 Extended），都帶有 `data-evr-tag`（原始標籤名稱）與 `data-evr-ns`（namespace）；網站沒有歸到任何 namespace 的標籤沒有 `data-evr-ns`。元素保留網站的 class，標籤文字是它唯一的子節點，腳本可以直接在原元素上改樣式，不必加入節點。

除非讀者關掉「**把上傳者顯示在標籤裡**」（預設開啟），每個有上傳者的圖庫會多一個長得像標籤的元素，帶有 class `evr-uploader-tag`、`data-evr-tag="uploader:<名稱>"` 與 `data-evr-ns="uploader"`。它不在 `data-evr-tags` 裡。開啟「**每個 namespace 一列**」時，模擬視圖會照 Extended 的 namespace 列與順序分列，上傳者放在最後一列。

```js
const tags = document.querySelectorAll('[data-evr-tag]')
const name = tags[0].getAttribute('data-evr-tag') // 上傳者標籤會是 "uploader:<名稱>"
```

## 監看新的圖庫

每一頁圖庫（包括無限滾動載入的頁）都一次插入列表，所以文件載入完成後，監看列表的 `MutationObserver` 每頁只會收到一筆 `childList` 紀錄。文件還在載入時插入的那一頁，後面會再跟著每個標籤各一筆紀錄：標籤文字會在整批插入之後再加入一次，讓只讀取新增節點的翻譯腳本也能看到每個標籤。

## 視窗外的圖庫

開啟無限滾動時，離視窗很遠的圖庫會留在文件裡但不繪製：它們帶有 class `evr-parked`，設為 `display: none`。裡面的節點、reference 與表單欄位都維持原樣，回到視窗附近時 class 就會拿掉。列表旁的兩個 `.evr-window-spacer` 撐住這些圖庫的高度。

## 讀取評分

每個圖庫項目的 `data-evr-rating` attribute 提供星星顯示的平均評分，以半顆星為單位，介於 `0` 到 `5`。使用者自己評過分的圖庫，網站的星星改畫使用者自己的評分；這類項目把它放在 `data-evr-my-rating`，不會有 `data-evr-rating`，因為列表上已經看不到平均分。

```js
const rating = element.getAttribute('data-evr-rating') // 例如 "4.5"
const myRating = element.getAttribute('data-evr-my-rating') // 只有使用者評過分時才有
```

## 以 Extended 發送 search request

讓使用者安裝本插件並使用模擬視圖後，網站端的 view mode 會始終維持 Extended。其他腳本可以直接以 Extended mode 發送 search request，取得完整標籤；使用者看到的排版由本插件處理，無須擔心這些請求改變使用者選擇的模擬視圖。

## 打開設定

在 `document` 上發出 `evr:open-settings` 事件，就會打開 Eh View Refined 的設定；只要頁面上有 `data-evr-version` 就能用。listener 從 `document-start` 就已經掛好。這個事件不帶任何資料，所以從任何 sandbox 發出一般的 `Event` 都可以。設定關閉時，焦點會回到發出事件當下持有焦點的元素，通常就是發出事件的那顆按鈕。

```js
if (document.documentElement.hasAttribute('data-evr-version')) {
  document.dispatchEvent(new Event('evr:open-settings'))
}
```
