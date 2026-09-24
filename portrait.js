(() => {
  const visual = document.querySelector('.hero-visual');
  if (!visual) return;
  const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const properties = ['--portrait-rx', '--portrait-ry', '--orbit-x', '--orbit-y'];
  const reset = () => {
    visual.classList.remove('is-exploring');
    properties.forEach(property => visual.style.removeProperty(property));
  };
  visual.addEventListener('pointermove', event => {
    if (!enabled.matches || event.pointerType !== 'mouse') return;
    const bounds = visual.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    visual.classList.add('is-exploring');
    visual.style.setProperty('--portrait-rx', `${-y * 8}deg`);
    visual.style.setProperty('--portrait-ry', `${x * 8}deg`);
    visual.style.setProperty('--orbit-x', `${-x * 14}px`);
    visual.style.setProperty('--orbit-y', `${-y * 14}px`);
  });
  visual.addEventListener('pointerleave', reset);
  visual.addEventListener('pointercancel', reset);
  enabled.addEventListener('change', reset);
  window.addEventListener('blur', reset);
})();
