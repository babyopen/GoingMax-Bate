/**
 * 视图层：用户书签管理（2026-07-04 新增）
 * 职责：
 *   1. 在个人中心页「我的」面板注入书签管理卡片（仅保留 iframe 容器）
 *   2. 渲染书签标签到快捷导航栏内（#navTabs）
 *   3. 显示/隐藏书签输入弹窗（双输入：标题 + URL）
 *   4. iframe 加载书签 URL
 *
 * 严格遵守分层规范：
 *   ❌ 禁止业务计算（URL 校验交由 BusinessBookmark）
 *   ❌ 禁止写存储/状态变更（交由 BusinessBookmark）
 *   ✅ 只做 DOM 渲染与展示
 *
 * 2026-08-14 变更：书签列表从「我的」面板迁移到快捷导航栏；
 *                 「+书签」按钮（#bookmarkAddBtn）也在快捷导航栏内。
 */
const ViewBookmark = {

  _inputModal: null, // 双输入弹窗引用

  // ============================================================
  // 2026-07-04 新增：HTML 构造函数（纯字符串拼接，从原函数拆出）
  // 目的：降低原函数复杂度，提升可读性；原函数改为调用此处
  // 2026-08-14 调整：移除书签列表部分，仅保留 iframe 容器
  // ============================================================

  /**
   * 构造书签管理卡片主体 HTML
   * 2026-08-14 调整：去除 .card / .card-body 嵌套，只保留 #bookmarkIframeWrap 一个容器
   * @returns {string}
   */
  _buildCardBodyHtml: function() {
    // 悬浮按钮通用样式：右上角圆形半透明背景，绝对定位
    const floatBtnBase = 'position:absolute;top:8px;width:36px;height:36px;border:none;border-radius:50%;' +
      'background:rgba(0,0,0,0.55);color:#fff;cursor:pointer;z-index:10;' +
      'display:flex;align-items:center;justify-content:center;font-size:16px;' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.3);';
    return '<div id="bookmarkIframeWrap" style="display:none;width:100%;height:100%;min-height:0;position:relative;">' +
      '<iframe id="bookmarkIframe" ' +
        'sandbox="allow-scripts allow-forms allow-popups allow-same-origin" ' +
        'style="position:absolute;top:0;left:0;width:100%;height:100%;border:1px solid var(--border);border-radius:8px;background:#fff;">' +
      '</iframe>' +
      // 2026-08-14 新增：刷新悬浮按钮（右上角偏左）
      '<button data-action="refreshBookmarkIframe" ' +
        'title="刷新当前页面" aria-label="刷新" ' +
        'style="' + floatBtnBase + 'right:52px;">' +
        '<i class="fa-solid fa-rotate-right"></i>' +
      '</button>' +
      // 2026-08-14 新增：关闭悬浮按钮（右上角）
      '<button data-action="closeBookmarkIframe" ' +
        'title="关闭" aria-label="关闭" ' +
        'style="' + floatBtnBase + 'right:8px;">' +
        '<i class="fa-solid fa-xmark"></i>' +
      '</button>' +
    '</div>';
  },

  /**
   * 构造单个书签标签 HTML
   * @param {Object} b - 书签对象 { id, title, url }
   * @returns {string}
   */
  _buildBookmarkTagHtml: function(b) {
    return '<div class="bookmark-tag" data-action="openBookmark" data-bookmark-id="' + b.id + '" ' +
      'title="' + ViewBookmark._escape(b.url) + '" ' +
      'style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:var(--bg-secondary);color:var(--text);border-radius:16px;font-size:13px;font-weight:500;cursor:pointer;user-select:none;-webkit-user-select:none;border:1px solid transparent;transition:all var(--anim-fast);">' +
      '<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ViewBookmark._escape(b.title) + '</span>' +
    '</div>';
  },

  /**
   * 切换快捷导航栏内书签标签的高亮态（2026-08-14 新增）
   * @param {number|string|null} activeId - 当前打开的书签 ID；传 null 时清除所有高亮
   */
  _highlightActiveTag: function(activeId) {
    const wrapInNav = document.getElementById('bookmarkTagListInNav');
    if (!wrapInNav) return;
    const tags = wrapInNav.querySelectorAll('.bookmark-tag');
    tags.forEach(function(tag) {
      const tagId = String(tag.dataset.bookmarkId || '');
      const isActive = activeId !== null && activeId !== undefined && tagId === String(activeId);
      // 激活态：主色背景 + 白字 + 边框；普通态：默认浅灰背景
      if (isActive) {
        tag.style.background = 'var(--primary)';
        tag.style.color = '#fff';
        tag.style.borderColor = 'var(--primary)';
        tag.style.fontWeight = '700';
      } else {
        tag.style.background = 'var(--bg-secondary)';
        tag.style.color = 'var(--text)';
        tag.style.borderColor = 'transparent';
        tag.style.fontWeight = '500';
      }
    });
  },

  /**
   * 构造空书签提示 HTML
   * @returns {string}
   */
  _buildEmptyListHtml: function() {
    return '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
      '暂无书签，长按面板可添加' +
    '</div>';
  },

  /**
   * 构造输入弹窗主体 HTML（标题 + URL + 按钮组）
   * @returns {string}
   */
  _buildInputModalBodyHtml: function() {
    let html = '<div style="background:var(--card,#fff);border-radius:14px;padding:20px;width:90%;max-width:360px;box-shadow:0 10px 40px rgba(0,0,0,0.3);">';
    html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px;text-align:center;">添加网址书签</div>';

    html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">书签名</div>';
    html += '<input id="bookmarkInputTitle" type="text" placeholder="如：官方预测" ' +
      'style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;margin-bottom:12px;background:var(--card);color:var(--text);">';

    html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">网址（可省略 https://）</div>';
    html += '<input id="bookmarkInputUrl" type="url" placeholder="如：example.com" ' +
      'style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;margin-bottom:16px;background:var(--card);color:var(--text);">';

    html += '<div style="display:flex;gap:10px;">';
    html += '<button data-action="bookmarkInputCancel" ' +
      'style="flex:1;padding:11px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:14px;cursor:pointer;">取消</button>';
    html += '<button data-action="bookmarkInputConfirm" ' +
      'style="flex:1;padding:11px;border:none;border-radius:8px;background:#007AFF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">保存并打开</button>';
    html += '</div>';

    html += '</div>';
    return html;
  },

  /**
   * 构造长按菜单主体 HTML（标题 + items + 取消）
   * @param {string} safeTitle - 已转义的标题
   * @param {Array} items - 菜单项数组
   * @returns {string}
   */
  _buildLongPressMenuBodyHtml: function(safeTitle, items) {
    let html = '<div style="background:var(--card,#fff);width:100%;max-width:420px;border-radius:14px 14px 0 0;padding:6px 0 18px;">';
    html += '<div style="padding:14px 16px;font-size:13px;color:var(--text-secondary);border-bottom:1px solid var(--border);">';
    html += '已选择：<span style="color:var(--text);font-weight:600;">' + safeTitle + '</span>';
    html += '</div>';
    items.forEach(function(item) {
      const color = item.danger ? '#FF3B30' : 'var(--text)';
      html += '<div data-action="' + ViewBookmark._escape(item.action) + '" ' +
        (item.payload ? 'data-payload=\'' + ViewBookmark._escape(String(item.payload)) + '\'' : '') +
        ' style="padding:14px 16px;font-size:15px;color:' + color + ';cursor:pointer;border-bottom:1px solid var(--border);">' +
        ViewBookmark._escape(item.label) +
      '</div>';
    });
    html += '<div data-action="closeLongPressMenu" style="padding:14px 16px;font-size:15px;color:#FF3B30;text-align:center;cursor:pointer;margin-top:6px;">取消</div>';
    html += '</div>';
    return html;
  },

  // ============================================================
  // 2026-07-04 新增：patch 式更新（性能优化，仅 patch 单节点）
  // 入口：refreshListPatch() —— 新增/删除流程可选用
  // 原 refreshList() 保持不变，向后兼容
  // ============================================================

  /**
   * patch 式刷新书签标签（增量更新单个 tag，避免整段 innerHTML 重建）
   * 2026-08-14 变更：操作目标从 #bookmarkList 改为 #bookmarkTagListInNav（快捷导航栏内）
   * @param {Object} [opts]
   * @param {number} [opts.addedId] - 新增的书签 id（仅新增该节点）
   * @param {number} [opts.removedId] - 删除的书签 id（仅移除该节点）
   * @param {boolean} [opts.full] - 强制全量重建（默认 false）
   */
  refreshListPatch: function(opts) {
    opts = opts || {};
    const wrapInNav = document.getElementById('bookmarkTagListInNav');

    // 全量重建路径
    if (opts.full || (!opts.addedId && !opts.removedId)) {
      ViewBookmark.refreshList();
      return;
    }

    const list = BusinessBookmark.getBookmarks();

    if (opts.removedId) {
      const sel = '.bookmark-tag[data-bookmark-id="' + opts.removedId + '"]';
      if (wrapInNav) {
        const tagEl = wrapInNav.querySelector(sel);
        if (tagEl && tagEl.parentNode) tagEl.parentNode.removeChild(tagEl);
        // 删空后显示空提示
        if (!list.length) {
          wrapInNav.innerHTML = ViewBookmark._buildEmptyListHtml();
        }
      }
      return;
    }

    if (opts.addedId) {
      const target = list.find(function(b) { return b.id === opts.addedId; });
      if (!target) return;
      if (wrapInNav) {
        // 当前是空提示 → 整体替换为标签容器
        if (!wrapInNav.querySelector('.bookmark-tag')) {
          wrapInNav.innerHTML = ViewBookmark.renderNavListHtml();
        } else {
          const tmp = document.createElement('div');
          tmp.innerHTML = ViewBookmark._buildBookmarkTagHtml(target);
          const newTag = tmp.firstElementChild;
          if (newTag) wrapInNav.appendChild(newTag);
        }
      }
    }
  },

  /**
   * 渲染书签管理卡片到 #profileMinePanel（动态注入，幂等）
   * 2026-08-14 变更：去除 .card / .card-body 嵌套，直接把 #bookmarkIframeWrap 挂到面板下
   */
  renderBookmarkCard: function() {
    const panel = document.getElementById('profileMinePanel');
    if (!panel) return;
    if (document.getElementById('bookmarkIframeWrap')) return;

    // 直接创建 #bookmarkIframeWrap 容器并挂到面板下（无 card / card-body 包装）
    const tmp = document.createElement('div');
    tmp.innerHTML = ViewBookmark._buildCardBodyHtml().trim();
    const wrap = tmp.firstElementChild;
    if (wrap) panel.appendChild(wrap);
  },

  /**
   * 渲染快捷导航栏内的书签标签
   * 2026-08-14 新增：把书签列表注入到 #navTabs 内，与「+书签」按钮并排显示
   * @param {Element} navTabsEl - 快捷导航容器元素
   */
  renderBookmarkTagsIntoNav: function(navTabsEl) {
    if (!navTabsEl) return;
    // 已注入则跳过（幂等）
    if (document.getElementById('bookmarkTagListInNav')) return;

    const list = BusinessBookmark.getBookmarks();
    const wrap = document.createElement('div');
    wrap.id = 'bookmarkTagListInNav';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:8px;';

    if (!list.length) {
      wrap.innerHTML = '';
    } else {
      wrap.innerHTML = list.map(function(b) { return ViewBookmark._buildBookmarkTagHtml(b); }).join('');
    }

    // 追加到「+书签」按钮之后（末尾）
    navTabsEl.appendChild(wrap);
  },

  /**
   * 渲染快捷导航栏内书签列表的 HTML（用于空列表/全量重建）
   * 2026-08-14 新增
   * @returns {string}
   */
  renderNavListHtml: function() {
    const list = BusinessBookmark.getBookmarks();
    if (!list.length) {
      return ViewBookmark._buildEmptyListHtml();
    }
    return list.map(function(b) { return ViewBookmark._buildBookmarkTagHtml(b); }).join('');
  },

  /**
   * 渲染书签列表 HTML（从 state 读取）
   * 2026-08-14 变更：保留方法签名以兼容旧调用，但不再被默认调用；快捷导航栏改用 renderNavListHtml
   * @returns {string} HTML 片段
   */
  renderListHtml: function() {
    return ViewBookmark.renderNavListHtml();
  },

  /**
   * 刷新书签列表 DOM（调用场景：新增/删除/初始化后）
   * 2026-08-14 变更：刷新目标改为快捷导航栏内的 #bookmarkTagListInNav
   */
  refreshList: function() {
    const wrapInNav = document.getElementById('bookmarkTagListInNav');
    if (wrapInNav) {
      wrapInNav.innerHTML = ViewBookmark.renderNavListHtml();
    }
  },

  /**
   * 显示双输入弹窗（标题 + URL）
   */
  showInputModal: function() {
    if (!ViewBookmark._inputModal) {
      ViewBookmark._initInputModal();
    }
    ViewBookmark._inputModal._title.value = '';
    ViewBookmark._inputModal._url.value = '';
    ViewBookmark._inputModal._modal.style.display = 'flex';
    setTimeout(function() {
      ViewBookmark._inputModal._title.focus();
    }, 100);
  },

  /**
   * 隐藏输入弹窗
   */
  hideInputModal: function() {
    if (ViewBookmark._inputModal) {
      ViewBookmark._inputModal._modal.style.display = 'none';
    }
  },

  /**
   * 初始化双输入弹窗（首次显示时调用，幂等）
   */
  _initInputModal: function() {
    const overlay = document.createElement('div');
    overlay.id = 'bookmarkInputModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;z-index:10001;';

    // 2026-07-04 重构：弹窗主体 HTML 挪到 _buildInputModalBodyHtml
    overlay.innerHTML = ViewBookmark._buildInputModalBodyHtml();
    document.body.appendChild(overlay);

    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) ViewBookmark.hideInputModal();
    });

    ViewBookmark._inputModal = {
      _modal: overlay,
      _title: document.getElementById('bookmarkInputTitle'),
      _url: document.getElementById('bookmarkInputUrl')
    };

    // 回车提交
    const submit = function() {
      ViewBookmark._submitInput();
    };
    ViewBookmark._inputModal._title.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); ViewBookmark._inputModal._url.focus(); }
    });
    ViewBookmark._inputModal._url.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  },

  /**
   * 提交输入：调用业务层保存 + 打开
   */
  _submitInput: function() {
    if (!ViewBookmark._inputModal) return;
    const title = ViewBookmark._inputModal._title.value;
    const url = ViewBookmark._inputModal._url.value;
    const result = BusinessBookmark.addBookmark(title, url);
    if (!result.ok) {
      Toast.show(result.error || '保存失败');
      return;
    }
    ViewBookmark.hideInputModal();
    // 2026-07-04 性能优化：新增用 patch 入口，仅插入单个 tag
    ViewBookmark.refreshListPatch({ addedId: result.bookmark.id });
    // 自动打开刚添加的书签
    ViewBookmark.openInIframe(result.bookmark.url, result.bookmark.title, result.bookmark.id);
  },

  /**
   * 在 iframe 中加载指定 URL
   * @param {string} url - 已校验的合法 URL
   * @param {string} title - 显示标题
   * @param {number|string} [bookmarkId] - 书签 ID，用于识别"重复点击同一书签"以触发刷新
   */
  openInIframe: function(url, title, bookmarkId) {
    if (!BusinessBookmark.isOpenableUrl(url)) {
      Toast.show('网址无效，无法打开');
      return;
    }
    const wrap = document.getElementById('bookmarkIframeWrap');
    const iframe = document.getElementById('bookmarkIframe');
    if (!wrap || !iframe) return;

    // 重复点击同一书签时强制刷新 iframe
    // 通过 about:blank 中转 + requestAnimationFrame 确保浏览器真正重新加载页面
    //（直接赋相同 src 浏览器不会触发 reload；用 ID 识别避免 URL 字符串比较的坑）
    const isRepeat = (bookmarkId !== undefined && bookmarkId !== null
      && ViewBookmark._currentBookmarkId !== undefined
      && String(ViewBookmark._currentBookmarkId) === String(bookmarkId));

    if (isRepeat) {
      iframe.src = 'about:blank';
      // 双层异步确保 about:blank 先提交，再赋值新 URL
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          iframe.src = url;
        });
      });
    } else {
      iframe.src = url;
    }
    ViewBookmark._currentBookmarkId = bookmarkId;
    ViewBookmark._currentUrl = url;
    // 2026-08-14：同步高亮当前书签标签（快捷导航栏内）
    ViewBookmark._highlightActiveTag(bookmarkId);
    // 2026-08-14：标题已不再单独显示，记录到内部供刷新等场景使用
    wrap.style.display = 'block';
    // 滚动到 iframe 区域
    setTimeout(function() {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  },

  /**
   * 关闭 iframe 容器
   */
  closeIframe: function() {
    const wrap = document.getElementById('bookmarkIframeWrap');
    const iframe = document.getElementById('bookmarkIframe');
    if (wrap) wrap.style.display = 'none';
    if (iframe) iframe.src = '';
    // 关闭后清空当前书签记录，避免下次打开其它书签被误判为"重复点击"
    ViewBookmark._currentBookmarkId = null;
    ViewBookmark._currentUrl = null;
    // 2026-08-14：关闭时清除所有书签标签的高亮态
    ViewBookmark._highlightActiveTag(null);
  },

  /**
   * 刷新当前 iframe 中的页面（2026-08-14 新增）
   * 通过 about:blank 中转 + 双层 requestAnimationFrame 确保浏览器真正重新加载页面
   * 适用于悬浮"刷新"按钮调用
   */
  refreshIframe: function() {
    const iframe = document.getElementById('bookmarkIframe');
    if (!iframe) return;
    const url = ViewBookmark._currentUrl;
    if (!url) {
      Toast.show('当前无可刷新的页面');
      return;
    }
    // 中转刷新（与 openInIframe 中"重复点击"逻辑同源，确保稳定触发 reload）
    iframe.src = 'about:blank';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        iframe.src = url;
      });
    });
  },

  /**
   * 删除指定书签（含确认）
   * @param {number} id
   */
  deleteBookmarkWithConfirm: function(id) {
    const list = BusinessBookmark.getBookmarks();
    const target = list.find(function(b) { return b.id === id; });
    if (!target) return;
    const ok = BusinessBookmark.removeBookmark(id);
    if (ok) {
      Toast.show('已删除');
      // 2026-07-04 性能优化：删除用 patch 入口，仅移除单个 tag
      ViewBookmark.refreshListPatch({ removedId: id });
    } else {
      Toast.show('删除失败');
    }
  },

  /**
   * 显示长按弹出的底部菜单（通用入口）
   * @param {Object} options - { title, items: [{ label, action, danger? }] }
   *   - title: 菜单顶部标题文本
   *   - items: 菜单项列表，每项包含 label 文本和 data-action 标识
   *   - 最后会自动追加「取消」按钮
   */
  showLongPressMenu: function(options) {
    // 兼容旧调用：showLongPressMenu(string) → 默认提供「输入网址跳转」入口
    if (typeof options === 'string') {
      options = {
        title: options,
        items: [
          { label: '🔗 输入网址跳转', action: 'showBookmarkInput' }
        ]
      };
    }
    options = options || {};
    const titleText = options.title || '当前卡片';
    const items = Array.isArray(options.items) ? options.items : [];

    // 已存在则移除
    const existing = document.getElementById('bookmarkLongPressMenu');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bookmarkLongPressMenu';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10002;display:flex;align-items:flex-end;justify-content:center;';

    const safeTitle = ViewBookmark._escape(titleText);

    // 2026-07-04 重构：菜单主体 HTML 挪到 _buildLongPressMenuBodyHtml
    overlay.innerHTML = ViewBookmark._buildLongPressMenuBodyHtml(safeTitle, items);

    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);

    // 自动滚动到顶部让用户能看到（2026-08-14：改滚到快捷导航栏，因书签已迁出卡片）
    setTimeout(function() {
      const nav = document.getElementById('navTabs');
      if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  },

  /**
   * 关闭长按菜单
   */
  closeLongPressMenu: function() {
    const menu = document.getElementById('bookmarkLongPressMenu');
    if (menu) menu.remove();
  },

  /**
   * 显示针对单个书签的长按菜单（含「删除」）
   * 2026-07-04 新增：长按书签标签按钮直接弹出删除入口
   * @param {number} id - 书签 id
   * @param {string} title - 书签名
   */
  showBookmarkActionMenu: function(id, title) {
    ViewBookmark.showLongPressMenu({
      title: '书签：' + (title || ''),
      items: [
        { label: '🗑️ 删除该书签', action: 'deleteBookmarkFromMenu', payload: id, danger: true }
      ]
    });
  },

  /**
   * 简单 HTML 转义，避免书签名/title 注入
   */
  _escape: function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // ============================================================
  // 2026-07-04 新增：长按相关 DOM 委托方法（供 event.js 调用）
  // 架构修复：event.js 禁止获取 DOM 元素，所有 DOM 查询封装在视图层
  // ============================================================

  /**
   * 判定给定元素是否应该触发长按书签菜单
   * 2026-07-04 更新：返回对象 { kind, el, id?, title? }
   *   - kind: 'add' | 'bookmark' | null
   *   - 'add': 长按快捷导航栏内的「+书签」按钮，弹出「输入网址跳转」入口
   *   - 'bookmark': 长按某个书签标签按钮，弹出「删除该书签」入口
   * 2026-08-14 变更：长按触发位置从「我的」面板迁移到快捷导航栏（#navTabs）
   * @param {Element} target - 触摸事件触发元素
   * @returns {Object|null}
   */
  resolveLongPressTarget: function(target) {
    if (!target || typeof target.closest !== 'function') return null;

    // 1) 优先判定书签标签按钮
    const tag = target.closest('.bookmark-tag');
    if (tag) {
      if (target.closest('button, iframe, input, textarea, [data-no-longpress]')) return null;
      const id = Number(tag.dataset.bookmarkId);
      const titleNode = tag.lastElementChild;
      const title = titleNode ? (titleNode.textContent || '').trim().slice(0, 20) : '';
      return { kind: 'bookmark', el: tag, id: id, title: title };
    }

    // 2) 其次判定快捷导航栏内的「+书签」按钮（2026-08-14 变更）
    //    原逻辑是「#profileMinePanel 任意空白处」，现改为「+书签」按钮自身长按
    const addBtn = target.closest('#bookmarkAddBtn');
    if (addBtn) {
      return { kind: 'add', el: addBtn };
    }

    return null;
  },

  /**
   * 检查目标元素是否仍在 DOM 中
   * @param {Element} el
   * @returns {boolean}
   */
  isElementAttached: function(el) {
    if (!el) return false;
    return document.body.contains(el);
  },

  /**
   * 获取长按目标元素的显示文本（菜单标题用）
   * @param {Element} cardBody
   * @returns {string}
   */
  getLongPressTitle: function(cardBody) {
    const text = (cardBody && cardBody.textContent) ? cardBody.textContent.trim() : '';
    return text.slice(0, 30) || '当前卡片';
  },

  /**
   * 长按实际触发菜单（视图层入口，供 event.js 委托调用）
   * 2026-07-04 更新：接受 resolveLongPressTarget 返回的对象，按 kind 分发
   * @param {Object} resolved - { kind, el, id?, title? }
   */
  triggerLongPressMenu: function(resolved) {
    if (!resolved || !resolved.el) return;
    if (resolved.kind === 'bookmark') {
      ViewBookmark.showBookmarkActionMenu(resolved.id, resolved.title);
    } else if (resolved.kind === 'add') {
      ViewBookmark.showLongPressMenu(ViewBookmark.getLongPressTitle(resolved.el));
    }
  }
};
