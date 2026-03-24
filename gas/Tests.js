/**
 * PyPttGAS Tests - Google Apps Script Test Functions
 *
 * Before running these tests, set the following Script Properties:
 *   PTT_ACCOUNT  - Your PTT account ID
 *   PTT_PASSWORD - Your PTT account password
 *
 * To set Script Properties:
 *   1. In the Apps Script editor, click ⚙️ (Project Settings)
 *   2. Scroll to "Script Properties"
 *   3. Add PTT_ACCOUNT and PTT_PASSWORD
 *
 * Run each function individually from the Apps Script editor to test.
 */

// ============================================================
// Test: Login / Logout
// ============================================================

/**
 * Test login with credentials from Script Properties.
 */
function testLogin() {
  var creds = getPttCredentials();
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  ptt.login(creds.account, creds.password);
  Logger.log('Login result: ' + ptt.isLoggedIn());
  Logger.log('Logged in as: ' + ptt.getPttId());

  if (!ptt.isLoggedIn()) {
    throw new Error('Login failed!');
  }

  ptt.logout();
  Logger.log('Logout successful');
  Logger.log('Is logged in after logout: ' + ptt.isLoggedIn());

  if (ptt.isLoggedIn()) {
    throw new Error('Logout failed!');
  }

  Logger.log('✅ testLogin PASSED');
}

// ============================================================
// Test: Get Post List (Public Board)
// ============================================================

/**
 * Test getting post list from a public board (no login required).
 */
function testGetPostListPublic() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  var result = ptt.getPostList('Baseball');
  Logger.log('Board: ' + result.board);
  Logger.log('Post count: ' + result.posts.length);
  Logger.log('Previous page: ' + result.prevPage);

  if (result.posts.length === 0) {
    throw new Error('No posts found on Baseball board');
  }

  var firstPost = result.posts[0];
  Logger.log('First post:');
  Logger.log('  Title: ' + firstPost.title);
  Logger.log('  Author: ' + firstPost.author);
  Logger.log('  AID: ' + firstPost.aid);
  Logger.log('  Date: ' + firstPost.date);
  Logger.log('  Push: ' + firstPost.push_number);

  Logger.log('✅ testGetPostListPublic PASSED');
}

// ============================================================
// Test: Get Post List (Over 18 Board - Requires Login)
// ============================================================

/**
 * Test getting post list from Gossiping board (requires over-18 confirmation).
 */
function testGetPostListOver18() {
  var creds = getPttCredentials();
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  ptt.login(creds.account, creds.password);

  var result = ptt.getPostList('Gossiping');
  Logger.log('Board: ' + result.board);
  Logger.log('Post count: ' + result.posts.length);

  if (result.posts.length === 0) {
    throw new Error('No posts found on Gossiping board');
  }

  Logger.log('First post title: ' + result.posts[0].title);
  ptt.logout();

  Logger.log('✅ testGetPostListOver18 PASSED');
}

// ============================================================
// Test: Get Single Post
// ============================================================

/**
 * Test getting a single post by AID.
 * Uses the first post found on Baseball board.
 */
function testGetPost() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  // First get a post list to find a valid AID
  var list = ptt.getPostList('Baseball');
  if (list.posts.length === 0) {
    throw new Error('No posts found');
  }

  // Find the first post with a valid AID
  var targetPost = null;
  for (var i = 0; i < list.posts.length; i++) {
    if (list.posts[i].aid) {
      targetPost = list.posts[i];
      break;
    }
  }

  if (!targetPost) {
    throw new Error('No posts with valid AID found');
  }

  Logger.log('Fetching post: ' + targetPost.aid);
  var post = ptt.getPost('Baseball', targetPost.aid);

  Logger.log('Post details:');
  Logger.log('  Board: ' + post.board);
  Logger.log('  AID: ' + post.aid);
  Logger.log('  Author: ' + post.author);
  Logger.log('  Title: ' + post.title);
  Logger.log('  Date: ' + post.date);
  Logger.log('  Content length: ' + post.content.length);
  Logger.log('  Comments count: ' + post.comments.length);
  Logger.log('  Push number: ' + post.push_number);
  Logger.log('  IP: ' + post.ip);

  if (!post.title) {
    throw new Error('Post title is empty');
  }

  Logger.log('✅ testGetPost PASSED');
}

// ============================================================
// Test: Get Newest Index
// ============================================================

/**
 * Test getting the newest page index of a board.
 */
function testGetNewestIndex() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  var index = ptt.getNewestIndex('Baseball');
  Logger.log('Newest index for Baseball: ' + index);

  if (index < 1) {
    throw new Error('Invalid newest index: ' + index);
  }

  Logger.log('✅ testGetNewestIndex PASSED');
}

// ============================================================
// Test: Get Post by URL
// ============================================================

/**
 * Test extracting AID from URL and fetching post.
 */
function testGetPostByUrl() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  // First get a valid post URL
  var list = ptt.getPostList('Baseball');
  var targetPost = null;
  for (var i = 0; i < list.posts.length; i++) {
    if (list.posts[i].url) {
      targetPost = list.posts[i];
      break;
    }
  }

  if (!targetPost) {
    throw new Error('No posts with URL found');
  }

  Logger.log('Fetching by URL: ' + targetPost.url);
  var aidInfo = ptt.getAidFromUrl(targetPost.url);
  Logger.log('Extracted board: ' + aidInfo.board + ', aid: ' + aidInfo.aid);

  var post = ptt.getPostByUrl(targetPost.url);
  Logger.log('Post title: ' + post.title);

  if (!post.title) {
    throw new Error('Post title is empty');
  }

  Logger.log('✅ testGetPostByUrl PASSED');
}

// ============================================================
// Test: Search Posts
// ============================================================

/**
 * Test searching posts by keyword.
 */
function testSearchPosts() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  var result = ptt.searchPosts('Baseball', { keyword: '中華' });
  Logger.log('Search results: ' + result.posts.length + ' posts');

  for (var i = 0; i < Math.min(3, result.posts.length); i++) {
    Logger.log('  [' + i + '] ' + result.posts[i].title);
  }

  Logger.log('✅ testSearchPosts PASSED');
}

// ============================================================
// Test: Board Exists
// ============================================================

/**
 * Test checking if a board exists.
 */
function testBoardExists() {
  var ptt = new PyPtt({ logLevel: 'DEBUG' });

  var exists = ptt.boardExists('Baseball');
  Logger.log('Baseball exists: ' + exists);
  if (!exists) {
    throw new Error('Baseball board should exist');
  }

  var notExists = ptt.boardExists('ThisBoardDoesNotExist12345');
  Logger.log('ThisBoardDoesNotExist12345 exists: ' + notExists);
  if (notExists) {
    throw new Error('Random board should not exist');
  }

  Logger.log('✅ testBoardExists PASSED');
}

// ============================================================
// Run All Tests
// ============================================================

/**
 * Run all tests in sequence.
 * Note: Some tests require login credentials in Script Properties.
 */
function runAllTests() {
  var tests = [
    { name: 'testGetPostListPublic', fn: testGetPostListPublic },
    { name: 'testGetNewestIndex', fn: testGetNewestIndex },
    { name: 'testGetPost', fn: testGetPost },
    { name: 'testGetPostByUrl', fn: testGetPostByUrl },
    { name: 'testBoardExists', fn: testBoardExists },
    { name: 'testSearchPosts', fn: testSearchPosts },
    { name: 'testLogin', fn: testLogin },
    { name: 'testGetPostListOver18', fn: testGetPostListOver18 },
  ];

  var passed = 0;
  var failed = 0;

  for (var i = 0; i < tests.length; i++) {
    try {
      Logger.log('\n--- Running: ' + tests[i].name + ' ---');
      tests[i].fn();
      passed++;
    } catch (e) {
      Logger.log('❌ ' + tests[i].name + ' FAILED: ' + e.message);
      failed++;
    }
  }

  Logger.log('\n========================================');
  Logger.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  Logger.log('========================================');
}
