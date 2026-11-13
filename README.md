# 東亞歷史

這個儲存庫包含兩個可獨立開啟的靜態網站，並以相對路徑串在一起，因此放在 GitHub Pages 的專案子路徑 `/east-asia-history/` 下也能正常載入。

| 網站 | 路徑 | 線上位址 |
| --- | --- | --- |
| 東亞歷史時空圖 | 儲存庫根目錄 | https://rainapply3572.github.io/east-asia-history/ |
| 東亞歷史猜年 | `/guess/` | https://rainapply3572.github.io/east-asia-history/guess/ |
| 題庫專區 | `/guess/bank.html` | https://rainapply3572.github.io/east-asia-history/guess/bank.html |

地圖頁標題旁有「東亞歷史猜年」，連到 `guess/`。猜年遊戲各畫面有「東亞歷史時空圖」，連回上一層 `../`。

根目錄的 `.nojekyll` 讓 GitHub Pages 直接發布檔案，不經 Jekyll 處理。

## 東亞歷史時空圖

在地圖上移動年代，瀏覽東亞重大事件，並疊上該年代最接近的近似疆域。範圍涵蓋中國、日本、朝鮮半島、臺灣、蒙古與越南。

- 用下方時間軸選取年代範圍，或按「依年代播放」順時推進。
- 左側可依地區、類型篩選；點列表或地圖標記可看事件說明。
- 「顯示疆域圖」會畫出最接近所選結束年的疆域快照。邊界是大陸尺度的近似重建，不能當成精確國界。

## 東亞歷史猜年

讀一段已隱去年分的事件，在時間軸上標出你認為的年份。離正確年份越近，分數越高。

1. 選擇地區、年代範圍與類型。回合數可選 5、10 或 20。可只出「僅課內題」（國中歷史課綱，含臺灣史與中國、東亞相關單元，108 課綱）。
2. 按「開始遊戲」。時間軸可切換朝代體系；也能直接輸入年份，或勾選「西元前」。
3. 每題最高 5,000 分。猜中得滿分；有誤差時，依所選年代範圍的寬度計分，差距越大分數越低。範圍越窄，同樣的年份誤差扣得越多。同一局不會重複同一則事件。
4. 單人分數會依設定記在這臺瀏覽器的本機最高分。單人模式用本機檔案直接開啟即可。

多人連線：

- 「開房間」會向 PeerJS 公共伺服器取得房間代碼；「加入房間」輸入代碼即可。房主負責出題與計分，其他人連到房主。
- 可設定每題時限。請保持網路暢通。若瀏覽器在 `file://` 下無法建立連線，請改以本機或網站的 `http`／`https` 開啟。
- 「開房間」只需要暱稱。房間代碼會自動產生並顯示出來，傳給朋友即可；「加入房間」才要輸入代碼。

## 題庫專區

遊戲首頁有「題庫專區」，或直接打開 [guess/bank.html](guess/bank.html)。這一頁用和遊戲相同的 `events.js`，雙擊檔案（`file://`）也能瀏覽。

- 每題顯示玩家會看到的題目與敘述、地區、是否為課內題。
- 年份和朝代預設隱藏，勾選「顯示年份與朝代」才看得到。
- 可搜尋、依地區與朝代／時期篩選、只看課內，並依年份排序。
- 每一題的「修改」可建議改正文，或建議刪除。刪除也要等核准才會生效。

### 提案新題或建議修改

頁面上的表單不會直接改題庫。送出後會開啟這個儲存庫的 GitHub 新議題，所以要有 GitHub 帳號。也可以改走議題表單：[題庫申請](https://github.com/rainapply3572/east-asia-history/issues/new?template=question-submission.yml)、[題庫修改](https://github.com/rainapply3572/east-asia-history/issues/new?template=question-edit.yml)。

事件敘述不要寫朝代、年號、世紀或西元年分。年份用整數，西元前用負數（例如 `-221`）。

### 維護者如何核准

只有儲存庫擁有者 `rainapply3572` 加上 **核准** 標籤時，GitHub Actions 才會改 `guess/events.js`、推上 `main`、在議題留言並關閉。其他人加標籤、開新議題或編輯內文都不會改題庫。留言覆寫也只看擁有者，而且該則留言的 `author_association` 必須是 `OWNER`。

核准當下的議題內文就是採用的內容，之後若有人再改內文也不會被讀進去。動作看內文的「動作」欄：

- `新增`：加一題，編號由程式產生（`q-` 加議題編號）。
- `修改`：依「題目編號」更新那一題，編號本身不會改。原有的經緯度會保留。
- `刪除`：依「題目編號」移除那一題。

寫入前會檢查年份、地區、類型，並拒絕在題目或敘述裡洩漏朝代或年分。內容以 JSON 寫進 `events.js`，不會當成程式執行。

核准前可以改內容，兩種方式：

1. **直接改議題內文**（建議）。GitHub 議題表單會把每個欄位寫成 `### 年份` 這種標題。改標題底下的文字，存檔後再加「核准」。程式讀的是加上標籤那一刻的內文。
2. **擁有者留言覆寫**。先用擁有者帳號留言，再加「核准」。只採最新一則符合格式的擁有者留言；裡面的欄位蓋過議題內文的同名欄位。請用圍欄，例如：

````
```
年份: 1592
地區: 日本
題目: 一行題目
事件敘述: 玩家會讀到的敘述，不要寫朝代或年分。
```
````

若解析失敗，機器人會留言說明原因，並拿掉「核准」，方便改完再加一次。成功時留言會附上實際寫入的題目；修改會同時列出修改前與修改後。

### 第一次使用前請手動確認

- 儲存庫已開啟 Issues。
- Settings → Actions → General → Workflow permissions 設為 **Read and write permissions**，否則動作無法把題目推上 `main`。
- 建好三個標籤：`題庫申請`、`題庫修改`、`核准`。議題表單會用前兩個；核准流程只認 `核准`。
- `main` 要允許 GitHub Actions 直接推送。若開了分支保護，請讓 `github-actions[bot]` 可以寫入，或改由擁有者手動合併。
- 協作者名單請只留擁有者本人。其他有寫入權限的帳號雖然不能靠這個動作改題庫（動作會核對登入帳號是不是擁有者），但仍可能自己加標籤或直接推程式。

## 在本機預覽

於儲存庫根目錄啟動任一靜態伺服器，例如：

```bash
python3 -m http.server 8000
```

然後開啟 `http://127.0.0.1:8000/`、`http://127.0.0.1:8000/guess/` 與 `http://127.0.0.1:8000/guess/bank.html`。樣式、腳本與圖片都使用相對路徑，不依賴網站掛在網域根目錄。題庫頁也可以直接雙擊 `guess/bank.html` 開啟。

## 資料來源與授權

事件條目由本站整理，供學習與瀏覽。年份、地點與敘述採取通行說法，許多事件的斷代與地點仍有爭議，內容是近似的，不能視為精確的歷史定年或考證。

疆域多邊形來自 [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)，依 **GPL-3.0** 使用。本站選用約西元前 300 年至 2000 年的快照，裁到東亞範圍（約東經 70–155 度、北緯 5–56 度）並加以簡化；顯示用的繁體中文名稱只加在畫面上，原始 `NAME` 未改。授權全文見 [`licenses/GPL-3.0.txt`](licenses/GPL-3.0.txt)，改作說明見 [`licenses/HISTORICAL-BASEMAPS.txt`](licenses/HISTORICAL-BASEMAPS.txt)。這些邊界是大陸尺度的近似重建，不能作為精確國界或主權主張的依據。

底圖磚片在執行時向 Esri 讀取（World Street Map，失敗時改試 Topo 與 Imagery），圖台上保留 Esri 的出處標示。磚片不包含在這個儲存庫裡。

第三方程式庫：

| 程式庫 | 版本 | 授權 | 使用位置 | 授權全文 |
| --- | --- | --- | --- | --- |
| [Leaflet](https://leafletjs.com) | 1.9.4 | BSD-2-Clause | 兩個網站的 `vendor/leaflet.js`、`vendor/leaflet.css` | [`licenses/LEAFLET.txt`](licenses/LEAFLET.txt) |
| [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) | — | MIT | 時空圖的標記聚合 | [`licenses/MARKERCLUSTER.txt`](licenses/MARKERCLUSTER.txt) |
| [PeerJS](https://peerjs.com) | 1.5.5 | MIT | 猜年遊戲 `guess/vendor/peerjs.min.js` | [`licenses/PEERJS.txt`](licenses/PEERJS.txt) |

字型透過 Google Fonts 載入 Noto Sans TC 與 Noto Serif TC；若字型服務無法連線，會改用系統的繁體中文字型。
