const BusinessGiong = {

  // NUM_TO_ZODIAC / ZODIAC_TO_NUM 已迁移到 CONFIG（2026-06-09 重构）
  NUM_TO_ZODIAC: CONFIG.NUM_TO_ZODIAC,
  ZODIAC_TO_NUM: (function() {
    var map = {};
    Object.keys(CONFIG.NUM_TO_ZODIAC).forEach(function(num) {
      map[CONFIG.NUM_TO_ZODIAC[num]] = Number(num);
    });
    return map;
  })(),

  init: function() {
    // 已由 IIFE 在加载时构建，无需重复执行
  },

  OLD_CHAIN: [1, 5, 7, 9, 4],
  NEW_CHAIN: [1, 4, 5, 7, 9],

  ATTACH_MAP: {
    10: 4
  },

  COLD_NUMS: [2, 3, 8, 10, 11],

  SUCCEED_MAP: {
    1: [5, 6, 12, 9],
    5: [7],
    7: [1, 6],
    9: [4],
    6: [1, 7],
    12: [5],
    4: [1]
  },

  PIVOT_NUM: 6,
  PIVOT_TARGETS: [1, 7],

  COLD_FOUR_ZONES: [2, 8, 11, 12],

  WINDOW_12: 12,
  WINDOW_11: 11,
  WINDOW_24: 24,

  DOWN_WEIGHT_THRESHOLD: 3,
  RELEASE_THRESHOLD: 2,

  HIGH_CONGESTION_LIMIT: 3,
  HIGH_CONGESTION_COUNT: 3,

  _toZodiac: function(num) {
    return this.NUM_TO_ZODIAC[num] || '';
  },

  _toNum: function(zodiac) {
    return this.ZODIAC_TO_NUM[zodiac] || 0;
  },

  historyDataToNumArray: function(historyData) {
    var result = [];
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var zodArr = Utils.parseZodiacArr(item);
      var zod = zodArr[6] || '';
      var num = this._toNum(zod);
      if (num) {
        result.push(num);
      }
    }
    return result;
  },

  countFreqInWindow: function(numArray, windowSize) {
    var freq = {};
    for (var n = 1; n <= 12; n++) freq[n] = 0;
    var window = numArray.slice(0, Math.min(windowSize, numArray.length));
    window.forEach(function(num) {
      if (num >= 1 && num <= 12) freq[num]++;
    });
    return freq;
  },

  getNextInChain: function(current, chain) {
    var idx = chain.indexOf(current);
    if (idx === -1) return chain[0];
    return chain[(idx + 1) % chain.length];
  },

  getChainPosition: function(num, chain) {
    return chain.indexOf(num);
  },

  getPeriods: function(numArray) {
    var c12 = this.countFreqInWindow(numArray, this.WINDOW_12);
    var c11 = this.countFreqInWindow(numArray, this.WINDOW_11);
    var c24 = this.countFreqInWindow(numArray, this.WINDOW_24);
    return { c12: c12, c11: c11, c24: c24 };
  },

  calcDownWeightBlackList: function(numArray) {
    var periods = this.getPeriods(numArray);
    var blackList = [];

    for (var num = 1; num <= 12; num++) {
      var f12 = periods.c12[num] || 0;
      var f11 = periods.c11[num] || 0;

      if (f12 >= this.DOWN_WEIGHT_THRESHOLD && f11 > this.RELEASE_THRESHOLD) {
        blackList.push(num);
      }
    }

    return { blackList: blackList, periods: periods };
  },

  checkHighCongestion: function(periods) {
    var c12 = periods.c12;
    var congestionNums = [];
    for (var num = 1; num <= 12; num++) {
      if ((c12[num] || 0) >= this.HIGH_CONGESTION_LIMIT) {
        congestionNums.push(num);
      }
    }
    return congestionNums.length > this.HIGH_CONGESTION_COUNT;
  },

  checkPivotActive: function(numArray) {
    var pivot = this.PIVOT_NUM;
    var c12 = this.countFreqInWindow(numArray, this.WINDOW_12);
    var c24 = this.countFreqInWindow(numArray, this.WINDOW_24);

    var f12 = c12[pivot] || 0;
    var f24 = c24[pivot] || 0;

    return f12 >= 2 || f24 >= 3;
  },

  checkColdInChain: function(numArray, chain) {
    var self = this;
    var c12 = this.countFreqInWindow(numArray, this.WINDOW_12);

    var coldNums = [];
    chain.forEach(function(num) {
      if ((c12[num] || 0) <= 1) {
        coldNums.push(num);
      }
    });

    return coldNums;
  },

  calcNodeHeat: function(num, periods) {
    var f12 = periods.c12[num] || 0;
    var f24 = periods.c24[num] || 0;

    if (f12 >= 3) return { level: 'hot', label: '热号' };
    if (f12 === 2) return { level: 'warm', label: '温号' };
    if (f12 === 1) return { level: 'cool', label: '冷号' };
    if (f12 === 0 && f24 >= 1) return { level: 'deep', label: '深冷' };
    return { level: 'freeze', label: '冻结' };
  },

  calcOldChainRecommend: function(numArray, latestNum, blResult) {
    var blackList = blResult.blackList;
    var periods = blResult.periods;
    var chain = this.OLD_CHAIN;

    var priorityList = [];
    var succeedList = this.SUCCEED_MAP[latestNum] || [];

    succeedList.forEach(function(num) {
      if (this.COLD_NUMS.indexOf(num) === -1 && blackList.indexOf(num) === -1) {
        var isHot = (periods.c12[num] || 0) > 1;
        var priority = isHot ? 1 : 2;
        priorityList.push({ num: num, priority: priority });
      }
    }.bind(this));

    if (priorityList.length === 0 || latestNum === 1) {
      var chainNext = [];
      var idx = this.getChainPosition(latestNum, chain);
      if (idx !== -1) {
        for (var i = 1; i <= 3; i++) {
          chainNext.push(chain[(idx + i) % chain.length]);
        }
      } else {
        chainNext = chain.slice(0, 3);
      }

      chainNext.forEach(function(num) {
        if (!priorityList.some(function(p) { return p.num === num; })) {
          if (this.COLD_NUMS.indexOf(num) === -1 && blackList.indexOf(num) === -1) {
            var isHot = (periods.c12[num] || 0) > 1;
            priorityList.push({ num: num, priority: isHot ? 1 : 2 });
          }
        }
      }.bind(this));
    }

    if (!priorityList.some(function(p) { return p.num === 5; }) &&
        blackList.indexOf(5) === -1 && this.COLD_NUMS.indexOf(5) === -1) {
      priorityList.push({ num: 5, priority: 1 });
    }

    if (!priorityList.some(function(p) { return p.num === 7; }) &&
        blackList.indexOf(7) === -1 && this.COLD_NUMS.indexOf(7) === -1) {
      priorityList.push({ num: 7, priority: 1 });
    }

    if (!priorityList.some(function(p) { return p.num === 6; }) &&
        blackList.indexOf(6) === -1 && this.COLD_NUMS.indexOf(6) === -1) {
      priorityList.push({ num: 6, priority: 2 });
    }

    priorityList.sort(function(a, b) { return a.priority - b.priority; });

    var main = [];
    var backup = [];

    priorityList.forEach(function(p) {
      if (main.length < 4) {
        if (main.indexOf(p.num) === -1) {
          main.push(p.num);
        }
      } else {
        if (backup.indexOf(p.num) === -1) {
          backup.push(p.num);
        }
      }
    });

    while (main.length < 4) {
      for (var n = 1; n <= 12; n++) {
        if (main.indexOf(n) === -1 && backup.indexOf(n) === -1 &&
            blackList.indexOf(n) === -1 && this.COLD_NUMS.indexOf(n) === -1) {
          main.push(n);
          break;
        }
      }
      if (main.length >= 4) break;
      var bNum = backup.shift();
      if (bNum !== undefined) main.push(bNum);
      else break;
    }

    main = main.slice(0, 4);

    var oldBackup = [9, 4].filter(function(n) {
      return main.indexOf(n) === -1 && blackList.indexOf(n) === -1;
    });
    if (oldBackup.length === 0) {
      oldBackup = [6, 12].filter(function(n) {
        return main.indexOf(n) === -1 && blackList.indexOf(n) === -1;
      });
    }

    return {
      main: main,
      backup: oldBackup.slice(0, 2),
      chainName: '旧版经典链',
      chainDesc: '01→05→07→09→04→01',
      style: 'conservative'
    };
  },

  calcNewChainRecommend: function(numArray, latestNum, blResult) {
    var blackList = blResult.blackList;
    var periods = blResult.periods;
    var self = this;
    var chain = this.NEW_CHAIN;

    var isCongestion = this.checkHighCongestion(periods);
    var pivotActive = this.checkPivotActive(numArray);
    var coldInChain = this.checkColdInChain(numArray, chain);

    var priorityList = [];

    if (latestNum === 1 && (periods.c12[4] || 0) >= 2) {
      priorityList.push({ num: 4, reason: '正统修复位·蓄力核心', priority: 1 });
    }
    if (latestNum === 1) {
      priorityList.push({ num: 5, reason: '当下热流位', priority: 2 });
    }

    var idx = this.getChainPosition(latestNum, chain);
    if (idx !== -1) {
      for (var i = 1; i <= 4; i++) {
        var nextIdx = (idx + i) % chain.length;
        var num = chain[nextIdx];
        if (!priorityList.some(function(p) { return p.num === num; })) {
          priorityList.push({ num: num, reason: '链内顺位', priority: priorityList.length + 1 });
        }
      }
    }

    chain.forEach(function(num) {
      if (!priorityList.some(function(p) { return p.num === num; })) {
        priorityList.push({ num: num, reason: '链内补位', priority: priorityList.length + 1 });
      }
    });

    if (pivotActive && priorityList.every(function(p) { return p.num !== self.PIVOT_NUM; })) {
      priorityList.push({ num: self.PIVOT_NUM, reason: '变盘核心·热度达标', priority: 3 });
    }

    if (latestNum === 10 && priorityList.every(function(p) { return p.num !== 4; })) {
      priorityList.push({ num: 4, reason: '10挂靠04回补', priority: 2 });
    }

    priorityList = priorityList.filter(function(p) {
      return blackList.indexOf(p.num) === -1;
    });

    priorityList = priorityList.filter(function(p) {
      return self.COLD_FOUR_ZONES.indexOf(p.num) === -1;
    });

    if (isCongestion) {
      priorityList = priorityList.filter(function(p) {
        if ((periods.c12[p.num] || 0) === 2) {
          var f11 = periods.c11[p.num] || 0;
          return f11 <= self.RELEASE_THRESHOLD;
        }
        return true;
      });
    }

    var main = [];
    var backup = [];

    priorityList.sort(function(a, b) { return a.priority - b.priority; });

    priorityList.forEach(function(p) {
      if (main.length < 4) {
        main.push(p.num);
      } else {
        backup.push(p.num);
      }
    });

    if (main.length < 4) {
      for (var n = 1; n <= 12 && main.length < 4; n++) {
        if (main.indexOf(n) === -1 && blackList.indexOf(n) === -1 && self.COLD_FOUR_ZONES.indexOf(n) === -1) {
          main.push(n);
        }
      }
    }

    var newBackup = [10, 9].filter(function(n) {
      return main.indexOf(n) === -1 && blackList.indexOf(n) === -1;
    });
    if (newBackup.length === 0) {
      var piv = self.PIVOT_NUM;
      if (main.indexOf(piv) === -1 && blackList.indexOf(piv) === -1) {
        newBackup.push(piv);
      }
    }

    return {
      main: main.slice(0, 4),
      backup: newBackup.slice(0, 2),
      chainName: '新版实测链',
      chainDesc: '01→04→05→07→09→01',
      style: 'aggressive'
    };
  },

  calcMergedRecommend: function(oldResult, newResult, periods, blackList) {
    var oldMain = oldResult.main || [];
    var newMain = newResult.main || [];
    var oldBackup = oldResult.backup || [];
    var newBackup = newResult.backup || [];

    var intersection = [];
    oldMain.forEach(function(n) {
      if (newMain.indexOf(n) !== -1) {
        intersection.push(n);
      }
    });

    var priorityList = [];
    var added = {};
    intersection.forEach(function(n) {
      if (blackList.indexOf(n) === -1) {
        priorityList.push({ num: n, priority: 0, reason: '双链交集' });
        added[n] = true;
      }
    });

    if (newMain.length > 0) {
      newMain.forEach(function(n) {
        if (!added[n] && blackList.indexOf(n) === -1) {
          priorityList.push({ num: n, priority: 1, reason: '新版高顺位' });
          added[n] = true;
        }
      });
    }

    if (oldMain.length > 0) {
      oldMain.forEach(function(n) {
        if (!added[n] && blackList.indexOf(n) === -1) {
          priorityList.push({ num: n, priority: 2, reason: '旧版高顺位' });
          added[n] = true;
        }
      });
    }

    if (!added[6] && blackList.indexOf(6) === -1) {
      priorityList.push({ num: 6, priority: 3, reason: '变盘兜底' });
    }

    priorityList.sort(function(a, b) { return a.priority - b.priority; });

    var main = [];
    var backup = [];

    priorityList.forEach(function(p) {
      var isCold = (periods.c12[p.num] || 0) <= 1;
      if (main.length < 4 && !isCold) {
        main.push(p.num);
      } else {
        backup.push(p.num);
      }
    });

    if (main.length < 4) {
      priorityList.forEach(function(p) {
        if (main.indexOf(p.num) === -1) {
          main.push(p.num);
        }
      });
    }

    while (main.length < 4) {
      for (var n = 1; n <= 12 && main.length < 4; n++) {
        if (main.indexOf(n) === -1 && blackList.indexOf(n) === -1) {
          main.push(n);
        }
      }
      break;
    }

    main = main.slice(0, 4);

    if (backup.length === 0) {
      var backupCandidates = [];
      oldBackup.forEach(function(n) { if (backupCandidates.indexOf(n) === -1) backupCandidates.push(n); });
      newBackup.forEach(function(n) { if (backupCandidates.indexOf(n) === -1) backupCandidates.push(n); });
      backupCandidates.push(10);
      backupCandidates.forEach(function(n) {
        if (main.indexOf(n) === -1 && blackList.indexOf(n) === -1 && backup.indexOf(n) === -1) {
          backup.push(n);
        }
      });
    }

    return {
      main: main,
      backup: backup.slice(0, 2),
      chainName: '双链融合推荐',
      chainDesc: '交集优先 + 顺位互补',
      style: 'merged'
    };
  },

  generateFullResult: function(numArray) {
    if (!numArray || !Array.isArray(numArray)) {
      return { insufficient: true, message: '无效输入：数据必须是数组' };
    }

    if (numArray.length < 12) {
      return { insufficient: true, message: '数据不足，需至少12期历史数据' };
    }

    var validation = Utils.Validator.validateNumber(numArray[0]);
    if (!validation.valid || numArray[0] < 1 || numArray[0] > 12) {
      return { insufficient: true, message: '无效的起始号码（必须在1-12之间）' };
    }

    var latestNum = numArray[0];
    var blResult = this.calcDownWeightBlackList(numArray);
    var periods = blResult.periods;

    var oldResult = this.calcOldChainRecommend(numArray, latestNum, blResult);
    var newResult = this.calcNewChainRecommend(numArray, latestNum, blResult);
    var mergedResult = this.calcMergedRecommend(oldResult, newResult, periods, blResult.blackList);

    var heatMap = {};
    for (var num = 1; num <= 12; num++) {
      var h = this.calcNodeHeat(num, periods);
      heatMap[num] = {
        count: periods.c12[num] || 0,
        count24: periods.c24[num] || 0,
        level: h.level,
        label: h.label,
        isDownWeight: blResult.blackList.indexOf(num) !== -1,
        isColdZone: this.COLD_FOUR_ZONES.indexOf(num) !== -1
      };
    }

    return {
      insufficient: false,
      latestNum: latestNum,
      latestZodiac: this._toZodiac(latestNum),
      oldResult: oldResult,
      newResult: newResult,
      mergedResult: mergedResult,
      downWeightList: blResult.blackList,
      heatMap: heatMap,
      isCongestion: this.checkHighCongestion(periods),
      pivotActive: this.checkPivotActive(numArray)
    };
  },

  formatResultForDisplay: function(result) {
    var self = this;
    if (result.insufficient) return result;

    return {
      insufficient: false,
      latestNum: result.latestNum,
      latestZodiac: result.latestZodiac,
      oldResult: {
        main: result.oldResult.main.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        backup: result.oldResult.backup.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        chainName: result.oldResult.chainName,
        chainDesc: result.oldResult.chainDesc,
        style: result.oldResult.style
      },
      newResult: {
        main: result.newResult.main.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        backup: result.newResult.backup.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        chainName: result.newResult.chainName,
        chainDesc: result.newResult.chainDesc,
        style: result.newResult.style
      },
      mergedResult: result.mergedResult ? {
        main: result.mergedResult.main.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        backup: result.mergedResult.backup.map(function(n) {
          return { num: n, zodiac: self._toZodiac(n) };
        }),
        chainName: result.mergedResult.chainName,
        chainDesc: result.mergedResult.chainDesc,
        style: result.mergedResult.style
      } : null,
      downWeightList: result.downWeightList.map(function(n) {
        return { num: n, zodiac: self._toZodiac(n) };
      }),
      heatMap: result.heatMap,
      isCongestion: result.isCongestion,
      pivotActive: result.pivotActive
    };
  }
};

BusinessGiong.init();