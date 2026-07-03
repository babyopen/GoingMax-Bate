/**
 * 业务层：用户书签（2026-07-04 新增）
 * 职责：
 *   1. 书签的增删查（数据流：localStorage ↔ state.bookmarks）
 *   2. URL 合法性校验（含协议补全）
 *   3. 提供「打开书签」的 URL 解析（供视图层加载到 iframe）
 *
 * 严格遵守分层规范：
 *   ❌ 禁止 document / innerHTML / style / DOM 操作
 *   ❌ 禁止获取 DOM 元素
 *   ✅ 只做：数据处理、算法、逻辑
 */
const BusinessBookmark = {

  /**
   * 从 localStorage 加载书签到 state（应用启动时调用一次）
   */
  initBookmarks: () => {
    const list = Storage.loadBookmarks();
    StateManager._state.bookmarks = list;
  },

  /**
   * 获取书签列表（深拷贝，避免外部修改 state）
   * @returns {Array} 书签数组
   */
  getBookmarks: () => {
    return Utils.deepClone(StateManager._state.bookmarks || []);
  },

  /**
   * URL 合法性校验：自动补全 https://，过滤明显非法的输入
   * @param {string} raw - 原始输入
   * @returns {string|null} 合法 URL；非法返回 null
   */
  normalizeUrl: (raw) => {
    if (typeof raw !== 'string') return null;
    const url = raw.trim();
    if (!url) return null;
    // 自动补全协议
    let full = url;
    if (!/^https?:\/\//i.test(full)) {
      full = 'https://' + full;
    }
    try {
      const u = new URL(full);
      // 必须有 hostname
      if (!u.hostname || u.hostname.indexOf('.') < 0) return null;
      return u.toString();
    } catch (e) {
      return null;
    }
  },

  /**
   * 添加书签（校验 → 持久化 → 同步 state → 返回新书签）
   * @param {string} title - 书签名
   * @param {string} url - 原始 URL 输入
   * @returns {Object} { ok: boolean, bookmark?: Object, error?: string }
   */
  addBookmark: (title, url) => {
    const safeTitle = (title || '').trim();
    if (!safeTitle) return { ok: false, error: '请填写书签名' };

    const safeUrl = BusinessBookmark.normalizeUrl(url);
    if (!safeUrl) return { ok: false, error: '网址格式不合法' };

    const bookmark = Storage.addBookmark({ title: safeTitle, url: safeUrl });
    if (!bookmark) return { ok: false, error: '保存失败，存储可能已满' };

    // 同步到 state（前置插入，与 loadBookmarks 一致）
    const list = StateManager._state.bookmarks || [];
    StateManager._state.bookmarks = [bookmark, ...list.filter(b => b.id !== bookmark.id)];
    return { ok: true, bookmark: bookmark };
  },

  /**
   * 删除书签（按 id）
   * @param {number} id - 书签 id
   * @returns {boolean} 是否成功
   */
  removeBookmark: (id) => {
    const ok = Storage.removeBookmark(id);
    if (ok) {
      const list = StateManager._state.bookmarks || [];
      StateManager._state.bookmarks = list.filter(b => b.id !== id);
    }
    return ok;
  },

  /**
   * 校验是否允许打开书签（iframe 受 sandbox 限制时仍可通过此函数判断）
   * 仅做基础校验：url 字符串非空 + 可被 URL 解析
   * @param {string} url
   * @returns {boolean}
   */
  isOpenableUrl: (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
      const u = new URL(url);
      return !!u.hostname;
    } catch (e) {
      return false;
    }
  }
};
