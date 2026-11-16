// =========================================================
// DIVA, drawn as a turnable contour-line model.
// The figure is only horizontal contour lines, like the ridges on the
// landing page. Each line knows which way its surface faces, so lines
// on the edges of the body (the silhouette) glow and lines facing you
// fade. That gives a soft, rim-lit form instead of a wire mesh.
// Drag to turn it; hover a numbered pin or a row in the parts list.
// The stereo camera's view ends in a 5×5 depth grid; an "obstacle"
// drifts across it, and the same cells rise as pins on the hand unit.
// =========================================================
(function () {
  const cv = document.getElementById('divaModel');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const stage = cv.parentElement, pinsEl = document.getElementById('divaPins'), list = document.getElementById('divaParts');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const norm = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };

  // ---------- geometry: each part is a list of segments [a, b, normal?] (units ≈ cm, y up, z toward you) ----------
  const G = {};
  // surfaces are also kept as stacks of rings, so their silhouette can be traced each frame
  const stacks = []; let cur = null;
  // outline: 'closed' (head, hands), 'sides' (neck, torso, arms) or 'none' (joints)
  const stack = (part, fn, outline = 'sides') => { cur = []; fn(); stacks.push({ part, rings: cur, outline }); cur = null; };
  const seg = (part, a, b, n) => (G[part] ||= []).push([a, b, n]);
  const line = (part, pts, closed) => { for (let i = 1; i < pts.length; i++) seg(part, pts[i - 1], pts[i]); if (closed) seg(part, pts[pts.length - 1], pts[0]); };
  const loop = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * TAU));
  // a horizontal ring on a surface; ny is how much the surface faces up (+) or down (−) there
  function ring(part, cx, cy, cz, rx, rz, ny = 0, n = 48) {
    const h = Math.sqrt(Math.max(0, 1 - ny * ny));
    const pt = a => [cx + rx * Math.sin(a), cy, cz + rz * Math.cos(a)];
    if (cur) cur.push(Array.from({ length: n }, (_, i) => pt(i / n * TAU)));
    for (let i = 0; i < n; i++) {
      const a = (i + .5) / n * TAU, nn = norm([Math.sin(a) / rx, 0, Math.cos(a) / rz]);
      seg(part, pt(i / n * TAU), pt((i + 1) / n * TAU), [nn[0] * h, ny, nn[2] * h]);
    }
  }
  const face = (part, cx, cy, z, r, n = 18) => line(part, loop(n, a => [cx + r * Math.cos(a), cy + r * Math.sin(a), z]), true);
  function box(part, cx, cy, cz, w, h, d, r = 0) {
    // a box with softly rounded vertical edges (r) so the cases don't look like wire cubes
    const x = [cx - w / 2, cx + w / 2], y = [cy - h / 2, cy + h / 2], z = [cz - d / 2, cz + d / 2];
    for (const Y of y) for (const Z of z) seg(part, [x[0] + r, Y, Z], [x[1] - r, Y, Z]);
    for (const X of x) for (const Z of z) seg(part, [X, y[0] + r, Z], [X, y[1] - r, Z]);
    for (const X of x) for (const Y of y) seg(part, [X, Y, z[0]], [X, Y, z[1]]);
    if (r) for (const Z of z) for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const ox = cx + sx * (w / 2 - r), oy = cy + sy * (h / 2 - r);
      line(part, Array.from({ length: 5 }, (_, i) => { const a = i / 4 * Math.PI / 2; return [ox + sx * r * Math.cos(a), oy + sy * r * Math.sin(a), Z]; }));
    }
  }
  function blob(part, c, r, rings = 9, n = 32) { // ellipsoid as stacked rings
    for (let k = 1; k < rings; k++) { const s = -1 + 2 * k / rings, f = Math.sqrt(1 - s * s); ring(part, c[0], c[1] + r[1] * s, c[2], r[0] * f, r[2] * f, s, n); }
  }
  function limb(part, a, b, r0, r1, step = 1.5) { // a tapered tube drawn as rings only
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), u = d.map(v => v / L);
    const t = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const p = norm([u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]]);
    const q = [u[1] * p[2] - u[2] * p[1], u[2] * p[0] - u[0] * p[2], u[0] * p[1] - u[1] * p[0]];
    const rings = Math.max(2, Math.round(L / step)), n = 28;
    for (let i = 0; i <= rings; i++) {
      const s = i / rings, r = r0 + (r1 - r0) * s, c = a.map((v, k) => v + d[k] * s);
      const at = ang => [0, 1, 2].map(k => c[k] + (p[k] * Math.cos(ang) + q[k] * Math.sin(ang)) * r);
      if (cur) cur.push(Array.from({ length: n }, (_, j) => at(j / n * TAU)));
      for (let j = 0; j < n; j++) { const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, m = (a0 + a1) / 2; seg(part, at(a0), at(a1), [0, 1, 2].map(k => p[k] * Math.cos(m) + q[k] * Math.sin(m))); }
    }
  }

  // ----- the figure -----
  // head: a crown, a narrower jaw that sits slightly forward
  const head = s => { const f = Math.sqrt(Math.max(0, 1 - s * s)), jaw = s < -.25 ? 1 - .3 * (-.25 - s) / .75 : 1; return [7.3 * f * jaw, 8.9 * f, .4 + (s < -.2 ? .9 * (-s - .2) : 0) - (s > .5 ? .6 * (s - .5) : 0)]; };
  stack('body', () => { for (let k = -15; k <= 15; k++) { const s = k / 16, [w, d, zc] = head(s); ring('body', 0, 157 + 10.5 * s, zc, w, d, s * .9); } }, 'closed');
  line('body', [[0, 158.6, 9.2], [0, 155.4, 10.9], [0, 154.7, 9.6]]); // nose
  [-1, 1].forEach(sx => line('body', loop(16, a => [sx * 7.25, 156.6 + 2.3 * Math.cos(a), -.6 + 1.3 * Math.sin(a)]), true)); // ears
  // neck
  stack('body', () => { for (let y = 148; y >= 141.5; y -= 1.5) ring('body', 0, y, -.6, 4.4, 4.2, 0, 32); });
  // torso: rings from a profile [y, half-width, half-depth, centre z]; chest forward, back flatter
  const prof = [[143.5, 4.4, 4.2, -.6], [141, 8, 5.5, -.8], [139, 13.5, 7, -.8], [137, 17, 8.6, -.6], [134, 18.6, 9.6, -.3], [130, 18.4, 10.6, .2], [125, 17.6, 11.2, .8], [119, 16.6, 11, .8], [113, 15.4, 10.2, .4], [106, 14.2, 9.4, 0], [99, 13.6, 9, 0], [92, 14.4, 9.4, -.2], [85, 15.4, 10, -.3], [79, 15.8, 10.2, -.3]];
  const torso = y => { for (let i = 1; i < prof.length; i++) if (y >= prof[i][0]) { const A = prof[i - 1], B = prof[i], t = (A[0] - y) / (A[0] - B[0]), e = t * t * (3 - 2 * t); return [1, 2, 3].map(j => A[j] + (B[j] - A[j]) * e); } return prof[prof.length - 1].slice(1); };
  stack('body', () => { for (let y = 143; y >= 79; y -= 1.7) {
    const [w, d, zc] = torso(y), slope = (torso(y - .5)[0] - torso(y + .5)[0]); // how fast it widens going down
    ring('body', 0, y, zc, w, d, Math.max(-.9, Math.min(.9, slope / Math.hypot(1, slope))), 64);
  } });
  // arms: shoulder caps and elbows, one arm hanging, one bent forward with the hand on the tactile unit
  const S = (part, f, ...a) => stack(part, () => f(part, ...a), f === blob ? 'none' : 'sides');
  const C = (part, f, ...a) => stack(part, () => f(part, ...a), 'closed');
  [-1, 1].forEach(sx => S('body', blob, [sx * 17.2, 132.8, -.2], [4.8, 4.6, 4.8], 8, 28));
  S('body', limb, [-18.6, 131, -.3], [-20.8, 108, -1.2], 4.3, 3.4); S('body', blob, [-20.8, 108, -1.2], [3.4, 3.4, 3.4], 6, 24);
  S('body', limb, [-20.8, 108, -1.2], [-21.2, 85.5, 1], 3.3, 2.5); C('body', blob, [-21.3, 81, 1.4], [1.5, 4.3, 2.6], 9, 22);
  S('body', limb, [18.6, 131, -.3], [20.6, 109, 0], 4.3, 3.4); S('body', blob, [20.6, 109, 0], [3.4, 3.4, 3.4], 6, 24);
  S('body', limb, [20.6, 109, 0], [10.4, 103.6, 17.6], 3.3, 2.5);
  C('palm', blob, [7.4, 104.1, 22.4], [3.9, 1.1, 5.2], 6, 30); // the right hand, palm down on the pins
  // harness straps from the chest case over the shoulders
  [-1, 1].forEach(sx => line('strap', [[sx * 5, 127.5, 13], [sx * 8.5, 135, 9.8], [sx * 10, 139.8, 2], [sx * 9.5, 137, -8.4], [sx * 7, 125, -10.8], [sx * 6, 112, -9.8]]));
  // a turntable under the figure
  line('base', loop(96, a => [24 * Math.sin(a), 77.5, 24 * Math.cos(a)]), true);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = i % 6 ? 23 : 21.5; seg('base', [r * Math.sin(a), 77.5, r * Math.cos(a)], [24 * Math.sin(a), 77.5, 24 * Math.cos(a)]); }

  // ----- the device -----
  // headband with the OAK-D Lite at the front, the RGB camera at the temple
  ring('stereo', 0, 160.8, .2, 7.95, 9.4, 0, 44); ring('stereo', 0, 163.4, .1, 7.6, 9.1, 0, 44);
  box('stereo', 0, 162.1, 10.6, 10, 2.8, 2.2, .6); face('stereo', -3.4, 162.1, 11.7, .75); face('stereo', 3.4, 162.1, 11.7, .75); face('stereo', 0, 162.1, 11.7, .35, 10);
  box('rgb', -5.6, 162.1, 7.8, 2.6, 2.6, 1.8, .4); face('rgb', -5.6, 162.1, 8.7, .7, 14);
  [-1, 1].forEach(sx => blob('ears', [sx * 7.9, 156.4, -.6], [.9, 1.2, 1.2], 5, 14));
  // chest: one case holding the Raspberry Pi (top) and the LCD (front, lower half), cable up to the headband
  box('pi', 0, 120, 13, 11.5, 15, 2.8, 1.2);
  for (let i = 0; i < 5; i++) seg('pi', [-3.2 + i * 1.6, 126, 14.45], [-3.2 + i * 1.6, 123.4, 14.45]); // vents over the Pi
  line('pi', [[7.8, 160.6, -2], [9.2, 150, -3.4], [11.2, 141.4, 1], [9, 131, 9], [4.5, 127.5, 12.4]]);
  box('lcd', 0, 116.4, 14.45, 8.6, 5, .02, .5);
  // hand unit: a base board; the 25 pins are animated each frame
  const HU = [7.4, 101.4, 22.4], HUs = 9, HUh = 1.6;
  box('hand', HU[0], HU[1], HU[2], HUs, HUh, HUs); box('hand', HU[0], HU[1] - 1.3, HU[2], HUs - 1, .8, HUs - 1);
  // the stereo camera's field of view, ending in a 5×5 depth grid
  const EYE = [0, 162.1, 11.8], FZ = 36, FC = [0, 156.5], FW = 11, FH = 8.2;
  const corner = (u, v) => [FC[0] + u * FW, FC[1] + v * FH, FZ];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => seg('fov', EYE, corner(u, v)));
  for (let i = 0; i <= 5; i++) { const t = -1 + i * .4; seg('fov', corner(t, -1), corner(t, 1)); seg('fov', corner(-1, t), corner(1, t)); }

  // where each numbered pin sits, in the same order as the parts list
  const anchors = { stereo: [0, 164.2, 11.8], rgb: [-5.6, 164.2, 8.7], ears: [-8.9, 156.4, -.6], pi: [6.2, 126.2, 14.4], lcd: [4.6, 114.2, 14.5], hand: [11.6, 101, 27] };
  const order = [...list.querySelectorAll('li')].map(li => li.dataset.part);

  // ---------- view ----------
  let W, H, k, yaw = .62, pitch = .14, vyaw = 0, active = null;
  const glow = {}; order.forEach(p => glow[p] = 0);
  const CY = 124, CAM = 240;
  let cyw, syw, cpt, spt;
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2); W = stage.clientWidth; H = stage.clientHeight;
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    k = Math.min(H * .88 / 96, W * .9 / 62);
  }
  const rot = ([x, y, z]) => { const X = x * cyw + z * syw, Z0 = -x * syw + z * cyw; return [X, y * cpt - Z0 * spt, y * spt + Z0 * cpt]; };
  function project(p) {
    const [X, Y, Z] = rot([p[0], p[1] - CY, p[2]]), f = CAM / (CAM - Z);
    return [W / 2 + X * k * f, H / 2 - Y * k * f, Z];
  }

  // the obstacle: how "close" each of the 25 cells is right now (0 = clear, 1 = blocked)
  function grid(t) {
    const cx = 2 + 1.9 * Math.sin(t / 2300), cy = 2 + 1.6 * Math.sin(t / 3100 + 1), g = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) g.push(reduce ? (i >= 3 && j >= 2 && j <= 3 ? 1 : 0) : Math.max(0, 1 - Math.hypot(i - cx, j - cy) / 1.7));
    return g; // index i * 5 + j: column i (left → right), row j (top → bottom)
  }
  function pinSegs(g) {
    const segs = [], y0 = HU[1] + HUh / 2;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const x = HU[0] + (i - 2) * 1.6, z = HU[2] + (2 - j) * 1.6, h = .2 + g[i * 5 + j] * 1.1;
      segs.push([[x, y0, z], [x, y0 + h, z]]);
      const r = .42; for (let a = 0; a < 8; a++) { const t0 = a / 8 * TAU, t1 = (a + 1) / 8 * TAU; segs.push([[x + r * Math.sin(t0), y0 + h, z + r * Math.cos(t0)], [x + r * Math.sin(t1), y0 + h, z + r * Math.cos(t1)]]); }
    }
    return segs;
  }

  // Lines are grouped into brightness buckets so each frame is only a handful of strokes.
  // Surface lines (with a normal) are weighted by how edge-on they are; others by depth.
  function stroke(segs, rgb, base, width) {
    const B = 8, buckets = Array.from({ length: B }, () => []);
    for (const [a, b, n] of segs) {
      const A = project(a), P = project(b);
      let w;
      if (n) { const nz = rot(n)[2], rim = 1 - Math.abs(nz); w = (nz > 0 ? .8 : .25) * (.06 + .94 * rim * rim * rim); }
      else w = .35 + .65 * Math.max(0, Math.min(1, ((A[2] + P[2]) / 2 + 18) / 34));
      if (w < .04) continue;
      buckets[Math.min(B - 1, Math.floor(w * B))].push(A, P);
    }
    ctx.lineWidth = width;
    buckets.forEach((pts, i) => {
      if (!pts.length) return;
      ctx.strokeStyle = `rgba(${rgb},${base * (i + .5) / B})`;
      ctx.beginPath(); for (let n = 0; n < pts.length; n += 2) { ctx.moveTo(pts[n][0], pts[n][1]); ctx.lineTo(pts[n + 1][0], pts[n + 1][1]); } ctx.stroke();
    });
  }

  // trace each surface's outline: per ring, the two points furthest out across the stack's on-screen axis
  function outlines(part, rgb, a, width) {
    ctx.lineWidth = width; ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const st of stacks) {
      if (st.part !== part || st.outline === 'none') continue;
      const P = st.rings.map(r => r.map(project));
      const c0 = P[0].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]), c1 = P[P.length - 1].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
      let ax = (c1[0] - c0[0]), ay = (c1[1] - c0[1]); const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
      const L = [], R = [];
      P.forEach(r => { let lo = r[0], hi = r[0], mn = Infinity, mx = -Infinity; r.forEach(p => { const d = -ay * p[0] + ax * p[1]; if (d < mn) { mn = d; lo = p; } if (d > mx) { mx = d; hi = p; } }); L.push(lo); R.push(hi); });
      if (st.outline === 'closed') { // one closed curve: down one side, back up the other
        L.concat(R.reverse()).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      } else for (const side of [L, R]) side.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    }
    ctx.stroke();
  }

  const marks = order.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'model-pin'; b.textContent = i + 1; b.dataset.part = p;
    b.setAttribute('aria-label', list.querySelector(`[data-part="${p}"] b`).textContent);
    pinsEl.append(b); return b;
  });

  function draw(t) {
    cyw = Math.cos(yaw); syw = Math.sin(yaw); cpt = Math.cos(pitch); spt = Math.sin(pitch);
    ctx.clearRect(0, 0, W, H);
    const dim = active ? .5 : 1, g = grid(t);
    stroke(G.base, '143,170,220', .3, .7);
    stroke(G.body, '160,186,235', .75 * dim, .75);
    stroke(G.palm, '160,186,235', .6 * dim, .75);
    outlines('body', '170,196,245', .5 * dim, 1); outlines('palm', '170,196,245', .4 * dim, .9);
    stroke(G.strap, '143,170,220', .4 * dim, .9);
    // field of view: cells that are "blocked" glow on the far grid
    const fv = .6 + .4 * glow.stereo + .4 * glow.hand;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const v = g[i * 5 + j]; if (v < .05) continue;
      const u0 = -1 + i * .4, v0 = 1 - j * .4, p = [corner(u0, v0), corner(u0 + .4, v0), corner(u0 + .4, v0 - .4), corner(u0, v0 - .4)].map(project);
      ctx.fillStyle = `rgba(143,180,255,${v * .26 * fv})`;
      ctx.beginPath(); p.forEach(([x, y], n) => n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
    }
    stroke(G.fov, '143,180,255', .5 * fv * (active ? .7 : 1), .75);
    for (const p of order) {
      glow[p] += ((active === p ? 1 : 0) - glow[p]) * .18;
      const gl = glow[p], segs = p === 'hand' ? G.hand.concat(pinSegs(g)) : G[p];
      stroke(segs, gl > .05 ? '215,228,255' : '150,185,255', (.75 + .25 * gl) * (active && active !== p ? .4 : 1), .9 + .9 * gl);
    }
    marks.forEach(m => {
      const [x, y, z] = project(anchors[m.dataset.part]);
      m.style.transform = `translate(${x}px, ${y}px)`;
      m.classList.toggle('behind', z < -2);
    });
  }

  // ---------- interaction ----------
  let drag = null, idle = 0, visible = true, last = 0;
  stage.addEventListener('pointerdown', e => { if (e.target.closest('.model-pin')) return; drag = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    yaw += dx * .01; vyaw = dx * .01; pitch = Math.max(-.35, Math.min(.5, pitch + dy * .005)); idle = 0;
  });
  const end = () => { drag = null; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  const setActive = p => {
    active = p;
    list.querySelectorAll('li').forEach(li => li.classList.toggle('on', li.dataset.part === p));
    marks.forEach(m => m.classList.toggle('on', m.dataset.part === p));
  };
  [...marks, ...list.querySelectorAll('li')].forEach(el => {
    el.addEventListener('pointerenter', () => setActive(el.dataset.part));
    el.addEventListener('pointerleave', () => setActive(null));
    el.addEventListener('focus', () => setActive(el.dataset.part));
    el.addEventListener('blur', () => setActive(null));
  });
  list.querySelectorAll('li').forEach(li => li.tabIndex = 0);

  function frame(t) {
    const dt = Math.min(50, t - (last || t)); last = t;
    if (!drag) {
      vyaw *= .92; yaw += vyaw; idle += dt;
      if (!reduce && !active && idle > 1500) yaw += dt * .00012; // a slow turn when no one is touching it
    }
    draw(t);
    if (visible) requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) { last = 0; requestAnimationFrame(frame); } }).observe(stage);
  addEventListener('resize', size);
  size(); requestAnimationFrame(frame);
})();
