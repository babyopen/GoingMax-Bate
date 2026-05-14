const BusinessPredictOld = {

  // 规则：生肖映射表（马=1，蛇=2，龙=3，兔=4，虎=5，牛=6，鼠=7，猪=8，狗=9，鸡=10，猴=11，羊=12）
  NUM_ZODIAC_MAP: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  // 传统生肖顺序（用于UI热度展示）
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  // 规则4-2：区间定义（一区:1-4, 二区:5-8, 三区:9-12）
  ZONES: { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8], 3: [9, 10, 11, 12] },

  _toZodiac: function(num) { return this.NUM_ZODIAC_MAP[num] || ''; },

  _getZone: function(num) {
    if (num >= 1 && num <= 4) return 1;
    if (num >= 5 && num <= 8) return 2;
    return 3;
  },

  // === 核心预测：短线顺势 温号闭环 区间轮转 ===
  // 输入：历史开奖数字数组 [7,6,9,5,...]，输出: { main:[], backup:[] }
  predictOldVersion: function(history) {
    var nums = history.filter(function(n) { return n >= 1 && n <= 12; });
    if (nums.length < 8) return { main: [], backup: [] };

    // 规则2：数据窗口 最近15期
    var pool = nums.slice(0, 15);               // 数据池（15期）
    var last12 = pool.slice(0, 12);             // 热度统计窗口（12期）
    var last5 = pool.slice(0, 5);               // 闭环窗口（5期）
    var prevNum = last12[0] || 0;               // 上期开奖号

    // 热度定义 — 在最近12期中统计
    // 热号≥3次 | 温号1-2次 | 冷号0次
    var heatMap = {};
    var warmPool = [], hotPool = [], coldPool = [];
    for (var i = 1; i <= 12; i++) {
      var cnt = last12.filter(function(n) { return n === i; }).length;
      if (cnt >= 3) {
        heatMap[i] = { count: cnt, level: 'hot' };
        hotPool.push(i);
      } else if (cnt >= 1) {
        heatMap[i] = { count: cnt, level: 'warm' };
        warmPool.push(i);
      } else {
        heatMap[i] = { count: cnt, level: 'cold' };
        coldPool.push(i);
      }
    }

    // 上期刚开出的生肖直接降权（保持现状）
    if (prevNum > 0 && heatMap[prevNum]) {
      var prevLevel = heatMap[prevNum].level;
      if (prevLevel === 'hot') {
        hotPool = hotPool.filter(function(n) { return n !== prevNum; });
      } else if (prevLevel === 'warm') {
        warmPool = warmPool.filter(function(n) { return n !== prevNum; });
      } else if (prevLevel === 'cold') {
        coldPool = coldPool.filter(function(n) { return n !== prevNum; });
      }
      heatMap[prevNum].level = 'downgrade';
    }

    // 规则4-1：优先温号闭环 — 近几期反复开出的温号组（剔除降权号）
    var warmClosedLoop = [];
    var seenIn5 = {};
    last5.forEach(function(n) { seenIn5[n] = true; });
    warmPool.forEach(function(n) {
      var baseW = heatMap[n].count * 10;           // 基础：出现次数×10
      var loopBonus = seenIn5[n] ? 15 : 0;          // 闭环：近5期出现+15
      var orderBonus = last5.indexOf(n) >= 0 ? (5 - last5.indexOf(n)) * 2 : 0;
      warmClosedLoop.push({ num: n, weight: baseW + loopBonus + orderBonus });
    });
    warmClosedLoop.sort(function(a, b) { return b.weight - a.weight; });

    // 规则4-2：区间轮转 — 上期开哪区→优先相邻区/回踩同区温号
    var targetZones = [];
    if (prevNum > 0) {
      var pz = this._getZone(prevNum);
      if (pz === 1) targetZones = [1, 2];
      else if (pz === 2) targetZones = [2, 1, 3];
      else targetZones = [3, 2];
    }

    // 规则4-3：回踩惯性 — 上期号码 ±1、±2、同尾、同区温号 必带
    var inertiaWarm = [];
    var inertiaOther = [];
    if (prevNum > 0) {
      var prevZone = this._getZone(prevNum);
      [prevNum - 1, prevNum + 1, prevNum - 2, prevNum + 2].forEach(function(n) {
        if (n >= 1 && n <= 12) {
          if (heatMap[n].level === 'warm') inertiaWarm.push(n);
          else if (heatMap[n].level !== 'hot' && inertiaOther.indexOf(n) === -1) inertiaOther.push(n);
        }
      });
      var prevTail = prevNum % 10;
      [prevTail, prevTail + 10].filter(function(n) { return n >= 1 && n <= 12 && n !== prevNum; }).forEach(function(n) {
        if (heatMap[n].level === 'warm' && inertiaWarm.indexOf(n) === -1) inertiaWarm.push(n);
        else if (heatMap[n].level !== 'hot' && inertiaOther.indexOf(n) === -1) inertiaOther.push(n);
      });
      this.ZONES[prevZone].filter(function(n) { return n !== prevNum; }).forEach(function(n) {
        if (heatMap[n].level === 'warm' && inertiaWarm.indexOf(n) === -1) inertiaWarm.push(n);
        else if (heatMap[n].level !== 'hot' && inertiaOther.indexOf(n) === -1) inertiaOther.push(n);
      });
    }

    // 规则4-4：冷号轻补 — 遗漏5-15期可带1个（含降权号中遗漏段的）
    var coldCandidates = [];
    coldPool.forEach(function(n) {
      var miss = 0;
      for (var j = 0; j < pool.length && j < 20; j++) { if (pool[j] === n) break; miss++; }
      if (miss >= 5 && miss <= 15) coldCandidates.push(n);
    });

    // === 规则5：最终选号 ===
    var selected = [], used = {};

    // Step1: 优先从温号闭环中选（全区间，排除降权号）
    warmClosedLoop.forEach(function(c) {
      if (selected.length >= 4) return;
      if (heatMap[c.num].level === 'warm' && !used[c.num]) {
        selected.push(c.num); used[c.num] = true;
      }
    }.bind(this));

    // Step2: 回踩惯性温号 必带（从惯性中剔除已在Step1选过的）
    inertiaWarm.forEach(function(n) {
      if (selected.length >= 4) return;
      if (!used[n] && heatMap[n].level === 'warm') { selected.push(n); used[n] = true; }
    });

    // Step3: 补齐温号（从闭环池剩余，排除惯性温号避免重复）
    var remainingLoop = warmClosedLoop.filter(function(c) {
      return inertiaWarm.indexOf(c.num) === -1;
    });
    remainingLoop.forEach(function(c) {
      if (selected.length >= 4) return;
      if (!used[c.num] && heatMap[c.num].level === 'warm') { selected.push(c.num); used[c.num] = true; }
    });

    // Step4: 冷号轻补（温≥3后，冷≤1）
    var warmCount = selected.filter(function(n) { return heatMap[n].level === 'warm'; }).length;
    if (warmCount >= 3 && selected.length < 4 && coldCandidates.length > 0) {
      for (var ci = 0; ci < coldCandidates.length && selected.length < 4; ci++) {
        if (!used[coldCandidates[ci]]) { selected.push(coldCandidates[ci]); used[coldCandidates[ci]] = true; break; }
      }
    }

    // Step5: 仍不足4码，按优先级补足（剩余温→轻冷→热号兜底）
    remainingLoop.forEach(function(c) {
      if (selected.length >= 4) return;
      if (!used[c.num]) { selected.push(c.num); used[c.num] = true; }
    });
    coldCandidates.forEach(function(n) {
      if (selected.length >= 4) return;
      if (!used[n]) { selected.push(n); used[n] = true; }
    });
    hotPool.forEach(function(n) {
      if (selected.length >= 4) return;
      if (!used[n]) { selected.push(n); used[n] = true; }
    });

    // 备选2码：轻冷 + 惯性其他号 + 温号，维持结构平衡
    var backup = [];
    coldCandidates.forEach(function(n) { if (!used[n] && backup.length < 2) backup.push(n); });
    inertiaOther.forEach(function(n) { if (!used[n] && backup.length < 2) backup.push(n); });
    warmPool.forEach(function(n) { if (!used[n] && backup.length < 2) backup.push(n); });

    // 规则5-⑥：数字→生肖，输出 { main: [x,x,x,x], backup: [x,x] }
    return {
      main: selected.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean),
      backup: backup.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean)
    };
  }
};