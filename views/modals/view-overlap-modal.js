/**
 * 视图层：重叠号码弹窗（拆分自 view-filter.js，2026-06-05）
 * @namespace ViewOverlapModal
 * 包含：showOverlapModal
 * 依赖：Business.calcOverlapNumbers / Toast
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ViewFilter.showOverlapModal() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部实现保持与拆分前等价（动态创建 modal、暗色模式样式、复制按钮处理等）
 */
const ViewOverlapModal = {
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

// 兼容路径：挂载到 ViewFilter，使 event.js 中 ViewFilter.showOverlapModal() 调用不变
if (typeof ViewFilter !== 'undefined' && ViewFilter) {
  Object.assign(ViewFilter, ViewOverlapModal);
}
