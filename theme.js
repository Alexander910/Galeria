(() => {
  let theme = 'light';
  try { theme = localStorage.getItem('nogal-theme') === 'dark' ? 'dark' : 'light'; } catch {}
  const apply = value => {
    document.documentElement.dataset.theme = value;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#211A17' : '#F1E8DC');
    const button = document.getElementById('themeToggle');
    if (button) {
      button.textContent = value === 'dark' ? '☀' : '☾';
            const t = window.nogalI18n?.t || (text => text);
      button.setAttribute('aria-label', t(value === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'));
      button.setAttribute('title', button.getAttribute('aria-label'));
      button.setAttribute('aria-pressed', String(value === 'dark'));
    }
  };
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(theme);
      try { localStorage.setItem('nogal-theme', theme); } catch {}
    });
  });
    window.addEventListener('nogal:language', () => apply(theme));
  window.addEventListener('storage', event => {
    if (event.key === 'nogal-theme') { theme = event.newValue === 'dark' ? 'dark' : 'light'; apply(theme); }
  });
})();
