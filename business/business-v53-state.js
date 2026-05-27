/**
 * V5.3 动态冷热状态机
 * 对应文档第四章：双向跳过/回归 + 6种状态管理
 */
const BusinessV53DynamicState = {
  /**
   * 初始化12个号码状态
   */
  initStates: function() {
    var states = {};
    var S = BusinessV53Config.STATUS;
    var hotPool = BusinessV53Config.FIXED_POOLS.HOT;
    var coldPool = BusinessV53Config.FIXED_POOLS.COLD;

    hotPool.forEach(function(n) {
      states[n] = { status: S.NORMAL_HOT, observeRemaining: 0 };
    });
    coldPool.forEach(function(n) {
      states[n] = { status: S.NORMAL_COLD, observeRemaining: 0 };
    });
    return states;
  },

  /**
   * 主入口：更新所有动态状态
   */
  updateStates: function(prevStates, zodiacHistory) {
    var newStates = BusinessV53Utils.deepClone(prevStates || this.initStates());
    var hotPool = BusinessV53Config.FIXED_POOLS.HOT;

    for (var num = 1; num <= 12; num++) {
      var prev = newStates[num];
      if (!prev) continue;

      var f12 = this._countInWindow(zodiacHistory, num, 12);
      var f24 = this._countInWindow(zodiacHistory, num, 24);
      var f36 = this._countInWindow(zodiacHistory, num, 36);
      var f7  = this._countInWindow(zodiacHistory, num, 7);
      var isFixedHot = hotPool.indexOf(num) !== -1;

      if (isFixedHot) {
        this._updateHot(newStates, num, prev, f12, f24, f36, f7);
      } else {
        this._updateCold(newStates, num, prev, f12, f24, f36, f7);
      }
    }
    return newStates;
  },

  // ========== 4.1 热号→冷 ==========
  _updateHot: function(states, num, prev, f12, f24, f36, f7) {
    var S = BusinessV53Config.STATUS;
    var O = BusinessV53Config.OBSERVE_PERIODS;

    // 观察期内：若开出则撤销跳过
    if (this._isObserving(prev.status)) {
      if (f7 > 0) {
        states[num] = { status: S.NORMAL_HOT, observeRemaining: 0 };
        return;
      }
      var remaining = prev.observeRemaining - 1;
      if (remaining <= 0) {
        states[num] = { status: S.NORMAL_COLD, observeRemaining: 0 };
      } else {
        states[num] = { status: prev.status, observeRemaining: remaining };
      }
      return;
    }

    // 回归：不再满足转冷条件则自动回热
    if (prev.status !== S.NORMAL_HOT && f12 >= 1) {
      states[num] = { status: S.NORMAL_HOT, observeRemaining: 0 };
      return;
    }

    // 硬跳过：近12期0 + 近24≤1 + 近36≤3
    if (f12 === 0 && f24 <= 1 && f36 <= 3) {
      states[num] = { status: S.HOT_TO_COLD_HARD_OBSERVE, observeRemaining: O.HOT_TO_COLD_HARD };
      return;
    }

    // 软跳过：近12期0 + 近24≤2 + 近36≤5 + 近7全0
    if (f12 === 0 && f24 <= 2 && f36 <= 5 && f7 === 0) {
      states[num] = { status: S.HOT_TO_COLD_SOFT_OBSERVE, observeRemaining: O.HOT_TO_COLD_SOFT };
      return;
    }
  },

  // ========== 4.2 冷号→热 ==========
  _updateCold: function(states, num, prev, f12, f24, f36, f7) {
    var S = BusinessV53Config.STATUS;
    var O = BusinessV53Config.OBSERVE_PERIODS;

    // 观察期内：若开出则撤销跳过
    if (this._isObserving(prev.status)) {
      if (f7 > 0) {
        states[num] = { status: S.NORMAL_COLD, observeRemaining: 0 };
        return;
      }
      var remaining = prev.observeRemaining - 1;
      if (remaining <= 0) {
        states[num] = { status: S.NORMAL_HOT, observeRemaining: 0 };
      } else {
        states[num] = { status: prev.status, observeRemaining: remaining };
      }
      return;
    }

    // 回归：冷号满足条件则回冷池
    if (prev.status !== S.NORMAL_COLD) {
      if (f12 === 0 && f24 <= 2 && f36 <= 4) {
        states[num] = { status: S.NORMAL_COLD, observeRemaining: 0 };
      }
      return;
    }

    // 硬跳过：近12≥3次（进入降权/顶峰区）
    if (f12 >= 3 && prev.status === S.NORMAL_COLD) {
      states[num] = { status: S.COLD_TO_HOT_HARD_OBSERVE, observeRemaining: O.COLD_TO_HOT_HARD };
      return;
    }

    // 软跳过：近12=2 + 近24≥4 + 近36≥6
    if (f12 === 2 && f24 >= 4 && f36 >= 6) {
      states[num] = { status: S.COLD_TO_HOT_SOFT_OBSERVE, observeRemaining: O.COLD_TO_HOT_SOFT };
      return;
    }
  },

  // ========== 辅助方法 ==========
  _isObserving: function(status) {
    return status === BusinessV53Config.STATUS.HOT_TO_COLD_HARD_OBSERVE ||
           status === BusinessV53Config.STATUS.HOT_TO_COLD_SOFT_OBSERVE ||
           status === BusinessV53Config.STATUS.COLD_TO_HOT_HARD_OBSERVE ||
           status === BusinessV53Config.STATUS.COLD_TO_HOT_SOFT_OBSERVE;
  },

  _countInWindow: function(zodiacHistory, num, windowSize) {
    var recent = zodiacHistory.slice(-windowSize);
    var c = 0;
    recent.forEach(function(p) { if (p.indexOf(num) !== -1) c++; });
    return c;
  },

  /**
   * 获取有效热池（动态身份后）
   */
  getEffectiveHotPool: function(states) {
    var S = BusinessV53Config.STATUS;
    var hot = [];
    for (var n = 1; n <= 12; n++) {
      var s = states[n];
      if (!s) continue;
      if (s.status === S.NORMAL_HOT ||
          s.status === S.COLD_TO_HOT_HARD_OBSERVE ||
          s.status === S.COLD_TO_HOT_SOFT_OBSERVE) {
        hot.push(n);
      }
    }
    return hot;
  },

  /**
   * 获取有效冷池（动态身份后）
   */
  getEffectiveColdPool: function(states) {
    var S = BusinessV53Config.STATUS;
    var cold = [];
    for (var n = 1; n <= 12; n++) {
      var s = states[n];
      if (!s) continue;
      if (s.status === S.NORMAL_COLD ||
          s.status === S.HOT_TO_COLD_HARD_OBSERVE ||
          s.status === S.HOT_TO_COLD_SOFT_OBSERVE) {
        cold.push(n);
      }
    }
    return cold;
  }
};