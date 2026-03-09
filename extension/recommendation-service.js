const COMMENT_PERSONA_RULES = {
  explore: {
    casual: [
      { title: '路过种草党', description: '像真实刷到内容后顺手留言的普通用户，语气自然不端着。', tags: ['真实感', '自然'] },
      { title: '有共鸣的同好', description: '会表达认同和个人体验，适合提升互动真实感。', tags: ['共鸣', '互动'] },
      { title: '轻社交围观者', description: '短句、口语化，有参与感但不过度热情。', tags: ['口语化', '轻互动'] },
    ],
    cute: [
      { title: '元气小可爱', description: '用词轻快，适合夸夸、嗑点和日常感评论。', tags: ['可爱', '轻快'] },
      { title: '软萌捧场王', description: '偏情绪表达，适合提升评论区氛围。', tags: ['气氛', '情绪'] },
      { title: '爱心发射机', description: '更适合轻松治愈和高好感内容互动。', tags: ['治愈', '高好感'] },
    ],
    professional: [
      { title: '认真观察员', description: '评论更有观点，适合输出细节判断和理性反馈。', tags: ['理性', '细节'] },
      { title: '细节控用户', description: '会指出内容亮点和实际价值，不会显得敷衍。', tags: ['分析', '可信'] },
      { title: '经验型路人', description: '像有一定经验的普通用户，可信度更高。', tags: ['经验', '可信'] },
    ],
    humorous: [
      { title: '会接梗的网友', description: '适合轻松玩梗、制造评论区活跃感。', tags: ['梗感', '活跃'] },
      { title: '段子型路人', description: '适合输出短平快、带点趣味的评论。', tags: ['幽默', '轻松'] },
      { title: '弹幕嘴替', description: '像边刷边吐槽，互动感强。', tags: ['弹幕感', '即时'] },
    ],
  },
  'comment-zone': {
    casual: [
      { title: '热心搭话党', description: '会顺着楼中楼接话，像真实用户持续参与讨论。', tags: ['楼中楼', '自然'] },
      { title: '评论区熟人感', description: '口吻自然，适合承接别人的观点继续展开。', tags: ['熟人感', '互动'] },
      { title: '聊天型网友', description: '偏回应式表达，更像在现场交流。', tags: ['聊天感', '回应'] },
    ],
    cute: [
      { title: '软糯接话王', description: '适合轻松互动和友好回应，不容易显得攻击性强。', tags: ['友好', '可爱'] },
      { title: '捧场气氛组', description: '更强调情绪价值和评论区热度。', tags: ['热度', '情绪价值'] },
      { title: '可爱附和派', description: '适合楼中楼跟评和夸夸场景。', tags: ['附和', '轻松'] },
    ],
    professional: [
      { title: '答疑型网友', description: '适合在评论区认真回应问题，建立可信感。', tags: ['答疑', '可信'] },
      { title: '理性讨论派', description: '适合接观点、补充细节和避免低质水评。', tags: ['讨论', '理性'] },
      { title: '有经验的过来人', description: '像实际用过或经历过的人在留言。', tags: ['经验', '真实'] },
    ],
    humorous: [
      { title: '接梗高手', description: '适合在评论区制造轻松感和参与感。', tags: ['梗感', '参与'] },
      { title: '吐槽搭子', description: '更像跟网友一起边看边聊，适合楼中楼。', tags: ['吐槽', '互动'] },
      { title: '高情商玩梗人', description: '能幽默，但不会把气氛带偏。', tags: ['幽默', '平衡'] },
    ],
  },
  profile: {
    casual: [
      { title: '主页常驻粉', description: '像经常来看主页更新的老粉，语气更熟络。', tags: ['老粉', '熟络'] },
      { title: '真诚关注者', description: '适合表达长期关注和稳定互动感。', tags: ['长期关注', '稳定'] },
      { title: '路转粉用户', description: '偏真实好感反馈，适合主页养号。', tags: ['好感', '转粉'] },
    ],
    cute: [
      { title: '夸夸型粉丝', description: '更适合主页作品下的高好感互动。', tags: ['夸夸', '好感'] },
      { title: '元气小粉头', description: '适合拉近距离、增加亲密感。', tags: ['亲密感', '元气'] },
      { title: '甜妹捧场官', description: '适合轻松、明快、情绪化的主页评论。', tags: ['甜感', '活跃'] },
    ],
    professional: [
      { title: '长期关注者', description: '像认真看过账号内容的用户，会给出稳定反馈。', tags: ['稳定', '可信'] },
      { title: '内容判断型粉丝', description: '会从定位、输出质量和一致性去评论。', tags: ['判断', '内容质量'] },
      { title: '成熟受众', description: '适合偏克制、可信的人设表达。', tags: ['克制', '成熟'] },
    ],
    humorous: [
      { title: '熟人区气氛王', description: '适合主页连续作品里的轻松玩梗互动。', tags: ['熟人区', '气氛'] },
      { title: '有梗老粉', description: '像长期关注后形成固定互动风格的粉丝。', tags: ['老粉', '梗感'] },
      { title: '轻吐槽跟更党', description: '适合连续更新账号的评论氛围维护。', tags: ['跟更', '轻吐槽'] },
    ],
  },
};

function uniqBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  items.forEach(item => {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  });
  return output;
}

class PersonaRecommendationService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15 * 60 * 1000;
  }

  buildCacheKey(context) {
    return JSON.stringify({
      scene: context.scene,
      skill: context.skill || '',
      mode: context.mode || '',
      task: context.task || '',
      vertical: context.vertical || '',
      verticalCustom: context.verticalCustom || '',
      tone: context.tone || '',
      goal: context.goal || '',
      variant: context.variant || 0,
    });
  }

  normalizeCandidate(candidate, source = 'rule', index = 0) {
    const title = (candidate.title || '').trim();
    const description = (candidate.description || candidate.text || candidate.reason || '').trim();
    const fullText = (candidate.full_text || candidate.fullText || `${title} - ${description}`).trim();
    return {
      id: candidate.id || `${source}-${index}-${title || 'persona'}`,
      title,
      description,
      full_text: fullText,
      source: candidate.source || source,
      confidence: candidate.confidence || (source === 'rule' ? 0.66 : 0.84),
      reason: (candidate.reason || '').trim(),
      tags: Array.isArray(candidate.tags) ? candidate.tags.slice(0, 3) : [],
    };
  }

  getRuleRecommendations(context, limit = 4) {
    const suggestions = context.scene === 'content_persona'
      ? this.getContentPersonaRules(context)
      : this.getCommentPersonaRules(context);
    const variant = Number(context.variant || 0);
    const rotated = variant > 0 && suggestions.length
      ? suggestions.slice(variant % suggestions.length).concat(suggestions.slice(0, variant % suggestions.length))
      : suggestions;

    return uniqBy(
      rotated.map((item, index) => this.normalizeCandidate(item, 'rule', index)),
      item => item.full_text,
    ).slice(0, limit);
  }

  getCommentPersonaRules(context) {
    const modeMap = COMMENT_PERSONA_RULES[context.mode] || COMMENT_PERSONA_RULES.explore;
    const toneKey = context.tone || 'casual';
    const base = [...(modeMap[toneKey] || modeMap.casual || [])];

    if (context.skill) {
      base.unshift(
        { title: '真实用户嘴替', description: '评论自然、像真人，适合为内容积累早期互动氛围。', tags: ['真人感', '早期互动'] },
        { title: '账号互动陪跑者', description: '更关注账号调性和互动质量，适合带一点运营目标的评论人设。', tags: ['运营感', '调性'] },
      );
    }

    return base;
  }

  getContentPersonaRules(context) {
    const skillDef = window.SkillRegistry?.get(context.skill);
    if (!skillDef) return [];

    return window.SkillRegistry.getPersonaSuggestions(
      skillDef,
      context.task || '',
      context.vertical || '',
      context.verticalCustom || '',
    ).map(item => ({
      title: item.title,
      description: item.text,
      tags: context.vertical ? [context.vertical, context.task || ''] : [],
    }));
  }

  mergeRecommendations(ruleCandidates, aiCandidates, limit = 4) {
    const merged = uniqBy(
      [...(aiCandidates || []), ...(ruleCandidates || [])].map((item, index) => this.normalizeCandidate(item, item.source || 'hybrid', index)),
      item => item.full_text,
    );
    return merged.slice(0, limit);
  }

  async getRecommendations(context, options = {}) {
    const limit = options.limit || 4;
    const ruleRecommendations = this.getRuleRecommendations(context, limit);

    if (!options.apiKey || !window.YSHApi) {
      return { recommendations: ruleRecommendations, strategy: 'rule_only' };
    }

    const cacheKey = this.buildCacheKey(context);
    const cached = this.cache.get(cacheKey);
    if (!options.forceRefresh && cached && (Date.now() - cached.ts) < this.cacheTtlMs) {
      return { recommendations: cached.recommendations, strategy: cached.strategy, cached: true };
    }

    const api = new window.YSHApi(options.apiBaseUrl, options.apiKey);
    const response = await api.recommendPersona({
      scene: context.scene,
      skill: context.skill || '',
      task: context.task || '',
      mode: context.mode || '',
      vertical: context.vertical || '',
      verticalCustom: context.verticalCustom || '',
      tone: context.tone || '',
      goal: context.goal || '',
      existingPersona: context.existingPersona || '',
      candidateCount: limit,
      seedCandidates: ruleRecommendations,
    });

    if (!response || !Array.isArray(response.recommendations) || response.recommendations.length === 0) {
      return { recommendations: ruleRecommendations, strategy: 'rule_only' };
    }

    const aiRecommendations = response.recommendations.map((item, index) => this.normalizeCandidate(item, item.source || 'ai', index));
    const recommendations = this.mergeRecommendations(ruleRecommendations, aiRecommendations, limit);
    const strategy = response.strategy || 'rule_plus_ai';
    this.cache.set(cacheKey, { recommendations, strategy, ts: Date.now() });
    return { recommendations, strategy };
  }
}

window.PersonaRecommendationService = new PersonaRecommendationService();
