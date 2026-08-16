/**
 * 参数校准脚本：walk-forward 扫窗口大小 × 5 维权重 × 半衰期
 *
 * 用法（Node.js）：
 *   1. 把 window.historyData 导出为 history.json（与 storage.js 中 state.historyData 同结构）
 *      node scripts/calibrate-impossible.js path/to/history.json
 *   2. 在浏览器 console 也可直接调用：
 *      fetch('scripts/calibrate-impossible.js').then(r=>r.text()).then(eval)
 *      calibrateImpossible(StateManager._state.historyData)
 *
 * 原理：
 *   - 克隆 business-impossible.js 的 _calcOneDimension / calculateBacktrack
 *   - 用 (windowSize × weights × halfLife) 三维网格遍历，找过去 N 期的最优参数
 *   - 输出最优组合 + 命中率提升幅度（相对当前默认配置）
 *
 * 原则：
 *   - 不修改 business-impossible.js，仅作为离线校准工具
 *   - 推荐每 100 期重新校准一次（数据漂移）
 *   - 校准结果需人工 review 再写入业务层（不自动改线上逻辑）
 */

(function (root) {
  'use strict';

  // -------------------- 数据预计算 --------------------
  // v2.6.9 清理：batchSpecials 工具函数未在脚本内使用（脚本直接依赖 Utils.SpecialCalculator.batchGetSpecial）
  // 实际使用请通过 Utils.SpecialCalculator.batchGetSpecial 调用

  // -------------------- 单维度评分（参数化版本） --------------------
  const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  const COLOR = ['红','蓝','绿'];
  const HEAD = [0,1,2,3,4];
  const TAIL = [0,1,2,3,4,5,6,7,8,9];

  function calcDim(specials, domain, valKey, weights, halfLife) {
    const n = specials.length;
    const recentN = Math.min(6, n);
    const half = Math.floor(n / 2);

    const freq = {}, f1 = {}, f2 = {};
    domain.forEach(function (d) { freq[d]=0; f1[d]=0; f2[d]=0; });

    specials.forEach(function (sp, i) {
      const v = sp[valKey];
      if (freq[v] !== undefined) {
        freq[v]++;
        if (i < half) f1[v]++; else f2[v]++;
      }
    });

    const miss = {}, recent = {};
    domain.forEach(function (d) { miss[d]=-1; recent[d]=0; });
    for (let i = 0; i < n; i++) {
      const v = specials[i][valKey];
      if (miss[v] === -1) miss[v] = i;
      if (i < recentN) recent[v]++;
    }
    domain.forEach(function (d) { if (miss[d] === -1) miss[d] = n; });

    // 趋势
    const trend = {};
    domain.forEach(function (d) {
      const a = f1[d]||0, b = f2[d]||0, t = a+b;
      trend[d] = t === 0 ? 50 : Math.round((1 - a/t) * 100);
    });

    // 反转（连出）
    const rev = {};
    const latest = specials[0][valKey];
    let streak = 1;
    for (let i = 1; i < n && specials[i][valKey] === latest; i++) streak++;
    rev[latest] = Math.min(100, streak * 25);

    const fVals = domain.map(function (d) { return freq[d]; });
    const fMin = Math.min.apply(null, fVals);
    const fMax = Math.max.apply(null, fVals);

    const results = domain.map(function (d) {
      const fS = fMax === fMin ? 50 : Math.round(((fMax - freq[d]) / (fMax - fMin)) * 100);
      const mS = miss[d] === 0 ? 0 : Math.round((1 - Math.exp(-miss[d] / halfLife)) * 100);
      const rS = recent[d] === 0 ? 100 : Math.round((1 - recent[d] / recentN) * 100);
      const tS = trend[d] || 50;
      const vS = rev[d] || 0;
      const total = weights[0]*fS + weights[1]*mS + weights[2]*rS + weights[3]*tS + weights[4]*vS;
      return { name: d, score: total };
    });
    results.sort(function (a,b) { return b.score - a.score; });
    return results[0].name;
  }

  // -------------------- 单次回测 --------------------
  function backtrackOnce(historyData, windowSize, weights, halfLife) {
    const W = windowSize;
    const n = historyData.length;
    if (n < W + 1) return null;

    const specs = historyData.map(function (h) {
      // 浏览器环境：使用真实工具；Node 环境：占位
      if (typeof Utils !== 'undefined' && Utils.SpecialCalculator) {
        return Utils.SpecialCalculator.getSpecial(h);
      }
      return null;
    });
    if (specs[0] === null) return null;

    let fullHit = 0, total = 0;
    for (let i = 0; i < n - W; i++) {
      const win = specs.slice(i + 1, i + 1 + W);
      if (win.length < 6) continue;
      const act = specs[i];
      if (!act || act.te === undefined) continue;

      const z = calcDim(win, ZODIAC, 'zod', weights, halfLife);
      const c = calcDim(win, COLOR, 'colorName', weights, halfLife);
      const t = calcDim(win, TAIL, 'tail', weights, halfLife);
      const h = calcDim(win, HEAD, 'head', weights, halfLife);
      const half = c + (act.odd ? '单' : '双');
      const actHalf = act.colorName + (act.odd ? '单' : '双');

      const zHit = z !== act.zod;
      const hHit = half !== actHalf;
      const tHit = t !== act.tail;
      const hdHit = h !== act.head;
      if (zHit && hHit && tHit && hdHit) fullHit++;
      total++;
    }
    return total > 0 ? { total: total, fullHit: fullHit, acc: fullHit / total } : null;
  }

  // -------------------- 网格搜索 --------------------
  function gridSearch(historyData, opts) {
    const Ws = opts.windows || [18, 21, 24, 27, 30];
    const HFs = opts.halfLives || [6, 8, 10, 12];
    const WS = opts.weightSets || [
      [0.30,0.25,0.20,0.15,0.10], // 默认
      [0.35,0.30,0.15,0.10,0.10],
      [0.25,0.30,0.25,0.10,0.10],
      [0.40,0.25,0.15,0.10,0.10],
      [0.30,0.30,0.20,0.10,0.10],
      [0.25,0.25,0.25,0.15,0.10]
    ];

    const results = [];
    Ws.forEach(function (w) {
      HFs.forEach(function (hf) {
        WS.forEach(function (ws) {
          const r = backtrackOnce(historyData, w, ws, hf);
          if (r) results.push({
            window: w, halfLife: hf, weights: ws.slice(),
            acc: r.acc, fullHit: r.fullHit, total: r.total
          });
        });
      });
    });

    results.sort(function (a, b) { return b.acc - a.acc; });
    return results;
  }

  // -------------------- 入口 --------------------
  function calibrateImpossible(historyData, opts) {
    opts = opts || {};
    if (!historyData || historyData.length < 30) {
      console.error('[校准] 历史数据不足 30 期');
      return null;
    }
    console.log('[校准] 开始扫描 ' + historyData.length + ' 期历史...');
    const t0 = Date.now();

    const results = gridSearch(historyData, opts);
    if (!results.length) {
      console.error('[校准] 无有效结果（请在浏览器内运行以访问 Utils）');
      return null;
    }

    const baseline = results.find(function (r) {
      return r.window === 24 && r.halfLife === 8 &&
        Math.abs(r.weights[0]-0.30)<1e-6;
    });

    console.log('--- Top 5 组合 ---');
    results.slice(0, 5).forEach(function (r, i) {
      console.log(
        '#' + (i+1) +
        '  window=' + r.window +
        '  halfLife=' + r.halfLife +
        '  weights=[' + r.weights.join(',') + ']' +
        '  acc=' + (r.acc*100).toFixed(1) + '%' +
        '  (' + r.fullHit + '/' + r.total + ')'
      );
    });

    if (baseline) {
      const best = results[0];
      const delta = (best.acc - baseline.acc) * 100;
      console.log('--- 基线对比 ---');
      console.log('基线(window=24, halfLife=8, 默认权重): ' + (baseline.acc*100).toFixed(1) + '%');
      console.log('最佳: ' + (best.acc*100).toFixed(1) + '% (Δ=' + (delta>=0?'+':'') + delta.toFixed(2) + ' pp)');
    }

    console.log('--- 耗时 ---');
    console.log((Date.now() - t0) + ' ms');
    return results;
  }

  // 暴露
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calibrateImpossible: calibrateImpossible };
  } else {
    root.calibrateImpossible = calibrateImpossible;
  }
})(typeof window !== 'undefined' ? window : globalThis);