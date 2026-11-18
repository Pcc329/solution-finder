(function () {
  const filterRegionByLabel = new Map([
    ['北北基', '北部'],
    ['桃竹苗', '北部'],
    ['中彰投', '中部'],
    ['雲嘉南', '南部'],
    ['高屏', '南部'],
    ['全台灣', null],
  ]);

  function getEligibleExampleCombos(items, regions, categories) {
    const normalItems = items.filter(item => item.rs === '正常');
    const combos = [];

    for (const region of regions) {
      if (!filterRegionByLabel.has(region)) continue;
      const filterRegion = filterRegionByLabel.get(region);
      const regionalItems = filterRegion === null
        ? normalItems
        : normalItems.filter(item => item.r === filterRegion);

      for (const category of categories) {
        const count = regionalItems.filter(item => item.cat?.includes(category)).length;
        if (count >= 10) combos.push({ region, filterRegion, category, count });
      }
    }
    return combos;
  }

  function selectDistinctExampleCombos(orderedCombos) {
    const categories = new Set();
    const selected = [];

    for (const combo of orderedCombos) {
      if (categories.has(combo.category)) continue;
      categories.add(combo.category);
      selected.push(combo);
      if (selected.length === 3) break;
    }
    return selected;
  }

  globalThis.ExampleCombos = { getEligibleExampleCombos, selectDistinctExampleCombos };
})();
