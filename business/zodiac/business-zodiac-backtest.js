/**
 * 业务层：生肖通用回测 + 综合未推荐（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionBacktest
 * 包含：
 *   - _runGenericBacktest
 *   - runSizeBacktest / runOddEvenBacktest / runWuxingBacktest / runColorBacktest
 *   - calcUnrecommendedZodiacs
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部使用 `Utils.SpecialCalculator.getSpecial / ZODIAC_ORDER / getZodiacEmoji` 引用门面上的共享数据/工具
 */
const ZodiacPredictionBacktest = {
  /**
   * 2026-08-18 新增（私有）：按"新到旧首次出现顺序"采样 Top 6 跟随尾数
   * 算法：扫历史（不含当前期），每遇到一个 tail===currentTail 的位置，
   *       取"下一期实际尾数"，按出现次数累加；
   *       遇到累计出现第 6 个"不同尾数"即停止采样（避免被远期重复出现的尾数拉满）
   * 排序：Top6 按"新到旧"首次出现顺序排列（用户最新需求：如 2026228 期尾数 3 → 9 8 7 1 6）
   *
   * 2026-08-18 调整：不再限定 36 期窗口；
   *   Top6 排序由"频次降序"改为"新到旧首次出现顺序"（用户反馈数据不符，期望 9 8 7 1 6）
   *
   * @param {Array} historyData - 倒序历史数据（[0] 最新；要求严格在该期"之前"的窗口）
   * @param {number} currentTail - 关注的尾数 0-9
   * @returns {Object|null} { top6:[尾数字符串], sampleCount, countsByTail:{0:N,...}, scannedPeriods }
   *                        采样不足或没有匹配位置时返回 null
   */
  _calcTop5ByOccurrenceOrder: function(historyData, currentTail) {
    if (!historyData || historyData.length < 2) return null;
    const tail = Number(currentTail);
    if (isNaN(tail) || tail < 0 || tail > 9) return null;

    // 窗口：historyData[1..]（严格限定在「当前期」之前，不含 index 0）
    const windowData = historyData.slice(1);
    if (windowData.length < 2) return null;

    const TOP_N = 6;

    // 第一遍：扫描累加（historyData 倒序：windowData[0] 较新；windowData[i-1] = "下一期"（更新））
    const countsByTail = {};
    const seenSet = {};
    const order = []; // 记录"新到旧"首次出现顺序（先出现的尾数排前面）
    let sampleCount = 0;
    let scannedPeriods = 0; // 实际扫了多少个"出现 currentTail 的位置"

    // 注意：windowData 倒序存放（index 0 最新）。windowData[i] 的"下一期"（更新）是 windowData[i-1]，
    //   而非 windowData[i+1]（那是更旧的一期）。故从 i=1 开始扫，取 windowData[i-1] 作为"下一期"。
    for (let i = 1; i < windowData.length; i++) {
      const curSpecial = Utils.SpecialCalculator.getSpecial(windowData[i]);
      if (Number(curSpecial.tail) !== tail) continue;
      scannedPeriods++;
      const nextSpecial = Utils.SpecialCalculator.getSpecial(windowData[i - 1]);
      const nextTail = Number(nextSpecial.tail);
      if (nextTail < 0 || nextTail > 9) continue;

      const isFirstAppearance = !(nextTail in seenSet);
      countsByTail[nextTail] = (countsByTail[nextTail] || 0) + 1;
      sampleCount++;
      if (isFirstAppearance) {
        seenSet[nextTail] = true;
        order.push(nextTail); // 记录首次出现顺序（新到旧）
      }
      // 满足 6 个不同尾数即停止采样
      if (Object.keys(seenSet).length >= TOP_N) break;
    }

    if (sampleCount === 0) return null;

    // 输出 Top 6：按"新到旧"首次出现顺序排列（用户最新需求）
    const top5 = order.slice(0, TOP_N).map(function(t) { return String(t); });

    return {
      top5: top5,
      sampleCount: sampleCount,
      countsByTail: countsByTail,
      scannedPeriods: scannedPeriods
    };
  },

  _runGenericBacktest: function(historyData, testCount, config) {
    if (!historyData || historyData.length < 10) return null;

    testCount = Math.min(testCount || 24, 24);
    const results = [];
    const maxOffset = Math.min(testCount, historyData.length - 6);

    // v2.6.6 性能优化：一次性预计算 specials 数组，传给所有回调
    // 避免每期对同一 item 重复调用 getSpecial（最多 5 次 → 1 次）
    // 节省约 80% 的 special 计算开销（即使有 LRU 缓存命中仍有 Map 查找成本）
    // 注意：若调用方已传入同名参数（如集成测试场景），复用之；否则全新计算
    const specials = historyData.map(function (item) {
      return Utils.SpecialCalculator.getSpecial(item);
    });

    // 2026-06-21 新增：与实际推荐算法一致模式
    //   - 当 config 提供 trendPredictor + buildSequence 时，启用"模拟当时推荐"路径：
    //     用 targetItem 之前 10 期构造 sequence，调 config.trendPredictor 计算预测值
    //   - 这样回测追踪每期的"预测" = 当时实际推荐算法的预测，确保回测与实际推荐一致
    const useTrendPredictor = !!config.trendPredictor && typeof config.buildSequence === 'function';

    // 2026-08-15 新增：与综合分析面板底部展示对齐 — 五行 Top 3 推荐
    //   - 当 config 提供 top3Predictor 时，每期输出 predictedTop3 = [wx1, wx2, wx3]
    //   - 命中判定改为「实际值 ∈ top3」（即 Top 3 内即算命中）
    //   - 若 config 同时提供 trendPredictor，则 top3Predictor 优先；trendPredictor 仅作兼容
    const useTop3Predictor = !!config.top3Predictor && typeof config.buildSequence === 'function';

    // 2026-08-15 新增：与综合分析面板底部展示对齐 — 波色 Top 2 推荐（3选2）
    //   - 当 config 提供 top2Predictor 时，每期输出 predictedTop2 = [c1, c2]
    //   - 命中判定改为「实际值 ∈ top2」（即 Top 2 内即算命中）
    //   - 优先级：top3Predictor > top2Predictor > trendPredictor > 原算法
    const useTop2Predictor = !!config.top2Predictor && typeof config.buildSequence === 'function';

    for (let offset = 0; offset < maxOffset; offset++) {
      const targetItem = historyData[offset];
      if (!targetItem) continue;

      let predictedValue = '-';
      let predictedTop3 = null;
      let predictedTop2 = null;
      let confidence = 45;

      if (useTop3Predictor) {
        // 2026-08-15 新增：Top3 推荐路径（仅五行）
        // v2.6.6 性能优化：传入预计算的 specials 数组，buildSequence 内部可避免重复 getSpecial
        const trendSequence = config.buildSequence(historyData, offset, specials);
        if (!trendSequence || trendSequence.length < 5) continue;
        const top3Result = config.top3Predictor(trendSequence);
        predictedTop3 = (top3Result || []).map(function(t) { return t.wuxing || t.prediction || t; }).filter(Boolean).slice(0, 3);
        if (!predictedTop3.length) continue;
        predictedValue = predictedTop3[0];
        confidence = (top3Result[0] && top3Result[0].confidence) || 45;
      } else if (useTop2Predictor) {
        // 2026-08-15 新增：Top2 推荐路径（仅波色，3选2）
        // v2.6.6 性能优化：传入 specials
        const trendSequence = config.buildSequence(historyData, offset, specials);
        if (!trendSequence || trendSequence.length < 5) continue;
        const top2Result = config.top2Predictor(trendSequence);
        predictedTop2 = (top2Result || []).map(function(t) { return t.color || t.prediction || t; }).filter(Boolean).slice(0, 2);
        if (!predictedTop2.length) continue;
        predictedValue = predictedTop2[0];
        confidence = (top2Result[0] && top2Result[0].confidence) || 45;
      } else if (useTrendPredictor) {
        // 新增路径：用实际推荐算法（_predictXxxTrend）+ 当时 10 期数据
        // v2.6.6 性能优化：传入 specials
        const trendSequence = config.buildSequence(historyData, offset, specials);
        if (!trendSequence || trendSequence.length < 5) continue;
        const trendResult = config.trendPredictor(trendSequence);
        predictedValue = trendResult.prediction;
        confidence = trendResult.confidence || 45;
      } else {
        // 原算法路径（完全保留，未做任何修改）
        const recentData = historyData.slice(offset + 1, offset + 7);
        if (recentData.length < 5) continue;

        const lastValues = [];
        for (let i = 0; i < Math.min(5, recentData.length); i++) {
          // v2.6.6 性能优化：传入预计算的 special（offset+1+i 对应 specials[offset+1+i]）
          const idx = offset + 1 + i;
          const val = config.extractValue(recentData[i], specials[idx]);
          if (config.categories.indexOf(val) !== -1) {
            lastValues.push(val);
          } else {
            lastValues.push(config.categories[0]);
          }
        }

        if (lastValues.length >= 3) {
          const scores = {};
          config.categories.forEach(function(cat) { scores[cat] = 0; });

          const last3 = lastValues.slice(0, 3);
          const allSame3 = last3.every(function(v) { return v === last3[0]; });

          if (allSame3) {
            const others = config.categories.filter(function(c) { return c !== last3[0]; });
            others.forEach(function(c) { scores[c] += config.weights.consecutive; });
          } else if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
            scores[last3[0]] += config.weights.alternate;
          }

          const valueCount = {};
          lastValues.forEach(function(v) { valueCount[v] = (valueCount[v] || 0) + 1; });

          Object.keys(valueCount).forEach(function(val) {
            if (valueCount[val] >= 3) {
              const bonus = (valueCount[val] - 2) * 8;
              const otherVals = config.categories.filter(function(c) { return c !== val; });
              otherVals.forEach(function(c) { scores[c] += Math.max(5, bonus); });
            }
          });

          if (lastValues.length >= 4 && lastValues[2] === last3[0]) {
            scores[last3[0]] += config.weights.repeat;
          }

          if (last3[0] === last3[1]) {
            scores[last3[0]] += config.weights.inertia;
          }

          if (config.weights.statistical && config.categories.length === 2) {
            const firstRatio = (valueCount[lastValues[0]] || 0) / lastValues.length;
            if (firstRatio > 0.4 && firstRatio < 0.6) {
              if (firstRatio > 0.5) {
                scores[lastValues[0]] += config.weights.statistical;
              } else {
                const otherCat = config.categories.find(function(c) { return c !== lastValues[0]; });
                if (otherCat) scores[otherCat] += config.weights.statistical;
              }
            }
          }

          let maxScore = -1;
          let bestValue = '-';
          Object.keys(scores).forEach(function(val) {
            if (scores[val] > maxScore) {
              maxScore = scores[val];
              bestValue = val;
            }
          });

          if (maxScore > 0) {
            predictedValue = bestValue;
            confidence = Math.min(config.maxConfidence !== undefined ? config.maxConfidence : 72, (config.baseConfidence !== undefined ? config.baseConfidence : 42) + Math.round((maxScore / 50) * (config.confidenceRange !== undefined ? config.confidenceRange : 28)));
          } else {
            predictedValue = lastValues[0];
            confidence = config.fallbackConfidence !== undefined ? config.fallbackConfidence : 40;
          }
        }
      }

      if (predictedValue === '-') continue;

      let actualValue = config.extractValue(targetItem, specials[offset]);
      if (!actualValue) actualValue = config.categories[0];

      // 2026-08-15：Top3/Top2 命中判定 — 实际值在 Top 内即算命中
      const isHit = predictedTop3
        ? predictedTop3.indexOf(actualValue) !== -1
        : (predictedTop2
          ? predictedTop2.indexOf(actualValue) !== -1
          : predictedValue === actualValue);
      const resultItem = {
        expect: targetItem.expect,
        // v2.6.6 性能优化：传入预计算的 special
        actualNumber: config.getNumber(targetItem, specials[offset]),
        confidence: confidence,
        isHit: isHit
      };

      resultItem[config.fieldNames.predicted || 'predictedValue'] = predictedValue;
      resultItem[config.fieldNames.actual || 'actualValue'] = actualValue;
      // 2026-08-15 新增：Top3 推荐列表（仅五行回测输出）
      if (predictedTop3) {
        const top3Field = (config.fieldNames.predicted || 'predictedValue') + 'Top3';
        resultItem[top3Field] = predictedTop3;
      }
      // 2026-08-15 新增：Top2 推荐列表（仅波色回测输出）
      if (predictedTop2) {
        const top2Field = (config.fieldNames.predicted || 'predictedValue') + 'Top2';
        resultItem[top2Field] = predictedTop2;
      }

      results.push(resultItem);
    }

    if (!results.length) return null;

    const hitCount = results.filter(function(r) { return r.isHit; }).length;
    const hitRate = Math.round((hitCount / results.length) * 100);

    const recentResults = results.slice(0, 24);
    const recentHitCount = recentResults.filter(function(r) { return r.isHit; }).length;
    const recentHitRate = recentResults.length > 0 ? Math.round((recentHitCount / recentResults.length) * 100) : 0;

    let currentStreak = 0;
    for (let j = 0; j < recentResults.length; j++) {
      if (recentResults[j].isHit) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      recentTests: recentResults.length,
      recentHits: recentHitCount,
      recentHitRate: recentHitRate,
      currentStreak: currentStreak,
      details: recentResults
    };
  },

  runSizeBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['大', '小'],
      extractValue: function(item, special) {
        // v2.6.6：优先用预计算的 special（无则回退调用 getSpecial，保持向后兼容）
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1] ? '大' : '小';
      },
      getNumber: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te;
      },
      fieldNames: { predicted: 'predictedSize', actual: 'actualSize' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictSizeTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictSizeTrend(sequence);
      },
      buildSequence: function(historyData, offset, specials) {
        // v2.6.6：specials 已预计算，slice 取对应范围
        const slice = historyData.slice(offset + 1, offset + 11);
        const offsetBase = offset + 1;
        return slice.map(function(item, i) {
          const special = specials ? specials[offsetBase + i] : Utils.SpecialCalculator.getSpecial(item);
          const isBig = special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1];
          return {
            expect: item.expect,
            number: special.te,
            size: isBig ? '大' : '小'
          };
        });
      }
    });
  },

  runOddEvenBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['单', '双'],
      extractValue: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te % 2 !== 0 ? '单' : '双';
      },
      getNumber: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te;
      },
      fieldNames: { predicted: 'predictedType', actual: 'actualType' },
      weights: {
        consecutive: 35,
        alternate: 25,
        repeat: 15,
        inertia: 10,
        statistical: 12
      },
      maxConfidence: 72,
      baseConfidence: 48,
      confidenceRange: 24,
      fallbackConfidence: 45,
      // 2026-06-21 新增：与实际推荐算法一致（_predictOddEvenTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictOddEvenTrend(sequence);
      },
      buildSequence: function(historyData, offset, specials) {
        const slice = historyData.slice(offset + 1, offset + 11);
        const offsetBase = offset + 1;
        return slice.map(function(item, i) {
          const special = specials ? specials[offsetBase + i] : Utils.SpecialCalculator.getSpecial(item);
          return {
            expect: item.expect,
            number: special.te,
            type: special.te % 2 !== 0 ? '单' : '双'
          };
        });
      }
    });
  },

  runWuxingBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['金', '木', '水', '火', '土'],
      extractValue: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.wuxing || '金';
      },
      getNumber: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te;
      },
      fieldNames: { predicted: 'predictedWuxing', actual: 'actualWuxing' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictWuxingTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictWuxingTrend(sequence);
      },
      // 2026-08-15 新增：五行 Top 3 推荐（与综合分析面板底部展示一致）
      top3Predictor: function(sequence) {
        return ZodiacPrediction._predictWuxingTrendTop3(sequence);
      },
      // 2026-08-15 优化：使用80期窗口（与getLatestWuxingStats中predictSequence一致）构建转移矩阵
      buildSequence: function(historyData, offset, specials) {
        const WUXING_WINDOW = 80;
        const end = Math.min(offset + 1 + WUXING_WINDOW, historyData.length);
        const slice = historyData.slice(offset + 1, end);
        const offsetBase = offset + 1;
        return slice.map(function(item, i) {
          const special = specials ? specials[offsetBase + i] : Utils.SpecialCalculator.getSpecial(item);
          return {
            expect: item.expect,
            number: special.te,
            wuxing: special.wuxing || '金'
          };
        });
      }
    });
  },

  runColorBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['红', '蓝', '绿'],
      extractValue: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        let colorName = special.colorName || '红';
        if (!['红', '蓝', '绿'].includes(colorName)) colorName = '红';
        return colorName;
      },
      getNumber: function(item, special) {
        if (!special) special = Utils.SpecialCalculator.getSpecial(item);
        return special.te;
      },
      fieldNames: { predicted: 'predictedColor', actual: 'actualColor' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictColorTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictColorTrend(sequence);
      },
      // 2026-08-15 新增：波色 Top 2 推荐（与综合分析面板底部展示一致）
      top2Predictor: function(sequence) {
        return ZodiacPrediction._predictColorTrendTop2(sequence);
      },
      buildSequence: function(historyData, offset, specials) {
        const slice = historyData.slice(offset + 1, offset + 11);
        const offsetBase = offset + 1;
        return slice.map(function(item, i) {
          const special = specials ? specials[offsetBase + i] : Utils.SpecialCalculator.getSpecial(item);
          let colorName = special.colorName || '红';
          if (!['红', '蓝', '绿'].includes(colorName)) colorName = '红';
          return {
            expect: item.expect,
            number: special.te,
            color: colorName
          };
        });
      }
    });
  },

  /**
   * 2026-08-18 新增：尾数跟随 Top 6 推荐回测（自实现，不复用 _runGenericBacktest）
   *
   * 两种模式：
   *   ① 不传 currentTail（默认）：对每期 offset 取其特码尾数 latestTail，
   *      在过去 36 期窗口里找 tail===latestTail 的位置 → 统计"下一期尾数"Top6 → 判定 actualTail∈Top6
   *   ② 传入 currentTail（按尾数过滤）：不限期数扫历史，所有 tail===currentTail 的位置都纳入 details；
   *      Top 6 = 按"新到旧"首次出现顺序累加，直到累计出 6 个不同尾数即停止；
   *      命中判定 = 下一期实际尾数 ∈ Top 6
   * 输出结构与 _runGenericBacktest 完全一致，可被 ViewCommon.showBacktestModal 直接消费
   *
   * @param {Array} historyData - 历史数据（[0] 最新）
   * @param {number} testCount - 回测期数（默认 36，仅模式①使用）
   * @param {number} [currentTail] - 限定尾数；传入后走模式②
   */
  runTailBacktest: function(historyData, testCount, currentTail) {
    // ============ 模式 ②：按 currentTail 回测（仅该尾数相关的过往出现位置）============
    if (currentTail !== undefined && currentTail !== null && currentTail !== '' && !isNaN(currentTail)) {
      const tail = Number(currentTail);
      if (tail < 0 || tail > 9) return null;
      if (!historyData || historyData.length < 3) return null; // 至少 2 期窗口 + 1 当前

      // 2026-08-18 变更：Top 6 推荐改为"按出现顺序累加采样"（不限期数，累计出 6 个不同尾数即停止）
      //   - 与 getLatestTailFollowStats（按完整分布 Top 6）不同
      //   - 排序固定按"新到旧"的首次出现顺序（先达到的尾数排前面）
      //   - 优势：样本更具"近期代表性"，避免被远期重复出现的尾数拉满统计
      const top5Result = ZodiacPrediction._calcTop5ByOccurrenceOrder(historyData, tail);
      if (!top5Result || top5Result.top5.length === 0) return null;
      const top5 = top5Result.top5;
      const sampleCount = top5Result.sampleCount;

      // 窗口：historyData[1..]（不限期数，扫到所有"出现 currentTail 的位置"）
      const windowData = historyData.slice(1);
      if (windowData.length < 2) return null;

      // 扫窗口：每个 tail===currentTail 的位置，记录"下一期实际尾数"
      const results = [];
      // 注意：historyData 倒序存放，windowData[0] 较新，windowData[i+1] 较旧（"下一期"）
      for (let i = 0; i < windowData.length - 1; i++) {
        const curSpecial = Utils.SpecialCalculator.getSpecial(windowData[i]);
        if (Number(curSpecial.tail) !== tail) continue;
        const nextItem = windowData[i + 1];
        const nextSpecial = Utils.SpecialCalculator.getSpecial(nextItem);
        const nextTail = Number(nextSpecial.tail);
        if (nextTail < 0 || nextTail > 9) continue;
        const isHit = top5.indexOf(String(nextTail)) !== -1;
        // 置信度：该 nextTail 在采样中的占比（粗略指示预测强度）
        const nextTailCount = top5Result.countsByTail[nextTail] || 0;
        const confidence = sampleCount > 0 ? Math.round(nextTailCount / sampleCount * 100) : 40;
        results.push({
          // 2026-08-18 调整：expect 显示「被验证期（nextExpect）」+ 配套 triggerExpect
          //   业务逻辑：每条对应"在 triggerExpect 出现 currentTail → 验证 nextExpect 期是否在 Top6"
          //   弹窗期号列显示 nextExpect（被验证期）——与用户口述"2026229期..."对齐
          //   但为了避免 historyData 跳号导致的"乱跳"，sort 仍按"被验证期（nextExpect）"降序
          //   （nextExpect 与 triggerExpect 同属连续相邻期，跳号模式一致，视觉仍然稳定）
          expect: Number(nextItem.expect || 0),
          actualNumber: nextSpecial.te,
          confidence: confidence,
          isHit: isHit,
          predictedTail: top5[0],
          actualTail: String(nextTail),
          predictedTailTop5: top5,
          // 配套字段：上一期（即"出现 currentTail"的位点期号），便于追溯因果链
          triggerExpect: Number(windowData[i].expect || 0),
          nextExpect: Number(nextItem.expect || 0)
        });
      }

      if (!results.length) return null;

      // 按 expect（被验证期 = nextExpect）降序排序，保证"新到旧"严格递减
      //   nextExpect 与 triggerExpect 是连续相邻期，跳号模式一致，视觉仍然稳定
      results.sort(function(a, b) { return b.expect - a.expect; });

      const hitCount = results.filter(function(r) { return r.isHit; }).length;
      const hitRate = Math.round((hitCount / results.length) * 100);
      // 2026-08-18 变更：明细列表不再限 36 期，显示所有出现 currentTail 的位置
      const recentResults = results;
      const recentHitCount = recentResults.filter(function(r) { return r.isHit; }).length;
      const recentHitRate = recentResults.length > 0 ? Math.round((recentHitCount / recentResults.length) * 100) : 0;

      let currentStreak = 0;
      for (let j = 0; j < recentResults.length; j++) {
        if (recentResults[j].isHit) currentStreak++;
        else break;
      }

      return {
        totalTests: results.length,
        totalHits: hitCount,
        totalHitRate: hitRate,
        recentTests: recentResults.length,
        recentHits: recentHitCount,
        recentHitRate: recentHitRate,
        currentStreak: currentStreak,
        details: recentResults,
        currentTail: tail,
        sampleSize: sampleCount,
        scannedPeriods: top5Result.scannedPeriods
      };
    }

    // ============ 模式 ①：每期跑全量 Top6 推荐回测（与模式② 算法规格统一）============
    //   2026-08-18 调整：
    //     - 不再限定过去 36 期窗口；改为不限期数（实际依赖历史深度）
    //     - 复用 _calcTop5ByOccurrenceOrder：每期取当期特码尾数 → 在该期之前的历史里凑足 6 个不同尾数即停
    //     - Top6 按频次降序排列
    //     - 命中判定 = 该期实际特码尾数 ∈ Top6
    //     - 每条记录 expect = nextExpect（被验证期 = 下一期）—— 与用户口述"每期 top6 → 下一期核对"对齐
    if (!historyData || !historyData.length) return null;

    const results = [];

    // 从 index 1 开始扫（index 0 是"最新一期"，没有"下一期"，跳过）
    for (let offset = 1; offset < historyData.length; offset++) {
      // 当前期：historyData[offset] = "上一期"（即用户口中的"2026228 期"）
      const targetItem = historyData[offset];
      // 下一期：historyData[offset-1] = 更新的那一期（"2026229 期"）
      const nextItem = historyData[offset - 1];
      if (!targetItem || !nextItem) continue;

      const targetSpecial = Utils.SpecialCalculator.getSpecial(targetItem);
      const latestTail = Number(targetSpecial.tail);
      if (latestTail < 0 || latestTail > 9) continue;

      // 复用 _calcTop5ByOccurrenceOrder：扫"当前期之前的历史"
      //   注意：_calcTop5ByOccurrenceOrder 内部会 slice(1) 去掉传入数据的 index 0（视为"当前期"）
      //   因此这里传入 historyData.slice(offset)（含当前期 targetItem 作为 index 0），
      //   函数内部去掉当前期后，恰好得到"当前期之前"（2026227期及更早）的正确数据范围
      const beforeHistory = historyData.slice(offset);
      const top5Result = ZodiacPrediction._calcTop5ByOccurrenceOrder(beforeHistory, latestTail);
      if (!top5Result || top5Result.top5.length === 0) continue;
      const top5 = top5Result.top5;

      // 命中判定：下一期实际特码尾数（actualTail）是否在 Top6 中
      const nextSpecial = Utils.SpecialCalculator.getSpecial(nextItem);
      const actualTail = Number(nextSpecial.tail);
      if (actualTail < 0 || actualTail > 9) continue;
      const isHit = top5.indexOf(String(actualTail)) !== -1;
      const sampleCount = top5Result.sampleCount;
      const nextTailCount = top5Result.countsByTail[String(actualTail)] || 0;
      const confidence = sampleCount > 0 ? Math.round(nextTailCount / sampleCount * 100) : 40;

      results.push({
        // 2026-08-18 调整：expect 显示「被验证期」（= 下一期，即 nextItem）
        //   与用户口述"每期 top6 → 下一期特码尾数核对"完全对齐
        expect: Number(nextItem.expect || 0),
        actualNumber: nextSpecial.te,
        confidence: confidence,
        isHit: isHit,
        predictedTail: top5[0],
        actualTail: String(actualTail),
        predictedTailTop5: top5,
        // 配套字段：上一期（即"出现 currentTail / 用于算 Top6"的位点期号）
        triggerExpect: Number(targetItem.expect || 0),
        nextExpect: Number(nextItem.expect || 0)
      });
    }

    if (!results.length) return null;

    // 按 expect（被验证期 = nextExpect）降序排序，保证"新到旧"严格递减
    //   nextExpect 与 triggerExpect 是连续相邻期，跳号模式一致，视觉稳定
    results.sort(function(a, b) { return b.expect - a.expect; });

    const hitCount = results.filter(function(r) { return r.isHit; }).length;
    const hitRate = Math.round((hitCount / results.length) * 100);

    const recentResults = results;
    const recentHitCount = recentResults.filter(function(r) { return r.isHit; }).length;
    const recentHitRate = recentResults.length > 0 ? Math.round((recentHitCount / recentResults.length) * 100) : 0;

    let currentStreak = 0;
    for (let j = 0; j < recentResults.length; j++) {
      if (recentResults[j].isHit) currentStreak++;
      else break;
    }

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      recentTests: recentResults.length,
      recentHits: recentHitCount,
      recentHitRate: recentHitRate,
      currentStreak: currentStreak,
      details: recentResults
    };
  },

  /**
   * 精选特码 5 维算法号码回测（用于 #zodiacFinalNum 点击弹窗）
   * 算法：对每一期回测目标，模拟"在那一期时"用前 12 期窗口跑 5 维算法
   *       得出 top N 推荐号码，与实际特码对比判定命中。
   * @param {Array} historyData - 历史数据（[0] 最新，[1] 次新，…）
   * @param {number} testCount - 回测期数（默认 36，上限 50）
   * @param {number} [analyzeLimit] - 分析窗口期数（默认 12，与实时推荐一致）
   * @returns {Object|null} 回测汇总
   */
  runFinalZodiacBacktest: function(historyData, testCount, analyzeLimit) {
    const windowSize = analyzeLimit || 12;
    if (!historyData || historyData.length < windowSize + 1) return null;
    // 修复 #6：testCount 上限改为 historyData.length - windowSize（保证至少 analyzeLimit 期窗口），
    //    同时上限不超过 50；UI 展示时直接读取 results.length，避免"显示 36 实际跑 11"
    testCount = Math.min(testCount || 36, 50, historyData.length - windowSize);
    if (testCount <= 0) return null;
    const results = [];

    // v2.5.0 性能优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    for (let offset = 0; offset < testCount; offset++) {
      const targetItem = historyData[offset];
      if (!targetItem) break;
      // 至少需要：analyzeLimit 期窗口 + 1 期目标
      if (historyData.length < offset + windowSize + 1) break;

      // 1. 模拟"在那一期"可用数据：historyData[offset+1..offset+windowSize] 共 windowSize 期
      const list = historyData.slice(offset + 1, offset + 1 + windowSize);

      // 2. 计算"上期生肖的常跟随生肖"（修复 #1：只能用 targetItem 之前的历史数据，
      //    避免前视偏差/数据穿越。原版 historyData.slice(offset + 2, offset + 14) 包含了
      //    targetItem 之后的未来期开奖结果，导致回测命中率被人为虚高）
      const latestItem = list[0];
      let latestZodiac = '';
      if (latestItem) {
        const zodArr = Utils.parseZodiacArr(latestItem);
        latestZodiac = zodArr[6] || '';
      }
      let followZodiacs = [];
      if (latestZodiac && offset > 0) {
        // 修复 #1：用 offset 之前的历史数据累计"上期 = latestZodiac → 下期 = ?"
        const followCount = {};
        for (let fi = 0; fi < offset; fi++) {
          const preS = allSpecials[fi];
          const curS = allSpecials[fi + 1];
          if (preS.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curS.zod)) {
            followCount[curS.zod] = (followCount[curS.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(followCount)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 3)
          .map(function(e) { return e[0]; });
      }
      // 2026-07-14 修复 #10：offset=0 时（最新一期回测，即"现在"对下期的预测），
      //    用全量 followMap 取 top 3，与精选特码 renderZodiacFinalNums 完全一致，
      //    确保弹窗顶部 🔮 下期预测 与未来该期进入回测后的号码一致
      else if (latestZodiac && offset === 0) {
        try {
          const _fullData = Business && Business.calcZodiacAnalysis
            ? Business.calcZodiacAnalysis()
            : null;
          const _fullFollowMap = _fullData && _fullData.followMap;
          const _fullFollow = _fullFollowMap && _fullFollowMap[latestZodiac];
          if (_fullFollow && typeof _fullFollow === 'object') {
            followZodiacs = Object.entries(_fullFollow)
              .sort(function(a, b) { return b[1] - a[1]; })
              .slice(0, 3)
              .map(function(e) { return e[0]; });
          }
        } catch (_e) { /* 计算失败走下面兜底 */ }
      }
      // 修复 #4：followZodiacs 为空时（如数据稀疏或首期回测 followMap 也为空），
      //    使用全部 12 生肖兜底，避免"W_FOLLOW 维度永远 0 分"造成命中率骤降
      if (!followZodiacs.length) {
        followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);
      }

      // 3. 调用 5 维核心算法得到 top 36 推荐号码（窗口 24 期，2026-07-14 调整）
      const recommend = Business._calcFinalZodiacRecommend(list, 36, followZodiacs, 24);
      const recommendedNums = recommend.numbers || [];
      // 获取候选号码的分数用于排序展示
      const candidateNums = recommend.candidateNums || [];

      // 4. 实际特码对比（按展示集合判定，下面展示什么这里就判什么）
      const actualSpecial = allSpecials[offset];
      const actualNum = actualSpecial.te || 0;

      // 5. 按得分排序推荐号码（得分高的在前）
      const sortedRecommendedNums = recommendedNums.map(function(num) {
        const candidate = candidateNums.find(function(c) { return c.num === num; });
        return { num: num, score: candidate ? candidate.score : 0 };
      }).sort(function(a, b) { return b.score - a.score || a.num - b.num; });

      // 方案 D：展示 36 个推荐号 = 算法选中前 5 名排除 + 剩余 31 个按分排序展示
      //    isHit 基于展示集合判定，所见即所判。
      const displayNums = sortedRecommendedNums.slice(5); // 后 31 名（未选中推荐）

      const displayNumValues = displayNums.map(function(item2) {
        return typeof item2 === 'object' ? item2.num : item2;
      });
      const isHit = displayNumValues.indexOf(actualNum) !== -1;

      results.push({
        expect: targetItem.expect,
        recommendedNums: displayNums,
        actualNumber: actualNum,
        actualZodiac: actualSpecial.zod || '-',
        isHit: isHit
      });
    }

    if (!results.length) return null;

    const hitCount = results.filter(function(r) { return r.isHit; }).length;
    const hitRate = Math.round((hitCount / results.length) * 100);
    const recentResults = results.slice(0, 36);
    const recentHits = recentResults.filter(function(r) { return r.isHit; }).length;
    const recentHitRate = recentResults.length > 0 ? Math.round((recentHits / recentResults.length) * 100) : 0;
    // 修复 #7：currentStreak 实际为"最近 N 期（含全部回测期）的连续命中次数"，
    //    而不是"某个特定号码的连续出现次数"。results[0] 为最新一期，从最新一期开始累计命中
    let currentStreak = 0;
    for (let i = 0; i < recentResults.length; i++) {
      if (recentResults[i].isHit) currentStreak++;
      else break;
    }

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      recentTests: recentResults.length,
      recentHits: recentHits,
      recentHitRate: recentHitRate,
      currentStreak: currentStreak,
      // 修复 #7：currentStreak 语义标注——连续命中期数（按时间从最新到最旧累计，首次未中即停）
      currentStreakNote: '从最新一期开始累计的连续命中期数',
      details: recentResults
    };
  },

  /**
   * 综合三个推荐源，计算未被推荐的所有生肖
   * @param {Array} v1List - v1 推荐列表 [{zodiac}, ...]
   * @param {Array} v2List - v2 推荐列表 [{zodiac}, ...]
   * @param {Array} ultimateList - 终极推荐列表 [{zodiac}, ...] (主推+备选)
   * @returns {Object} { v1, v2, ultimate, allRecommended: string[], unrecommended: [{zodiac, emoji}] }
   */
  calcUnrecommendedZodiacs: function(v1List, v2List, ultimateList) {
    const all = ZodiacPrediction.ZODIAC_ORDER;
    const sources = {
      v1: {},
      v2: {},
      ultimate: {}
    };

    // 记录各推荐源已推荐生肖
    function markSource(list, srcKey) {
      if (!list || !list.length) return;
      list.forEach(function(item) {
        const z = typeof item === 'string' ? item : item.zodiac;
        if (z && all.indexOf(z) !== -1) sources[srcKey][z] = true;
      });
    }
    markSource(v1List, 'v1');
    markSource(v2List, 'v2');
    markSource(ultimateList, 'ultimate');

    // 合并去重的所有已推荐生肖
    const allRecommended = [];
    all.forEach(function(z) {
      if (sources.v1[z] || sources.v2[z] || sources.ultimate[z]) {
        allRecommended.push(z);
      }
    });

    // 找未被任一源推荐的生肖
    const unrecommended = [];
    all.forEach(function(z) {
      if (!sources.v1[z] && !sources.v2[z] && !sources.ultimate[z]) {
        unrecommended.push({
          zodiac: z,
          emoji: ZodiacPrediction.getZodiacEmoji(z)
        });
      }
    });

    return {
      v1: Object.keys(sources.v1),
      v2: Object.keys(sources.v2),
      ultimate: Object.keys(sources.ultimate),
      allRecommended: allRecommended,
      unrecommended: unrecommended
    };
  },

  /**
   * 维度命中率诊断工具（2026-07-14 用户需求：为动态权重提供数据基础）
   * 对每个维度独立判定"若该维度的预测命中，则命中"，统计：
   *   1) 各维度单独命中率
   *   2) 多维度交集命中率（AND）
   *   3) 联合推荐集合的命中率（任一维度命中就算）
   * 输出结果到 console，方便人工调整权重。
   *
   * 用法（浏览器 console）：
   *   ZodiacPrediction.analyzeDimensionHitRates(StateManager._state.analysis.historyData, 36)
   *
   * @param {Array} historyData - 历史数据
   * @param {number} testCount - 回测期数（默认 36）
   * @returns {Object} 各维度命中率统计
   */
  analyzeDimensionHitRates: function(historyData, testCount, analyzeLimit) {
    const windowSize = analyzeLimit || 12;
    if (!historyData || historyData.length < windowSize + 1) return null;
    testCount = Math.min(testCount || 36, historyData.length - windowSize);
    if (testCount <= 0) return null;

    // v2.5.0 性能优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    // 7 个维度的命中计数
    const dimStats = {
      follow:   { hit: 0, total: 0, note: '跟随生肖（W=3）' },
      head:     { hit: 0, total: 0, note: '头数（W=2）' },
      tail:     { hit: 0, total: 0, note: '尾数（W=2）' },
      color:    { hit: 0, total: 0, note: '波色（W=1.5）' },
      wuxing:   { hit: 0, total: 0, note: '五行（W=1.5）' },
      neighbor: { hit: 0, total: 0, note: '邻号关联（候选新维度）' },
      inertia:  { hit: 0, total: 0, note: '特码惯性（候选新维度）' },
      miss:     { hit: 0, total: 0, note: '冷热加权（候选新维度）' }
    };

    // 各维度在本期的"预测号码集合"
    const dimSets = { follow: [], head: [], tail: [], color: [], wuxing: [], neighbor: [], inertia: [], miss: [] };

    const detailLog = []; // 逐期明细（用于 console 输出）

    for (let offset = 0; offset < testCount; offset++) {
      const targetItem = historyData[offset];
      if (!targetItem) break;
      if (historyData.length < offset + windowSize + 1) break;

      const list = historyData.slice(offset + 1, offset + 1 + windowSize);

      // 跟随生肖（复用回测逻辑：offset>0 用累计，offset=0 用全量）
      const latestItem = list[0];
      let latestZodiac = '';
      if (latestItem) {
        const zodArr = Utils.parseZodiacArr(latestItem);
        latestZodiac = zodArr[6] || '';
      }
      let followZodiacs = [];
      if (latestZodiac && offset > 0) {
        const fc = {};
        for (let fi = 0; fi < offset; fi++) {
          const ps = allSpecials[fi];
          const cs = allSpecials[fi + 1];
          if (ps.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(cs.zod)) {
            fc[cs.zod] = (fc[cs.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(fc).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
      } else if (latestZodiac && offset === 0) {
        try {
          const _fd = Business && Business.calcZodiacAnalysis ? Business.calcZodiacAnalysis() : null;
          const _ff = _fd && _fd.followMap && _fd.followMap[latestZodiac];
          if (_ff) followZodiacs = Object.entries(_ff).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
        } catch(_e){}
      }
      if (!followZodiacs.length) followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);

      // 头/尾/波色/五行 top（复用 _calcFinalZodiacRecommend 的统计逻辑）
      const DIAG_WINDOW = 24; // 2026-07-14 同步窗口为 24 期，与推荐算法保持一致
      const headCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      const tailCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
      const colorCount = { '红': 0, '蓝': 0, '绿': 0 };
      const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
      const missMap = {}; // 号码→遗漏期数
      let lastTe = null; // 上期特码
      const diagLimit = Math.min(DIAG_WINDOW, list.length);
      for (let di = 0; di < diagLimit; di++) {
        const s = allSpecials[offset + 1 + di];
        if (!s || !s.te || s.te < 1) continue;
        headCount[s.head] = (headCount[s.head] || 0) + 1;
        tailCount[s.tail] = (tailCount[s.tail] || 0) + 1;
        if (['红','蓝','绿'].includes(s.colorName)) colorCount[s.colorName] = (colorCount[s.colorName] || 0) + 1;
        if (['金','木','水','火','土'].includes(s.wuxing)) wuxingCount[s.wuxing] = (wuxingCount[s.wuxing] || 0) + 1;
        // 冷热统计：最近 N 期该号码出现 → miss=0；否则 miss++（简化：先累计出现，结尾统计）
        missMap[s.te] = 0;
      }
      if (latestItem) {
        const _lastSpec = allSpecials[offset + 1];
        if (_lastSpec && _lastSpec.te) lastTe = _lastSpec.te;
      }

      const topHeads = Object.entries(headCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return Number(e[0]);});
      const topTails = Object.entries(tailCount).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return Number(e[0]);});
      const topColors = Object.entries(colorCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return e[0];});
      const topWuxing = Object.entries(wuxingCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return e[0];});

      // 12 期窗口中每个号码的遗漏（未出现期数）
      for (let n = 1; n <= 49; n++) {
        missMap[n] = missMap[n] || 0;
        for (let k = 0; k < list.length; k++) {
          if (list[k].openCode && list[k].openCode.indexOf(',' + n + ',') >= 0) {
            missMap[n] = 0;
          } else if (list[k].openCode && (list[k].openCode.split(',')[0] === String(n))) {
            missMap[n] = 0;
          }
        }
      }

      // 实际特码
      const actualSpecial = allSpecials[offset];
      const actualNum = actualSpecial.te;

      // ---- 计算各维度的"预测号码集合" ----
      // 1) FOLLOW：生肖 = followZodiacs 的号码（用 12 期窗口投票的 numZodiacMap）
      const numZodiacMap = {};
      list.forEach(function(item){
        const ca = (item.openCode || '').split(',');
        const za = Utils.parseZodiacArr(item);
        ca.forEach(function(numStr, idx){
          const nv = Number(numStr);
          if (nv && za[idx]) {
            numZodiacMap[nv] = numZodiacMap[nv] || {};
            numZodiacMap[nv][za[idx]] = (numZodiacMap[nv][za[idx]] || 0) + 1;
          }
        });
      });
      const numZodiacFinal = {};
      Object.keys(numZodiacMap).forEach(function(numStr){
        const votes = numZodiacMap[numStr];
        numZodiacFinal[Number(numStr)] = Object.entries(votes).sort(function(a,b){return b[1]-a[1]})[0][0];
      });
      dimSets.follow = Object.keys(numZodiacFinal).filter(function(n){
        return followZodiacs.indexOf(numZodiacFinal[n]) >= 0;
      }).map(Number);

      // 2) HEAD
      dimSets.head = [];
      for (let h = 1; h <= 49; h++) if (topHeads.indexOf(Math.floor(h/10)) >= 0) dimSets.head.push(h);

      // 3) TAIL
      dimSets.tail = [];
      for (let t = 1; t <= 49; t++) if (topTails.indexOf(t % 10) >= 0) dimSets.tail.push(t);

      // 4) COLOR
      dimSets.color = [];
      for (let c1 = 1; c1 <= 49; c1++) if (topColors.indexOf(Utils.getColorName(c1)) >= 0) dimSets.color.push(c1);

      // 5) WUXING
      dimSets.wuxing = [];
      for (let w1 = 1; w1 <= 49; w1++) if (topWuxing.indexOf(Utils.getWuxing(w1)) >= 0) dimSets.wuxing.push(w1);

      // 6) NEIGHBOR：上期 7 个号码的邻号（±1），限制 1-49
      dimSets.neighbor = [];
      if (latestItem) {
        const prevArr = (latestItem.openCode || '').split(',');
        prevArr.forEach(function(numStr){
          const nv = Number(numStr);
          if (nv >= 1 && nv <= 49) {
            if (nv - 1 >= 1) dimSets.neighbor.push(nv - 1);
            if (nv + 1 <= 49) dimSets.neighbor.push(nv + 1);
          }
        });
        dimSets.neighbor = Array.from(new Set(dimSets.neighbor));
      }

      // 7) INERTIA：上期特码本身
      dimSets.inertia = lastTe ? [lastTe] : [];

      // 8) MISS：遗漏 ≥ 8 期的号码（12 期窗口中从没见过）
      dimSets.miss = [];
      for (let m = 1; m <= 49; m++) {
        let missVal = 0;
        for (let mk = 0; mk < list.length; mk++) {
          const codes = (list[mk].openCode || '').split(',').map(Number);
          if (codes.indexOf(m) >= 0) { missVal = 0; break; }
          missVal++;
        }
        if (missVal >= 8) dimSets.miss.push(m);
      }

      // ---- 统计各维度命中 ----
      const keys = Object.keys(dimStats);
      for (let dk = 0; dk < keys.length; dk++) {
        const k = keys[dk];
        dimStats[k].total++;
        if (dimSets[k].indexOf(actualNum) >= 0) dimStats[k].hit++;
      }

      detailLog.push({
        expect: targetItem.expect,
        actualNum: actualNum,
        sizes: {
          follow: dimSets.follow.length,
          head: dimSets.head.length,
          tail: dimSets.tail.length,
          color: dimSets.color.length,
          wuxing: dimSets.wuxing.length,
          neighbor: dimSets.neighbor.length,
          inertia: dimSets.inertia.length,
          miss: dimSets.miss.length
        }
      });
    }

    // 输出 console 报告
    const report = [];
    report.push('\n=== 📊 维度命中率诊断报告（基于最近 ' + testCount + ' 期回测）===');
    const totalK = Object.keys(dimStats);
    for (let i2 = 0; i2 < totalK.length; i2++) {
      const k = totalK[i2];
      const s = dimStats[k];
      const rate = s.total > 0 ? (s.hit / s.total * 100).toFixed(1) : 0;
      let avgSize = 0;
      for (let d = 0; d < detailLog.length; d++) avgSize += detailLog[d].sizes[k] || 0;
      avgSize = detailLog.length > 0 ? (avgSize / detailLog.length).toFixed(1) : 0;
      report.push('  ' + s.note.padEnd(28) + ' 命中=' + String(s.hit).padStart(3) + '/' + String(s.total).padStart(3) + ' = ' + rate + '%   平均集合大小=' + avgSize);
    }
    // 理论随机基线
    report.push('\n  --- 理论基线（纯随机命中 1 个号码）= ' + (100/49).toFixed(1) + '% ---');
    // 各维度相对增益
    report.push('\n  --- 相对增益（命中率 / 随机基线）---');
    const randomBase = 100/49;
    for (let i3 = 0; i3 < totalK.length; i3++) {
      const k3 = totalK[i3];
      const s3 = dimStats[k3];
      const rate3 = s3.total > 0 ? (s3.hit / s3.total * 100) : 0;
      const gain = (rate3 / randomBase).toFixed(2);
      report.push('  ' + s3.note.padEnd(28) + ' 增益=' + gain + 'x');
    }
    console.log(report.join('\n'));
    // v2.6.4 修复：移除业务层 document.title 写入（CLAUDE.md 红线：业务层禁止任何 DOM 操作）
    // 报告数据通过 return 的 stats / details 传递给调用方，由视图层决定展示方式

    return { stats: dimStats, details: detailLog };
  },

  /**
   * 未命中原因分析（v3.0 新增）
   *
   * 用法（浏览器 console）：
   *   ZodiacPrediction.analyzeMissReasons(StateManager._state.analysis.historyData, 36, 12)
   *
   * 对每期回测的未命中案例，分析实际号码在 8 个维度中的得分情况，
   * 找出"漏掉"的模式，帮助定位权重问题和维度盲区。
   *
   * @param {Array} historyData - 历史数据
   * @param {number} testCount - 回测期数（默认 36）
   * @param {number} [analyzeLimit] - 分析窗口期数（默认 12）
   * @returns {Object} 分析报告 { misses, dimStats, topMissReasons, summary }
   */
  analyzeMissReasons: function(historyData, testCount, analyzeLimit) {
    const windowSize = analyzeLimit || 12;
    if (!historyData || historyData.length < windowSize + 1) return null;

    testCount = Math.min(testCount || 36, 50, historyData.length - windowSize);
    if (testCount <= 0) return null;

    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    // 各维度在未命中时的"漏掉"计数
    const dimMissed = {
      follow:    { total: 0, missed: 0, note: '跟随生肖' },
      head:      { total: 0, missed: 0, note: '头数比例' },
      tail:      { total: 0, missed: 0, note: '尾数比例' },
      color:     { total: 0, missed: 0, note: '波色比例' },
      wuxing:    { total: 0, missed: 0, note: '五行比例' },
      neighbor:  { total: 0, missed: 0, note: '邻号关联' },
      inertia:   { total: 0, missed: 0, note: '特码惯性' },
      miss:      { total: 0, missed: 0, note: '冷热反弹' }
    };

    // 未命中详情
    const missDetails = [];
    let hitCount = 0;
    let totalCount = 0;

    // 维度得分累计（用于对比命中 vs 未命中）
    const hitDimSum = { follow: 0, head: 0, tail: 0, color: 0, wuxing: 0, neighbor: 0, inertia: 0, miss: 0 };
    const missDimSum = { follow: 0, head: 0, tail: 0, color: 0, wuxing: 0, neighbor: 0, inertia: 0, miss: 0 };
    for (let offset = 0; offset < testCount; offset++) {
      const targetItem = historyData[offset];
      if (!targetItem) break;
      if (historyData.length < offset + windowSize + 1) break;

      const list = historyData.slice(offset + 1, offset + 1 + windowSize);

      // 跟随生肖（复用回测逻辑）
      const latestItem = list[0];
      let latestZodiac = '';
      if (latestItem) {
        const zodArr = Utils.parseZodiacArr(latestItem);
        latestZodiac = zodArr[6] || '';
      }
      let followZodiacs = [];
      if (latestZodiac && offset > 0) {
        const fc = {};
        for (let fi = 0; fi < offset; fi++) {
          const ps = allSpecials[fi];
          const cs = allSpecials[fi + 1];
          if (ps.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(cs.zod)) {
            fc[cs.zod] = (fc[cs.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(fc).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
      } else if (latestZodiac && offset === 0) {
        try {
          const _fd = Business && Business.calcZodiacAnalysis ? Business.calcZodiacAnalysis() : null;
          const _ff = _fd && _fd.followMap && _fd.followMap[latestZodiac];
          if (_ff) followZodiacs = Object.entries(_ff).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
        } catch(_e){}
      }
      if (!followZodiacs.length) followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);

      // 调用核心算法
      const recommend = Business._calcFinalZodiacRecommend(list, 36, followZodiacs, 24);
      const candidateNums = recommend.candidateNums || [];

      // 实际特码
      const actualSpecial = allSpecials[offset];
      const actualNum = actualSpecial.te || 0;

      // 排序推荐号码
      const sortedNums = candidateNums.slice().sort(function(a, b) {
        return b.score - a.score || a.num - b.num;
      });

      // 找实际号码在候选列表中的排名和维度分解
      let actualCandidate = null;
      let actualRank = 0;
      for (let ci = 0; ci < sortedNums.length; ci++) {
        if (sortedNums[ci].num === actualNum) {
          actualCandidate = sortedNums[ci];
          actualRank = ci + 1;
          break;
        }
      }

      // 判断是否命中（展示集合中是否包含实际号码）
      const displayNums = sortedNums.slice(5);
      const displayNumValues = displayNums.map(function(item) { return item.num; });
      const isHit = displayNumValues.indexOf(actualNum) !== -1;

      totalCount++;

      if (isHit) {
        hitCount++;
        if (actualCandidate && actualCandidate.dims) {
          const hd = actualCandidate.dims;
          hitDimSum.follow += hd.follow || 0;
          hitDimSum.head += hd.head || 0;
          hitDimSum.tail += hd.tail || 0;
          hitDimSum.color += hd.color || 0;
          hitDimSum.wuxing += hd.wuxing || 0;
          hitDimSum.neighbor += hd.neighbor || 0;
          hitDimSum.inertia += hd.inertia || 0;
          hitDimSum.miss += hd.miss || 0;
        }
      } else {
        // 未命中：分析各维度
        if (actualCandidate && actualCandidate.dims) {
          const md = actualCandidate.dims;
          missDimSum.follow += md.follow || 0;
          missDimSum.head += md.head || 0;
          missDimSum.tail += md.tail || 0;
          missDimSum.color += md.color || 0;
          missDimSum.wuxing += md.wuxing || 0;
          missDimSum.neighbor += md.neighbor || 0;
          missDimSum.inertia += md.inertia || 0;
          missDimSum.miss += md.miss || 0;

          // 统计各维度是否"漏掉"（实际号码在该维度得分为 0）
          if ((md.follow || 0) === 0) dimMissed.follow.missed++;
          if ((md.head || 0) === 0) dimMissed.head.missed++;
          if ((md.tail || 0) === 0) dimMissed.tail.missed++;
          if ((md.color || 0) === 0) dimMissed.color.missed++;
          if ((md.wuxing || 0) === 0) dimMissed.wuxing.missed++;
          if ((md.neighbor || 0) === 0) dimMissed.neighbor.missed++;
          if ((md.inertia || 0) === 0) dimMissed.inertia.missed++;
          if ((md.miss || 0) === 0) dimMissed.miss.missed++;
        }

        missDetails.push({
          expect: targetItem.expect,
          actualNum: actualNum,
          actualZod: actualSpecial.zod || '-',
          actualHead: actualSpecial.head,
          actualTail: actualSpecial.tail,
          actualColor: actualSpecial.colorName,
          actualWuxing: actualSpecial.wuxing,
          score: actualCandidate ? actualCandidate.score : 0,
          rank: actualRank,
          dims: actualCandidate ? actualCandidate.dims : null
        });
      }
    }

    // 计算各维度总计数
    const missCount = missDetails.length;
    const dimKeys = ['follow', 'head', 'tail', 'color', 'wuxing', 'neighbor', 'inertia', 'miss'];
    dimKeys.forEach(function(k) { dimMissed[k].total = missCount; });

    // 命中率
    const hitRate = totalCount > 0 ? Math.round(hitCount / totalCount * 100) : 0;

    // ========== 输出 console 报告 ==========
    const report = [];
    report.push('');
    report.push('┌─────────────────────────────────────────────────────┐');
    report.push('│        📊 未命中原因分析报告 v3.0                   │');
    report.push('├─────────────────────────────────────────────────────┤');
    report.push('│ 总回测 ' + String(totalCount).padStart(3) + ' 期 | 命中 ' + String(hitCount).padStart(3) + ' 期 | 未命中 ' + String(missCount).padStart(3) + ' 期 | 命中率 ' + hitRate + '%');
    report.push('├─────────────────────────────────────────────────────┤');
    report.push('│                                                     │');
    report.push('│  📌 各维度平均得分对比（命中 vs 未命中）            │');
    report.push('│                                                     │');

    const dimLabels = {
      follow: '跟随生肖', head: '头数比例', tail: '尾数比例',
      color: '波色比例', wuxing: '五行比例', neighbor: '邻号关联',
      inertia: '特码惯性', miss: '冷热反弹'
    };

    dimKeys.forEach(function(k) {
      const hitAvg = hitCount > 0 ? (hitDimSum[k] / hitCount).toFixed(2) : '0.00';
      const missAvg = missCount > 0 ? (missDimSum[k] / missCount).toFixed(2) : '0.00';
      const diff = (parseFloat(hitAvg) - parseFloat(missAvg)).toFixed(2);
      const arrow = parseFloat(diff) > 0.1 ? '⬇差' : (parseFloat(diff) < -0.1 ? '⬆逆' : ' 平');
      report.push('│  ' + dimLabels[k].padEnd(12) + ' 命中均分=' + hitAvg + '  未中均分=' + missAvg + '  差异=' + diff + ' ' + arrow);
    });

    report.push('│                                                     │');
    report.push('│  📌 各维度"漏掉"率（实际号码在该维度得分为 0 的比例）│');
    report.push('│                                                     │');

    // 按漏掉率排序
    const missedSorted = dimKeys.slice().sort(function(a, b) {
      return (dimMissed[b].missed / Math.max(dimMissed[b].total, 1)) -
             (dimMissed[a].missed / Math.max(dimMissed[a].total, 1));
    });

    missedSorted.forEach(function(k) {
      const rate = missCount > 0 ? (dimMissed[k].missed / missCount * 100).toFixed(1) : '0.0';
      let bar = '';
      const barLen = Math.round(parseFloat(rate) / 5);
      for (let b = 0; b < barLen; b++) bar += '█';
      report.push('│  ' + dimLabels[k].padEnd(12) + ' 漏掉率=' + rate + '% ' + bar);
    });

    report.push('│                                                     │');
    report.push('│  📌 最近 5 期未命中案例（得分/排名）                │');
    report.push('│                                                     │');

    const recentMisses = missDetails.slice(0, 5);
    recentMisses.forEach(function(m) {
      let dimStr = '';
      if (m.dims) {
        const parts = [];
        dimKeys.forEach(function(k) {
          if ((m.dims[k] || 0) === 0) parts.push(k);
        });
        dimStr = parts.length > 0 ? ' 缺:' + parts.join(',') : ' 全中';
      }
      report.push('│  ' + (m.expect || '?') + '期  #' + String(m.actualNum).padStart(2) +
        '  得分=' + m.score.toFixed(2) + '  排名=' + m.rank + '/49' + dimStr);
    });

    report.push('│                                                     │');
    report.push('│  📌 改进建议                                        │');
    report.push('│                                                     │');

    // 基于漏掉率生成建议
    missedSorted.forEach(function(k, idx) {
      const rate = missCount > 0 ? parseFloat((dimMissed[k].missed / missCount * 100).toFixed(1)) : 0;
      if (rate > 60 && idx < 3) {
        let suggest = '';
        if (k === 'follow') suggest = '→ 跟随生肖覆盖不足，检查 followMap 数据质量';
        else if (k === 'head') suggest = '→ 头数比例范围过窄，考虑扩大 TOP 或增加权重';
        else if (k === 'tail') suggest = '→ 尾数比例范围过窄，考虑扩大 TOP 或增加权重';
        else if (k === 'color') suggest = '→ 波色维度覆盖不足，考虑增加权重';
        else if (k === 'wuxing') suggest = '→ 五行维度覆盖不足，考虑增加权重';
        else if (k === 'neighbor') suggest = '→ 邻号维度可扩大范围（±2），或增加权重';
        else if (k === 'inertia') suggest = '→ 惯性维度覆盖不足，考虑增加权重';
        else if (k === 'miss') suggest = '→ 冷热维度阈值偏高，降低 avgMiss 门槛';
        report.push('│  ⚠ ' + dimLabels[k] + ' 漏掉率=' + rate + '% ' + suggest);
      }
    });

    report.push('│                                                     │');
    report.push('└─────────────────────────────────────────────────────┘');
    report.push('');

    console.log(report.join('\n'));

    return {
      totalTests: totalCount,
      hits: hitCount,
      misses: missCount,
      hitRate: hitRate,
      dimMissed: dimMissed,
      missDetails: missDetails,
      hitDimAvg: dimKeys.reduce(function(acc, k) {
        acc[k] = hitCount > 0 ? parseFloat((hitDimSum[k] / hitCount).toFixed(2)) : 0;
        return acc;
      }, {}),
      missDimAvg: dimKeys.reduce(function(acc, k) {
        acc[k] = missCount > 0 ? parseFloat((missDimSum[k] / missCount).toFixed(2)) : 0;
        return acc;
      }, {}),
      summary: '命中率=' + hitRate + '% | 未命中=' + missCount + '期 | 详细分析见 console'
    };
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionBacktest);
}
