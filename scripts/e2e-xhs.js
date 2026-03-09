const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'extension');
const OUT_DIR = path.join(PROJECT_ROOT, 'tmp-acceptance-artifacts');
const DEBUG_PORT = Number(process.env.XHS_E2E_DEBUG_PORT || 18802);
const DEBUG_HOST = '127.0.0.1';
const DEBUG_BASE = `http://${DEBUG_HOST}:${DEBUG_PORT}`;
const EXTENSION_ID_FALLBACK = process.env.XHS_E2E_EXTENSION_ID || 'lpfpmcljjcpghhaofiahicmjjdfebilb';
const PROFILE_ROOT = process.env.XHS_E2E_PROFILE_ROOT
  || path.join(os.homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser');
const PROFILE_NAME = process.env.XHS_E2E_PROFILE_NAME || 'Default';
const USER_DATA_DIR = process.env.XHS_E2E_USER_DATA_DIR
  || fs.mkdtempSync(path.join(os.tmpdir(), 'yangshuhu-brave-e2e-'));
const REUSE_BROWSER = process.env.XHS_E2E_REUSE_BROWSER === '1';
const BROWSER_PATH = process.env.XHS_E2E_BROWSER_PATH || detectBrowserPath();

function detectBrowserPath() {
  const candidates = [
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const browserPath = candidates.find(candidate => fs.existsSync(candidate));
  if (!browserPath) {
    throw new Error('No supported browser found. Set XHS_E2E_BROWSER_PATH explicitly.');
  }
  return browserPath;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function tryRemove(filePath) {
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
  } catch {}
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function waitForJson(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await httpGetJson(url);
    } catch (err) {
      lastError = err;
      await sleep(500);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.cpSync(source, target, { recursive: true });
  return true;
}

function prepareUserDataDir() {
  tryRemove(USER_DATA_DIR);
  ensureDir(USER_DATA_DIR);

  const localStateSource = path.join(PROFILE_ROOT, 'Local State');
  const localStateTarget = path.join(USER_DATA_DIR, 'Local State');
  copyIfExists(localStateSource, localStateTarget);

  const profileSource = path.join(PROFILE_ROOT, PROFILE_NAME);
  const profileTarget = path.join(USER_DATA_DIR, PROFILE_NAME);
  if (!copyIfExists(profileSource, profileTarget)) {
    throw new Error(`Profile not found at ${profileSource}`);
  }
}

function launchBrowser() {
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    `--disable-extensions-except=${EXTENSION_DIR}`,
    `--load-extension=${EXTENSION_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ];

  const child = spawn(BROWSER_PATH, args, {
    stdio: 'ignore',
    detached: false,
  });
  child.unref();
  return child;
}

async function discoverExtensionId(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await waitForJson(`${DEBUG_BASE}/json`, 5000).catch(() => []);
    if (Array.isArray(targets)) {
      const worker = targets.find(target =>
        target.type === 'service_worker'
        && /^chrome-extension:\/\/[a-z]{32}\/background\.js$/.test(target.url || '')
      );
      if (worker) {
        const match = worker.url.match(/^chrome-extension:\/\/([a-z]{32})\/background\.js$/);
        if (match) return match[1];
      }
    }
    await sleep(500);
  }
  return EXTENSION_ID_FALLBACK;
}

class CdpBrowser {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.messageId = 0;
    this.pending = new Map();
    this.sessions = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      if (msg.sessionId && this.sessions.has(msg.sessionId)) {
        this.sessions.get(msg.sessionId).handleEvent(msg);
      }
    };
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  async close() {
    if (!this.ws) return;
    this.ws.close();
    await sleep(100);
  }

  send(method, params = {}, sessionId = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });
      const message = sessionId
        ? { id, sessionId, method, params }
        : { id, method, params };
      this.ws.send(JSON.stringify(message));
    });
  }

  async createPage(url) {
    const { targetId } = await this.send('Target.createTarget', { url });
    await sleep(500);
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new CdpPage(this, targetId, sessionId);
    this.sessions.set(sessionId, page);
    await page.init();
    return page;
  }

  async listTargets() {
    const result = await this.send('Target.getTargets');
    return result.targetInfos || [];
  }

  async closeTarget(targetId) {
    if (!targetId) return;
    await this.send('Target.closeTarget', { targetId }).catch(() => {});
  }

  async getOrCreatePageByUrl(url) {
    const targets = await this.listTargets();
    const existing = targets.find(target => target.type === 'page' && target.url === url);
    if (existing) {
      const { sessionId } = await this.send('Target.attachToTarget', {
        targetId: existing.targetId,
        flatten: true,
      });
      const page = new CdpPage(this, existing.targetId, sessionId);
      this.sessions.set(sessionId, page);
      await page.init();
      return page;
    }
    return this.createPage(url);
  }
}

class CdpPage {
  constructor(browser, targetId, sessionId) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.eventWaiters = [];
    this.lifecycle = [];
  }

  handleEvent(msg) {
    if (msg.method === 'Page.lifecycleEvent') {
      this.lifecycle.push(msg.params);
    }
    const remaining = [];
    for (const waiter of this.eventWaiters) {
      if (waiter.predicate(msg)) waiter.resolve(msg);
      else remaining.push(waiter);
    }
    this.eventWaiters = remaining;
  }

  send(method, params = {}) {
    return this.browser.send(method, params, this.sessionId);
  }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable').catch(() => {});
    await this.send('Network.enable').catch(() => {});
    await this.send('Page.setLifecycleEventsEnabled', { enabled: true }).catch(() => {});
  }

  waitForEvent(predicate, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventWaiters = this.eventWaiters.filter(item => item.resolve !== wrappedResolve);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for event`));
      }, timeoutMs);
      const wrappedResolve = (msg) => {
        clearTimeout(timer);
        resolve(msg);
      };
      this.eventWaiters.push({ predicate, resolve: wrappedResolve });
    });
  }

  async waitForLoad(timeoutMs = 30000) {
    const alreadyLoaded = this.lifecycle.some(item => item.name === 'load');
    if (alreadyLoaded) return;
    await this.waitForEvent(
      msg => msg.method === 'Page.lifecycleEvent' && msg.params?.name === 'load',
      timeoutMs
    );
  }

  async evaluate(expression, options = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: options.awaitPromise !== false,
      returnByValue: options.returnByValue !== false,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.text || 'Runtime.evaluate failed';
      throw new Error(detail);
    }
    return result.result?.value;
  }

  async screenshot(fileName) {
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(OUT_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  }
}

function buildPlans(profileUrl) {
  return [
    {
      id: 'accept-explore',
      name: '验收-发现页',
      mode: 'explore',
      nurturingPhase: 'daily',
      browseCount: 1,
      browseInterval: 1,
      browseDuration: 1,
      likeProbability: 100,
      collectProbability: 100,
      commentProbability: 100,
      followProbability: 0,
      keywordsInclude: '',
      keywordsExclude: '',
      minLikes: 0,
      commentPersona: '自然路人',
      commentTone: 'casual',
      skill: '',
    },
    {
      id: 'accept-comment-zone',
      name: '验收-评论区',
      mode: 'comment-zone',
      nurturingPhase: 'daily',
      browseCount: 1,
      browseInterval: 1,
      browseDuration: 1,
      likeProbability: 100,
      collectProbability: 0,
      commentProbability: 100,
      followProbability: 0,
      keywordsInclude: '',
      keywordsExclude: '',
      minLikes: 0,
      commentPersona: '自然路人',
      commentTone: 'casual',
      skill: '',
    },
    {
      id: 'accept-profile',
      name: '验收-主页',
      mode: 'profile',
      nurturingPhase: 'daily',
      browseCount: 1,
      browseInterval: 1,
      browseDuration: 1,
      likeProbability: 100,
      collectProbability: 100,
      commentProbability: 100,
      followProbability: 100,
      keywordsInclude: '',
      keywordsExclude: '',
      minLikes: 0,
      commentPersona: '自然路人',
      commentTone: 'casual',
      skill: '',
      profileUrl,
    },
  ];
}

function buildStorage(profileUrl) {
  return {
    plans: buildPlans(profileUrl),
    aiConfig: {
      enabled: false,
      style: 'positive',
      persona: '',
      tone: 'casual',
      useEmoji: false,
    },
    exploreConfig: {
      searchKeyword: '',
      browseCount: 1,
      browseInterval: 1,
      browseDuration: 1,
      likeProbability: 100,
      collectProbability: 100,
      commentProbability: 100,
      followProbability: 0,
      keywordsInclude: '',
      keywordsExclude: '',
      minLikes: 0,
    },
    commentZoneConfig: {
      searchKeyword: '穿搭',
      minComments: 1,
      noteCount: 1,
      commentsPerNote: 1,
      likeCommentProb: 100,
      replyProb: 100,
    },
    profileConfig: {
      autoFollow: true,
      likeProbability: 100,
      collectProbability: 100,
      commentProbability: 100,
    },
    targetProfiles: profileUrl ? [profileUrl] : [],
    commentGroups: {
      default: ['验收测试，稍后删除。'],
    },
    customComments: ['验收测试，稍后删除。'],
    taskValidationSummary: {},
    taskValidationEvents: {},
    taskLog: [],
    todayStats: { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 },
    stats: { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 },
    dailyHistory: {},
    runningPlanIds: [],
    isRunning: false,
  };
}

async function prepareOptionsPage(browser, extensionId) {
  return browser.getOrCreatePageByUrl(`chrome-extension://${extensionId}/options.html`);
}

async function seedStorage(optionsPage, profileUrl) {
  const storage = JSON.stringify(buildStorage(profileUrl));
  return optionsPage.evaluate(`(async () => {
    const data = ${storage};
    await chrome.storage.local.clear();
    await chrome.storage.local.set(data);
    return await chrome.storage.local.get([
      'plans', 'targetProfiles', 'commentZoneConfig', 'profileConfig', 'customComments'
    ]);
  })()`);
}

async function startPlan(optionsPage, planId) {
  return optionsPage.evaluate(`(async () => {
    return chrome.runtime.sendMessage({ action: 'startTask', planId: ${JSON.stringify(planId)} });
  })()`);
}

async function stopPlan(optionsPage, planId) {
  return optionsPage.evaluate(`(async () => {
    return chrome.runtime.sendMessage({ action: 'stopTask', planId: ${JSON.stringify(planId)} });
  })()`);
}

async function readAcceptanceState(optionsPage, planId) {
  return optionsPage.evaluate(`(async () => {
    const data = await chrome.storage.local.get([
      'runningPlanIds',
      'taskValidationSummary',
      'taskValidationEvents',
      'taskLog',
      'todayStats',
      'stats'
    ]);
    return {
      runningPlanIds: data.runningPlanIds || [],
      summary: (data.taskValidationSummary || {})[${JSON.stringify(planId)}] || null,
      events: (data.taskValidationEvents || {})[${JSON.stringify(planId)}] || [],
      taskLog: data.taskLog || [],
      todayStats: data.todayStats || null,
      stats: data.stats || null,
    };
  })()`);
}

async function waitForPlanFinish(optionsPage, planId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await readAcceptanceState(optionsPage, planId);
    const running = (lastState.runningPlanIds || []).includes(planId);
    if (!running && lastState.summary && (lastState.summary.passed > 0 || lastState.summary.failed > 0)) {
      return lastState;
    }
    await sleep(2000);
  }
  throw new Error(`Plan ${planId} did not finish within ${timeoutMs}ms`);
}

async function ensureXhsReady(browser) {
  const page = await browser.createPage('https://www.xiaohongshu.com/explore');
  await page.waitForLoad(30000);
  await sleep(5000);
  const state = await page.evaluate(`(() => ({
    title: document.title,
    href: location.href,
    hasLoginText: /登录|注册/.test(document.body?.innerText || ''),
    noteCardCount: document.querySelectorAll('section.note-item, .note-item, a[href*="/explore/"]').length,
    selfProfileHref: document.querySelector('li.user a[href*="/user/profile/"]')?.href || '',
    profileLinks: Array.from(document.querySelectorAll('a[href*="/user/profile/"]')).map(a => a.href).slice(0, 20),
    bodyText: (document.body?.innerText || '').slice(0, 1000)
  }))()`);
  return { page, state };
}

async function harvestProfileUrl(browser) {
  const { page, state } = await ensureXhsReady(browser);
  const selfProfileIdMatch = (state.selfProfileHref || '').match(/\/user\/profile\/([^/?]+)/);
  const selfProfileId = selfProfileIdMatch ? selfProfileIdMatch[1] : '';
  const candidateProfiles = (state.profileLinks || []).filter((href) => {
    const match = String(href).match(/\/user\/profile\/([^/?]+)/);
    const profileId = match ? match[1] : '';
    return profileId && profileId !== selfProfileId;
  });

  let profileUrl = await selectFollowableProfile(browser, candidateProfiles);

  if (!profileUrl) {
    const clicked = await page.evaluate(`(() => {
      const card = document.querySelector('section.note-item, .note-item, a[href*="/explore/"]');
      if (!card) return false;
      const clickable = card.matches('a') ? card : (card.querySelector('a[href]') || card);
      clickable.click();
      return true;
    })()`);
    if (clicked) {
      await sleep(5000);
      const fallbackProfiles = await page.evaluate(`(() => {
        const selfHref = document.querySelector('li.user a[href*="/user/profile/"]')?.href || '';
        const selfMatch = selfHref.match(/\\/user\\/profile\\/([^/?]+)/);
        const selfProfileId = selfMatch ? selfMatch[1] : '';
        const links = Array.from(document.querySelectorAll('a[href*="/user/profile/"]'));
        return links.filter((link) => {
          const match = link.href.match(/\\/user\\/profile\\/([^/?]+)/);
          const profileId = match ? match[1] : '';
          return profileId && profileId !== selfProfileId;
        }).map(link => link.href);
      })()`);
      profileUrl = await selectFollowableProfile(browser, fallbackProfiles);
    }
  }
  return { page, state, profileUrl };
}

async function selectFollowableProfile(browser, profileUrls) {
  const candidates = Array.from(new Set((profileUrls || []).filter(Boolean))).slice(0, 8);
  let fallback = candidates[0] || '';

  for (const profileUrl of candidates) {
    const probePage = await browser.createPage(profileUrl);
    try {
      await probePage.waitForLoad(20000);
      await sleep(2500);
      const probe = await probePage.evaluate(`(() => {
        const followTexts = ['关注', '+关注', 'Follow'];
        const followedTexts = ['已关注', '相互关注', 'Following'];
        const elements = Array.from(document.querySelectorAll('button, a, div, span'));
        const visible = elements.filter(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });
        const texts = visible.map(el => (el.textContent || '').trim()).filter(Boolean);
        const followable = texts.some(text => followTexts.includes(text));
        const followed = texts.some(text => followedTexts.includes(text));
        return { followable, followed };
      })()`);
      if (probe?.followable) {
        return profileUrl;
      }
      if (!fallback && probe && !probe.followed) {
        fallback = profileUrl;
      }
    } finally {
      await browser.closeTarget(probePage.targetId);
    }
  }

  return fallback;
}

function summarizePlanResult(planId, state) {
  const events = Array.isArray(state.events) ? state.events : [];
  return {
    planId,
    summary: state.summary || null,
    eventCount: events.length,
    recentEvents: events.slice(0, 12),
    todayStats: state.todayStats || null,
    logs: (state.taskLog || []).slice(0, 20),
  };
}

async function runAcceptance() {
  ensureDir(OUT_DIR);
  tryRemove(path.join(OUT_DIR, 'acceptance-failure.json'));

  let browserProcess = null;
  if (!REUSE_BROWSER) {
    prepareUserDataDir();
    browserProcess = launchBrowser();
  }

  const version = await waitForJson(`${DEBUG_BASE}/json/version`, 30000);
  const extensionId = await discoverExtensionId();
  const browser = new CdpBrowser(version.webSocketDebuggerUrl);
  await browser.connect();

  const acceptance = {
    startedAt: new Date().toISOString(),
    browser: version.Browser,
    extensionId,
    profileUrl: '',
    xhsReady: null,
    results: [],
    screenshots: [],
  };

  try {
    const { page: xhsPage, state, profileUrl } = await harvestProfileUrl(browser);
    acceptance.xhsReady = state;
    acceptance.profileUrl = profileUrl || '';
    acceptance.screenshots.push(await xhsPage.screenshot('xhs-ready.png'));

    if (!profileUrl) {
      throw new Error('Failed to harvest a profile URL from Xiaohongshu pages');
    }

    const optionsPage = await prepareOptionsPage(browser, extensionId);
    await optionsPage.waitForLoad(20000);
    acceptance.screenshots.push(await optionsPage.screenshot('options-before.png'));

    acceptance.seeded = await seedStorage(optionsPage, profileUrl);

    const plans = ['accept-explore', 'accept-comment-zone', 'accept-profile'];
    for (const planId of plans) {
      await startPlan(optionsPage, planId);
      const result = await waitForPlanFinish(optionsPage, planId);
      acceptance.results.push(summarizePlanResult(planId, result));
      acceptance.screenshots.push(await optionsPage.screenshot(`${planId}.png`));
      await stopPlan(optionsPage, planId).catch(() => {});
      await sleep(3000);
    }

    acceptance.finishedAt = new Date().toISOString();
    const reportPath = path.join(OUT_DIR, 'acceptance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(acceptance, null, 2));
    console.log(JSON.stringify({
      ok: true,
      reportPath,
      extensionId,
      profileUrl: acceptance.profileUrl,
      results: acceptance.results.map(result => ({
        planId: result.planId,
        summary: result.summary,
      })),
    }, null, 2));
  } catch (err) {
    const failure = {
      ok: false,
      error: err.message,
      stack: err.stack,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'acceptance-failure.json'), JSON.stringify(failure, null, 2));
    throw err;
  } finally {
    await browser.close().catch(() => {});
    if (browserProcess && browserProcess.pid) {
      try {
        process.kill(browserProcess.pid, 'SIGINT');
      } catch {}
      await sleep(500);
      try {
        process.kill(browserProcess.pid, 0);
        process.kill(browserProcess.pid, 'SIGKILL');
      } catch {}
    }
  }
}

runAcceptance()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(JSON.stringify({
      ok: false,
      error: err.message,
      stack: err.stack,
    }, null, 2));
    process.exit(1);
  });
