/**
 * 业务层：TongJi 标签页统计
 * @namespace ZodiacTongJi
 * 包含：
 *   - calcZodiacTongJiStats : 12 生肖出现次数/概率/平均间隔/最大间隔/最小间隔/当前遗漏
 *   - calcNumLevelStats    : 1-49 号码的"冷热等级"分布（热/温/冷/极冷）
 *
 * 调用方向：被 Business.switchZodiacTab('tongji') 触发，
 *           计算结果交给 ViewZodiacTongJi 渲染
 *
 * 拆分原则（只新增不破坏）：
 * - 复用 Utils.SpecialCalculator.getSpecial 提取特码生肖
 * - 复用 Utils.calcMiss 计算当前遗漏
 * - 不直接操作任何 DOM（业务层禁止）
 */
const ZodiacTongJi = {

  /**
   * 计算 12 生肖 TongJi 统计
   * @param {Array} historyData - 历史数据数组（按 expect 倒序，index 0 为最新）
   * @returns {Object|null} 统计结果
   *   {
   *     total: Number,            // 总期数
   *     totalAppearances: Number,// 12 生肖合计出现次数（通常 = total）
   *     rows: [
   *       { zodiac, count, percent, avgInterval, maxInterval, minInterval, currentMiss }
   *     ]
   *   }
   */
  calcZodiacTongJiStats: function(historyData) {
    if (!historyData || !historyData.length) return null;

    var zodiacList = (typeof CONFIG !== 'undefined' && CONFIG.ANALYSIS && CONFIG.ANALYSIS.ZODIAC_ALL) ||
      ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

    var total = historyData.length;
    var latestExpect = Number(historyData[0] && historyData[0].expect || 0);

    // 1) 收集每个生肖的所有出现位置（index 0 为最新，index 越大越旧）
    var appearancesMap = {};
    zodiacList.forEach(function(z) { appearancesMap[z] = []; });

    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var s = Utils.SpecialCalculator.getSpecial(item);
      if (s && s.zod && appearancesMap[s.zod]) {
        appearancesMap[s.zod].push(i);
      }
    }

    // 2) 逐个生肖计算指标
    var rows = zodiacList.map(function(z) {
      var positions = appearancesMap[z]; // 数组：[最新 idx, ..., 最旧 idx]
      var count = positions.length;

      // 出现概率 = 出现次数 / 总期数
      var percent = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

      // 间隔数组：相邻两次出现的 idx 差（差越大代表间隔越大）
      // 由于 historyData 是倒序的，idx 差 = "距下次出现的期数 = 间隔"
      var intervals = [];
      for (var j = 1; j < positions.length; j++) {
        intervals.push(positions[j] - positions[j - 1]);
      }

      // 距离最新一次出现的期数 = 0（因为最新一次出现在 historyData[0]，即 idx=0）
      // 但 spec 要求"当前遗漏 = 距离最新一次出现已经多少期没开"
      // 由于历史是倒序的，positions[0] === 0 表示最新一期就开了（遗漏 0）
      // positions[k] 之后到 positions[k-1] 之间相隔 positions[k-1] - positions[k] - 1 期没开
      // 当前遗漏：以最新一期为基准，0
      var currentMiss = 0;
      if (count > 0) {
        currentMiss = positions[0]; // 即距离"最新一次出现"到当前已开过多少期
      } else {
        // 从未出现 → 视为遗漏 = 总期数
        currentMiss = total;
      }

      var avgInterval = 0, maxInterval = 0, minInterval = 0;
      if (intervals.length > 0) {
        var sum = 0;
        var mx = -Infinity, mn = Infinity;
        for (var k = 0; k < intervals.length; k++) {
          sum += intervals[k];
          if (intervals[k] > mx) mx = intervals[k];
          if (intervals[k] < mn) mn = intervals[k];
        }
        avgInterval = Math.round((sum / intervals.length) * 10) / 10;
        maxInterval = mx;
        minInterval = mn;
      } else if (count === 1) {
        // 只出现 1 次：平均/最大/最小间隔 = 0
        avgInterval = 0;
        maxInterval = 0;
        minInterval = 0;
      } else {
        // 0 次出现
        avgInterval = 0;
        maxInterval = 0;
        minInterval = 0;
      }

      return {
        zodiac: z,
        count: count,
        percent: percent,
        avgInterval: avgInterval,
        maxInterval: maxInterval,
        minInterval: minInterval,
        currentMiss: currentMiss
      };
    });

    var totalAppearances = 0;
    rows.forEach(function(r) { totalAppearances += r.count; });

    return {
      total: total,
      totalAppearances: totalAppearances,
      rows: rows
    };
  },

  /**
   * 计算 1-49 号码的"冷热等级"分布
   * 等级阈值（基于"当前遗漏期数"，即距上次出现的期数）：
   *   - 极热  (0-15)   : 0 ≤ miss ≤ 15
   *   - 热号  (16-25)  : 16 ≤ miss ≤ 25
   *   - 温号  (26-35)  : 26 ≤ miss ≤ 35
   *   - 温冷  (36-49)  : 36 ≤ miss ≤ 49
   *   - 冷号  (50-99)  : 50 ≤ miss ≤ 99
   *   - 极冷(≥100)    : miss ≥ 100
   *
   * 备注：
   *   - miss=0 表示"最近一期刚开出"，理应归属"最热"区间；
   *     用户原话"极热：1-15"以 1 为起点是描述遗漏≥1 的范围，
   *     实际业务把 0 也归入极热（与"最近一期刚开=最热"语义一致），
   *     不会丢数据。
   *
   * @param {Array} historyData - 历史数据数组（按 expect 倒序）
   * @returns {Object|null} 统计结果
   *   {
   *     total: Number,    // 号码总数（49）
   *     levels: [
   *       { key, name, emoji, color, rangeText, count, percent, nums: [Number] }
   *     ],
   *     totalMiss: Number, // 所有号码当前遗漏总和
   *   }
   */
  calcNumLevelStats: function(historyData) {
    if (!historyData || !historyData.length) return null;

    var total = historyData.length;

    // 1) 收集每个号码的最近一次出现位置（idx 越小越新）
    //    latestIdxMap[num] = 第一次出现的 idx（即最新一次出现）
    var latestIdxMap = {};
    for (var n = 1; n <= 49; n++) latestIdxMap[n] = -1;

    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var s = Utils.SpecialCalculator.getSpecial(item);
      var te = s && s.te;
      if (te && te >= 1 && te <= 49 && latestIdxMap[te] === -1) {
        latestIdxMap[te] = i; // 第一次遍历到即最新一次
      }
    }

    // 2) 计算每个号码的当前遗漏
    //    倒序数据中：idx=0 即最近一期开出
    //    - 若 latestIdxMap[num] === 0 → 当前遗漏 0
    //    - 若 latestIdxMap[num] === k → 当前遗漏 k
    //    - 若 latestIdxMap[num] === -1 → 当前遗漏 total（从未出现，按总期数计）
    var missMap = {};
    for (var n2 = 1; n2 <= 49; n2++) {
      var idx = latestIdxMap[n2];
      missMap[n2] = idx === -1 ? total : idx;
    }

    // 3) 等级配置（仅新增；不修改 CONFIG）
    //    2026-06-24 用户需求更新：6 等级（极热 / 热号 / 温号 / 温冷 / 冷号 / 极冷）
    //    颜色按"温度"递进：红 → 橙 → 黄 → 青 → 蓝 → 紫
    var levelConfigs = [
      { key: 'superhot', name: '极热',   emoji: '🔴', range: [0, 15] },
      { key: 'hot',      name: '热号',   emoji: '🟠', range: [16, 25] },
      { key: 'warm',     name: '温号',   emoji: '🟡', range: [26, 35] },
      { key: 'cool',     name: '温冷',   emoji: '🟢', range: [36, 49] },
      { key: 'cold',     name: '冷号',   emoji: '🔵', range: [50, 99] },
      { key: 'deep',     name: '极冷',   emoji: '🟣', range: [100, Infinity] }
    ];

    // 4) 分组
    var levels = levelConfigs.map(function(cfg) {
      var nums = [];
      for (var num = 1; num <= 49; num++) {
        var miss = missMap[num];
        if (miss >= cfg.range[0] && miss <= cfg.range[1]) {
          nums.push(num);
        }
      }
      // 排序（2026-06-25 用户需求：按"开出顺序"展示，最新期开出的号码排前面）
      //   - latestIdxMap[num] 越小表示越新（idx=0 = 最新一期）
      //   - 从未开出的号码 latestIdxMap[num] === -1，排在最后
      nums.sort(function(a, b) {
        var ia = latestIdxMap[a];
        var ib = latestIdxMap[b];
        // 未开出的（-1）排到末尾
        if (ia === -1 && ib === -1) return a - b;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      var count = nums.length;
      var percent = count > 0 ? Math.round((count / 49) * 1000) / 10 : 0;

      var rangeText;
      if (cfg.range[1] === Infinity) {
        rangeText = cfg.range[0] + '+';
      } else {
        rangeText = cfg.range[0] + '-' + cfg.range[1];
      }

      return {
        key: cfg.key,
        name: cfg.name,
        emoji: cfg.emoji,
        rangeText: rangeText,
        count: count,
        percent: percent,
        nums: nums
      };
    });

    var totalMiss = 0;
    for (var n3 = 1; n3 <= 49; n3++) totalMiss += missMap[n3];

    return {
      total: 49,
      historyLength: total,
      levels: levels,
      totalMiss: totalMiss
    };
  },

  /**
   * 计算每期"特码开出前的等级位置"分布（2026-06-24 用户需求）
   *
   * 业务说明：
   *   - 对 historyData 中每一期，看该期特码 te 在"它开出之前"遗漏了多少期，
   *     再按 calcNumLevelStats 同样的 6 等级阈值，定位到该期特码在"开出前"
   *     所属的等级区间。
   *   - 倒序数据中 historyData[0] = 最新一期，idx 越大越旧。
   *   - 对 historyData[i] 期特码 te：
   *       * 找 te 在 i 之后（更旧）最近一次出现的位置 p（p > i 且最小）
   *       * miss = p - i - 1
   *         - p = i+1 → miss=0（紧挨着上一期刚开，归"极热"）
   *         - p = i+20 → miss=19（隔了 19 期没开）
   *       * 若 p 不存在（te 在 i 之后从未出现，即 i 是 te 出现过的最早位置
   *         或 te 只在 i 出现过一次），miss = total - i - 1
   *   - 例：2026174 期特码 41，在 2026174 期之前 41 已有约 19 期没开，
   *     miss=19 → 按 6 等级归入"热号"（16-25）。
   *
   * @param {Array} historyData - 历史数据数组（按 expect 倒序，index 0 最新）
   * @returns {Object|null}
   *   {
   *     total: Number,         // 参与统计的期数（≈ historyLength）
   *     historyLength: Number, // 入参总期数
   *     levels: [             // 按等级分组的统计
   *       {
   *         key, name, emoji,                 // 等级标识
   *         count, percent,                   // 该等级次数 / 占比
   *         avgMiss: Number,                  // 该等级在"开出前"的平均遗漏
   *         records: [                        // 该等级下的明细（按期数倒序）
   *           { expect, num, miss, level, levelName, levelEmoji }
   *         ]
   *       }
   *     ],
   *     records: [...]         // 全量明细（按期数倒序：index 0 为最新一期）
   *   }
   */
  calcPreDrawLevelHistory: function(historyData) {
    if (!historyData || historyData.length < 2) return null;

    // 1) 复用 calcNumLevelStats 的同一套 6 等级阈值
    //    单独定义，避免修改 CONFIG；与 calcNumLevelStats 保持完全一致
    var levelConfigs = [
      { key: 'superhot', name: '极热', emoji: '🔴', range: [0, 15] },
      { key: 'hot',      name: '热号', emoji: '🟠', range: [16, 25] },
      { key: 'warm',     name: '温号', emoji: '🟡', range: [26, 35] },
      { key: 'cool',     name: '温冷', emoji: '🟢', range: [36, 49] },
      { key: 'cold',     name: '冷号', emoji: '🔵', range: [50, 99] },
      { key: 'deep',     name: '极冷', emoji: '🟣', range: [100, Infinity] }
    ];

    // 工具：按 miss 找等级
    function findLevelByMiss(miss) {
      for (var li = 0; li < levelConfigs.length; li++) {
        var cfg = levelConfigs[li];
        if (miss >= cfg.range[0] && miss <= cfg.range[1]) return cfg;
      }
      return null;
    }

    var total = historyData.length;

    // 2) 收集每个号码的所有出现位置（升序）
    //    positionMap[num] = [idx0, idx1, ...]（idx 越小越旧）
    var positionMap = {};
    for (var n = 1; n <= 49; n++) positionMap[n] = [];
    for (var i = 0; i < total; i++) {
      var item = historyData[i];
      var s = Utils.SpecialCalculator.getSpecial(item);
      var te = s && s.te;
      if (te && te >= 1 && te <= 49) positionMap[te].push(i);
    }
    for (var n2 = 1; n2 <= 49; n2++) {
      positionMap[n2].sort(function(a, b) { return a - b; });
    }

    // 3) 遍历每一期，计算"该期特码在开出前的遗漏"
    //    - 找 p = min{ positions[k] | positions[k] > i }  （i 之后最近一次出现）
    //    - miss = p - i - 1
    //    - 若 p 不存在（i 是该号码出现过的最早位置，或之后没出现过）：
    //        miss = total - i - 1
    var records = [];
    for (var i3 = 0; i3 < total; i3++) {
      var item3 = historyData[i3];
      var s3 = Utils.SpecialCalculator.getSpecial(item3);
      var te3 = s3 && s3.te;
      if (!te3 || te3 < 1 || te3 > 49) continue;

      var positions = positionMap[te3];
      var p = -1;
      for (var k = 0; k < positions.length; k++) {
        if (positions[k] > i3) {
          p = positions[k];
          break;
        }
      }
      var miss = p === -1 ? (total - i3 - 1) : (p - i3 - 1);

      var lv = findLevelByMiss(miss);
      records.push({
        expect: item3.expect,
        num: te3,
        miss: miss,
        level: lv ? lv.key : 'unknown',
        levelName: lv ? lv.name : '未知',
        levelEmoji: lv ? lv.emoji : '❓'
      });
    }

    // 4) 按等级分组统计
    var levelStats = levelConfigs.map(function(cfg) {
      var matched = [];
      var sumMiss = 0;
      for (var ri = 0; ri < records.length; ri++) {
        if (records[ri].level === cfg.key) {
          matched.push(records[ri]);
          sumMiss += records[ri].miss;
        }
      }
      var avgMiss = matched.length > 0
        ? Math.round((sumMiss / matched.length) * 10) / 10
        : 0;
      return {
        key: cfg.key,
        name: cfg.name,
        emoji: cfg.emoji,
        count: matched.length,
        percent: records.length > 0
          ? Math.round((matched.length / records.length) * 1000) / 10
          : 0,
        avgMiss: avgMiss,
        records: matched
      };
    });

    return {
      total: records.length,
      historyLength: total,
      levels: levelStats,
      records: records
    };
  }
};

// =====================================================
// 排序状态与纯函数（2026-06-20 用户需求：表头点击升序降序）
//   - 状态：_sort / _stats 仅作为"渲染上下文缓存"，
//     由业务主文件 initTongJiTab 写入，
//     由 toggleZodiacTongjiSort 读取并触发视图重渲染。
//   - 纯函数：sortZodiacRows(rows, key, dir) 不修改入参。
// =====================================================

// 排序状态
ZodiacTongJi._sort = { key: null, dir: 'asc' };

// 最近一次统计结果（initTongJiTab 写入，toggleSort 重渲染时读取）
ZodiacTongJi._stats = null;

// 设置 stats（业务主文件调用）
//   - 2026-06-20 修复：用 this 写入，避免 Object.assign 后两对象引用不同步
ZodiacTongJi.setStats = function(stats) {
  this._stats = stats;
};

// 获取当前 sort
ZodiacTongJi.getSort = function() {
  return this._sort;
};

// 纯函数：按 key/dir 排序，不修改原数组
ZodiacTongJi.sortZodiacRows = function(rows, key, dir) {
  if (!rows || !rows.length || !key) return rows;
  var copy = rows.slice();
  var sign = dir === 'desc' ? -1 : 1;
  copy.sort(function(a, b) {
    var av = a[key];
    var bv = b[key];
    if (av === bv) return 0;
    if (typeof av === 'string') {
      return sign * (av < bv ? -1 : 1);
    }
    return sign * (av - bv);
  });
  return copy;
};

// 计算新排序方向：
//   - 第一次点击该 key：asc
//   - 再次点击：toggle 为 desc
//   - 第三次点击：取消排序（恢复默认 / null）
//   - 2026-06-20 修复：用 this 读 _sort
ZodiacTongJi.computeNextSort = function(key) {
  var cur = this._sort;
  if (cur.key !== key) {
    return { key: key, dir: 'asc' };
  }
  if (cur.dir === 'asc') {
    return { key: key, dir: 'desc' };
  }
  return { key: null, dir: 'asc' };
};

// 兼容路径：若已有门面对象则挂载
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacTongJi);
}
