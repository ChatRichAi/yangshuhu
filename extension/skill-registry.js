// ========== Skill Registry ==========
// Data-driven skill definitions. Adding a new skill = adding one entry here.
// The plan editor dynamically renders form fields from this registry.

window.SKILL_REGISTRY = [
  {
    id: 'xiaohongshu-ops',
    label: '运营 — 选题/内容/发布/复盘',
    fields: [
      {
        key: 'opsTask', type: 'select', label: '运营任务', default: 'topic-research',
        options: [
          { value: 'topic-research', label: '选题研究 — 抓取高互动内容，生成选题清单' },
          { value: 'content-create', label: '内容生产 — 根据选题生成可发布的图文内容' },
          { value: 'viral-copy', label: 'Viral Copy — 输入爆款URL，生成近似结构笔记' },
          { value: 'comment-reply', label: '评论回复 — 检查通知并按人设风格回复' },
          { value: 'publish', label: '发布执行 — 进入创作后台完成发布流程' },
          { value: 'full-pipeline', label: '全流程 — 选题→生产→发布→复盘' },
        ],
      },
      {
        key: 'opsVertical', type: 'select', label: '垂类方向', default: 'drama',
        options: [
          { value: 'drama', label: '影视剧评' },
          { value: 'food', label: '美食探店' },
          { value: 'travel', label: '旅行攻略' },
          { value: 'cosmetics', label: '美妆护肤' },
          { value: 'fitness', label: '健身运动' },
          { value: 'tech', label: '数码科技' },
          { value: 'lifestyle', label: '生活方式' },
          { value: 'custom', label: '自定义' },
        ],
      },
      {
        key: 'opsVerticalCustom', type: 'text', label: '自定义垂类',
        placeholder: '例如：宠物、亲子、读书',
        showWhen: { field: 'opsVertical', value: 'custom' },
      },
      {
        key: 'opsTopicCount', type: 'number', label: '选题/内容数量',
        default: 3, min: 1, max: 10,
        hint: '每次执行生成的选题或内容备选数',
      },
      {
        key: 'opsPersona', type: 'text', label: '内容人设',
        placeholder: '例如：太平年 — 一个看剧比吃饭认真的90后',
        hint: '根据技能类型、运营任务和垂类方向生成推荐，也可以直接自定义输入。',
        hasSuggestions: true,
      },
      {
        key: 'opsTone', type: 'select', label: '语气风格', default: 'default',
        options: [
          { value: 'default', label: '默认 (虾薯傲娇嘴硬)' },
          { value: 'casual', label: '轻松口语' },
          { value: 'sharp', label: '犀利毒舌' },
          { value: 'warm', label: '温暖治愈' },
          { value: 'professional', label: '专业深度' },
          { value: 'humorous', label: '幽默搞怪' },
        ],
      },
      {
        key: 'opsViralUrl', type: 'textarea', label: '爆款笔记 URL',
        placeholder: '每行一个小红书笔记链接\nhttps://www.xiaohongshu.com/explore/...',
        rows: 3,
        showWhen: { field: 'opsTask', value: 'viral-copy' },
      },
      {
        key: 'opsKeywords', type: 'text', label: '关注关键词 (选填)',
        placeholder: '逗号分隔，用于选题研究和对标筛选',
      },
    ],

    // Persona suggestions keyed by vertical → task
    personaSuggestions: {
      drama: {
        'topic-research': [
          { title: '追剧显微镜', text: '一个会拆剧情节奏、人物关系和观众情绪点的追剧党。' },
          { title: '上头剧单官', text: '擅长从热播桥段里提炼选题，语气轻快、有分享欲。' },
          { title: '冷面剧评人', text: '关注叙事结构和角色逻辑，说话直接但有判断力。' },
        ],
        'content-create': [
          { title: '嗑糖吐槽姬', text: '能写嗑点，也能写槽点，适合剧情解读和安利文案。' },
          { title: '熬夜追更人', text: '带强烈代入感，擅长把追剧体验写成爆款图文。' },
          { title: '剧综观察员', text: '兼顾剧情分析和话题延展，适合做系列内容。' },
        ],
      },
      food: {
        'topic-research': [
          { title: '本地探店雷达', text: '擅长发现高讨论餐厅和话题菜品，判断用户会不会收藏。' },
          { title: '会做饭的吃货', text: '既关注味道，也能拆做法和食材亮点。' },
          { title: '通勤觅食党', text: '从价格、排队、出片和复购角度判断内容价值。' },
        ],
        'content-create': [
          { title: '治愈系饭搭子', text: '适合写温暖有食欲感的探店和家常菜内容。' },
          { title: '真诚嘴替', text: '敢说优缺点，适合做高转化的种草避雷内容。' },
          { title: '厨房研究生', text: '擅长把步骤、口感和食材细节写清楚。' },
        ],
      },
      travel: {
        'topic-research': [
          { title: '周末出逃策划师', text: '擅长找短途高性价比路线和适合收藏的实用信息。' },
          { title: '懒人攻略控', text: '偏爱交通、预算、路线清晰的攻略型内容。' },
          { title: '城市漫游者', text: '会从氛围、小众机位和体验感找选题。' },
        ],
        'content-create': [
          { title: '地图收藏家', text: '适合写路线、拍照点和一天怎么玩的结构化内容。' },
          { title: '氛围感旅行博主', text: '擅长把景色、情绪和体验写得有代入感。' },
          { title: '预算党导游', text: '突出花费、避坑和实用建议，适合攻略类发布。' },
        ],
      },
      cosmetics: {
        'topic-research': [
          { title: '成分功课党', text: '关注成分、肤质、口碑和高互动测评方向。' },
          { title: '通勤变美顾问', text: '偏爱妆容效率、平价替代和真实使用场景。' },
          { title: '护肤实验室', text: '善于从产品机制和用户痛点里挖选题。' },
        ],
        'content-create': [
          { title: '温柔变美学姐', text: '适合输出新手友好的妆教和产品推荐。' },
          { title: '理性成分派', text: '适合做专业可信的测评和护肤科普。' },
          { title: '高效通勤脸代表', text: '擅长写快速上妆、伪素颜和实用技巧。' },
        ],
      },
      fitness: {
        'topic-research': [
          { title: '自律打卡搭子', text: '关注减脂、塑形和能坚持下来的训练选题。' },
          { title: '健身房观察员', text: '擅长发现动作误区、训练反馈和高讨论内容。' },
          { title: '轻运动陪练', text: '适合找低门槛、可执行的居家运动选题。' },
        ],
        'content-create': [
          { title: '陪练型教练', text: '语气鼓励感强，适合训练打卡和动作讲解。' },
          { title: '减脂实践派', text: '擅长结合饮食和训练输出真实经验内容。' },
          { title: '线条塑形顾问', text: '适合写局部塑形、训练思路和计划安排。' },
        ],
      },
      tech: {
        'topic-research': [
          { title: '数码情报员', text: '关注新品、参数亮点和用户争议点，适合选题研究。' },
          { title: '效率工具控', text: '擅长挖掘工作流、软件和设备搭配内容。' },
          { title: '理性开箱党', text: '从预算、场景和体验角度筛选题材。' },
        ],
        'content-create': [
          { title: '通俗科技嘴替', text: '能把复杂参数说人话，适合大多数用户阅读。' },
          { title: '桌面工作流博主', text: '适合写设备搭配、软件效率和桌搭内容。' },
          { title: '有结论的测评人', text: '更强调真实体验、优缺点和购买建议。' },
        ],
      },
      lifestyle: {
        'topic-research': [
          { title: '生活提案师', text: '擅长从日常习惯、家居和个人成长里找内容角度。' },
          { title: '氛围生活记录者', text: '偏爱治愈感、审美感和容易被收藏的生活选题。' },
          { title: '自我管理练习生', text: '适合时间管理、晨晚间例行和日常效率内容。' },
        ],
        'content-create': [
          { title: '温柔生活博主', text: '适合写治愈系日常、家居和仪式感内容。' },
          { title: '成长型分享者', text: '适合输出清单、习惯养成和经验总结。' },
          { title: '松弛感样本', text: '更适合轻松自然、有画面感的生活方式文案。' },
        ],
      },
    },

    // Task-level persona fallbacks (when no vertical-specific match)
    personaTaskFallbacks: {
      'viral-copy': [
        { title: '爆款拆解手', text: '擅长保留原内容结构优势，同时换成自己的表达和定位。' },
        { title: '同款重构编辑', text: '适合把热门内容重组为更符合当前账号调性的版本。' },
        { title: '结构复刻派', text: '关注开头钩子、信息节奏和收尾引导的复用。' },
      ],
      'comment-reply': [
        { title: '会聊天的主理人', text: '适合做高亲和度回复，增强账号真实互动感。' },
        { title: '懂梗回复官', text: '更适合轻松口语和带点幽默的互动场景。' },
        { title: '专业答疑型博主', text: '适合认真解释、建立可信度和权威感。' },
      ],
      publish: [
        { title: '内容操盘手', text: '关注封面、标题、发布时间和发布节奏。' },
        { title: '账号主理人', text: '兼顾内容质量和账号定位，适合持续更新。' },
        { title: '稳定输出型作者', text: '适合强调系列化、规范化和持续发布。' },
      ],
      'full-pipeline': [
        { title: '全链路内容主编', text: '从选题到发布都能统一风格，适合长期运营账号。' },
        { title: '小红书操盘手', text: '兼顾流量、调性和转化，适合完整运营流程。' },
        { title: '内容增长负责人', text: '更适合强调结果导向和账号增长目标。' },
      ],
    },

    // Bridge message config
    bridgeMessage: {
      taskField: 'opsTask',
      taskInstructions: {
        'topic-research': 'Run topic research for the "{{field:opsVertical}}" vertical. Generate {{field:opsTopicCount}} topic candidates with hooks, angles, and risk notes.',
        'content-create': 'Create {{field:opsTopicCount}} content drafts for the "{{field:opsVertical}}" vertical. Output structured posts (title, hook, body, CTA, hashtags).',
        'viral-copy': 'Analyze these viral note URLs and generate similar-structure posts:\n{{field:opsViralUrl}}',
        'comment-reply': 'Check notification page and reply to comments using the configured persona and tone.',
        'publish': 'Enter the creator backend and execute the publish flow. Stop at the publish button — do NOT auto-publish.',
        'full-pipeline': 'Run the full pipeline: topic research → content creation → publish preparation → review. Generate {{field:opsTopicCount}} candidates for the "{{field:opsVertical}}" vertical.',
      },
      template: 'Execute the {{skillId}} skill.\n\nTask: {{field:opsTask}}\n{{taskInstruction}}\n\nConfiguration:\n```json\n{{plan}}\n```\n\nReport each action as you go.',
    },

    // Card display config
    cardMeta: (plan, util) => [
      util.optionLabel('opsTask', plan.opsTask),
      util.optionLabel('opsVertical', plan.opsVertical),
      `生成 ${plan.opsTopicCount || 3} 条`,
    ],
    cardChip: (plan, util) => util.optionLabel('opsTask', plan.opsTask),
    summaryRows: (plan, util) => ({
      mode: '运营 · ' + util.optionLabel('opsTask', plan.opsTask),
      browse: util.optionLabel('opsVertical', plan.opsVertical),
      like: (plan.opsTopicCount || 3) + ' 条',
      collect: '-', comment: '-', follow: '-',
    }),
  },
];

// ========== Registry Utilities ==========

window.SkillRegistry = {
  get(id) {
    return (window.SKILL_REGISTRY || []).find(s => s.id === id) || null;
  },

  getLabel(id) {
    const skill = this.get(id);
    return skill ? skill.label.split('—')[0].trim() : id;
  },

  optionLabel(skill, fieldKey, value) {
    if (!skill) return value;
    const skillDef = typeof skill === 'string' ? this.get(skill) : skill;
    if (!skillDef) return value;
    const field = skillDef.fields.find(f => f.key === fieldKey);
    if (!field || !field.options) return value;
    const opt = field.options.find(o => o.value === value);
    return opt ? opt.label.split('—')[0].trim() : value;
  },

  getPersonaSuggestions(skillDef, task, vertical, verticalCustom) {
    if (!skillDef || !skillDef.personaSuggestions) return [];
    const verticalSet = skillDef.personaSuggestions[vertical] || {};
    const suggestions = [
      ...(verticalSet[task] || []),
      ...((skillDef.personaTaskFallbacks || {})[task] || []),
    ];
    if (vertical === 'custom' && verticalCustom && verticalCustom.trim()) {
      const vc = verticalCustom.trim();
      suggestions.unshift(
        { title: `${vc} 观察员`, text: `关注 ${vc} 领域的热门内容、用户痛点和可复制选题。` },
        { title: `${vc} 主理人`, text: `以稳定输出和鲜明观点建立该垂类的账号认知。` },
        { title: `${vc} 体验派`, text: `适合从真实体验、种草和避坑角度持续生产内容。` },
      );
    }
    const unique = [];
    const seen = new Set();
    suggestions.forEach(item => {
      const key = `${item.title}-${item.text}`;
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    });
    return unique.slice(0, 4);
  },

  resolveTemplate(template, plan, skillDef) {
    return template
      .replace(/\{\{field:(\w+)\}\}/g, (_, key) => plan[key] || '')
      .replace(/\{\{skillId\}\}/g, skillDef.id)
      .replace(/\{\{plan\}\}/g, JSON.stringify(plan, null, 2));
  },

  buildBridgeMessage(skillDef, plan) {
    const bm = skillDef.bridgeMessage;
    if (!bm) return null;
    let taskInstruction = '';
    if (bm.taskInstructions && bm.taskField) {
      const taskKey = plan[bm.taskField] || Object.keys(bm.taskInstructions)[0];
      taskInstruction = this.resolveTemplate(bm.taskInstructions[taskKey] || '', plan, skillDef);
    }
    return this.resolveTemplate(bm.template, plan, skillDef)
      .replace(/\{\{taskInstruction\}\}/g, taskInstruction);
  },
};
