/**
 * 滑动窗口预测算法 · 业务层
 * 基于6/12/24/36期四窗联合判定 + 行情节奏状态机（V1.2 引入节奏跟随）
 *
 * 版本演进：
 *   V1.0 - 12/24/36期三窗联合判定（基础）
 *   V1.1 - 新增 6 期窗口，捕捉短期反弹/热号/冷号信号
 *   V1.2 - 新增行情节奏识别（detectRecentRhythm），修复"连对/连错"现象
 *           当识别到"连续 2+ 期开同一生肖"或"6 期全不同生肖"时，
 *           修正层动态调整评分权重，使算法能够跟随当前行情节奏
 *   V1.4.4 - 新增修正层规则：6期内出现2次（短热号/短过热）降权 -12
 *             短期热号可能见顶，统计均值回归
 *
 * 依赖方向: views/ -> business/ -> core/
 * 禁止DOM操作，只做纯计算和逻辑
 */
const BusinessSlidingWindow = {

  /** 12生肖列表 */
  SHENGXIAO_ALL: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  /** 算法版本（升级时修改此处） */
  // 2026-06-23 V1.4.9：8 个新优化点（回测期数自适应 + miss 区间统计 + 11 期解权豁免 + 趋势细分 + 节奏串行 + 排名扩展 + 未推荐分析 + 6 期基础权重调整）
  // V1.4.6：新增多窗口组合信号识别（7 条修正层规则）
  // V1.4.5：优化冷补规则 + 6期降权（按 signal 命中率回测数据调优）
  ALGORITHM_VERSION: '滑动窗口V1.4.9',

  /** 生肖 Emoji 映射 */
  SHENGXIAO_EMOJI: {
    '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
    '龙': '🐲', '蛇': '🐍', '马': '🐴', '羊': '🐑',
    '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
  },

  /**
   * 将项目原始历史数据转换为算法所需的生肖序列
   * historyData 格式: [{expect, openCode, zodiac, time, ...}, ...]
   * zodiac 是逗号分隔的7个生肖字符串，第7位（索引6）是特码生肖
   *
   * @param {Array} historyData - 原始历史数据
   * @returns {Array<{period: number, shengxiao: string}>} 生肖序列（按时间正序）
   */
  convertHistoryToZodiacSequence: function(historyData) {
    if (!historyData || !historyData.length) return [];

    var result = [];
    var self = this;

    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var expect = Number(item.expect || 0);
      if (!expect) continue;

      var zodArr = Utils.parseZodiacArr(item);
      var specialZodiac = zodArr[6] || '';

      if (specialZodiac && self.SHENGXIAO_ALL.indexOf(specialZodiac) !== -1) {
        result.push({
          period: expect,
          shengxiao: specialZodiac
        });
      }
    }

    // 按期号正序排列
    result.sort(function(a, b) { return a.period - b.period; });
    return result;
  },

  /**
   * 计算各窗口期内每个生肖的出现次数
   * 窗口: 6期（V1.1 新增）、12期、11期（解权）、24期、36期
   *
   * @param {Array} zodiacSeq - 生肖序列（正序）
   * @returns {Object} windows - {window6, window12, window11, window24, window36}
   */
  calculateWindows: function(zodiacSeq) {
    var self = this;
    var total = zodiacSeq.length;

    // 初始化计数器
    var window6 = {}, window12 = {}, window11 = {}, window24 = {}, window36 = {};
    self.SHENGXIAO_ALL.forEach(function(sx) {
      window6[sx] = 0;
      window12[sx] = 0;
      window11[sx] = 0;
      window24[sx] = 0;
      window36[sx] = 0;
    });

    // 从最近期开始往前统计（zodiacSeq 是正序，最后一项是最新）
    for (var i = total - 1; i >= 0; i--) {
      var offset = total - 1 - i;
      if (offset >= 36) break;

      var sx = zodiacSeq[i].shengxiao;
      if (offset < 6)  window6[sx]  = (window6[sx]  || 0) + 1;   // V1.1 新增
      if (offset < 12) window12[sx] = (window12[sx] || 0) + 1;
      if (offset < 11) window11[sx] = (window11[sx] || 0) + 1;
      if (offset < 24) window24[sx] = (window24[sx] || 0) + 1;
      if (offset < 36) window36[sx] = (window36[sx] || 0) + 1;
    }

    return {
      window6: window6,
      window12: window12,
      window11: window11,
      window24: window24,
      window36: window36
    };
  },

  /**
   * 6期窗口区域划分（V1.1 新增）
   * 理论概率：0次≈59%、1次≈34%、2次≈8%、3+次≈0.2%
   */
  getZone6: function(count) {
    if (count >= 3) return '短过热';   // 极端罕见（P<0.2%）
    if (count === 2) return '短热号';   // 短期热号（P≈8%）
    if (count === 1) return '短穿插';   // 单次穿插（P≈34%）
    return '短冷号';                    // 6期未开（P≈59%）
  },

  /**
   * 12期窗口区域划分
   */
  getZone12: function(count) {
    if (count >= 4) return '封顶区';
    if (count === 3) return '降权区';
    if (count === 2) return '热号区';
    if (count === 1) return '穿插区';
    return '冷号区';
  },

  /**
   * 24期窗口区域划分
   */
  getZone24: function(count) {
    if (count >= 8) return '封顶区';
    if (count >= 6) return '降权区';
    if (count === 5) return '过热区';
    if (count === 4) return '热号区';
    if (count === 3) return '活跃区';
    if (count === 2) return '穿插区';
    return '冷号区';
  },

  /**
   * 36期窗口区域划分
   */
  getZone36: function(count) {
    if (count >= 12) return '封顶区';
    if (count >= 9) return '降权区';
    if (count >= 7) return '过热区';
    if (count >= 5) return '热号区';
    if (count >= 3) return '活跃区';
    if (count === 2) return '穿插区';
    return '冷号区';
  },

  /**
   * 计算某个生肖距离最近一次出现的期数间隔
   *
   * @param {string} shengxiao - 目标生肖
   * @param {Array} zodiacSeq - 生肖序列（正序）
   * @returns {number} 距离最近一次出现的期数
   */
  getMissPeriods: function(shengxiao, zodiacSeq) {
    for (var i = zodiacSeq.length - 1; i >= 0; i--) {
      if (zodiacSeq[i].shengxiao === shengxiao) {
        return zodiacSeq.length - 1 - i;
      }
    }
    return zodiacSeq.length; // 从未出现
  },

  /**
   * V1.3 新增：个体生肖热度趋势判断
   * 比较短期频率 vs 长期频率，区分"变冷中"还是"变热中"
   *
   * 原理：
   *   rate6  = w6/6   (最近6期频率，灵敏)
   *   rate12 = w12/12 (最近12期频率)
   *   rate24 = w24/24 (最近24期频率)
   *   rate36 = w36/36 (最近36期频率，稳定基准)
   *
   *   shortRate = (rate6 + rate12) / 2  ← 短期信号
   *   longRate  = (rate24 + rate36) / 2 ← 长期基准
   *
   *   差值 > 0 → 短期比长期更活跃 → 变热中
   *   差值 < 0 → 短期比长期更稀少 → 变冷中
   *
   * @param {number} w6/w12/w24/w36 - 各窗口出现次数
   * @returns {{ trend: string, shortRate: number, longRate: number, diff: number }}
   */
  detectTrend: function(w6, w12, w24, w36) {
    var rate6  = (w6  || 0) / 6;
    var rate12 = (w12 || 0) / 12;
    var rate24 = (w24 || 0) / 24;
    var rate36 = (w36 || 0) / 36;

    var shortRate = (rate6 + rate12) / 2;
    var longRate  = (rate24 + rate36) / 2;
    var diff = shortRate - longRate;

    var trend;
    if (diff > 0.04) {
      trend = 'HEATING';     // 短期频率明显高于长期 → 变热中
    } else if (diff < -0.04) {
      trend = 'COOLING';     // 短期频率明显低于长期 → 变冷中
    } else if (shortRate > 0.12 && longRate > 0.12) {
      trend = 'HOT';         // 持续热（短期和长期都高）
    } else if (shortRate < 0.05 && longRate < 0.05) {
      trend = 'COLD';        // 持续冷（短期和长期都低）
    } else {
      trend = 'STABLE';      // 稳定
    }

    return {
      trend: trend,
      shortRate: shortRate,
      longRate: longRate,
      diff: diff
    };
  },

  /**
   * 识别最近期的开奖节奏模式（V1.2 新增 · 行情状态机核心）
   * 用于修复"连对/连错"现象：当算法不知道当前行情节奏时，会出现
   *   - "连对"：连续命中多期（算法恰好踩中节奏）
   *   - "连错"：连续未中多期（算法没踩中节奏）
   * 通过识别最近期的节奏模式，让修正层动态调整权重。
   *
   * 节奏模式分类：
   *   CONSECUTIVE_2  - 最近 2 期开同一生肖（连号期，下期不开概率高）
   *   CONSECUTIVE_3  - 最近 3 期开同一生肖（强连号，下期必不开）
   *   ALL_DIFFERENT   - 最近 6 期全不同生肖（轮转期，节奏分散）
   *   STEADY          - 默认平稳期
   *
   * @param {Array} zodiacSeq - 生肖序列（正序，最新期在末尾）
   * @returns {Object} { pattern: string, zx?: string, detail: string }
   */
  detectRecentRhythm: function(zodiacSeq) {
    if (!zodiacSeq || zodiacSeq.length < 2) {
      return { pattern: 'STEADY', detail: '数据不足，默认平稳' };
    }
    var len = zodiacSeq.length;
    var last1 = zodiacSeq[len - 1].shengxiao;
    var last2 = zodiacSeq[len - 2].shengxiao;
    var last3 = len >= 3 ? zodiacSeq[len - 3].shengxiao : '';

    // 1. 检测连号模式（最近 3 期）
    if (last1 === last2 && last2 === last3 && last1) {
      return {
        pattern: 'CONSECUTIVE_3',
        zx: last1,
        detail: '最近 3 期连开 ' + last1 + '（强连号，下期大概率不开）'
      };
    }
    if (last1 === last2 && last1) {
      return {
        pattern: 'CONSECUTIVE_2',
        zx: last1,
        detail: '最近 2 期连开 ' + last1 + '（连号期，下期不开概率高）'
      };
    }

    // 2. 检测轮转模式（最近 6 期全不同）
    if (zodiacSeq.length >= 6) {
      var unique = {};
      for (var i = len - 6; i < len; i++) {
        unique[zodiacSeq[i].shengxiao] = true;
      }
      if (Object.keys(unique).length === 6) {
        return {
          pattern: 'ALL_DIFFERENT',
          detail: '最近 6 期开 6 个不同生肖（轮转期，节奏分散）'
        };
      }
    }

    // 3. 默认平稳
    return { pattern: 'STEADY', detail: '平稳期' };
  },

  /**
   * 基础评分规则表（按数组顺序互斥，最多命中 1 条）
   * 字段说明:
   *   - weight: 命中后基础分
   *   - signal: 加入 signals 数组的标签
   *   - reason: 加入 reasons 数组的描述
   *   - flag: 命中后设置的标志（如 strongest / dualHot），供修正层判定
   *   - match: 匹配函数，参数为 { w12, w11, w24, w36 }
   *   - isDefault: 是否兜底规则（必须能命中）
   *
   * ============================================================
   * 2026-06-23 V1.4.5 调优指南（Step 5：权重配置化）
   * ============================================================
   * 权重来源：基于历史回测命中率人工调优（详细调优见 _BASE_RULE_OPTIMIZATION_NOTES）
   * 调优工具：BusinessSlidingWindowHistory.computeRuleCoverage(records) + getRecommendedBaseWeights(coverage)
   * 调优流程：
   *   1. 调 computeRuleCoverage 获取每条规则的命中率/lift
   *   2. 调 getRecommendedBaseWeights 获取推荐权重
   *   3. 开发者根据建议手动修改下方 SW_BASE_RULES 数组里的 weight
   *   4. 同步更新 ALGORITHM_VERSION 触发缓存失效
   * ============================================================
   */
  SW_BASE_RULES: [
    { weight: 100, signal: '24/36期双过热(5/7)', reason: '24/36期双过热是最强信号',  flag: 'strongest', match: function(w) { return w.w24 === 5 && w.w36 === 7; } },
    { weight: 90,  signal: '24/36期双过热',      reason: '24/36期双过热是极强信号',  flag: 'strongest', match: function(w) { return w.w24 >= 5 && w.w36 >= 6; } },
    { weight: 80,  signal: '三窗热号(2/4/5+)',    reason: '三窗热号是强信号',          flag: 'dualHot',   match: function(w) { return w.w12 === 2 && w.w24 === 4 && w.w36 >= 5; } },
    { weight: 70,  signal: '24/36期双热号(4/6)',  reason: '24/36期双热号是强信号',    flag: 'dualHot',   match: function(w) { return w.w24 === 4 && w.w36 === 6; } },
    // V1.4.3 修复：w36≥7 单窗过热（24期未达5+）此前无规则命中，导致 2026138 期马评分 -30
    { weight: 75,  signal: '36期单窗过热(7+)',    reason: '36期单窗过热(7+)是强信号（24期未达5+）', flag: 'strongest', match: function(w) { return w.w36 >= 7 && w.w24 < 5; } },
    // V1.1 新增：短期反弹（6期0+12期≥1+36期≥2）—— 短期冷但中长期有戏，捕捉反弹起始信号
    { weight: 70,  signal: '短期反弹(6期0+12期≥1+36期≥2)', reason: '短期反弹：6期未开但中长期活跃，反弹可能持续',
      match: function(w) { return w.w6 === 0 && w.w12 >= 1 && w.w36 >= 2 && w.w36 <= 6; } },
    { weight: 65,  signal: '2.7规则触发',         reason: '2.7规则触发（穿插+活跃+热号）', match: function(w) { return w.w12 === 1 && w.w24 === 3 && w.w36 >= 5; } },
    { weight: 65,  signal: '2.7规则触发',         reason: '2.7规则触发（穿插+热号+热号）', match: function(w) { return w.w12 === 1 && w.w24 === 4 && w.w36 >= 4; } },
    { weight: 60,  signal: '24/36期热号(4/5)',    reason: '24/36期热号是中强信号',    flag: 'dualHot',   match: function(w) { return w.w24 === 4 && w.w36 === 5; } },
    { weight: 55,  signal: '36期热号(6)',         reason: '36期热号(6)是中强信号',    match: function(w) { return w.w36 === 6; } },
    { weight: 50,  signal: '24/36期双冷+超长遗漏', reason: '24/36期双冷+超长遗漏是必出信号', match: function(w) { return w.w24 === 1 && w.w36 === 2; } },
    { weight: 45,  signal: '24/36期活跃(3/4)',    reason: '24/36期活跃是中等信号',    match: function(w) { return w.w24 === 3 && w.w36 === 4; } },
    { weight: 40,  signal: '36期活跃(4)',         reason: '36期活跃(4)是中等信号',    match: function(w) { return w.w36 === 4; } },
    // V1.1 新增：短期热号（6期≥2）—— 短期连续活跃，跟随概率高
    { weight: 40,  signal: '短期热号(6期≥2)',     reason: '短期热号：6期内开2+次，短期跟随概率高',
      match: function(w) { return w.w6 >= 2; } },
    { weight: 30,  signal: '36期活跃(3)',         reason: '36期活跃(3)是中等信号',    match: function(w) { return w.w36 === 3; } },
    // V1.1 新增：短期冷号（6期0+12期0）—— 12期冷号+6期也冷，可能即将反弹
    { weight: 30,  signal: '短期冷号(6期0+12期0)', reason: '短期冷号：6期和12期均未开，冷补信号启动',
      match: function(w) { return w.w6 === 0 && w.w12 === 0 && w.w36 >= 2; } },
    { weight: 10,  signal: '36期冷号(2)',         reason: '36期冷号(2)是基础信号',    match: function(w) { return w.w36 === 2; } },
    { weight: 5,   signal: '36期冷号(1)',         reason: '36期冷号(1)是弱信号',      match: function(w) { return w.w36 === 1; } },
    { weight: 0,   signal: '无明显信号',          reason: '无可匹配的评分规则',        isDefault: true, match: function() { return true; } }
  ],

  /**
   * 叠加规则表（可同时命中多条，与基础规则并存）
   * 字段说明:
   *   - skipIfBaseWeightGte: 当基础分 ≥ 该值时跳过叠加（修复漏洞 1：跨窗信号叠加无上限）
   */
  SW_ADDITIVE_RULES: [
    { weight: 55, signalFn: function(w) { return '跨窗信号(12期0+36期' + w.w36 + ')'; },
      reason: '跨窗信号触发：12期冷号+36期热号，叠加+55',
      skipIfBaseWeightGte: 60,
      match: function(w) { return w.w12 === 0 && w.w36 >= 5; }
    }
  ],

  /**
   * 修正层规则表（按数组顺序应用，修改 score / reasons / signals）
   * 字段说明:
   *   - delta: 应用到 score 的增量（正为加分，负为扣分）
   *   - signal / signalFn: 可选，命中后追加 signal 标签
   *   - reason / reasonFn: 可选，命中后追加 reason 描述
   *   - setScoreZero: 命中后直接将 score 置为 0（兜底排除）
   *   - match: 匹配函数，参数为 ctx { score, baseScore, miss, w12, w11, w24, w36, zone12, zone24, zone36, flags }
   */
  SW_MODIFIER_RULES: [
    // 冷补不重复 - miss ≤ 2：非最强信号 -25
    { delta: -25, reasonFn: function(ctx) { return '冷补不重复：' + ctx.miss + '期前刚开过(-25)'; },
      match: function(ctx) { return ctx.miss <= 2 && !ctx.flags.strongest; } },
    // 2026-06-23 V1.4.5 新增：miss≤2 但 36 期仍热 → 减缓冷补（-25+15 = -10）
    { delta: 15, signal: '冷补-热区豁免', reasonFn: function(ctx) { return 'miss=' + ctx.miss + '期但36期仍热：减缓冷补(-25+15)'; },
      match: function(ctx) { return ctx.miss <= 2 && !ctx.flags.strongest && ctx.w36 >= 5; } },
    // 冷补不重复 - miss === 3：非最强信号 -15
    { delta: -15, reason: '冷补不重复：3期前刚开过(-15)',
      match: function(ctx) { return ctx.miss === 3 && !ctx.flags.strongest; } },
    // 2026-06-23 V1.4.5 新增：miss=3 但 36 期仍热 → 减缓冷补（-15+15 = 0）
    { delta: 15, signal: '冷补-热区豁免', reasonFn: function(_ctx) { return 'miss=3期但36期仍热：减缓冷补(-15+15)'; },
      match: function(ctx) { return ctx.miss === 3 && !ctx.flags.strongest && ctx.w36 >= 5; } },
    // 接近冷补期 - miss 4-5：双热号豁免说明
    { delta: 0, reason: '接近冷补期：双热号保留(不扣分)',
      match: function(ctx) { return (ctx.miss === 4 || ctx.miss === 5) && ctx.flags.dualHot; } },
    // 已过冷补期 - miss 6-14：score > 0 时 +10
    { delta: 10, reasonFn: function(ctx) { return '已过冷补期：' + ctx.miss + '期未开(+10)'; },
      match: function(ctx) { return ctx.miss >= 6 && ctx.miss <= 14 && ctx.baseScore > 0; } },
    // 超长遗漏 - miss ≥ 15 且 24/36 都落在冷号区/穿插区（修复漏洞 2：改用 zone 对齐冷补排除）
    { delta: 30, signal: '超长遗漏', reasonFn: function(ctx) { return '超长遗漏：' + ctx.miss + '期未出(+30)'; },
      match: function(ctx) {
        return ctx.miss >= 15
          && (ctx.zone24 === '冷号区' || ctx.zone24 === '穿插区')
          && (ctx.zone36 === '冷号区' || ctx.zone36 === '穿插区');
      } },
    // 冷补排除 - 12期1次 + 24/36期双冷 → 直接归零（替代原 -50，避免叠加后仍 > 0）
    { delta: 0, reason: '冷补排除：12期穿插+24/36双冷号区', setScoreZero: true,
      match: function(ctx) {
        return ctx.w12 === 1
          && (ctx.zone24 === '冷号区' || ctx.zone24 === '穿插区')
          && (ctx.zone36 === '冷号区' || ctx.zone36 === '穿插区');
      } },
    // 11期解权机制 - 修复漏洞 4：仅在 score < 60 时触发（避免削掉高分）
    { delta: -15, reasonFn: function(ctx) { return '12期降权中（11期解权：' + ctx.w11 + '/' + ctx.w12 + '，保留）'; },
      match: function(ctx) { return ctx.w12 >= 3 && ctx.w11 <= 2 && ctx.score < 60; } },
    // 2026-06-23 V1.4.9 新增：11期解权豁免 —— 36期仍热时减弱 -15
    { delta: 12, signal: '11期解权豁免',
      reasonFn: function(ctx) { return '11期解权部分豁免(-15+12)：36期仍热，' + ctx.w36 + '次'; },
      match: function(ctx) { return ctx.w12 >= 3 && ctx.w11 <= 2 && ctx.score < 60 && ctx.w36 >= 5; } },
    // 2026-06-23 V1.4.9 新增：6 期基础规则权重调整层
    // 背景：原 SW_BASE_RULES "短期热号(6期≥2)" +40，叠加修正层 -30 = 净 +10（被抵消）
    // 本规则：通过二次权重调整（+10）让 6 期热号净效果从 +10 提升到 +20
    // 不修改原 SW_BASE_RULES 数组 weight（严格遵守"不修改原数组"原则）
    { delta: 10, signal: '6期基础权重补偿',
      reasonFn: function(_ctx) { return '6期基础规则权重补偿：净效果从+10提升到+20'; },
      match: function(ctx) { return ctx.w6 >= 2 && ctx.w12 < 4 && ctx.w36 < 5; } },
    // V1.4.4 新增：6期内出现2次降权 —— 短期热号/短过热可能见顶，统计均值回归
    { delta: -30, signal: '6期2次降权', reasonFn: function(ctx) { return '6期内出现' + ctx.w6 + '次，短期热号见顶(-30)'; },
      match: function(ctx) { return ctx.w6 >= 2; } },
    // 2026-06-23 V1.4.5 新增：6期连续热+36期仍热 → 减缓短热见顶（-30+15 = -15）
    { delta: 15, signal: '短热+长热减缓', reasonFn: function(_ctx) { return '6期连续热+36期仍热：减缓短热见顶(-30+15)'; },
      match: function(ctx) { return ctx.w6 >= 2 && ctx.w36 >= 5; } },

    // ============================================================
    // 2026-06-23 V1.4.6 新增：多窗口组合信号识别
    // 设计：仅追加到 SW_MODIFIER_RULES 末尾，不修改原 11 条规则
    // 原则：原 SW_BASE_RULES 单窗口规则触发 → 修正层只做"组合叠加"
    // ============================================================

    // 1. 三窗均活跃：w12≥3 && w24≥5 && w36≥7 → 持续热号 +15
    { delta: 15, signal: '三窗均活跃', reason: '12/24/36期三窗均活跃：持续热号(+15)',
      match: function(ctx) { return ctx.w12 >= 3 && ctx.w24 >= 5 && ctx.w36 >= 7; } },

    // 2. 反弹+强势：w6<2 && w12≥3 && w36≥5 → 长期强势 + 中期已冷 + 短期不热 → 回归信号 +12
    { delta: 12, signal: '反弹+强势', reason: '6期不热+12期热+36期仍强：反弹信号(+12)',
      match: function(ctx) { return ctx.w6 < 2 && ctx.w12 >= 3 && ctx.w36 >= 5; } },

    // 3. 双热过渡：w12=2 && w24≥4 && w36≥5 → 12 期热 + 24/36 期边缘热 → 升势 +8
    { delta: 8, signal: '双热过渡', reason: '12期热+24/36期边缘热：升势中(+8)',
      match: function(ctx) { return ctx.w12 === 2 && ctx.w24 >= 4 && ctx.w36 >= 5; } },

    // 4. 冷号回归候选：w6=0 && miss≥8 && w36<3 → 短期未开 + 长期冷号 + 长期遗漏 → 可能回归 +10
    { delta: 10, signal: '冷号回归', reasonFn: function(ctx) { return '短期未开+长期冷号+遗漏' + ctx.miss + '期：可能回归(+10)'; },
      match: function(ctx) { return ctx.w6 === 0 && ctx.miss >= 8 && ctx.w36 < 3; } },

    // 5. 全面冷号：w6=0 && w12≤1 && w24≤2 && w36≤3 → 全窗口都冷 → 深度冷号 +5
    { delta: 5, signal: '全面冷号', reason: '全窗口都冷：深度冷号，可能回归(+5)',
      match: function(ctx) { return ctx.w6 === 0 && ctx.w12 <= 1 && ctx.w24 <= 2 && ctx.w36 <= 3; } },

    // 6. 短期泡沫：w6≥2 && w12≥4 && w36<5 → 短中期热但长期冷 → 见顶 -20
    { delta: -20, signal: '短期泡沫', reason: '短中期热+长期冷：短期泡沫，见顶(-20)',
      match: function(ctx) { return ctx.w6 >= 2 && ctx.w12 >= 4 && ctx.w36 < 5; } },

    // 7. 短中期热长冷：w6≥2 && w12≥4 && w24≥4 && w36<3 → 短期和中长期都热但长长周期冷 → 严重见顶 -10
    { delta: -10, signal: '短中期热长冷', reason: '短中期热+长长周期冷：严重见顶(-10)',
      match: function(ctx) { return ctx.w6 >= 2 && ctx.w12 >= 4 && ctx.w24 >= 4 && ctx.w36 < 3; } },
    // V1.3 新增：趋势加成 —— 变热中加分，变冷中扣分
    { delta: 12, signal: '趋势变热', reason: '趋势：变热中(shortRate高于longRate)+12',
      match: function(ctx) { return ctx.trend === 'HEATING'; } },
    { delta: -12, signal: '趋势变冷', reason: '趋势：变冷中(shortRate低于longRate)-12',
      match: function(ctx) { return ctx.trend === 'COOLING'; } }
  ],

  /**
   * 核心评分规则：对每个生肖计算综合得分（数据驱动表版）
   * 三段式：基础规则（互斥取 1）→ 叠加规则（可多条）→ 修正层（按顺序）
   *
   * @param {string} shengxiao - 生肖名
   * @param {Object} windows - 窗口计数 {window6, window12, window11, window24, window36}
   * @param {Array} zodiacSeq - 生肖序列
   * @param {Object} [rhythm] - V1.2 新增：行情节奏识别结果（由 predict() 注入）
   * @param {Array<string>} [excludedZodiacs] - V1.3.1新增：交叉排除列表
   * @param {Array<string>} [downweightedZodiacs] - V1.4新增：交叉排除 Rule2 触发时的软降权列表
   * @param {number} [downweightFactor] - V1.4新增：软降权系数（0~1；如 0.5 表示分数打 5 折）
   * @returns {Object} 评分结果
   */
  calculateScore: function(shengxiao, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor) {
    var self = this;
    // V1.2 兼容：rhythm 可选，未传时使用默认 STEADY
    if (!rhythm) rhythm = { pattern: 'STEADY', detail: '未提供节奏' };
    excludedZodiacs = excludedZodiacs || [];
    // V1.4 新增：Rule 2 软降权参数兼容
    downweightedZodiacs = downweightedZodiacs || [];
    downweightFactor = typeof downweightFactor === 'number' ? downweightFactor : 0;

    // V1.3.1 交叉排除：未被任何模块推荐的生肖直接归零
    if (excludedZodiacs.indexOf(shengxiao) !== -1) {
      return {
        shengxiao: shengxiao,
        score: 0,
        reason: '交叉排除：未被生肖预测/Giong/终极算法中任一模块推荐',
        signals: ['交叉排除'],
        window6: windows.window6[shengxiao] || 0,
        window12: windows.window12[shengxiao] || 0,
        window11: windows.window11[shengxiao] || 0,
        window24: windows.window24[shengxiao] || 0,
        window36: windows.window36[shengxiao] || 0,
        zone6: this.getZone6(windows.window6[shengxiao] || 0),
        zone12: this.getZone12(windows.window12[shengxiao] || 0),
        zone24: this.getZone24(windows.window24[shengxiao] || 0),
        zone36: this.getZone36(windows.window36[shengxiao] || 0),
        miss: this.getMissPeriods(shengxiao, zodiacSeq),
        trend: { trend: 'EXCLUDED', shortRate: 0, longRate: 0, diff: 0 },
        // V1.4 新增：硬排除时无降权
        downweighted: false,
        downweightFactor: 0,
        originalScore: 0
      };
    }
    var w6 = windows.window6[shengxiao] || 0;     // V1.1 新增
    var w12 = windows.window12[shengxiao] || 0;
    var w11 = windows.window11[shengxiao] || 0;
    var w24 = windows.window24[shengxiao] || 0;
    var w36 = windows.window36[shengxiao] || 0;

    var zone6 = this.getZone6(w6);                 // V1.1 新增
    var zone12 = this.getZone12(w12);
    var zone24 = this.getZone24(w24);
    var zone36 = this.getZone36(w36);

    var miss = this.getMissPeriods(shengxiao, zodiacSeq);

    var w = { w6: w6, w12: w12, w11: w11, w24: w24, w36: w36 };   // V1.1 新增 w6
    var flags = { strongest: false, dualHot: false };
    var score = 0;
    var signals = [];
    var reasons = [];

    // ========== 阶段 1：基础规则（互斥，最多命中 1 条）==========
    for (var i = 0; i < self.SW_BASE_RULES.length; i++) {
      var rule = self.SW_BASE_RULES[i];
      if (rule.match(w)) {
        score += rule.weight;
        signals.push(rule.signal);
        reasons.push(rule.reason);
        if (rule.flag === 'strongest') flags.strongest = true;
        if (rule.flag === 'dualHot') flags.dualHot = true;
        break;
      }
    }
    var baseScore = score;

    // ========== 阶段 2：叠加规则（可多条；跳过阈值由 skipIfBaseWeightGte 控制）==========
    for (var j = 0; j < self.SW_ADDITIVE_RULES.length; j++) {
      var add = self.SW_ADDITIVE_RULES[j];
      if (!add.match(w)) continue;
      if (typeof add.skipIfBaseWeightGte === 'number' && baseScore >= add.skipIfBaseWeightGte) continue;
      score += add.weight;
      signals.push(typeof add.signalFn === 'function' ? add.signalFn(w) : add.signal);
      reasons.push(add.reason);
    }

    // V1.3 新增：趋势计算（在 ctx 之前，供修正层使用）
    var trendObj = this.detectTrend(w6, w12, w24, w36);

    // ========== 阶段 3：修正层（按顺序应用，每条规则独立判断 ctx）==========
    var ctx = {
      score: score,
      baseScore: baseScore,
      miss: miss,
      w6: w6, w12: w12, w11: w11, w24: w24, w36: w36,    // V1.1 新增 w6
      zone6: zone6, zone12: zone12, zone24: zone24, zone36: zone36,   // V1.1 新增 zone6
      flags: flags,
      rhythm: rhythm,                                     // V1.2 新增：行情节奏
      trend: trendObj.trend                               // V1.3 新增：个体趋势
    };
    for (var k = 0; k < self.SW_MODIFIER_RULES.length; k++) {
      var mod = self.SW_MODIFIER_RULES[k];
      if (!mod.match(ctx)) continue;
      if (mod.signal) signals.push(mod.signal);
      else if (typeof mod.signalFn === 'function') signals.push(mod.signalFn(ctx));
      if (typeof mod.reasonFn === 'function') reasons.push(mod.reasonFn(ctx));
      else if (mod.reason) reasons.push(mod.reason);
      if (mod.setScoreZero) {
        score = 0;
      } else {
        score += mod.delta;
      }
      // 修正层可能改变 score，需同步 ctx.score 给后续规则使用
      ctx.score = score;
    }

    // ============================================================
    // V1.3.1：生肖特化规则（按最近开奖结果，针对单个生肖的条件判定）
    //   1. 马不连开 → 开出后下期绝不开
    //   2. 虎易连开 → 开出后下期可能重开
    //   3. 虎连开后 → 下期鼠概率极高
    // ============================================================
    var len = zodiacSeq.length;
    var last1 = zodiacSeq[len - 1].shengxiao;   // 最近一期
    var last2 = len >= 2 ? zodiacSeq[len - 2].shengxiao : '';  // 前一期

    // 规则1：马不连开 — 最近一期开了马，本期马直接归零
    if (shengxiao === '马' && last1 === '马') {
      score = 0;
      signals.push('生肖特化：马不连开');
      reasons.push('马：最近一期刚开过马，连开概率极低，直接归零');
    }

    // 规则2：虎易连开 — 最近一期开了虎，本期虎加分鼓励
    if (shengxiao === '虎' && last1 === '虎' && !ctx.flags.strongest) {
      score += 35;
      signals.push('生肖特化：虎连开');
      reasons.push('虎：最近一期开了虎，虎有连开特性(+35)');
    }

    // 规则3：虎连开后的鼠 — 虎连号出现后，下期鼠概率极高
    if (shengxiao === '鼠' && last1 === '虎') {
      var tigerConsecutive = (last2 === '虎');
      if (tigerConsecutive) {
        score += 50;
        signals.push('生肖特化：虎连后出鼠');
        reasons.push('鼠：虎连号后下期鼠概率极高(+50)');
      } else {
        score += 20;
        signals.push('生肖特化：虎后出鼠');
        reasons.push('鼠：虎开出后鼠概率提升(+20)');
      }
    }

    // ============================================================
    // V1.2.1：行情节奏评分（在修正层之后，直接用大分值差异化调整）
    // ALL_DIFFERENT 轮转期：按遗漏期分层给冷号加分，创造排名差异化
    // ============================================================

    // 轮转加分（ALL_DIFFERENT）—— 差异化冷号奖励
    if (rhythm.pattern === 'ALL_DIFFERENT' && w12 <= 1 && w6 === 0) {
      var rotBonus = 0;
      if (miss >= 15) rotBonus = 25;           // 超长遗漏：+25
      else if (miss >= 12) rotBonus = 20;      // 长期遗漏：+20
      else if (miss >= 8) rotBonus = 15;       // 中期遗漏：+15
      else if (miss >= 5) rotBonus = 10;       // 短期遗漏：+10
      if (rotBonus > 0) {
        score += rotBonus;
        signals.push('轮转冷号+' + rotBonus);
        reasons.push('节奏：轮转期冷号(miss=' + miss + ',+' + rotBonus + ')');
      }
    }

    // ============================================================
    // V1.4 新增：交叉排除 Rule 2 软降权（仅在 Rule 1 无硬排除时由交叉排除模块触发）
    //   触发条件：3 源全覆盖（excluded 为空）+ 该生肖不在"Giong+终极算法"二源并集中
    //   作用：分数 × downweightFactor（默认 0.5）
    // ============================================================
    var isDownweighted = false;
    var originalScore = score;
    if (downweightFactor > 0 && downweightFactor < 1 && downweightedZodiacs.indexOf(shengxiao) !== -1) {
      score = Math.round(score * downweightFactor);
      isDownweighted = true;
      signals.push('Rule2降权×' + downweightFactor);
      reasons.push('交叉排除Rule2：仅被生肖预测推荐，未被Giong/终极算法推荐，分数×' + downweightFactor + '（原' + originalScore + '→现' + score + '）');
    }

    return {
      shengxiao: shengxiao,
      score: score,
      reason: reasons.join('；') || '无特殊原因',
      signals: signals,
      window6: w6,            // V1.1 新增
      window12: w12,
      window11: w11,
      window24: w24,
      window36: w36,
      zone6: zone6,           // V1.1 新增
      zone12: zone12,
      zone24: zone24,
      zone36: zone36,
      miss: miss,
      trend: trendObj,                               // V1.3 新增：个体热度趋势
      // V1.4 新增：Rule 2 软降权元信息（用于视图层展示与调试）
      downweighted: isDownweighted,
      downweightFactor: isDownweighted ? downweightFactor : 0,
      originalScore: originalScore
    };
  },

  /**
   * 预测主逻辑：基于滑动窗口算法，返回评分前6的候选生肖
   *
   * @param {Array} historyData - 原始历史数据
   * @param {Object} [options] - 可选配置
   * @param {Array<string>} [options.excludedZodiacs] - V1.3.1新增：交叉排除列表（未被其他模块推荐的生肖）
   * @param {Array<string>} [options.downweightedZodiacs] - V1.4新增：Rule 2 软降权生肖列表（未传则自动从 BusinessCrossExclusion 获取）
   * @param {number} [options.downweightFactor] - V1.4新增：Rule 2 软降权系数（未传则自动从 BusinessCrossExclusion 获取，默认 0.5）
   * @param {Object} [options.crossResult] - V1.4.2新增：调用方一次性传入的交叉排除完整结果（避免重复调用 collectAllRecommend）
   * @returns {Object|null} 预测结果
   *   - candidates: [{shengxiao, emoji, score, rank, ...}]
   *   - allScores: 所有12生肖的详细评分
   *   - nextExpect: 下一期期号
   *   - summary: 12/24/36窗口概览
   *   - crossExclusion: 交叉排除元信息（含 rule2Triggered / downweighted / downweightFactor）
   */
  predict: function(historyData, options) {
    var self = this;
    options = options || {};

    // 1. 转换数据格式
    var zodiacSeq = this.convertHistoryToZodiacSequence(historyData);
    if (!zodiacSeq || zodiacSeq.length < 12) {
      return null; // 数据不足（至少需要12期）
    }

    // 2. 计算窗口（2026-06-23 V1.4.6 集成 LRU 缓存：行为完全等价，仅优化多次调用的性能）
    var windows = this._calculateWindowsWithLRU(zodiacSeq);

    // 3. V1.2 新增：识别最近期开奖节奏（用于行情跟随）
    var rhythm = this.detectRecentRhythm(zodiacSeq);

    // ============================================================
    // V1.4.2 优化：交叉排除信息获取（避免与调用方重复调用 collectAllRecommend）
    //   优先级：
    //     1. options.crossResult（完整结果，零次额外调用，推荐）
    //     2. options.excludedZodiacs + options.downweightedZodiacs/factor（兼容旧接口）
    //     3. 自动检测 BusinessCrossExclusion.collectAllRecommend（兜底）
    // ============================================================
    var excludedZodiacs, downweightedZodiacs, downweightFactor, rule2Triggered;

    if (options.crossResult && typeof options.crossResult === 'object') {
      // [Bug#2+#7 修复] 路径 1：调用方已传完整结果，零额外调用
      excludedZodiacs = options.crossResult.excluded || [];
      downweightedZodiacs = options.crossResult.downweighted || [];
      downweightFactor = options.crossResult.downweightFactor || 0;
      rule2Triggered = options.crossResult.rule2Triggered === true;
    } else {
      // 路径 2 / 3：仅传了 excludedZodiacs，需要补充 downweight 信息
      excludedZodiacs = options.excludedZodiacs || [];

      // 优先使用显式传入的 downweight 参数
      if (options.downweightedZodiacs !== undefined && options.downweightFactor !== undefined) {
        downweightedZodiacs = options.downweightedZodiacs;
        downweightFactor = options.downweightFactor;
        rule2Triggered = (downweightFactor > 0 && downweightedZodiacs.length > 0);
      } else {
        // 路径 3：自动从交叉排除模块获取（兜底，可能与调用方重复）
        try {
          if (typeof BusinessCrossExclusion !== 'undefined' && BusinessCrossExclusion.collectAllRecommend) {
            var autoCross = BusinessCrossExclusion.collectAllRecommend(historyData);
            downweightedZodiacs = options.downweightedZodiacs !== undefined ? options.downweightedZodiacs : (autoCross.downweighted || []);
            downweightFactor = options.downweightFactor !== undefined ? options.downweightFactor : (autoCross.downweightFactor || 0);
            rule2Triggered = autoCross.rule2Triggered === true;
          } else {
            downweightedZodiacs = [];
            downweightFactor = 0;
            rule2Triggered = false;
          }
        } catch (e) {
          // 异常保护：自动检测失败时降级为无降权
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[BusinessSlidingWindow] 交叉排除自动检测失败：', e);
          }
          downweightedZodiacs = options.downweightedZodiacs || [];
          downweightFactor = typeof options.downweightFactor === 'number' ? options.downweightFactor : 0;
          rule2Triggered = false;
        }
      }
    }

    // 4. 计算所有生肖的评分
    var allScores = [];
    self.SHENGXIAO_ALL.forEach(function(sx) {
      var scoreObj = self._calculateScoreWithLRU(sx, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor);
      allScores.push(scoreObj);
    });

    // 5. 按评分降序排列（同分时按生肖数组索引升序，确保确定性）
    var sxIndex = {};
    self.SHENGXIAO_ALL.forEach(function(sx, idx) { sxIndex[sx] = idx; });
    allScores.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // 次级排序：按生肖数组原始索引（鼠->猪）
      var ia = sxIndex[a.shengxiao];
      var ib = sxIndex[b.shengxiao];
      if (ia === undefined && ib === undefined) return 0;
      if (ia === undefined) return 1;
      if (ib === undefined) return -1;
      return ia - ib;
    });

    // 6. 取前6名为候选
    var top6 = allScores.slice(0, 6);
    var candidates = top6.map(function(item, idx) {
      return {
        shengxiao: item.shengxiao,
        emoji: self.SHENGXIAO_EMOJI[item.shengxiao] || '❓',
        score: item.score,
        rank: idx + 1,
        reason: item.reason,
        signals: item.signals,
        window6: item.window6,         // V1.1 新增
        window12: item.window12,
        window11: item.window11,
        window24: item.window24,
        window36: item.window36,
        zone6: item.zone6,             // V1.1 新增
        zone12: item.zone12,
        zone24: item.zone24,
        zone36: item.zone36,
        miss: item.miss,
        // V1.4 新增：Rule 2 软降权信息（视图层可展示）
        downweighted: item.downweighted || false,
        originalScore: item.originalScore != null ? item.originalScore : item.score
      };
    });

    // 7. 计算下一期期号
    var latestExpect = zodiacSeq.length > 0 ? zodiacSeq[zodiacSeq.length - 1].period : 0;
    var nextExpect = latestExpect + 1;

    // 8. 窗口概览统计
    var windowSummary = {
      max6: 0, max12: 0, max24: 0, max36: 0,        // V1.1 新增 max6
      hotZones: { zone6: {}, zone12: {}, zone24: {}, zone36: {} }   // V1.1 新增 zone6
    };
    allScores.forEach(function(item) {
      if (item.window6 > windowSummary.max6) windowSummary.max6 = item.window6;    // V1.1 新增
      if (item.window12 > windowSummary.max12) windowSummary.max12 = item.window12;
      if (item.window24 > windowSummary.max24) windowSummary.max24 = item.window24;
      if (item.window36 > windowSummary.max36) windowSummary.max36 = item.window36;

      var z6 = item.zone6, z12 = item.zone12, z24 = item.zone24, z36 = item.zone36;   // V1.1 新增 z6
      windowSummary.hotZones.zone6[z6] = (windowSummary.hotZones.zone6[z6] || 0) + 1; // V1.1 新增
      windowSummary.hotZones.zone12[z12] = (windowSummary.hotZones.zone12[z12] || 0) + 1;
      windowSummary.hotZones.zone24[z24] = (windowSummary.hotZones.zone24[z24] || 0) + 1;
      windowSummary.hotZones.zone36[z36] = (windowSummary.hotZones.zone36[z36] || 0) + 1;
    });

    return {
      candidates: candidates,
      allScores: allScores,
      nextExpect: nextExpect,
      summary: windowSummary,
      rhythm: rhythm,                          // V1.2 新增：当前行情节奏（供视图层展示）
      algorithm: self.ALGORITHM_VERSION,
      timestamp: Date.now(),
      // V1.4 新增：交叉排除元信息（供视图层展示与调试）
      crossExclusion: {
        rule2Triggered: rule2Triggered,
        excludedCount: excludedZodiacs.length,
        downweighted: downweightedZodiacs || [],
        downweightFactor: downweightFactor || 0
      }
    };
  },

  /**
   * 获取所有12生肖的窗口区域概览（用于区域分布表格展示）
   *
   * @param {Object} windows - 窗口计数
   * @returns {Array} 区域概览数组
   */
  getZoneOverview: function(windows) {
    var self = this;
    var result = [];
    self.SHENGXIAO_ALL.forEach(function(sx) {
      result.push({
        shengxiao: sx,
        emoji: self.SHENGXIAO_EMOJI[sx] || '❓',
        window12: windows.window12[sx] || 0,
        window24: windows.window24[sx] || 0,
        window36: windows.window36[sx] || 0,
        zone12: self.getZone12(windows.window12[sx] || 0),
        zone24: self.getZone24(windows.window24[sx] || 0),
        zone36: self.getZone36(windows.window36[sx] || 0)
      });
    });
    return result;
  },

  // ============================================================
  // 2026-06-23 V1.4.5 新增：窗口边界自适应模块
  // ============================================================
  // 背景：getZone6/12/24/36 的阈值是绝对次数，与总历史数据量无关
  // 问题：数据量少时（如 30 期），窗口内出现次数本身少，阈值偏严；数据量多时（如 300 期），阈值偏松
  // 方案：根据总历史数据量自动选择阈值档位（loose / standard / strict）
  //   - < 50 期：loose（更敏感，阈值降低）
  //   - 50-200 期：standard（与原 getZone 一致）
  //   - >= 200 期：strict（更严格，阈值提高）
  // 严格遵守"不修改原函数"原则：本模块完全独立，仅作为开发者工具，不影响 predict 流程
  // 开发者如需让 predict 用自适应阈值，可手动在 calculateWindows 中替换 getZone 调用
  // ============================================================

  /**
   * 自适应阈值档位分界
   *   - < looseMax：loose 档（数据少，阈值降低，更敏感）
   *   - < standardMax：standard 档（数据适中，与原 getZone 一致）
   *   - >= standardMax：strict 档（数据多，阈值提高，更严格）
   */
  SW_ADAPTIVE_LEVEL_THRESHOLDS: Object.freeze({
    looseMax: 50,
    standardMax: 200
  }),

  /**
   * 4 个窗口 × 3 档阈值表
   * 字段说明：
   *   - fengding: 封顶区阈值
   *   - jiangquan: 降权区阈值
   *   - guore: 过热区阈值
   *   - rehao: 热号区阈值
   *   - huoyue: 活跃区阈值
   *   - chuancha: 穿插区阈值
   *   - leng: 冷号区阈值（其他情况）
   * 设计原则：
   *   - loose：每档阈值 -1（更敏感）
   *   - standard：与原 getZone 一致
   *   - strict：每档阈值 +2（更严格）
   */
  SW_ADAPTIVE_THRESHOLDS: Object.freeze({
    6: {
      loose:    { guore: 2, rehao: 2, huoyue: 1, leng: 0 },
      standard: { guore: 3, rehao: 2, huoyue: 1, leng: 0 },
      strict:   { guore: 4, rehao: 3, huoyue: 1, leng: 0 }
    },
    12: {
      loose:    { fengding: 3, jiangquan: 3, rehao: 2, huoyue: 1, chuancha: 1, leng: 0 },
      standard: { fengding: 4, jiangquan: 3, rehao: 2, huoyue: 1, chuancha: 1, leng: 0 },
      strict:   { fengding: 6, jiangquan: 4, rehao: 3, huoyue: 2, chuancha: 1, leng: 0 }
    },
    24: {
      loose:    { fengding: 6, jiangquan: 5, guore: 4, rehao: 3, huoyue: 2, chuancha: 1, leng: 0 },
      standard: { fengding: 8, jiangquan: 6, guore: 5, rehao: 4, huoyue: 3, chuancha: 2, leng: 0 },
      strict:   { fengding: 10, jiangquan: 8, guore: 6, rehao: 5, huoyue: 4, chuancha: 2, leng: 0 }
    },
    36: {
      loose:    { fengding: 9, jiangquan: 7, guore: 6, rehao: 4, huoyue: 2, chuancha: 1, leng: 0 },
      standard: { fengding: 12, jiangquan: 9, guore: 7, rehao: 5, huoyue: 3, chuancha: 2, leng: 0 },
      strict:   { fengding: 15, jiangquan: 11, guore: 8, rehao: 6, huoyue: 4, chuancha: 2, leng: 0 }
    }
  }),

  /**
   * 根据总历史数据量判断档位
   * @param {number} totalHistorySize - 总历史数据量
   * @returns {string} 'loose' | 'standard' | 'strict'
   */
  getAdaptiveLevel: function(totalHistorySize) {
    var t = this.SW_ADAPTIVE_LEVEL_THRESHOLDS;
    if (typeof totalHistorySize !== 'number' || totalHistorySize < t.looseMax) return 'loose';
    if (totalHistorySize < t.standardMax) return 'standard';
    return 'strict';
  },

  /**
   * 自适应 zone 计算（与 getZone6/12/24/36 同 schema 的字符串）
   * 当 totalHistorySize 在 50-200 之间时，返回值与原 getZone 完全一致
   *
   * @param {number} zoneSize - 6 | 12 | 24 | 36
   * @param {number} count - 窗口内出现次数
   * @param {number} totalHistorySize - 总历史数据量
   * @returns {string} zone 字符串（与原 getZone 兼容）
   */
  getAdaptiveZone: function(zoneSize, count, totalHistorySize) {
    var level = this.getAdaptiveLevel(totalHistorySize);
    var t = this.SW_ADAPTIVE_THRESHOLDS[zoneSize] && this.SW_ADAPTIVE_THRESHOLDS[zoneSize][level];
    if (!t || typeof count !== 'number') {
      // fallback: 调用原 getZone
      if (zoneSize === 6) return this.getZone6(count);
      if (zoneSize === 12) return this.getZone12(count);
      if (zoneSize === 24) return this.getZone24(count);
      if (zoneSize === 36) return this.getZone36(count);
      return '冷号区';
    }
    // 6 期窗口：返回 '短X' 系列
    if (zoneSize === 6) {
      if (count >= t.guore) return '短过热';
      if (count >= t.rehao) return '短热号';
      if (count >= t.huoyue) return '短穿插';
      return '短冷号';
    }
    // 12/24/36 期窗口：返回 'X区' 系列
    if (count >= t.fengding) return '封顶区';
    if (count >= t.jiangquan) return '降权区';
    if (count >= t.guore) return '过热区';
    if (count >= t.rehao) return '热号区';
    if (count >= t.huoyue) return '活跃区';
    if (count >= t.chuancha) return '穿插区';
    return '冷号区';
  },

  /**
   * 获取阈值对比表（开发者调优用）
   * @param {number} totalHistorySize - 总历史数据量
   * @returns {Object} {
   *   totalHistorySize, recommendedLevel, levelReason,
   *   thresholds: 完整 4 窗口 × 3 档阈值表,
   *   currentThresholds: 当前档位下的 4 窗口阈值
   * }
   */
  getAdaptiveThresholdComparison: function(totalHistorySize) {
    var level = this.getAdaptiveLevel(totalHistorySize);
    var t = this.SW_ADAPTIVE_LEVEL_THRESHOLDS;
    var reasons = {
      loose: '数据量较少（<' + t.looseMax + '期），阈值降低，更敏感',
      standard: '数据量适中（' + t.looseMax + '-' + t.standardMax + '期），使用标准阈值',
      strict: '数据量充足（>=' + t.standardMax + '期），阈值提高，更严格'
    };
    var currentThresholds = {};
    var all = this.SW_ADAPTIVE_THRESHOLDS;
    for (var k in all) {
      if (Object.prototype.hasOwnProperty.call(all, k) && all[k][level]) {
        currentThresholds[k] = all[k][level];
      }
    }
    return {
      totalHistorySize: totalHistorySize,
      recommendedLevel: level,
      levelReason: reasons[level],
      thresholds: all,
      currentThresholds: currentThresholds
    };
  },

  // ============================================================
  // 2026-06-23 V1.4.6 新增：calculateWindows 的 LRU 缓存包装
  // ============================================================
  // 背景：calculateWindows 是纯计算（5 窗口 × 12 生肖 = 60 次循环），无外源调用
  // 价值：用户多次刷新主推页时避免重算，节省 < 1ms
  // 限制：当前架构下 predict 只算 1 次，LRU 价值有限（主要是代码模式参考）
  // 严格遵守"不修改原函数"原则：原 calculateWindows 完全不动
  // 调用方式：开发者可手动用 _calculateWindowsWithLRU 替代 calculateWindows
  // ============================================================

  /**
   * LRU 缓存配置
   *  - maxSize: 最大缓存条目数（超过则按 LRU 淘汰）
   */
  _windowsLRUConfig: Object.freeze({
    maxSize: 10
  }),

  /**
   * LRU 缓存存储
   *  - key: LRU key（由 _computeWindowsLRUKey 生成）
   *  - value: { value: 计算结果, lastUsed: 时间戳, hitCount: 命中次数 }
   */
  _windowsLRU: {},

  /**
   * LRU 统计
   *  - total: 总调用次数
   *  - hit: 命中次数
   */
  _windowsLRUStats: { total: 0, hit: 0 },

  /**
   * 计算 LRU key：基于 zodiacSeq 的关键特征
   * 格式：length + 第一期 period + 最后一期 period
   * @param {Array} zodiacSeq - 生肖序列（正序）
   * @returns {string} LRU key
   * @private
   */
  _computeWindowsLRUKey: function(zodiacSeq) {
    if (!Array.isArray(zodiacSeq) || zodiacSeq.length === 0) return 'empty';
    var first = zodiacSeq[0];
    var last = zodiacSeq[zodiacSeq.length - 1];
    // 2026-06-23 V1.4.9.1 修复：key 加 ALGORITHM_VERSION（虽然 windows LRU 当前不受规则影响，但保持一致性）
    return 'V_' + this.ALGORITHM_VERSION + '_W_' + zodiacSeq.length + '_' + (first.period || '') + '_' + (last.period || '');
  },

  /**
   * calculateWindows 的 LRU 包装版本
   * - 命中缓存：直接返回结果，递增 hitCount
   * - 未命中：调原 calculateWindows，写入 LRU
   *
   * @param {Array} zodiacSeq - 生肖序列（正序）
   * @returns {Object} windows - {window6, window12, window11, window24, window36}
   */
  _calculateWindowsWithLRU: function(zodiacSeq) {
    // 2026-06-23 V1.4.9.4：跨标签页 LRU 同步（注册 storage 事件）
    this._setupStorageSync();
    // 2026-06-23 V1.4.9.4 修复：V1.4.8 漏掉的懒加载 LRU
    if (!this._lruLoaded.windows) {
      var loadedWindows = this._loadLRUFromStorage('windows');
      if (loadedWindows) this._windowsLRU = loadedWindows;
      this._lruLoaded.windows = true;
    }
    this._windowsLRUStats.total++;
    var key = this._computeWindowsLRUKey(zodiacSeq);
    var entry = this._windowsLRU[key];
    if (entry) {
      this._windowsLRUStats.hit++;
      entry.lastUsed = Date.now();
      entry.hitCount = (entry.hitCount || 0) + 1;
      return entry.value;
    }
    // 缓存未命中 → 调原 calculateWindows
    var result = this.calculateWindows(zodiacSeq);
    // 写入 LRU
    if (Object.keys(this._windowsLRU).length >= this._windowsLRUConfig.maxSize) {
      this._evictLRU(this._windowsLRU);
    }
    this._windowsLRU[key] = { value: result, lastUsed: Date.now(), hitCount: 0 };
    // 2026-06-23 V1.4.9.4 修复：V1.4.8 漏掉的调度持久化
    this._scheduleLRUPersist('windows', this._windowsLRU);
    return result;
  },

  /**
   * 清空 windows LRU 缓存
   */
  clearWindowsLRU: function() {
    this._windowsLRU = {};
    this._windowsLRUStats = { total: 0, hit: 0 };
    // 2026-06-23 V1.4.9.4 修复：V1.4.8 漏掉的同步移除 localStorage
    this._removeLRUFromStorage('windows');
  },

  /**
   * 获取 windows LRU 统计信息
   * @returns {Object} { total, hit, miss, hitRate, cacheSize, maxSize }
   */
  getWindowsLRUStats: function() {
    var stats = this._windowsLRUStats;
    var total = stats.total;
    var hit = stats.hit;
    return {
      total: total,
      hit: hit,
      miss: total - hit,
      hitRate: total > 0 ? Math.round(hit / total * 100) : 0,
      cacheSize: Object.keys(this._windowsLRU).length,
      maxSize: this._windowsLRUConfig.maxSize
    };
  },

  // ============================================================
  // 2026-06-23 V1.4.7 新增：predict LRU 缓存包装
  // ============================================================
  // 背景：predict 是核心计算函数（50-200ms/次），主要被主推页/回测调用
  // 价值：用户多次刷新主推页（同 historyData）时避免重算
  // 限制：回测每次 historyData 切片不同 → 命中率 0%；grid search 不重调 predict
  // 严格遵守"不修改原函数"原则：原 predict 完全不动
  // 调用方式：5 个调用方（business-main.js、business-sliding-window-history.js）改为 _predictWithLRU
  // ============================================================

  /**
   * predict LRU 配置
   *  - maxSize: 5（predict 单次 100-200ms，缓存数少即可）
   */
  _predictLRUConfig: Object.freeze({
    maxSize: 5
  }),

  /**
   * predict LRU 缓存存储
   *  - key: 由 _computePredictLRUKey 生成
   *  - value: { value: predict 返回结果, lastUsed, hitCount }
   */
  _predictLRU: {},

  /**
   * predict LRU 统计
   */
  _predictLRUStats: { total: 0, hit: 0 },

  /**
   * 计算 predict LRU key
   * 格式：historyData.length + 第一期 + 最后一期 + options 指纹
   * @param {Array} historyData - 历史数据
   * @param {Object} options - predict 选项
   * @returns {string} LRU key
   * @private
   */
  _computePredictLRUKey: function(historyData, options) {
    if (!Array.isArray(historyData) || historyData.length === 0) return 'empty';
    var first = historyData[0];
    var last = historyData[historyData.length - 1];
    // options 指纹：仅记录关键字段
    var optSig = 'no_opts';
    if (options) {
      optSig = [];
      if (options.crossResult) optSig.push('xr');
      if (options.downweightedZodiacs) optSig.push('dw:' + options.downweightedZodiacs.length);
      if (typeof options.downweightFactor === 'number') optSig.push('df:' + options.downweightFactor);
      optSig = optSig.join('|') || 'empty_opts';
    }
    // 2026-06-23 V1.4.9.1 修复：key 加 ALGORITHM_VERSION，算法升级时旧 LRU 自动失效
    return 'V_' + this.ALGORITHM_VERSION + '_P_' + historyData.length + '_' + (first.expect || '') + '_' + (last.expect || '') + '_' + optSig;
  },

  /**
   * predict 的 LRU 包装版本
   * @param {Array} historyData - 历史数据
   * @param {Object} [options] - predict 选项
   * @returns {Object|null} predict 返回结果
   */
  _predictWithLRU: function(historyData, options) {
    // 2026-06-23 V1.4.9.4：跨标签页 LRU 同步（注册 storage 事件）
    this._setupStorageSync();
    // 2026-06-23 V1.4.8：懒加载 LRU（仅首次调用时从 localStorage 恢复）
    if (!this._lruLoaded.predict) {
      var loadedPredict = this._loadLRUFromStorage('predict');
      if (loadedPredict) this._predictLRU = loadedPredict;
      this._lruLoaded.predict = true;
    }
    this._predictLRUStats.total++;
    var key = this._computePredictLRUKey(historyData, options);
    var entry = this._predictLRU[key];
    if (entry) {
      this._predictLRUStats.hit++;
      entry.lastUsed = Date.now();
      entry.hitCount = (entry.hitCount || 0) + 1;
      return entry.value;
    }
    // 缓存未命中 → 调原 predict
    var result = this.predict(historyData, options);
    // 写入 LRU（容量超限则淘汰最旧）
    if (Object.keys(this._predictLRU).length >= this._predictLRUConfig.maxSize) {
      this._evictLRU(this._predictLRU);
    }
    this._predictLRU[key] = { value: result, lastUsed: Date.now(), hitCount: 0 };
    // 2026-06-23 V1.4.8：调度持久化（防抖 500ms）
    this._scheduleLRUPersist('predict', this._predictLRU);
    return result;
  },

  /**
   * 清空 predict LRU 缓存
   */
  clearPredictLRU: function() {
    this._predictLRU = {};
    this._predictLRUStats = { total: 0, hit: 0 };
  },

  /**
   * 获取 predict LRU 统计
   */
  getPredictLRUStats: function() {
    var stats = this._predictLRUStats;
    var total = stats.total;
    var hit = stats.hit;
    return {
      total: total,
      hit: hit,
      miss: total - hit,
      hitRate: total > 0 ? Math.round(hit / total * 100) : 0,
      cacheSize: Object.keys(this._predictLRU).length,
      maxSize: this._predictLRUConfig.maxSize
    };
  },

  // ============================================================
  // 2026-06-23 V1.4.7 新增：calculateScore LRU 缓存包装
  // ============================================================
  // 背景：calculateScore 在 predict 内被调用 12 次（每个生肖一次）
  // 价值：predict 整体 LRU 命中时根本不会调到 calculateScore，所以价值有限
  // 设计：仅作为辅助 LRU（当 predict miss 但 calculateScore 输入相同时能命中）
  // 限制：每次 predict 都会传入不同 windows 索引（生肖不同），命中率中等
  // 严格遵守"不修改原函数"原则：原 calculateScore 完全不动
  // 调用方式：predict L738 单行替换 self.calculateScore → self._calculateScoreWithLRU
  // ============================================================

  /**
   * calculateScore LRU 配置
   *  - maxSize: 30（每 predict 12 次调用 + 留余量）
   */
  _calculateScoreLRUConfig: Object.freeze({
    maxSize: 30
  }),

  /**
   * calculateScore LRU 缓存存储
   */
  _calculateScoreLRU: {},

  /**
   * calculateScore LRU 统计
   */
  _calculateScoreLRUStats: { total: 0, hit: 0 },

  /**
   * 计算 calculateScore LRU key
   * 格式：shengxiao + w6 + w12 + w24 + w36 + miss + rhythm + excluded 数 + downweighted 数 + factor
   * @param {string} shengxiao - 生肖名
   * @param {Object} windows - 窗口计数
   * @param {Array} zodiacSeq - 生肖序列
   * @param {Object} rhythm - 节奏对象
   * @param {Array} excludedZodiacs - 排除列表
   * @param {Array} downweightedZodiacs - 降权列表
   * @param {number} downweightFactor - 降权系数
   * @returns {string} LRU key
   * @private
   */
  _computeCalculateScoreLRUKey: function(shengxiao, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor) {
    var w = windows || {};
    var w6 = (w.window6 || {})[shengxiao] || 0;
    var w12 = (w.window12 || {})[shengxiao] || 0;
    var w24 = (w.window24 || {})[shengxiao] || 0;
    var w36 = (w.window36 || {})[shengxiao] || 0;
    var miss = 0;
    if (Array.isArray(zodiacSeq)) {
      for (var i = zodiacSeq.length - 1; i >= 0; i--) {
        if (zodiacSeq[i].shengxiao === shengxiao) { miss = zodiacSeq.length - 1 - i; break; }
        miss++;
      }
    }
    var r = rhythm ? rhythm.pattern : 'no_rhythm';
    var exN = Array.isArray(excludedZodiacs) ? excludedZodiacs.length : 0;
    var dwN = Array.isArray(downweightedZodiacs) ? downweightedZodiacs.length : 0;
    var df = typeof downweightFactor === 'number' ? downweightFactor : 0;
    return 'CS_' + shengxiao + '_' + w6 + '_' + w12 + '_' + w24 + '_' + w36 + '_' + miss + '_' + r + '_' + exN + '_' + dwN + '_' + df;
  },

  /**
   * calculateScore 的 LRU 包装版本
   * @returns {Object} calculateScore 返回结果
   */
  _calculateScoreWithLRU: function(shengxiao, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor) {
    // 2026-06-23 V1.4.9.4：跨标签页 LRU 同步（注册 storage 事件）
    this._setupStorageSync();
    // 2026-06-23 V1.4.8：懒加载 LRU（仅首次调用时从 localStorage 恢复）
    if (!this._lruLoaded.calculateScore) {
      var loadedCS = this._loadLRUFromStorage('calculateScore');
      if (loadedCS) this._calculateScoreLRU = loadedCS;
      this._lruLoaded.calculateScore = true;
    }
    this._calculateScoreLRUStats.total++;
    var key = this._computeCalculateScoreLRUKey(shengxiao, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor);
    var entry = this._calculateScoreLRU[key];
    if (entry) {
      this._calculateScoreLRUStats.hit++;
      entry.lastUsed = Date.now();
      entry.hitCount = (entry.hitCount || 0) + 1;
      return entry.value;
    }
    // 缓存未命中 → 调原 calculateScore
    var result = this.calculateScore(shengxiao, windows, zodiacSeq, rhythm, excludedZodiacs, downweightedZodiacs, downweightFactor);
    // 写入 LRU
    if (Object.keys(this._calculateScoreLRU).length >= this._calculateScoreLRUConfig.maxSize) {
      this._evictLRU(this._calculateScoreLRU);
    }
    this._calculateScoreLRU[key] = { value: result, lastUsed: Date.now(), hitCount: 0 };
    // 2026-06-23 V1.4.8：调度持久化（防抖 500ms）
    this._scheduleLRUPersist('calculateScore', this._calculateScoreLRU);
    return result;
  },

  /**
   * 清空 calculateScore LRU 缓存
   */
  clearCalculateScoreLRU: function() {
    this._calculateScoreLRU = {};
    this._calculateScoreLRUStats = { total: 0, hit: 0 };
    // 2026-06-23 V1.4.8：同步移除 localStorage
    this._removeLRUFromStorage('calculateScore');
  },

  /**
   * 获取 calculateScore LRU 统计
   */
  getCalculateScoreLRUStats: function() {
    var stats = this._calculateScoreLRUStats;
    var total = stats.total;
    var hit = stats.hit;
    return {
      total: total,
      hit: hit,
      miss: total - hit,
      hitRate: total > 0 ? Math.round(hit / total * 100) : 0,
      cacheSize: Object.keys(this._calculateScoreLRU).length,
      maxSize: this._calculateScoreLRUConfig.maxSize
    };
  },

  /**
   * 通用 LRU 淘汰辅助方法（2026-06-23 V1.4.7 抽出）
   * 删除指定 LRU 存储中 lastUsed 最早的 entry
   * @param {Object} lruStore - LRU 存储对象
   * @private
   */
  _evictLRU: function(lruStore) {
    if (!lruStore) return;
    var oldestKey = null;
    var oldestTime = Infinity;
    for (var k in lruStore) {
      if (!Object.prototype.hasOwnProperty.call(lruStore, k)) continue;
      if (lruStore[k].lastUsed < oldestTime) {
        oldestTime = lruStore[k].lastUsed;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) {
      delete lruStore[oldestKey];
    }
  },

  // ============================================================
  // 2026-06-23 V1.4.8 新增：LRU 持久化辅助
  // ============================================================
  // 背景：3 个 LRU（predict / calculateScore / windows）之前只存内存，刷新页面后失效
  // 设计：localStorage 持久化 + 防抖 500ms + 懒加载
  // 收益：用户从 A 页面跳 B 页面 / 刷新页面后，仍能命中 LRU
  // 容错：Storage 不存在时静默跳过（不抛错）
  // 调用：3 个 LRU 包装方法自动调用，无需手动触发
  // ============================================================

  /**
   * LRU 持久化防抖定时器存储
   *  - key: storageKey ('predict' | 'calculateScore' | 'windows')
   *  - value: { timer: setTimeout id }
   */
  _pendingLRUPersist: {},

  /**
   * LRU 加载标记（避免重复加载）
   *  - key: storageKey
   *  - value: boolean（true = 已从 localStorage 加载过）
   */
  _lruLoaded: {},

  /**
   * 防抖调度 LRU 持久化
   * 500ms 内的多次调度合并为 1 次写入
   * @param {string} storageKey - 'predict' | 'calculateScore' | 'windows'
   * @param {Object} lruStore - LRU 存储对象
   * @private
   */
  _scheduleLRUPersist: function(storageKey, lruStore) {
    if (typeof Storage === 'undefined' || !Storage || typeof Storage.set !== 'function') return;
    // 取消之前的定时器
    if (this._pendingLRUPersist[storageKey]) {
      clearTimeout(this._pendingLRUPersist[storageKey].timer);
    }
    var self = this;
    var timer = setTimeout(function() {
      self._persistLRUToStorage(storageKey, lruStore);
      if (self._pendingLRUPersist[storageKey]) {
        delete self._pendingLRUPersist[storageKey];
      }
    }, 500);
    this._pendingLRUPersist[storageKey] = { timer: timer };
  },

  /**
   * 立即将 LRU 写入 localStorage
   * @param {string} storageKey
   * @param {Object} lruStore
   * @private
   */
  _persistLRUToStorage: function(storageKey, lruStore) {
    if (typeof Storage === 'undefined' || !Storage || typeof Storage.set !== 'function') return;
    try {
      var entries = [];
      for (var k in lruStore) {
        if (!Object.prototype.hasOwnProperty.call(lruStore, k)) continue;
        var e = lruStore[k];
        entries.push({ key: k, value: e.value, lastUsed: e.lastUsed, hitCount: e.hitCount || 0 });
      }
      Storage.set('LRU_' + storageKey, { entries: entries, savedAt: Date.now() });
    } catch (err) {
      // 静默失败：localStorage 满 / 序列化失败 / 隐私模式
    }
  },

  /**
   * 从 localStorage 加载 LRU
   * @param {string} storageKey
   * @returns {Object|null} LRU 存储对象，失败返回 null
   * @private
   */
  _loadLRUFromStorage: function(storageKey) {
    if (typeof Storage === 'undefined' || !Storage || typeof Storage.get !== 'function') return null;
    try {
      var data = Storage.get('LRU_' + storageKey, null);
      if (!data || !Array.isArray(data.entries)) return null;
      var now = Date.now();
      var store = {};
      for (var i = 0; i < data.entries.length; i++) {
        var e = data.entries[i];
        if (!e || !e.key) continue;
        store[e.key] = {
          value: e.value,
          lastUsed: e.lastUsed || now,
          hitCount: e.hitCount || 0
        };
      }
      return store;
    } catch (err) {
      return null;
    }
  },

  /**
   * 从 localStorage 移除 LRU
   * @param {string} storageKey
   * @private
   */
  _removeLRUFromStorage: function(storageKey) {
    if (typeof Storage === 'undefined' || !Storage || typeof Storage.remove !== 'function') return;
    try {
      Storage.remove('LRU_' + storageKey);
    } catch (err) {
      // 静默失败
    }
  },

  // ============================================================
  // 2026-06-23 V1.4.9.5 删除：趋势细分 5 档（V1.4.9 实施时未集成到 predict，3 个方法 + 4 条规则完全未被调用）
  // 删除原因：V1.4.9 实施时明确标注"未自动集成"，但 3 个方法未被任何代码调用
  //          4 条 SW_TREND_V2_RULES 依赖 ctx._trendLevel（永远 undefined），永远不触发
  //          整体属于死代码，删除以减少混淆
  // 未来如需重新引入，请先在 predict / calculateScore 末尾集成 _detectTrendV2 + _applyTrendV2Rules
  // ============================================================

  // ============================================================
  // 2026-06-23 V1.4.9.4 新增：跨标签页 LRU 同步
  // ============================================================
  // 背景：LRU 写入 localStorage 用 500ms 防抖，A 标签页调 predict 后 500ms 内
  //       B 标签页不知道 A 的内存 LRU 更新 → 加载 localStorage 旧数据 → 错误命中
  // 方案：注册 storage 事件监听，B 标签页收到 A 的 storage 事件后实时更新 LRU
  // ============================================================

  /**
   * storage 同步开关（避免重复注册）
   */
  _storageSyncEnabled: false,

  /**
   * 注册跨标签页 storage 事件监听（V1.4.9.4 新增）
   * 只能注册 1 次（_storageSyncEnabled 标志）
   * 在第一次 LRU 包装方法调用时自动触发
   */
  _setupStorageSync: function() {
    if (this._storageSyncEnabled) return;
    this._storageSyncEnabled = true;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    var self = this;
    window.addEventListener('storage', function(e) { self._handleStorageEvent(e); });
  },

  /**
   * 处理 storage 事件（V1.4.9.4 新增）
   * 监听 A 标签页的写入，实时更新 B 标签页的内存 LRU
   * @param {StorageEvent} event
   */
  _handleStorageEvent: function(event) {
    if (!event || !event.key) return;
    var MAPPING = {
      'LRU_predict': '_predictLRU',
      'LRU_calculateScore': '_calculateScoreLRU',
      'LRU_windows': '_windowsLRU'
    };
    var target = MAPPING[event.key];
    if (!target) return;
    // newValue 为空 = 清除
    if (!event.newValue) {
      this[target] = {};
      return;
    }
    try {
      var raw = event.newValue;
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || !Array.isArray(data.entries)) return;
      var now = Date.now();
      var store = {};
      for (var i = 0; i < data.entries.length; i++) {
        var e = data.entries[i];
        if (!e || !e.key) continue;
        store[e.key] = {
          value: e.value,
          lastUsed: e.lastUsed || now,
          hitCount: e.hitCount || 0
        };
      }
      this[target] = store;
    } catch (err) {
      // 静默失败
    }
  }
};