// =========================================================
// The ink landscape on the landing page.
// Pen-line mountain ridges on paper. Moving the cursor over a
// ridge slowly reshapes the land around it into a new one, and
// the new shape stays until you reshape it again.
// =========================================================
(function () {
  const cv = document.querySelector('canvas.ink');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAPER = '#f2eee6', INK = '27,26,24', STEP = 4;
  let W, H, dpr, cols;

  // ---------- 2D value noise: x runs along the ridge, z is the "shape" axis the cursor pushes ----------
  const hash = (i, j, s) => {
    let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  function n2(x, z, s) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, s) {
    let t = 0, amp = 1, f = 1, n = 0;
    for (let o = 0; o < 6; o++) { t += n2(x * f, z + o * 7.3, s + o * 31) * amp; n += amp; amp *= .5; f *= 2.3; }
    return t / n;
  }
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // far → near: base height, amplitude, horizontal scale, line darkness
  const ridges = [
    { b: .6, a: .34, sc: 460, al: .14 }, { b: .645, a: .31, sc: 400, al: .2 }, { b: .69, a: .28, sc: 350, al: .27 },
    { b: .735, a: .24, sc: 310, al: .35 }, { b: .78, a: .2, sc: 280, al: .44 }, { b: .83, a: .16, sc: 250, al: .54 },
    { b: .88, a: .12, sc: 220, al: .64 }, { b: .935, a: .08, sc: 200, al: .74 },
  ].map((R, i) => ({ ...R, seed: 7 + i * 6 }));

  let z = [], zt = [], ys = [], tower = null;
  const env = X => .3 + .7 * sm(W * .15, W * .85, X); // taller toward the right, quiet behind the text

  function heights(i) {
    const R = ridges[i], out = ys[i];
    for (let c = 0; c < cols; c++) {
      const X = c * STEP - STEP, f = fbm(X / R.sc, z[i][c], R.seed);
      out[c] = H * R.b - H * R.a * env(X) * Math.pow(Math.max(0, f - .18) / .82, 1.7);
    }
  }

  function trace(y, off) {
    ctx.beginPath();
    for (let c = 0; c < cols; c++) { const X = c * STEP - STEP; c ? ctx.lineTo(X, y[c] + off) : ctx.moveTo(X, y[c] + off); }
  }

  function draw() {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ridges.forEach((R, i) => {
      heights(i); const y = ys[i];
      trace(y, 0); ctx.lineTo(W + STEP, H); ctx.lineTo(-STEP, H); ctx.closePath();
      ctx.fillStyle = PAPER; ctx.fill();
      if (i >= 4) { // faint contour lines inside the nearer mountains, like a survey map
        ctx.save(); ctx.clip(); ctx.lineWidth = .6;
        for (let k = 1; k <= 4; k++) { ctx.strokeStyle = `rgba(${INK},${R.al * .17 / k})`; trace(y, k * 9 + k * k * 2); ctx.stroke(); }
        ctx.restore();
      }
      ctx.lineWidth = .8; // the ridge itself: two slightly offset passes, like a pen line
      ctx.strokeStyle = `rgba(${INK},${R.al})`; trace(y, 0); ctx.stroke();
      ctx.strokeStyle = `rgba(${INK},${R.al * .45})`; trace(y, .6); ctx.stroke();
    });
    // one tiny fire-lookout tower standing on a peak
    const c = tower, tx = c * STEP - STEP, ty = ys[5][c];
    ctx.strokeStyle = `rgba(${INK},.75)`; ctx.fillStyle = PAPER; ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(tx - 5, ty + 1); ctx.lineTo(tx - 3, ty - 13); ctx.moveTo(tx + 5, ty + 1); ctx.lineTo(tx + 3, ty - 13);
    ctx.moveTo(tx - 4.4, ty - 4); ctx.lineTo(tx + 3.6, ty - 9); ctx.moveTo(tx + 4.4, ty - 4); ctx.lineTo(tx - 3.6, ty - 9);
    ctx.stroke();
    ctx.beginPath(); ctx.rect(tx - 4.5, ty - 19, 9, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 6, ty - 19); ctx.lineTo(tx, ty - 23); ctx.lineTo(tx + 6, ty - 19); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(${INK},.6)`; ctx.fillRect(tx - 2.5, ty - 17.5, 5, 2);
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = cv.offsetWidth; H = cv.offsetHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / STEP) + 3;
    const keep = z;
    z = ridges.map((_, i) => Float32Array.from({ length: cols }, (_, c) => keep[i]?.[Math.min(c, keep[i].length - 1)] ?? 0));
    zt = z.map(a => Float32Array.from(a)); ys = ridges.map(() => new Float32Array(cols));
    ridges.forEach((_, i) => heights(i));
    // put the tower on the highest point of the sixth ridge, toward the right
    let best = 1e9; for (let c = Math.round(cols * .7); c < cols * .9; c++) if (ys[5][c] < best) { best = ys[5][c]; tower = c; }
    draw();
  }

  // ---------- the cursor reshapes ridges near it ----------
  let lx = null, ly = null, running = false;
  function push(mx, my) {
    if (lx === null) { lx = mx; ly = my; return; }
    const speed = Math.min(Math.hypot(mx - lx, my - ly), 60); lx = mx; ly = my;
    const c0 = Math.round((mx + STEP) / STEP), span = Math.round(150 / STEP);
    ridges.forEach((R, i) => {
      const ry = ys[i][Math.max(0, Math.min(cols - 1, c0))], dy = (my - ry) / (H * .09);
      const fy = Math.exp(-dy * dy); if (fy < .02) return;
      for (let c = Math.max(0, c0 - span * 2); c < Math.min(cols, c0 + span * 2); c++) {
        const dx = (c - c0) / span; zt[i][c] += speed * .007 * fy * Math.exp(-dx * dx);
      }
    });
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    let moving = false;
    for (let i = 0; i < ridges.length; i++) for (let c = 0; c < cols; c++) {
      const d = zt[i][c] - z[i][c]; if (Math.abs(d) > .0005) { z[i][c] += d * .07; moving = true; }
    }
    draw();
    if (moving) requestAnimationFrame(tick); else running = false;
  }
  if (!reduce) {
    addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); push(e.clientX - r.left, e.clientY - r.top); }, { passive: true });
    document.addEventListener('pointerleave', () => { lx = ly = null; });
  }

  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 120); });
  size();
})();
