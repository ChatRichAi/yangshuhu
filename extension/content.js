// Content script for 养薯户 - runs on xiaohongshu.com
// Depends on: api.js (YSHApi), history.js (InteractionHistory)

let automationRunning = false;
let rules = {};
let api = null;
let customComments = [];

// ========== Floating Overlay ==========
let overlayEl = null;
let overlayTimer = null;
let overlaySeconds = 0;
const overlayStats = { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };

function createOverlay() {
  if (overlayEl) return;

  const style = document.createElement('style');
  style.id = 'ysh-overlay-style';
  style.textContent = `
    #ysh-overlay-backdrop {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }
    #ysh-overlay {
      background: #fff;
      border-radius: 20px;
      padding: 28px 28px 22px;
      width: 320px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.22);
      font-family: "PingFang SC","SF Pro Display",sans-serif;
      color: #18212b;
      user-select: none;
    }
    #ysh-overlay .ysh-icon { font-size: 32px; margin-bottom: 10px; display: block; text-align: center; }
    #ysh-overlay .ysh-title {
      font-size: 20px; font-weight: 800; text-align: center;
      margin-bottom: 4px; letter-spacing: -0.02em;
    }
    #ysh-overlay .ysh-warn {
      font-size: 12px; color: #b36a1f; text-align: center;
      background: rgba(179,106,31,0.1); border-radius: 8px;
      padding: 6px 10px; margin: 10px 0 16px;
      line-height: 1.5;
    }
    #ysh-overlay .ysh-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 8px; margin-bottom: 14px;
    }
    #ysh-overlay .ysh-cell {
      background: #f7f7f6; border-radius: 12px;
      padding: 10px 6px; text-align: center;
    }
    #ysh-overlay .ysh-cell strong {
      display: block; font-size: 22px; font-weight: 800;
      letter-spacing: -0.03em; margin-bottom: 3px;
    }
    #ysh-overlay .ysh-cell span {
      font-size: 10px; color: #70808f;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    #ysh-overlay .ysh-time {
      text-align: center; font-size: 12px; color: #70808f;
      margin-bottom: 16px;
    }
    #ysh-overlay .ysh-stop {
      width: 100%; padding: 13px; border: none; border-radius: 13px;
      background: linear-gradient(135deg, #ec5b4f, #c9423d);
      color: #fff; font-size: 14px; font-weight: 800;
      cursor: pointer; letter-spacing: 0.01em;
      box-shadow: 0 8px 18px rgba(236,91,79,0.28);
      transition: filter 0.15s;
    }
    #ysh-overlay .ysh-stop:hover { filter: brightness(1.08); }
  `;
  document.head.appendChild(style);

  const backdrop = document.createElement('div');
  backdrop.id = 'ysh-overlay-backdrop';
  backdrop.innerHTML = `
    <div id="ysh-overlay">
      <span class="ysh-icon">🌱</span>
      <div class="ysh-title">养号器工作中</div>
      <div class="ysh-warn">⚠️ 运行中请不要关闭或最小化浏览器窗口</div>
      <div class="ysh-grid">
        <div class="ysh-cell"><strong id="ysh-s-browse">0</strong><span>浏览</span></div>
        <div class="ysh-cell"><strong id="ysh-s-like">0</strong><span>点赞</span></div>
        <div class="ysh-cell"><strong id="ysh-s-collect">0</strong><span>收藏</span></div>
        <div class="ysh-cell"><strong id="ysh-s-comment">0</strong><span>评论</span></div>
        <div class="ysh-cell"><strong id="ysh-s-follow">0</strong><span>关注</span></div>
        <div class="ysh-cell"><strong id="ysh-s-time">00:00</strong><span>时长</span></div>
      </div>
      <div class="ysh-time">无时长限制，任务结束后自动关闭</div>
      <button class="ysh-stop" id="ysh-stop-btn">停止运行</button>
    </div>
  `;

  // Block all clicks on backdrop from reaching the page
  backdrop.addEventListener('click', e => e.stopPropagation());

  document.body.appendChild(backdrop);
  overlayEl = backdrop;

  document.getElementById('ysh-stop-btn').addEventListener('click', () => {
    automationRunning = false;
    chrome.runtime.sendMessage({ action: 'stopAutomation' });
    removeOverlay();
  });

  // Start timer
  overlaySeconds = 0;
  overlayTimer = setInterval(() => {
    overlaySeconds++;
    const m = String(Math.floor(overlaySeconds / 60)).padStart(2, '0');
    const s = String(overlaySeconds % 60).padStart(2, '0');
    const el = document.getElementById('ysh-s-time');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

function updateOverlayStat(type) {
  if (!overlayEl) return;
  if (type in overlayStats) {
    overlayStats[type]++;
    const el = document.getElementById(`ysh-s-${type}`);
    if (el) el.textContent = overlayStats[type];
  }
}

function removeOverlay() {
  if (overlayTimer) { clearInterval(overlayTimer); overlayTimer = null; }
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  const style = document.getElementById('ysh-overlay-style');
  if (style) style.remove();
  Object.keys(overlayStats).forEach(k => { overlayStats[k] = 0; });
  overlaySeconds = 0;
}

// ========== Message Listener ==========
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'ping':
      sendResponse({ status: 'ok' });
      break;
    case 'startAutomation':
      rules = message.rules;
      automationRunning = true;
      createOverlay();
      initAndRun();
      sendResponse({ status: 'ok' });
      break;
    case 'stopAutomation':
      automationRunning = false;
      removeOverlay();
      sendResponse({ status: 'ok' });
      break;
    // OpenClaw AI mode overlay control (sent from background.js → XHS tab)
    case 'xhsOverlay':
      if (message.cmd === 'show') {
        createOverlay();
      } else if (message.cmd === 'hide') {
        removeOverlay();
      } else if (message.cmd === 'stat' && message.statType) {
        updateOverlayStat(message.statType);
      }
      sendResponse({ status: 'ok' });
      break;
  }
  return true;
});

// ========== Initialization ==========
async function initAndRun() {
  try {
    // Load API config
    const data = await chromeStorageGet(['apiBaseUrl', 'apiKey', 'customComments', 'commentGroups']);
    api = new YSHApi(data.apiBaseUrl, data.apiKey);
    customComments = normalizeCustomComments(data.customComments, data.commentGroups);

    // Clean expired history
    await InteractionHistory.cleanExpired();

    // Detect page type and run appropriate automation
    const url = window.location.href;
    reportAction('init', '初始化完成', `当前页面: ${url.split('?')[0]}`, url);

    if (rules.mode === 'comment-zone') {
      reportAction('mode', '评论区模式', '开始浏览评论活跃笔记');
      await runCommentZoneAutomation();
    } else if (rules.mode === 'profile') {
      reportAction('mode', '主页模式', '开始浏览用户主页');
      await runProfileAutomation();
    } else if (url.includes('/explore') || url.includes('/search_result')) {
      reportAction('mode', '发现页模式', '开始浏览发现页信息流');
      await runFeedAutomation();
    } else {
      reportAction('mode', '信息流模式', '默认浏览模式');
      await runFeedAutomation();
    }
  } catch (err) {
    console.error('[养薯户] 自动化出错:', err);
    reportAction('error', '出错', err.message || '未知错误');
    automationRunning = false;
    chrome.runtime.sendMessage({ action: 'taskComplete' }).catch(() => {});
    removeOverlay();
  }
}

// ========== Utility Functions ==========
function chromeStorageGet(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, resolve);
  });
}

function normalizeCustomComments(storedCustomComments, commentGroups) {
  if (Array.isArray(storedCustomComments) && storedCustomComments.length > 0) {
    return storedCustomComments.map(text => String(text).trim()).filter(Boolean);
  }
  if (!commentGroups || typeof commentGroups !== 'object') {
    return [];
  }
  return Object.values(commentGroups)
    .flatMap(group => Array.isArray(group) ? group : [])
    .map(text => String(text).trim())
    .filter(Boolean);
}

function randomDelay(min, max) {
  return new Promise(resolve =>
    setTimeout(resolve, (min + Math.random() * (max - min)) * 1000)
  );
}

function waitForCondition(predicate, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      let matched = false;
      try {
        matched = Boolean(predicate());
      } catch {}
      if (matched) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function reportStat(type, log) {
  chrome.runtime.sendMessage({ action: 'statUpdate', type, log });
}

function reportAction(stepAction, label, detail, url) {
  chrome.runtime.sendMessage({ action: 'taskAction', stepAction, label, detail, url });
}

function reportValidation(stepAction, label, ok, detail, url, scope = '') {
  chrome.runtime.sendMessage({
    action: 'taskAction',
    stepAction,
    label,
    detail,
    url: url || window.location.href,
    validationStatus: ok ? 'ok' : 'fail',
    validationScope: scope,
  });
}

function shouldTrigger(probability) {
  // probability is 0-100, returns true based on Math.random()
  return Math.random() * 100 < probability;
}

async function openNoteCard(card) {
  const previousUrl = window.location.href;
  const clickableCandidates = [];
  if (card.matches('a, button, [role="button"]')) {
    clickableCandidates.push(card);
  }
  clickableCandidates.push(
    ...card.querySelectorAll(
      'a.cover[href], a.title, .cover, .title, button, [role="button"], a[href]'
    )
  );
  const clickable = clickableCandidates.find(isVisibleElement) || card;
  clickable.click();
  const opened = await waitForCondition(
    () => isNoteDetailPage() || window.location.href !== previousUrl,
    { timeoutMs: 8000, intervalMs: 250 }
  );
  if (opened) {
    reportValidation('open', '打开笔记已命中', true, '已进入笔记详情页', window.location.href, 'navigation');
    await randomDelay(0.8, 1.4);
  } else {
    reportValidation('open', '打开笔记失败', false, '点击后 8 秒内未进入笔记详情页', previousUrl, 'navigation');
  }
  return opened;
}

/**
 * Extract note ID from a card element or current URL
 */
function extractNoteId(card) {
  // Try data attributes
  const noteId = card?.getAttribute('data-note-id') || card?.getAttribute('data-id');
  if (noteId) return noteId;

  // Try link href
  const link = card?.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]');
  if (link) {
    const match = link.href.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/);
    if (match) return match[1];
  }

  // Try from current page URL (when inside note detail)
  const urlMatch = window.location.href.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // Fallback: use card index as pseudo-ID
  return null;
}

/**
 * Extract title text from a card element
 */
function extractCardTitle(card) {
  const titleEl = card.querySelector('.title, .note-title, [class*="title"], .desc, span');
  return titleEl ? titleEl.textContent.trim() : '';
}

function parseCountString(rawText) {
  if (!rawText) return 0;
  const text = String(rawText).replace(/,/g, '').trim();
  const match = text.match(/(\d+(?:\.\d+)?)(万)?/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return match[2] ? Math.round(value * 10000) : Math.round(value);
}

function extractCommentCount(card) {
  const text = card?.textContent || '';
  const match = text.match(/(\d+(?:\.\d+)?)(万)?\s*(?:条)?评论/);
  if (!match) return 0;
  return parseCountString(match[0]);
}

/**
 * Extract note content (title + body) from the detail page
 */
function extractNoteContent() {
  const title = document.querySelector(
    '#detail-title, .title, [class*="note-title"], .note-text .title'
  );
  const body = document.querySelector(
    '#detail-desc, .desc, [class*="note-content"], .note-text .desc, [class*="note-desc"]'
  );
  const titleText = title ? title.textContent.trim() : '';
  const bodyText = body ? body.textContent.trim() : '';
  return `${titleText}\n${bodyText}`.trim();
}

// ========== Keyword Filtering ==========
function matchesKeywordFilter(text) {
  if (!text) return { include: true, exclude: false };

  const includeKeywords = (rules.keywordsInclude || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  const excludeKeywords = (rules.keywordsExclude || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  // Check exclude first
  const shouldExclude = excludeKeywords.length > 0 &&
    excludeKeywords.some(kw => text.includes(kw));

  // Check include priority
  const shouldInclude = includeKeywords.length === 0 ||
    includeKeywords.some(kw => text.includes(kw));

  return { include: shouldInclude, exclude: shouldExclude };
}

// ========== Comment Generation ==========

/**
 * Get a comment: AI-generated or from custom comment library
 */
async function getComment(noteContent) {
  // Try AI comment first if enabled
  if (rules.aiCommentEnabled && api) {
    try {
      const style = rules.commentStyle || 'positive';
      const result = await api.generateComment(noteContent, style);
      if (result && result.comment) {
        return result.comment;
      }
    } catch (e) {
      console.warn('[养薯户] AI 评论生成失败, 使用备选方案', e);
    }
  }

  // Fallback: use custom comment library
  if (customComments.length > 0) {
    return customComments[Math.floor(Math.random() * customComments.length)];
  }

  // Default fallback comments
  const defaults = [
    '写得真好，学到了！',
    '感谢分享，收藏了',
    '太棒了，期待更多内容',
    '好有用的分享！',
    '说得很有道理呢',
    '赞！内容很详细',
    '码住了，之后慢慢看',
    '真不错，长知识了',
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Type text into comment input and submit
 */
async function typeAndSubmitComment(commentText) {
  // Find comment input
  const commentInput = document.querySelector(
    '.comment-input textarea, [class*="comment"] textarea, ' +
    '[placeholder*="评论"], [placeholder*="说点什么"], .reply-input textarea, ' +
    '#content-textarea, [contenteditable="true"]'
  );

  if (!commentInput) {
    console.warn('[养薯户] 未找到评论输入框');
    reportValidation('comment', '评论输入框缺失', false, '未找到评论输入框', window.location.href, 'comment');
    return false;
  }

  // Focus and type
  commentInput.focus();
  await randomDelay(0.3, 0.8);

  if (commentInput.tagName === 'TEXTAREA' || commentInput.tagName === 'INPUT') {
    // Set value via native input setter for React compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(commentInput, commentText);
    } else {
      commentInput.value = commentText;
    }
    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
    commentInput.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable
    commentInput.textContent = commentText;
    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  await randomDelay(0.5, 1.0);

  // Find and click submit button
  const submitBtn = document.querySelector(
    '.comment-submit, [class*="submit"], [class*="send-btn"], ' +
    'button[class*="comment"]'
  );

  if (submitBtn && !submitBtn.disabled) {
    submitBtn.click();
    await randomDelay(1, 2);
    reportValidation('comment', '评论已提交', true, '已点击评论发送按钮', window.location.href, 'comment');
    return true;
  }

  // Try pressing Enter
  commentInput.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true,
  }));
  await randomDelay(1, 2);
  reportValidation('comment', '评论已提交', true, '已通过 Enter 触发评论发送', window.location.href, 'comment');
  return true;
}

function findCommentItems() {
  return Array.from(document.querySelectorAll(
    '.comment-item, [class*="comment-item"], [class*="commentItem"], .parent-comment'
  ));
}

function findReplyTrigger(commentEl) {
  if (!commentEl) return null;
  const candidates = Array.from(commentEl.querySelectorAll('button, span, div'));
  return candidates.find(el => {
    const text = (el.textContent || '').trim();
    return text === '回复' || text.startsWith('回复 ');
  }) || null;
}

async function replyToComment(commentEl, noteContent) {
  const trigger = findReplyTrigger(commentEl);
  if (!trigger) return false;

  trigger.click();
  await randomDelay(0.5, 1.0);

  const commentText = await getComment(noteContent);
  if (!commentText) return false;

  return typeAndSubmitComment(commentText);
}

// ========== Interaction Actions ==========

/**
 * Like the current note
 */
async function performLike() {
  const likeBtn = document.querySelector(
    '.like-wrapper .like-icon, [class*="like-wrapper"] [class*="like"], ' +
    '[class*="like-btn"], .engage-bar [class*="like"], ' +
    'span[class*="like"]:not([class*="liked"])'
  );
  if (likeBtn) {
    likeBtn.click();
    await randomDelay(0.5, 1.5);
    reportValidation('like', '点赞已命中', true, '已点击点赞按钮', window.location.href, 'engagement');
    return true;
  }
  reportValidation('like', '点赞未命中', false, '未找到点赞按钮', window.location.href, 'engagement');
  return false;
}

/**
 * Collect/bookmark the current note
 */
async function performCollect() {
  const collectBtn = document.querySelector(
    '.collect-wrapper .collect-icon, [class*="collect-wrapper"] [class*="collect"], ' +
    '[class*="collect-btn"], .engage-bar [class*="collect"], ' +
    'span[class*="collect"]:not([class*="collected"])'
  );
  if (collectBtn) {
    collectBtn.click();
    await randomDelay(0.5, 1.5);
    reportValidation('collect', '收藏已命中', true, '已点击收藏按钮', window.location.href, 'engagement');
    return true;
  }
  reportValidation('collect', '收藏未命中', false, '未找到收藏按钮', window.location.href, 'engagement');
  return false;
}

/**
 * Follow the author
 */
async function performFollow() {
  const followBtn = document.querySelector(
    '.follow-btn:not(.followed), [class*="follow"]:not([class*="followed"]):not([class*="following"]), ' +
    'button[class*="follow"]:not(.followed)'
  );
  if (followBtn) {
    const text = followBtn.textContent.trim();
    // Only click "关注" buttons, not "已关注"
    if (text === '关注' || text === '+关注' || text === 'Follow') {
      followBtn.click();
      await randomDelay(1, 2);
      reportValidation('follow', '关注已命中', true, '已点击关注按钮', window.location.href, 'engagement');
      return true;
    }
  }
  reportValidation('follow', '关注未命中', false, '未找到可点击的关注按钮', window.location.href, 'engagement');
  return false;
}

/**
 * Like comments in the comment section
 */
async function likeCommentsInSection(maxLikes = 2) {
  const commentLikes = Array.from(document.querySelectorAll(
    '.comment-item [class*="like"], .comment [class*="like-btn"]'
  ));
  if (commentLikes.length > 0) {
    const shuffled = commentLikes.sort(() => Math.random() - 0.5);
    const count = Math.min(maxLikes, shuffled.length);
    for (const btn of shuffled.slice(0, count)) {
      btn.click();
      await randomDelay(0.5, 1.0);
    }
    return count;
  }
  return 0;
}

// ========== Card Selectors (updated for current XHS DOM) ==========
const CARD_SELECTORS = [
  'section.note-item',
  '.note-item',
  'div[class*="note-item"]',
  'a[href*="/explore/"]',
  'a[href*="/discovery/item/"]',
  '[class*="noteContainer"]',
  '[class*="NoteContainer"]',
  '.feeds-page section',
  '[data-note-id]',
].join(', ');

function findNoteCards() {
  let cards = document.querySelectorAll(CARD_SELECTORS);
  // Fallback: try broader selector for links to explore pages
  if (cards.length === 0) {
    cards = document.querySelectorAll('a[href*="/explore/"], a[href*="/search_result/"]');
  }

  const normalizedCards = [];
  const seen = new Set();

  for (const rawCard of cards) {
    const container = rawCard.closest(
      'section.note-item, .note-item, [class*="noteContainer"], [class*="NoteContainer"]'
    ) || rawCard;

    if (!isVisibleElement(container) || seen.has(container)) continue;
    seen.add(container);
    normalizedCards.push(container);
  }

  return normalizedCards;
}

// ========== Feed Automation (Discover / Search) ==========
async function runFeedAutomation() {
  let browsed = 0;

  reportAction('scan', '扫描页面', `目标浏览 ${rules.browseCount} 条笔记`, window.location.href);

  while (automationRunning && browsed < rules.browseCount) {
    // Scroll to load content
    window.scrollBy({
      top: 300 + Math.random() * 500,
      behavior: 'smooth',
    });

    reportAction('scroll', '滚动浏览', `正在加载更多内容...`);
    await randomDelay(rules.browseInterval, rules.browseInterval + 3);

    // Find note cards
    const cards = findNoteCards();

    if (cards.length === 0) {
      reportAction('wait', '等待加载', '未找到笔记卡片，继续滚动');
      window.scrollBy({ top: 800, behavior: 'smooth' });
      await randomDelay(3, 5);
      continue;
    }

    reportAction('scan', '发现笔记', `找到 ${cards.length} 条笔记`);

    // Filter cards by keywords and history
    let eligibleCards = [];
    for (const card of cards) {
      const title = extractCardTitle(card);
      const noteId = extractNoteId(card);

      // Check interaction history
      if (noteId && await InteractionHistory.hasInteracted(noteId)) {
        continue;
      }

      // Keyword filtering
      const { include, exclude } = matchesKeywordFilter(title);
      if (exclude) continue;

      eligibleCards.push({ card, title, noteId, priority: include });
    }

    if (eligibleCards.length === 0) {
      reportAction('skip', '跳过', '所有笔记已互动或被过滤');
      window.scrollBy({ top: 600, behavior: 'smooth' });
      await randomDelay(2, 4);
      continue;
    }

    // Prioritize cards matching include keywords
    const priorityCards = eligibleCards.filter(c => c.priority);
    const targetPool = priorityCards.length > 0 ? priorityCards : eligibleCards;
    const target = targetPool[Math.floor(Math.random() * targetPool.length)];

    // Click to view note
    reportAction('click', '打开笔记', target.title || `第 ${browsed + 1} 条笔记`);
    const opened = await openNoteCard(target.card);
    if (!opened) {
      reportAction('wait', '打开失败', '未成功进入笔记，继续下一条');
      await randomDelay(1, 2);
      continue;
    }

    browsed++;
    updateOverlayStat('browse');
    reportStat('browse', `浏览了第 ${browsed} 条笔记: ${(target.title || '').slice(0, 30)}`);

    if (target.noteId) {
      await InteractionHistory.markInteracted(target.noteId);
    }

    // Wait for note to load (simulates real reading)
    reportAction('read', '阅读笔记', `模拟阅读 ${rules.browseDuration}~${rules.browseDuration + 5} 秒`);
    await randomDelay(rules.browseDuration, rules.browseDuration + 5);

    // ---- Like (probability-based) ----
    const likeProbability = rules.likeProbability ?? Math.round(100 / (rules.likeRatio || 2));
    if (shouldTrigger(likeProbability)) {
      if (await performLike()) {
        updateOverlayStat('like');
        reportStat('like', `点赞了第 ${browsed} 条笔记`);
        reportAction('like', '点赞', `已点赞第 ${browsed} 条笔记`);
        if (api) api.recordStat('like', `笔记 ${target.noteId || browsed}`);
      }
      await randomDelay(0.5, 1.5);
    }

    // ---- Collect (probability-based) ----
    const collectProbability = rules.collectProbability ?? Math.round(100 / (rules.collectRatio || 3));
    if (shouldTrigger(collectProbability)) {
      if (await performCollect()) {
        updateOverlayStat('collect');
        reportStat('collect', `收藏了第 ${browsed} 条笔记`);
        reportAction('collect', '收藏', `已收藏第 ${browsed} 条笔记`);
        if (api) api.recordStat('collect', `笔记 ${target.noteId || browsed}`);
      }
      await randomDelay(0.5, 1.5);
    }

    // ---- Follow (probability-based) ----
    const followProbability = rules.followProbability ?? Math.round(100 / (rules.followRatio || 10));
    if (shouldTrigger(followProbability)) {
      if (await performFollow()) {
        updateOverlayStat('follow');
        reportStat('follow', `关注了笔记作者`);
        reportAction('follow', '关注', '已关注笔记作者');
        if (api) api.recordStat('follow', `笔记 ${target.noteId || browsed} 的作者`);
      }
      await randomDelay(1, 2);
    }

    // ---- Comment (probability-based) ----
    const commentProbability = rules.commentProbability ?? Math.round(100 / (rules.commentRatio || 6));
    if (shouldTrigger(commentProbability)) {
      const noteContent = extractNoteContent();
      const commentText = await getComment(noteContent);
      if (commentText) {
        reportAction('comment', '评论', `准备发送: ${commentText.slice(0, 20)}...`);
        const success = await typeAndSubmitComment(commentText);
        if (success) {
          updateOverlayStat('comment');
          reportStat('comment', `评论了第 ${browsed} 条笔记: ${commentText.slice(0, 20)}...`);
          if (api) api.recordStat('comment', commentText.slice(0, 50));
        }
      }
      await randomDelay(1, 3);
    }

    // ---- Comment section engagement (on detail pages) ----
    if (isNoteDetailPage()) {
      await engageCommentSection();
    }

    // Close note and go back
    reportAction('close', '关闭笔记', `进度 ${browsed}/${rules.browseCount}`);
    await closeCurrentNote();
    await randomDelay(2, 4);
  }

  finishAutomation();
}

async function runCommentZoneAutomation() {
  let processedNotes = 0;
  const targetCount = rules.noteCount || rules.browseCount || 10;

  reportAction('scan', '扫描页面', `目标进入 ${targetCount} 条评论活跃笔记`, window.location.href);

  while (automationRunning && processedNotes < targetCount) {
    window.scrollBy({
      top: 300 + Math.random() * 400,
      behavior: 'smooth',
    });
    await randomDelay(rules.browseInterval, rules.browseInterval + 2);

    const cards = findNoteCards();
    if (cards.length === 0) {
      reportAction('wait', '等待加载', '未找到可进入的笔记，继续滚动');
      reportValidation('scan', '评论区笔记缺失', false, '当前页面未找到可进入的评论区笔记卡片', window.location.href, 'scan');
      await randomDelay(2, 4);
      continue;
    }

    const eligibleCards = [];
    for (const card of cards) {
      const title = extractCardTitle(card);
      const noteId = extractNoteId(card);
      const commentCount = extractCommentCount(card);

      if (noteId && await InteractionHistory.hasInteracted(noteId)) continue;
      if ((rules.minComments || 0) > 0 && commentCount > 0 && commentCount < rules.minComments) continue;

      const { include, exclude } = matchesKeywordFilter(title);
      if (exclude) continue;

      eligibleCards.push({ card, title, noteId, commentCount, priority: include });
    }

    if (eligibleCards.length === 0) {
      reportAction('skip', '跳过', '没有符合条件的评论区笔记');
      reportValidation('scan', '评论区笔记过滤后为空', false, '没有符合最小评论数或关键词条件的笔记', window.location.href, 'scan');
      await randomDelay(1, 2);
      continue;
    }

    const priorityCards = eligibleCards.filter(item => item.priority);
    const targetPool = priorityCards.length > 0 ? priorityCards : eligibleCards;
    targetPool.sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
    const target = targetPool[0];

    reportAction('click', '打开笔记', target.title || `第 ${processedNotes + 1} 条评论区笔记`);
    const opened = await openNoteCard(target.card);
    if (!opened) {
      reportAction('wait', '打开失败', '未成功进入评论区笔记，继续下一条');
      await randomDelay(1, 2);
      continue;
    }

    processedNotes++;
    updateOverlayStat('browse');
    reportStat('browse', `进入第 ${processedNotes} 条评论区笔记`);

    if (target.noteId) {
      await InteractionHistory.markInteracted(target.noteId);
    }

    await randomDelay(rules.browseDuration, rules.browseDuration + 4);

    const noteContent = extractNoteContent();
    await engageCommentSection({
      maxActions: rules.commentsPerNote || 5,
      likeProbability: rules.likeCommentProb ?? 60,
      replyProbability: rules.replyProb ?? 15,
      noteContent,
    });

    reportAction('close', '关闭笔记', `进度 ${processedNotes}/${targetCount}`);
    await closeCurrentNote();
    await randomDelay(2, 4);
  }

  finishAutomation();
}

// ========== Profile / Homepage Automation ==========
async function runProfileAutomation() {
  let browsed = 0;

  while (automationRunning && browsed < rules.browseCount) {
    // Scroll the profile feed
    window.scrollBy({
      top: 300 + Math.random() * 400,
      behavior: 'smooth',
    });

    await randomDelay(rules.browseInterval, rules.browseInterval + 2);

    const cards = document.querySelectorAll(
      '.note-item, [class*="note-card"], [class*="feed-item"]'
    );

    if (cards.length === 0) {
      window.scrollBy({ top: 600, behavior: 'smooth' });
      await randomDelay(3, 5);
      continue;
    }

    // Pick a random card not yet interacted
    let targetCard = null;
    let targetNoteId = null;
    const shuffled = Array.from(cards).sort(() => Math.random() - 0.5);

    for (const card of shuffled) {
      const noteId = extractNoteId(card);
      if (noteId && await InteractionHistory.hasInteracted(noteId)) continue;
      targetCard = card;
      targetNoteId = noteId;
      break;
    }

    if (!targetCard) {
      window.scrollBy({ top: 600, behavior: 'smooth' });
      await randomDelay(2, 4);
      continue;
    }

    reportAction('click', '打开主页笔记', `第 ${browsed + 1} 条主页笔记`);
    const opened = await openNoteCard(targetCard);
    if (!opened) {
      reportAction('wait', '打开失败', '未成功进入主页笔记，继续下一条');
      await randomDelay(1, 2);
      continue;
    }

    browsed++;
    updateOverlayStat('browse');
    reportStat('browse', `浏览了第 ${browsed} 条笔记 (主页)`);

    if (targetNoteId) {
      await InteractionHistory.markInteracted(targetNoteId);
    }

    reportAction('read', '阅读笔记', `主页模式阅读 ${rules.browseDuration}~${rules.browseDuration + 5} 秒`);
    await randomDelay(rules.browseDuration, rules.browseDuration + 5);

    const likeProbability = rules.likeProbability ?? Math.round(100 / (rules.likeRatio || 2));
    if (shouldTrigger(likeProbability)) {
      if (await performLike()) {
        updateOverlayStat('like');
        reportStat('like', `点赞了主页第 ${browsed} 条笔记`);
        reportAction('like', '点赞', `已点赞主页第 ${browsed} 条笔记`);
        if (api) api.recordStat('like', `主页笔记 ${targetNoteId || browsed}`);
      }
    }

    const collectProbability = rules.collectProbability ?? Math.round(100 / (rules.collectRatio || 3));
    if (shouldTrigger(collectProbability)) {
      if (await performCollect()) {
        updateOverlayStat('collect');
        reportStat('collect', `收藏了主页第 ${browsed} 条笔记`);
        reportAction('collect', '收藏', `已收藏主页第 ${browsed} 条笔记`);
        if (api) api.recordStat('collect', `主页笔记 ${targetNoteId || browsed}`);
      }
    }

    const followProbability = rules.followProbability ?? (rules.autoFollow ? 100 : 0);
    if (shouldTrigger(followProbability)) {
      if (await performFollow()) {
        updateOverlayStat('follow');
        reportStat('follow', `关注了主页博主`);
        reportAction('follow', '关注', '已关注主页博主');
        if (api) api.recordStat('follow', `主页笔记 ${targetNoteId || browsed} 的作者`);
      }
    }

    const commentProbability = rules.commentProbability ?? Math.round(100 / (rules.commentRatio || 6));
    if (shouldTrigger(commentProbability)) {
      const noteContent = extractNoteContent();
      const commentText = await getComment(noteContent);
      if (commentText) {
        reportAction('comment', '评论', `准备发送: ${commentText.slice(0, 20)}...`);
        const success = await typeAndSubmitComment(commentText);
        if (success) {
          updateOverlayStat('comment');
          reportStat('comment', `评论了主页第 ${browsed} 条笔记`);
          if (api) api.recordStat('comment', commentText.slice(0, 50));
        }
      }
    }

    if (isNoteDetailPage()) {
      await engageCommentSection({
        maxActions: 2,
        likeProbability: Math.min(40, likeProbability),
      });
    }

    await closeCurrentNote();
    await randomDelay(2, 4);
  }

  finishAutomation();
}

// ========== Note Detail Page Helpers ==========

function isNoteDetailPage() {
  return !!document.querySelector(
    '.note-detail, [class*="note-detail"], .detail-container, #noteContainer'
  );
}

/**
 * Engage with the comment section: scroll, like comments, optionally reply
 */
async function engageCommentSection(options = {}) {
  const {
    maxActions = 2,
    likeProbability = 30,
    replyProbability = 0,
    noteContent = '',
  } = options;

  // Scroll down to load comments
  const commentArea = document.querySelector(
    '.comment-list, [class*="comment-container"], .comments-el'
  );
  if (!commentArea) {
    if (rules.mode === 'comment-zone') {
      reportValidation('comment', '评论区未命中', false, '进入笔记后未找到评论区容器', window.location.href, 'comment-zone');
    }
    return { likedComments: 0, replied: false };
  }

  if (rules.mode === 'comment-zone') {
    reportValidation('comment', '评论区已命中', true, '已找到评论区容器', window.location.href, 'comment-zone');
  }

  // Scroll within comment area
  for (let i = 0; i < 2; i++) {
    commentArea.scrollTop += 200 + Math.random() * 300;
    await randomDelay(1, 2);
  }

  let likedComments = 0;
  if (shouldTrigger(likeProbability)) {
    likedComments = await likeCommentsInSection(maxActions);
    if (likedComments > 0) {
      reportStat('like', `点赞了 ${likedComments} 条评论`);
      for (let i = 0; i < likedComments; i++) {
        updateOverlayStat('like');
      }
    }
  }

  let replied = false;
  if (replyProbability > 0 && shouldTrigger(replyProbability)) {
    const commentItems = findCommentItems();
    const targetComment = commentItems[Math.floor(Math.random() * commentItems.length)];
    replied = await replyToComment(targetComment, noteContent);

    if (!replied && noteContent) {
      const fallbackComment = await getComment(noteContent);
      if (fallbackComment) {
        replied = await typeAndSubmitComment(fallbackComment);
      }
    }

    if (replied) {
      updateOverlayStat('comment');
      reportStat('comment', '在评论区完成了一次回复互动');
      reportAction('comment', '评论区互动', '已在评论区发送回复');
      if (api) api.recordStat('comment', 'comment-zone-reply');
    }
  }

  return { likedComments, replied };
}

/**
 * Close current note overlay or go back
 */
async function closeCurrentNote() {
  const closeBtn = document.querySelector(
    '.close-circle, [class*="close"], .note-close, [class*="close-btn"], ' +
    'button[aria-label="close"], .reds-icon-close'
  );
  if (closeBtn) {
    closeBtn.click();
  } else {
    window.history.back();
  }
  await randomDelay(0.5, 1);
}

function finishAutomation() {
  if (automationRunning) {
    automationRunning = false;
    reportAction('done', '任务完成', '本轮养号任务已完成');
    chrome.runtime.sendMessage({ action: 'taskComplete' });
  }
  removeOverlay();
}
