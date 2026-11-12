(() => {
  const INDUSTRY_VERTICAL_TERMS = {
    '旅宿觀光': { chinese: ['旅宿', '住宿', '訂房', '觀光', '飯店', '旅遊', '民宿'], english: [] },
    '製造業': { chinese: ['製造', '工廠', '產線', '工控', '機台', '工業'], english: ['SCADA', 'PLC', 'MES'] },
    '醫療照護': { chinese: ['醫療', '醫院', '診所', '病歷', '長照', '照護', '健保'], english: [] },
    '建築營造': { chinese: ['建築', '營造', '營建', '工地', '建案', '裝修'], english: ['BIM'] },
    '文化創意': { chinese: ['文創', '文化創意', '藝文', '展演', '藝術', '博物館'], english: [] },
  };

  const toText = value => Array.isArray(value) ? value.join(',') : String(value ?? '');

  function matchesVerticalTerms(text, { chinese, english }) {
    return chinese.some(term => text.includes(term))
      || english.some(term => new RegExp(`\\b${term}\\b`).test(text));
  }

  function matchesIndustryVertical(item, vertical) {
    if (!Object.hasOwn(INDUSTRY_VERTICAL_TERMS, vertical)) return true;

    const text = [item.d, item.s, item.desc, item.feat, item.cat, item.tags, item.slogan]
      .map(toText)
      .join(' ');
    return matchesVerticalTerms(text, INDUSTRY_VERTICAL_TERMS[vertical]);
  }

  function industryVerticalTargetScore(item, verticals) {
    if (verticals.length === 0) return 0;

    const targetIndustry = toText(item.d);
    return verticals.some(vertical => Object.hasOwn(INDUSTRY_VERTICAL_TERMS, vertical)
      && matchesVerticalTerms(targetIndustry, INDUSTRY_VERTICAL_TERMS[vertical])) ? 50 : 0;
  }

  globalThis.INDUSTRY_VERTICAL_TERMS = INDUSTRY_VERTICAL_TERMS;
  globalThis.matchesIndustryVertical = matchesIndustryVertical;
  globalThis.industryVerticalTargetScore = industryVerticalTargetScore;
})();
