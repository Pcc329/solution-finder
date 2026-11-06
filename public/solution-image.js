(() => {
  const palette = new Map([
    ['銷售管理', ['#ede9fe', '#4c1d95']],
    ['行銷推廣', ['#fce7f3', '#831843']],
    ['生產物流', ['#fef3c7', '#78350f']],
    ['協作辦公', ['#dbeafe', '#1e3a8a']],
    ['人力資源', ['#ffe4e6', '#881337']],
    ['資安合規', ['#e0e7ff', '#312e81']],
    ['研發創新', ['#ccfbf1', '#134e4a']],
    ['醫療照護', ['#dcfce7', '#14532d']],
    ['暫無法分類', ['#f1f5f9', '#334155']],
  ]);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeImageUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function renderFallback(name, companyName, category) {
    const firstCategory = String(category || '').split(',')[0].trim();
    const [background, ink] = palette.get(firstCategory) || palette.get('暫無法分類');
    return `<div class="solution-image-fallback" style="background:${background};color:${ink}">
      <strong>${name}</strong><span>${escapeHtml(companyName)}</span>
    </div>`;
  }

  function replaceSolutionImage(image) {
    image.onerror = null;
    const frame = image.parentElement;
    const fallback = frame.querySelector('template');
    if (fallback) frame.replaceChildren(fallback.content);
    else frame.remove();
  }

  function renderSolutionImage({ imageUrl, solutionName, companyName, category, variant }) {
    const detail = variant === 'detail';
    const url = escapeHtml(normalizeImageUrl(imageUrl));
    if (detail && !url) return '';

    const name = escapeHtml(solutionName);
    const fallback = detail ? '' : renderFallback(name, companyName, category);
    if (!url) return `<div class="solution-image-frame">${fallback}</div>`;

    const attrs = `src="${url}" loading="lazy" decoding="async" referrerpolicy="no-referrer"`;
    return `<div class="solution-image-frame${detail ? ' solution-image-detail' : ''}">
      <img class="solution-image-backdrop" ${attrs} alt="" aria-hidden="true">
      <img class="solution-image-main" ${attrs} alt="${name} 方案圖片" onerror="window.replaceSolutionImage(this)">
      ${detail ? '' : `<template>${fallback}</template>`}
    </div>`;
  }

  window.renderSolutionImage = renderSolutionImage;
  window.replaceSolutionImage = replaceSolutionImage;
})();
