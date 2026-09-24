(() => {
  const night = new Image();
  night.src = 'assets/me_night.webp';
  const root = document.documentElement;
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
    document.querySelector('meta[name="theme-color"]').content = dark ? '#080c18' : '#f6f5f0';
  };
  document.addEventListener('DOMContentLoaded', () => {
    update();
    document.querySelectorAll('img.portrait').forEach((img) => {
      if (typeof img.decode === 'function') img.decode().catch(() => {});
    });
    document.querySelector('.theme-toggle').addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pu-li-theme', root.dataset.theme); } catch {}
      update();
    });
  });
})();
