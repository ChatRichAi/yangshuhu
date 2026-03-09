// Background service worker for 养薯户
// 养号计划 → 直接脚本控制 | 运营计划 → OpenClaw AI

const runningPlanIds = new Set();
const tabToPlanId = new Map(); // tabId → planId (直接脚本路径)
const planToTab = new Map();   // planId → tabId (直接脚本路径)
const MAX_VALIDATION_EVENTS = 200;

function createValidationSummary(planName = '') {
  return {
    planName,
    passed: 0,
    failed: 0,
    lastEvent: '',
    lastFailure: '',
    updatedAt: new Date().toISOString(),
  };
}

// ========== Plan → Rules 转换 ==========
function planToRules(plan, config = {}) {
  const mode = plan.mode || 'explore';
  const aiConfig = config.aiConfig || {};
  const exploreConfig = config.exploreConfig || {};
  const commentZoneConfig = config.commentZoneConfig || {};
  const profileConfig = config.profileConfig || {};
  const targetProfiles = Array.isArray(config.targetProfiles) ? config.targetProfiles : [];

  return {
    planName: plan.name,
    skill: '',
    mode,
    nurturingPhase: plan.nurturingPhase || 'daily',
    browseCount: plan.browseCount,
    browseInterval: plan.browseInterval,
    browseDuration: plan.browseDuration,
    likeProbability: plan.likeProbability,
    collectProbability: plan.collectProbability,
    commentProbability: plan.commentProbability,
    followProbability: plan.followProbability,
    keywordsInclude: plan.keywordsInclude || exploreConfig.keywordsInclude || '',
    keywordsExclude: plan.keywordsExclude || exploreConfig.keywordsExclude || '',
    minLikes: plan.minLikes || exploreConfig.minLikes || 0,
    searchKeyword: (
      mode === 'comment-zone'
        ? commentZoneConfig.searchKeyword
        : exploreConfig.searchKeyword
    ) || '',
    minComments: commentZoneConfig.minComments || 0,
    noteCount: commentZoneConfig.noteCount || plan.browseCount || 10,
    commentsPerNote: commentZoneConfig.commentsPerNote || 5,
    likeCommentProb: commentZoneConfig.likeCommentProb ?? Math.min(plan.likeProbability ?? 60, 100),
    replyProb: commentZoneConfig.replyProb ?? plan.commentProbability ?? 15,
    targetProfiles,
    autoFollow: profileConfig.autoFollow ?? false,
    aiCommentEnabled: Boolean(aiConfig.enabled),
    commentStyle: aiConfig.style || 'positive',
    commentPersona: plan.commentPersona || aiConfig.persona || '',
    commentTone: plan.commentTone || aiConfig.tone || 'casual',
    useEmoji: Boolean(aiConfig.useEmoji),
  };
}

function buildSearchUrl(keyword) {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword.trim())}`;
}

function normalizeProfileUrl(profile) {
  const raw = (profile || '').trim();
  if (!raw) return '';

  if (/^https:\/\/www\.xiaohongshu\.com\/user\/profile\//.test(raw)) {
    return raw;
  }
  if (/^\/user\/profile\//.test(raw)) {
    return `https://www.xiaohongshu.com${raw}`;
  }
  if (/^[A-Za-z0-9_-]{8,}$/.test(raw)) {
    return `https://www.xiaohongshu.com/user/profile/${raw}`;
  }
  return '';
}

function resolvePlanTargetUrl(plan, config = {}) {
  const mode = plan.mode || 'explore';

  if (mode === 'profile') {
    const targetProfiles = Array.isArray(config.targetProfiles) ? config.targetProfiles : [];
    const preferredProfile = targetProfiles.find(Boolean);
    return normalizeProfileUrl(preferredProfile);
  }

  if (mode === 'comment-zone') {
    const keyword = config.commentZoneConfig?.searchKeyword || '';
    return keyword.trim() ? buildSearchUrl(keyword) : 'https://www.xiaohongshu.com/explore';
  }

  const keyword = config.exploreConfig?.searchKeyword || '';
  return keyword.trim() ? buildSearchUrl(keyword) : 'https://www.xiaohongshu.com/explore';
}

function selectPreferredTab(tabs, targetUrl, mode) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;

  if (targetUrl) {
    const exact = tabs.find(tab => (tab.url || '').startsWith(targetUrl));
    if (exact) return exact;
  }

  if (mode === 'profile') {
    return tabs.find(tab => /\/user\/profile\//.test(tab.url || '')) || tabs[0];
  }
  if (mode === 'comment-zone') {
    return tabs.find(tab => /\/search_result/.test(tab.url || ''))
      || tabs.find(tab => /\/explore/.test(tab.url || ''))
      || tabs[0];
  }
  return tabs.find(tab => /\/explore/.test(tab.url || ''))
    || tabs.find(tab => /\/search_result/.test(tab.url || ''))
    || tabs[0];
}

function shouldNavigateTab(currentUrl, targetUrl) {
  if (!targetUrl) return false;
  return (currentUrl || '') !== targetUrl;
}

async function waitForTabComplete(tabId, timeoutMs = 15000) {
  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
  });
}

// ========== Message Listeners ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startTask':
      startTask(message.planId);
      sendResponse({ status: 'started' });
      break;
    case 'stopTask':
      stopTask(message.planId);
      sendResponse({ status: 'stopped' });
      break;
    case 'getStatus':
      sendResponse({ isRunning: runningPlanIds.size > 0, runningPlanIds: [...runningPlanIds] });
      break;
    case 'cdp_get_targets':
      fetch(message.url)
        .then(r => r.json())
        .then(targets => sendResponse({ ok: true, targets }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true; // async
    case 'statUpdate': {
      const statPlanId = sender.tab ? tabToPlanId.get(sender.tab.id) : null;
      handleStatUpdate(message.type, message.log, statPlanId);
      sendResponse({ status: 'ok' });
      break;
    }
    case 'taskAction': {
      const actionPlanId = sender.tab ? tabToPlanId.get(sender.tab.id) : null;
      handleTaskAction(
        message.stepAction,
        message.label,
        message.detail,
        message.url,
        actionPlanId,
        message.validationStatus || '',
        message.validationScope || ''
      );
      sendResponse({ status: 'ok' });
      break;
    }
    case 'taskComplete': {
      const completedPlanId = sender.tab ? tabToPlanId.get(sender.tab.id) : null;
      handleTaskComplete(completedPlanId, sender.tab?.id);
      sendResponse({ status: 'ok' });
      break;
    }
    case 'stopAutomation': {
      // 来自 content.js overlay 的"停止运行"按钮
      const stoppedPlanId = sender.tab ? tabToPlanId.get(sender.tab.id) : null;
      if (stoppedPlanId) {
        cleanupDirectPlan(stoppedPlanId, sender.tab.id);
        addTaskLog(`养号任务已手动停止 (计划: ${stoppedPlanId})`);
        broadcastToExtensionPages({ type: 'stopOpenClaw', planId: stoppedPlanId });
      }
      sendResponse({ status: 'ok' });
      break;
    }
  }
  return true;
});

// ========== Broadcast Helpers ==========
function broadcastToExtensionPages(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function sendToXhsTabs(msg) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  } catch {}
}

// ========== 双路径 Task Start ==========
async function startTask(planId) {
  if (!planId) return;
  runningPlanIds.add(planId);
  await syncRunningState();

  // 从 storage 加载计划
  const data = await chrome.storage.local.get([
    'plans',
    'aiConfig',
    'exploreConfig',
    'commentZoneConfig',
    'profileConfig',
    'targetProfiles',
  ]);
  const plans = data.plans || [];
  const plan = plans.find(p => p.id === planId);

  if (!plan) {
    addTaskLog(`计划未找到: ${planId}`);
    runningPlanIds.delete(planId);
    await syncRunningState();
    return;
  }

  if (plan.skill) {
    // ═══ 运营计划：OpenClaw AI 路径 ═══
    addTaskLog(`AI 运营任务已开始: ${plan.name}`);
    broadcastToExtensionPages({ type: 'startOpenClaw', planId });
    sendToXhsTabs({ action: 'xhsOverlay', cmd: 'show' });
  } else {
    // ═══ 养号计划：直接脚本路径 ═══
    addTaskLog(`养号任务已开始: ${plan.name}`);
    await resetValidationSummary(planId, plan.name);
    await startDirectAutomation(planId, plan, data);
  }
}

// ========== 直接脚本自动化 ==========
async function startDirectAutomation(planId, plan, config = {}) {
  try {
    const rules = planToRules(plan, config);
    const targetUrl = resolvePlanTargetUrl(plan, config);
    const tab = await findOrCreateXhsTab(targetUrl, rules.mode);

    tabToPlanId.set(tab.id, planId);
    planToTab.set(planId, tab.id);

    // 检测 content script 是否已注入
    let alreadyInjected = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      alreadyInjected = true;
    } catch {}

    if (!alreadyInjected) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['api.js', 'history.js', 'content.js'],
      });
      // 等待脚本初始化
      await new Promise(r => setTimeout(r, 500));
    }

    await chrome.tabs.sendMessage(tab.id, { action: 'startAutomation', rules });
    addTaskLog(`养号脚本已启动 (${plan.name})`);
  } catch (err) {
    addTaskLog(`养号启动失败: ${err.message}`);
    cleanupDirectPlan(planId);
  }
}

async function findOrCreateXhsTab(targetUrl = '', mode = 'explore') {
  const tabs = await chrome.tabs.query({ url: ['https://www.xiaohongshu.com/*', 'https://xhslink.com/*'] });
  const hasProfileTab = tabs.some(tab => /\/user\/profile\//.test(tab.url || ''));

  if (mode === 'profile' && !targetUrl && !hasProfileTab) {
    throw new Error('主页模式需要先配置目标主页，或手动打开一个小红书博主页标签页');
  }

  if (tabs.length > 0) {
    const preferred = selectPreferredTab(tabs, targetUrl, mode);
    await chrome.tabs.update(preferred.id, { active: true });
    await chrome.windows.update(preferred.windowId, { focused: true });

    if (shouldNavigateTab(preferred.url, targetUrl)) {
      const updated = await chrome.tabs.update(preferred.id, { url: targetUrl });
      await waitForTabComplete(updated.id);
      return updated;
    }
    return preferred;
  }

  const created = await chrome.tabs.create({
    url: targetUrl || 'https://www.xiaohongshu.com/explore',
    active: true,
  });

  await waitForTabComplete(created.id);

  return created;
}

// ========== 双路径 Task Stop ==========
async function stopTask(planId) {
  if (!planId) return;
  runningPlanIds.delete(planId);
  await syncRunningState();

  const tabId = planToTab.get(planId);
  if (tabId) {
    // 直接脚本路径：发 stopAutomation 给 content.js
    chrome.tabs.sendMessage(tabId, { action: 'stopAutomation' }).catch(() => {});
    tabToPlanId.delete(tabId);
    planToTab.delete(planId);
    addTaskLog(`养号任务已停止 (计划: ${planId})`);
  } else {
    // OpenClaw 路径
    broadcastToExtensionPages({ type: 'stopOpenClaw', planId });
    sendToXhsTabs({ action: 'xhsOverlay', cmd: 'hide' });
    addTaskLog(`AI 任务已停止 (计划: ${planId})`);
  }
}

// ========== Task Complete ==========
async function handleTaskComplete(planId, tabId) {
  if (planId) {
    runningPlanIds.delete(planId);
    if (tabId) tabToPlanId.delete(tabId);
    planToTab.delete(planId);
  }
  await syncRunningState();
  addTaskLog(`养号任务已完成${planId ? ` (计划: ${planId})` : ''}`);
  broadcastToExtensionPages({ type: 'taskComplete', planId: planId || null });
}

// ========== Cleanup Helpers ==========
function cleanupDirectPlan(planId, tabId) {
  runningPlanIds.delete(planId);
  if (tabId) tabToPlanId.delete(tabId);
  const mappedTabId = planToTab.get(planId);
  if (mappedTabId) tabToPlanId.delete(mappedTabId);
  planToTab.delete(planId);
  syncRunningState();
}

async function syncRunningState() {
  await chrome.storage.local.set({
    isRunning: runningPlanIds.size > 0,
    runningPlanIds: [...runningPlanIds],
  });
}

// 标签页关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  const planId = tabToPlanId.get(tabId);
  if (planId) {
    cleanupDirectPlan(planId, tabId);
    addTaskLog(`标签页关闭，养号任务已中断 (计划: ${planId})`);
    broadcastToExtensionPages({ type: 'stopOpenClaw', planId });
  }
});

// ========== Task Logging ==========
async function addTaskLog(message) {
  const data = await chrome.storage.local.get(['taskLog']);
  const log = data.taskLog || [];
  log.unshift({ time: new Date().toISOString(), message });
  if (log.length > 200) log.length = 200;
  await chrome.storage.local.set({ taskLog: log });
  broadcastToExtensionPages({ type: 'taskLog', message });
}

async function resetValidationSummary(planId, planName) {
  if (!planId) return;
  const data = await chrome.storage.local.get(['taskValidationSummary', 'taskValidationEvents']);
  const summaryMap = data.taskValidationSummary || {};
  const eventMap = data.taskValidationEvents || {};
  summaryMap[planId] = createValidationSummary(planName);
  eventMap[planId] = [];
  await chrome.storage.local.set({
    taskValidationSummary: summaryMap,
    taskValidationEvents: eventMap,
  });
  broadcastToExtensionPages({
    type: 'taskValidation',
    planId,
    summary: summaryMap[planId],
    events: [],
  });
}

async function recordValidationEvent(planId, payload = {}) {
  if (!planId || !payload.validationStatus) return;

  const data = await chrome.storage.local.get(['taskValidationSummary', 'taskValidationEvents']);
  const summaryMap = data.taskValidationSummary || {};
  const eventMap = data.taskValidationEvents || {};
  const summary = summaryMap[planId] || createValidationSummary();
  const now = new Date().toISOString();

  if (payload.validationStatus === 'ok') {
    summary.passed += 1;
  } else if (payload.validationStatus === 'fail') {
    summary.failed += 1;
    summary.lastFailure = payload.detail || payload.label || payload.stepAction || '未知失败';
    addTaskLog(`[验证失败] ${summary.lastFailure}`);
  }

  summary.lastEvent = payload.detail || payload.label || payload.stepAction || '';
  summary.updatedAt = now;
  summaryMap[planId] = summary;

  const events = eventMap[planId] || [];
  events.unshift({
    time: now,
    action: payload.stepAction || '',
    label: payload.label || '',
    detail: payload.detail || '',
    status: payload.validationStatus,
    scope: payload.validationScope || '',
    url: payload.url || '',
  });
  if (events.length > MAX_VALIDATION_EVENTS) events.length = MAX_VALIDATION_EVENTS;
  eventMap[planId] = events;

  await chrome.storage.local.set({
    taskValidationSummary: summaryMap,
    taskValidationEvents: eventMap,
  });

  broadcastToExtensionPages({
    type: 'taskValidation',
    planId,
    summary,
    events,
  });
}

// ========== Stats ==========
async function updateStats(type) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await chrome.storage.local.get(['todayStats', 'todayDate', 'stats', 'dailyHistory']);

  let todayStats = data.todayStats || { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };
  let totalStats = data.stats || { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };
  let dailyHistory = data.dailyHistory || {};

  if (data.todayDate !== today) {
    todayStats = { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };
  }

  todayStats[type] = (todayStats[type] || 0) + 1;
  totalStats[type] = (totalStats[type] || 0) + 1;

  if (!dailyHistory[today]) {
    dailyHistory[today] = { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };
  }
  dailyHistory[today][type] = (dailyHistory[today][type] || 0) + 1;

  // 清理 90 天前的历史
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  for (const dateKey of Object.keys(dailyHistory)) {
    if (dateKey < cutoffStr) delete dailyHistory[dateKey];
  }

  await chrome.storage.local.set({ todayStats, todayDate: today, stats: totalStats, dailyHistory });
  return { todayStats, totalStats };
}

async function handleStatUpdate(type, logMessage, planId) {
  if (!type) return;
  const result = await updateStats(type);
  if (result?.todayStats) {
    broadcastToExtensionPages({ type: 'taskStats', stats: result.todayStats, planId: planId || null });
    sendToXhsTabs({ action: 'xhsOverlay', cmd: 'stat', statType: type });
  }
  if (logMessage) {
    await addTaskLog(logMessage);
  }
}

function handleTaskAction(stepAction, label, detail, url, planId, validationStatus = '', validationScope = '') {
  broadcastToExtensionPages({
    type: 'taskAction',
    action: stepAction || 'action',
    label: label || stepAction || 'action',
    detail: detail || '',
    url: url || '',
    planId: planId || null,
    validationStatus: validationStatus || '',
    validationScope: validationScope || '',
  });
  if (validationStatus) {
    recordValidationEvent(planId, {
      stepAction,
      label,
      detail,
      url,
      validationStatus,
      validationScope,
    });
  }
}

// ========== Scheduled Tasks (chrome.alarms API) ==========

chrome.runtime.onInstalled.addListener(() => {
  setupScheduledAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  setupScheduledAlarms();
});

async function setupScheduledAlarms() {
  await chrome.alarms.clearAll();

  const data = await chrome.storage.local.get(['schedule']);
  const schedule = data.schedule || { enabled: false, times: [], repeatDays: [] };

  if (!schedule.enabled || !schedule.times || schedule.times.length === 0) {
    return;
  }

  for (let i = 0; i < schedule.times.length; i++) {
    const timeStr = schedule.times[i];
    const [hours, minutes] = timeStr.split(':').map(Number);

    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);

    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }

    chrome.alarms.create(`ysh-schedule-${i}`, {
      when: alarmTime.getTime(),
      periodInMinutes: 24 * 60,
    });
  }

  addTaskLog(`已设置 ${schedule.times.length} 个定时任务`);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('ysh-schedule-')) return;

  const data = await chrome.storage.local.get(['schedule', 'plans']);
  const schedule = data.schedule || { enabled: false, repeatDays: [] };

  if (!schedule.enabled) return;

  const today = new Date().getDay();
  if (schedule.repeatDays && schedule.repeatDays.length > 0) {
    if (!schedule.repeatDays.includes(today)) return;
  }

  // 优先用配置的 planId，否则取第一个养号计划
  const planId = schedule.planId
    || (data.plans || []).find(p => !p.skill)?.id;
  if (!planId) return;

  addTaskLog(`定时任务触发: ${alarm.name}`);
  await startTask(planId);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.schedule) {
    setupScheduledAlarms();
  }
});
