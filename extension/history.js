// 重复交互防止 - 维护已互动笔记 ID 集合
const InteractionHistory = {
  STORAGE_KEY: 'interactionHistory',
  EXPIRY_DAYS: 30,

  /**
   * 获取所有历史记录 (内部方法)
   * @returns {Promise<Object>} { noteId: timestamp, ... }
   */
  async _getAll() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY], (data) => {
        resolve(data[this.STORAGE_KEY] || {});
      });
    });
  },

  /**
   * 保存历史记录 (内部方法)
   */
  async _saveAll(history) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: history }, resolve);
    });
  },

  /**
   * 检查笔记是否已互动过
   * @param {string} noteId - 笔记 ID
   * @returns {Promise<boolean>}
   */
  async hasInteracted(noteId) {
    if (!noteId) return false;
    const history = await this._getAll();
    return !!history[noteId];
  },

  /**
   * 标记笔记为已互动
   * @param {string} noteId - 笔记 ID
   */
  async markInteracted(noteId) {
    if (!noteId) return;
    const history = await this._getAll();
    history[noteId] = Date.now();
    await this._saveAll(history);
  },

  /**
   * 清理 30 天前的过期记录
   * @returns {Promise<number>} 清理的记录数
   */
  async cleanExpired() {
    const history = await this._getAll();
    const cutoff = Date.now() - this.EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [noteId, timestamp] of Object.entries(history)) {
      if (timestamp < cutoff) {
        delete history[noteId];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this._saveAll(history);
    }
    return cleaned;
  },

  /**
   * 获取已互动笔记总数
   * @returns {Promise<number>}
   */
  async getCount() {
    const history = await this._getAll();
    return Object.keys(history).length;
  },

  /**
   * 清除所有记录
   */
  async clearAll() {
    await this._saveAll({});
  },
};

if (typeof window !== 'undefined') {
  window.InteractionHistory = InteractionHistory;
}
