/**
 * PyPttGAS - PTT Web Scraper for Google Apps Script
 *
 * A read-only JavaScript client for PTT (www.ptt.cc) designed for
 * Google Apps Script. Scrapes PTT's public web pages via HTTP.
 *
 * NOTE: The original Python PyPtt uses WebSocket (wss://ws.ptt.cc/bbs/)
 * to connect to the PTT BBS terminal and perform full login with
 * VT100 terminal emulation. Google Apps Script only supports HTTP
 * (UrlFetchApp), so this library can only access PTT's read-only
 * web interface (www.ptt.cc). Account login is NOT possible via HTTP.
 *
 * Usage in Google Apps Script:
 *   const ptt = new PyPtt();
 *   const posts = ptt.getPostList('Gossiping');
 *   const post = ptt.getPost('Gossiping', 'M.1234567890.A.ABC');
 *
 * @version 1.1.0
 * @license MIT
 */

// ============================================================
// Data Types (matching Python PyPtt data_type.py)
// ============================================================

var PostStatus = {
  EXISTS: 'EXISTS',
  DELETED_BY_AUTHOR: 'DELETED_BY_AUTHOR',
  DELETED_BY_MODERATOR: 'DELETED_BY_MODERATOR',
  DELETED_BY_UNKNOWN: 'DELETED_BY_UNKNOWN',
};

var CommentType = {
  PUSH: 'PUSH',
  BOO: 'BOO',
  ARROW: 'ARROW',
};

var SearchType = {
  NOPE: 'NOPE',
  KEYWORD: 'KEYWORD',
  AUTHOR: 'AUTHOR',
};

var HOST = {
  PTT1: 'PTT1',
  PTT2: 'PTT2',
};

// ============================================================
// Exceptions (matching Python PyPtt exceptions.py)
// ============================================================

var PttException = {
  LoginError: 'LoginError',
  NotLoggedIn: 'NotLoggedIn',
  NoSuchBoard: 'NoSuchBoard',
  NoSuchPost: 'NoSuchPost',
  NoSuchUser: 'NoSuchUser',
  ConnectionError: 'ConnectionError',
  Over18Required: 'Over18Required',
  InvalidArgument: 'InvalidArgument',
  ParseError: 'ParseError',
};

function PttError(type, message) {
  var error = new Error(message || type);
  error.name = 'PttError';
  error.type = type;
  return error;
}

// ============================================================
// PyPtt Main Class
// ============================================================

/**
 * PyPtt - PTT Web Client for Google Apps Script
 *
 * @param {Object} [options] - Configuration options
 * @param {string} [options.host='PTT1'] - PTT host ('PTT1' or 'PTT2')
 * @param {string} [options.logLevel='INFO'] - Log level ('DEBUG', 'INFO', 'WARN', 'ERROR')
 */
function PyPtt(options) {
  options = options || {};
  this.host = options.host || HOST.PTT1;
  this.logLevel = options.logLevel || 'INFO';

  this._baseUrl = this.host === HOST.PTT2
    ? 'https://www.ptt2.cc'
    : 'https://www.ptt.cc';

  this._cookies = {};
  this._isLoggedIn = false;
  this._pttId = '';
  this._over18Confirmed = false;
}

// ============================================================
// Internal HTTP Methods
// ============================================================

/**
 * Make an HTTP request with cookie management.
 * Uses UrlFetchApp in GAS or a provided fetch function for testing.
 *
 * @param {string} url - Target URL
 * @param {Object} [options] - Request options
 * @returns {Object} Response object with getContentText(), getResponseCode(), getHeaders()
 * @private
 */
PyPtt.prototype._fetch = function (url, options) {
  options = options || {};

  var headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  var cookieStr = this._getCookieString();
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }

  if (options.headers) {
    var keys = Object.keys(options.headers);
    for (var i = 0; i < keys.length; i++) {
      headers[keys[i]] = options.headers[keys[i]];
    }
  }

  var fetchOptions = {
    method: options.method || 'get',
    headers: headers,
    followRedirects: false,
    muteHttpExceptions: true,
    validateHttpsCertificates: true,
  };

  if (options.payload) {
    fetchOptions.payload = options.payload;
    fetchOptions.contentType = 'application/x-www-form-urlencoded';
  }

  this._log('DEBUG', 'Fetch: ' + fetchOptions.method.toUpperCase() + ' ' + url);

  var response;
  if (typeof UrlFetchApp !== 'undefined') {
    response = UrlFetchApp.fetch(url, fetchOptions);
  } else if (this._testFetch) {
    response = this._testFetch(url, fetchOptions);
  } else {
    throw PttError(PttException.ConnectionError, 'No HTTP client available (UrlFetchApp or _testFetch)');
  }

  var respHeaders = response.getHeaders ? response.getHeaders() : {};
  var setCookie = respHeaders['Set-Cookie'] || respHeaders['set-cookie'];
  if (setCookie) {
    this._parseCookies(setCookie);
  }

  return response;
};

/**
 * Build cookie string from stored cookies.
 * @returns {string}
 * @private
 */
PyPtt.prototype._getCookieString = function () {
  var parts = [];
  var keys = Object.keys(this._cookies);
  for (var i = 0; i < keys.length; i++) {
    parts.push(keys[i] + '=' + this._cookies[keys[i]]);
  }
  return parts.join('; ');
};

/**
 * Parse Set-Cookie header and update stored cookies.
 * @param {string|string[]} setCookie
 * @private
 */
PyPtt.prototype._parseCookies = function (setCookie) {
  var cookieStrings = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (var i = 0; i < cookieStrings.length; i++) {
    var parts = cookieStrings[i].split(';');
    if (parts.length > 0) {
      var kv = parts[0].trim().split('=');
      if (kv.length >= 2) {
        this._cookies[kv[0].trim()] = kv.slice(1).join('=').trim();
      }
    }
  }
};

/**
 * Log a message.
 * @param {string} level
 * @param {string} message
 * @private
 */
PyPtt.prototype._log = function (level, message) {
  var levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  if ((levels[level] || 0) >= (levels[this.logLevel] || 0)) {
    var msg = '[PyPttGAS][' + level + '] ' + message;
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(msg);
    } else if (typeof console !== 'undefined') {
      console.log(msg);
    }
  }
};

// ============================================================
// Authentication
// ============================================================

/**
 * Set up the PTT client with user identity and confirm over-18 access.
 *
 * IMPORTANT: This does NOT perform real account authentication.
 * The original Python PyPtt connects via WebSocket (wss://ws.ptt.cc/bbs/)
 * and authenticates through VT100 terminal emulation with the PTT BBS.
 * Google Apps Script only supports HTTP (UrlFetchApp) and can only access
 * PTT's read-only web pages (www.ptt.cc), which have no login endpoint.
 *
 * What this method does:
 *   1. Records the user identity for logging/tracking purposes
 *   2. Sends the over-18 confirmation cookie (POST /ask/over18) so that
 *      age-restricted boards (e.g., Gossiping, sex) become readable
 *
 * All PTT web read operations work without account login.
 * Write operations (post/push/mail) are NOT possible via HTTP.
 *
 * @param {string} pttId - PTT account ID (used for identity tracking only)
 * @param {string} pttPw - PTT account password (NOT sent anywhere; kept for API compatibility)
 */
PyPtt.prototype.login = function (pttId, pttPw) {
  if (!pttId || !pttPw) {
    throw PttError(PttException.InvalidArgument, 'pttId and pttPw are required');
  }

  this._log('INFO', 'Setting up PTT client for: ' + pttId);
  this._log('INFO', 'Note: PTT web (www.ptt.cc) is read-only. Account login requires WebSocket (Python PyPtt).');

  this._pttId = pttId;
  this._isLoggedIn = true;

  // Confirm over-18 so age-restricted boards are accessible
  this._confirmOver18();

  this._log('INFO', 'Client ready. Over-18 confirmed. Read-only access to all boards.');
};

/**
 * Reset client state (clear cookies and user identity).
 */
PyPtt.prototype.logout = function () {
  this._cookies = {};
  this._isLoggedIn = false;
  this._pttId = '';
  this._over18Confirmed = false;
  this._log('INFO', 'Client reset (logged out)');
};

/**
 * Check if the client has been set up via login().
 * Note: This indicates the client is ready for read operations,
 * NOT that a real BBS account session exists.
 * @returns {boolean}
 */
PyPtt.prototype.isLoggedIn = function () {
  return this._isLoggedIn;
};

/**
 * Get the current logged in PTT ID.
 * @returns {string}
 */
PyPtt.prototype.getPttId = function () {
  return this._pttId;
};

// ============================================================
// Over 18 Confirmation
// ============================================================

/**
 * Confirm over-18 access for restricted boards (e.g., Gossiping).
 * This is called automatically when needed.
 *
 * @private
 */
PyPtt.prototype._confirmOver18 = function () {
  if (this._over18Confirmed) {
    return;
  }
  var url = this._baseUrl + '/ask/over18';
  var payload = 'yes=yes';
  this._fetch(url, {
    method: 'post',
    payload: payload,
  });
  this._over18Confirmed = true;
  this._log('DEBUG', 'Over 18 confirmed');
};

/**
 * Fetch a URL and handle the over-18 redirect automatically.
 *
 * @param {string} url
 * @param {Object} [options]
 * @returns {Object} response
 * @private
 */
PyPtt.prototype._fetchWithOver18 = function (url, options) {
  var response = this._fetch(url, options);
  var body = response.getContentText();

  if (body.indexOf('over18-notice') >= 0 || body.indexOf('您已滿十八歲') >= 0 || body.indexOf('/ask/over18') >= 0) {
    this._confirmOver18();
    response = this._fetch(url, options);
  }
  return response;
};

// ============================================================
// Board Operations
// ============================================================

/**
 * Get post list from a board.
 *
 * @param {string} board - Board name (e.g., 'Gossiping', 'Stock')
 * @param {Object} [options] - Options
 * @param {number} [options.page] - Page index (omit for latest)
 * @param {number} [options.limit=20] - Maximum posts to return
 * @returns {Object} { posts: Array, prevPage: number|null, board: string }
 */
PyPtt.prototype.getPostList = function (board, options) {
  if (!board) {
    throw PttError(PttException.InvalidArgument, 'board is required');
  }
  options = options || {};

  var suffix = options.page != null ? 'index' + options.page : 'index';
  var url = this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/' + suffix + '.html';

  var response = this._fetchWithOver18(url);
  var code = response.getResponseCode();
  var html = response.getContentText();

  if (code === 404) {
    throw PttError(PttException.NoSuchBoard, 'Board not found: ' + board);
  }

  if (html.indexOf('看板《' + board + '》目前沒有文章') >= 0) {
    return { posts: [], prevPage: null, board: board };
  }

  return this._parsePostList(html, board, options.limit || 20);
};

/**
 * Get the newest post index (page number) for a board.
 *
 * @param {string} board - Board name
 * @returns {number} Latest page index
 */
PyPtt.prototype.getNewestIndex = function (board) {
  if (!board) {
    throw PttError(PttException.InvalidArgument, 'board is required');
  }

  var url = this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/index.html';
  var response = this._fetchWithOver18(url);
  var html = response.getContentText();

  var match = html.match(/\/bbs\/[^/]+\/index(\d+)\.html/);
  if (match) {
    return parseInt(match[1], 10) + 1;
  }
  return 1;
};

// ============================================================
// Post Operations
// ============================================================

/**
 * Get a single post by its AID (article ID).
 *
 * @param {string} board - Board name
 * @param {string} aid - Article ID (e.g., 'M.1234567890.A.ABC')
 * @returns {Object} Post object with fields matching Python PostField
 */
PyPtt.prototype.getPost = function (board, aid) {
  if (!board || !aid) {
    throw PttError(PttException.InvalidArgument, 'board and aid are required');
  }

  var url = this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/' + aid + '.html';

  var response = this._fetchWithOver18(url);
  var code = response.getResponseCode();
  var html = response.getContentText();

  if (code === 404) {
    throw PttError(PttException.NoSuchPost, 'Post not found: ' + board + '/' + aid);
  }

  return this._parsePost(html, board, aid);
};

/**
 * Get a post by its full URL.
 *
 * @param {string} url - Full PTT web URL (e.g., 'https://www.ptt.cc/bbs/Gossiping/M.1234567890.A.ABC.html')
 * @returns {Object} Post object
 */
PyPtt.prototype.getPostByUrl = function (url) {
  var match = url.match(/\/bbs\/([^/]+)\/(M\.\d+\.A\.[A-Z0-9]+)\.html/);
  if (!match) {
    throw PttError(PttException.InvalidArgument, 'Invalid PTT URL: ' + url);
  }
  return this.getPost(match[1], match[2]);
};

/**
 * Extract AID from a PTT URL.
 *
 * @param {string} url - PTT web URL
 * @returns {Object} { board: string, aid: string }
 */
PyPtt.prototype.getAidFromUrl = function (url) {
  var match = url.match(/\/bbs\/([^/]+)\/(M\.\d+\.A\.[A-Z0-9]+)\.html/);
  if (!match) {
    throw PttError(PttException.InvalidArgument, 'Invalid PTT URL: ' + url);
  }
  return { board: match[1], aid: match[2] };
};

// ============================================================
// User Operations
// ============================================================

/**
 * Get user profile information.
 * Note: Limited info available via web interface.
 *
 * @param {string} userId - PTT user ID
 * @returns {Object} User info
 */
PyPtt.prototype.getUser = function (userId) {
  if (!userId) {
    throw PttError(PttException.InvalidArgument, 'userId is required');
  }

  var url = this._baseUrl + '/bbs/ALLPOST/search?q=author%3A' + encodeURIComponent(userId);
  var response = this._fetchWithOver18(url);
  var code = response.getResponseCode();
  var html = response.getContentText();

  if (code === 404) {
    throw PttError(PttException.NoSuchUser, 'User not found: ' + userId);
  }

  return {
    ptt_id: userId,
    url: url,
    has_posts: html.indexOf('r-ent') >= 0,
  };
};

// ============================================================
// Search Operations
// ============================================================

/**
 * Search posts in a board.
 *
 * @param {string} board - Board name
 * @param {Object} options - Search options
 * @param {string} [options.keyword] - Search keyword in title
 * @param {string} [options.author] - Search by author
 * @param {number} [options.page] - Page number
 * @returns {Object} { posts: Array, board: string }
 */
PyPtt.prototype.searchPosts = function (board, options) {
  if (!board) {
    throw PttError(PttException.InvalidArgument, 'board is required');
  }
  options = options || {};

  var queryParts = [];
  if (options.keyword) {
    queryParts.push(encodeURIComponent(options.keyword));
  }
  if (options.author) {
    queryParts.push('author%3A' + encodeURIComponent(options.author));
  }

  if (queryParts.length === 0) {
    throw PttError(PttException.InvalidArgument, 'At least keyword or author is required');
  }

  var url = this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/search?q=' + queryParts.join('+');
  if (options.page != null) {
    url += '&page=' + options.page;
  }

  var response = this._fetchWithOver18(url);
  var html = response.getContentText();
  return this._parsePostList(html, board, 40);
};

// ============================================================
// HTML Parsing
// ============================================================

/**
 * Parse a board index HTML page into a post list.
 *
 * @param {string} html
 * @param {string} board
 * @param {number} limit
 * @returns {Object} { posts: Array, prevPage: number|null, board: string }
 * @private
 */
PyPtt.prototype._parsePostList = function (html, board, limit) {
  var posts = [];

  var prevPageMatch = html.match(/\/bbs\/[^/]+\/index(\d+)\.html"[^>]*>‹\s*上頁/);
  var prevPage = prevPageMatch ? parseInt(prevPageMatch[1], 10) : null;

  // Split by r-ent divs and process each segment
  var segments = html.split('<div class="r-ent">');
  var count = 0;

  for (var i = 1; i < segments.length && count < limit; i++) {
    var endIdx = segments[i].lastIndexOf('</div>');
    var entryHtml = endIdx >= 0 ? segments[i].substring(0, endIdx) : segments[i];
    var post = this._parsePostListEntry(entryHtml, board);
    if (post) {
      posts.push(post);
      count++;
    }
  }

  return {
    posts: posts,
    prevPage: prevPage,
    board: board,
  };
};

/**
 * Parse a single post entry from board index.
 *
 * @param {string} html - HTML of the r-ent div
 * @param {string} board
 * @returns {Object|null}
 * @private
 */
PyPtt.prototype._parsePostListEntry = function (html, board) {
  var titleMatch = html.match(/<a href="\/bbs\/[^/]+\/(M\.\d+\.A\.[A-Z0-9]+)\.html"[^>]*>([\s\S]*?)<\/a>/);
  if (!titleMatch) {
    var deletedMatch = html.match(/<div class="title">\s*([\s\S]*?)\s*<\/div>/);
    if (deletedMatch) {
      var titleText = this._stripHtmlTags(deletedMatch[1]).trim();
      if (titleText.indexOf('(本文已被刪除)') >= 0) {
        return {
          board: board,
          aid: null,
          title: titleText,
          author: '',
          date: '',
          push_number: 0,
          post_status: PostStatus.DELETED_BY_UNKNOWN,
          url: null,
        };
      }
    }
    return null;
  }

  var aid = titleMatch[1];
  var title = this._stripHtmlTags(titleMatch[2]).trim();

  var authorMatch = html.match(/<div class="author">([^<]*)<\/div>/);
  var author = authorMatch ? authorMatch[1].trim() : '';

  var dateMatch = html.match(/<div class="date">\s*([^<]*)\s*<\/div>/);
  var date = dateMatch ? dateMatch[1].trim() : '';

  var pushMatch = html.match(/<span class="[^"]*">([\s\S]*?)<\/span>\s*<\/div>\s*<div class="title">/);
  var pushStr = '';
  if (!pushMatch) {
    pushMatch = html.match(/<div class="nrec">([\s\S]*?)<\/div>/);
  }
  if (pushMatch) {
    pushStr = this._stripHtmlTags(pushMatch[1]).trim();
  }

  var pushNumber = 0;
  if (pushStr === '爆') {
    pushNumber = 100;
  } else if (pushStr.indexOf('X') === 0) {
    pushNumber = -1 * (parseInt(pushStr.substring(1), 10) || 1);
  } else if (pushStr) {
    pushNumber = parseInt(pushStr, 10) || 0;
  }

  return {
    board: board,
    aid: aid,
    title: title,
    author: author,
    date: date,
    push_number: pushNumber,
    post_status: PostStatus.EXISTS,
    url: this._baseUrl + '/bbs/' + board + '/' + aid + '.html',
  };
};

/**
 * Parse a full post HTML page.
 *
 * @param {string} html
 * @param {string} board
 * @param {string} aid
 * @returns {Object} Post object
 * @private
 */
PyPtt.prototype._parsePost = function (html, board, aid) {
  var result = {
    board: board,
    aid: aid,
    author: '',
    title: '',
    date: '',
    content: '',
    money: 0,
    ip: '',
    url: this._baseUrl + '/bbs/' + board + '/' + aid + '.html',
    comments: [],
    post_status: PostStatus.EXISTS,
    push_number: 0,
    has_control_code: false,
    pass_format_check: true,
  };

  if (html.indexOf('404 - Not Found') >= 0 || html.indexOf('找不到這個頁面') >= 0) {
    result.post_status = PostStatus.DELETED_BY_UNKNOWN;
    result.pass_format_check = false;
    return result;
  }

  // Parse metalines
  var authorMatch = html.match(/<span class="article-meta-tag">作者<\/span>\s*<span class="article-meta-value">([^<]*)<\/span>/);
  if (authorMatch) {
    result.author = authorMatch[1].trim();
    var pureAuthor = result.author.match(/^(\S+)/);
    if (pureAuthor) {
      result.author = pureAuthor[1];
    }
  }

  var titleMatch = html.match(/<span class="article-meta-tag">標題<\/span>\s*<span class="article-meta-value">([^<]*)<\/span>/);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  var dateMatch = html.match(/<span class="article-meta-tag">時間<\/span>\s*<span class="article-meta-value">([^<]*)<\/span>/);
  if (dateMatch) {
    result.date = dateMatch[1].trim();
  }

  // Parse content - use greedy match to capture full main-content div
  var mainContent = html.match(/<div id="main-content"[^>]*>([\s\S]*)<\/div>\s*<\/body>/);
  if (!mainContent) {
    mainContent = html.match(/<div id="main-content"[^>]*>([\s\S]+)/);
  }
  if (mainContent) {
    var contentHtml = mainContent[1];

    // Remove metaline divs
    contentHtml = contentHtml.replace(/<div class="article-metaline[^"]*">[\s\S]*?<\/div>/g, '');

    // Remove push divs to get pure content
    contentHtml = contentHtml.replace(/<div class="push">[\s\S]*?<\/div>/g, '');

    // Remove remaining HTML tags but keep line structure
    contentHtml = contentHtml.replace(/<br\s*\/?>/gi, '\n');
    contentHtml = this._stripHtmlTags(contentHtml);

    // Decode HTML entities
    contentHtml = this._decodeHtmlEntities(contentHtml);

    // Extract content before the signature line
    var sigIndex = contentHtml.indexOf('※ 發信站:');
    if (sigIndex >= 0) {
      var contentPart = contentHtml.substring(0, sigIndex);
      contentPart = contentPart.replace(/--\s*$/, '').trim();
      result.content = contentPart;

      // Extract IP from signature
      var sigArea = contentHtml.substring(sigIndex);
      var ipMatch = sigArea.match(/來自:\s*([\d.]+)/);
      if (!ipMatch) {
        ipMatch = sigArea.match(/([\d]+\.[\d]+\.[\d]+\.[\d]+)/);
      }
      if (ipMatch) {
        result.ip = ipMatch[1];
      }
    } else {
      result.content = contentHtml.trim();
    }
  }

  // Parse comments (pushes)
  result.comments = this._parseComments(html);

  // Calculate push number
  var pushCount = 0;
  var booCount = 0;
  for (var i = 0; i < result.comments.length; i++) {
    if (result.comments[i].type === CommentType.PUSH) {
      pushCount++;
    } else if (result.comments[i].type === CommentType.BOO) {
      booCount++;
    }
  }
  result.push_number = pushCount - booCount;

  return result;
};

/**
 * Parse comments (push/boo/arrow) from post HTML.
 *
 * @param {string} html
 * @returns {Array} Comments array
 * @private
 */
PyPtt.prototype._parseComments = function (html) {
  var comments = [];
  var pushPattern = /<div class="push">([\s\S]*?)<\/div>/g;
  var pushMatch;

  while ((pushMatch = pushPattern.exec(html)) !== null) {
    var pushHtml = pushMatch[1];

    var tagMatch = pushHtml.match(/<span class="[^"]*push-tag[^"]*">([^<]*)<\/span>/);
    var userMatch = pushHtml.match(/<span class="[^"]*push-userid[^"]*">([^<]*)<\/span>/);
    var contentMatch = pushHtml.match(/<span class="[^"]*push-content[^"]*">([\s\S]*?)<\/span>/);
    var ipDateMatch = pushHtml.match(/<span class="[^"]*push-ipdatetime[^"]*">([^<]*)<\/span>/);

    var tag = tagMatch ? tagMatch[1].trim() : '';
    var type = CommentType.ARROW;
    if (tag.indexOf('推') >= 0) {
      type = CommentType.PUSH;
    } else if (tag.indexOf('噓') >= 0) {
      type = CommentType.BOO;
    }

    var commentContent = contentMatch ? contentMatch[1].trim() : '';
    if (commentContent.indexOf(':') === 0) {
      commentContent = commentContent.substring(1).trim();
    }

    var ipDateStr = ipDateMatch ? ipDateMatch[1].trim() : '';
    var commentIp = '';
    var commentTime = '';

    var ipTimeMatch = ipDateStr.match(/([\d.]+)\s+([\d/]+ [\d:]+)/);
    if (ipTimeMatch) {
      commentIp = ipTimeMatch[1];
      commentTime = ipTimeMatch[2];
    } else {
      var timeOnlyMatch = ipDateStr.match(/([\d/]+ [\d:]+)/);
      if (timeOnlyMatch) {
        commentTime = timeOnlyMatch[1];
      }
    }

    comments.push({
      type: type,
      author: userMatch ? userMatch[1].trim() : '',
      content: this._decodeHtmlEntities(commentContent),
      ip: commentIp,
      time: commentTime,
    });
  }

  return comments;
};

/**
 * Strip all HTML tags from a string.
 * Uses a loop to handle nested or reconstructed tags (e.g., <<script>ipt>).
 * Note: This is used for text extraction from trusted PTT server responses,
 * not for sanitizing user input for HTML rendering.
 *
 * @param {string} str
 * @returns {string}
 * @private
 */
PyPtt.prototype._stripHtmlTags = function (str) {
  if (!str) return '';
  var result = str;
  var prev;
  // Loop until no more HTML tags can be found (handles nested/reconstructed tags)
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  // Remove any remaining angle brackets that could form partial tags
  result = result.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return result;
};

/**
 * Decode common HTML entities.
 *
 * @param {string} str
 * @returns {string}
 * @private
 */
PyPtt.prototype._decodeHtmlEntities = function (str) {
  if (!str) return '';
  // Decode &amp; last to prevent double-unescaping (e.g., &amp;lt; → &lt; → <)
  return str
    .replace(/&#(\d+);/g, function (match, code) {
      return String.fromCharCode(parseInt(code, 10));
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
};

// ============================================================
// Utility Methods
// ============================================================

/**
 * Get the PTT web URL for a board.
 *
 * @param {string} board - Board name
 * @returns {string} Board URL
 */
PyPtt.prototype.getBoardUrl = function (board) {
  return this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/index.html';
};

/**
 * Get the PTT web URL for a post.
 *
 * @param {string} board - Board name
 * @param {string} aid - Article ID
 * @returns {string} Post URL
 */
PyPtt.prototype.getPostUrl = function (board, aid) {
  return this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/' + aid + '.html';
};

/**
 * Check if a board exists by trying to access it.
 *
 * @param {string} board - Board name
 * @returns {boolean}
 */
PyPtt.prototype.boardExists = function (board) {
  try {
    var url = this._baseUrl + '/bbs/' + encodeURIComponent(board) + '/index.html';
    var response = this._fetchWithOver18(url);
    return response.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
};

// ============================================================
// Configuration Helper for Google Apps Script
// ============================================================

/**
 * Get PTT credentials from Google Apps Script Script Properties.
 * Properties should have 'PTT_ACCOUNT' and 'PTT_PASSWORD' keys.
 *
 * @returns {Object} { account: string, password: string }
 */
function getPttCredentials() {
  if (typeof PropertiesService === 'undefined') {
    throw new Error('PropertiesService not available. This function is for Google Apps Script only.');
  }
  var props = PropertiesService.getScriptProperties();
  var account = props.getProperty('PTT_ACCOUNT');
  var password = props.getProperty('PTT_PASSWORD');

  if (!account || !password) {
    throw new Error('PTT_ACCOUNT and PTT_PASSWORD must be set in Script Properties');
  }
  return { account: account, password: password };
}

// ============================================================
// Export for Node.js testing (ignored in GAS)
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PyPtt: PyPtt,
    PostStatus: PostStatus,
    CommentType: CommentType,
    SearchType: SearchType,
    HOST: HOST,
    PttException: PttException,
    PttError: PttError,
    getPttCredentials: getPttCredentials,
  };
}
