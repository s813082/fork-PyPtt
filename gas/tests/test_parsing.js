/**
 * Node.js tests for PyPttGAS parsing logic.
 * These tests validate HTML parsing without needing actual PTT connectivity.
 *
 * Run: node gas/tests/test_parsing.js
 */

var lib = require('../PyPttGAS.js');
var PyPtt = lib.PyPtt;
var PostStatus = lib.PostStatus;
var CommentType = lib.CommentType;
var PttException = lib.PttException;

var passCount = 0;
var failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      'Assertion failed: ' + message + '\n  Expected: ' + JSON.stringify(expected) + '\n  Actual:   ' + JSON.stringify(actual)
    );
  }
}

function runTest(name, fn) {
  try {
    fn();
    console.log('  ✅ ' + name);
    passCount++;
  } catch (e) {
    console.log('  ❌ ' + name + ': ' + e.message);
    failCount++;
  }
}

// ============================================================
// Sample HTML Data
// ============================================================

var SAMPLE_POST_HTML = [
  '<html><head><title>Test Post</title></head><body>',
  '<div id="main-content" class="bbs-screen bbs-content">',
  '<div class="article-metaline">',
  '<span class="article-meta-tag">作者</span>',
  '<span class="article-meta-value">testuser (Test User)</span>',
  '</div>',
  '<div class="article-metaline-right">',
  '<span class="article-meta-tag">看板</span>',
  '<span class="article-meta-value">TestBoard</span>',
  '</div>',
  '<div class="article-metaline">',
  '<span class="article-meta-tag">標題</span>',
  '<span class="article-meta-value">[問卦] 這是測試文章</span>',
  '</div>',
  '<div class="article-metaline">',
  '<span class="article-meta-tag">時間</span>',
  '<span class="article-meta-value">Mon Jan  1 12:00:00 2024</span>',
  '</div>',
  '',
  'This is the content of the post.',
  'It has multiple lines.',
  '',
  'Third paragraph here.',
  '',
  '--',
  '※ 發信站: 批踢踢實業坊(ptt.cc), 來自: 1.2.3.4 (台灣)',
  '※ 文章網址: https://www.ptt.cc/bbs/TestBoard/M.1704067200.A.ABC.html',
  '',
  '<div class="push">',
  '<span class="push-tag">推 </span>',
  '<span class="push-userid">user1</span>',
  '<span class="push-content">: Great post!</span>',
  '<span class="push-ipdatetime"> 1.1.1.1 01/01 12:05</span>',
  '</div>',
  '<div class="push">',
  '<span class="push-tag">噓 </span>',
  '<span class="push-userid">user2</span>',
  '<span class="push-content">: Not so great</span>',
  '<span class="push-ipdatetime"> 2.2.2.2 01/01 12:10</span>',
  '</div>',
  '<div class="push">',
  '<span class="push-tag">→ </span>',
  '<span class="push-userid">user3</span>',
  '<span class="push-content">: Neutral comment</span>',
  '<span class="push-ipdatetime"> 01/01 12:15</span>',
  '</div>',
  '</div>',
  '</body></html>',
].join('\n');

var SAMPLE_BOARD_HTML = [
  '<html><body>',
  '<div id="action-bar-container">',
  '<div class="btn-group btn-group-paging">',
  '<a class="btn wide" href="/bbs/TestBoard/index1234.html">‹ 上頁</a>',
  '<a class="btn wide" href="/bbs/TestBoard/index1236.html">下頁 ›</a>',
  '</div>',
  '</div>',
  '<div class="r-list-container action-bar-margin bbs-screen">',
  '<div class="r-ent">',
  '<div class="nrec"><span class="hl f3">10</span></div>',
  '<div class="title">',
  '<a href="/bbs/TestBoard/M.1704067200.A.ABC.html">[問卦] 第一篇文章</a>',
  '</div>',
  '<div class="meta">',
  '<div class="author">author1</div>',
  '<div class="article-menu"></div>',
  '<div class="date"> 1/01</div>',
  '</div>',
  '</div>',
  '<div class="r-ent">',
  '<div class="nrec"><span class="hl f9">爆</span></div>',
  '<div class="title">',
  '<a href="/bbs/TestBoard/M.1704067201.A.DEF.html">Re: [討論] 第二篇文章</a>',
  '</div>',
  '<div class="meta">',
  '<div class="author">author2</div>',
  '<div class="article-menu"></div>',
  '<div class="date"> 1/02</div>',
  '</div>',
  '</div>',
  '<div class="r-ent">',
  '<div class="nrec"><span class="hl f1">X1</span></div>',
  '<div class="title">',
  '<a href="/bbs/TestBoard/M.1704067202.A.GHI.html">[閒聊] 第三篇文章</a>',
  '</div>',
  '<div class="meta">',
  '<div class="author">author3</div>',
  '<div class="article-menu"></div>',
  '<div class="date"> 1/03</div>',
  '</div>',
  '</div>',
  '<div class="r-ent">',
  '<div class="nrec"></div>',
  '<div class="title">',
  '(本文已被刪除) [author4]',
  '</div>',
  '<div class="meta">',
  '<div class="author">-</div>',
  '<div class="article-menu"></div>',
  '<div class="date"> 1/04</div>',
  '</div>',
  '</div>',
  '</div>',
  '</body></html>',
].join('\n');

var SAMPLE_OVER18_HTML = [
  '<html><body>',
  '<div class="over18-notice">',
  '<p>您已滿十八歲了嗎？</p>',
  '<form action="/ask/over18" method="post">',
  '<button type="submit" name="yes" value="yes">是，我已年滿十八歲</button>',
  '</form>',
  '</div>',
  '</body></html>',
].join('\n');

// ============================================================
// Tests
// ============================================================

console.log('\n=== PyPttGAS Parsing Tests ===\n');

console.log('--- Constructor & Configuration ---');

runTest('should create instance with default options', function () {
  var ptt = new PyPtt();
  assertEqual(ptt.host, 'PTT1', 'default host');
  assertEqual(ptt.logLevel, 'INFO', 'default log level');
  assertEqual(ptt._isLoggedIn, false, 'default not logged in');
  assert(ptt._baseUrl === 'https://www.ptt.cc', 'PTT1 base URL');
});

runTest('should create instance for PTT2', function () {
  var ptt = new PyPtt({ host: 'PTT2' });
  assert(ptt._baseUrl === 'https://www.ptt2.cc', 'PTT2 base URL');
});

console.log('\n--- Post Parsing ---');

runTest('should parse post author', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.author, 'testuser', 'author');
});

runTest('should parse post title', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.title, '[問卦] 這是測試文章', 'title');
});

runTest('should parse post date', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.date, 'Mon Jan  1 12:00:00 2024', 'date');
});

runTest('should parse post content', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assert(post.content.indexOf('This is the content of the post.') >= 0, 'content contains text');
  assert(post.content.indexOf('Third paragraph here.') >= 0, 'content contains third paragraph');
});

runTest('should parse post IP', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.ip, '1.2.3.4', 'ip');
});

runTest('should parse post URL', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.url, 'https://www.ptt.cc/bbs/TestBoard/M.1704067200.A.ABC.html', 'url');
});

runTest('should parse post board and AID', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.board, 'TestBoard', 'board');
  assertEqual(post.aid, 'M.1704067200.A.ABC', 'aid');
});

runTest('should parse post status as EXISTS', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.post_status, PostStatus.EXISTS, 'post_status');
});

console.log('\n--- Comment Parsing ---');

runTest('should parse 3 comments', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.comments.length, 3, 'comment count');
});

runTest('should parse push comment', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  var c = post.comments[0];
  assertEqual(c.type, CommentType.PUSH, 'push type');
  assertEqual(c.author, 'user1', 'push author');
  assertEqual(c.content, 'Great post!', 'push content');
  assertEqual(c.ip, '1.1.1.1', 'push ip');
  assertEqual(c.time, '01/01 12:05', 'push time');
});

runTest('should parse boo comment', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  var c = post.comments[1];
  assertEqual(c.type, CommentType.BOO, 'boo type');
  assertEqual(c.author, 'user2', 'boo author');
  assertEqual(c.content, 'Not so great', 'boo content');
});

runTest('should parse arrow comment', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  var c = post.comments[2];
  assertEqual(c.type, CommentType.ARROW, 'arrow type');
  assertEqual(c.author, 'user3', 'arrow author');
  assertEqual(c.content, 'Neutral comment', 'arrow content');
  assertEqual(c.time, '01/01 12:15', 'arrow time');
});

runTest('should calculate push number correctly', function () {
  var ptt = new PyPtt();
  var post = ptt._parsePost(SAMPLE_POST_HTML, 'TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.push_number, 0, 'push_number (1 push - 1 boo = 0)');
});

console.log('\n--- Post List Parsing ---');

runTest('should parse post list entries', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  assertEqual(result.posts.length, 4, 'post count');
  assertEqual(result.board, 'TestBoard', 'board');
});

runTest('should parse previous page number', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  assertEqual(result.prevPage, 1234, 'previous page');
});

runTest('should parse first post entry', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  var p = result.posts[0];
  assertEqual(p.aid, 'M.1704067200.A.ABC', 'first post aid');
  assertEqual(p.title, '[問卦] 第一篇文章', 'first post title');
  assertEqual(p.author, 'author1', 'first post author');
  assertEqual(p.date, '1/01', 'first post date');
  assertEqual(p.push_number, 10, 'first post push_number');
  assertEqual(p.post_status, PostStatus.EXISTS, 'first post status');
});

runTest('should parse explosive (爆) push count as 100', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  assertEqual(result.posts[1].push_number, 100, 'explosive push number');
  assertEqual(result.posts[1].title, 'Re: [討論] 第二篇文章', 'second post title');
});

runTest('should parse negative (X) push count', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  assertEqual(result.posts[2].push_number, -1, 'negative push number');
});

runTest('should parse deleted post', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 20);
  var deleted = result.posts[3];
  assertEqual(deleted.aid, null, 'deleted post has no aid');
  assertEqual(deleted.post_status, PostStatus.DELETED_BY_UNKNOWN, 'deleted post status');
  assert(deleted.title.indexOf('本文已被刪除') >= 0, 'deleted post title');
});

runTest('should respect limit parameter', function () {
  var ptt = new PyPtt();
  var result = ptt._parsePostList(SAMPLE_BOARD_HTML, 'TestBoard', 2);
  assertEqual(result.posts.length, 2, 'limited to 2 posts');
});

console.log('\n--- URL Parsing ---');

runTest('should extract AID from URL', function () {
  var ptt = new PyPtt();
  var info = ptt.getAidFromUrl('https://www.ptt.cc/bbs/Gossiping/M.1704067200.A.ABC.html');
  assertEqual(info.board, 'Gossiping', 'board from URL');
  assertEqual(info.aid, 'M.1704067200.A.ABC', 'aid from URL');
});

runTest('should throw on invalid URL', function () {
  var ptt = new PyPtt();
  var threw = false;
  try {
    ptt.getAidFromUrl('https://example.com/invalid');
  } catch (e) {
    threw = true;
    assertEqual(e.type, PttException.InvalidArgument, 'exception type');
  }
  assert(threw, 'should have thrown');
});

console.log('\n--- Over 18 Detection ---');

runTest('should detect over-18 page', function () {
  var ptt = new PyPtt();
  var fetchCallCount = 0;
  var over18Confirmed = false;

  ptt._testFetch = function (url, options) {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return {
        getResponseCode: function () { return 200; },
        getContentText: function () { return SAMPLE_OVER18_HTML; },
        getHeaders: function () { return {}; },
      };
    }
    if (url.indexOf('/ask/over18') >= 0) {
      over18Confirmed = true;
      return {
        getResponseCode: function () { return 302; },
        getContentText: function () { return ''; },
        getHeaders: function () { return { 'Set-Cookie': 'over18=1; path=/' }; },
      };
    }
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () { return SAMPLE_BOARD_HTML; },
      getHeaders: function () { return {}; },
    };
  };

  var result = ptt._fetchWithOver18('https://www.ptt.cc/bbs/Gossiping/index.html');
  assert(over18Confirmed, 'over18 was confirmed');
  assert(ptt._over18Confirmed, 'over18 flag set');
});

console.log('\n--- HTML Entity Decoding ---');

runTest('should decode HTML entities', function () {
  var ptt = new PyPtt();
  assertEqual(ptt._decodeHtmlEntities('&amp;'), '&', 'ampersand');
  assertEqual(ptt._decodeHtmlEntities('&lt;'), '<', 'less than');
  assertEqual(ptt._decodeHtmlEntities('&gt;'), '>', 'greater than');
  assertEqual(ptt._decodeHtmlEntities('&quot;'), '"', 'quote');
  assertEqual(ptt._decodeHtmlEntities('&#39;'), "'", 'apostrophe');
  assertEqual(ptt._decodeHtmlEntities('&nbsp;'), ' ', 'nbsp');
  assertEqual(ptt._decodeHtmlEntities('&#65;'), 'A', 'numeric entity');
});

console.log('\n--- Cookie Management ---');

runTest('should parse and store cookies', function () {
  var ptt = new PyPtt();
  ptt._parseCookies('PHPSESSID=abc123; path=/');
  assertEqual(ptt._cookies['PHPSESSID'], 'abc123', 'PHPSESSID cookie');
});

runTest('should handle multiple cookies', function () {
  var ptt = new PyPtt();
  ptt._parseCookies(['PHPSESSID=abc123; path=/', 'over18=1; path=/']);
  assertEqual(ptt._cookies['PHPSESSID'], 'abc123', 'PHPSESSID');
  assertEqual(ptt._cookies['over18'], '1', 'over18');
});

runTest('should build cookie string', function () {
  var ptt = new PyPtt();
  ptt._cookies = { PHPSESSID: 'abc123', over18: '1' };
  var cookieStr = ptt._getCookieString();
  assert(cookieStr.indexOf('PHPSESSID=abc123') >= 0, 'contains PHPSESSID');
  assert(cookieStr.indexOf('over18=1') >= 0, 'contains over18');
});

console.log('\n--- Authentication ---');

runTest('should throw on empty credentials', function () {
  var ptt = new PyPtt();
  var threw = false;
  try {
    ptt.login('', '');
  } catch (e) {
    threw = true;
    assertEqual(e.type, PttException.InvalidArgument, 'exception type');
  }
  assert(threw, 'should have thrown');
});

runTest('should login successfully with mock', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 302; },
      getContentText: function () { return ''; },
      getHeaders: function () {
        return { 'Set-Cookie': 'PHPSESSID=test123; path=/' };
      },
    };
  };

  ptt.login('testuser', 'testpass');
  assert(ptt._isLoggedIn, 'should be logged in');
  assertEqual(ptt._pttId, 'testuser', 'ptt id');
});

runTest('should logout correctly', function () {
  var ptt = new PyPtt();
  ptt._isLoggedIn = true;
  ptt._pttId = 'testuser';
  ptt._cookies = { PHPSESSID: 'abc' };

  ptt.logout();

  assert(!ptt._isLoggedIn, 'not logged in');
  assertEqual(ptt._pttId, '', 'empty ptt id');
  assertEqual(Object.keys(ptt._cookies).length, 0, 'no cookies');
});

console.log('\n--- Utility Methods ---');

runTest('should generate board URL', function () {
  var ptt = new PyPtt();
  assertEqual(ptt.getBoardUrl('Gossiping'), 'https://www.ptt.cc/bbs/Gossiping/index.html', 'board URL');
});

runTest('should generate post URL', function () {
  var ptt = new PyPtt();
  assertEqual(
    ptt.getPostUrl('Gossiping', 'M.1704067200.A.ABC'),
    'https://www.ptt.cc/bbs/Gossiping/M.1704067200.A.ABC.html',
    'post URL'
  );
});

console.log('\n--- Deleted Post Handling ---');

runTest('should detect 404 post', function () {
  var ptt = new PyPtt();
  var html = '<html><body><h1>404 - Not Found</h1></body></html>';
  var post = ptt._parsePost(html, 'TestBoard', 'M.1.A.A');
  assertEqual(post.post_status, PostStatus.DELETED_BY_UNKNOWN, 'deleted status');
  assertEqual(post.pass_format_check, false, 'format check failed');
});

// ============================================================
// Mock Integration Tests
// ============================================================

console.log('\n--- Mock Integration Tests ---');

runTest('should get post list with mock fetch', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () { return SAMPLE_BOARD_HTML; },
      getHeaders: function () { return {}; },
    };
  };

  var result = ptt.getPostList('TestBoard');
  assertEqual(result.posts.length, 4, 'post count');
  assertEqual(result.board, 'TestBoard', 'board name');
});

runTest('should get single post with mock fetch', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () { return SAMPLE_POST_HTML; },
      getHeaders: function () { return {}; },
    };
  };

  var post = ptt.getPost('TestBoard', 'M.1704067200.A.ABC');
  assertEqual(post.author, 'testuser', 'author');
  assertEqual(post.title, '[問卦] 這是測試文章', 'title');
  assertEqual(post.comments.length, 3, 'comments');
});

runTest('should throw NoSuchBoard on 404', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 404; },
      getContentText: function () { return 'Not Found'; },
      getHeaders: function () { return {}; },
    };
  };

  var threw = false;
  try {
    ptt.getPostList('NonExistent');
  } catch (e) {
    threw = true;
    assertEqual(e.type, PttException.NoSuchBoard, 'exception type');
  }
  assert(threw, 'should have thrown');
});

runTest('should throw NoSuchPost on 404', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 404; },
      getContentText: function () { return 'Not Found'; },
      getHeaders: function () { return {}; },
    };
  };

  var threw = false;
  try {
    ptt.getPost('TestBoard', 'M.9999999999.A.ZZZ');
  } catch (e) {
    threw = true;
    assertEqual(e.type, PttException.NoSuchPost, 'exception type');
  }
  assert(threw, 'should have thrown');
});

runTest('should get newest index with mock fetch', function () {
  var ptt = new PyPtt();
  ptt._testFetch = function (url, options) {
    return {
      getResponseCode: function () { return 200; },
      getContentText: function () { return SAMPLE_BOARD_HTML; },
      getHeaders: function () { return {}; },
    };
  };

  var index = ptt.getNewestIndex('TestBoard');
  assertEqual(index, 1235, 'newest index (1234 from prev link + 1)');
});

// ============================================================
// Summary
// ============================================================

console.log('\n========================================');
console.log('Results: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
