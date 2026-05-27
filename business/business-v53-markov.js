/**
 * V5.3 二阶马尔可夫链
 * 对应文档任务三 3.3 节 + 第二章 2.5
 *
 * 维护200期滑动窗口的三维转移矩阵 Count[prev2][prev1][current]
 * 每期增量更新（增量+1，淘汰-1）
 */
const BusinessV53Markov = {
  _matrix: null,
  _windowSize: 200,
  _lastProcessedCount: 0,

  /**
   * 初始化12×12×12矩阵
   */
  init: function() {
    this._matrix = [];
    this._windowSize = BusinessV53Config.WINDOWS.MARKOV;
    this._lastProcessedCount = 0;
    for (var p2 = 0; p2 < 12; p2++) {
      this._matrix[p2] = [];
      for (var p1 = 0; p1 < 12; p1++) {
        this._matrix[p2][p1] = new Array(12).fill(0);
      }
    }
  },

  /**
   * 增量更新矩阵（跨期模式：连续3期各1个生肖 → 一个三元组）
   * 数据格式：每期 [n1] 或 [n1,n2,n3]，按时间顺序（最旧在前）
   * 
   * 首次调用（_lastProcessedCount=0）：全量初始化最近200期的所有三元组
   * 后续调用：增量更新（只处理新增期数，移除超出窗口的旧期数）
   * @param {Array} zodiacHistory - 完整生肖历史
   */
  updateMatrix: function(zodiacHistory) {
    if (!this._matrix) this.init();

    // 将多期数据展平为单号码序列（跨期构建三元组）
    var flat = [];
    zodiacHistory.forEach(function(p) {
      if (p.length > 0) flat.push(p[0]); // 每期取第一个生肖（特码）
    });

    var total = flat.length;
    var maxSize = this._windowSize;

    // 需要至少3个连续数据点才能形成三元组
    if (total < 3) return;

    var isFirstLoad = this._lastProcessedCount === 0;

    if (isFirstLoad) {
      // === 首次加载：全量初始化最近 maxSize 期的所有三元组 ===
      var startIdx = Math.max(0, total - maxSize);
      for (var i = startIdx; i < total - 2; i++) {
        this._increment(flat[i], flat[i + 1], flat[i + 2]);
      }
      this._lastProcessedCount = total;
    } else {
      // === 增量更新：只处理新增的期数 ===
      var prevCount = this._lastProcessedCount;
      
      // 数据被截断/重置了（如重新初始化后数据变少），需要全量重建
      if (total < prevCount) {
        this.init();
        this.updateMatrix(zodiacHistory);
        return;
      }
      
      // 无新增数据
      if (total <= prevCount) return;

      // 处理新增期数对应的三元组
      // 新增期数起始位置 = prevCount（上次处理到的位置）
      // 每个新增期都会形成一个新的三元组：(flat[n-2], flat[n-1], flat[n])
      var newStart = Math.max(prevCount - 2, 0); // 从能形成三元组的位置开始
      
      for (var i = newStart; i < total - 2; i++) {
        this._increment(flat[i], flat[i + 1], flat[i + 2]);
      }

      // 处理超出窗口的旧三元组（滑动窗口淘汰）
      if (total > maxSize) {
        // 旧窗口左边界 = 首次加载时的 startIdx 对应的三元组起始位置
        // 新窗口左边界 = total - maxSize
        var oldBoundary = Math.max(0, prevCount - maxSize);
        var newBoundary = total - maxSize;
        
        // 将旧窗口左边界到新窗口左边界之间的三元组移除
        var removeStart = oldBoundary;
        var removeEnd = newBoundary;
        
        for (var i = removeStart; i < removeEnd && i < total - 2; i++) {
          this._decrement(flat[i], flat[i + 1], flat[i + 2]);
        }
      }

      this._lastProcessedCount = total;
    }
  },

  _increment: function(a, b, c) {
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12 && c >= 1 && c <= 12) {
      this._matrix[a-1][b-1][c-1]++;
    }
  },

  _decrement: function(a, b, c) {
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12 && c >= 1 && c <= 12) {
      if (this._matrix[a-1][b-1][c-1] > 0) this._matrix[a-1][b-1][c-1]--;
    }
  },

  /**
   * 2.5 转移概率 → 加分映射
   * @returns {number} [0, 1, 2, 4, 7, 10]
   */
  getBonus: function(prev2, prev1, x) {
    if (!this._matrix) return 0;
    if (prev2 < 1 || prev2 > 12 || prev1 < 1 || prev1 > 12 || x < 1 || x > 12) return 0;

    var row = this._matrix[prev2-1][prev1-1];
    var total = row.reduce(function(s, v) { return s + v; }, 0);
    if (total === 0) return 0;

    var prob = row[x-1] / total;
    var map = BusinessV53Config.MARKOV_BONUS_MAP;
    for (var i = 0; i < map.length; i++) {
      if (prob >= map[i].threshold) return map[i].bonus;
    }
    return 0;
  },

  /**
   * 批量计算所有12个号码的马尔可夫加分
   */
  computeAllBonus: function(prev2, prev1) {
    var bonuses = {};
    for (var x = 1; x <= 12; x++) {
      bonuses[x] = this.getBonus(prev2, prev1, x);
    }
    return bonuses;
  }
};