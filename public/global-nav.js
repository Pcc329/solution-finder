(() => {
  const menuRoot = document.querySelector('#global-nav .global-nav-more');
  const toggle = menuRoot?.querySelector('.global-nav-toggle');
  const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (!menu) return;

  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', event => {
    if (!menu.hidden && !menuRoot.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
