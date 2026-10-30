(() => {
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const lightColor = themeColor?.content || '#f6f5f0';
  let saved = 'light';
  try { saved = localStorage.getItem('pu-li-theme') || 'light'; } catch {}
  root.dataset.theme = saved === 'dark' ? 'dark' : 'light';
  const update = () => {
    const dark = root.dataset.theme === 'dark';
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? 'Switch to day mode' : 'Switch to night mode';
    }
    if (themeColor) themeColor.content = dark ? '#080c18' : lightColor;
  };
  document.addEventListener('DOMContentLoaded', () => {
    update();
    document.querySelectorAll('img.portrait').forEach((img) => {
      if (typeof img.decode === 'function') img.decode().catch(() => {});
    });
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pu-li-theme', root.dataset.theme); } catch {}
      update();
    });
  });
  const sync = () => {
    try {
      root.dataset.theme = localStorage.getItem('pu-li-theme') === 'dark' ? 'dark' : 'light';
    } catch {}
    update();
  };
  window.addEventListener('pageshow', sync);
  window.addEventListener('storage', event => {
    if (event.key === 'pu-li-theme' || event.key === null) sync();
  });
})();
