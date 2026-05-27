/**
 * V5.3 主引擎编排器
 * 对应文档第七章 14步完整计算流程 + 第六章推荐策略
 *
 * 严格按顺序：数据准备 → 状态评估 → 评分计算 → 策略输出
 */
const BusinessV53Engine = {
  _lastResult: null,
  _dynamicStates: null,
  _coldCatchEndPeriod: {},

  init: function() {
    this._dynamicStates = BusinessV53DynamicState.initStates();
    BusinessV53Markov.init();
    this._coldCatchEndPeriod = {};
    this._lastResult = null;
  },

  /**
   * 每期调用一次，运行完整引擎
   * @param {Array} rawHistory - 现有项目格式 [{number, expect, zodiac}, ...]
   * @returns {Object} 完整的引擎输出
   */
  run: function(rawHistory) {
    var t0 = performance.now();

    if (!this._dynamicStates) this.init();

    // 步骤0：数据转换
    var zodHistory = BusinessV53Utils.convertToZodiacHistory(rawHistory);
    var period = zodHistory.length;

    console.log('[V5.3] 开始计算 期数=' + period + ' 历史=' + zodHistory.length + '期');

    try {
      // ===== 阶段1：数据准备（步骤1-4） =====

      // 步骤1：窗口频次
      var windowFreq = BusinessV53Windows.computeWindowFreq(zodHistory);

      // 步骤2：关联规则 + 挂靠加分
      var rules = this._computeRules(zodHistory);
      var assocBonus = this._applyRules(rules, zodHistory);

      // 步骤3：马尔可夫链增量更新
      BusinessV53Markov.updateMatrix(zodHistory);
      var lastPer = zodHistory[zodHistory.length - 1];
      var prev2 = zodHistory.length >= 2 ? zodHistory[zodHistory.length - 2][0] : 1;
      var prev1 = lastPer ? lastPer[0] : 1;
      var markovBonus = BusinessV53Markov.computeAllBonus(prev2, prev1);

      // 步骤4：五区制分类
      var zoneClass = this._classifyZones(windowFreq['12']);

      // ===== 阶段2：状态评估（步骤5-7） =====

      // 步骤5：动态身份
      this._dynamicStates = BusinessV53DynamicState.updateStates(this._dynamicStates, zodHistory);

      // 步骤6：趋势判定（必须在评分前！）
      var trendInfo = this._detectTrend(zodHistory);
      var trend = trendInfo.trend;
      var extremeCorner = trendInfo.extremeCorner;

      // 步骤7：风控系数（在scoring中动态计算）
      var freq11 = BusinessV53Utils.countWindowFreq(zodHistory, 11);

      // ===== 阶段3：评分计算（步骤8-10） =====

      // 步骤8：物理特征
      var physicalScores = BusinessV53Scoring.computePhysicalScores(zodHistory);

      // 步骤9：变化率 + 最终分
      var changeRates = BusinessV53Windows.computeChangeRate(zodHistory);
      var finalScores = BusinessV53Scoring.computeFinalScores({
        windowFreq: windowFreq,
        changeRates: changeRates,
        markovBonus: markovBonus,
        physicalScores: physicalScores,
        associationBonus: assocBonus,
        dynamicStates: this._dynamicStates,
        trend: trend,
        zodiacHistory: zodHistory,
        freq11: freq11
      });

      // 步骤10：排序
      var sorted = BusinessV53Scoring.sortByScore(finalScores);

      // ===== 阶段4：策略输出（步骤11-14） =====

      // 步骤11：冷号回补
      var coldCatch = this._coldCatch(zodHistory, rules, trend, period);

      // 步骤12：推荐策略
      var rec = this._generateRec({
        sorted: sorted,
        scores: finalScores,
        trend: trend,
        states: this._dynamicStates,
        coldCatch: coldCatch,
        extremeCorner: extremeCorner,
        zoneClass: zoneClass,
        zodiacHistory: zodHistory
      });

      // 步骤13：极冷预警
      var warnings = this._warnings(zodHistory);

      // 组装结果
      var result = {
        version: BusinessV53Config.VERSION,
        period: period,
        timestamp: Date.now(),
        windowFreq: windowFreq,
        dynamicStates: this._dynamicStates,
        trend: trend,
        extremeCorner: extremeCorner,
        zoneClass: zoneClass,
        scores: finalScores,
        sorted: sorted,
        recommendations: rec,
        warnings: warnings,
        coldCatch: coldCatch,
        computeTime: Math.round((performance.now() - t0) * 100) / 100
      };

      this._lastResult = result;

      console.log('[V5.3] 完成! 耗时=' + result.computeTime + 'ms 主推=' + JSON.stringify(rec.main) + ' 备选=' + JSON.stringify(rec.backup) + ' 趋势=' + trend);
      if (extremeCorner) console.log('[V5.3] ⚠️ 极端拐点');
      if (warnings.length) console.log('[V5.3] 预警: ' + warnings.join('; '));

      return result;

    } catch(e) {
      console.error('[V5.3] 出错:', e);
      return { error: true, message: e.message, period: period };
    }
  },

  // ========== 趋势判定（5.5节） ==========
  _detectTrend: function(zodHistory) {
    var recent3 = zodHistory.slice(-3);
    if (recent3.length < 3) return { trend: 'oscillation', extremeCorner: false };

    var hotPool = BusinessV53DynamicState.getEffectiveHotPool(this._dynamicStates);
    var coldPool = BusinessV53DynamicState.getEffectiveColdPool(this._dynamicStates);

    var h = 0, c = 0;
    recent3.forEach(function(p) {
      p.forEach(function(n) {
        if (hotPool.indexOf(n) !== -1) h++;
        if (coldPool.indexOf(n) !== -1) c++;
      });
    });

    var trend = 'oscillation';
    if (h >= BusinessV53Config.TREND_THRESHOLD.HOT_MIN) trend = 'strongHot';
    else if (c >= BusinessV53Config.TREND_THRESHOLD.COLD_MIN) trend = 'strongCold';

    // 极端拐点：连续3期全部为热号（全热）或全部为冷号（全冷）
    var allHot = recent3.every(function(p) {
      return p.length > 0 && p.every(function(n) { return hotPool.indexOf(n) !== -1; });
    });
    var allCold = recent3.every(function(p) {
      return p.length > 0 && p.every(function(n) { return coldPool.indexOf(n) !== -1; });
    });
    var extreme = allHot || allCold;

    return { trend: trend, extremeCorner: extreme };
  },

  // ========== 五区制（第三章） ==========
  _classifyZones: function(freq12) {
    var zones = {};
    for (var n = 1; n <= 12; n++) {
      var f = freq12[n] || 0;
      if (f >= 4) zones[n] = 'peak';
      else if (f === 3) zones[n] = 'down';
      else if (f === 2) zones[n] = 'rotate';
      else if (f === 1) zones[n] = 'wait';
      else zones[n] = 'silent';
    }
    return zones;
  },

  // ========== 关联规则 ==========
  _computeRules: function(zodHistory) {
    // 历史不足50期 → 使用5条过渡规则（文档1.2节）
    if (zodHistory.length < 50) {
      return [
        { left: [2], right: [5], confidence: 0.65, lift: 1.8 },
        { left: [8], right: [4], confidence: 0.62, lift: 1.6 },
        { left: [11], right: [7], confidence: 0.60, lift: 1.55 },
        { left: [10], right: [2], confidence: 0.58, lift: 1.52 },
        { left: [3], right: [1], confidence: 0.60, lift: 1.55 }
      ];
    }

    // 简化版Apriori：挖掘单号前项→单号后项规则
    var rules = [];
    var recent50 = zodHistory.slice(-50);
    var totalPeriods = recent50.length;

    // 遍历所有可能的号码配对 (12×12 = 144种)
    for (var left = 1; left <= 12; left++) {
      for (var right = 1; right <= 12; right++) {
        if (left === right) continue;

        var togetherCount = 0;
        var leftCount = 0;
        var rightCount = 0;

        recent50.forEach(function(period) {
          var hasLeft = period.indexOf(left) !== -1;
          var hasRight = period.indexOf(right) !== -1;
          if (hasLeft && hasRight) togetherCount++;
          if (hasLeft) leftCount++;
          if (hasRight) rightCount++;
        });

        // 支持度 ≥ 3
        if (togetherCount < 3) continue;

        // 置信度 = P(right | left) ≥ 60%
        var confidence = leftCount > 0 ? togetherCount / leftCount : 0;
        if (confidence < 0.6) continue;

        // 提升度 = P(left,right) / (P(left) × P(right)) > 1.5
        var pJoint = togetherCount / totalPeriods;
        var pLeft = leftCount / totalPeriods;
        var pRight = rightCount / totalPeriods;
        var lift = (pLeft * pRight) > 0 ? pJoint / (pLeft * pRight) : 0;
        if (lift <= 1.5) continue;

        rules.push({
          left: [left],
          right: [right],
          confidence: Math.round(confidence * 100) / 100,
          lift: Math.round(lift * 100) / 100,
          support: togetherCount
        });
      }
    }

    // 按置信度降序，取前3条
    rules.sort(function(a, b) { return b.confidence - a.confidence; });
    return rules.slice(0, BusinessV53Config.ASSOCIATION.MAX_RULES);
  },

  _applyRules: function(rules, zodHistory) {
    var bonus = {};
    for (var i = 1; i <= 12; i++) bonus[i] = 0;
    var last = zodHistory[zodHistory.length - 1];
    if (!last) return bonus;

    rules.forEach(function(r) {
      if (last.indexOf(r.left[0]) !== -1) {
        r.right.forEach(function(t) { if (t >= 1 && t <= 12) bonus[t] = (bonus[t] || 0) + 5; });
      }
    });
    return bonus;
  },

  // ========== 冷号回补（5.4节 四阶段判断 + 不重开铁律） ==========
  _coldCatch: function(zodHistory, rules, _trend, currentPeriod) {
    var results = [];
    var coldPool = BusinessV53Config.FIXED_POOLS.COLD;
    var S = BusinessV53Config.STATUS;

    coldPool.forEach(function(num) {
      var state = this._dynamicStates[num];
      if (!state) return;

      // 只检查固定冷号或冷→热观察期的号码
      var isColdOrObserving = state.status === S.NORMAL_COLD ||
        state.status === S.COLD_TO_HOT_HARD_OBSERVE ||
        state.status === S.COLD_TO_HOT_SOFT_OBSERVE;
      if (!isColdOrObserving) return;

      // 不重开铁律：5期内已触发过则忽略
      var lastEnd = this._coldCatchEndPeriod[num] || 0;
      if (currentPeriod - lastEnd < 5 && lastEnd > 0) return;

      var f7 = BusinessV53Utils.getRecentCount(zodHistory, num, 7);

      // 找关联热号（最高置信度规则中的热号）
      var relatedHot = null;
      rules.forEach(function(r) {
        if (r.left.indexOf(num) !== -1) {
          r.right.forEach(function(rn) {
            if (BusinessV53Config.FIXED_POOLS.HOT.indexOf(rn) !== -1) relatedHot = rn;
          });
        }
      });
      if (!relatedHot) relatedHot = BusinessV53Config.FIXED_POOLS.HOT[0];

      var hotFreq3 = BusinessV53Utils.getRecentCount(zodHistory, relatedHot, 3);

      var phase = null;

      // 阶段三（高潮）：近7期≥4次 + 关联热号近3期≥3次（先于阶段二检查，避免被覆盖）
      if (f7 >= 4 && hotFreq3 >= 3) phase = 3;

      // 阶段二（加速）：近7期>3次 + 关联热号近3期≥2次（排除已判定为阶段三的情况）
      else if (f7 > 3 && hotFreq3 >= 2) phase = 2;

      // 阶段一（启动）：近7期2~3次 + 关联热号近3期≥1次
      if (!phase && f7 >= 2 && f7 <= 3 && hotFreq3 >= 1) phase = 1;

      // 阶段四（尾声）：近7期次数下降/连续2期未出
      var recent2Miss = BusinessV53Utils.getRecentCount(zodHistory, num, 2) === 0;
      if (recent2Miss && f7 > 0 && !phase) phase = 4;

      if (phase) {
        results.push({
          number: num,
          phase: phase,
          relatedHot: relatedHot
        });
      }
    }.bind(this));

    return results;
  },

  // ========== 推荐策略（第六章 + 5.3行情优先级） ==========
  _generateRec: function(p) {
    var sorted = p.sorted;
    var trend = p.trend;
    var scores = p.scores;
    var coldCatch = p.coldCatch;
    var extremeCorner = p.extremeCorner;
    var zoneClass = p.zoneClass;
    var states = p.states;

    var hotPool = BusinessV53DynamicState.getEffectiveHotPool(states);
    var coldPool = BusinessV53DynamicState.getEffectiveColdPool(states);

    // === 行情优先级 5.3: 冷号回补 > 极端拐点 > 常规趋势 ===

    // ---- 优先级1: 冷号集中回补 ----
    if (coldCatch.length > 0) {
      // 按近7期次数排序，取最多的
      coldCatch.sort(function(a, b) { return b.phase - a.phase; });
      var cc = coldCatch[0];

      // 阶段一：仅震荡趋势下提升至主推第一位
      if (cc.phase === 1 && trend === 'oscillation') {
        var ccMain = [cc.number];
        hotPool.forEach(function(n) { if (ccMain.length < 4 && ccMain.indexOf(n) === -1) ccMain.push(n); });
        coldPool.forEach(function(n) { if (ccMain.length < 4 && ccMain.indexOf(n) === -1) ccMain.push(n); });
        var ccBackup = [coldPool[0] || hotPool[2], hotPool[3] || coldPool[1]]
          .filter(function(n) { return n && ccMain.indexOf(n) === -1; }).slice(0, 2);
        return { main: ccMain.slice(0, 4), backup: ccBackup };
      }

      // 阶段二及以上：所有趋势下强制主推第一位
      if (cc.phase >= 2) {
        var cc2Main = [cc.number];
        hotPool.forEach(function(n) { if (cc2Main.length < 4 && cc2Main.indexOf(n) === -1) cc2Main.push(n); });
        coldPool.forEach(function(n) { if (cc2Main.length < 4 && cc2Main.indexOf(n) === -1) cc2Main.push(n); });
        var cc2Backup = [hotPool[1] || coldPool[0], coldPool[1] || hotPool[2]]
          .filter(function(n) { return n && cc2Main.indexOf(n) === -1; }).slice(0, 2);
        return { main: cc2Main.slice(0, 4), backup: cc2Backup };
      }
    }

    // ---- 基础推荐策略 ----
    var main = [], backup = [];

    if (trend === 'strongHot') {
      // 6.1: 强热 → 热池前4 + 备选 热⑤+冷①
      main = this._pickTopN(hotPool, 4, sorted);
      backup = [hotPool[4] || coldPool[0], coldPool[0] || hotPool[5]];
    } else if (trend === 'strongCold') {
      // 6.2: 强冷 → 冷池前3 + 总热度顺位第4（按finalScore排名的整体顺位）
      var top3Cold = this._pickTopN(coldPool, 3, sorted);
      main = top3Cold;
      var fourth = sorted.find(function(s) { return main.indexOf(s.number) === -1; });
      if (fourth) main.push(fourth.number);
      backup = [coldPool[3] || hotPool[0], hotPool[0] || coldPool[4]];
    } else {
      // 6.3: 震荡 → 热①+热②+冷①+变盘06, 备选 冷②+热③
      var changeDisk = BusinessV53Config.RECOMMENDATION.CHANGE_DISK;
      var zone06 = zoneClass[changeDisk] || '';

      // 若06受风控限制（顶峰/降权）且当前不是转冷状态 → 顺延热池④
      var useChangeDisk = changeDisk;
      if (zone06 === 'peak' || zone06 === 'down') {
        var state06 = states[changeDisk];
        var S = BusinessV53Config.STATUS;
        if (state06 && state06.status !== S.HOT_TO_COLD_HARD_OBSERVE &&
            state06.status !== S.HOT_TO_COLD_SOFT_OBSERVE) {
          useChangeDisk = hotPool[3] || changeDisk;
        }
      }

      main = [hotPool[0] || 1, hotPool[1] || 5, coldPool[0] || 2, useChangeDisk];
      backup = [coldPool[1] || 3, hotPool[2] || 6];

      // 极冷预警（5.2节）：震荡趋势下强制极冷号加入备选
      if (p.zodiacHistory) {
        var extremeColdNums = [];
        for (var en = 1; en <= 12; en++) {
          var miss = BusinessV53Utils.getMissCount(p.zodiacHistory, en);
          if (miss >= 36 && main.indexOf(en) === -1) extremeColdNums.push({ num: en, miss: miss });
        }
        // 取遗漏值最大的两号替换备选末位
        if (extremeColdNums.length > 0) {
          extremeColdNums.sort(function(a, b) { return b.miss - a.miss; });
          for (var ei = 0; ei < Math.min(extremeColdNums.length, 2); ei++) {
            var ec = extremeColdNums[ei].num;
            if (main.indexOf(ec) === -1 && backup.indexOf(ec) === -1) {
              if (backup.length >= 2) backup[backup.length - 1] = ec;
              else backup.push(ec);
            }
          }
        }
      }
    }

    // ---- 极端拐点修正（5.6节） ----
    if (extremeCorner) {
      var reversePool = (trend === 'strongHot') ? coldPool : hotPool;
      if (reversePool.length > 0) {
        // 找主推中热度分最低的号码替换（5.6节明确规则）
        var minScoreIdx = 0;
        var minScore = Infinity;
        main.forEach(function(n, i) {
          var s = scores[n] || 0;
          if (s < minScore) { minScore = s; minScoreIdx = i; }
        });

        // 从反向池中找热度分最高的（同分小号优先）
        var bestReverse = reversePool[0];
        var bestScore = scores[bestReverse] || 0;
        reversePool.forEach(function(n) {
          var s = scores[n] || 0;
          if (s > bestScore || (s === bestScore && n < bestReverse)) {
            bestScore = s;
            bestReverse = n;
          }
        });

        // 替换主推中热度分最低的（如果反向号不在主推中）
        if (main.indexOf(bestReverse) === -1) {
          main[minScoreIdx] = bestReverse;
        }

        // 备选中加入2个反向区间号码（替换备选末位）
        var revCandidates = reversePool.filter(function(n) {
          return main.indexOf(n) === -1 && backup.indexOf(n) === -1;
        });
        var revInBackup = backup.filter(function(n) { return reversePool.indexOf(n) !== -1; }).length;
        var needRev = 2 - revInBackup;
        if (needRev > 0 && revCandidates.length > 0) {
          // 取反向池中热度分最高的
          revCandidates.sort(function(a, b) { return (scores[b] || 0) - (scores[a] || 0); });
          while (needRev > 0 && revCandidates.length > 0) {
            backup.push(revCandidates.shift());
            needRev--;
          }
        }
      }
    }

    // 去重+截断
    main = main.filter(function(n, i, arr) { return n && arr.indexOf(n) === i; }).slice(0, 4);
    backup = backup.filter(function(n, i, arr) { return n && arr.indexOf(n) === i && main.indexOf(n) === -1; }).slice(0, 2);

    return { main: main, backup: backup };
  },

  /**
   * 从池中按scores排序取前N个
   */
  _pickTopN: function(pool, n, sorted) {
    var poolSet = {};
    pool.forEach(function(num) { poolSet[num] = true; });
    var result = [];
    sorted.forEach(function(item) {
      if (poolSet[item.number] && result.length < n) {
        result.push(item.number);
      }
    });
    return result;
  },

  // ========== 极冷预警（5.2节） ==========
  _warnings: function(zodHistory) {
    var w = [];
    for (var n = 1; n <= 12; n++) {
      var miss = BusinessV53Utils.getMissCount(zodHistory, n);
      if (miss >= 36) {
        w.push('⚠️ 号码' + n + '(' + BusinessV53Utils.numToZodiac(n) + ')已遗漏' + miss + '期');
      }
    }
    return w;
  },

  /** 获取上次结果 */
  getLastResult: function() { return this._lastResult; },

  /** 重置 */
  reset: function() { this.init(); }
};