(() => {
  const palette = [
    ['bg-teal-100', 'text-teal-800'],
    ['bg-rose-100', 'text-rose-800'],
    ['bg-violet-100', 'text-violet-800'],
    ['bg-sky-100', 'text-sky-800'],
    ['bg-amber-100', 'text-amber-800'],
    ['bg-emerald-100', 'text-emerald-800'],
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLogoUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function getPaletteIndex(companyName) {
    let hash = 0;
    for (const char of String(companyName || '')) hash += char.charCodeAt(0);
    return hash % palette.length;
  }

  function renderInitialAvatar(companyName) {
    const name = String(companyName || '').trim();
    const initial = Array.from(name)[0] || '?';
    const [backgroundClass, textClass] = palette[getPaletteIndex(name)];
    return `<span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${backgroundClass} ${textClass} text-sm font-black" aria-label="${escapeHtml(name || '未提供業者')}">${escapeHtml(initial)}</span>`;
  }

  function replaceCompanyAvatar(image) {
    image.outerHTML = renderInitialAvatar(image.dataset.companyName || '');
  }

  function renderCompanyAvatar(companyName, logoUrl) {
    const name = String(companyName || '').trim();
    const url = normalizeLogoUrl(logoUrl);
    if (!url) return renderInitialAvatar(name);

    return `<img class="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white object-contain" src="${escapeHtml(url)}" alt="${escapeHtml(name || '公司')} logo" data-company-name="${escapeHtml(name)}" onerror="window.replaceCompanyAvatar(this)">`;
  }

  window.renderCompanyAvatar = renderCompanyAvatar;
  window.replaceCompanyAvatar = replaceCompanyAvatar;
})();
