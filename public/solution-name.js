// Browser helper; keep aligned with the inline MCP definitions via the parity tests.
(() => {
  const placeholders = new Set(['缺', '缺漏', '待補', '無', '-', '—', 'N/A', 'NA', 'null', '?', '？']);

  function isMissingSolutionName(name) {
    return name == null || (typeof name === 'string' && (!name.trim() || placeholders.has(name.trim())));
  }

  function displaySolutionName(name) {
    return isMissingSolutionName(name) ? '（名稱未提供）' : name;
  }

  globalThis.isMissingSolutionName = isMissingSolutionName;
  globalThis.displaySolutionName = displaySolutionName;
})();
