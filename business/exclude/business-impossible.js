/**
 * 【业务层】最不可能出现 算法（v2.2.0 优化）
 *
 * 职责：
 * - 基于历史最近 N 期（默认 24 期）的特码数据，按 5 个维度
 *   （生肖 / 波色 / 头数 / 尾数 / 五行）分别计算「最不可能出现」的项
 * - 每个维度的评分由 5 个子维度加权综合：
 *     ① 频率倒数（频次越低，得分越高）            权重 30%
 *     ② 遗漏指数衰减（越久没出得分越高，近期权重更大）权重 25%
 *     ③ 近期冷热度（最近 6 期出现越少，得分越高）   权重 20%
 *     ④ 趋势方向（频率下降→得分↑，频率上升→得分↓） 权重 15%
 *     ⑤ 反转信号（连出→加分，冷号回暖→减分）       权重 10%
 *
 * v2.2.0 优化：
 *   - 遗漏间隔改用指数衰减，近期遗漏影响更大
 *   - 新增「趋势方向」维度，检测频率变化方向
 *   - 增强反转信号：连出+冷号回暖双重检测
 *
 * 依赖：CONFIG / Utils（SpecialCalculator）
 * 调用方：business-main.js 的 initGiongTab
 *
 * 文件拆分原则：算法属于业务层，禁止任何 DOM 操作
 */
const BusinessImpossible = {

  /** 默认分析窗口 */
  DEFAULT_WINDOW: 24,

  /** 近期热度衰减窗口（最近 6 期内出现越多，得分越低） */
  RECENT_WINDOW: 6,

  /** 遗漏指数衰减半衰期：距上次出现每过半衰期，影响力衰减一半 */
  MISS_HALF_LIFE: 8,

  /** 五维加权 */
  WEIGHTS: {
    FREQ: 0.30, // 频率倒数
    MISS: 0.25, // 遗漏指数衰减
    RECENT: 0.20, // 近期冷热度
    TREND: 0.15, // 趋势方向
    REVERSE: 0.10 // 反转信号
  },

  /**
   * 主入口：计算 5 个维度的「最不可能出现」
   */
  calculate: function(historyData, precomputedSpecials, options) {
    if (!historyData || !historyData.length) return null;

    let windowSize = (options && options.window) || this.DEFAULT_WINDOW;
    if (windowSize < 6) windowSize = 6;

    const recentData = historyData.slice(0, Math.min(windowSize, historyData.length));
    if (recentData.length < 6) return null;

    // v2.5.0：优先使用通用缓存的 specials（避免重复计算）
    let specials;
    if (precomputedSpecials && precomputedSpecials.length) {
      specials = precomputedSpecials.slice(0, recentData.length);
    } else {
      const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);
      specials = allSpecials.slice(0, recentData.length);
    }

    const nextExpect = (Number(historyData[0].expect || 0) + 1) || '';

    return {
      windowSize: recentData.length,
      nextExpect: nextExpect,
      recentOdd: !!(specials[0] && specials[0].odd),
      zodiac:   this._calcOneDimension(specials, 'zodiac', this._ZODIAC_LIST, 'zod'),
      color:    this._calcOneDimension(specials, 'color', this._COLOR_LIST, 'colorName'),
      head:     this._calcOneDimension(specials, 'head', this._HEAD_LIST, 'head'),
      tail:     this._calcOneDimension(specials, 'tail', this._TAIL_LIST, 'tail'),
      wuxing:   this._calcOneDimension(specials, 'wuxing', this._WUXING_LIST, 'wuxing')
    };
  },

  // 维度全集
  _ZODIAC_LIST: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],
  _COLOR_LIST:  ['红', '蓝', '绿'],
  _HEAD_LIST:   [0, 1, 2, 3, 4],
  _TAIL_LIST:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  _WUXING_LIST: ['金', '木', '水', '火', '土'],

  /**
   * 单维度评分（五维加权）
   * @param {Array} specials - 与 recentData 对齐的特码信息（最新在前）
   * @param {string} dimKey  - 维度字段名
   * @param {Array} domain   - 该维度全集
   * @param {string} valKey  - specials 中对应的取值字段
   */
  _calcOneDimension: function(specials, dimKey, domain, valKey) {
    const n = specials.length;
    const recentWindowSize = Math.min(this.RECENT_WINDOW, n);
    const halfN = Math.floor(n / 2);

    // ① 频率统计（全窗口 + 前后半窗口）
    const freq = {};
    const freqFirstHalf = {}; // 前半窗口（较新的一半）
    const freqSecondHalf = {}; // 后半窗口（较旧的一半）
    domain.forEach(function(d) { freq[d] = 0; freqFirstHalf[d] = 0; freqSecondHalf[d] = 0; });

    specials.forEach(function(sp, idx) {
      const v = sp[valKey];
      if (freq[v] !== undefined) {
        freq[v]++;
        if (idx < halfN) freqFirstHalf[v]++;
        else freqSecondHalf[v]++;
      }
    });

    // ② 当前遗漏 + ③ 最近 6 期次数
    const currentMiss = {};
    const recentCount = {};
    domain.forEach(function(d) { currentMiss[d] = -1; recentCount[d] = 0; });

    for (let i = 0; i < n; i++) {
      const v = specials[i][valKey];
      if (currentMiss[v] === -1) currentMiss[v] = i;
      if (i < recentWindowSize && recentCount[v] !== undefined) {
        recentCount[v]++;
      }
    }
    domain.forEach(function(d) {
      if (currentMiss[d] === -1) currentMiss[d] = n;
    });

    // ④ 反转信号：连出 + 冷号回暖
    const reverseInfo = this._calcReverseSignal(specials, valKey);

    // ⑤ 趋势方向：前后半窗口频率对比
    const trendInfo = this._calcTrendSignal(freqFirstHalf, freqSecondHalf, domain);

    // ----- 归一化计算 -----
    const freqVals = domain.map(function(d) { return freq[d]; });
    const freqMin = Math.min.apply(null, freqVals);
    const freqMax = Math.max.apply(null, freqVals);

    const results = domain.map(function(d) {
      const f = freq[d];

      // ① 频率倒数：频次越低 → 得分越高
      const freqScore = (freqMax === freqMin)
        ? 50
        : Math.round(((freqMax - f) / (freqMax - freqMin)) * 100);

      // ② 遗漏指数衰减：越久没出 → 得分越高（指数衰减让近期遗漏影响更大）
      const miss = currentMiss[d];
      const missScore = this._expDecayScore(miss);

      // ③ 近期冷热度：最近 6 期出现越少 → 得分越高
      const rc = recentCount[d];
      const maxRecent = recentWindowSize;
      const recentScore = (rc === 0)
        ? 100
        : Math.round((1 - rc / maxRecent) * 100);

      // ④ 趋势方向：频率下降 → 得分↑，频率上升 → 得分↓
      const trendScore = trendInfo[d] || 50;

      // ⑤ 反转信号：连出 → 加分，冷号回暖 → 减分
      const reverseScore = reverseInfo[d] || 0;

      const total = this.WEIGHTS.FREQ * freqScore
        + this.WEIGHTS.MISS * missScore
        + this.WEIGHTS.RECENT * recentScore
        + this.WEIGHTS.TREND * trendScore
        + this.WEIGHTS.REVERSE * reverseScore;

      return {
        name: d,
        score: Math.round(total),
        breakdown: {
          freq: freqScore,
          miss: missScore,
          recent: recentScore,
          trend: trendScore,
          reverse: reverseScore
        },
        meta: {
          freq: f,
          miss: miss,
          recent: rc,
          trend: trendInfo[d],
          isStreak: !!reverseInfo._streakKey && reverseInfo._streakKey === d
        }
      };
    }.bind(this));

    results.sort(function(a, b) { return b.score - a.score; });

    return {
      key: dimKey,
      top: results[0],
      all: results
    };
  },

  /**
   * 指数衰减评分：越久没出现越接近 100
   * 公式：score = 100 * (1 - e^(-miss / halfLife))
   * miss=0 → 0, miss=halfLife → 63, miss=∞ → 100
   *
   * v2.4.0 修复：
   * - 归一化系数从 totalN/halfLife 改为 1（直接用 miss 作为 e 指数）
   * - 确保 miss=8 时接近 63 分（半衰期语义正确）
   */
  _expDecayScore: function(miss) {
    if (miss === 0) return 0;
    if (miss < 0) return 0;
    // 直接使用 miss 作为指数参数，半衰期 = MISS_HALF_LIFE
    const decay = 1 - Math.exp(-miss / this.MISS_HALF_LIFE);
    return Math.round(Math.min(100, decay * 100));
  },

  /**
   * 趋势方向信号：
   * - 比较前后半窗口的频率，频率下降 → 得分↑（越来越冷，不可能指数高）
   * - 频率上升 → 得分↓（正在回暖，不可能指数降低）
   * - 从未出现 → 50（中性）
   * @returns {Object} 每个候选的趋势得分 0..100
   */
  _calcTrendSignal: function(freqFirstHalf, freqSecondHalf, domain) {
    const out = {};
    domain.forEach(function(d) {
      const first = freqFirstHalf[d] || 0;
      const second = freqSecondHalf[d] || 0;
      const total = first + second;

      if (total === 0) {
        // 从未出现，趋势中性
        out[d] = 50;
        return;
      }

      // 前半占比：前半出现次数 / 总次数
      // 前半占比低 → 频率下降 → 越来越冷 → 得分高
      // 前半占比高 → 频率上升 → 正在回暖 → 得分低
      const firstRatio = first / total;

      // 映射到 0..100：前半占比 0 → 100（完全降温），前半占比 1 → 0（完全升温）
      out[d] = Math.round((1 - firstRatio) * 100);
    });
    return out;
  },

  /**
   * 反转信号增强版（v2.2.0 / v2.4.0 修复）：
   * ① 连出检测：正连出的项加分（反转概率高）
   * ② 冷号回暖检测：长期未出但近期开始出现 → 减分（可能正在变热）
   *
   * v2.4.0 修复：
   * - 修复数字键（head/tail=0..9）与字符串键的等价比较（== 而非 ===）
   * - 减分下限 -100，防止 score 溢出
   *
   * @param {Array} specials - 最新在前的特码信息
   * @param {string} valKey  - 取值字段
   * @returns {Object} 得分映射，含 _streakKey 标记
   */
  _calcReverseSignal: function(specials, valKey) {
    const n = specials.length;
    const latest = specials[0][valKey];
    const out = {};

    if (latest === undefined) return out;

    // ① 连出检测：计算 latest 连续出现的期数
    let streak = 1;
    for (let i = 1; i < n && specials[i][valKey] === latest; i++) {
      streak++;
    }
    out._streakKey = latest;
    // 连出越长，反转概率越高，得分越高
    out[latest] = Math.min(100, streak * 25);

    // ② 冷号回暖检测：收集每个候选的"最近出现位置"
    //    使用宽松相等 (==) 比较键值，修复数字键/字符串键不匹配的问题
    const missMap = {};
    const recentHalf = Math.max(1, Math.floor(n / 2));

    for (let i = 0; i < n; i++) {
      const v = specials[i][valKey];
      if (missMap[v] === undefined) missMap[v] = i;
    }

    // 对于每个候选，转数字后严格比较，兼容 head/tail 的数字键
    Object.keys(missMap).forEach(function(v) {
      // v 是字符串（Object.key 总是字符串），latest 可能是数字；都转数字后比较
      const vNum = Number(v);
      if (Number(latest) === vNum) return; // 跳过连出项

      const miss = missMap[v];
      if (miss === undefined) return;

      // 如果该候选在近期窗口中（miss < recentHalf），说明它最近出现过
      // 且它不是连出项 → 它可能是冷号回暖
      if (miss < recentHalf && miss > 0) {
        // 回暖信号：减分（降低不可能指数）
        // 越靠近最新一期，回暖信号越强
        const warmScore = Math.round((1 - miss / recentHalf) * 60);
        const prev = out[v] || 0;
        out[v] = Math.max(-100, prev - warmScore);
      }
    });

    return out;
  },

  /**
   * 回测追踪（v2.1.1 修复 / v2.4.0 数据不足保护 / v2.5.0 通用缓存）
   * i=0 预测最新一期，使用 historyData[1..1+W] 作为窗口
   */
  calculateBacktrack: function(historyData, limit) {
    if (!historyData || !historyData.length) return [];
    limit = limit || 10;

    const self = this;
    const rows = [];
    const n = historyData.length;
    const W = this.DEFAULT_WINDOW;

    // 数据不足：需要至少 W+1 期才能回测 1 期
    if (n < W + 1) {
      return [];
    }

    // v2.5.0：使用通用滑动窗口预计算（项目统一 API）
    // 一次预计算，回测循环内只做轻量切片，避免重复 getSpecial
    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    for (let i = 0; i < n - W; i++) {
      const windowSpecials = allSpecials.slice(i + 1, i + 1 + W);
      if (windowSpecials.length < 6) continue;

      const k = self._pickTopFromSpecials(windowSpecials);

      const actual = historyData[i];
      const actSpec = allSpecials[i];
      // 防御：actSpec 可能为 null（异常历史数据）
      if (!actSpec || actSpec.te === undefined) continue;
      const actTe = actSpec.te;

      const actualHalf = actSpec.colorName + (actSpec.odd ? '单' : '双');
      const latestOdd = windowSpecials[0].odd;
      const predictHalf = k.color.top.name + (latestOdd ? '单' : '双');

      const zodiacHit = actSpec.zod !== k.zodiac.top.name;
      const halfHit = actualHalf !== predictHalf;
      const tailHit = actSpec.tail !== k.tail.top.name;
      const headHit = actSpec.head !== k.head.top.name;

      const allHit = zodiacHit && halfHit && tailHit && headHit;
      const missCount = (zodiacHit ? 0 : 1) + (halfHit ? 0 : 1) + (tailHit ? 0 : 1) + (headHit ? 0 : 1);

      rows.push({
        expect: actual.expect,
        zodiac: k.zodiac.top.name,
        zodiacScore: k.zodiac.top.score,
        color: k.color.top.name,
        half: predictHalf,
        tail: k.tail.top.name,
        tailScore: k.tail.top.score,
        head: k.head.top.name,
        headScore: k.head.top.score,
        actualExpect: actual.expect,
        actualZodiac: actSpec.zod,
        actualTe: actTe,
        actualColor: actSpec.colorName,
        actualOdd: actSpec.odd ? '单' : '双',
        actualHalf: actualHalf,
        actualHead: actSpec.head,
        actualTail: actSpec.tail,
        zodiacHit: zodiacHit,
        halfHit: halfHit,
        tailHit: tailHit,
        headHit: headHit,
        allHit: allHit,
        missCount: missCount
      });
    }

    return rows.slice(0, limit);
  },

  /**
   * 内部工具：对一组 specials 计算 5 维「最不可能」对象
   */
  _pickTopFromSpecials: function(specials) {
    return {
      zodiac: this._calcOneDimension(specials, 'zodiac', this._ZODIAC_LIST, 'zod'),
      color:  this._calcOneDimension(specials, 'color', this._COLOR_LIST, 'colorName'),
      head:   this._calcOneDimension(specials, 'head', this._HEAD_LIST, 'head'),
      tail:   this._calcOneDimension(specials, 'tail', this._TAIL_LIST, 'tail'),
      wuxing: this._calcOneDimension(specials, 'wuxing', this._WUXING_LIST, 'wuxing')
    };
  }
};
