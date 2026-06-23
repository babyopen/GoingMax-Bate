/**
 * 业务层：加权 3 阶马尔可夫链算法（V4.4.2 调优版，2026-06-23）
 * @namespace ZodiacPredictionScores
 *
 * 算法核心（V4 完全重写）：
 *   - 1/2/3 阶转移矩阵 T1 / T2 / T3
 *   - 加权综合得分：score(X) = α₁·P₁(X) + α₂·P₂(X) + α₃·P₃(X)
 *   - Backoff 平滑：T3 无数据 → T2 → T1 → 1/12 均匀
 *   - Laplace 平滑：P(X|state) = (count + α) / (sum + α × V)
 *   - 指数衰减：DECAY^i 让近期数据权重大
 *   - V4.2 热温冷：freshness + relativeCombined 综合判定
 *   - V4.3 动态权重：基于近 15 期数据模式自适应
 *   - V4.4.2 调优：BASE 0.50 / LAMBDA 0.12 / WEIGHTS 0.35/0.30/0.35
 *
 * 对外 API（保持兼容）：
 *   - calcContinuousScores(historyData) → {cards, details, sorted, latestSpecial, latestExpect}
 *   - runBacktest / getBacktestSummary / analyzeBacktest / getTunedStrategy
 *   - _precomputeMarkov / _getProbBackoff / _getDynamicHeatWeights / _pickRole
 *
 * details 结构变化（V4.4.2）：
 *   - V3：{base, shape, interval, trend, momentum, miss}
 *   - V4：{p1, p2, p3, combined, miss, freshness, heatScore, relativeCombined}
 */
const ZodiacPredictionScores = {
  // ===== 常量 =====

  // 加权多阶链权重（V4.4.2 调优：1 阶略高）
  //   回测分析：1 阶区分度 0.0502 > 3 阶 0.0488 > 2 阶 0.0447
  //   1 阶优势较小（差 0.0014，约 2.8%），无需过度倾斜
  WEIGHTS: { 1: 0.35, 2: 0.30, 3: 0.35 },

  // 转移矩阵的指数衰减因子（V4.1 优化：近期数据权重大）
  //   DECAY^i：i=0（最新）权重=1，i=N-1（最旧）权重≈0
  //   例 DECAY=0.99，50 期前权重=0.61，100 期前权重=0.37，200 期前权重=0.13
  DECAY: 0.99,

  // Laplace 平滑参数（V4.1 优化：避免 count=0 导致概率=0 强制回退）
  //   P(X|state) = (count + α) / (sum + α × V)，V=12（生肖数）
  ALPHA: 0.5,

  // 角色映射规则
  ROLE_RULES: [
    { max: 0, role: '精选', cls: 'is-selected' },
    { max: 2, role: '精选', cls: 'is-featured' },
    { max: 5, role: '防守', cls: 'is-featured' },
    { max: 11, role: '防守', cls: 'is-secondary' }
  ],

  // 热温冷综合判定（V4.2 / V4.3 动态权重 / V4.4.2 调优）
  //   heatScore(z) = α · relativeCombined(z) + β · freshness(z)
  //   relativeCombined(z) = combined(z) / maxCombined  // 相对 top1 归一化
  //   freshness(z)        = e^(-λ · miss(z))           // 时间衰减
  //   判定: heatScore >= hot → 热号; >= warm → 温号; 否则 → 冷号
  // V4.3 动态权重：根据近 15 期数据模式自适应调整
  //   freshnessWeight = BASE + CONC_COEF × concentration + ACTIV_COEF × (1 - activity)
  //   combinedWeight   = 1 - freshnessWeight
  HEAT_WEIGHTS: { combined: 0.45, freshness: 0.55 },   // V4.4.2 兜底（与 BASE 0.50 平衡）
  HEAT_WEIGHTS_BASE: 0.50,                             // V4.4.2 调优：0.60→0.50，避免过度倾向 miss
  HEAT_WEIGHTS_CONC_COEF: 0.05,                        // V4.4 调整为保守版 0.10→0.05
  HEAT_WEIGHTS_ACTIV_COEF: 0.05,                       // V4.4 调整为保守版 0.10→0.05
  HEAT_FRESHNESS_LAMBDA: 0.12,                         // V4.4.2 调优：0.20→0.12，衰减更温和
  HEAT_THRESHOLDS: { hot: 0.60, warm: 0.45 },          // V4.4.2 调优：0.65→0.60，分布更合理
  HEAT_RECENT_WINDOW: 15,                              // 动态权重参考的近 N 期数据

  // 用于 analyzeBacktest 的维度上限（用于归一化）
  // V4.4 升级：新增 freshness/heatScore/relativeCombined
  DIM_MAX: { p1: 1, p2: 1, p3: 1, combined: 1, miss: 60, freshness: 1, heatScore: 1, relativeCombined: 1 },

  // 回测配置
  BACKTEST_LIMIT: 50,

  // ===== 主入口 =====

  calcContinuousScores: function(historyData) {
    if (!historyData || !historyData.length) return null;

    var list = historyData;
    var n = list.length;
    var latestExpect = Number(list[0]?.expect || 0);
    var order = ZodiacPrediction.ZODIAC_ORDER;

    // 1. 预计算：1/2/3 阶转移矩阵 + specials + lastIdx
    var ctx = this._precomputeMarkov(list);

    // 2. 取最近 1/2/3 期作为上下文
    var s1 = ctx.specials[0], s2 = ctx.specials[1], s3 = ctx.specials[2];
    var z1 = s1 ? s1.zod : null;
    var z2 = s2 ? s2.zod : null;
    var z3 = s3 ? s3.zod : null;

    // 3. 每个生肖的综合得分（加权 Backoff 概率）
    var weights = this.WEIGHTS;
    var scores = {};
    var details = {};
    for (var i = 0; i < order.length; i++) {
      var z = order[i];
      var p1 = this._getProbBackoff(ctx, 1, [z1], z);
      var p2 = this._getProbBackoff(ctx, 2, [z1, z2], z);
      var p3 = this._getProbBackoff(ctx, 3, [z1, z2, z3], z);
      var combined = weights[1] * p1 + weights[2] * p2 + weights[3] * p3;
      scores[z] = combined;
      details[z] = {
        p1: p1, p2: p2, p3: p3,
        combined: combined,
        miss: ctx.lastIdx[z] === -1 ? n : ctx.lastIdx[z]
      };
    }

    // 4. 排序（用 combined 排序，热温冷判定独立）
    var sorted = [];
    for (var i = 0; i < order.length; i++) sorted.push([order[i], scores[order[i]]]);
    sorted.sort(function(a, b) { return b[1] - a[1]; });

    var maxScore = sorted.length ? sorted[0][1] : 0;
    var minScore = sorted.length ? sorted[sorted.length - 1][1] : 0;
    var scoreRange = maxScore - minScore || 1;

    // 5. V4.3 动态热温冷权重（基于近 15 期数据模式）
    var heatWeights = this._getDynamicHeatWeights(ctx);
    var freshnessLambda = this.HEAT_FRESHNESS_LAMBDA;
    var heatThresholds = this.HEAT_THRESHOLDS;

    var cards = [];
    for (var idx = 0; idx < sorted.length; idx++) {
      var zod = sorted[idx][0];
      var rawScore = sorted[idx][1];
      var normalizedScore = Math.round(((rawScore - minScore) / scoreRange) * 40 + 45);
      normalizedScore = Math.max(0, Math.min(100, normalizedScore));

      var det = details[zod];

      // V4.3 综合判定（动态权重）：
      //   relativeCombined = combined / maxCombined（相对 top1 强度）
      //   freshness = e^(-λ · miss)（近期出现频率）
      //   heatScore = α_dynamic · relativeCombined + β_dynamic · freshness
      //   α/β 根据近 15 期的 concentration + activity 动态调整
      var relativeCombined = maxScore > 0 ? det.combined / maxScore : 0;
      var freshness = Math.exp(-freshnessLambda * det.miss);
      var heatScore = heatWeights.combined * relativeCombined + heatWeights.freshness * freshness;
      var heatTag = heatScore >= heatThresholds.hot ? '热号'
                  : (heatScore >= heatThresholds.warm ? '温号' : '冷号');

      // V4.4：把 freshness 和 heatScore 也存到 details，方便回测追踪
      det.freshness = freshness;
      det.heatScore = heatScore;
      det.relativeCombined = relativeCombined;

      var roleInfo = this._pickRole(idx);
      cards.push({
        zodiac: zod,
        score: normalizedScore,
        roleTag: roleInfo.role,
        heatTag: heatTag,
        cardClass: roleInfo.cls
      });
    }

    return {
      cards: cards,
      details: details,
      latestSpecial: s1,
      sorted: sorted,
      latestExpect: latestExpect
    };
  },

  // ===== V4 预计算：1/2/3 阶转移矩阵 =====

  _precomputeMarkov: function(list) {
    var n = list.length;
    var order = ZodiacPrediction.ZODIAC_ORDER;
    var orderSet = new Set(order);

    // 计算 specials + lastIdx
    var specials = new Array(n);
    var lastIdx = {};
    for (var i = 0; i < order.length; i++) lastIdx[order[i]] = -1;
    for (var i = 0; i < n; i++) {
      var s = Utils.SpecialCalculator.getSpecial(list[i]);
      specials[i] = s;
      // list[0] 是最新期，idx 越小越新
      if (orderSet.has(s.zod) && lastIdx[s.zod] === -1) {
        lastIdx[s.zod] = i;
      }
    }

    var T1 = {}, T2 = {}, T3 = {};
    var decay = this.DECAY; // V4.1 优化：指数衰减

    // 1 阶：z[i] → z[i+1]
    for (var i = 0; i < n - 1; i++) {
      var z0 = specials[i].zod;
      var z1 = specials[i + 1].zod;
      if (!orderSet.has(z0) || !orderSet.has(z1)) continue;
      if (!T1[z0]) T1[z0] = {};
      // 指数衰减：list[0] 是最新，i=0 权重最大（=1），i 越大权重越小
      T1[z0][z1] = (T1[z0][z1] || 0) + Math.pow(decay, i);
    }

    // 2 阶：(z[i], z[i+1]) → z[i+2]
    for (var i = 0; i < n - 2; i++) {
      var z0 = specials[i].zod;
      var z1 = specials[i + 1].zod;
      var z2 = specials[i + 2].zod;
      if (!orderSet.has(z0) || !orderSet.has(z1) || !orderSet.has(z2)) continue;
      var key2 = z0 + ',' + z1;
      if (!T2[key2]) T2[key2] = {};
      T2[key2][z2] = (T2[key2][z2] || 0) + Math.pow(decay, i);
    }

    // 3 阶：(z[i], z[i+1], z[i+2]) → z[i+3]
    for (var i = 0; i < n - 3; i++) {
      var z0 = specials[i].zod;
      var z1 = specials[i + 1].zod;
      var z2 = specials[i + 2].zod;
      var z3 = specials[i + 3].zod;
      if (!orderSet.has(z0) || !orderSet.has(z1) || !orderSet.has(z2) || !orderSet.has(z3)) continue;
      var key3 = z0 + ',' + z1 + ',' + z2;
      if (!T3[key3]) T3[key3] = {};
      T3[key3][z3] = (T3[key3][z3] || 0) + Math.pow(decay, i);
    }

    return {
      n: n,
      specials: specials,
      lastIdx: lastIdx,
      T1: T1,
      T2: T2,
      T3: T3,
      orderSet: orderSet
    };
  },

  // ===== V4.3 动态热温冷权重 =====
  // 基于近 N 期的数据模式自适应调整 freshness 权重
  //   concentration = maxFreq(近N期) / N   最高频生肖占比
  //   activity      = activeCount / 12      出现过的生肖种类占比
  //   freshnessWeight = BASE + CONC_COEF × concentration + ACTIV_COEF × (1 - activity)
  //   combinedWeight   = 1 - freshnessWeight
  // 逻辑：
  //   - 集中度高（少数生肖热）→ freshness 权重大（知道"刚开的"）
  //   - 活跃度低（多生肖冷）→ freshness 权重大（知道"很久没开的"）
  //   - 集中度低 + 活跃度高（均匀分布）→ combined 权重大（靠算法预测）
  _getDynamicHeatWeights: function(ctx) {
    var win = this.HEAT_RECENT_WINDOW;
    var n = Math.min(win, ctx.n);

    // 统计近 N 期每个生肖出现次数
    var freq = {};
    for (var i = 0; i < n; i++) {
      var z = ctx.specials[i].zod;
      if (ctx.orderSet.has(z)) freq[z] = (freq[z] || 0) + 1;
    }

    // 计算 concentration 和 activity
    var maxFreq = 0, activeCount = 0;
    for (var k in freq) {
      if (freq[k] > maxFreq) maxFreq = freq[k];
      activeCount++;
    }
    var concentration = n > 0 ? maxFreq / n : 0;
    var activity = activeCount / 12;

    // 动态权重公式
    var freshnessWeight = this.HEAT_WEIGHTS_BASE
      + this.HEAT_WEIGHTS_CONC_COEF * concentration
      + this.HEAT_WEIGHTS_ACTIV_COEF * (1 - activity);
    // 限制范围 [0.20, 0.80] 防止极端值
    freshnessWeight = Math.max(0.20, Math.min(0.80, freshnessWeight));

    return {
      combined: 1 - freshnessWeight,
      freshness: freshnessWeight,
      meta: { concentration: concentration, activity: activity, windowSize: n }
    };
  },

  // ===== V4.1 Backoff 概率查询 =====
  // stateArr: 当前上下文（长度 = order 阶数）
  // 自动从 order 阶数回退到低阶（如 3 阶无数据 → 2 阶 → 1 阶 → 1/12）
  // V4.1 增强：当前阶存在 state 时，应用 Laplace 平滑（避免 count=0 强制回退）
  _getProbBackoff: function(ctx, order, stateArr, target) {
    var T = order === 3 ? ctx.T3 : (order === 2 ? ctx.T2 : ctx.T1);
    var alpha = this.ALPHA; // V4.1：Laplace 平滑参数
    var V = 12;             // 状态空间大小（生肖数）

    var key = stateArr.join(',');

    // 当前阶存在 state（即使 target 未出现过）→ 应用 Laplace 平滑
    //   P(X|state) = (count + α) / (sum + α × V)
    //   优点：count=0 时返回 α/(sum+α×V)，避免完全回退，保留高阶信息
    if (T[key]) {
      var sum = 0;
      for (var k in T[key]) sum += T[key][k];
      var count = T[key][target] || 0;
      // 衰减后的 sum 可能非常小（如 < 1），Laplace 平滑占主导时退化到接近均匀
      if (sum + alpha * V > 0) return (count + alpha) / (sum + alpha * V);
    }

    // 当前阶完全没数据 → 回退到低阶（除非已是 1 阶）
    if (order > 1) {
      var lowerStateArr = stateArr.slice(0, order - 1);
      // 过滤掉 null 状态
      var hasNull = false;
      for (var i = 0; i < lowerStateArr.length; i++) {
        if (lowerStateArr[i] == null) { hasNull = true; break; }
      }
      if (!hasNull) {
        return this._getProbBackoff(ctx, order - 1, lowerStateArr, target);
      }
    }

    // 兜底：均匀分布
    return 1 / 12;
  },

  // ===== 辅助：角色映射 =====

  _pickRole: function(idx) {
    var rules = this.ROLE_RULES;
    for (var i = 0; i < rules.length; i++) {
      if (idx <= rules[i].max) return rules[i];
    }
    return rules[rules.length - 1];
  },

  // ===== 回测（V4.4 升级：收集 freshness/heatScore 等字段） =====

  runBacktest: function(historyData) {
    if (!historyData || historyData.length < 4) return null;

    var results = [];
    var loopMax = Math.min(historyData.length - 2, this.BACKTEST_LIMIT);
    for (var i = 1; i < loopMax; i++) {
      var testData = historyData.slice(i);
      var targetItem = historyData[i - 1];
      if (!targetItem) continue;

      var prediction = ZodiacPrediction.calcContinuousScores(testData);
      if (!prediction) continue;

      var top6 = prediction.sorted.slice(0, 6);
      var actualSpecial = Utils.SpecialCalculator.getSpecial(targetItem);
      var actualZod = actualSpecial.zod;
      var actualTe = actualSpecial.te;

      var hitRank = 0;
      for (var j = 0; j < top6.length; j++) {
        if (top6[j][0] === actualZod) { hitRank = j + 1; break; }
      }

      var actualDet = prediction.details[actualZod] || {};
      var actualCard = null;
      // 从 cards 数组找到 actualZod 对应的卡（拿到 heatTag / cardClass）
      if (prediction.cards) {
        for (var k = 0; k < prediction.cards.length; k++) {
          if (prediction.cards[k].zodiac === actualZod) {
            actualCard = prediction.cards[k];
            break;
          }
        }
      }
      results.push({
        expect: Number(targetItem.expect || 0),
        top6: top6.map(function(e) { return e[0]; }),
        top6Scores: top6.map(function(e) { return e[1]; }),
        actualZodiac: actualZod,
        actualTe: actualTe,
        hit: hitRank > 0,
        hitRank: hitRank,
        // V4.4 升级：details 字段扩展为 3 阶概率 + combined + miss + heatTag + freshness + heatScore
        actualDetails: {
          p1: actualDet.p1 || 0, p2: actualDet.p2 || 0, p3: actualDet.p3 || 0,
          combined: actualDet.combined || 0, miss: actualDet.miss || 0,
          // V4.4 新增：热温冷相关字段
          heatTag: actualCard ? actualCard.heatTag : '',
          cardClass: actualCard ? actualCard.cardClass : '',
          freshness: actualDet.freshness || 0,
          heatScore: actualDet.heatScore || 0
        }
      });
    }

    var total = results.length;

    // 单次循环累加（4N → N）
    var hits = 0, top1Hits = 0, top2Hits = 0, top3Hits = 0;
    for (var i = 0; i < total; i++) {
      var r = results[i];
      if (r.hit) hits++;
      if (r.hitRank === 1) top1Hits++;
      else if (r.hitRank === 2) top2Hits++;
      else if (r.hitRank === 3) top3Hits++;
    }

    var summary = {
      total: total,
      hits: hits,
      hitRate: total > 0 ? Math.round(hits / total * 100) : 0,
      top1Hits: top1Hits,
      top2Hits: top2Hits,
      top3Hits: top3Hits,
      top1Rate: total > 0 ? Math.round(top1Hits / total * 100) : 0,
      top2Rate: total > 0 ? Math.round(top2Hits / total * 100) : 0,
      top3Rate: total > 0 ? Math.round(top3Hits / total * 100) : 0,
      records: results
    };
    Storage.set(Storage.KEYS.ZODIAC_BACKTEST, summary);
    return summary;
  },

  getBacktestSummary: function() {
    return Storage.get(Storage.KEYS.ZODIAC_BACKTEST, null);
  },

  // ===== 调优（V4.4 升级：适配多字段 + 强化 miss 维度） =====

  analyzeBacktest: function(summary) {
    if (!summary || !summary.records || !summary.records.length) return null;

    var hits = [];
    var misses = [];
    for (var i = 0; i < summary.records.length; i++) {
      var r = summary.records[i];
      if (r.hit) hits.push(r); else misses.push(r);
    }

    // V4.4 升级：维度从 {p1,p2,p3,combined,miss} 扩展为
    //   {p1, p2, p3, combined, miss, freshness, heatScore, relativeCombined}
    var dims = ['p1', 'p2', 'p3', 'combined', 'miss', 'freshness', 'heatScore', 'relativeCombined'];
    var dimMax = this.DIM_MAX;
    var dimEff = { p1: 0, p2: 0, p3: 0, combined: 0, miss: 0, freshness: 0, heatScore: 0, relativeCombined: 0 };
    var dimTotal = { p1: 0, p2: 0, p3: 0, combined: 0, miss: 0, freshness: 0, heatScore: 0, relativeCombined: 0 };

    for (var i = 0; i < hits.length; i++) {
      var d = hits[i].actualDetails;
      if (!d) continue;
      for (var k = 0; k < dims.length; k++) {
        var key = dims[k];
        dimEff[key] += (d[key] || 0) / dimMax[key];
        dimTotal[key] += 1;
      }
    }
    for (var i = 0; i < misses.length; i++) {
      var d = misses[i].actualDetails;
      if (!d) continue;
      for (var k = 0; k < dims.length; k++) {
        dimTotal[dims[k]] += 1;
      }
    }

    var dimAvg = { p1: 0, p2: 0, p3: 0, combined: 0, miss: 0, freshness: 0, heatScore: 0, relativeCombined: 0 };
    for (var k = 0; k < dims.length; k++) {
      var key = dims[k];
      dimAvg[key] = dimTotal[key] > 0 ? dimEff[key] / dimTotal[key] : 0;
    }

    var maxEff = 0;
    for (var k = 0; k < dims.length; k++) {
      if (dimAvg[dims[k]] > maxEff) maxEff = dimAvg[dims[k]];
    }

    var normEff = {};
    for (var k = 0; k < dims.length; k++) {
      var key = dims[k];
      normEff[key] = maxEff > 0 ? Math.round(dimAvg[key] / maxEff * 100) : 0;
    }

    var totalEff = 0;
    for (var k = 0; k < dims.length; k++) totalEff += normEff[dims[k]];

    var dynWeights = {};
    for (var k = 0; k < dims.length; k++) {
      var key = dims[k];
      dynWeights[key] = totalEff > 0 ? Math.round(normEff[key] / totalEff * 100) : 0;
    }

    // 构造 weights 的 details（V4.4 升级：包含全部维度）
    var detail = {
      p1: dynWeights.p1, p2: dynWeights.p2, p3: dynWeights.p3,
      combined: dynWeights.combined, miss: dynWeights.miss,
      freshness: dynWeights.freshness, heatScore: dynWeights.heatScore,
      relativeCombined: dynWeights.relativeCombined
    };

    // 策略判断（V4.4 升级：基于 miss + freshness 综合）
    var hotHits = 0, coldHits = 0, totalHitRecs = 0;
    var freshHits = 0;  // freshness 高的命中
    for (var i = 0; i < hits.length; i++) {
      var r = hits[i];
      totalHitRecs++;
      var d = r.actualDetails;
      if (!d) continue;
      if (d.miss <= 2) hotHits++;
      else if (d.miss > 12) coldHits++;
      if ((d.freshness || 0) >= 0.6) freshHits++;
    }

    var strategy;
    var hotRatio = totalHitRecs > 0 ? hotHits / totalHitRecs : 0;
    var coldRatio = totalHitRecs > 0 ? coldHits / totalHitRecs : 0;
    var freshRatio = totalHitRecs > 0 ? freshHits / totalHitRecs : 0;
    // V4.4 升级：把 freshness 信号纳入策略
    if (hotRatio > 0.4 || freshRatio > 0.5) strategy = '强追热';
    else if (coldRatio > 0.4) strategy = '追冷搏反弹';
    else strategy = '动态均衡';

    var tuned = {
      strategy: strategy,
      weights: dynWeights,
      dimensionEff: normEff,
      hotHitRatio: Math.round(hotRatio * 100),
      coldHitRatio: Math.round(coldRatio * 100),
      freshHitRatio: Math.round(freshRatio * 100),  // V4.4 新增
      detail: detail
    };
    Storage.set('zodiacStrategyTuned', tuned);
    return tuned;
  },

  getTunedStrategy: function() {
    return Storage.get('zodiacStrategyTuned', null);
  }
};

// ============================================================
// 兼容路径：挂载到 ZodiacPrediction 门面
// ============================================================
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionScores);
}

// LRU 缓存包装（保持原 API）
if (typeof BusinessCommonLRU !== 'undefined' && BusinessCommonLRU) {
  ZodiacPredictionScores.calcContinuousScores = BusinessCommonLRU.withHistoryLRU(
    ZodiacPredictionScores.calcContinuousScores,
    20
  );
}
