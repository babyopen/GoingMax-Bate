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
 * 当前内容：仅渲染占位空状态，后续扩展：
 * - 号码排除（已存在的 mod-exclude 卡片可平移过来）
 * - 多维排除（生肖+波色+五行+尾数 组合）
 * - 智能排除（基于历史数据的反推排除）
 */
const ViewExclude = {
  /**
   * 渲染排除页：显示 excludePage，隐藏其他 page，重置顶部/底部 UI
   * 被 Business.switchExcludePage() 调用
   */
  render: () => {
    // 1) 隐藏所有 page，只显示 excludePage
    var pages = ['filterPage', 'analysisPage', 'randomPage', 'profilePage', 'excludePage'];
    pages.forEach(function(pageId) {
      var pageEl = document.getElementById(pageId);
      if (pageEl) {
        var isActive = (pageId === 'excludePage');
        pageEl.style.display = isActive ? 'block' : 'none';
        pageEl.classList.toggle('active', isActive);
      }
    });

    // 2) 取消底部 nav 高亮（excludePage 不在底部 nav 里）
    var bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(function(el) { el.classList.remove('active'); });

    // 3) 隐藏 topBox（顶部操作栏）
    var topBox = document.getElementById('topBox');
    if (topBox) topBox.style.display = 'none';

    // 4) body-box 顶部 margin 调整（与 switchBottomNavUI 中非主页保持一致）
    var bodyBox = document.querySelector('.body-box');
    if (bodyBox) bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';

    // 5) 隐藏快捷导航栏（excludePage 是独立页，不显示主页快捷导航）
    var quickNav = document.getElementById('quickNav');
    if (quickNav) quickNav.style.display = 'none';

    // 6) 收起快捷导航（避免从 filter 页面带来展开态）
    if (typeof Business !== 'undefined' && Business.toggleQuickNav) {
      Business.toggleQuickNav(false);
    }

    // 7) 滚动 .page-scroll 回到顶部（避免从 filter 页面带入滚动位置）
    var scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }
};
