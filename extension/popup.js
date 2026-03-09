const modeLabels = {
  explore: '发现页',
  'comment-zone': '评论区',
  profile: '主页',
};

const statusLabels = {
  running: '运行中',
  completed: '已完成',
  stopped: '已停止',
  error: '异常中断',
  idle: '待启动',
};

const state = {
  plans: [],
  taskExecutionLogs: [],
  todayStats: { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 },
  runningPlanIds: [],
  query: '',
  filter: 'all',
  sort: 'recent',
};

const els = {
  search: document.getElementById('search-input'),
  filter: document.getElementById('filter-select'),
  sort: document.getElementById('sort-select'),
  taskList: document.getElementById('task-list'),
  listMeta: document.getElementById('list-meta'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  summaryPlans: document.getElementById('summary-plans'),
  summaryRunning: document.getElementById('summary-running'),
  summaryBrowse: document.getElementById('summary-browse'),
  summaryLike: document.getElementById('summary-like'),
  settingsBtn: document.getElementById('btn-settings'),
};

els.settingsBtn.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.openOptionsPage();
  }
});

els.search.addEventListener('input', (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.filter.addEventListener('change', (event) => {
  state.filter = event.target.value;
  render();
});

els.sort.addEventListener('change', (event) => {
  state.sort = event.target.value;
  render();
});

els.taskList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const planId = button.dataset.planId;
  if (!planId) return;

  if (action === 'open-settings') {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.openOptionsPage();
    }
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.runtime) return;

  button.disabled = true;
  try {
    await chrome.runtime.sendMessage({
      action: action === 'start' ? 'startTask' : 'stopTask',
      planId,
    });
    await loadData();
  } finally {
    button.disabled = false;
  }
});

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (['startOpenClaw', 'stopOpenClaw', 'taskStats', 'taskLog', 'taskAction'].includes(message.type)) {
      loadData();
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.plans || changes.taskExecutionLogs || changes.todayStats || changes.runningPlanIds || changes.isRunning) {
      loadData();
    }
  });
}

function normalizeLogs(logs) {
  return (Array.isArray(logs) ? logs : []).map((log) => {
    if (!log || typeof log !== 'object') return log;
    return log.status === 'running' ? { ...log, status: 'stopped' } : log;
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatMode(mode) {
  return modeLabels[mode] || mode || '未分类';
}

function formatRelativeTime(isoTime) {
  if (!isoTime) return '暂无执行记录';
  const date = new Date(isoTime);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function getLatestLog(planName) {
  return state.taskExecutionLogs.find((log) => log && log.planName === planName) || null;
}

function derivePlanView(plan) {
  const latestLog = getLatestLog(plan.name);
  const isRunning = state.runningPlanIds.includes(plan.id);
  const status = isRunning ? 'running' : (latestLog?.status || 'idle');
  const lastRunAt = latestLog?.startTime || null;
  const stats = {
    browse: latestLog?.browse || 0,
    like: latestLog?.like || 0,
    collect: latestLog?.collect || 0,
    comment: latestLog?.comment || 0,
  };

  return {
    ...plan,
    latestLog,
    isRunning,
    status,
    lastRunAt,
    stats,
  };
}

function matchFilter(item) {
  if (state.filter === 'all') return true;
  if (state.filter === 'running') return item.status === 'running';
  if (state.filter === 'idle') return ['idle', 'stopped', 'completed'].includes(item.status);
  if (state.filter === 'error') return item.status === 'error';
  return true;
}

function matchQuery(item) {
  if (!state.query) return true;
  const haystack = [
    item.name,
    formatMode(item.mode),
    statusLabels[item.status] || item.status,
  ].join(' ').toLowerCase();
  return haystack.includes(state.query);
}

function sortItems(items) {
  const sorted = [...items];
  if (state.sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return sorted;
  }
  if (state.sort === 'mode') {
    sorted.sort((a, b) => formatMode(a.mode).localeCompare(formatMode(b.mode), 'zh-CN'));
    return sorted;
  }
  sorted.sort((a, b) => {
    const aTime = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const bTime = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    if (a.isRunning !== b.isRunning) return a.isRunning ? -1 : 1;
    return bTime - aTime;
  });
  return sorted;
}

function renderSummary(items) {
  const runningCount = items.filter((item) => item.isRunning).length;
  els.summaryPlans.textContent = formatNumber(state.plans.length);
  els.summaryRunning.textContent = formatNumber(runningCount);
  els.summaryBrowse.textContent = formatNumber(state.todayStats.browse);
  els.summaryLike.textContent = formatNumber(state.todayStats.like);

  if (runningCount > 0) {
    els.heroSubtitle.textContent = `当前有 ${runningCount} 个计划正在执行，列表已同步最近一次状态与产出。`;
    return;
  }

  if (state.plans.length === 0) {
    els.heroSubtitle.textContent = '还没有计划，去设置页创建第一个养号任务。';
    return;
  }

  els.heroSubtitle.textContent = '按计划维度查看状态、最近执行结果和今日核心数据。';
}

function createCard(item) {
  const card = document.createElement('article');
  card.className = `task-card ${item.isRunning ? 'running' : ''}`;

  const statusClass = ['running', 'error', 'stopped'].includes(item.status) ? item.status : (item.status === 'idle' ? 'idle' : 'stopped');
  const latestLabel = item.latestLog
    ? `<strong>${statusLabels[item.status] || item.status}</strong> · ${formatRelativeTime(item.lastRunAt)}`
    : '<strong>暂无执行记录</strong> · 可直接启动';

  const duration = item.latestLog?.duration ? `${item.latestLog.duration} 秒` : '--';
  const primaryAction = item.isRunning
    ? `<button class="btn btn-danger" data-action="stop" data-plan-id="${item.id}">停止</button>`
    : `<button class="btn btn-primary" data-action="start" data-plan-id="${item.id}">启动</button>`;

  card.innerHTML = `
    <div class="task-top">
      <div class="task-title-wrap">
        <div class="task-mode">◌ ${formatMode(item.mode)}</div>
        <div class="task-name">${escapeHtml(item.name)}</div>
        <div class="task-desc">目标浏览 ${formatNumber(item.browseCount || 0)} 篇 · 点赞 ${formatNumber(item.likeProbability || 0)}% · 收藏 ${formatNumber(item.collectProbability || 0)}%</div>
      </div>
      <div class="task-status ${statusClass}">${statusLabels[item.status] || item.status}</div>
    </div>
    <div class="task-data">
      <div class="pill">
        <strong>${formatNumber(item.stats.browse)}</strong>
        <span>浏览</span>
      </div>
      <div class="pill">
        <strong>${formatNumber(item.stats.like)}</strong>
        <span>点赞</span>
      </div>
      <div class="pill">
        <strong>${formatNumber(item.stats.collect)}</strong>
        <span>收藏</span>
      </div>
      <div class="pill">
        <strong>${duration}</strong>
        <span>耗时</span>
      </div>
    </div>
    <div class="task-footer">
      <div class="task-last">${latestLabel}</div>
      <div class="task-actions">
        <button class="btn btn-ghost" data-action="open-settings" data-plan-id="${item.id}" title="打开设置">⋯</button>
        ${primaryAction}
      </div>
    </div>
  `;

  return card;
}

function renderEmpty() {
  els.taskList.innerHTML = `
    <div class="empty-state">
      <strong>没有匹配的计划</strong>
      试试清空搜索条件，或者去设置页新建一个任务计划。
    </div>
  `;
}

function render() {
  const derived = state.plans.map(derivePlanView);
  const visible = sortItems(derived.filter((item) => matchFilter(item) && matchQuery(item)));

  renderSummary(derived);
  els.listMeta.textContent = `${visible.length} / ${state.plans.length} 个计划`;

  els.taskList.innerHTML = '';
  if (visible.length === 0) {
    renderEmpty();
    return;
  }

  visible.forEach((item) => {
    els.taskList.appendChild(createCard(item));
  });
}

async function getStatusFromBackground() {
  if (typeof chrome === 'undefined' || !chrome.runtime) return [];
  try {
    const result = await chrome.runtime.sendMessage({ action: 'getStatus' });
    return Array.isArray(result?.runningPlanIds) ? result.runningPlanIds : [];
  } catch {
    return [];
  }
}

async function loadData() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  const data = await chrome.storage.local.get([
    'plans',
    'todayStats',
    'runningPlanIds',
    'taskExecutionLogs',
  ]);

  const backgroundRunningIds = await getStatusFromBackground();
  state.plans = Array.isArray(data.plans) ? data.plans : [];
  state.todayStats = data.todayStats || { browse: 0, like: 0, collect: 0, comment: 0, follow: 0 };
  state.taskExecutionLogs = normalizeLogs(data.taskExecutionLogs || []);
  state.runningPlanIds = Array.from(new Set([...(data.runningPlanIds || []), ...backgroundRunningIds]));

  render();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

loadData();
