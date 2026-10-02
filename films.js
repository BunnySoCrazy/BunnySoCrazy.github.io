(() => {
  const grid = document.getElementById('film-grid');
  const dialog = document.getElementById('film-dialog');
  const credits = document.getElementById('credits-dialog');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mod = (n, period) => ((n % period) + period) % period;
  let items = [], rows = [], width = 0, height = 0, spacing = 0;
  let target = 0, position = 0, frame = 0, lastTime = 0;
  let pointer = null, suppressClick = false;
  let selectedCard = null, posterAnimation = null, closing = false, restoringFocus = false;
  let scrollDismissed = false, dismissSwipe = null;
  const poster = document.getElementById('dialog-poster');
  const neighborAnimations = new Map();
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  let hovered = null, hoverMoving = false;

  function setHovered(item) {
    if (item && (!hoverPointer.matches || blocked() || pointer?.dragged || Math.abs(target-position) > .5)) return;
    if (hovered === item) return;
    hovered?.card.classList.remove('is-hovered');
    hovered = item;
    hovered?.card.classList.add('is-hovered');
    schedule();
  }

  function resetHover() {
    hovered?.card.classList.remove('is-hovered');
    hovered = null;
    hoverMoving = false;
    items.forEach(item => { item.hx = 0; item.hy = 0; item.zoom = 1; });
    draw();
  }

  function animateHover(dt) {
    const amount = 1 - Math.exp(-dt / 100);
    hoverMoving = false;
    for (const item of items) {
      let x = 0, y = 0, zoom = 1;
      if (hovered && !dialog.open && !credits.open) {
        if (item === hovered) zoom = 1.65;
        else {
          const dx = item.x - hovered.x, dy = item.y - hovered.y;
          const distance = Math.hypot(dx,dy);
          const radius = Math.max(245, spacing * 1.5);
          const push = 48 * Math.exp(-2 * (distance/radius) ** 2);
          if (distance > 1) { x = dx/distance*push; y = dy/distance*push; }
        }
      }
      for (const [key, goal] of [['hx',x],['hy',y],['zoom',zoom]]) {
        item[key] += (goal-item[key])*amount;
        if (Math.abs(goal-item[key]) < (key === 'zoom' ? .001 : .02)) item[key] = goal;
        else hoverMoving = true;
      }
    }
  }

  function arrangeNeighbors(expanded, immediate = false, duration = expanded ? 950 : 720) {
    if (reducedMotion.matches) return;
    const copy = dialog.querySelector('.dialog-copy').getBoundingClientRect();
    // Reserve a clear central opening; preserve row order as the wall parts.
    const halfOpening = Math.max(poster.offsetWidth, copy.width) / 2 + (width < 600 ? 46 : 72);
    const centerY = height / 2;
    for (const item of items) {
      if (item.card === selectedCard) continue;
      const current = getComputedStyle(item.card).translate;
      // Hand hover displacement to the detail animation before clearing its layer.
      const startTranslate = item.hx || item.hy ? `${item.hx}px ${item.hy}px` : current;
      neighborAnimations.get(item.card)?.cancel();
      let dx = 0, dy = 0;
      if (expanded && item.card.style.visibility === 'visible') {
        const offset = item.x - width / 2;
        const side = Math.abs(offset) < 1 ? (item.row % 2 ? 1 : -1) : Math.sign(offset);
        const proximity = Math.exp(-Math.abs(offset) / Math.max(400, width * .72));
        dx = side * halfOpening * proximity;
        dy = (item.y - centerY) * .075 * proximity;
      }
      const animation = item.card.animate([
        {translate:startTranslate === 'none' ? '0px 0px' : startTranslate},
        {translate:`${dx}px ${dy}px`}
      ], {
        duration:immediate ? 0 : duration,
        easing:expanded ? 'cubic-bezier(.2,.78,.18,1)' : 'cubic-bezier(.35,0,.18,1)',
        fill:'both'
      });
      neighborAnimations.set(item.card, animation);
    }
  }

  function clearNeighbors() {
    neighborAnimations.forEach(animation => animation.cancel());
    neighborAnimations.clear();
  }

  function flyPoster(from, to, duration) {
    posterAnimation?.cancel();
    const transform = `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`;
    posterAnimation = poster.animate([
      {transform}, {transform:'translate(0,0) scale(1,1)'}
    ], {duration, easing:'cubic-bezier(.22,.75,.15,1)', fill:'both'});
    return posterAnimation;
  }

  function showFilm(film, card) {
    if (dialog.open) return;
    target = position;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    const from = card.querySelector('img').getBoundingClientRect();
    selectedCard = card;
    closing = false;
    scrollDismissed = false;
    poster.src = film.poster;
    poster.alt = `Poster for ${film.displayTitle}`;
    document.getElementById('dialog-title').textContent = film.title;
    document.getElementById('dialog-subtitle').textContent = film.displayTitle === film.title
      ? film.year : [film.displayTitle, film.year].filter(Boolean).join(' · ');
    document.getElementById('dialog-number').textContent = String(film.number).padStart(3, '0');
    document.getElementById('dialog-douban').href = film.douban;
    document.getElementById('dialog-tmdb').href = film.tmdb;
    dialog.classList.remove('is-closing');
    dialog.showModal();
    const to = poster.getBoundingClientRect();
    card.classList.add('is-selected');
    document.body.classList.add('film-focused');
    arrangeNeighbors(true);
    resetHover();
    if (!reducedMotion.matches) flyPoster(from, to, 850);
  }

  async function closeFilm() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add('is-closing');
    const from = poster.getBoundingClientRect();
    posterAnimation?.cancel();
    const resting = poster.getBoundingClientRect();
    const duration = scrollDismissed ? 460 : 720;
    document.body.classList.remove('film-focused');
    arrangeNeighbors(false, false, duration);
    if (!reducedMotion.matches && selectedCard) {
      // Follow the moving thumbnail while the gallery keeps accepting scroll input.
      await new Promise(resolve => {
        const start = performance.now();
        function returnToGallery(now) {
          const t = Math.min(1, (now - start) / duration);
          const ease = 1 - Math.pow(1 - t, 3);
          const to = selectedCard.querySelector('img').getBoundingClientRect();
          const mix = key => from[key] + (to[key] - from[key]) * ease;
          poster.style.transform = `translate(${mix('left')-resting.left}px,${mix('top')-resting.top}px) scale(${mix('width')/resting.width},${mix('height')/resting.height})`;
          if (t < 1) requestAnimationFrame(returnToGallery); else resolve();
        }
        returnToGallery(start);
      });
    }
    restoringFocus = true;
    dialog.close();
    selectedCard?.classList.remove('is-selected');
    (scrollDismissed ? grid : selectedCard)?.focus({preventScroll:true});
    restoringFocus = false;
    posterAnimation?.cancel();
    posterAnimation = null;
    poster.style.transform = '';
    clearNeighbors();
    selectedCard = null;
    closing = false;
  }

  function makeCard(film, index) {
    const card = document.createElement('button');
    card.className = 'film-card';
    card.type = 'button';
    card.setAttribute('aria-label', `View ${film.displayTitle}${film.year ? ` (${film.year})` : ''}`);
    const image = document.createElement('img');
    image.src = film.poster;
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    card.append(image);
    const caption = document.createElement('span');
    caption.className = 'film-caption';
    caption.textContent = film.title;
    caption.setAttribute('aria-hidden', 'true');
    card.append(caption);
    card.addEventListener('click', event => { if (!suppressClick || event.detail === 0) showFilm(film, card); });
    card.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setHovered(items[index]); });
    card.addEventListener('pointerleave', () => { if (hovered === items[index]) setHovered(null); });
    card.addEventListener('focus', () => {
      if (restoringFocus || reducedMotion.matches || !card.matches(':focus-visible')) return;
      const item = items[index];
      target = position + (item.x - width / 2) / rows[item.row].speed;
      schedule();
    });
    return { card, index, x: 0, row: 0, column: 0, hx:0, hy:0, zoom:1 };
  }

  function measure() {
    width = grid.clientWidth;
    height = grid.clientHeight;
    if (reducedMotion.matches) {
      resetHover();
      clearNeighbors();
      posterAnimation?.cancel();
      items.forEach(({card}) => { card.removeAttribute('style'); });
      return;
    }
    const rowCount = height > 820 ? 5 : height < 620 ? 3 : 4;
    spacing = Math.max(135, Math.min(245, width / 6.8));
    const top = width < 600 ? 95 : 110;
    const bottom = width < 600 ? 80 : 95;
    const rowHeight = (height - top - bottom) / rowCount;
    const posterHeight = Math.min(156, Math.max(54, rowHeight * .79));
    const offsets = [0, .38, -.12, .25, -.28];
    const speeds = [1, .94, 1.035, .975, 1.015];
    rows = Array.from({length:rowCount}, (_, r) => ({
      speed: speeds[r], offset: offsets[r] * spacing,
      count: Math.ceil((items.length - r) / rowCount)
    }));
    items.forEach((item, i) => {
      item.row = i % rowCount;
      item.column = Math.floor(i / rowCount);
      item.y = top + rowHeight * (item.row + .5);
      item.size = posterHeight * [1, .91, 1.03, .94, .98, .88, 1.04][i % 7];
      item.card.style.height = `${item.size}px`;
    });
    draw();
    if (dialog.open && !closing) {
      posterAnimation?.cancel();
      arrangeNeighbors(true, true);
    }
    schedule();
  }

  function draw() {
    if (reducedMotion.matches) return;
    for (const item of items) {
      const row = rows[item.row];
      // Each original poster wraps only outside the viewport, without cloned elements.
      const period = row.count * spacing;
      const x = mod(item.column * spacing + row.offset + width / 2 - position * row.speed + spacing, period) - spacing;
      item.x = x;
      const visible = x > -spacing / 2 && x < width + spacing / 2;
      item.card.style.visibility = visible ? 'visible' : 'hidden';
      const distance = Math.abs((x - width / 2) / (width * .5));
      const light = Math.exp(-Math.pow(distance / .49, 3.2));
      const depth = Math.min(1, distance);
      const scale = 1 - .12 * depth * depth;
      const bend = (item.row - (rows.length - 1) / 2) * 7 * depth * depth;
      item.card.style.transform = `translate3d(${x+item.hx}px,${item.y + bend+item.hy}px,0) translate(-50%,-50%) scale(${scale*item.zoom})`;
      item.card.style.setProperty('--presence', (.10 + .90 * light).toFixed(3));
      item.card.style.setProperty('--saturation', (.12 + .88 * light).toFixed(3));
    }
  }

  function animate(time) {
    frame = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    position += (target - position) * (1 - Math.exp(-dt / 125));
    if (Math.abs(target - position) < .06) position = target;
    animateHover(dt);
    draw();
    if (position !== target || hoverMoving) schedule(); else lastTime = 0;
  }
  function schedule() { if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(animate); }
  function move(delta) { target += delta; schedule(); }
  function browse(delta) {
    if (!delta) return;
    setHovered(null);
    if (dialog.open) {
      scrollDismissed = true;
      closeFilm();
    }
    move(delta);
  }
  function blocked() { return reducedMotion.matches || dialog.open || credits.open; }

  window.addEventListener('wheel', event => {
    if (reducedMotion.matches || credits.open || event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    browse(delta * unit * .7);
  }, {passive:false});
  window.addEventListener('keydown', event => {
    if (reducedMotion.matches || credits.open || event.altKey || event.metaKey || event.ctrlKey) return;
    const step = {ArrowRight:spacing, ArrowDown:spacing, ArrowLeft:-spacing, ArrowUp:-spacing, PageDown:width*.7, PageUp:-width*.7};
    if (step[event.key] !== undefined) { event.preventDefault(); browse(step[event.key]); }
  });
  dialog.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || reducedMotion.matches || event.target.closest('a,button')) return;
    dismissSwipe = {id:event.pointerId, x:event.clientX, y:event.clientY, started:false};
  });
  window.addEventListener('pointermove', event => {
    if (!dismissSwipe || event.pointerId !== dismissSwipe.id) return;
    const dx = dismissSwipe.x - event.clientX, dy = dismissSwipe.y - event.clientY;
    if (!dismissSwipe.started && Math.hypot(dx,dy) < 8) return;
    dismissSwipe.started = true;
    event.preventDefault();
    browse((Math.abs(dx) > Math.abs(dy) ? dx : dy) * 1.15);
    dismissSwipe.x = event.clientX;
    dismissSwipe.y = event.clientY;
  }, {passive:false});
  ['pointerup','pointercancel'].forEach(type => window.addEventListener(type, () => { dismissSwipe = null; }));
  grid.addEventListener('pointerdown', event => {
    if (blocked() || event.button !== 0) return;
    pointer = {id:event.pointerId, x:event.clientX, y:event.clientY, start:target, dragged:false};
    suppressClick = false;
  });
  grid.addEventListener('pointermove', event => {
    if (!pointer && event.pointerType === 'mouse') {
      const card = event.target.closest('.film-card');
      setHovered(card ? items.find(item => item.card === card) : null);
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = pointer.x - event.clientX, dy = pointer.y - event.clientY;
    if (!pointer.dragged && Math.hypot(dx,dy) > 6) {
      pointer.dragged = true;
      setHovered(null);
      grid.setPointerCapture(event.pointerId);
      grid.classList.add('is-dragging');
    }
    if (pointer.dragged) {
      target = pointer.start + (Math.abs(dx) >= Math.abs(dy) ? dx : dy) * 1.15;
      schedule();
    }
  });
  function endDrag() {
    if (pointer) suppressClick = pointer.dragged;
    pointer = null;
    grid.classList.remove('is-dragging');
  }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  grid.addEventListener('lostpointercapture', endDrag);
  document.querySelector('.credits-trigger').addEventListener('click', () => { setHovered(null); credits.showModal(); });
  dialog.querySelector('.dialog-close').addEventListener('click', closeFilm);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeFilm(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeFilm(); });
  [credits].forEach(modal => {
    modal.querySelector('.dialog-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
    });
  });
  window.addEventListener('resize', measure);
  reducedMotion.addEventListener('change', measure);

  async function init() {
    try {
      const response = await fetch('films-data.json');
      if (!response.ok) throw new Error(`Film list: ${response.status}`);
      const {films} = await response.json();
      if (!Array.isArray(films) || !films.length) throw new Error('Empty film list');
      items = films.map(makeCard);
      grid.append(...items.map(item => item.card));
      measure();
    } catch (error) {
      grid.classList.add('film-grid-error');
      grid.textContent = 'The film archive could not be loaded. Please refresh to try again.';
      console.error(error);
    }
  }
  init();
})();
