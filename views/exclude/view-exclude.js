/**
 * 视图层：排除页（v2.0.9 新增）
 * @namespace ViewExclude
 * 职责：只做 DOM 操作，不包含业务计算
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 *
 * 文件拆分原则：
 * - 排除页 1 个页面 = 1 个子目录
 * - 当前只有 view-exclude.js 共享逻辑，后续如需拆分多个标签页，
 *   命名为 view-exclude-<tabname>.js 即可
 *
 * v2.1.0 新增：作为按需加载入口，引导 view-impossible.js 的脚本注入
 * （避免修改 index.html 已有的 script 引入列表——遵循项目宪法 HTML 保护）
 *
 * 当前内容：仅渲染占位空状态，后续扩展：
 * - 号码排除（已存在的 mod-exclude 卡片可平移过来）
 * - 多维排除（生肖+波色+五行+尾数 组合）
 * - 智能排除（基于历史数据的反推排除）
 */
const ViewExclude = {
  /** v2.1.0 新增：按需加载 guard，幂等保证只加载一次 */
  _impossibleLoaderPromise: null,

  /**
   * 加载 view-impossible.js（v2.1.0 按需加载入口）。
   * 由 initGiongTab 调用前异步预热；也支持重复调用幂等返回同一 Promise。
   * @returns {Promise<void>}
   */
  ensureImpossibleLoaded: function() {
    const self = this;
    if (typeof ViewImpossible !== 'undefined') return Promise.resolve();
    if (self._impossibleLoaderPromise) return self._impossibleLoaderPromise;

    self._impossibleLoaderPromise = new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'views/exclude/view-impossible.js';
      s.async = true;
      s.onload = function() {
        resolve();
      };
      s.onerror = function() {
        self._impossibleLoaderPromise = null;
        reject(new Error('加载 view-impossible.js 失败'));
      };
      document.head.appendChild(s);
    });
    return self._impossibleLoaderPromise;
  },

  /**
   * 渲染排除页：显示 excludePage，隐藏其他 page，重置顶部/底部 UI
   * 被 Business.switchExcludePage() 调用
   */
  render: () => {
    // 1) 隐藏所有 page，只显示 excludePage
    const pages = ['filterPage', 'analysisPage', 'randomPage', 'profilePage', 'excludePage'];
    pages.forEach(function(pageId) {
      const pageEl = document.getElementById(pageId);
      if (pageEl) {
        const isActive = (pageId === 'excludePage');
        pageEl.style.display = isActive ? 'block' : 'none';
        pageEl.classList.toggle('active', isActive);
      }
    });

    // 2) 取消底部 nav 高亮（excludePage 不在底部 nav 里）
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(function(el) { el.classList.remove('active'); });

    // 3) 隐藏 topBox（顶部操作栏）
    const topBox = document.getElementById('topBox');
    if (topBox) topBox.style.display = 'none';

    // 4) body-box 顶部 margin 调整（与 switchBottomNavUI 中非主页保持一致）
    const bodyBox = document.querySelector('.body-box');
    if (bodyBox) bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';

    // 5) 隐藏快捷导航栏（excludePage 是独立页，不显示主页快捷导航）
    const quickNav = document.getElementById('quickNav');
    if (quickNav) quickNav.style.display = 'none';

    // 6) 收起快捷导航（避免从 filter 页面带入展开态）
    if (typeof Business !== 'undefined' && Business.toggleQuickNav) {
      Business.toggleQuickNav(false);
    }

    // 7) 滚动 .page-scroll 回到顶部（避免从 filter 页面带入滚动位置）
    const scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }
};
