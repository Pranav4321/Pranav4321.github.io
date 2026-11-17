// =========================================================
// A project's CAD render on a sheet of survey paper (DIVA, SAAR).
// Each .spot marks a part. Its label is drawn at data-lx / data-ly
// (percent of the image) with a thin leader line back to the dot.
// Hovering a dot, a label or a row in the parts list lights up all three.
// The sheet tilts a few degrees toward the cursor, like holding a print.
// =========================================================
(function () {
  const box = document.querySelector('.render'), list = document.querySelector('.model-parts');
  if (!box) return;
  const sheet = box.querySelector('.sheet');
  const spots = [...box.querySelectorAll('.spot')], rows = list ? [...list.querySelectorAll('li')] : [];

  // leader lines (in % of the sheet) and labels
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'leads'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  sheet.insertBefore(svg, spots[0]);
  const tags = spots.map(s => {
    const x = parseFloat(s.style.left), y = parseFloat(s.style.top), lx = +s.dataset.lx, ly = +s.dataset.ly;
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', lx); ln.setAttribute('y2', ly); ln.dataset.part = s.dataset.part;
    svg.append(ln);
    const t = document.createElement('span');
    t.className = 'tag' + (lx < x ? ' end' : ''); t.textContent = s.getAttribute('aria-label'); t.dataset.part = s.dataset.part;
    t.style.left = lx + '%'; t.style.top = ly + '%'; t.setAttribute('aria-hidden', 'true');
    sheet.append(t);
    return [t, ln];
  }).flat();

  const setActive = p => {
    box.classList.toggle('focus', !!p);
    [...spots, ...rows, ...tags].forEach(el => el.classList.toggle('on', el.dataset.part === p));
  };
  rows.forEach(r => r.tabIndex = 0);
  [...spots, ...rows, ...tags.filter(t => t.tagName === 'SPAN')].forEach(el => {
    el.addEventListener('pointerenter', () => setActive(el.dataset.part));
    el.addEventListener('pointerleave', () => setActive(null));
    el.addEventListener('focus', () => setActive(el.dataset.part));
    el.addEventListener('blur', () => setActive(null));
  });

  // gentle tilt toward the cursor (skipped for touch and reduced motion)
  if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const amt = box.classList.contains('wide') ? [3, 5] : [6, 8];
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const step = () => {
    x += (tx - x) * .12; y += (ty - y) * .12;
    sheet.style.transform = `rotateX(${(-y * amt[0]).toFixed(2)}deg) rotateY(${(x * amt[1]).toFixed(2)}deg)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > .002 ? requestAnimationFrame(step) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; go();
  });
  box.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
})();
