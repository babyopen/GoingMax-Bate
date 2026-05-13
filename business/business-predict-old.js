const BusinessPredictOld = {

  // 生肖与数字的映射表（1-12）
  // 顺序：鼠=1, 牛=2, 虎=3, 兔=4, 龙=5, 蛇=6, 马=7, 羊=8, 猴=9, 鸡=10, 狗=11, 猪=12
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  // 规则5-⑥：数字转生肖映射表（马=1，蛇=2，龙=3，兔=4，虎=5，牛=6，鼠=7，猪=8，狗=9，鸡=10，猴=11，羊=12）
  NUM_ZODIAC_MAP: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  // 区间定义
  ZONES: { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8], 3: [9, 10, 11, 12] },

  // 生肖转数字（1-12）
  _toNum: function(zodiac) {
    var idx = this.ZODIAC_ORDER.indexOf(zodiac);
    return idx !== -1 ? idx + 1 : 0;
  },

  // 数字转生肖（规则5-⑥）
  _toZodiac: function(num) {
    return this.NUM_ZODIAC_MAP[num] || '';
  },

  // 获取数字所属区间（规则5-③）
  _getZone: function(num) {
    if (num >= 1 && num <= 4) return 1;
    if (num >= 5 && num <= 8) return 2;
    return 3;
  },

  // 计算区间热度分布（规则5-③）
  _calcZoneRotation: function(nums) {
    var zoneCount = { 1: 0, 2: 0, 3: 0 };
    nums.forEach(function(n) { var z = BusinessPredictOld._getZone(n); zoneCount[z]++; });
    var sorted = Object.entries(zoneCount).sort(function(a, b) { return b[1] - a[1]; });
    return {
      hot: parseInt(sorted[0][0]),
      warm: sorted[1][0] ? parseInt(sorted[1][0]) : 0,
      cold: sorted[2][0] ? parseInt(sorted[2][0]) : 0
    };
  },

  // === 规则5：主预测函数 ===
  predictOldVersion: function(history) {
    // 规则1：输入校验
    if (!history || history.length < 10) return { main: [], backup: [] };

    // 规则1-2：生肖转数字，取最近15期，范围1-12
    var nums = history.slice(0, Math.min(15, history.length))
      .map(function(z) { return BusinessPredictOld._toNum(z); })
      .filter(function(n) { return n > 0; });

    // 规则3：窗口 - 仅使用最后12期计算热度
    var window12 = nums.slice(0, Math.min(12, nums.length));
    // 规则5-①：近10期温号
    var window10 = nums.slice(0, Math.min(10, nums.length));
    // 上期开奖号（最新的在数组头部）
    var prevNum = nums.length > 0 ? nums[0] : 0;

    // 规则4：热度定义
    // 热号：出现≥3次，温号：1-2次，冷号：0次
    var heatMap = {};
    for (var i = 1; i <= 12; i++) {
      var count = window12.filter(function(n) { return n === i; }).length;
      heatMap[i] = { count: count, level: count >= 3 ? 'hot' : (count >= 1 ? 'warm' : 'cold') };
    }

    // 规则5-①：提取近10期温号作为主池
    var mainPool = [];
    window10.forEach(function(n) {
      if (heatMap[n].level === 'warm' && mainPool.indexOf(n) === -1) {
        mainPool.push(n);
      }
    });

    // 规则5-②：上期开奖号 → ±1、±2、同区、同尾，加权优先
    var prevCandidates = {};
    if (prevNum > 0) {
      // ±1、±2
      [prevNum - 2, prevNum - 1, prevNum + 1, prevNum + 2]
        .filter(function(n) { return n >= 1 && n <= 12; })
        .forEach(function(n) {
          var w = Math.abs(n - prevNum) === 1 ? 2 : 1; // ±1权重2，±2权重1
          prevCandidates[n] = (prevCandidates[n] || 0) + w;
        });
      // 同区
      var prevZone = BusinessPredictOld._getZone(prevNum);
      BusinessPredictOld.ZONES[prevZone]
        .filter(function(n) { return n !== prevNum && !(n in prevCandidates); })
        .forEach(function(n) {
          prevCandidates[n] = (prevCandidates[n] || 0) + 1;
        });
      // 同尾（1-12范围内，同尾数即个位相同，如2和12）
      var prevTail = prevNum % 10;
      [prevTail, prevTail + 10]
        .filter(function(n) { return n >= 1 && n <= 12 && n !== prevNum && !(n in prevCandidates); })
        .forEach(function(n) {
          prevCandidates[n] = (prevCandidates[n] || 0) + 1;
        });
    }

    // 规则5-③：区间轮转，优先相邻/同区
    var zoneRot = BusinessPredictOld._calcZoneRotation(window12);
    var prevZoneNum = prevNum > 0 ? BusinessPredictOld._getZone(prevNum) : 0;
    // 优先相邻区间和同区
    var targetZones = [];
    if (prevZoneNum === 1) targetZones = [1, 2];      // 1区→同区+2区
    else if (prevZoneNum === 2) targetZones = [2, 1, 3]; // 2区→同区+1区+3区
    else targetZones = [3, 2];                          // 3区→同区+2区

    // 合并候选池：主池温号（目标区内）+ 上期衍生号（目标区内）
    var candidatePool = {};
    mainPool.forEach(function(n) {
      if (targetZones.indexOf(BusinessPredictOld._getZone(n)) !== -1) {
        candidatePool[n] = { heat: 'warm', prevW: prevCandidates[n] || 0 };
      }
    });
    Object.keys(prevCandidates).forEach(function(k) {
      var n = parseInt(k);
      if (!(n in candidatePool) && targetZones.indexOf(BusinessPredictOld._getZone(n)) !== -1) {
        candidatePool[n] = { heat: heatMap[n].level, prevW: prevCandidates[n] };
      }
    });

    // 规则5-④：冷号过滤（遗漏5-15期可带1个，>20期不选）
    var coldCandidates = [];
    for (var i = 1; i <= 12; i++) {
      if (heatMap[i].level === 'cold') {
        // 在12期窗口中出现0次即为遗漏≥12期
        var missCount = window12.filter(function(n) { return n === i; }).length === 0 ? window12.length : 0;
        if (missCount >= 5 && missCount <= 15) {
          coldCandidates.push(i);
        }
      }
    }

    // 规则5-⑤：最终选号（主推4码，备选2码，温≥3，冷≤1）
    var warmList = [], coldList = [];
    Object.keys(candidatePool).forEach(function(k) {
      var n = parseInt(k);
      if (candidatePool[n].heat === 'warm') {
        warmList.push({ num: n, score: heatMap[n].count * 10 + candidatePool[n].prevW * 5 });
      } else if (candidatePool[n].heat !== 'hot') {
        coldList.push({ num: n, score: 5 });
      }
    });
    warmList.sort(function(a, b) { return b.score - a.score; });
    coldList.sort(function(a, b) { return b.score - a.score; });

    var main = [], backup = [], warmCount = 0, coldCount = 0;

    // 先选3个温号
    for (var i = 0; i < warmList.length && warmCount < 3; i++) {
      main.push(warmList[i].num);
      warmCount++;
    }

    // 不足4码，从冷号中取1个（遗漏5-15期）
    if (main.length < 4 && coldList.length > 0 && coldCount < 1) {
      main.push(coldList[0].num);
      coldCount++;
    }

    // 仍不足4码，补充温号
    while (main.length < 4 && warmCount < warmList.length) {
      main.push(warmList[warmCount].num);
      warmCount++;
    }

    // 备选2码：从剩余温号、冷号中选取
    var used = {};
    main.forEach(function(n) { used[n] = true; });
    warmList.forEach(function(c) { if (!used[c.num]) backup.push(c.num); });
    coldList.forEach(function(c) { if (!used[c.num] && backup.length < 2) backup.push(c.num); });

    // 补齐备选至2码
    while (backup.length < 2) {
      var f = warmList.find(function(c) { return main.indexOf(c.num) === -1 && backup.indexOf(c.num) === -1; });
      if (f) backup.push(f.num); else break;
    }

    // 规则5-⑥：数字转生肖
    return {
      main: main.map(function(n) { return BusinessPredictOld._toZodiac(n); }).filter(Boolean),
      backup: backup.map(function(n) { return BusinessPredictOld._toZodiac(n); }).filter(Boolean)
    };
  }
};

// 测试调用示例：
// var history = ['马', '蛇', '龙', '兔', '虎', '牛', '鼠', '猪', '狗', '鸡', '猴', '羊', '马', '蛇', '龙'];
// var result = BusinessPredictOld.predictOldVersion(history);
// console.log(result);
// 输出示例: { main: ['蛇', '龙', '兔', '马'], backup: ['虎', '牛'] }
