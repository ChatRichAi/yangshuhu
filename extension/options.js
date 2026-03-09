// ========== Tab Navigation ==========
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// ========== Storage Helpers ==========
function getStorage(keys) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(keys, resolve);
    } else {
      const result = {};
      keys.forEach(key => {
        const val = localStorage.getItem(key);
        result[key] = val ? JSON.parse(val) : null;
      });
      resolve(result);
    }
  });
}

function setStorage(data) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(data, resolve);
    } else {
      Object.entries(data).forEach(([key, val]) => {
        localStorage.setItem(key, JSON.stringify(val));
      });
      resolve();
    }
  });
}

// ========== Utility ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:#1a1a1a;color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:1000;animation:fadeIn 0.3s ease;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function setupSlider(id) {
  const slider = document.getElementById(id);
  const display = document.getElementById(`${id}-val`);
  if (!slider || !display) return;
  const update = () => { display.textContent = `${slider.value}%`; };
  slider.addEventListener('input', update);
  update();
}

let openCustomSelect = null;

function closeCustomSelect(dropdown) {
  if (!dropdown) return;
  dropdown.classList.remove('open');
  const trigger = dropdown.querySelector('.custom-select-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (openCustomSelect === dropdown) openCustomSelect = null;
}

function closeAllCustomSelects(except = null) {
  document.querySelectorAll('.custom-select.open').forEach(dropdown => {
    if (dropdown !== except) closeCustomSelect(dropdown);
  });
}

function syncCustomSelect(select) {
  const dropdown = select?._customDropdown;
  if (!dropdown) return;

  const selectedOption = select.options[select.selectedIndex];
  const valueEl = dropdown.querySelector('.custom-select-value');
  if (valueEl) valueEl.textContent = selectedOption ? selectedOption.textContent : '';

  dropdown.querySelectorAll('.custom-select-option').forEach(optionEl => {
    optionEl.classList.toggle('is-selected', optionEl.dataset.value === select.value);
    optionEl.setAttribute('aria-selected', optionEl.dataset.value === select.value ? 'true' : 'false');
  });
}

function createCustomSelect(select) {
  if (!select || select.dataset.customSelectReady === 'true') return;

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${select.id}-menu`);

  const value = document.createElement('span');
  value.className = 'custom-select-value';
  trigger.appendChild(value);

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.id = `${select.id}-menu`;
  menu.setAttribute('role', 'listbox');

  Array.from(select.options).forEach(option => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'custom-select-option';
    optionButton.textContent = option.textContent;
    optionButton.dataset.value = option.value;
    optionButton.setAttribute('role', 'option');
    optionButton.setAttribute('aria-selected', option.selected ? 'true' : 'false');

    if (option.disabled) {
      optionButton.disabled = true;
      optionButton.setAttribute('aria-disabled', 'true');
    }

    optionButton.addEventListener('click', () => {
      if (select.value !== option.value) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        syncCustomSelect(select);
      }
      closeCustomSelect(wrapper);
      trigger.focus();
    });

    menu.appendChild(optionButton);
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !wrapper.classList.contains('open');
    closeAllCustomSelects(wrapper);
    wrapper.classList.toggle('open', willOpen);
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    openCustomSelect = willOpen ? wrapper : null;
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!wrapper.classList.contains('open')) {
        trigger.click();
      }
      const current = menu.querySelector('.custom-select-option.is-selected') || menu.querySelector('.custom-select-option');
      current?.focus();
    }
    if (event.key === 'Escape') {
      closeCustomSelect(wrapper);
    }
  });

  menu.addEventListener('keydown', (event) => {
    const options = Array.from(menu.querySelectorAll('.custom-select-option:not(:disabled)'));
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[(currentIndex + 1 + options.length) % options.length]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[(currentIndex - 1 + options.length) % options.length]?.focus();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomSelect(wrapper);
      trigger.focus();
    }
  });

  select.classList.add('custom-select-native');
  select.dataset.customSelectReady = 'true';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  wrapper.appendChild(select);

  select._customDropdown = wrapper;
  select.addEventListener('change', () => syncCustomSelect(select));
  syncCustomSelect(select);
}

function initPlanEditorCustomSelects() {
  document.querySelectorAll('#plan-editor-modal select').forEach(createCustomSelect);
}

function syncPlanEditorCustomSelects() {
  document.querySelectorAll('#plan-editor-modal select').forEach(syncCustomSelect);
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.custom-select')) closeAllCustomSelects();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openCustomSelect) closeAllCustomSelects();
});

// Setup all sliders
['explore-like-prob','explore-collect-prob','explore-comment-prob','explore-follow-prob',
 'cz-like-comment-prob','cz-reply-prob',
 'profile-like-prob','profile-collect-prob','profile-comment-prob',
 'plan-like-prob','plan-collect-prob','plan-comment-prob','plan-follow-prob'
].forEach(setupSlider);

// AI style grid
document.querySelectorAll('#ai-style-grid .style-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#ai-style-grid .style-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  });
});

// ================================================================
// PLANS MANAGEMENT
// ================================================================
let plans = [];
let editingPlanIndex = -1;
let activePlanId = null;
let taskValidationSummary = {};
let taskValidationEvents = {};

const modeLabels = { explore: '发现页', 'comment-zone': '评论区', profile: '主页' };
// ── Dynamic skill form rendering (driven by skill-registry.js) ──

function getPersonaDisplayText(candidate) {
  return (
    candidate?.full_text
    || `${candidate?.title || ''} - ${candidate?.description || candidate?.text || ''}`
  ).trim();
}

function renderPersonaCards({ container, input, hint, suggestions, strategy, scene, rerender }) {
  if (!container || !input || !hint) return;

  container.innerHTML = '';
  const state = container._personaState || { aiEnabled: true, loading: false };

  const toolbar = document.createElement('div');
  toolbar.className = 'persona-suggestions-toolbar';
  const status = document.createElement('div');
  status.className = 'persona-suggestions-status';
  status.textContent = state.loading
    ? '正在生成 AI 推荐...'
    : strategy === 'rule_plus_ai'
      ? '当前展示 AI 优化结果'
      : '当前展示默认推荐';
  const actions = document.createElement('div');
  actions.className = 'persona-suggestions-actions';

  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.className = 'persona-action-btn';
  shuffleBtn.textContent = '换一批';
  shuffleBtn.addEventListener('click', () => {
    const nextState = container._personaState || {};
    nextState.variant = (nextState.variant || 0) + 1;
    container._personaState = nextState;
    rerender({ forceRefresh: false });
  });

  const aiBtn = document.createElement('button');
  aiBtn.type = 'button';
  aiBtn.className = 'persona-action-btn is-primary';
  aiBtn.textContent = 'AI 优化';
  aiBtn.addEventListener('click', () => {
    container._personaState = { ...(container._personaState || {}), aiEnabled: true };
    rerender({ forceRefresh: true, aiOnly: true });
  });

  actions.appendChild(shuffleBtn);
  actions.appendChild(aiBtn);
  toolbar.appendChild(status);
  toolbar.appendChild(actions);
  container.appendChild(toolbar);

  suggestions.forEach((suggestion, index) => {
    const description = suggestion.description || suggestion.text || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'persona-suggestion';
    button.dataset.personaValue = getPersonaDisplayText(suggestion);
    const sourceLabel = suggestion.source === 'ai' ? 'AI 推荐' : suggestion.source === 'hybrid' ? 'AI 优化' : '默认推荐';
    const tags = (suggestion.tags || []).slice(0, 2);
    button.innerHTML = `
      <span class="persona-suggestion-title">${escapeHtml(suggestion.title)}</span>
      <span class="persona-suggestion-desc">${escapeHtml(description)}</span>
      <span class="persona-suggestion-meta">
        <span class="persona-suggestion-badge">${escapeHtml(sourceLabel)}</span>
        ${tags.map(tag => `<span class="persona-suggestion-tag">${escapeHtml(tag)}</span>`).join('')}
      </span>
    `;
    button.addEventListener('click', () => {
      input.value = button.dataset.personaValue;
      input.dataset.autofilled = 'false';
      rerender();
      input.focus();
    });
    if (index === 0 && (!input.value.trim() || input.dataset.autofilled === 'true')) {
      input.value = button.dataset.personaValue;
      input.dataset.autofilled = 'true';
    }
    container.appendChild(button);
  });

  container.querySelectorAll('.persona-suggestion').forEach(button => {
    button.classList.toggle('is-active', input.value.trim() === button.dataset.personaValue);
  });

  if (!suggestions.length) {
    hint.textContent = scene === 'comment_persona'
      ? '可以直接输入你希望 AI 在评论区扮演的身份和语气。'
      : '可以直接输入你希望账号呈现的人设，例如语气、身份、内容视角。';
    return;
  }

  hint.textContent = strategy === 'rule_plus_ai'
    ? '已基于当前配置给出默认推荐，并由 AI 做了增强优化；你也可以直接自定义输入。'
    : '已根据当前配置生成默认推荐；若账号已配置 API Key，会自动尝试 AI 优化。';
}

async function getRecommendationApiSettings() {
  try {
    const data = await getStorage(['apiKey', 'apiBaseUrl']);
    return {
      apiKey: data.apiKey || '',
      apiBaseUrl: data.apiBaseUrl || '',
    };
  } catch (error) {
    console.warn('[PersonaRecommendation] failed to load API settings', error);
    return { apiKey: '', apiBaseUrl: '' };
  }
}

function requestPersonaEnhancement({ container, input, hint, context, rerender, forceRefresh = false, aiOnly = false }) {
  if (!window.PersonaRecommendationService) {
    hint.textContent = '推荐服务未就绪，请刷新页面后重试。';
    return;
  }

  const state = container._personaState || { variant: 0, aiEnabled: true };
  container._personaState = state;
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  container.dataset.requestId = requestId;
  state.loading = false;
  const requestContext = { ...context, variant: state.variant || 0 };
  const localRecommendations = window.PersonaRecommendationService.getRuleRecommendations(requestContext);
  renderPersonaCards({
    container,
    input,
    hint,
    suggestions: localRecommendations,
    strategy: 'rule_only',
    scene: requestContext.scene,
    rerender,
  });

  clearTimeout(container._recommendationTimer);
  container._recommendationTimer = setTimeout(async () => {
    const apiSettings = await getRecommendationApiSettings();
    if (!apiSettings.apiKey && !aiOnly) return;
    if (!apiSettings.apiKey && aiOnly) {
      state.loading = false;
      renderPersonaCards({
        container,
        input,
        hint,
        suggestions: localRecommendations,
        strategy: 'rule_only',
        scene: requestContext.scene,
        rerender,
      });
      showToast('未配置 API Key，已继续使用默认推荐');
      return;
    }
    state.loading = true;
    renderPersonaCards({
      container,
      input,
      hint,
      suggestions: localRecommendations,
      strategy: 'rule_only',
      scene: requestContext.scene,
      rerender,
    });
    try {
      const response = await window.PersonaRecommendationService.getRecommendations(requestContext, { ...apiSettings, forceRefresh });
      if (container.dataset.requestId !== requestId) return;
      state.loading = false;
      renderPersonaCards({
        container,
        input,
        hint,
        suggestions: response.recommendations,
        strategy: response.strategy,
        scene: requestContext.scene,
        rerender,
      });
    } catch (error) {
      if (container.dataset.requestId !== requestId) return;
      console.warn('[PersonaRecommendation] enhancement failed, fallback to rule', error);
      state.loading = false;
      renderPersonaCards({
        container,
        input,
        hint,
        suggestions: localRecommendations,
        strategy: 'rule_only',
        scene: requestContext.scene,
        rerender,
      });
    }
  }, 360);
}

function renderCommentPersonaSuggestions(options = {}) {
  const container = document.getElementById('plan-comment-persona-suggestions');
  const input = document.getElementById('plan-comment-persona');
  const hint = document.getElementById('plan-comment-persona-hint');
  if (!container || !input || !hint) return;

  requestPersonaEnhancement({
    container,
    input,
    hint,
    context: {
      scene: 'comment_persona',
      skill: document.getElementById('plan-skill').value,
      mode: document.getElementById('plan-mode').value,
      tone: document.getElementById('plan-comment-tone').value,
      existingPersona: input.value.trim(),
    },
    rerender: renderCommentPersonaSuggestions,
    forceRefresh: options.forceRefresh === true,
    aiOnly: options.aiOnly === true,
  });
}

function populateSkillSelect() {
  const select = document.getElementById('plan-skill');
  while (select.options.length > 1) select.remove(1);
  (window.SKILL_REGISTRY || []).forEach(skill => {
    const opt = document.createElement('option');
    opt.value = skill.id;
    opt.textContent = skill.label;
    select.appendChild(opt);
  });
}

function renderSkillFields(skillId) {
  const container = document.getElementById('plan-skill-fields');
  const nurtureFields = document.getElementById('plan-nurture-fields');
  container.innerHTML = '';

  if (!skillId) {
    nurtureFields.style.display = '';
    container.style.display = 'none';
    return;
  }

  nurtureFields.style.display = 'none';
  container.style.display = '';

  const skill = SkillRegistry.get(skillId);
  if (!skill) return;

  skill.fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.dataset.skillField = field.key;

    if (field.showWhen) {
      group.dataset.showWhenField = field.showWhen.field;
      group.dataset.showWhenValue = field.showWhen.value;
      group.style.display = 'none';
    }

    const label = document.createElement('label');
    label.setAttribute('for', `skill-field-${field.key}`);
    label.textContent = field.label;
    group.appendChild(label);

    // Persona suggestions container (before input)
    if (field.hasSuggestions) {
      const sugContainer = document.createElement('div');
      sugContainer.className = 'persona-suggestions';
      sugContainer.id = `skill-suggestions-${field.key}`;
      group.appendChild(sugContainer);
    }

    let input;
    switch (field.type) {
      case 'select':
        input = document.createElement('select');
        input.id = `skill-field-${field.key}`;
        (field.options || []).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
        input.value = field.default || '';
        break;
      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.id = `skill-field-${field.key}`;
        input.value = field.default !== undefined ? field.default : 0;
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        break;
      case 'textarea':
        input = document.createElement('textarea');
        input.id = `skill-field-${field.key}`;
        input.className = 'textarea';
        input.rows = field.rows || 3;
        if (field.placeholder) input.placeholder = field.placeholder;
        break;
      default: // text
        input = document.createElement('input');
        input.type = 'text';
        input.id = `skill-field-${field.key}`;
        if (field.placeholder) input.placeholder = field.placeholder;
        break;
    }

    group.appendChild(input);

    if (field.hint) {
      const hint = document.createElement('p');
      hint.className = 'card-desc';
      hint.id = `skill-hint-${field.key}`;
      hint.style.cssText = 'margin-top:4px;font-size:12px';
      hint.textContent = field.hint;
      group.appendChild(hint);
    }

    container.appendChild(group);
  });

  // Apply showWhen rules and wire change listeners
  applyShowWhenRules(container);

  // Wire persona suggestion updates for fields that drive suggestions
  const suggestionFields = ['opsTask', 'opsVertical', 'opsVerticalCustom'];
  suggestionFields.forEach(key => {
    const el = container.querySelector(`#skill-field-${key}`);
    if (el) el.addEventListener('change', () => renderPersonaSuggestionsForSkill(skillId));
  });
  const customVerticalEl = container.querySelector('#skill-field-opsVerticalCustom');
  if (customVerticalEl) customVerticalEl.addEventListener('input', () => renderPersonaSuggestionsForSkill(skillId));

  // Wire persona input to track manual edits
  skill.fields.filter(f => f.hasSuggestions).forEach(f => {
    const el = container.querySelector(`#skill-field-${f.key}`);
    if (el) el.addEventListener('input', () => {
      el.dataset.autofilled = 'false';
      renderPersonaSuggestionsForSkill(skillId);
    });
  });

  // Create custom selects for dynamically added selects
  container.querySelectorAll('select').forEach(createCustomSelect);

  // Render initial persona suggestions
  renderPersonaSuggestionsForSkill(skillId);
}

function applyShowWhenRules(container) {
  const groups = container.querySelectorAll('[data-show-when-field]');
  groups.forEach(group => {
    const controlKey = group.dataset.showWhenField;
    const targetValue = group.dataset.showWhenValue;
    const controlEl = container.querySelector(`#skill-field-${controlKey}`);
    if (!controlEl) return;

    const update = () => {
      group.style.display = controlEl.value === targetValue ? '' : 'none';
    };
    update();
    controlEl.addEventListener('change', update);
  });
}

function renderPersonaSuggestionsForSkill(skillId, options = {}) {
  const skill = SkillRegistry.get(skillId);
  if (!skill) return;

  skill.fields.filter(f => f.hasSuggestions).forEach(field => {
    const sugContainer = document.getElementById(`skill-suggestions-${field.key}`);
    const input = document.getElementById(`skill-field-${field.key}`);
    const hint = document.getElementById(`skill-hint-${field.key}`);
    if (!sugContainer || !input) return;

    const task = document.getElementById('skill-field-opsTask')?.value || '';
    const vertical = document.getElementById('skill-field-opsVertical')?.value || '';
    const verticalCustom = document.getElementById('skill-field-opsVerticalCustom')?.value || '';

    requestPersonaEnhancement({
      container: sugContainer,
      input,
      hint,
      context: {
        scene: 'content_persona',
        skill: skillId,
        task,
        vertical,
        verticalCustom,
        existingPersona: input.value.trim(),
      },
      rerender: (nextOptions = {}) => renderPersonaSuggestionsForSkill(skillId, nextOptions),
      forceRefresh: options.forceRefresh === true,
      aiOnly: options.aiOnly === true,
    });
  });
}

function toggleSkillFields() {
  renderSkillFields(document.getElementById('plan-skill').value);
  renderCommentPersonaSuggestions();
}

function readSkillFieldValues(skillId) {
  const skill = SkillRegistry.get(skillId);
  if (!skill) return {};
  const values = {};
  skill.fields.forEach(field => {
    const el = document.getElementById(`skill-field-${field.key}`);
    if (!el) return;
    values[field.key] = field.type === 'number' ? (parseInt(el.value) || field.default || 0) : el.value;
  });
  return values;
}

function writeSkillFieldValues(skillId, plan) {
  const skill = SkillRegistry.get(skillId);
  if (!skill) return;
  skill.fields.forEach(field => {
    const el = document.getElementById(`skill-field-${field.key}`);
    if (!el) return;
    el.value = plan[field.key] !== undefined ? plan[field.key] : (field.default || '');
    if (el.tagName === 'SELECT') syncCustomSelect(el);
  });
  applyShowWhenRules(document.getElementById('plan-skill-fields'));
  renderPersonaSuggestionsForSkill(skillId);
}

document.getElementById('plan-skill').addEventListener('change', toggleSkillFields);
document.getElementById('plan-mode').addEventListener('change', renderCommentPersonaSuggestions);
document.getElementById('plan-comment-tone').addEventListener('change', renderCommentPersonaSuggestions);
document.getElementById('plan-comment-persona').addEventListener('input', () => {
  const input = document.getElementById('plan-comment-persona');
  input.dataset.autofilled = 'false';
  renderCommentPersonaSuggestions();
});
populateSkillSelect();
initPlanEditorCustomSelects();

async function loadPlans() {
  const data = await getStorage(['plans', 'activePlanId']);
  plans = data.plans || [];
  activePlanId = data.activePlanId || null;
  renderPlans();
  populatePlanSelects();
}

function renderPlans() {
  const list = document.getElementById('plans-list');
  const totalEl = document.getElementById('plans-summary-total');
  const runningEl = document.getElementById('plans-summary-running');
  const browseEl = document.getElementById('plans-summary-browse');
  const likeEl = document.getElementById('plans-summary-like');
  const subtitleEl = document.getElementById('plans-hero-subtitle');

  const runningCount = plans.filter(plan => isPlanRunning(plan.id)).length;
  const latestLogsByPlan = new Map();
  let totalBrowse = 0;
  let totalLike = 0;
  taskExecutionLogs.forEach((log) => {
    if (!log || !log.planName) return;
    if (!latestLogsByPlan.has(log.planName)) latestLogsByPlan.set(log.planName, log);
    totalBrowse += Number(log.browse || 0);
    totalLike += Number(log.like || 0);
  });

  if (totalEl) totalEl.textContent = plans.length;
  if (runningEl) runningEl.textContent = runningCount;
  if (browseEl) browseEl.textContent = totalBrowse;
  if (likeEl) likeEl.textContent = totalLike;
  if (subtitleEl) {
    subtitleEl.textContent = runningCount > 0
      ? `当前有 ${runningCount} 个计划正在执行，计划列表已同步最近一次执行结果。`
      : '按计划维度查看状态、最近执行结果和核心互动数据。';
  }

  if (plans.length === 0) {
    list.innerHTML = '<div class="plans-empty">还没有养号计划，点击「创建计划」开始</div>';
    return;
  }
  list.innerHTML = '';
  plans.forEach((plan, i) => {
    const running = isPlanRunning(plan.id);
    const viewing = plan.id === viewingPlanId;
    const latestLog = latestLogsByPlan.get(plan.name);
    const lastStatus = running ? '运行中' : (latestLog ? ({
      completed: '已完成',
      stopped: '已停止',
      error: '异常中断',
      running: '运行中',
    }[latestLog.status] || '待启动') : '待启动');
    const lastTime = latestLog?.startTime
      ? new Date(latestLog.startTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '暂无执行记录';
    const durationText = latestLog?.duration ? `${latestLog.duration} 秒` : '--';
    const div = document.createElement('div');
    div.className = `plan-card-item${running ? ' running' : ''}${viewing ? ' viewing' : ''}`;
    div.innerHTML = `
      <div class="plan-card-info">
        <div class="plan-card-head">
          <div>
            <div class="plan-mode-chip">◌ ${escapeHtml(modeLabels[plan.mode] || plan.mode)}${plan.nurturingPhase && !plan.skill ? ` · ${escapeHtml({'cold-start':'冷启动','daily':'日常','mature':'成熟期'}[plan.nurturingPhase] || plan.nurturingPhase)}` : ''}${plan.skill ? ` · ${escapeHtml(SkillRegistry.getLabel(plan.skill))}` : ''}</div>
            <div class="plan-card-name">${escapeHtml(plan.name)}</div>
          </div>
          ${running ? '<span class="plan-status-badge">运行中</span>' : ''}
        </div>
        <div class="plan-card-meta">
          ${(() => {
            const skillDef = plan.skill ? SkillRegistry.get(plan.skill) : null;
            if (skillDef && skillDef.cardMeta) {
              const util = { optionLabel: (f, v) => SkillRegistry.optionLabel(skillDef, f, v) };
              return skillDef.cardMeta(plan, util).map(t => `<span>${escapeHtml(t)}</span>`).join('\n               ');
            }
            return `<span>目标浏览 ${plan.browseCount} 篇</span>
               <span>点赞 ${plan.likeProbability}%</span>
               <span>收藏 ${plan.collectProbability}%</span>
               <span>评论 ${plan.commentProbability}%</span>`;
          })()}
        </div>
        <div class="plan-card-stats">
          <div class="plan-stat-pill">
            <strong>${latestLog?.browse || 0}</strong>
            <span>浏览</span>
          </div>
          <div class="plan-stat-pill">
            <strong>${latestLog?.like || 0}</strong>
            <span>点赞</span>
          </div>
          <div class="plan-stat-pill">
            <strong>${latestLog?.collect || 0}</strong>
            <span>收藏</span>
          </div>
          <div class="plan-stat-pill">
            <strong>${durationText}</strong>
            <span>耗时</span>
          </div>
        </div>
        <div class="plan-card-foot">
          <div class="plan-card-last"><strong>${lastStatus}</strong> · ${lastTime}</div>
        </div>
      </div>
      <div class="plan-card-actions">
        <button data-action="${running ? 'stop' : 'start'}" data-index="${i}" class="${running ? 'btn-plan-stop' : ''}" title="${running ? '停止' : '启动'}">${running ? '⏹' : '▶'}</button>
        ${running ? `<button data-action="view" data-index="${i}" class="${viewing ? 'btn-viewing' : ''}" title="查看实时画面">👁</button>` : ''}
        <button data-action="edit" data-index="${i}" title="编辑" ${running ? 'disabled' : ''}>✎</button>
        <button data-action="delete" data-index="${i}" title="删除" ${running ? 'disabled' : ''}>✕</button>
      </div>`;
    list.appendChild(div);
  });
}

function populatePlanSelects() {
  ['task-plan-select', 'schedule-plan-select'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- 请选择计划 --</option>';
    plans.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${modeLabels[p.mode] || p.mode})`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

document.getElementById('plans-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = parseInt(btn.dataset.index);
  const action = btn.dataset.action;
  const plan = plans[i];
  if (!plan) return;

  if (action === 'start') {
    if (runningPlans.size >= MAX_CONCURRENT_PLANS) {
      showToast(`最多同时运行 ${MAX_CONCURRENT_PLANS} 个计划`);
      return;
    }
    await startPlan(plan.id);
  } else if (action === 'stop') {
    await stopPlan(plan.id);
  } else if (action === 'view') {
    viewingPlanId = plan.id;
    updateLivePanelForPlan(plan.id);
    openPanel();
    renderPlans();
  } else if (action === 'edit') {
    if (isPlanRunning(plan.id)) { showToast('运行中的计划不可编辑'); return; }
    openPlanEditor(i);
  } else if (action === 'delete') {
    if (isPlanRunning(plan.id)) { showToast('运行中的计划不可删除'); return; }
    if (!confirm(`确定删除计划「${plan.name}」？`)) return;
    plans.splice(i, 1);
    await setStorage({ plans });
    renderPlans();
    populatePlanSelects();
  }
});

function planToRules(plan) {
  const base = { planName: plan.name, skill: plan.skill || '' };

  if (plan.skill) {
    // Registry-driven skill — collect all skill field values from plan
    const skillDef = SkillRegistry.get(plan.skill);
    if (skillDef) {
      const skillParams = {};
      skillDef.fields.forEach(f => {
        if (plan[f.key] !== undefined) skillParams[f.key] = plan[f.key];
      });
      return { ...base, ...skillParams };
    }
  }

  // Nurture skill (default) — send nurture parameters
  return {
    ...base,
    nurturingPhase: plan.nurturingPhase || 'daily',
    browseCount: plan.browseCount,
    browseInterval: plan.browseInterval,
    browseDuration: plan.browseDuration,
    likeProbability: plan.likeProbability,
    collectProbability: plan.collectProbability,
    commentProbability: plan.commentProbability,
    followProbability: plan.followProbability,
    keywordsInclude: plan.keywordsInclude || '',
    keywordsExclude: plan.keywordsExclude || '',
    mode: plan.mode,
    minLikes: plan.minLikes || 0,
    commentPersona: plan.commentPersona || '',
    commentTone: plan.commentTone || 'casual',
  };
}

// ================================================================
// MULTI-PLAN START / STOP / LIVE PANEL
// ================================================================

async function startPlan(planId) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  if (isPlanRunning(planId)) { showToast('该计划已在运行中'); return; }

  const sessionKey = getSessionKey(planId);
  const rules = planToRules(plan);

  // Create per-plan state
  const planState = {
    sessionKey,
    rules,
    startTime: Date.now(),
    lastActivityAt: Date.now(),
    retryCount: 0,
    pendingRetryTimer: null,
    handlingError: false,
    stats: { browse: 0, like: 0, collect: 0, follow: 0, comment: 0 },
    operationSteps: [],
    stepCounter: 0,
    logEntry: {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      planName: plan.name,
      startTime: new Date().toISOString(),
      duration: 0,
      browse: 0, like: 0, collect: 0, follow: 0, comment: 0,
      status: 'running',
    },
  };
  runningPlans.set(planId, planState);
  isRunning = true;
  taskExecutionLogs.unshift(planState.logEntry);
  renderTaskLogs();

  // Switch live panel to this plan
  viewingPlanId = planId;
  openPanel();
  document.body.classList.add('panel-running');
  document.getElementById('browser-placeholder').style.display = 'none';
  document.getElementById('browser-active').style.display = 'flex';
  document.getElementById('screenshot-loading').classList.remove('hidden');
  updateLivePanelForPlan(planId);
  renderPlans();

  // Add first chain step
  addPlanChainStep(planId, 'start', '任务启动', `AI 执行计划: ${plan.name}`);

  // Start screencast (shared — only if first plan)
  if (runningPlans.size === 1) startScreencast();

  // Connect bridge and start nurturing
  await startViaOpenClawForPlan(planId, rules);
}

async function stopPlan(planId, options = {}) {
  const planState = runningPlans.get(planId);
  if (!planState) return;

  const sessionKey = planState.sessionKey;
  const finalStatus = options.status || 'stopped';
  const finalDetail = options.detail || (finalStatus === 'error' ? '任务异常中断' : '养号已暂停');

  if (planState.pendingRetryTimer) {
    clearTimeout(planState.pendingRetryTimer);
    planState.pendingRetryTimer = null;
  }
  planState.handlingError = false;

  // Finalize log
  if (planState.logEntry) {
    planState.logEntry.status = finalStatus;
    planState.logEntry.duration = Math.round((Date.now() - planState.startTime) / 1000);
    Object.assign(planState.logEntry, planState.stats);
    setStorage({ taskExecutionLogs });
    renderTaskLogs();
  }

  if (finalStatus === 'error') {
    addPlanChainStep(planId, 'error', '任务中断', finalDetail);
  } else {
    addPlanChainStep(planId, 'stop', '任务停止', finalDetail);
  }

  // Stop this session on bridge
  if (bridge && !options.skipAbort) {
    bridge.stopNurturing(sessionKey).catch(() => {});
  }

  runningPlans.delete(planId);
  isRunning = isAnyPlanRunning();

  // If this was the viewed plan, switch to another running plan or close
  if (viewingPlanId === planId) {
    const remaining = [...runningPlans.keys()];
    if (remaining.length > 0) {
      viewingPlanId = remaining[0];
      updateLivePanelForPlan(viewingPlanId);
    } else {
      viewingPlanId = null;
      document.body.classList.remove('panel-running');
      stopScreencast();
      // Disconnect bridge only when all plans stopped
      if (bridge) bridge.disconnect();
    }
  }

  // If no plans running, clean up
  if (!isAnyPlanRunning()) {
    document.body.classList.remove('panel-running');
    stopScreencast();
    if (bridge) bridge.disconnect();
  }

  renderPlans();
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ action: 'stopTask', planId });
  }
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      reject(new Error('Chrome tabs API unavailable'));
      return;
    }
    chrome.tabs.query(queryInfo, (tabs) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message || 'Query tabs failed'));
        return;
      }
      resolve(tabs || []);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message || 'Update tab failed'));
        return;
      }
      resolve(tab);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message || 'Create tab failed'));
        return;
      }
      resolve(tab);
    });
  });
}

function focusWindow(windowId) {
  return new Promise((resolve, reject) => {
    if (typeof windowId !== 'number' || !chrome.windows) {
      resolve();
      return;
    }
    chrome.windows.update(windowId, { focused: true }, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message || 'Focus window failed'));
        return;
      }
      resolve();
    });
  });
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (typeof tabId !== 'number') {
      reject(new Error('Invalid tab id'));
      return;
    }

    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (err) reject(err);
      else resolve(true);
    };

    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete' && /^https:\/\/(www\.)?xiaohongshu\.com\//.test(tab?.url || '')) {
        finish();
      }
    };

    const timer = setTimeout(() => {
      finish(new Error('等待小红书页面加载超时'));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        finish(new Error(err.message || 'Get tab failed'));
        return;
      }
      if (tab?.status === 'complete' && /^https:\/\/(www\.)?xiaohongshu\.com\//.test(tab.url || '')) {
        finish();
      }
    });
  });
}

async function ensureControllableXhsTab() {
  const existingTabs = await queryTabs({ url: ['https://www.xiaohongshu.com/*', 'https://xhslink.com/*'] });
  if (existingTabs.length > 0) {
    const preferred = existingTabs.find(tab => /^https:\/\/www\.xiaohongshu\.com\//.test(tab.url || '')) || existingTabs[0];
    await updateTab(preferred.id, { active: true });
    await focusWindow(preferred.windowId);
    if (/^https:\/\/xhslink\.com\//.test(preferred.url || '')) {
      await waitForTabComplete(preferred.id, 15000).catch(() => {});
    }
    return preferred;
  }

  const created = await createTab({ url: 'https://www.xiaohongshu.com/explore', active: true });
  await focusWindow(created.windowId);
  await waitForTabComplete(created.id, 15000);
  return created;
}

async function detectXhsLoginState(tabId) {
  if (typeof tabId !== 'number') {
    throw new Error('Invalid tab id');
  }
  if (typeof chrome === 'undefined' || !chrome.scripting) {
    throw new Error('Chrome scripting API unavailable');
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const text = document.body?.innerText || '';
      const loginSelectors = [
        '[class*="login"]',
        '[class*="signin"]',
        '[class*="sign-in"]',
        '[data-testid*="login"]',
        'button[aria-label*="登录"]',
        'button[aria-label*="log in"]',
      ];
      const loggedInSelectors = [
        'img[class*="avatar"]',
        '[class*="avatar"] img',
        'a[href*="/user/profile/"]',
        '[class*="user"] img',
        '[class*="profile"] img',
      ];

      const hasLoginElement = loginSelectors.some(selector => document.querySelector(selector));
      const hasLoggedInElement = loggedInSelectors.some(selector => document.querySelector(selector));
      const hasLoginText = /登录|注册|扫码登录|log in|sign in/i.test(text);
      const hasHomeSignals = /发现|关注|消息|我|首页/i.test(text);

      return {
        hasLoginElement,
        hasLoggedInElement,
        hasLoginText,
        hasHomeSignals,
        url: location.href,
      };
    },
  });

  const state = result?.result;
  if (!state) {
    throw new Error('无法检测小红书登录状态');
  }

  const loggedIn = state.hasLoggedInElement || (!state.hasLoginElement && !state.hasLoginText && state.hasHomeSignals);
  return { ...state, loggedIn };
}

async function startViaOpenClawForPlan(planId, rules) {
  if (!bridge) {
    await handlePlanRuntimeError(planId, { message: 'OpenClaw Bridge 未加载' });
    return;
  }

  try {
    const data = await getStorage(['openclawUrl', 'openclawToken']);
    const url = data.openclawUrl || 'ws://127.0.0.1:18789';
    const token = data.openclawToken || '';

    if (!token) {
      await handlePlanRuntimeError(planId, { message: '请先在账户设置中填写 Gateway Token' });
      return;
    }

    addPlanChainStep(planId, 'ai', '运行预检', '正在检查小红书可控页面...');
    const tab = await ensureControllableXhsTab();
    touchPlanActivity(planId);
    addPlanChainStep(planId, 'ai', '页面就绪', `已定位小红书标签页: ${tab.url || 'xiaohongshu.com'}`);

    addPlanChainStep(planId, 'ai', '登录检查', '正在检查小红书登录状态...');
    const loginState = await detectXhsLoginState(tab.id);
    if (!loginState.loggedIn) {
      throw new Error('Login required: XHS login not detected');
    }
    touchPlanActivity(planId);
    addPlanChainStep(planId, 'ai', '登录已确认', '已检测到小红书登录状态');

    if (!bridge.connected) {
      addPlanChainStep(planId, 'ai', 'OpenClaw', '正在连接 Gateway...');
      await bridge.connect(url, token);
    }

    updateOpenClawStatus('connected', 'AI 智能模式');
    addPlanChainStep(planId, 'ai', 'OpenClaw AI', '已连接，正在启动智能养号...');

    const sessionKey = getSessionKey(planId);
    await bridge.startNurturing(rules || {}, sessionKey);
    touchPlanActivity(planId);
  } catch (err) {
    await handlePlanRuntimeError(planId, err);
  }
}

async function handlePlanRuntimeError(planId, errLike) {
  const state = runningPlans.get(planId);
  if (!state || state.handlingError) return;
  state.handlingError = true;

  const raw = normalizeErrorMessage(errLike);
  const classified = classifyPlanError(raw);

  if (classified.retryable && state.retryCount < MAX_PLAN_RETRIES) {
    state.retryCount += 1;
    const delayMs = RETRY_BASE_DELAY_MS * state.retryCount;
    addPlanChainStep(
      planId,
      'retry',
      '自动重试',
      `${classified.userMessage}，${Math.round(delayMs / 1000)} 秒后第 ${state.retryCount} 次重试`
    );
    showToast(`计划异常，将自动重试（第 ${state.retryCount} 次）`);

    if (bridge) bridge.stopNurturing(state.sessionKey).catch(() => {});
    state.pendingRetryTimer = setTimeout(async () => {
      const latest = runningPlans.get(planId);
      if (!latest) return;
      latest.pendingRetryTimer = null;
      latest.handlingError = false;
      addPlanChainStep(planId, 'ai', '重试启动', '正在重新发起智能养号...');
      await startViaOpenClawForPlan(planId, latest.rules || {});
    }, delayMs);
    return;
  }

  const suffix = state.retryCount > 0 ? `（已重试 ${state.retryCount} 次）` : '';
  await stopPlan(planId, { status: 'error', detail: `${classified.userMessage}${suffix}` });
  showToast(`计划已中断: ${classified.userMessage}`);
}

// Per-plan chain step management
function addPlanChainStep(planId, type, label, detail) {
  const state = runningPlans.get(planId);
  if (!state) return;
  state.stepCounter++;
  const info = actionMap[type] || { icon: '🔹' };
  const step = { id: state.stepCounter, type, icon: info.icon, label, detail: detail || '', time: new Date(), status: 'active' };
  if (state.operationSteps.length > 0) {
    const prev = state.operationSteps[state.operationSteps.length - 1];
    if (prev.status === 'active') prev.status = 'done';
  }
  if (type === 'stop' || type === 'done') step.status = 'done';
  state.operationSteps.push(step);

  // Update UI only if this is the currently viewed plan
  if (planId === viewingPlanId) {
    operationSteps = state.operationSteps;
    stepCounter = state.stepCounter;
    renderChain();
    updateCurrentAction(type, detail);
    document.getElementById('chain-count').textContent = `${state.operationSteps.length} 步`;
  }
}

// Switch live panel to show a specific plan's data
function updateLivePanelForPlan(planId) {
  const state = runningPlans.get(planId);
  if (!state) return;

  // Update chain display
  operationSteps = state.operationSteps;
  stepCounter = state.stepCounter;
  renderChain();
  document.getElementById('chain-count').textContent = `${state.operationSteps.length} 步`;

  // Update stats display
  const s = state.stats;
  document.getElementById('task-browsed').textContent = s.browse || 0;
  document.getElementById('task-liked').textContent = s.like || 0;
  document.getElementById('task-collected').textContent = s.collect || 0;
  document.getElementById('task-commented').textContent = s.comment || 0;
  document.getElementById('task-followed').textContent = s.follow || 0;

  // Update panel title to show plan name
  const plan = plans.find(p => p.id === planId);
  const statusEl = document.getElementById('task-status');
  if (statusEl && plan) statusEl.textContent = `运行中 — ${plan.name}`;
  renderValidationSummary(planId);
  renderValidationEvents(planId);
}

document.getElementById('btn-create-plan').addEventListener('click', () => openPlanEditor(-1));

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  closeAllCustomSelects();
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function openPlanEditor(index) {
  editingPlanIndex = index;
  openModal('plan-editor-modal');
  document.getElementById('plan-editor-title').textContent = index === -1 ? '创建新计划' : '编辑计划';

  if (index >= 0) {
    const p = plans[index];
    document.getElementById('plan-name').value = p.name;
    document.getElementById('plan-mode').value = p.mode;
    document.getElementById('plan-nurturing-phase').value = p.nurturingPhase || 'daily';
    document.getElementById('plan-browse-count').value = p.browseCount;
    document.getElementById('plan-browse-interval').value = p.browseInterval;
    document.getElementById('plan-browse-duration').value = p.browseDuration;
    document.getElementById('plan-like-prob').value = p.likeProbability;
    document.getElementById('plan-collect-prob').value = p.collectProbability;
    document.getElementById('plan-comment-prob').value = p.commentProbability;
    document.getElementById('plan-follow-prob').value = p.followProbability;
    document.getElementById('plan-keywords-include').value = p.keywordsInclude || '';
    document.getElementById('plan-keywords-exclude').value = p.keywordsExclude || '';
    document.getElementById('plan-min-likes').value = p.minLikes || 0;
    document.getElementById('plan-comment-persona').value = p.commentPersona || '';
    document.getElementById('plan-comment-persona').dataset.autofilled = p.commentPersona ? 'false' : 'true';
    document.getElementById('plan-comment-tone').value = p.commentTone || 'casual';
    document.getElementById('plan-skill').value = p.skill || '';
    // Render skill fields then populate saved values
    toggleSkillFields();
    if (p.skill) writeSkillFieldValues(p.skill, p);
  } else {
    document.getElementById('plan-name').value = '';
    document.getElementById('plan-mode').value = 'explore';
    document.getElementById('plan-nurturing-phase').value = 'daily';
    document.getElementById('plan-browse-count').value = 30;
    document.getElementById('plan-browse-interval').value = 5;
    document.getElementById('plan-browse-duration').value = 8;
    document.getElementById('plan-like-prob').value = 50;
    document.getElementById('plan-collect-prob').value = 33;
    document.getElementById('plan-comment-prob').value = 17;
    document.getElementById('plan-follow-prob').value = 10;
    document.getElementById('plan-keywords-include').value = '';
    document.getElementById('plan-keywords-exclude').value = '';
    document.getElementById('plan-min-likes').value = 0;
    document.getElementById('plan-comment-persona').value = '';
    document.getElementById('plan-comment-persona').dataset.autofilled = 'true';
    document.getElementById('plan-comment-tone').value = 'casual';
    document.getElementById('plan-skill').value = '';
    toggleSkillFields();
  }
  renderCommentPersonaSuggestions();
  syncPlanEditorCustomSelects();
  ['plan-like-prob','plan-collect-prob','plan-comment-prob','plan-follow-prob'].forEach(setupSlider);
  setTimeout(() => {
    document.getElementById('plan-name')?.focus();
  }, 120);
}

document.getElementById('btn-cancel-plan').addEventListener('click', () => {
  closeModal('plan-editor-modal');
});

document.getElementById('btn-close-plan-modal').addEventListener('click', () => {
  closeModal('plan-editor-modal');
});

document.getElementById('plan-editor-modal').addEventListener('click', (event) => {
  if (event.target?.dataset?.closeModal === 'plan-editor') {
    closeModal('plan-editor-modal');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal('plan-editor-modal');
  }
});

document.getElementById('btn-save-plan').addEventListener('click', async () => {
  const name = document.getElementById('plan-name').value.trim();
  if (!name) { showToast('请输入计划名称'); return; }
  const plan = {
    id: editingPlanIndex >= 0 ? plans[editingPlanIndex].id : Date.now().toString(36),
    name,
    mode: document.getElementById('plan-mode').value,
    nurturingPhase: document.getElementById('plan-nurturing-phase').value,
    browseCount: parseInt(document.getElementById('plan-browse-count').value),
    browseInterval: parseInt(document.getElementById('plan-browse-interval').value),
    browseDuration: parseInt(document.getElementById('plan-browse-duration').value),
    likeProbability: parseInt(document.getElementById('plan-like-prob').value),
    collectProbability: parseInt(document.getElementById('plan-collect-prob').value),
    commentProbability: parseInt(document.getElementById('plan-comment-prob').value),
    followProbability: parseInt(document.getElementById('plan-follow-prob').value),
    keywordsInclude: document.getElementById('plan-keywords-include').value,
    keywordsExclude: document.getElementById('plan-keywords-exclude').value,
    minLikes: parseInt(document.getElementById('plan-min-likes').value) || 0,
    commentPersona: document.getElementById('plan-comment-persona').value,
    commentTone: document.getElementById('plan-comment-tone').value,
    skill: document.getElementById('plan-skill').value,
    // Dynamically read skill-specific fields from registry
    ...readSkillFieldValues(document.getElementById('plan-skill').value),
  };
  if (editingPlanIndex >= 0) {
    plans[editingPlanIndex] = plan;
  } else {
    plans.push(plan);
  }
  await setStorage({ plans });
  closeModal('plan-editor-modal');
  renderPlans();
  populatePlanSelects();
  showToast(`计划「${name}」已保存`);
});

// Task plan select - show summary
document.getElementById('task-plan-select').addEventListener('change', (e) => {
  const plan = plans.find(p => p.id === e.target.value);
  const summary = document.getElementById('task-plan-summary');
  if (plan) {
    summary.style.display = 'block';
    const skillDef = plan.skill ? SkillRegistry.get(plan.skill) : null;
    if (skillDef && skillDef.summaryRows) {
      const util = { optionLabel: (f, v) => SkillRegistry.optionLabel(skillDef, f, v) };
      const rows = skillDef.summaryRows(plan, util);
      document.getElementById('summary-mode').textContent = rows.mode || '-';
      document.getElementById('summary-browse').textContent = rows.browse || '-';
      document.getElementById('summary-like').textContent = rows.like || '-';
      document.getElementById('summary-collect').textContent = rows.collect || '-';
      document.getElementById('summary-comment').textContent = rows.comment || '-';
      document.getElementById('summary-follow').textContent = rows.follow || '-';
    } else {
      document.getElementById('summary-mode').textContent = modeLabels[plan.mode] || plan.mode;
      document.getElementById('summary-browse').textContent = plan.browseCount + '篇';
      document.getElementById('summary-like').textContent = plan.likeProbability + '%';
      document.getElementById('summary-collect').textContent = plan.collectProbability + '%';
      document.getElementById('summary-comment').textContent = plan.commentProbability + '%';
      document.getElementById('summary-follow').textContent = plan.followProbability + '%';
    }
  } else {
    summary.style.display = 'none';
  }
  renderValidationSummary(e.target.value);
  renderValidationEvents(e.target.value);
});

// ================================================================
// CUSTOM COMMENTS LIBRARY
// ================================================================
let commentGroups = { default: [] };
let currentGroup = 'default';

async function loadComments() {
  const data = await getStorage(['commentGroups']);
  commentGroups = data.commentGroups || { default: [] };
  renderCommentGroupSelect();
  renderCustomComments();
}

function renderCommentGroupSelect() {
  const sel = document.getElementById('comment-group-select');
  sel.innerHTML = '';
  Object.keys(commentGroups).forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  });
  sel.value = currentGroup;
  document.getElementById('current-group-title').textContent = currentGroup;
}

function renderCustomComments() {
  const list = document.getElementById('custom-comments-list');
  const comments = commentGroups[currentGroup] || [];
  if (comments.length === 0) {
    list.innerHTML = '<div class="comments-empty">暂无评论，请添加</div>';
    return;
  }
  list.innerHTML = '';
  comments.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `<span class="comment-item-text">${escapeHtml(c)}</span>
      <div class="comment-item-actions">
        <button data-action="edit" data-index="${i}">✏</button>
        <button data-action="delete" data-index="${i}">✕</button>
      </div>`;
    list.appendChild(div);
  });
}

document.getElementById('comment-group-select').addEventListener('change', (e) => {
  currentGroup = e.target.value;
  document.getElementById('current-group-title').textContent = currentGroup;
  renderCustomComments();
});

document.getElementById('btn-add-comment-group').addEventListener('click', () => {
  const name = prompt('新分组名称:');
  if (!name || !name.trim()) return;
  const key = name.trim();
  if (commentGroups[key]) { showToast('分组已存在'); return; }
  commentGroups[key] = [];
  currentGroup = key;
  renderCommentGroupSelect();
  renderCustomComments();
  saveCommentGroups();
});

document.getElementById('btn-add-comment').addEventListener('click', () => {
  const input = document.getElementById('new-comment-input');
  const text = input.value.trim();
  if (!text) return;
  if (!commentGroups[currentGroup]) commentGroups[currentGroup] = [];
  commentGroups[currentGroup].push(text);
  input.value = '';
  renderCustomComments();
  saveCommentGroups();
});

document.getElementById('new-comment-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-add-comment').click();
});

document.getElementById('custom-comments-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = parseInt(btn.dataset.index);
  if (btn.dataset.action === 'delete') {
    commentGroups[currentGroup].splice(i, 1);
    renderCustomComments();
    saveCommentGroups();
  } else if (btn.dataset.action === 'edit') {
    const newText = prompt('编辑:', commentGroups[currentGroup][i]);
    if (newText !== null && newText.trim()) {
      commentGroups[currentGroup][i] = newText.trim();
      renderCustomComments();
      saveCommentGroups();
    }
  }
});

document.getElementById('btn-batch-add').addEventListener('click', () => {
  const text = document.getElementById('batch-comments').value.trim();
  if (!text) return;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!commentGroups[currentGroup]) commentGroups[currentGroup] = [];
  commentGroups[currentGroup].push(...lines);
  document.getElementById('batch-comments').value = '';
  renderCustomComments();
  saveCommentGroups();
  showToast(`已添加 ${lines.length} 条评论`);
});

function saveCommentGroups() {
  const customComments = Object.values(commentGroups)
    .flatMap(group => Array.isArray(group) ? group : [])
    .map(text => String(text).trim())
    .filter(Boolean);
  setStorage({ commentGroups, customComments });
}

// ================================================================
// PROFILE MODE - Target profiles
// ================================================================
let targetProfiles = [];

async function loadProfiles() {
  const data = await getStorage(['targetProfiles']);
  targetProfiles = data.targetProfiles || [];
  renderProfiles();
}

function renderProfiles() {
  const list = document.getElementById('target-profiles-list');
  if (targetProfiles.length === 0) {
    list.innerHTML = '<div class="comments-empty">暂无目标博主</div>';
    return;
  }
  list.innerHTML = '';
  targetProfiles.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `<span class="comment-item-text">${escapeHtml(p)}</span>
      <div class="comment-item-actions"><button data-index="${i}">✕</button></div>`;
    list.appendChild(div);
  });
}

document.getElementById('btn-add-profile').addEventListener('click', () => {
  const input = document.getElementById('new-profile-input');
  const text = input.value.trim();
  if (!text) return;
  targetProfiles.push(text);
  input.value = '';
  renderProfiles();
  setStorage({ targetProfiles });
});

document.getElementById('target-profiles-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  targetProfiles.splice(parseInt(btn.dataset.index), 1);
  renderProfiles();
  setStorage({ targetProfiles });
});

// ================================================================
// SAVE SETTINGS FOR MODE TABS
// ================================================================
document.getElementById('btn-save-explore').addEventListener('click', async () => {
  const config = {
    browseCount: parseInt(document.getElementById('explore-browse-count').value),
    interval: parseInt(document.getElementById('explore-interval').value),
    duration: parseInt(document.getElementById('explore-duration').value),
    autoScroll: document.getElementById('explore-auto-scroll').checked,
    likeProbability: parseInt(document.getElementById('explore-like-prob').value),
    collectProbability: parseInt(document.getElementById('explore-collect-prob').value),
    commentProbability: parseInt(document.getElementById('explore-comment-prob').value),
    followProbability: parseInt(document.getElementById('explore-follow-prob').value),
    searchKeyword: document.getElementById('explore-search-keyword').value,
    minLikes: parseInt(document.getElementById('explore-min-likes').value) || 0,
    keywordsInclude: document.getElementById('explore-keywords-include').value,
    keywordsExclude: document.getElementById('explore-keywords-exclude').value,
  };
  await setStorage({ exploreConfig: config });
  showToast('发现页设置已保存');
});

document.getElementById('btn-save-comment-zone').addEventListener('click', async () => {
  const config = {
    noteCount: parseInt(document.getElementById('cz-note-count').value),
    commentsPerNote: parseInt(document.getElementById('cz-comments-per-note').value),
    likeCommentProb: parseInt(document.getElementById('cz-like-comment-prob').value),
    replyProb: parseInt(document.getElementById('cz-reply-prob').value),
    searchKeyword: document.getElementById('cz-search-keyword').value,
    minComments: parseInt(document.getElementById('cz-min-comments').value) || 0,
  };
  await setStorage({ commentZoneConfig: config });
  showToast('评论区设置已保存');
});

document.getElementById('btn-save-profile').addEventListener('click', async () => {
  const config = {
    notesCount: parseInt(document.getElementById('profile-notes-count').value),
    likeProbability: parseInt(document.getElementById('profile-like-prob').value),
    collectProbability: parseInt(document.getElementById('profile-collect-prob').value),
    commentProbability: parseInt(document.getElementById('profile-comment-prob').value),
    autoFollow: document.getElementById('profile-auto-follow').checked,
  };
  await setStorage({ profileConfig: config, targetProfiles });
  showToast('主页设置已保存');
});

document.getElementById('btn-save-ai').addEventListener('click', async () => {
  const style = document.querySelector('input[name="ai-style"]:checked')?.value || 'positive';
  const config = {
    enabled: document.getElementById('ai-comment-enabled').checked,
    style,
    persona: document.getElementById('ai-persona').value,
    tone: document.getElementById('ai-tone').value,
    useEmoji: document.getElementById('ai-use-emoji').checked,
  };
  await setStorage({ aiConfig: config });
  showToast('AI设置已保存');
});

// ================================================================
// SCHEDULE
// ================================================================
let scheduleTimes = [];

function renderScheduleTimes(times) {
  scheduleTimes = times || [];
  const list = document.getElementById('schedule-times-list');
  if (scheduleTimes.length === 0) {
    list.innerHTML = '<div class="comments-empty">暂无定时任务</div>';
    return;
  }
  list.innerHTML = '';
  scheduleTimes.sort().forEach((time, i) => {
    const div = document.createElement('div');
    div.className = 'schedule-item';
    div.innerHTML = `<span>每天 ${time}</span><button data-index="${i}">✕</button>`;
    list.appendChild(div);
  });
}

document.getElementById('btn-add-time').addEventListener('click', () => {
  const input = document.getElementById('new-schedule-time');
  if (!input.value) return;
  if (scheduleTimes.includes(input.value)) { showToast('已存在'); return; }
  scheduleTimes.push(input.value);
  input.value = '';
  renderScheduleTimes(scheduleTimes);
});

document.getElementById('schedule-times-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  scheduleTimes.splice(parseInt(btn.dataset.index), 1);
  renderScheduleTimes(scheduleTimes);
});

document.getElementById('btn-save-schedule').addEventListener('click', async () => {
  const repeatDays = [];
  document.querySelectorAll('.weekday-cb:checked').forEach(cb => repeatDays.push(parseInt(cb.value)));
  await setStorage({
    schedule: {
      enabled: document.getElementById('schedule-enabled').checked,
      times: scheduleTimes,
      repeatDays,
      planId: document.getElementById('schedule-plan-select').value,
    }
  });
  showToast('定时配置已保存');
});

// ================================================================
// DATA STATISTICS - Task Execution Logs
// ================================================================
let taskExecutionLogs = [];

function normalizeTaskExecutionLogs(logs) {
  let changed = false;
  const normalized = (Array.isArray(logs) ? logs : []).map((log) => {
    if (!log || typeof log !== 'object') return log;
    if (log.status !== 'running') return log;
    changed = true;
    return { ...log, status: 'stopped' };
  });
  return { logs: normalized, changed };
}

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return '0 秒';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s} 秒`;
  return `${m} 分钟 ${s} 秒`;
}

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `about ${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function getStatusBadge(status) {
  const map = {
    completed: { cls: 'completed', text: '完成' },
    running: { cls: 'running', text: '运行中' },
    stopped: { cls: 'stopped', text: '手动停止' },
    error: { cls: 'error', text: '出错' },
  };
  const s = map[status] || map.stopped;
  return `<span class="status-badge ${s.cls}">${s.text}</span>`;
}

function renderTaskLogs() {
  const tbody = document.getElementById('task-log-body');
  const searchQuery = (document.getElementById('log-search').value || '').toLowerCase();
  const sortBy = document.getElementById('log-sort').value;

  let logs = [...taskExecutionLogs];

  // Filter
  if (searchQuery) {
    logs = logs.filter(l => (l.planName || '').toLowerCase().includes(searchQuery) || (l.status || '').includes(searchQuery));
  }

  // Sort
  if (sortBy === 'time-desc') logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  else if (sortBy === 'time-asc') logs.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  else if (sortBy === 'name') logs.sort((a, b) => (a.planName || '').localeCompare(b.planName || ''));
  else if (sortBy === 'duration') logs.sort((a, b) => (b.duration || 0) - (a.duration || 0));

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-row">暂无执行记录</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  logs.forEach((log, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="log-row-check" data-index="${i}"></td>
      <td>${escapeHtml(log.planName || '未命名')}</td>
      <td>📅 ${timeAgo(log.startTime)}</td>
      <td>${formatDuration(log.duration)}</td>
      <td>${log.browse || 0}</td>
      <td>${log.like || 0}</td>
      <td>${log.collect || 0}</td>
      <td>${log.follow || 0}</td>
      <td>${log.comment || 0}</td>
      <td>${getStatusBadge(log.status)}</td>
      <td class="col-action"><button class="log-delete-btn" data-id="${log.id}" title="删除">🗑</button></td>`;
    tbody.appendChild(tr);
  });

  // Update summary totals
  updateSummaryCards();
}

function updateSummaryCards() {
  let totalBrowse = 0, totalLike = 0, totalCollect = 0, totalFollow = 0, totalComment = 0, totalDuration = 0;
  taskExecutionLogs.forEach(l => {
    totalBrowse += l.browse || 0;
    totalLike += l.like || 0;
    totalCollect += l.collect || 0;
    totalFollow += l.follow || 0;
    totalComment += l.comment || 0;
    totalDuration += l.duration || 0;
  });
  document.getElementById('total-browse').textContent = totalBrowse;
  document.getElementById('total-like').textContent = totalLike;
  document.getElementById('total-collect').textContent = totalCollect;
  document.getElementById('total-follow').textContent = totalFollow;
  document.getElementById('total-comment').textContent = totalComment;
  document.getElementById('total-duration').textContent = formatDuration(totalDuration);
}

// Search & Sort listeners
document.getElementById('log-search').addEventListener('input', renderTaskLogs);
document.getElementById('log-sort').addEventListener('change', renderTaskLogs);

// Check all
document.getElementById('log-check-all').addEventListener('change', (e) => {
  document.querySelectorAll('.log-row-check').forEach(cb => { cb.checked = e.target.checked; });
});

// Delete single log
document.getElementById('task-log-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('.log-delete-btn');
  if (!btn) return;
  const id = btn.dataset.id;
  taskExecutionLogs = taskExecutionLogs.filter(l => l.id !== id);
  await setStorage({ taskExecutionLogs });
  renderTaskLogs();
});

// Clear all logs
document.getElementById('btn-clear-logs').addEventListener('click', async () => {
  if (!confirm('确定清除所有执行记录？')) return;
  taskExecutionLogs = [];
  await setStorage({ taskExecutionLogs });
  renderTaskLogs();
  showToast('日志已清除');
});

// Filter button (toggle filter - for now just shows a toast)
document.getElementById('btn-filter-logs').addEventListener('click', () => {
  showToast('可通过搜索框筛选计划名称或状态');
});

// ================================================================
// LOAD ALL SETTINGS
// ================================================================
async function loadAllSettings() {
  const data = await getStorage([
    'plans', 'activePlanId', 'stats', 'todayStats', 'taskLog',
    'commentGroups', 'schedule', 'dailyHistory',
    'apiKey', 'apiBaseUrl', 'userEmail', 'taskExecutionLogs',
    'exploreConfig', 'commentZoneConfig', 'profileConfig', 'aiConfig', 'targetProfiles',
    'taskValidationSummary', 'taskValidationEvents',
  ]);

  // Plans
  plans = data.plans || [];
  activePlanId = data.activePlanId || null;
  taskValidationSummary = data.taskValidationSummary || {};
  taskValidationEvents = data.taskValidationEvents || {};
  renderPlans();
  populatePlanSelects();
  renderValidationSummary();
  renderValidationEvents();

  // Task execution logs
  const normalizedLogs = normalizeTaskExecutionLogs(data.taskExecutionLogs || []);
  taskExecutionLogs = normalizedLogs.logs;
  if (normalizedLogs.changed) {
    await setStorage({ taskExecutionLogs });
  }
  renderTaskLogs();

  // Today
  const todayStats = data.todayStats || { browse:0, like:0, collect:0, comment:0, follow:0 };
  updateProgress(todayStats);

  // Log
  loadTaskLog(data.taskLog);

  // Comments
  commentGroups = data.commentGroups || { default: [] };
  renderCommentGroupSelect();
  renderCustomComments();

  // Schedule
  const schedule = data.schedule || { enabled: false, times: [], repeatDays: [], planId: '' };
  document.getElementById('schedule-enabled').checked = schedule.enabled;
  renderScheduleTimes(schedule.times || []);
  (schedule.repeatDays || []).forEach(day => {
    const cb = document.querySelector(`.weekday-cb[value="${day}"]`);
    if (cb) cb.checked = true;
  });
  if (schedule.planId) document.getElementById('schedule-plan-select').value = schedule.planId;

  // Account
  if (data.apiKey) document.getElementById('api-key').value = data.apiKey;
  if (data.apiBaseUrl) document.getElementById('api-base-url').value = data.apiBaseUrl;
  if (data.userEmail) document.getElementById('user-email').value = data.userEmail;

  // Explore config
  const ec = data.exploreConfig;
  if (ec) {
    if (ec.browseCount) document.getElementById('explore-browse-count').value = ec.browseCount;
    if (ec.interval) document.getElementById('explore-interval').value = ec.interval;
    if (ec.duration) document.getElementById('explore-duration').value = ec.duration;
    if (ec.autoScroll !== undefined) document.getElementById('explore-auto-scroll').checked = ec.autoScroll;
    if (ec.likeProbability !== undefined) { document.getElementById('explore-like-prob').value = ec.likeProbability; document.getElementById('explore-like-prob-val').textContent = ec.likeProbability + '%'; }
    if (ec.collectProbability !== undefined) { document.getElementById('explore-collect-prob').value = ec.collectProbability; document.getElementById('explore-collect-prob-val').textContent = ec.collectProbability + '%'; }
    if (ec.commentProbability !== undefined) { document.getElementById('explore-comment-prob').value = ec.commentProbability; document.getElementById('explore-comment-prob-val').textContent = ec.commentProbability + '%'; }
    if (ec.followProbability !== undefined) { document.getElementById('explore-follow-prob').value = ec.followProbability; document.getElementById('explore-follow-prob-val').textContent = ec.followProbability + '%'; }
    if (ec.searchKeyword) document.getElementById('explore-search-keyword').value = ec.searchKeyword;
    if (ec.minLikes) document.getElementById('explore-min-likes').value = ec.minLikes;
    if (ec.keywordsInclude) document.getElementById('explore-keywords-include').value = ec.keywordsInclude;
    if (ec.keywordsExclude) document.getElementById('explore-keywords-exclude').value = ec.keywordsExclude;
  }

  // Comment zone config
  const czc = data.commentZoneConfig;
  if (czc) {
    if (czc.noteCount) document.getElementById('cz-note-count').value = czc.noteCount;
    if (czc.commentsPerNote) document.getElementById('cz-comments-per-note').value = czc.commentsPerNote;
    if (czc.likeCommentProb !== undefined) { document.getElementById('cz-like-comment-prob').value = czc.likeCommentProb; document.getElementById('cz-like-comment-prob-val').textContent = czc.likeCommentProb + '%'; }
    if (czc.replyProb !== undefined) { document.getElementById('cz-reply-prob').value = czc.replyProb; document.getElementById('cz-reply-prob-val').textContent = czc.replyProb + '%'; }
    if (czc.searchKeyword) document.getElementById('cz-search-keyword').value = czc.searchKeyword;
    if (czc.minComments) document.getElementById('cz-min-comments').value = czc.minComments;
  }

  // Profile config
  const pc = data.profileConfig;
  if (pc) {
    if (pc.notesCount) document.getElementById('profile-notes-count').value = pc.notesCount;
    if (pc.likeProbability !== undefined) { document.getElementById('profile-like-prob').value = pc.likeProbability; document.getElementById('profile-like-prob-val').textContent = pc.likeProbability + '%'; }
    if (pc.collectProbability !== undefined) { document.getElementById('profile-collect-prob').value = pc.collectProbability; document.getElementById('profile-collect-prob-val').textContent = pc.collectProbability + '%'; }
    if (pc.commentProbability !== undefined) { document.getElementById('profile-comment-prob').value = pc.commentProbability; document.getElementById('profile-comment-prob-val').textContent = pc.commentProbability + '%'; }
    if (pc.autoFollow !== undefined) document.getElementById('profile-auto-follow').checked = pc.autoFollow;
  }
  if (data.targetProfiles) {
    targetProfiles = data.targetProfiles;
    renderProfiles();
  }

  // AI comment config
  const ac = data.aiConfig;
  if (ac) {
    if (ac.enabled !== undefined) document.getElementById('ai-comment-enabled').checked = ac.enabled;
    if (ac.style) {
      const radio = document.querySelector(`input[name="ai-style"][value="${ac.style}"]`);
      if (radio) { radio.checked = true; document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active')); radio.closest('.style-card').classList.add('active'); }
    }
    if (ac.persona) document.getElementById('ai-persona').value = ac.persona;
    if (ac.tone) document.getElementById('ai-tone').value = ac.tone;
    if (ac.useEmoji !== undefined) document.getElementById('ai-use-emoji').checked = ac.useEmoji;
  }

}

function updateProgress(todayStats) {
  const browseTarget = 30;
  const setP = (id, barId, current, target) => {
    const el = document.getElementById(id);
    const bar = document.getElementById(barId);
    if (el) el.textContent = `${current}/${target}`;
    if (bar) bar.style.width = `${Math.min(100, target > 0 ? (current / target) * 100 : 0)}%`;
  };
  setP('browse-progress', 'browse-progress-bar', todayStats.browse, browseTarget);
  setP('like-progress', 'like-progress-bar', todayStats.like, Math.max(1, Math.round(browseTarget * 0.5)));
  setP('collect-progress', 'collect-progress-bar', todayStats.collect, Math.max(1, Math.round(browseTarget * 0.33)));
  setP('comment-progress', 'comment-progress-bar', todayStats.comment, Math.max(1, Math.round(browseTarget * 0.17)));
}

function loadTaskLog(taskLog) {
  const logArea = document.getElementById('task-log');
  if (!taskLog || taskLog.length === 0) {
    logArea.innerHTML = '<div class="log-empty">暂无日志，开始养号后将显示操作记录</div>';
    return;
  }
  logArea.innerHTML = '';
  taskLog.slice(0, 50).forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">[${new Date(entry.time).toLocaleTimeString()}]</span> ${entry.message}`;
    logArea.appendChild(div);
  });
}

// ================================================================
// LIVE PANEL & TASK EXECUTION
// ================================================================
// Multi-plan state: each plan runs as an independent instance
const runningPlans = new Map(); // planId → { sessionKey, startTime, stats, operationSteps, stepCounter, logEntry }
let viewingPlanId = null; // which plan's live view is displayed in the panel
const MAX_CONCURRENT_PLANS = 3;
const MAX_PLAN_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 8000;
const PLAN_STALL_TIMEOUT_MS = 180000;

// Helpers
function isAnyPlanRunning() { return runningPlans.size > 0; }
function isPlanRunning(planId) { return runningPlans.has(planId); }
function getSessionKey(planId) { return 'plan-' + planId; }
function sessionKeyToPlanId(sk) { return sk ? sk.replace(/^plan-/, '') : null; }

function touchPlanActivity(planId) {
  const state = runningPlans.get(planId);
  if (!state) return;
  state.lastActivityAt = Date.now();
}

function normalizeErrorMessage(errLike) {
  if (!errLike) return '未知错误';
  if (typeof errLike === 'string') return errLike;
  if (typeof errLike.message === 'string') return errLike.message;
  try { return JSON.stringify(errLike); } catch { return String(errLike); }
}

function classifyPlanError(message) {
  const msg = (message || '').toLowerCase();

  if (!msg) return { retryable: true, userMessage: '任务异常中断（无错误详情）' };

  if (msg.includes('no pages available in the connected browser')) {
    return { retryable: false, userMessage: '未检测到可控页面，请先打开并保持一个小红书标签页。' };
  }
  if (msg.includes('device identity required')) {
    return { retryable: false, userMessage: 'Gateway 拒绝连接：需要设备身份授权。' };
  }
  if (msg.includes('gateway token') || msg.includes('未配置') || msg.includes('openclaw bridge 未加载')) {
    return { retryable: false, userMessage: message };
  }
  if (msg.includes('api rate limit reached') || msg.includes('rate limit')) {
    return { retryable: false, userMessage: 'AI 模型触发频率/额度限制，请稍后重试。' };
  }
  if (msg.includes('login required')) {
    return { retryable: false, userMessage: '小红书未登录，需先登录后再运行。' };
  }
  if (msg.includes('captcha')) {
    return { retryable: false, userMessage: '检测到验证码，需人工处理后再继续。' };
  }
  if (msg.includes('gateway disconnected') || msg.includes('websocket') || msg.includes('connection timeout')) {
    return { retryable: true, userMessage: 'Gateway 连接中断，正在尝试恢复。' };
  }
  if (msg.includes('rpc timeout')) {
    return { retryable: true, userMessage: '任务响应超时，准备自动重试。' };
  }

  return { retryable: true, userMessage: message };
}

// Legacy compat — some code checks isRunning
let isRunning = false; // kept in sync: true when any plan is running

function openPanel() { document.body.classList.add('panel-open'); }
function closePanel() { document.body.classList.remove('panel-open'); }

document.getElementById('btn-collapse-panel').addEventListener('click', closePanel);

document.getElementById('btn-open-xhs').addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: 'https://www.xiaohongshu.com/explore' });
  }
});

document.getElementById('btn-refresh-tab').addEventListener('click', () => {
  addChainStep('refresh', '刷新页面', 'xiaohongshu.com');
});

// Start/Stop
// Legacy btn-start: delegates to startPlan/stopPlan
document.getElementById('btn-start').addEventListener('click', async () => {
  const selPlanId = document.getElementById('task-plan-select').value;
  if (!selPlanId) {
    showToast('请先选择一个计划');
    return;
  }
  if (isPlanRunning(selPlanId)) {
    await stopPlan(selPlanId);
  } else {
    if (runningPlans.size >= MAX_CONCURRENT_PLANS) {
      showToast(`最多同时运行 ${MAX_CONCURRENT_PLANS} 个计划`);
      return;
    }
    await startPlan(selPlanId);
  }
});

function updateBrowserUrl(url) {
  const el = document.querySelector('.url-text');
  if (el && url) el.textContent = url;
}

function getSelectedValidationPlanId() {
  if (viewingPlanId) return viewingPlanId;
  const selected = document.getElementById('task-plan-select')?.value;
  if (selected) return selected;
  return activePlanId || '';
}

function renderValidationSummary(planId = getSelectedValidationPlanId()) {
  const summary = (planId && taskValidationSummary[planId]) || null;
  const passEl = document.getElementById('task-validated-pass');
  const failEl = document.getElementById('task-validated-fail');
  const failureEl = document.getElementById('task-validation-last-failure');

  if (passEl) passEl.textContent = summary?.passed || 0;
  if (failEl) failEl.textContent = summary?.failed || 0;
  if (failureEl) {
    failureEl.textContent = summary?.lastFailure
      ? `最近失败: ${summary.lastFailure}`
      : '最近失败: 暂无';
  }
}

function renderValidationEvents(planId = getSelectedValidationPlanId()) {
  const list = document.getElementById('task-validation-events');
  if (!list) return;

  const events = (planId && taskValidationEvents[planId]) || [];
  if (!events.length) {
    list.innerHTML = '<div class="validation-empty">启动任务后将显示验证证据</div>';
    return;
  }

  list.innerHTML = '';
  events.slice(0, 20).forEach((event) => {
    const row = document.createElement('div');
    row.className = 'validation-event';
    row.innerHTML = `
      <div class="validation-badge ${event.status === 'fail' ? 'fail' : 'ok'}">${event.status === 'fail' ? '失败' : '通过'}</div>
      <div class="validation-body">
        <div class="validation-title">${escapeHtml(event.label || event.action || '验证事件')}</div>
        <div class="validation-detail">${escapeHtml(event.detail || '无详情')}</div>
        <div class="validation-meta">${escapeHtml(event.scope || 'general')} · ${new Date(event.time).toLocaleTimeString()}</div>
      </div>
    `;
    list.appendChild(row);
  });
}

const actionMap = {
  browse: { icon: '👀', label: '正在浏览' }, like: { icon: '❤️', label: '点赞' },
  collect: { icon: '⭐', label: '收藏' }, comment: { icon: '💬', label: '评论中' },
  follow: { icon: '➕', label: '关注' }, scroll: { icon: '📜', label: '滚动浏览' },
  wait: { icon: '⏳', label: '等待中' }, open: { icon: '📂', label: '打开笔记' },
  start: { icon: '🚀', label: '启动' }, stop: { icon: '⏹️', label: '停止' },
  connect: { icon: '🔗', label: '连接' }, refresh: { icon: '🔄', label: '刷新' },
  ai: { icon: '🤖', label: 'AI评论' }, skip: { icon: '⏭️', label: '跳过' }, done: { icon: '✅', label: '完成' },
  retry: { icon: '🔁', label: '自动重试' }, error: { icon: '⚠️', label: '异常中断' },
};

function updateCurrentAction(type, detail) {
  const info = actionMap[type] || { icon: '🔹', label: type };
  document.getElementById('action-icon').textContent = info.icon;
  document.getElementById('action-label').textContent = info.label;
  document.getElementById('action-detail').textContent = detail || '';
}

function normalizeStepStatus(type, status = '') {
  if (status === 'fail') return 'fail';
  if (status === 'ok') return 'done';
  if (status === 'info') return 'info';
  return (type === 'stop' || type === 'done') ? 'done' : 'active';
}

function addChainStep(type, label, detail, status = '') {
  stepCounter++;
  const info = actionMap[type] || { icon: '🔹' };
  const step = {
    id: stepCounter,
    type,
    icon: info.icon,
    label,
    detail: detail || '',
    time: new Date(),
    status: normalizeStepStatus(type, status),
  };
  if (operationSteps.length > 0) {
    const prev = operationSteps[operationSteps.length - 1];
    if (prev.status === 'active') prev.status = 'done';
  }
  operationSteps.push(step);
  renderChain();
  updateCurrentAction(type, detail);
  document.getElementById('chain-count').textContent = `${operationSteps.length} 步`;
}

function renderChain() {
  const list = document.getElementById('chain-list');
  if (operationSteps.length === 0) { list.innerHTML = '<div class="chain-empty">启动任务后将显示操作步骤</div>'; return; }
  list.innerHTML = '';
  operationSteps.slice(-50).reverse().forEach(step => {
    const div = document.createElement('div');
    div.className = 'chain-step';
    div.innerHTML = `
      <div class="chain-step-icon ${step.status || 'done'}">${step.icon}</div>
      <div class="chain-step-content">
        <div class="chain-step-label">${escapeHtml(step.label)}</div>
        <div class="chain-step-detail">${escapeHtml(step.detail)}</div>
      </div>
      <div class="chain-step-time">${step.time.toLocaleTimeString()}</div>`;
    list.appendChild(div);
  });
}

function updateLiveStats(stats) {
  document.getElementById('live-browsed').textContent = stats.browse || 0;
  document.getElementById('live-liked').textContent = stats.like || 0;
  document.getElementById('live-collected').textContent = stats.collect || 0;
  document.getElementById('live-commented').textContent = stats.comment || 0;
  document.getElementById('live-followed').textContent = stats.follow || 0;
}

// Listen for messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'taskAction') {
      addChainStep(msg.action, msg.label || msg.action, msg.detail || '', msg.validationStatus || '');
      if (msg.url) updateBrowserUrl(msg.url);
    }
    if (msg.type === 'taskStats') {
      const stats = msg.stats || {};
      updateLiveStats(stats);
      const elMap = { browse: 'task-browsed', like: 'task-liked', collect: 'task-collected', comment: 'task-commented', follow: 'task-followed' };
      for (const [key, elId] of Object.entries(elMap)) {
        const el = document.getElementById(elId);
        if (el) el.textContent = stats[key] || 0;
      }
      updateProgress(stats);
    }
    if (msg.type === 'taskValidation' && msg.planId) {
      taskValidationSummary[msg.planId] = msg.summary || {};
      taskValidationEvents[msg.planId] = Array.isArray(msg.events) ? msg.events : [];
      renderValidationSummary();
      renderValidationEvents();
    }
    if (msg.type === 'taskLog') addLog(msg.message);
    if (msg.type === 'taskComplete') {
      addChainStep('done', '任务完成', '本轮养号已完成');
    }
  });
}

function addLog(message) {
  const logArea = document.getElementById('task-log');
  const empty = logArea.querySelector('.log-empty');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${message}`;
  logArea.prepend(entry);
}

// ================================================================
// ACCOUNT
// ================================================================
document.getElementById('btn-toggle-key').addEventListener('click', () => {
  const input = document.getElementById('api-key');
  const btn = document.getElementById('btn-toggle-key');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '隐藏'; }
  else { input.type = 'password'; btn.textContent = '显示'; }
});

document.getElementById('btn-save-account').addEventListener('click', async () => {
  await setStorage({ apiKey: document.getElementById('api-key').value, apiBaseUrl: document.getElementById('api-base-url').value, userEmail: document.getElementById('user-email').value });
  showToast('账户信息已保存');
});

document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await getStorage([
    'plans','stats','taskLog','dailyHistory','commentGroups','schedule',
    'taskValidationSummary','taskValidationEvents'
  ]);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yangshuhu-data-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-clear').addEventListener('click', async () => {
  if (confirm('确定要清除所有数据吗？')) {
    await setStorage({
      plans:[],
      stats:null,
      taskLog:null,
      dailyHistory:null,
      commentGroups:{ default:[] },
      customComments:[],
      schedule:{ enabled:false, times:[], repeatDays:[] },
      todayStats:null,
      taskExecutionLogs:[],
      taskValidationSummary:{},
      taskValidationEvents:{},
    });
    plans = [];
    commentGroups = { default:[] };
    scheduleTimes = [];
    taskValidationSummary = {};
    taskValidationEvents = {};
    loadAllSettings();
    showToast('数据已清除');
  }
});

// ========== Periodic Refresh ==========
setInterval(async () => {
  const data = await getStorage(['todayStats', 'isRunning']);
  const todayStats = data.todayStats || { browse:0, like:0, collect:0, comment:0, follow:0 };
  document.getElementById('task-browsed').textContent = todayStats.browse;
  document.getElementById('task-liked').textContent = todayStats.like;
  document.getElementById('task-collected').textContent = todayStats.collect;
  document.getElementById('task-commented').textContent = todayStats.comment;
  document.getElementById('task-followed').textContent = todayStats.follow || 0;
  updateProgress(todayStats);
  updateLiveStats(todayStats);

  // Update running log entries duration in real time
  for (const [, state] of runningPlans) {
    if (state.logEntry) {
      state.logEntry.duration = Math.round((Date.now() - state.startTime) / 1000);
      Object.assign(state.logEntry, state.stats);
    }
  }
  if (isAnyPlanRunning()) renderTaskLogs();
}, 5000);

// Runtime watchdog: detect stalled plans before gateway hard-timeout.
setInterval(() => {
  const now = Date.now();
  for (const [planId, state] of runningPlans.entries()) {
    if (state.pendingRetryTimer || state.handlingError) continue;
    const lastAt = state.lastActivityAt || state.startTime || now;
    if (now - lastAt < PLAN_STALL_TIMEOUT_MS) continue;
    handlePlanRuntimeError(planId, `任务超过 ${Math.round(PLAN_STALL_TIMEOUT_MS / 1000)} 秒无进度`);
  }
}, 15000);

// ================================================================
// ================================================================
// CDP SCREENCAST — REAL-TIME BROWSER VIEW
// ================================================================
const screencast = window.cdpScreencast;

async function startScreencast() {
  if (!screencast) return;
  try {
    const data = await getStorage(['cdpUrl']);
    const cdpUrl = data.cdpUrl || '127.0.0.1:18800';
    const loadingText = document.getElementById('screenshot-loading-text');
    if (loadingText) loadingText.textContent = '正在连接实时画面...';

    await screencast.start(cdpUrl,
      // onFrame
      (dataUrl) => {
        const img = document.getElementById('screenshot-img');
        const loading = document.getElementById('screenshot-loading');
        if (img) img.src = dataUrl;
        if (loading) loading.classList.add('hidden');
        document.getElementById('screencast-badge')?.classList.remove('hidden');
      },
      // onStatus
      (status, message) => {
        const loadingText = document.getElementById('screenshot-loading-text');
        if (loadingText) loadingText.textContent = message;
        if (status === 'disconnected') {
          document.getElementById('screencast-badge')?.classList.add('hidden');
        }
      }
    );
    addChainStep('live', '实时画面', 'CDP Screencast 已连接');
  } catch (err) {
    // Screencast failed — fall back to agent screenshots
    const loadingText = document.getElementById('screenshot-loading-text');
    if (loadingText) loadingText.textContent = '等待 Agent 截图...';
    addLog('实时画面连接失败: ' + err.message + ' (将使用 Agent 截图)');
  }
}

function stopScreencast() {
  if (screencast) screencast.stop();
  document.getElementById('screencast-badge')?.classList.add('hidden');
}

// ================================================================
// OPENCLAW AI INTEGRATION — MULTI-PLAN EVENT ROUTING
// ================================================================
const bridge = window.openclawBridge;

// Wire bridge events to live panel — route by sessionKey
if (bridge) {
  bridge.on('action', (data) => {
    const planId = sessionKeyToPlanId(data.sessionKey);
    const state = runningPlans.get(planId);
    if (!state) return;
    touchPlanActivity(planId);

    const labelMap = {
      browse: '浏览', like: '点赞', collect: '收藏', follow: '关注', comment: '评论',
      scroll: '滚动', click: '打开笔记', close: '关闭笔记', done: '完成',
      navigate: '导航', screenshot: '截屏', scan: '扫描页面',
    };
    addPlanChainStep(planId, data.action, labelMap[data.action] || data.label || data.action, data.detail || '');
    if (data.url && planId === viewingPlanId) updateBrowserUrl(data.url);
  });

  bridge.on('stats', (data) => {
    const planId = sessionKeyToPlanId(data.sessionKey);
    const state = runningPlans.get(planId);
    if (!state) return;
    touchPlanActivity(planId);

    for (const [key, val] of Object.entries(data)) {
      if (key === 'sessionKey') continue;
      if (state.stats[key] !== undefined) state.stats[key] += val;
    }

    // Update UI only if viewing this plan
    if (planId === viewingPlanId) {
      const elMap = { browse: 'task-browsed', like: 'task-liked', collect: 'task-collected', comment: 'task-commented', follow: 'task-followed' };
      for (const [key, val] of Object.entries(state.stats)) {
        const el = document.getElementById(elMap[key]);
        if (el) el.textContent = val;
      }
    }
  });

  bridge.on('screenshot', (data) => {
    const planId = sessionKeyToPlanId(data.sessionKey);
    if (!runningPlans.has(planId)) return;
    touchPlanActivity(planId);
    // Show screenshot only if viewing this plan
    if (planId === viewingPlanId && data.imageBase64) {
      const img = document.getElementById('screenshot-img');
      const loading = document.getElementById('screenshot-loading');
      img.src = data.imageBase64.startsWith('data:') ? data.imageBase64 : 'data:image/png;base64,' + data.imageBase64;
      loading.classList.add('hidden');
    }
  });

  bridge.on('complete', (data) => {
    const planId = sessionKeyToPlanId(data.sessionKey);
    const state = runningPlans.get(planId);
    if (!state) return;
    touchPlanActivity(planId);

    // Finalize log
    if (state.logEntry) {
      state.logEntry.status = 'completed';
      state.logEntry.duration = Math.round((Date.now() - state.startTime) / 1000);
      Object.assign(state.logEntry, state.stats);
      setStorage({ taskExecutionLogs });
      renderTaskLogs();
    }

    addPlanChainStep(planId, 'done', '任务完成', 'AI 智能养号已完成');
    runningPlans.delete(planId);
    isRunning = isAnyPlanRunning();

    if (viewingPlanId === planId) {
      const remaining = [...runningPlans.keys()];
      if (remaining.length > 0) {
        viewingPlanId = remaining[0];
        updateLivePanelForPlan(viewingPlanId);
      } else {
        document.body.classList.remove('panel-running');
        stopScreencast();
        if (bridge) bridge.disconnect();
      }
    }
    if (!isAnyPlanRunning()) {
      document.body.classList.remove('panel-running');
      stopScreencast();
      if (bridge) bridge.disconnect();
    }
    renderPlans();
  });

  bridge.on('error', async (data) => {
    const planId = sessionKeyToPlanId(data.sessionKey);
    if (!planId || !runningPlans.has(planId)) return;
    const message = normalizeErrorMessage(data?.message || data);
    addLog(`计划异常: ${message}`);
    await handlePlanRuntimeError(planId, message);
  });

  bridge.on('connected', () => {
    updateOpenClawStatus('connected', 'AI 智能模式已连接');
  });

  bridge.on('disconnected', () => {
    updateOpenClawStatus('disconnected', '已断开');
  });
}

function updateOpenClawStatus(state, text) {
  const dot = document.getElementById('openclaw-dot');
  const modeText = document.getElementById('openclaw-mode-text');
  if (dot) {
    dot.className = 'status-dot ' + state;
  }
  if (modeText) modeText.textContent = text;
}

// Handle scheduled task triggers from background.js (chrome.alarms)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'startOpenClaw' && bridge && msg.planId) {
      if (!isPlanRunning(msg.planId) && runningPlans.size < MAX_CONCURRENT_PLANS) {
        startPlan(msg.planId);
      }
    }
    if (msg.type === 'stopOpenClaw' && bridge && msg.planId) {
      stopPlan(msg.planId);
    }
  });
}

// Test connection button
document.getElementById('btn-test-openclaw').addEventListener('click', async () => {
  const url = document.getElementById('openclaw-url').value.trim();
  const token = document.getElementById('openclaw-token').value.trim();

  if (!url) { showToast('请输入 Gateway URL'); return; }

  updateOpenClawStatus('checking', '正在连接...');

  try {
    bridge.config.url = url;
    await bridge.connect(url, token);
    updateOpenClawStatus('connected', 'Gateway 已连接');
    showToast('OpenClaw Gateway 连接成功!');
  } catch (err) {
    updateOpenClawStatus('disconnected', '连接失败');
    showToast('无法连接: ' + (err.message || '请检查 Gateway 是否运行'));
  }
});

// Save OpenClaw config
document.getElementById('btn-save-openclaw').addEventListener('click', async () => {
  const url = document.getElementById('openclaw-url').value.trim();
  const token = document.getElementById('openclaw-token').value.trim();
  const cdpUrl = document.getElementById('cdp-url').value.trim();
  await setStorage({
    openclawUrl: url || 'ws://127.0.0.1:18789',
    openclawToken: token,
    cdpUrl: cdpUrl || '127.0.0.1:18800',
  });
  // Also save HTTP URL for background.js health check
  const httpUrl = (url || 'ws://127.0.0.1:18789').replace('ws://', 'http://').replace('wss://', 'https://');
  await setStorage({ openclawHttpUrl: httpUrl });
  showToast('OpenClaw 配置已保存');
});

// Load OpenClaw config on startup
async function loadOpenClawConfig() {
  // Step 1: Try Native Messaging to auto-fetch token from local config
  let nativeOk = false;
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendNativeMessage) {
    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendNativeMessage('com.openclaw.bridge', { action: 'getToken' }, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(response);
        });
      });
      if (resp && resp.ok && resp.token) {
        await setStorage({
          openclawToken: resp.token,
          openclawUrl: resp.url || 'ws://127.0.0.1:18789',
        });
        nativeOk = true;
      }
    } catch {
      // Native host not installed — fall through to manual config
    }
  }

  // Step 2: Load from storage (may have been updated by native messaging above)
  const data = await getStorage(['openclawUrl', 'openclawToken', 'cdpUrl']);
  const url = data.openclawUrl || 'ws://127.0.0.1:18789';
  const token = data.openclawToken || '';
  const cdpUrl = data.cdpUrl || '127.0.0.1:18800';

  document.getElementById('openclaw-url').value = url;
  document.getElementById('cdp-url').value = cdpUrl;

  // Update token UI
  const tokenInput = document.getElementById('openclaw-token');
  const tokenStatus = document.getElementById('token-auto-status');
  if (token) {
    tokenInput.value = token;
    if (tokenStatus) {
      tokenStatus.textContent = nativeOk ? '已自动获取' : '已配置';
      tokenStatus.style.color = '#22c55e';
    }
  } else {
    if (tokenStatus) {
      tokenStatus.textContent = '未配置 — 请运行 install.sh 或手动填写';
      tokenStatus.style.color = '#ef4444';
    }
  }

  if (bridge) { bridge.config.url = url; bridge.config.token = token; }

  // Step 3: Auto-detect Gateway availability
  if (bridge) {
    const ok = await bridge.healthCheck();
    updateOpenClawStatus(ok ? 'connected' : 'disconnected', ok ? 'AI 智能模式就绪' : 'Gateway 未运行');
  }
}

// ========== Init ==========
loadAllSettings();
loadOpenClawConfig();
