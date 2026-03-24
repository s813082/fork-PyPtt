# PyPttGAS - PTT Web Client for Google Apps Script

PyPtt 的 JavaScript 版本，專為 Google Apps Script (GAS) 設計。透過 PTT 的 Web 介面 (www.ptt.cc) 進行 HTTP 請求，不需要 WebSocket 或 Telnet 連線。

A JavaScript port of [PyPtt](https://github.com/PttCodingMan/PyPtt) designed for Google Apps Script. Uses PTT's web interface via HTTP requests.

## 功能 Features

| 功能 | 方法 | 說明 |
|------|------|------|
| 登入 | `login(id, pw)` | 透過 PTT Web 登入 |
| 登出 | `logout()` | 清除 Session |
| 取得文章列表 | `getPostList(board, options)` | 取得看板文章列表 |
| 取得文章 | `getPost(board, aid)` | 取得單篇文章內容 |
| 透過 URL 取得文章 | `getPostByUrl(url)` | 用 PTT 網址取得文章 |
| 搜尋文章 | `searchPosts(board, options)` | 搜尋文章 (關鍵字/作者) |
| 取得最新頁碼 | `getNewestIndex(board)` | 取得看板最新頁碼 |
| 檢查看板是否存在 | `boardExists(board)` | 檢查看板是否存在 |
| URL 解析 | `getAidFromUrl(url)` | 從 URL 取得看板名稱和文章 AID |
| 取得使用者 | `getUser(userId)` | 取得使用者基本資訊 |

## 快速開始 Quick Start

### 1. 設定 Google Apps Script 專案

1. 前往 [Google Apps Script](https://script.google.com/) 建立新專案
2. 將 `PyPttGAS.js` 的內容複製到專案中的一個新檔案
3. 將 `Tests.js` 的內容複製到另一個新檔案（可選）

### 2. 設定帳號密碼 (Script Properties)

1. 在 Apps Script 編輯器中，點擊 ⚙️ **專案設定** (Project Settings)
2. 捲動到 **指令碼屬性** (Script Properties)
3. 新增以下屬性：
   - `PTT_ACCOUNT` → 你的 PTT 帳號
   - `PTT_PASSWORD` → 你的 PTT 密碼

### 3. 使用範例

```javascript
// 不需登入 - 讀取公開看板
function readBaseball() {
  var ptt = new PyPtt();
  var result = ptt.getPostList('Baseball');

  for (var i = 0; i < result.posts.length; i++) {
    Logger.log(result.posts[i].title);
  }
}

// 需要登入 - 讀取限制看板
function readGossiping() {
  var creds = getPttCredentials();
  var ptt = new PyPtt();
  ptt.login(creds.account, creds.password);

  var result = ptt.getPostList('Gossiping');
  Logger.log('文章數: ' + result.posts.length);

  ptt.logout();
}

// 取得單篇文章
function readSinglePost() {
  var ptt = new PyPtt();
  var post = ptt.getPost('Baseball', 'M.1704067200.A.ABC');

  Logger.log('標題: ' + post.title);
  Logger.log('作者: ' + post.author);
  Logger.log('內容: ' + post.content);
  Logger.log('推文數: ' + post.comments.length);
}

// 搜尋文章
function searchPosts() {
  var ptt = new PyPtt();
  var result = ptt.searchPosts('Baseball', { keyword: '中華' });
  Logger.log('搜尋結果: ' + result.posts.length + ' 篇');
}

// 從 URL 取得文章
function readFromUrl() {
  var ptt = new PyPtt();
  var post = ptt.getPostByUrl('https://www.ptt.cc/bbs/Baseball/M.1704067200.A.ABC.html');
  Logger.log(post.title);
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

透過 PTT Web 介面登入。

```javascript
ptt.login('myId', 'myPw');
Logger.log(ptt.getLoginMode()); // 'REAL' 或 'FALLBACK'
Logger.log(ptt.isRealSessionLogin()); // true 表示有真實 Web Session
```

> 注意：若 PTT Web 的 `/login` 端點不可用（例如回傳 404），會進入 `FALLBACK` 模式。  
> `FALLBACK` 僅適用讀取功能，不代表已建立可用於寫入操作的真實登入 Session。

### logout()

登出並清除 Session。

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

## 與 Python 版本的差異

| 項目 | Python 版 (PyPtt) | JavaScript 版 (PyPttGAS) |
|------|-------------------|--------------------------|
| 連線方式 | WebSocket / Telnet | HTTP (PTT Web) |
| 執行環境 | Python 3.11+ | Google Apps Script / Node.js |
| 發文/推文 | ✅ 支援 | ❌ 不支援 (Web 介面限制) |
| 寄信 | ✅ 支援 | ❌ 不支援 |
| 讀取文章 | ✅ 支援 | ✅ 支援 |
| 搜尋文章 | ✅ 支援 | ✅ 支援 |
| 使用者資訊 | ✅ 完整 | ⚠️ 有限 |
| 看板資訊 | ✅ 完整 | ⚠️ 有限 |
| 即時訊息 | ✅ 支援 | ❌ 不支援 |

## 測試

### 在 Google Apps Script 中測試

1. 設定好 Script Properties (PTT_ACCOUNT, PTT_PASSWORD)
2. 在 `Tests.js` 中選擇要執行的測試函式
3. 點擊 ▶️ 執行

### 在 Node.js 中測試 (解析邏輯)

```bash
node gas/tests/test_parsing.js
```

## 注意事項

1. **PTT Web 介面限制**: 只支援讀取操作 (取得文章列表、讀取文章)。發文、推文、寄信等寫入操作需要 BBS 終端協定，無法透過 Web 介面完成。
2. **18+ 看板**: 需要登入並自動確認年齡驗證 (如 Gossiping 板)。
3. **GAS 執行時間限制**: Google Apps Script 有 6 分鐘的執行時間限制，請注意大量請求時的時間管理。
4. **頻率限制**: PTT 可能對頻繁的請求進行限制，建議在請求之間加入適當的延遲。

## 授權 License

MIT License
