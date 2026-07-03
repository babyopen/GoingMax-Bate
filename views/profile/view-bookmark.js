/**
 * 视图层：用户书签管理（2026-07-04 新增）
 * 职责：
 *   1. 在个人中心页「我的」面板注入书签管理卡片（含书签列表 + iframe 容器）
 *   2. 渲染书签列表
 *   3. 显示/隐藏书签输入弹窗（双输入：标题 + URL）
 *   4. iframe 加载书签 URL
 *
 * 严格遵守分层规范：
 *   ❌ 禁止业务计算（URL 校验交由 BusinessBookmark）
 *   ❌ 禁止写存储/状态变更（交由 BusinessBookmark）
 *   ✅ 只做 DOM 渲染与展示
 */
const ViewBookmark = {

  _inputModal: null, // 双输入弹窗引用

  /**
   * 渲染书签管理卡片到 #profileMinePanel（动态注入，幂等）
   */
  renderBookmarkCard: function() {
    const panel = document.getElementById('profileMinePanel');
    if (!panel) return;
    if (document.getElementById('bookmarkManagerCard')) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'bookmarkManagerCard';
    card.innerHTML =
      // 2026-07-04 移除 "🔖 我的书签" card-header（不需要展示）
      // 2026-07-04 iframe 占满到底部导航栏：卡片用 flex 撑满面板高度，iframe 容器 flex:1
      '<div class="card-body" id="bookmarkCardBody" ' +
        'style="display:flex;flex-direction:column;min-height:calc(100vh - 160px);">' +
        '<div style="margin-bottom:12px;">' +
          '<button data-action="showBookmarkInput" ' +
            'style="padding:8px 16px;background:#007AFF;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">' +
            '＋ 添加网址' +
          '</button>' +
        '</div>' +
        '<div id="bookmarkList">' + ViewBookmark.renderListHtml() + '</div>' +
        // iframe 容器：flex:1 占满剩余高度（默认隐藏），无 margin-top 紧凑显示
        '<div id="bookmarkIframeWrap" style="display:none;flex:1;min-height:0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<div id="bookmarkIframeTitle" style="font-size:13px;color:var(--text-secondary);font-weight:600;"></div>' +
            '<button data-action="closeBookmarkIframe" ' +
              'style="padding:4px 10px;background:var(--bg-secondary);border:none;border-radius:6px;font-size:12px;cursor:pointer;color:var(--text-secondary);">关闭</button>' +
          '</div>' +
          '<iframe id="bookmarkIframe" ' +
            'sandbox="allow-scripts allow-forms allow-popups allow-same-origin" ' +
            'style="width:100%;height:100%;min-height:calc(100vh - 220px);border:1px solid var(--border);border-radius:8px;background:#fff;">' +
          '</iframe>' +
        '</div>' +
      '</div>';

    panel.appendChild(card);
  },

  /**
   * 渲染书签列表 HTML（从 state 读取）
   * @returns {string} HTML 片段
   */
  renderListHtml: function() {
    const list = BusinessBookmark.getBookmarks();
    if (!list.length) {
      return '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
        '暂无书签，点击上方「＋ 添加网址」开始收藏' +
      '</div>';
    }
    // 2026-07-04 优化：标签按钮形式（紧凑横排，每个 tag 含 data-bookmark-id）
    let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;">';
    list.forEach(function(b) {
      html += '<div class="bookmark-tag" data-action="openBookmark" data-bookmark-id="' + b.id + '" ' +
        'title="' + ViewBookmark._escape(b.url) + '" ' +
        'style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:var(--bg-secondary);color:var(--text);border-radius:16px;font-size:13px;font-weight:500;cursor:pointer;user-select:none;-webkit-user-select:none;border:1px solid transparent;">' +
        '<span>🔖</span>' +
        '<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ViewBookmark._escape(b.title) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  },

  /**
   * 刷新书签列表 DOM（调用场景：新增/删除/初始化后）
   */
  refreshList: function() {
    const listEl = document.getElementById('bookmarkList');
    if (listEl) listEl.innerHTML = ViewBookmark.renderListHtml();
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
    overlay.innerHTML = html;
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
    ViewBookmark.refreshList();
    // 自动打开刚添加的书签
    ViewBookmark.openInIframe(result.bookmark.url, result.bookmark.title);
  },

  /**
   * 在 iframe 中加载指定 URL
   * @param {string} url - 已校验的合法 URL
   * @param {string} title - 显示标题
   */
  openInIframe: function(url, title) {
    if (!BusinessBookmark.isOpenableUrl(url)) {
      Toast.show('网址无效，无法打开');
      return;
    }
    const wrap = document.getElementById('bookmarkIframeWrap');
    const iframe = document.getElementById('bookmarkIframe');
    const titleEl = document.getElementById('bookmarkIframeTitle');
    if (!wrap || !iframe || !titleEl) return;

    iframe.src = url;
    titleEl.textContent = title || url;
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
      ViewBookmark.refreshList();
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

    overlay.innerHTML = html;

    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);

    // 自动滚动到顶部让用户能看到
    setTimeout(function() {
      const card = document.getElementById('bookmarkManagerCard');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
   *   - 'add': 长按个人中心页任意 .card-body 区域，弹出「输入网址跳转」入口
   *   - 'bookmark': 长按某个书签标签按钮，弹出「删除该书签」入口
   * @param {Element} target - 触摸事件触发元素
   * @returns {Object|null}
   */
  resolveLongPressTarget: function(target) {
    if (!target || typeof target.closest !== 'function') return null;

    // 1) 优先判定书签标签按钮
    const tag = target.closest('.bookmark-tag');
    if (tag) {
      // 不响应标签内部嵌套的 button/iframe 上的长按
      if (target.closest('button, iframe, input, textarea, [data-no-longpress]')) return null;
      const id = Number(tag.dataset.bookmarkId);
      const title = (tag.textContent || '').trim().slice(0, 20);
      return { kind: 'bookmark', el: tag, id: id, title: title };
    }

    // 2) 其次判定个人中心页任意区域（保留旧「输入网址跳转」入口）
    //    2026-07-04 适配：原 .card-body 空容器已删除，改为面板内任意空白处都触发
    const panelArea = target.closest('#profileMinePanel');
    if (panelArea) {
      // 但命中了书签标签的，会被上面的 .bookmark-tag 优先捕获，不会走这里
      if (target.closest('input, textarea, button, iframe, [data-no-longpress]')) return null;
      return { kind: 'add', el: panelArea };
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
