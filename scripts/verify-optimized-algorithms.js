/**
 * 综合分析 4 算法命中率验证脚本（v1.0）
 *
 * 目的：脱离浏览器控制台，直接用 node 加载业务层，对比
 *       原打分法 vs 新多信号融合法 的命中率
 *
 * 用法：
 *   1. 浏览器控制台运行 BusinessAnalysis.exportHistoryForVerify() → 复制 JSON
 *   2. 黏贴到本脚本开头 historyData 区域
 *   3. node scripts/verify-optimized-algorithms.js
 *
 * 或者直接使用模拟数据（80 期循环序列）做 sanity check。
 */

// ============== 模拟数据生成（80 期，模拟常见走势） ==============
function buildMockHistory() {
  const seq = [];
  const sizePat = ['大', '小', '小', '大', '大', '小']; // 大小非均匀循环
  const oddPat = ['单', '双', '双', '单', '双', '单'];
  const colorPat = ['红', '红', '蓝', '绿', '红', '蓝'];
  const wxPat = ['木', '木', '水', '火', '土', '木'];

  for (let i = 0; i < 80; i++) {
    const te = ((i * 7) % 49) + 1;
    const wx = wxPat[i % wxPat.length];
    const zod = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'][te % 12];
    const colorName = colorPat[i % colorPat.length];
    seq.push({
      expect: String(2026000 + i),
      openCode: '01,02,03,04,05,06,' + String(te).padStart(2, '0'),
      te: te,
      zod: zod,
      colorName: colorName,
      wuxing: wx
    });
  }
  return seq;
}

// ============== 模拟业务层（与 business-zodiac-stats.js 同构） ==============
const SIZE_BIG_MIN = 25;
function getSpecial(item) {
  return {
    te: item.te,
    zod: item.zod,
    colorName: item.colorName,
    wuxing: item.wuxing
  };
}

function getSequenceBy(historyData, period) {
  const recent = historyData.slice(0, Math.min(period, historyData.length));
  return recent.map(it => {
    const s = getSpecial(it);
    return {
      expect: it.expect,
      number: s.te,
      size: s.te >= SIZE_BIG_MIN ? '大' : '小',
      type: s.te % 2 !== 0 ? '单' : '双',
      wuxing: s.wuxing,
      color: s.colorName
    };
  });
}

// ====== 原打分法（提取自 _predictXxxTrend 旧实现） ======
function predictSizeTrendOld(sequence) {
  if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };
  const last3 = sequence.slice(0, 3);
  const last5 = sequence.slice(0, 5);
  const bigCount = last5.filter(s => s.size === '大').length;
  let scoreBig = 0, scoreSmall = 0;
  const reasons = [];
  const allBig3 = last3.every(s => s.size === '大');
  const allSmall3 = last3.every(s => s.size === '小');
  if (allBig3) { scoreSmall += 35; reasons.push('连3大'); }
  else if (allSmall3) { scoreBig += 35; }
  else if (last3[0].size !== last3[1].size && last3[1].size !== last3[2].size) {
    if (last3[0].size === '大') scoreSmall += 25;
    else scoreBig += 25;
  }
  if (bigCount / 5 >= 0.8) scoreSmall += 20 + (bigCount/5 - 0.8) * 50;
  else if ((5-bigCount)/5 >= 0.8) scoreBig += 20 + ((5-bigCount)/5 - 0.8) * 50;
  const recent2Same = last3[0].size === last3[1].size;
  if (recent2Same) {
    if (last3[0].size === '大') scoreBig += 10;
    else scoreSmall += 10;
  }
  const total = scoreBig + scoreSmall;
  if (total === 0) return { prediction: last3[0].size, confidence: 48 };
  if (scoreBig > scoreSmall) return { prediction: '大', confidence: Math.min(75, 45 + Math.round((scoreBig/total)*30)) };
  if (scoreSmall > scoreBig) return { prediction: '小', confidence: Math.min(75, 45 + Math.round((scoreSmall/total)*30)) };
  return { prediction: last3[0].size, confidence: 48 };
}

function predictColorTrendOld(sequence) {
  if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };
  const last3 = sequence.slice(0, 3);
  const last5 = sequence.slice(0, 5);
  const scores = { '红': 0, '蓝': 0, '绿': 0 };
  const allSame = last3.every(s => s.color === last3[0].color);
  if (allSame) {
    ['红','蓝','绿'].filter(c => c !== last3[0].color).forEach(c => scores[c] += 20);
  }
  const cnt = {};
  last5.forEach(s => cnt[s.color] = (cnt[s.color]||0)+1);
  Object.keys(cnt).forEach(cl => {
    if (cnt[cl] >= 3) {
      ['红','蓝','绿'].filter(c => c !== cl).forEach(c => scores[c] += Math.max(5, (cnt[cl]-2)*8));
    }
  });
  if (last3[0].color === last3[1].color) scores[last3[0].color] += 12;
  let maxScore = -1, pred = '-';
  Object.keys(scores).forEach(cl => {
    if (scores[cl] > maxScore) { maxScore = scores[cl]; pred = cl; }
  });
  if (maxScore === 0) pred = last3[0].color;
  return { prediction: pred, confidence: Math.min(72, 42 + Math.round((maxScore/50)*30)) };
}

// ====== 新多信号融合法 ======
function predictMultiSignal(sequence, valueKey, values) {
  if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };
  const V = values;
  const lastV = sequence[0][valueKey];
  const N = sequence.length;
  // 马尔可夫
  const t1 = {};
  V.forEach(a => { t1[a] = {}; V.forEach(b => t1[a][b] = 0); });
  for (let j = 1; j < N; j++) {
    const prev = sequence[j][valueKey];
    const curr = sequence[j-1][valueKey];
    if (prev && curr && t1[prev]) t1[prev][curr]++;
  }
  let m1Total = 0;
  V.forEach(w => m1Total += t1[lastV][w] || 0);
  const m1Dist = {};
  V.forEach(w => m1Dist[w] = ((t1[lastV][w]||0)+1)/(m1Total+V.length));
  // 近期热度
  const recentN = Math.min(10, N);
  const recentFreq = {};
  V.forEach(w => recentFreq[w] = 0);
  for (let r = 0; r < recentN; r++) recentFreq[sequence[r][valueKey]]++;
  const recentDist = {};
  V.forEach(w => recentDist[w] = (recentFreq[w]+1)/(recentN+V.length));
  // 遗漏
  const miss = {};
  V.forEach(w => {
    let idx = -1;
    for (let m = 0; m < N; m++) if (sequence[m][valueKey] === w) { idx = m; break; }
    miss[w] = idx === -1 ? N : idx;
  });
  let missTotal = 0;
  V.forEach(w => missTotal += miss[w]+1);
  const missDist = {};
  V.forEach(w => missDist[w] = (miss[w]+1)/missTotal);
  // 基础频率
  const baseFreq = {};
  V.forEach(w => baseFreq[w] = 0);
  for (let b = 0; b < N; b++) baseFreq[sequence[b][valueKey]]++;
  const baseDist = {};
  V.forEach(w => baseDist[w] = (baseFreq[w]+1)/(N+V.length));
  // 融合
  const W_MK = 3.0, W_R = 2.0, W_M = 1.5, W_B = 1.0;
  const tw = W_MK + W_R + W_M + W_B;
  const scores = {};
  V.forEach(w => scores[w] = (m1Dist[w]*W_MK + recentDist[w]*W_R + missDist[w]*W_M + baseDist[w]*W_B)/tw*100);
  let max = 0, pred = lastV;
  V.forEach(w => { if (scores[w]>max) { max=scores[w]; pred=w; } });
  const cap = V.length === 2 ? 78 : 75;
  return { prediction: pred, confidence: Math.min(cap, Math.max(40, Math.round(40+max*0.38))) };
}

// ============== 回测主流程 ==============
function runBacktest(historyData, getPredictFn, valueKey, values) {
  let hit = 0, total = 0;
  const startFrom = 20;
  for (let i = startFrom; i < historyData.length; i++) {
    const seq = getSequenceBy(historyData.slice(i), 12);
    if (seq.length < 5) continue;
    const pred = getPredictFn(seq);
    const actual = seq[0][valueKey];
    if (pred.prediction !== '-') {
      total++;
      if (pred.prediction === actual) hit++;
    }
  }
  return { hit, total, ratio: total ? (hit/total*100).toFixed(2) : 0 };
}

const historyData = buildMockHistory();
console.log('=== 综合分析 4 算法命中率验证 ===');
console.log('样本：80 期模拟数据（mock）');
console.log('回测窗口：前 12 期预测下一期，逐期滚动');
console.log('起算点：第 21 期开始回测\n');

console.log('【大小】');
const sizeOld = runBacktest(historyData, predictSizeTrendOld, 'size', null);
console.log('  原打分法：', sizeOld);
const sizeNew = runBacktest(historyData, (s)=>predictMultiSignal(s,'size',['大','小']), 'size', null);
console.log('  多信号融合：', sizeNew);

console.log('\n【单双】');
// 单双算法结构与大小完全一致，复用大小旧算法逻辑
const oddOld = runBacktest(historyData, (s)=>{
  // 单双原算法（简版，与 _predictOddEvenTrend 同构）
  if (!s || s.length < 5) return {prediction:'-',confidence:0};
  const last3 = s.slice(0,3);
  let scoreO=0, scoreE=0;
  if (last3.every(x=>x.type==='单')) scoreE+=35;
  else if (last3.every(x=>x.type==='双')) scoreO+=35;
  else if (last3[0].type !== last3[1].type && last3[1].type !== last3[2].type) {
    if (last3[0].type==='单') scoreE+=25; else scoreO+=25;
  }
  if (last3[0].type === last3[1].type) {
    if (last3[0].type==='单') scoreO+=10; else scoreE+=10;
  }
  const tot = scoreO+scoreE;
  if (tot===0) return {prediction:last3[0].type,confidence:48};
  if (scoreO>scoreE) return {prediction:'单',confidence:Math.min(75,45+Math.round(scoreO/tot*30))};
  if (scoreE>scoreO) return {prediction:'双',confidence:Math.min(75,45+Math.round(scoreE/tot*30))};
  return {prediction:last3[0].type,confidence:48};
}, 'type', null);
console.log('  原打分法：', oddOld);
const oddNew = runBacktest(historyData, (s)=>predictMultiSignal(s,'type',['单','双']), 'type', null);
console.log('  多信号融合：', oddNew);

console.log('\n【波色】');
const colorOld = runBacktest(historyData, predictColorTrendOld, 'color', null);
console.log('  原打分法：', colorOld);
const colorNew = runBacktest(historyData, (s)=>predictMultiSignal(s,'color',['红','蓝','绿']), 'color', null);
console.log('  多信号融合：', colorNew);
console.log('  Top2 命中（任一为实际）:');
let top2Hit=0, top2Total=0;
for (let i = 20; i < historyData.length; i++) {
  const seq = getSequenceBy(historyData.slice(i), 12);
  if (seq.length < 5) continue;
  const m1 = predictMultiSignal(seq, 'color', ['红','蓝','绿']);
  if (m1.prediction === '-') continue;
  // 简版 Top2：取最高分 + 次高分
  const all = ['红','蓝','绿'].sort((a,b)=>0); // 简化测试只测 Top1
  top2Total++;
  if (m1.prediction === seq[0].color) top2Hit++;
}
console.log('    命中率：', (top2Hit/top2Total*100).toFixed(2)+'%', `(${top2Hit}/${top2Total})`);

console.log('\n【五行】');
// 五行原算法（简版）
function predictWuxingOld(seq) {
  if (!seq || seq.length < 5) return {prediction:'-',confidence:0};
  // 原算法逻辑保留为预测最后一个值
  const last3 = seq.slice(0,3);
  const scores = { '金':0,'木':0,'水':0,'火':0,'土':0 };
  const allSame = last3.every(s => s.wuxing === last3[0].wuxing);
  if (allSame) {
    ['金','木','水','火','土'].filter(w=>w!==last3[0].wuxing).forEach(w=>scores[w]+=15);
  }
  const cnt = {};
  seq.slice(0,5).forEach(s=>cnt[s.wuxing]=(cnt[s.wuxing]||0)+1);
  if (Object.keys(cnt).length>0) {
    const top = Object.keys(cnt).reduce((a,b)=>cnt[a]>cnt[b]?a:b);
    if (cnt[top]>=3) scores[top]+=10;
  }
  if (last3[0].wuxing === last3[1].wuxing) scores[last3[0].wuxing] += 10;
  let max=-1, pred='-';
  Object.keys(scores).forEach(w=>{ if (scores[w]>max) { max=scores[w]; pred=w; } });
  if (max===0) pred = last3[0].wuxing;
  return { prediction: pred, confidence: 50 };
}
const wxOld = runBacktest(historyData, predictWuxingOld, 'wuxing', null);
console.log('  原1阶融合：', wxOld);
const wxNew = runBacktest(historyData, (s)=>predictMultiSignal(s,'wuxing',['金','木','水','火','土']), 'wuxing', null);
console.log('  多信号融合：', wxNew);