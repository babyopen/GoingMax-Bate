const BusinessGiong = {
  ZODIAC_CODE: { '01':'鼠','02':'牛','03':'虎','04':'兔','05':'龙','06':'蛇','07':'马','08':'羊','09':'猴','10':'鸡','11':'狗','12':'猪' },
  ZODIAC_TO_CODE: { '鼠':'01','牛':'02','虎':'03','兔':'04','龙':'05','蛇':'06','马':'07','羊':'08','猴':'09','鸡':'10','狗':'11','猪':'12' },

  OLD_CHAIN: ['01','05','07','09','04','10'],
  NEW_CHAIN: ['01','04','05','07','09'],

  COLD_ZONES: ['02','08','11','12'],

  predict: function(historyData) {
    if (!historyData || !historyData.length) return null;

    var latestItem = historyData[0];
    var latestSpecial = ZodiacPrediction._getSpecial(latestItem);
    var latestZodiac = latestSpecial.zod;
    var latestCode = BusinessGiong.ZODIAC_TO_CODE[latestZodiac];
    var nextExpect = Number(latestItem.expect || 0) + 1;

    if (!latestCode) return null;

    var freq12 = {}, freq11 = {};
    var w12 = historyData.slice(0, 12);
    var w11 = historyData.slice(0, 11);
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { freq12[z] = 0; freq11[z] = 0; });
    w12.forEach(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) freq12[s.zod]++;
    });
    w11.forEach(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) freq11[s.zod]++;
    });

    var highFreqCount = 0;
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { if (freq12[z] >= 3) highFreqCount++; });
    var isOvercrowded = highFreqCount > 3;

    var ctx = { freq12: freq12, freq11: freq11, isOvercrowded: isOvercrowded };

    var oldResult = BusinessGiong._processChain(BusinessGiong.OLD_CHAIN, latestCode, ctx);
    var newResult = BusinessGiong._processChain(BusinessGiong.NEW_CHAIN, latestCode, ctx);

    return {
      nextExpect: nextExpect,
      latestCode: latestCode,
      latestZodiac: latestZodiac,
      old: oldResult,
      new: newResult
    };
  },

  _processChain: function(chain, currentCode, ctx) {
    var freq12 = ctx.freq12, freq11 = ctx.freq11, isOvercrowded = ctx.isOvercrowded;

    var pos = chain.indexOf(currentCode);
    if (pos === -1) pos = chain.length - 1;

    var allNext = [];
    for (var i = 1; i <= chain.length; i++) {
      var nextPos = (pos + i) % chain.length;
      allNext.push(chain[nextPos]);
    }

    var mainCandidates = [];
    var backupCandidates = [];

    allNext.forEach(function(code) {
      var zodiac = BusinessGiong.ZODIAC_CODE[code];
      var c12 = freq12[zodiac] || 0;
      var c11 = freq11[zodiac] || 0;

      if (BusinessGiong.COLD_ZONES.indexOf(code) !== -1) {
        backupCandidates.push({ code: code, zodiac: zodiac, c12: c12, reason: '冷门区' });
        return;
      }

      var degraded = false;
      if (c12 >= 3) {
        if (c11 === 2) {
          degraded = false;
        } else {
          backupCandidates.push({ code: code, zodiac: zodiac, c12: c12, reason: '12期≥3次降权' });
          degraded = true;
        }
      }
      if (degraded) return;

      if (c12 <= 1) {
        backupCandidates.push({ code: code, zodiac: zodiac, c12: c12, reason: '冷号下放备选' });
        return;
      }

      if (isOvercrowded && c12 === 2) {
        var isRestored = (freq12[zodiac] >= 3 && freq11[zodiac] === 2);
        if (!isRestored) {
          backupCandidates.push({ code: code, zodiac: zodiac, c12: c12, reason: '高热拥堵暂停' });
          return;
        }
      }

      mainCandidates.push({ code: code, zodiac: zodiac, c12: c12, c11: c11 });
    });

    var main = mainCandidates.slice(0, 4);
    var backup = backupCandidates.slice(0, 4);

    var snake12 = freq12['蛇'] || 0;
    if (snake12 >= 2) {
      var inMain = main.some(function(m) { return m.code === '06'; });
      var inBackup = backup.some(function(b) { return b.code === '06'; });
      if (!inMain && !inBackup && BusinessGiong.COLD_ZONES.indexOf('06') === -1) {
        if (allNext.indexOf('06') !== -1) {
          if (main.length === 4) {
            backup.unshift({ code: '06', zodiac: '蛇', c12: snake12, special: '变盘顶替' });
          } else {
            main.push({ code: '06', zodiac: '蛇', c12: snake12, c11: freq11['蛇'] || 0, special: '变盘' });
          }
        }
      }
    }

    if (main.length < 4) {
      backupCandidates.forEach(function(b) {
        if (main.length >= 4) return;
        var alreadyInMain = main.some(function(m) { return m.code === b.code; });
        if (!alreadyInMain) {
          main.push(b);
        }
      });
      backup = backupCandidates.filter(function(b) {
        return !main.some(function(m) { return m.code === b.code; });
      }).slice(0, 4);
    }

    return { main: main, backup: backup };
  }
};