// =========================================================
// The cursor ribbon, shared by every page.
// A point on a loose spring chases the cursor (so it swings in
// in a soft curve); its recent path is drawn as a few fine strands that
// twist around each other and fade toward the tail, in blue light.
// Inner pages only: the landing page has no ribbon.
// =========================================================
(function () {
  if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.body.classList.contains('landing')) return;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  cv.className = 'ribbon'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  let W, H;
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener('resize', size); size();

  // strand colours: [core, edge] and how strong they get
  const look = { core: '170,200,255', edge: '72,122,240', a: .4, b: .5, blend: 'lighter', width: 1 };
  const N = 90, S = 7, pts = [];
  let tx = 0, ty = 0, px = 0, py = 0, vx = 0, vy = 0, running = false, started = false;

  function frame(t) {
    // stiff, well-damped spring: catches the cursor quickly with barely any overshoot
    vx = (vx + (tx - px) * .12) * .7; vy = (vy + (ty - py) * .12) * .7; px += vx; py += vy;
    pts.push([px, py]); if (pts.length > N) pts.shift();
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = look.blend; ctx.lineWidth = look.width;
    const n = pts.length;
    for (let s = 0; s < S; s++) {
      const k = (s - (S - 1) / 2) / ((S - 1) / 2), core = 1 - Math.abs(k);
      let ox, oy;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)], u = i / (N - 1);
        let nx = a[1] - b[1], ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const w = Math.sin(Math.PI * u) * 10 * Math.cos(u * 5 + t / 900) * k;
        const x = pts[i][0] + nx * w, y = pts[i][1] + ny * w;
        if (i) {
          ctx.strokeStyle = `rgba(${core > .5 ? look.core : look.edge},${Math.pow(u, 1.4) * (look.a + look.b * core)})`;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
        }
        ox = x; oy = y;
      }
    }
    // keep going until the ribbon has gathered back into the cursor
    const [hx, hy] = pts[0], still = Math.abs(vx) + Math.abs(vy) < .05 && Math.abs(hx - px) + Math.abs(hy - py) < .5;
    if (still) { ctx.clearRect(0, 0, W, H); running = false; } else requestAnimationFrame(frame);
  }
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!started) { started = true; px = tx; py = ty; }
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
})();
