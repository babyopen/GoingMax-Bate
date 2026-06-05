/**
 * 视图层：筛选页面导航与UI
 * @namespace ViewFilter
 * 职责：只做 DOM 操作，不包含业务计算
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 */
const ViewFilter = {
  /**
   * 切换底部导航UI（纯DOM，不包含业务逻辑）
   * @param {number} index - 导航索引 (0=筛选,1=机选,2=分析,3=我的)
   */
  switchBottomNavUI: (index) => {
    document.querySelectorAll('.bottom-nav-item').forEach(function(el, i) {
      el.classList.toggle('active', i === index);
    });

    var pages = ['filterPage', 'analysisPage', 'randomPage', 'profilePage'];
    pages.forEach(function(pageId, i) {
      var pageEl = document.getElementById(pageId);
      if(pageEl) {
        pageEl.style.display = i === index ? 'block' : 'none';
        pageEl.classList.toggle('active', i === index);
      }
    });

    var topBox = document.getElementById('topBox');
    if(topBox) {
      topBox.style.display = index === 0 ? 'block' : 'none';
    }

    var bodyBox = document.querySelector('.body-box');
    if(bodyBox) {
      if(index === 0) {
        bodyBox.style.marginTop = 'calc(var(--top-offset) + var(--safe-top))';
      } else {
        bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';
      }
    }

    var quickNav = document.getElementById('quickNav');
    if(quickNav) {
      if (index === 0 || index === 1 || index === 2 || index === 3) {
        quickNav.style.display = 'block';
      } else {
        quickNav.style.display = 'none';
      }
    }

    if (index === 0) {
      ViewFilter.refreshQuickNav('filter');
    } else if (index === 1) {
      ViewFilter.refreshQuickNav('analysis');
    } else if (index === 2) {
      ViewFilter.refreshQuickNav('random');
    } else if (index === 3) {
      ViewFilter.refreshQuickNav('profile');
    } else {
      var navTabs = document.getElementById('navTabs');
      if (navTabs) navTabs.innerHTML = '';
    }
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    var targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    var scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      var offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
      window.scrollTo({ top: targetEl.offsetTop - offset, behavior: 'smooth' });
    }
    Business.toggleQuickNav(false);
  },

  /**
   * 切换快捷导航展开/收起UI
   * @param {boolean} shouldOpen - 是否展开
   */
  toggleQuickNavUI: (shouldOpen) => {
    if(shouldOpen){
      DOM.quickNav.classList.remove('collapsed');
      DOM.quickNav.classList.add('expanded');
      DOM.navTabs.style.display = 'flex';
      DOM.navToggle.classList.add('active');
    } else {
      DOM.quickNav.classList.remove('expanded');
      DOM.quickNav.classList.add('collapsed');
      DOM.navTabs.style.display = 'none';
      DOM.navToggle.classList.remove('active');
    }
  },

  /**
   * 判断快捷导航是否展开
   * @returns {boolean}
   */
  isQuickNavExpanded: () => {
    return DOM.quickNav.classList.contains('expanded');
  },

  /**
   * 返回顶部
   */
  backToTop: () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  },

  /**
   * 显示/隐藏返回顶部按钮
   * @param {boolean} show
   */
  toggleBackTopBtn: (show) => {
    if(show) {
      DOM.backTopBtn.classList.add('show');
    } else {
      DOM.backTopBtn.classList.remove('show');
    }
  },

  /**
   * 获取滚动位置
   * @returns {number}
   */
  getScrollTop: () => {
    return document.documentElement.scrollTop || document.body.scrollTop;
  },

  /**
   * 页面卸载清理DOM事件
   */
  cleanupPageEvents: (scrollHandler, unloadHandler) => {
    window.removeEventListener('scroll', scrollHandler);
    window.removeEventListener('beforeunload', unloadHandler);
  },

  /**
   * 批量选择弹窗相关状态
   */
  _batchTargetGroups: [],

  /**
   * 快捷导航配置
   */
  _navConfigs: {
    filter: [
      { id: 'mod-saved', label: '方案', type: 'scroll' },
      { id: 'mod-zodiac', label: '生肖', type: 'scroll' },
      { id: 'mod-color', label: '波色', type: 'scroll' },
      { id: 'mod-type', label: '属性', type: 'scroll' },
      { id: 'mod-element', label: '五行', type: 'scroll' },
      { id: 'mod-head', label: '头数', type: 'scroll' },
      { id: 'mod-tail', label: '尾数', type: 'scroll' },
      { id: 'mod-sum', label: '尾合', type: 'scroll' },
      { id: 'mod-bs', label: '大小', type: 'scroll' },
      { id: 'mod-num', label: '号码选择', type: 'scroll' },
      { id: 'mod-exclude', label: '号码排除', type: 'scroll' }
    ],
    analysis: [
      { label: '历史记录', type: 'tab', page: 'analysis', tabName: 'history' },
      { label: '维度分析', type: 'tab', page: 'analysis', tabName: 'analysis' },
      { label: '生肖关联', type: 'tab', page: 'analysis', tabName: 'zodiac' }
    ],
    random: [
      { label: '主推', type: 'tab', page: 'random', tabName: 'main' },
      { label: '终极算法', type: 'tab', page: 'random', tabName: 'ultimate' },
      { label: '生肖预测', type: 'tab', page: 'random', tabName: 'predict' },
      { label: 'Giong', type: 'tab', page: 'random', tabName: 'giong' }
    ],
    profile: [
      { label: '我的', type: 'tab', page: 'profile', tabName: 'mine' },
      { label: '官方', type: 'tab', page: 'profile', tabName: 'official' },
      { label: '凤凰', type: 'tab', page: 'profile', tabName: 'phoenix' },
      { label: '大仙', type: 'tab', page: 'profile', tabName: 'daxian' }
    ]
  },

  /**
   * 调整弹窗位置（避开键盘）
   */
  adjustModalPosition: () => {
    const modal = document.getElementById('batchModal');
    const container = modal?.querySelector('.batch-modal-content');
    const input = document.getElementById('batchModalInput');
    if (!modal?.classList.contains('show')) return;
    if (!container || !input) return;

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const inputRect = input.getBoundingClientRect();
    const inputBottom = inputRect.bottom;

    if (inputBottom > viewportHeight - 20) {
      const offset = inputBottom - (viewportHeight - 20);
      const maxOffset = container.offsetHeight * 0.6;
      const translateY = -Math.min(offset, maxOffset);
      container.style.transform = `translateY(${translateY}px)`;
    } else {
      container.style.transform = 'translateY(0)';
    }
  },

  /**
   * 显示批量选择弹窗
   * @param {string} groups - 逗号分隔的组名
   */
  showBatchModal: (groups) => {
    const modal = document.getElementById('batchModal');
    const input = document.getElementById('batchModalInput');
    const title = document.getElementById('batchModalTitle');
    const hint = modal?.querySelector('.batch-modal-hint');
    const container = modal?.querySelector('.batch-modal-content');
    if (!modal || !input) return;
    ViewFilter._batchTargetGroups = groups ? groups.split(',') : [];
    // 根据分组设置不同的提示
    const group = ViewFilter._batchTargetGroups[0];
    const groupNames = {
      'num': '号码选择',
      'zodiac': '生肖',
      'color,colorsx': '波色',
      'type': '属性',
      'element': '五行',
      'head': '头数',
      'tail': '尾数',
      'sum': '尾合',
      'bs,sumOdd,sumSize,tailSize': '大小',
      'hot': '热号',
      'exclude': '号码排除'
    };
    const groupPlaceholders = {
      'num': '例如：01 02 03 或 1-5',
      'zodiac': '例如：马 牛 虎 或 龙 蛇',
      'color,colorsx': '例如：红 蓝 绿 或 红单 蓝双',
      'type': '例如：家禽 野兽',
      'element': '例如：金 木 水 火 土',
      'head': '例如：0 1 2 3 4',
      'tail': '例如：0 1 2 3 4 5 6 7 8 9',
      'sum': '例如：01 02 03 04 05',
      'bs,sumOdd,sumSize,tailSize': '例如：大单 小双 合单 合大',
      'hot': '例如：热号 温号 冷号',
      'exclude': '例如：1 2 3 或 01-10'
    };
    // 排除组特殊处理
    const groupName = groupNames[group] || '选择';
    if (group === 'exclude') {
      if (title) title.textContent = `批量${groupName}`;
      if (hint) hint.textContent = '输入要排除的号码，支持多种分隔符';
      input.placeholder = groupPlaceholders['exclude'];
    } else {
      const placeholder = groupPlaceholders[group] || '例如：马 牛 虎';
      if (title) title.textContent = `批量选择${groupName}`;
      if (hint) hint.textContent = '输入要选择的名称，支持多种分隔符';
      input.placeholder = placeholder;
    }
    modal.classList.add('show');
    if (container) container.style.transform = 'translateY(0)';
    input.value = '';
    setTimeout(() => {
      input.focus();
      setTimeout(() => ViewFilter.adjustModalPosition(), 150);
    }, 100);
  },

  /**
   * 关闭批量选择弹窗
   */
  closeBatchModal: () => {
    const modal = document.getElementById('batchModal');
    const input = document.getElementById('batchModalInput');
    const container = modal?.querySelector('.batch-modal-content');
    if (input) input.blur();
    if (modal) modal.classList.remove('show');
    if (container) container.style.transform = 'translateY(0)';
  },

  /**
   * 确认批量选择
   */
  confirmBatchSelect: () => {
    const input = document.getElementById('batchModalInput');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) {
      Toast.show('请输入要选择的名称');
      return;
    }
    // 号码排除组特殊处理
    const groups = ViewFilter._batchTargetGroups;
    if (groups.length === 1 && groups[0] === 'exclude') {
      // 提取号码，支持多种分隔符
      const nums = raw.split(/[,，\s\n.。\/／\\\-、；;'""''\[\]【】]+/).map(Number).filter(n => n >= 1 && n <= 49);
      if (nums.length === 0) {
        Toast.show('请输入有效的号码(1-49)');
        return;
      }
      const state = StateManager._state;
      if (state.lockExclude) {
        ViewFilter.closeBatchModal();
        Toast.show('已锁定排除号码');
        return;
      }
      const newExcluded = [...state.excluded];
      const newHistory = [...state.excludeHistory];
      let count = 0;
      nums.forEach(num => {
        if (!newExcluded.includes(num)) { newExcluded.push(num); newHistory.push([num, 'in']); count++; }
      });
      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
      ViewFilter.closeBatchModal();
      Toast.show(`已排除 ${count} 个号码`);
      return;
    }
    // 普通标签组处理
    const names = raw.split(/[,，\s\n.。\/／\\\-、；;'""''\[\]【】]+/).filter(Boolean);
    if (names.length === 0) {
      Toast.show('未识别到有效名称');
      return;
    }
    // 对每个目标组执行批量选择
    let totalMatched = 0;
    const unmatchedNames = [];
    ViewFilter._batchTargetGroups.forEach(group => {
      const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
      const lockedSet = new Set(StateManager._state.locked[group] || []);
      const isNumGroup = CONFIG.NUMBER_GROUPS.includes(group);
      const matched = allTags
        .map(tag => Utils.formatTagValue(tag.dataset.value, group))
        .filter(v => {
          if (lockedSet.has(v)) return false;
          if (isNumGroup) {
            const numVal = Number(v);
            return names.some(n => {
              const targetNum = Number(n);
              return !isNaN(targetNum) && targetNum === numVal;
            });
          }
          return names.some(n => v.includes(n) || n.includes(v));
        });
      totalMatched = matched.length;
      const newSelected = { ...StateManager._state.selected };
      newSelected[group] = matched;
      StateManager.setState({ selected: newSelected });
    });
    // 检查未匹配的名称
    const allTagValues = [];
    ViewFilter._batchTargetGroups.forEach(group => {
      const tags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
      tags.forEach(tag => {
        const val = Utils.formatTagValue(tag.dataset.value, group);
        allTagValues.push(String(val));
      });
    });
    names.forEach(name => {
      const nameStr = String(name).trim();
      const isMatched = allTagValues.some(tagVal => 
        tagVal.includes(nameStr) || nameStr.includes(tagVal) ||
        (CONFIG.NUMBER_GROUPS.includes(ViewFilter._batchTargetGroups[0]) && Number(nameStr) === Number(tagVal))
      );
      if (!isMatched && nameStr) {
        unmatchedNames.push(nameStr);
      }
    });
    // 关闭弹窗并提示
    ViewFilter.closeBatchModal();
    if (unmatchedNames.length > 0) {
      Toast.show(`已选择 ${totalMatched} 个，无法识别：${unmatchedNames.join(', ')}`);
    } else {
      Toast.show(`已选择 ${names.length} 个名称`);
    }
  },

  /**
   * 刷新快捷导航栏内容（根据当前页面）
   * @param {string} pageKey - 'filter', 'analysis', 'random'
   */
  refreshQuickNav: (pageKey) => {
    const navTabs = document.getElementById('navTabs');
    if (!navTabs) return;
    const configs = ViewFilter._navConfigs[pageKey];
    if (!configs) return;

    const fragment = document.createDocumentFragment();
    configs.forEach(cfg => {
      const btn = document.createElement('button');
      btn.className = 'nav-tab';
      if (cfg.type === 'scroll') {
        btn.dataset.target = cfg.id;
        btn.dataset.navType = 'scroll';
      } else if (cfg.type === 'tab') {
        btn.dataset.navType = 'tab';
        btn.dataset.page = cfg.page;
        btn.dataset.tabName = cfg.tabName;
      }
      btn.textContent = cfg.label;
      fragment.appendChild(btn);
    });
    navTabs.innerHTML = '';
    navTabs.appendChild(fragment);
  },

  /**
   * 显示重叠号码弹窗
   */
  showOverlapModal: () => {
    const overlapData = Business.calcOverlapNumbers();
    
    if (overlapData.totalSchemes === 0) {
      Toast.show('暂无保存的方案');
      return;
    }

    if (overlapData.overlapNums.length === 0) {
      Toast.show('没有重叠的号码');
      return;
    }

    const groupedNums = {};
    overlapData.overlapNums.forEach(item => {
      const count = item.count;
      if (!groupedNums[count]) {
        groupedNums[count] = [];
      }
      groupedNums[count].push(item);
    });

    const sortedCounts = Object.keys(groupedNums)
      .map(Number)
      .sort((a, b) => b - a);

    const modal = document.createElement('div');
    modal.id = 'overlapModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;
    modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s ease;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <div style="
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 16px;
          text-align: center;
        ">重叠号码 <span style="font-size: 12px; color: #999; font-weight: normal;">(共${overlapData.overlapNums.length}个)</span></div>
        <div style="
          font-size: 12px;
          color: #666;
          margin-bottom: 12px;
          text-align: center;
        ">基于${overlapData.totalSchemes}个方案计算</div>
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        ">
          <div id="overlapContent"></div>
        </div>
        <div style="
          display: flex;
          gap: 12px;
          margin-top: 20px;
        ">
          <button id="overlapCloseBtn" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #007bff;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const content = modal.querySelector('#overlapContent');
    let html = '';

    sortedCounts.forEach(count => {
      const nums = groupedNums[count];
      const numStr = nums.map(item => item.s).join(' ');
      html += `<div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
      html += `<div style="font-size: 13px; font-weight: 600; color: #007aff;">${count}次 (${nums.length}个号码)</div>`;
      html += `<button class="copy-nums-btn" data-nums="${numStr}" style="padding: 4px 10px; border: none; border-radius: 4px; background: #007bff; color: #fff; font-size: 11px; cursor: pointer;">复制</button>`;
      html += `</div>`;
      html += `<div style="display: flex; flex-wrap: wrap; gap: 6px;">`;
      
      nums.forEach(item => {
        const color = item.color === '红' ? '#ff3b30' : item.color === '蓝' ? '#007aff' : '#34c759';
        html += `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 6px; background: #fff; border-radius: 6px;">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${color};
              color: #fff;
              font-size: 11px;
              font-weight: bold;
            ">${item.s}</div>
            <div style="font-size: 10px; color: #666;">${item.zodiac}</div>
          </div>
        `;
      });
      
      html += `</div></div>`;
    });

    content.innerHTML = html;

    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.visibility = 'visible';
      modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      modal.querySelector('div').style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    };

    modal.querySelector('#overlapCloseBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    modal.querySelectorAll('.copy-nums-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nums = btn.dataset.nums;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(nums).then(() => {
            Toast.show(`已复制: ${nums}`);
          }).catch(() => {
            Toast.show('复制失败，请手动复制');
          });
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = nums;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            Toast.show(`已复制: ${nums}`);
          } catch (err) {
            Toast.show('复制失败，请手动复制');
          }
          document.body.removeChild(textarea);
        }
      });
    });

    const darkStyle = document.createElement('style');
    darkStyle.id = 'overlapModal-dark-style';
    darkStyle.textContent = `
      @media (prefers-color-scheme: dark) {
        #overlapModal > div {
          background: #1C1C1E !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
        }
        #overlapModal > div > div:first-child {
          color: #FFFFFF !important;
        }
        #overlapModal > div > div:nth-child(2) {
          color: #98989F !important;
        }
        #overlapModal div[style*="background: #f5f5f5"] {
          background: #2C2C2E !important;
        }
        #overlapModal div[style*="background: #fff"] {
          background: #3A3A3C !important;
        }
        #overlapModal div[style*="color: #666"] {
          color: #98989F !important;
        }
        #overlapModal .copy-nums-btn {
          background: #0A84FF !important;
        }
      }
    `;
    document.head.appendChild(darkStyle);
  }
};