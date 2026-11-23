(function () {
  function pickDemoCombo(allData, eligibleCombos) {
    const regional = eligibleCombos.filter(combo => combo.filterRegion !== null);
    const candidates = regional.length ? regional : eligibleCombos;
    const preferred = regional.find(combo => combo.filterRegion === '中部' && combo.category === '生產物流');
    const combo = preferred || candidates.reduce((best, candidate) =>
      !best || candidate.count > best.count ? candidate : best, null);
    if (!combo) return null;

    // public/index.html @ b6f2c14:1164,1170. handleQuickSearch clears all other filters.
    // Keep these predicates identical to filteredResults; resultCount includes every status.
    const filters = { region: combo.filterRegion ? [combo.filterRegion] : [], category: [combo.category] };
    const results = allData.filter(item => {
      if (filters.region.length > 0 && !filters.region.includes(item.r)) return false;
      if (filters.category.length > 0 && !(item.cat && filters.category.some(c => item.cat.includes(c)))) return false;
      return true;
    });
    const examples = results.filter(item => item.rs === '正常')
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(0, 2);
    return {
      region: combo.filterRegion ?? '全台灣',
      filterRegion: combo.filterRegion,
      category: combo.category,
      resultCount: results.length,
      examples: examples.map(item => item.s).filter(name => typeof name === 'string' && name.trim()),
      source: examples[0]?.p || '',
    };
  }

  function summarizeSources(allData, limit = 7) {
    const counts = new Map();
    for (const item of allData) {
      if (typeof item.p !== 'string' || !item.p.trim()) continue;
      counts.set(item.p, (counts.get(item.p) || 0) + 1);
    }
    const top = Array.from(counts, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hant'))
      .slice(0, Math.max(0, limit));
    return { sourceCount: counts.size, top };
  }

  globalThis.HomeDemo = { pickDemoCombo, summarizeSources };
})();
