/**
 * 滑动窗口预测算法 · 业务层
 * 基于12/24/36期三窗联合判定算法，自动计算每期6个候选生肖
 * 
 * 依赖方向: views/ -> business/ -> core/
 * 禁止DOM操作，只做纯计算和逻辑
 */
const BusinessSlidingWindow = {

  /** 12生肖列表 */
  SHENGXIAO_ALL: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

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

      var zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
      var zodArr = zodArrRaw.map(function(z) {
        return CONFIG && CONFIG.ANALYSIS && CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP
          ? (CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z)
          : z;
      });
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
   * 窗口: 12期、11期（解权）、24期、36期
   *
   * @param {Array} zodiacSeq - 生肖序列（正序）
   * @returns {Object} windows - {window12: Map, window11: Map, window24: Map, window36: Map}
   */
  calculateWindows: function(zodiacSeq) {
    var self = this;
    var total = zodiacSeq.length;

    // 初始化计数器
    var window12 = {}, window11 = {}, window24 = {}, window36 = {};
    self.SHENGXIAO_ALL.forEach(function(sx) {
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
      if (offset < 12) window12[sx] = (window12[sx] || 0) + 1;
      if (offset < 11) window11[sx] = (window11[sx] || 0) + 1;
      if (offset < 24) window24[sx] = (window24[sx] || 0) + 1;
      if (offset < 36) window36[sx] = (window36[sx] || 0) + 1;
    }

    return {
      window12: window12,
      window11: window11,
      window24: window24,
      window36: window36
    };
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
   * 核心评分规则：对每个生肖计算综合得分
   *
   * @param {string} shengxiao - 生肖名
   * @param {Object} windows - 窗口计数 {window12, window11, window24, window36}
   * @param {Array} zodiacSeq - 生肖序列
   * @returns {Object} 评分结果 {shengxiao, score, reason, signals, window12, window11, window24, window36, zone12, zone24, zone36, miss}
   */
  calculateScore: function(shengxiao, windows, zodiacSeq) {
    var w12 = windows.window12[shengxiao] || 0;
    var w11 = windows.window11[shengxiao] || 0;
    var w24 = windows.window24[shengxiao] || 0;
    var w36 = windows.window36[shengxiao] || 0;

    var zone12 = this.getZone12(w12);
    var zone24 = this.getZone24(w24);
    var zone36 = this.getZone36(w36);

    var score = 0;
    var signals = [];
    var reasons = [];

    // 冷补豁免标志
    var hasStrongest = false;  // 双过热（最强/极强信号）
    var hasDualHot = false;    // 双热号信号

    // ===== 核心评分规则（按优先级依次判断，取最高级别的一个信号为基础分） =====

    // 规则1：24/36期双过热(5/7) - 最强信号 → 永远保留
    if (w24 === 5 && w36 === 7) {
      score += 100;
      signals.push('24/36期双过热(5/7)');
      reasons.push('24/36期双过热是最强信号');
      hasStrongest = true;
    }
    // 规则2：24/36期双过热(5/6) - 极强信号 → 永远保留
    else if (w24 >= 5 && w36 >= 6) {
      score += 90;
      signals.push('24/36期双过热');
      reasons.push('24/36期双过热是极强信号');
      hasStrongest = true;
    }
    // 规则3：三窗热号(2/4/5+) - 永远保留
    else if (w12 === 2 && w24 === 4 && w36 >= 5) {
      score += 80;
      signals.push('三窗热号(2/4/5+)');
      reasons.push('三窗热号是强信号');
      hasDualHot = true;
    }
    // 规则4：24/36期双热号(4/6)
    else if (w24 === 4 && w36 === 6) {
      score += 70;
      signals.push('24/36期双热号(4/6)');
      reasons.push('24/36期双热号是强信号');
      hasDualHot = true;
    }
    // 规则5：24/36期热号(4/5)
    else if (w24 === 4 && w36 === 5) {
      score += 60;
      signals.push('24/36期热号(4/5)');
      reasons.push('24/36期热号是中强信号');
      hasDualHot = true;
    }
    // 规则6：36期热号(6)
    else if (w36 === 6) {
      score += 55;
      signals.push('36期热号(6)');
      reasons.push('36期热号(6)是中强信号');
    }
    // 规则7：2.7规则触发（穿插+活跃+热号）
    else if (w12 === 1 && w24 === 3 && w36 >= 5) {
      score += 65;
      signals.push('2.7规则触发');
      reasons.push('2.7规则触发（穿插+活跃+热号）');
    }
    // 规则8：2.7规则触发（穿插+热号+热号）
    else if (w12 === 1 && w24 === 4 && w36 >= 4) {
      score += 65;
      signals.push('2.7规则触发');
      reasons.push('2.7规则触发（穿插+热号+热号）');
    }
    // 规则9：24/36期双冷+超长遗漏 - 必出信号
    else if (w24 === 1 && w36 === 2) {
      score += 50;
      signals.push('24/36期双冷+超长遗漏');
      reasons.push('24/36期双冷+超长遗漏是必出信号');
    }
    // 规则10：24/36期活跃(3/4)
    else if (w24 === 3 && w36 === 4) {
      score += 45;
      signals.push('24/36期活跃(3/4)');
      reasons.push('24/36期活跃是中等信号');
    }
    // 规则11：36期活跃(4)
    else if (w36 === 4) {
      score += 40;
      signals.push('36期活跃(4)');
      reasons.push('36期活跃(4)是中等信号');
    }
    // 规则12：36期活跃(3)
    else if (w36 === 3) {
      score += 30;
      signals.push('36期活跃(3)');
      reasons.push('36期活跃(3)是中等信号');
    }
    // 规则13：36期冷号(2) - 基础信号
    else if (w36 === 2) {
      score += 10;
      signals.push('36期冷号(2)');
      reasons.push('36期冷号(2)是基础信号');
    }
    // 规则14：36期冷号(1) - 弱信号
    else if (w36 === 1) {
      score += 5;
      signals.push('36期冷号(1)');
      reasons.push('36期冷号(1)是弱信号');
    }
    // 无信号
    else {
      signals.push('无明显信号');
      reasons.push('无可匹配的评分规则');
    }

    // ===== 跨窗信号（12期冷号0 + 36期热号5+ → 可与其他信号叠加） =====
    if (w12 === 0 && w36 >= 5) {
      score += 55;
      signals.push('跨窗信号(12期0+36期' + w36 + ')');
      reasons.push('跨窗信号触发：12期冷号+36期热号，叠加+55');
    }

    // ===== 冷补不重复 & 遗漏调整 =====
    var miss = this.getMissPeriods(shengxiao, zodiacSeq);

    if (miss <= 2) {
      // 1-2期前：24/36期双过热保留，其他-25分
      if (!hasStrongest) {
        score -= 25;
        reasons.push('冷补不重复：' + miss + '期前刚开过(-25)');
      }
    } else if (miss === 3) {
      // 3期前：24/36期双过热保留，其他-15分
      if (!hasStrongest) {
        score -= 15;
        reasons.push('冷补不重复：3期前刚开过(-15)');
      }
    } else if (miss === 4 || miss === 5) {
      // 4-5期前：24/36期双热号保留，其他不变
      if (hasDualHot) {
        reasons.push('接近冷补期：双热号保留(不扣分)');
      }
    } else if (miss >= 6 && miss <= 14) {
      // 6-14期前：全部保留，+10分
      if (score > 0) {
        score += 10;
        reasons.push('已过冷补期：' + miss + '期未开(+10)');
      }
    } else {
      // 15期前+：全部保留，双冷条件触发超长遗漏+30
      if (miss >= 15 && w24 <= 2 && w36 <= 2) {
        score += 30;
        signals.push('超长遗漏');
        reasons.push('超长遗漏：' + miss + '期未出(+30)');
      }
    }

    // ===== 冷补排除规则 =====
    // 规则A：12期1次 + 24/36期都是冷号区/穿插区 → 排除（大幅扣分）
    if (w12 === 1 && (zone24 === '冷号区' || zone24 === '穿插区') && (zone36 === '冷号区' || zone36 === '穿插区')) {
      score -= 50;
      reasons.push('冷补排除：12期穿插+24/36双冷号区');
    }
    // 规则B：12期1次 + 24/36期有活跃/热号 → 保留（不额外处理，已在评分中体现）
    // 规则C：12期2次 + 24/36期热号 → 保留（不额外处理）
    // 规则D：24/36期双过热/三窗热号 → 永远保留（由 hasStrongest/hasDualHot 处理）

    // ===== 11期解权机制 =====
    // 12期3次（降权区）+ 11期≤2 → 解权保留（但仍轻微扣分表示降权）
    if (w12 >= 3 && w11 <= 2) {
      score -= 15;
      reasons.push('12期降权中（11期解权：' + w11 + '/' + w12 + '，保留）');
    }

    return {
      shengxiao: shengxiao,
      score: score,
      reason: reasons.join('；') || '无特殊原因',
      signals: signals,
      window12: w12,
      window11: w11,
      window24: w24,
      window36: w36,
      zone12: zone12,
      zone24: zone24,
      zone36: zone36,
      miss: miss
    };
  },

  /**
   * 预测主逻辑：基于滑动窗口算法，返回评分前6的候选生肖
   *
   * @param {Array} historyData - 原始历史数据
   * @returns {Object|null} 预测结果
   *   - candidates: [{shengxiao, emoji, score, rank, ...}]
   *   - allScores: 所有12生肖的详细评分
   *   - nextExpect: 下一期期号
   *   - summary: 12/24/36窗口概览
   */
  predict: function(historyData) {
    var self = this;

    // 1. 转换数据格式
    var zodiacSeq = this.convertHistoryToZodiacSequence(historyData);
    if (!zodiacSeq || zodiacSeq.length < 12) {
      return null; // 数据不足（至少需要12期）
    }

    // 2. 计算窗口
    var windows = this.calculateWindows(zodiacSeq);

    // 3. 计算所有生肖的评分
    var allScores = [];
    self.SHENGXIAO_ALL.forEach(function(sx) {
      var scoreObj = self.calculateScore(sx, windows, zodiacSeq);
      allScores.push(scoreObj);
    });

    // 4. 按评分降序排列
    allScores.sort(function(a, b) { return b.score - a.score; });

    // 5. 取前6名为候选
    var top6 = allScores.slice(0, 6);
    var candidates = top6.map(function(item, idx) {
      return {
        shengxiao: item.shengxiao,
        emoji: self.SHENGXIAO_EMOJI[item.shengxiao] || '❓',
        score: item.score,
        rank: idx + 1,
        reason: item.reason,
        signals: item.signals,
        window12: item.window12,
        window11: item.window11,
        window24: item.window24,
        window36: item.window36,
        zone12: item.zone12,
        zone24: item.zone24,
        zone36: item.zone36,
        miss: item.miss
      };
    });

    // 6. 计算下一期期号
    var latestExpect = zodiacSeq.length > 0 ? zodiacSeq[zodiacSeq.length - 1].period : 0;
    var nextExpect = latestExpect + 1;

    // 7. 窗口概览统计
    var windowSummary = {
      max12: 0, max24: 0, max36: 0,
      hotZones: { zone12: {}, zone24: {}, zone36: {} }
    };
    allScores.forEach(function(item) {
      if (item.window12 > windowSummary.max12) windowSummary.max12 = item.window12;
      if (item.window24 > windowSummary.max24) windowSummary.max24 = item.window24;
      if (item.window36 > windowSummary.max36) windowSummary.max36 = item.window36;

      var z12 = item.zone12, z24 = item.zone24, z36 = item.zone36;
      windowSummary.hotZones.zone12[z12] = (windowSummary.hotZones.zone12[z12] || 0) + 1;
      windowSummary.hotZones.zone24[z24] = (windowSummary.hotZones.zone24[z24] || 0) + 1;
      windowSummary.hotZones.zone36[z36] = (windowSummary.hotZones.zone36[z36] || 0) + 1;
    });

    return {
      candidates: candidates,
      allScores: allScores,
      nextExpect: nextExpect,
      summary: windowSummary,
      algorithm: '滑动窗口V1.0',
      timestamp: Date.now()
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
  }
};