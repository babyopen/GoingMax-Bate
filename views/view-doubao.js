const ViewDoubao = {
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  _toNum: function(zodiac) {
    var idx = this.ZODIAC_ORDER.indexOf(zodiac);
    return idx !== -1 ? idx + 1 : 0;
  },

  renderMainGrid: function(result) {
    var container = document.getElementById('doubaoMainGrid');
    if (!container) return;

    if (!result || !result.main || result.main.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无数据</div>';
      return;
    }

    var html = '';
    result.main.forEach(function(zodiac) {
      html += '<div class="doubao-num-chip main-chip">';
      html += '<div class="doubao-chip-zodiac">' + zodiac + '</div>';
      html += '<div class="doubao-chip-label">主推</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  },

  renderBackupGrid: function(result) {
    var container = document.getElementById('doubaoBackupGrid');
    if (!container) return;

    if (!result || !result.backup || result.backup.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无数据</div>';
      return;
    }

    var html = '';
    result.backup.forEach(function(zodiac) {
      html += '<div class="doubao-num-chip backup-chip">';
      html += '<div class="doubao-chip-zodiac">' + zodiac + '</div>';
      html += '<div class="doubao-chip-label">备选</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  },

  renderHeatMap: function(historyData) {
    var container = document.getElementById('doubaoHeatMap');
    if (!container || !historyData || historyData.length < 10) {
      if (container) container.innerHTML = '<div class="empty-tip">暂无数据</div>';
      return;
    }

    var heatWindow = historyData.slice(0, 10);
    var prevNum = 0;
    var nums = heatWindow.slice(0, 10).map(function(item) {
      return BusinessPredictOld._toNum(item);
    }).filter(function(n) { return n > 0; });
    if (nums.length > 0) prevNum = nums[0];

    var heatMap = {};
    for (var i = 1; i <= 12; i++) {
      var count = nums.filter(function(n) { return n === i; }).length;
      var level = count >= 3 ? 'hot' : (count >= 1 ? 'warm' : 'cold');
      heatMap[i] = { count: count, level: level, zodiac: BusinessPredictOld._toZodiac(i) };
    }

    var inertiaSet = {};
    if (prevNum > 0) {
      [prevNum - 2, prevNum - 1, prevNum + 1, prevNum + 2].forEach(function(n) {
        if (n >= 1 && n <= 12) inertiaSet[n] = true;
      });
    }

    var html = '';
    this.ZODIAC_ORDER.forEach(function(zodiac) {
      var num = ViewDoubao._toNum(zodiac);
      var info = heatMap[num];
      var levelClass = 'heat-' + info.level;
      if (inertiaSet[num]) levelClass += ' heat-inertia';

      html += '<div class="doubao-heat-item ' + levelClass + '">';
      html += '<span class="doubao-heat-tag">' + info.level + '</span>';
      html += '<div class="doubao-heat-zodiac">' + zodiac + '</div>';
      html += '<div class="doubao-heat-bar"></div>';
      html += '<div class="doubao-heat-count">' + info.count + '次</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  },

  updatePeriodText: function(historyData) {
    var el = document.getElementById('doubaoPeriodText');
    if (!el) return;

    if (historyData && historyData.length > 0) {
      var nextExpect = Number(historyData[0].expect || 0) + 1;
      el.textContent = '第' + nextExpect + '期预测';
    } else {
      el.textContent = '等待数据...';
    }
  },

  renderAll: function(historyData) {
    if (!historyData || historyData.length < 10) {
      this.renderMainGrid(null);
      this.renderBackupGrid(null);
      this.renderHeatMap(null);
      this.updatePeriodText(null);
      return;
    }

    var zodiacHistory = historyData.slice(0, 15).map(function(item) {
      return item.specialZodiac || '';
    }).filter(Boolean);

    if (zodiacHistory.length < 10) {
      this.renderMainGrid(null);
      this.renderBackupGrid(null);
      this.renderHeatMap(historyData);
      this.updatePeriodText(historyData);
      return;
    }

    var result = BusinessPredictOld.predictOldVersion(zodiacHistory);
    this.renderMainGrid(result);
    this.renderBackupGrid(result);
    this.renderHeatMap(historyData);
    this.updatePeriodText(historyData);
  }
};
