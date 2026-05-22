const ZodiacStatModal = {
  _modal: null,
  _currentData: null,

  init: () => {
    if (ZodiacStatModal._modal) return;
    
    ZodiacStatModal._modal = document.createElement('div');
    ZodiacStatModal._modal.id = 'zodiac-stat-modal';
    ZodiacStatModal._modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;
    
    ZodiacStatModal._modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 16px;
        padding: 20px;
        width: 90%;
        max-width: 360px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s ease;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        ">
          <div id="zodiac-stat-title" style="
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
          "></div>
          <button id="zodiac-stat-close" style="
            background: none;
            border: none;
            font-size: 24px;
            color: #999;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        <div id="zodiac-stat-content"></div>
        <div style="
          display: flex;
          gap: 12px;
          margin-top: 20px;
        ">
          <button id="zodiac-stat-confirm" style="
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
    
    document.body.appendChild(ZodiacStatModal._modal);
    
    document.getElementById('zodiac-stat-close').addEventListener('click', () => {
      ZodiacStatModal.hide();
    });
    
    document.getElementById('zodiac-stat-confirm').addEventListener('click', () => {
      ZodiacStatModal.hide();
    });
    
    ZodiacStatModal._modal.addEventListener('click', (e) => {
      if (e.target === ZodiacStatModal._modal) {
        ZodiacStatModal.hide();
      }
    });
    
    const darkStyle = document.createElement('style');
    darkStyle.id = 'zodiac-stat-modal-dark-style';
    darkStyle.textContent = `
      @media (prefers-color-scheme: dark) {
        #zodiac-stat-modal > div {
          background: #1C1C1E !important;
        }
        #zodiac-stat-title {
          color: #FFFFFF !important;
        }
        #zodiac-stat-close {
          color: #FFFFFF !important;
        }
        #zodiac-stat-confirm {
          background: #0A84FF !important;
        }
      }
    `;
    document.head.appendChild(darkStyle);
  },

  show: (zodiac, data, freqResult, missHistory, followStats) => {
    if (!ZodiacStatModal._modal) {
      ZodiacStatModal.init();
    }
    
    ZodiacStatModal._currentData = { zodiac, data, freqResult, missHistory, followStats };
    
    const titleEl = document.getElementById('zodiac-stat-title');
    const contentEl = document.getElementById('zodiac-stat-content');
    
    titleEl.innerText = zodiac + ' - 遗漏值统计';
    
    let html = '';
    
    const zoneLabels = {
      '顶峰区': '🔥 顶峰区',
      '高频区': '🔶 高频区',
      '中频区': '🟡 中频区',
      '低频区': '🔵 低频区',
      '等待区': '⚪ 等待区'
    };
    
    html += '<div style="margin-bottom: 20px;">';
    html += '<div style="font-size: 14px; color: #666; margin-bottom: 12px;">当前状态</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
    
    html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
    html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">所属区域</div>';
    html += '<div style="font-size: 14px; font-weight: 600;">' + (zoneLabels[data.zone] || data.zone) + '</div>';
    html += '</div>';
    
    html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
    html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">当前遗漏</div>';
    html += '<div style="font-size: 14px; font-weight: 600;">' + data.miss + '期</div>';
    html += '</div>';
    
    html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
    html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">窗口出现次数</div>';
    html += '<div style="font-size: 14px; font-weight: 600;">' + data.count + '次</div>';
    html += '</div>';
    
    html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
    html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">降级预警</div>';
    html += '<div style="font-size: 14px; font-weight: 600;">' + (data.willDrop ? '⚠️ 会降级' : '✅ 稳定') + '</div>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    if (freqResult) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<div style="font-size: 14px; color: #666; margin-bottom: 12px;">各窗口统计</div>';
      
      const periods = [
        { key: 'p12', label: '12期窗口' },
        { key: 'p24', label: '24期窗口' },
        { key: 'p36', label: '36期窗口' }
      ];
      
      periods.forEach(function(period) {
        var periodData = freqResult[period.key];
        var item = null;
        
        if (periodData) {
          periodData.forEach(function(d) {
            if (d.zodiac === zodiac) {
              item = d;
              return false;
            }
          });
        }
        
        html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
        html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">' + period.label + '</div>';
        
        if (item) {
          html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">';
          html += '<div><span style="color: #999;">出现:</span> <span>' + item.count + '次</span></div>';
          html += '<div><span style="color: #999;">区域:</span> <span>' + (zoneLabels[item.zone] || item.zone) + '</span></div>';
          html += '<div><span style="color: #999;">遗漏:</span> <span>' + item.miss + '期</span></div>';
          html += '<div><span style="color: #999;">状态:</span> <span>' + (item.willDrop ? '将降级' : '稳定') + '</span></div>';
          html += '</div>';
        } else {
          html += '<div style="color: #999; font-size: 12px;">数据不足</div>';
        }
        
        html += '</div>';
      });
      
      html += '</div>';
    }
    
    if (missHistory) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<div style="font-size: 14px; color: #666; margin-bottom: 12px;">往期遗漏统计</div>';
      
      html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">';
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
      html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">历史出现</div>';
      html += '<div style="font-size: 14px; font-weight: 600;">' + missHistory.totalAppearances + '次</div>';
      html += '</div>';
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
      html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">平均间隔</div>';
      html += '<div style="font-size: 14px; font-weight: 600;">' + missHistory.avgInterval + '期</div>';
      html += '</div>';
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
      html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">最大间隔</div>';
      html += '<div style="font-size: 14px; font-weight: 600;">' + missHistory.maxInterval + '期</div>';
      html += '</div>';
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
      html += '<div style="font-size: 12px; color: #999; margin-bottom: 4px;">最小间隔</div>';
      html += '<div style="font-size: 14px; font-weight: 600;">' + missHistory.minInterval + '期</div>';
      html += '</div>';
      
      html += '</div>';
      
      if (missHistory.lastAppear && missHistory.firstAppear) {
        html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">';
        html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">出现期号</div>';
        html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">';
        html += '<div><span style="color: #999;">首次出现:</span> <span>第' + missHistory.firstAppear + '期</span></div>';
        html += '<div><span style="color: #999;">最近出现:</span> <span>第' + missHistory.lastAppear + '期</span></div>';
        html += '</div>';
        html += '</div>';
      }
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">';
      html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">间隔分布</div>';
      html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px;">';
      
      var distLabels = {
        '0-5期': '🔵 0-5期',
        '6-10期': '🟡 6-10期',
        '11-20期': '🟠 11-20期',
        '21-30期': '🟠 21-30期',
        '31期以上': '🔴 31期以上'
      };
      
      for (var key in missHistory.intervalDistribution) {
        var count = missHistory.intervalDistribution[key];
        html += '<div style="display: flex; justify-content: space-between; padding: 4px 0;">';
        html += '<span>' + distLabels[key] + '</span>';
        html += '<span style="font-weight: 600;">' + count + '次</span>';
        html += '</div>';
      }
      
      html += '</div>';
      html += '</div>';
      
      if (missHistory.recentAppearances && missHistory.recentAppearances.length > 1) {
        html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
        html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">近期出现间隔</div>';
        
        var maxDisplay = Math.min(missHistory.recentAppearances.length - 1, 10);
        
        html += '<div style="display: grid; gap: 4px;">';
        
        for (var row = 0; row < Math.ceil(maxDisplay / 5); row++) {
          html += '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;">';
          
          for (var i = 0; i < 5; i++) {
            var idx = row * 5 + i;
            if (idx >= maxDisplay) break;
            
            var interval = missHistory.intervals[idx];
            var appear = missHistory.recentAppearances[idx + 1];
            
            if (interval !== undefined && appear) {
              html += '<div style="padding: 6px; background: rgba(0,122,255,0.1); border-radius: 4px; text-align: center; font-size: 10px;">';
              html += '<div style="font-weight: 600; color: #007aff; margin-bottom: 2px;">' + interval + '期</div>';
              html += '<div style="color: #999; font-size: 9px;">第' + appear.expect + '期</div>';
              html += '</div>';
            }
          }
          
          html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
      }
    }
    
    if (followStats) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<div style="font-size: 14px; color: #666; margin-bottom: 12px;">跟随统计（追踪最近' + followStats.targetAppearCount + '次出现）</div>';
      
      html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">';
      html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">🐾 跟随排行榜（前12名）</div>';
      html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">';
      
      var rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '①', '⑫'];
      
      followStats.topFollowers.forEach(function(item, idx) {
        if (item.count > 0) {
          html += '<div style="padding: 6px; background: rgba(0,122,255,0.08); border-radius: 4px; text-align: center;">';
          html += '<div style="font-size: 10px; margin-bottom: 2px;">' + rankEmojis[idx] + '</div>';
          html += '<div style="font-size: 12px; font-weight: 600;">' + item.zodiac + '</div>';
          html += '<div style="font-size: 11px; color: #007aff;">' + item.count + '次</div>';
          html += '<div style="font-size: 10px; color: #999;">' + item.percentage + '%</div>';
          html += '</div>';
        }
      });
      
      html += '</div>';
      html += '</div>';
      
      if (followStats.followRecords && followStats.followRecords.length > 0) {
        html += '<div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">';
        html += '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">📋 最近10次出现后的走势</div>';
        
        followStats.followRecords.forEach(function(record) {
          html += '<div style="margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.5); border-radius: 4px;">';
          html += '<div style="font-size: 11px; color: #666; margin-bottom: 4px;">第' + record.expect + '期</div>';
          
          if (record.chain && record.chain.length > 0) {
            html += '<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">';
            
            record.chain.forEach(function(item) {
              html += '<div style="padding: 3px 6px; background: rgba(0,122,255,0.12); border-radius: 3px; font-size: 11px;">';
              html += '<span style="font-weight: 600;">' + item.zodiac + '</span>';
              html += '</div>';
              
              if (item.interval < record.chain.length) {
                html += '<span style="color: #ccc; font-size: 10px;">→</span>';
              }
            });
            
            html += '</div>';
          } else {
            html += '<div style="font-size: 11px; color: #999;">无后续数据</div>';
          }
          
          html += '</div>';
        });
        
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    contentEl.innerHTML = html;
    
    ZodiacStatModal._modal.style.opacity = '1';
    ZodiacStatModal._modal.style.visibility = 'visible';
    ZodiacStatModal._modal.querySelector('div').style.transform = 'scale(1)';
  },

  hide: () => {
    if (!ZodiacStatModal._modal) return;
    
    ZodiacStatModal._modal.style.opacity = '0';
    ZodiacStatModal._modal.style.visibility = 'hidden';
    ZodiacStatModal._modal.querySelector('div').style.transform = 'scale(0.9)';
    ZodiacStatModal._currentData = null;
  }
};
