// API 调用封装 - 养薯户后端通信
class YSHApi {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl || 'https://api.yangshuhu.com';
    this.apiKey = apiKey || '';
  }

  async _request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (this.apiKey) {
      options.headers['X-API-Key'] = this.apiKey;
    }
    if (body) {
      options.body = JSON.stringify(body);
    }
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`[YSHApi] Request failed: ${endpoint}`, err);
      return null;
    }
  }

  /**
   * 记录操作统计
   * @param {string} action - 操作类型: browse/like/collect/comment/follow
   * @param {string} detail - 操作详情描述
   */
  async recordStat(action, detail) {
    return this._request('/api/stats/record', 'POST', {
      action,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * AI 生成评论
   * @param {string} content - 笔记标题+正文
   * @param {string} style - 评论风格: positive/curious/share/random
   * @returns {Promise<{comment: string}|null>}
   */
  async generateComment(content, style) {
    return this._request('/api/ai/comment', 'POST', {
      content,
      style,
    });
  }

  /**
   * AI 生成人设推荐
   * @param {object} payload - 推荐上下文
   * @returns {Promise<{recommendations: Array, strategy: string}|null>}
   */
  async recommendPersona(payload) {
    return this._request('/api/ai/recommend/persona', 'POST', payload);
  }

  /**
   * 获取订阅信息
   * @returns {Promise<{plan: string, expireAt: string}|null>}
   */
  async getSubscription() {
    return this._request('/api/subscription/current');
  }

  /**
   * 获取操作摘要统计
   * @param {number} days - 查询天数
   * @returns {Promise<{summary: object}|null>}
   */
  async getSummary(days) {
    return this._request(`/api/stats/summary?days=${days}`);
  }
}

// 全局单例，content.js 和 background.js 均可使用
if (typeof window !== 'undefined') {
  window.YSHApi = YSHApi;
}
