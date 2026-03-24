# PyPttGAS - PTT Web Scraper for Google Apps Script

PTT 的 JavaScript 網頁爬蟲版本，專為 Google Apps Script (GAS) 設計。透過 PTT 的 Web 介面 (www.ptt.cc) 進行 **唯讀** 的 HTTP 請求。

A read-only JavaScript scraper for [PTT](https://www.ptt.cc/) designed for Google Apps Script. Fetches PTT web pages via HTTP requests.

## ⚠️ 重要：與 Python PyPtt 的根本差異

| | Python PyPtt | GAS PyPttGAS |
|---|---|---|
| **連線協定** | WebSocket (`wss://ws.ptt.cc/bbs/`) | HTTP (`https://www.ptt.cc`) |
| **連線對象** | PTT BBS 終端機 (Terminal) | PTT 網頁前端 (HTML) |
| **帳號登入** | ✅ 真實登入 (VT100 終端模擬) | ❌ **不支援** (網頁無登入 API) |
| **讀取文章** | ✅ | ✅ |
| **發文/推文/寄信** | ✅ | ❌ |

**原因：** Python PyPtt 透過 WebSocket 直接連入 PTT BBS 終端機，就像在終端機打帳號密碼一樣。Google Apps Script 只有 `UrlFetchApp`（HTTP 請求），只能存取 www.ptt.cc 的公開網頁。PTT 網頁 **沒有帳號登入 API**，所以無法透過 HTTP 做真實登入。

**為什麼 `login()` 還存在？** `login()` 在 GAS 版中只做兩件事：
1. 記錄使用者身份（用於 log）
2. 自動送出 `POST /ask/over18`（確認滿 18 歲的 cookie），讓限制級看板（如八卦板）可以讀取

所有公開看板的讀取都 **不需要** 呼叫 `login()`。

## 功能 Features

| 功能 | 方法 | 需要 login？ | 說明 |
|------|------|:---:|------|
| 設定使用者 + 解鎖 18+ | `login(id, pw)` | — | 記錄身份 + 確認滿 18 歲 |
| 重置狀態 | `logout()` | — | 清除 cookie 與身份 |
| 取得文章列表 | `getPostList(board)` | ❌ | 公開看板不需登入 |
| 取得文章 | `getPost(board, aid)` | ❌ | |
| 透過 URL 取得文章 | `getPostByUrl(url)` | ❌ | |
| 搜尋文章 | `searchPosts(board, opts)` | ❌ | 關鍵字/作者搜尋 |
| 取得最新頁碼 | `getNewestIndex(board)` | ❌ | |
| 檢查看板是否存在 | `boardExists(board)` | ❌ | |
| URL 解析 | `getAidFromUrl(url)` | ❌ | |
| 讀取 18+ 看板 | `getPostList('Gossiping')` | ✅ | 需要 over-18 cookie |

## 快速開始 Quick Start

### 1. 設定 Google Apps Script 專案

1. 前往 [Google Apps Script](https://script.google.com/) 建立新專案
2. 將 `PyPttGAS.js` 的內容複製到專案中的一個新檔案
3. 將 `Tests.js` 的內容複製到另一個新檔案（可選）

### 2. 設定帳號密碼 (Script Properties)（可選）

只有在需要讀取 18+ 看板時才需要設定。設定後 `login()` 會自動送出 over-18 cookie。

1. 在 Apps Script 編輯器中，點擊 ⚙️ **專案設定** (Project Settings)
2. 捲動到 **指令碼屬性** (Script Properties)
3. 新增以下屬性：
   - `PTT_ACCOUNT` → 你的 PTT 帳號（僅用於 log 記錄）
   - `PTT_PASSWORD` → 你的 PTT 密碼（不會送至 PTT，僅為 API 相容性保留）

### 3. 使用範例

```javascript
// 讀取公開看板 - 不需要 login
function readBaseball() {
  var ptt = new PyPtt();
  var result = ptt.getPostList('Baseball');

  for (var i = 0; i < result.posts.length; i++) {
    Logger.log(result.posts[i].title);
  }
}

// 讀取 18+ 看板 - 需要 login 以確認年齡
function readGossiping() {
  var creds = getPttCredentials();
  var ptt = new PyPtt();
  ptt.login(creds.account, creds.password);

  var result = ptt.getPostList('Gossiping');
  Logger.log('文章數: ' + result.posts.length);
}

// 取得單篇文章 + 所有留言
function readSinglePost() {
  var ptt = new PyPtt();
  var post = ptt.getPostByUrl('https://www.ptt.cc/bbs/Stock/M.1774225803.A.CCD.html');

  Logger.log('標題: ' + post.title);
  Logger.log('作者: ' + post.author);
  Logger.log('留言數: ' + post.comments.length);

  for (var i = 0; i < post.comments.length; i++) {
    var c = post.comments[i];
    Logger.log('[' + c.type + '] ' + c.author + ': ' + c.content);
  }
}

// 搜尋文章
function searchPosts() {
  var ptt = new PyPtt();
  var result = ptt.searchPosts('Baseball', { keyword: '中華' });
  Logger.log('搜尋結果: ' + result.posts.length + ' 篇');
}
```

## API 文件

### 建構函式

```javascript
var ptt = new PyPtt(options);
```

**options:**
| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `host` | string | `'PTT1'` | PTT 主站或 PTT2 (`'PTT1'` or `'PTT2'`) |
| `logLevel` | string | `'INFO'` | 日誌等級 (`'DEBUG'`, `'INFO'`, `'WARN'`, `'ERROR'`) |

### login(pttId, pttPw)

設定使用者身份並確認滿 18 歲 cookie。**不會** 真正登入 PTT 帳號。

```javascript
ptt.login('myId', 'myPw');
// 執行後：
//   - ptt.isLoggedIn() === true (客戶端已就緒)
//   - ptt.getPttId() === 'myId'
//   - over-18 cookie 已設定，可讀取限制級看板
```

> ⚠️ 這不是真正的帳號登入。密碼不會被送至任何伺服器。  
> 真正的 PTT 帳號登入需要使用 Python PyPtt（透過 WebSocket 連至 `wss://ws.ptt.cc/bbs/`）。

### logout()

清除 cookie 與使用者身份。

```javascript
ptt.logout();
```

### getPostList(board, options)

取得看板文章列表。

```javascript
var result = ptt.getPostList('Baseball', { page: 100, limit: 10 });
// result.posts - 文章列表
// result.prevPage - 上一頁頁碼
// result.board - 看板名稱
```

**回傳的 post 物件:**
```javascript
{
  board: 'Baseball',
  aid: 'M.1704067200.A.ABC',
  title: '[問卦] 標題',
  author: 'userId',
  date: '1/01',
  push_number: 10,
  post_status: 'EXISTS',
  url: 'https://www.ptt.cc/bbs/Baseball/M.1704067200.A.ABC.html'
}
```

### getPost(board, aid)

取得單篇文章完整內容。

```javascript
var post = ptt.getPost('Baseball', 'M.1704067200.A.ABC');
```

**回傳物件:**
```javascript
{
  board: 'Baseball',
  aid: 'M.1704067200.A.ABC',
  author: 'userId',
  title: '[問卦] 標題',
  date: 'Mon Jan  1 12:00:00 2024',
  content: '文章內容...',
  ip: '1.2.3.4',
  url: 'https://www.ptt.cc/bbs/Baseball/M.1704067200.A.ABC.html',
  comments: [
    { type: 'PUSH', author: 'user1', content: '推文內容', ip: '1.1.1.1', time: '01/01 12:05' },
    { type: 'BOO', author: 'user2', content: '噓文內容', ip: '', time: '01/01 12:10' },
    { type: 'ARROW', author: 'user3', content: '箭頭推文', ip: '', time: '01/01 12:15' }
  ],
  push_number: 0,
  post_status: 'EXISTS',
  money: 0,
  has_control_code: false,
  pass_format_check: true
}
```

### searchPosts(board, options)

搜尋看板文章。

```javascript
// 關鍵字搜尋
var result = ptt.searchPosts('Baseball', { keyword: '中華' });

// 作者搜尋
var result = ptt.searchPosts('Baseball', { author: 'userId' });
```

### getNewestIndex(board)

取得看板最新頁碼。

```javascript
var pageNum = ptt.getNewestIndex('Baseball'); // e.g., 5678
```

### getPostByUrl(url)

透過 PTT 網址取得文章。

```javascript
var post = ptt.getPostByUrl('https://www.ptt.cc/bbs/Baseball/M.1704067200.A.ABC.html');
```

### getAidFromUrl(url)

從 PTT 網址取得看板名稱和文章 AID。

```javascript
var info = ptt.getAidFromUrl('https://www.ptt.cc/bbs/Baseball/M.1704067200.A.ABC.html');
// info.board === 'Baseball'
// info.aid === 'M.1704067200.A.ABC'
```

### boardExists(board)

檢查看板是否存在。

```javascript
var exists = ptt.boardExists('Baseball'); // true
```

## 資料型別

### PostStatus

```javascript
PostStatus.EXISTS              // 文章存在
PostStatus.DELETED_BY_AUTHOR   // 作者刪除
PostStatus.DELETED_BY_MODERATOR // 版主刪除
PostStatus.DELETED_BY_UNKNOWN  // 不明原因刪除
```

### CommentType

```javascript
CommentType.PUSH   // 推 (推文)
CommentType.BOO    // 噓 (噓文)
CommentType.ARROW  // → (箭頭)
```

## 與 Python 版本的完整對比

| 項目 | Python PyPtt | GAS PyPttGAS | 原因 |
|------|-------------|--------------|------|
| 連線協定 | WebSocket (`wss://ws.ptt.cc/bbs/`) | HTTP (`https://www.ptt.cc`) | GAS 只支援 HTTP |
| 連線對象 | BBS 終端機 | 網頁前端 (HTML) | 兩個完全不同的系統 |
| 帳號登入 | ✅ 真實登入 | ❌ 不支援 | 網頁沒有登入 API |
| 密碼驗證 | ✅ BBS 會驗證密碼 | ❌ 密碼不送出 | 無處可送 |
| 發文 | ✅ | ❌ | 需要 BBS 終端 |
| 推文 | ✅ | ❌ | 需要 BBS 終端 |
| 寄信 | ✅ | ❌ | 需要 BBS 終端 |
| 讀取文章 | ✅ | ✅ | 網頁可讀 |
| 讀取推文 | ✅ | ✅ | 網頁可讀 |
| 搜尋文章 | ✅ | ✅ | 網頁可搜 |
| 18+ 看板 | ✅ (帳號驗證) | ✅ (cookie) | 網頁用 cookie 確認 |
| 使用者資訊 | ✅ 完整 | ⚠️ 有限 | 網頁資料較少 |
| 即時訊息 | ✅ | ❌ | 需要 BBS 終端 |

### 技術細節

**Python PyPtt 登入流程：**
1. 建立 WebSocket 連線至 `wss://ws.ptt.cc/bbs/`
2. 接收 BBS 歡迎畫面（VT100 終端編碼）
3. 輸入帳號 + Enter
4. 輸入密碼 + Enter
5. 解析終端畫面，確認是否看到「主功能表」
6. 登入完成，可進行所有操作

**GAS PyPttGAS 流程：**
1. 直接用 HTTP GET 讀取 `https://www.ptt.cc/bbs/Board/index.html`
2. 解析 HTML 取得文章列表/內容
3. 如遇到 18+ 確認頁，自動送 `POST /ask/over18` 取得 cookie
4. 不需要帳號登入即可讀取所有公開內容

## 測試

### 在 Google Apps Script 中測試

1. 設定好 Script Properties (PTT_ACCOUNT, PTT_PASSWORD)（可選）
2. 在 `Tests.js` 中選擇要執行的測試函式
3. 點擊 ▶️ 執行

**推薦測試順序：**
- `testGetPostListPublic` - 不需要設定，直接可跑
- `testFetchAllCommentsFromFixedUrl` - 爬取指定文章留言
- `testLogin` - 需要 Script Properties

### 在 Node.js 中測試 (解析邏輯)

```bash
node gas/tests/test_parsing.js
```

## 注意事項

1. **這是唯讀爬蟲**: 只支援讀取操作。發文、推文、寄信需要使用 Python PyPtt (WebSocket)。
2. **不需要真正登入**: 公開看板直接讀取即可，18+ 看板只需 over-18 cookie。
3. **GAS 執行時間限制**: Google Apps Script 有 6 分鐘的執行時間限制。
4. **頻率限制**: PTT 可能對頻繁的請求進行限制，建議在請求之間加入適當的延遲。
5. **密碼安全**: `login()` 不會將密碼送至任何伺服器，但建議仍然用 Script Properties 儲存而非寫在程式碼中。

## 授權 License

MIT License
