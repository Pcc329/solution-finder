(() => {
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

  function loadSolutionImageBackdrop(image) {
    image.onload = image.onerror = null;
    const backdrop = image.previousElementSibling;
    backdrop.src = backdrop.dataset.src;
    backdrop.removeAttribute('data-src');
  }

  function replaceSolutionImage(image) {
    image.onload = image.onerror = null;
    image.parentElement.remove();
  }

  function renderSolutionImage({ imageUrl, solutionName, variant }) {
    const url = escapeHtml(normalizeImageUrl(imageUrl));
    if (!url) return '';

    const name = escapeHtml(solutionName);
    const attrs = 'loading="lazy" decoding="async" referrerpolicy="no-referrer"';
    return `<div class="solution-image-frame${variant === 'detail' ? ' solution-image-detail' : ''}">
      <img class="solution-image-backdrop" data-src="${url}" ${attrs} alt="" aria-hidden="true">
      <img class="solution-image-main" src="${url}" ${attrs} alt="${name} 方案圖片"
        onload="window.loadSolutionImageBackdrop(this)" onerror="window.replaceSolutionImage(this)">
    </div>`;
  }

  window.renderSolutionImage = renderSolutionImage;
  window.loadSolutionImageBackdrop = loadSolutionImageBackdrop;
  window.replaceSolutionImage = replaceSolutionImage;
})();
