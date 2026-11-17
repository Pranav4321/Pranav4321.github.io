// =========================================================
// The DIVA render on its sheet of paper.
// Hovering a dot on the render or a row in the parts list lights up both.
// The sheet tilts a few degrees toward the cursor, like holding a print.
// =========================================================
(function () {
  const box = document.getElementById('divaRender'), list = document.getElementById('divaParts');
  if (!box || !list) return;
  const sheet = box.querySelector('.sheet');
  const spots = [...box.querySelectorAll('.spot')], rows = [...list.querySelectorAll('li')];

  const setActive = p => {
    box.classList.toggle('focus', !!p);
    spots.forEach(s => s.classList.toggle('on', s.dataset.part === p));
    rows.forEach(r => r.classList.toggle('on', r.dataset.part === p));
  };
  rows.forEach(r => r.tabIndex = 0);
  [...spots, ...rows].forEach(el => {
    el.addEventListener('pointerenter', () => setActive(el.dataset.part));
    el.addEventListener('pointerleave', () => setActive(null));
    el.addEventListener('focus', () => setActive(el.dataset.part));
    el.addEventListener('blur', () => setActive(null));
  });

  // gentle tilt toward the cursor (skipped for touch and reduced motion)
  if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const step = () => {
    x += (tx - x) * .12; y += (ty - y) * .12;
    sheet.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > .002 ? requestAnimationFrame(step) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; go();
  });
  box.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
})();
