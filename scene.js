// =========================================================
// The landscape at the top of every page.
// The sky follows the real time in Baltimore. By day a small
// flock of birds sometimes crosses; at night fireflies drift
// over the hills. Grass sways and parts around the cursor.
// Preview any hour by adding ?h=18.5 to the URL.
// =========================================================
(function () {
  const hero = document.querySelector('.scene-hero');
  const cv = hero && hero.querySelector('.scene');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W, H;
  const bg = document.createElement('canvas'), bctx = bg.getContext('2d');

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgb = (c, a = 1) => `rgba(${c.map(Math.round)},${a})`;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------- time of day in Baltimore ----------
  function baltimoreHour() {
    const p = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'America/New_York' }).formatToParts(new Date());
    return (+p.find(x => x.type === 'hour').value % 24) + (+p.find(x => x.type === 'minute').value) / 60;
  }
  const q = new URLSearchParams(location.search);
  const forced = q.has('h') ? +q.get('h') : null;
  const hour = () => forced ?? baltimoreHour();

  // sky colours through the day: [hour, top, horizon]
  const skyKeys = [[0, '#0a1022', '#1b2444'], [5, '#141b3a', '#3d3f66'], [6.3, '#3e4f80', '#eab08c'], [7.5, '#7ea6d0', '#f1dcc0'], [12, '#6d9fd4', '#d6e7f2'],
    [16.5, '#7aa1cb', '#f0dcb8'], [18.4, '#4a5b92', '#f2a77c'], [19.4, '#2a3264', '#a86c7f'], [20.6, '#111735', '#2c3157'], [24, '#0a1022', '#1b2444']];
  function skyAt(h) {
    for (let i = 0; i < skyKeys.length - 1; i++) {
      const [a, t1, h1] = skyKeys[i], [b, t2, h2] = skyKeys[i + 1];
      if (h >= a && h <= b) { const t = (h - a) / (b - a); return [mix(hex(t1), hex(t2), t), mix(hex(h1), hex(h2), t)]; }
    }
    return [hex('#0a1022'), hex('#1b2444')];
  }
  const daylight = h => smooth(5.6, 7.6, h) * (1 - smooth(18.6, 20.4, h));
  const warmth = h => Math.max(1 - Math.abs(h - 6.6) / 1.3, 1 - Math.abs(h - 18.9) / 1.4, 0);

  // ---------- terrain (seeded so it looks the same on every visit) ----------
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const layers = [ // base height (fraction of the scene), amplitude, wave frequencies, colour, haze, trees
    { base: .56, amp: .11, f: [1.3, 3.1, 7.7], green: '#7d97a6', haze: .62, trees: 0 },
    { base: .63, amp: .08, f: [1.9, 4.3, 9.1], green: '#5f7f6c', haze: .42, trees: 0 },
    { base: .70, amp: .05, f: [2.4, 6.2, 13], green: '#3e5c47', haze: .24, trees: 'pine' },
    { base: .80, amp: .035, f: [1.6, 3.7, 8.3], green: '#30493a', haze: .12, trees: 'round' },
    { base: .905, amp: .018, f: [1.1, 2.9, 6.1], green: '#22352a', haze: 0, trees: 0 },
  ].map(L => ({ ...L, p: [rnd() * 6, rnd() * 6, rnd() * 6], seedTrees: Array.from({ length: 400 }, () => rnd()) }));
  const ridge = (L, x) => H * (L.base - L.amp * (.6 * Math.sin(x / W * L.f[0] * Math.PI + L.p[0]) + .28 * Math.sin(x / W * L.f[1] * Math.PI + L.p[1]) + .12 * Math.sin(x / W * L.f[2] * Math.PI + L.p[2])));
  const nightTint = hex('#0b1013');
  function layerColor(L, i, h, hor) {
    const d = daylight(h);
    let c = mix(hex(L.green), hor, L.haze * (.6 + .4 * d));
    c = mix(c, nightTint, (1 - d) * (.62 + i * .07));
    return mix(c, hex('#8a5b4a'), warmth(h) * .12 * (1 - i / 5));
  }

  let paintedAt = -1, groundColor = hex('#22352a');
  function paintStatic() {
    const h = hour(), [top, hor] = skyAt(h);
    bg.width = W * dpr; bg.height = H * dpr; bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = bctx.createLinearGradient(0, 0, 0, H * .75);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(hor));
    bctx.fillStyle = g; bctx.fillRect(0, 0, W, H);

    // a soft glow where the sun or moon sits
    const day = h >= 6 && h <= 19.3, f = day ? (h - 6) / 13.3 : ((h > 19.3 ? h - 19.3 : h + 4.7) / 10.7);
    const sx = W * (.12 + f * .76), sy = H * (.62 - Math.sin(f * Math.PI) * .48);
    const glow = bctx.createRadialGradient(sx, sy, 0, sx, sy, H * .5);
    glow.addColorStop(0, day ? `rgba(255,236,200,${.55 + warmth(h) * .3})` : 'rgba(210,220,255,.18)');
    glow.addColorStop(1, 'rgba(255,236,200,0)');
    bctx.fillStyle = glow; bctx.fillRect(0, 0, W, H);
    // draw the disc itself only where it won't sit on top of the page title
    const hr = hero.getBoundingClientRect();
    const overText = [...hero.querySelectorAll('.hero-text .wrap > *')].some(el => {
      const r = el.getBoundingClientRect(), x = r.left - hr.left, y = r.top - hr.top;
      return sx > x - 30 && sx < x + r.width + 30 && sy > y - 30 && sy < y + r.height + 30;
    });
    if (!overText) {
      bctx.fillStyle = day ? 'rgba(255,248,232,.9)' : 'rgba(236,236,226,.85)';
      bctx.beginPath(); bctx.arc(sx, sy, day ? 16 : 10, 0, 7); bctx.fill();
    }

    layers.forEach((L, i) => {
      const c = layerColor(L, i, h, hor);
      bctx.fillStyle = rgb(c); bctx.beginPath(); bctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) bctx.lineTo(x, ridge(L, x));
      bctx.lineTo(W, H); bctx.fill();
      if (L.trees) {
        let k = 0;
        for (let x = -10; x < W + 10;) {
          const r = L.seedTrees[k++ % 400], y = ridge(L, x) + 2;
          if (L.trees === 'pine') {
            const th = 10 + r * 16, tw = th * .38;
            bctx.beginPath(); bctx.moveTo(x - tw, y); bctx.lineTo(x, y - th); bctx.lineTo(x + tw, y); bctx.fill();
            x += 3 + r * 7;
          } else {
            if (r > .45) {
              const rr = 7 + r * 9;
              bctx.beginPath(); bctx.arc(x, y - rr * .6, rr, 0, 7); bctx.arc(x + rr * .7, y - rr * .4, rr * .8, 0, 7); bctx.arc(x - rr * .6, y - rr * .3, rr * .7, 0, 7); bctx.fill();
            }
            x += 14 + r * 40;
          }
        }
      }
      if (i === layers.length - 1) groundColor = c;
    });

    // the page below takes a calmer version of the front hill's colour
    const page = mix(groundColor, hex('#141615'), .55);
    document.documentElement.style.setProperty('--page', rgb(page));
    const behindText = mix(top, hor, .35); // roughly the sky colour behind the title
    const lum = behindText[0] * .3 + behindText[1] * .59 + behindText[2] * .11;
    document.documentElement.style.setProperty('--hero-ink', lum > 150 ? '#14201a' : '#f6f3ea');
    const when = document.getElementById('when');
    if (when) {
      const name = h < 5 ? 'night' : h < 7 ? 'dawn' : h < 11 ? 'morning' : h < 16 ? 'afternoon' : h < 18.6 ? 'golden hour' : h < 20.2 ? 'dusk' : 'night';
      const t = forced !== null ? `${(Math.floor(h) % 12) || 12}:${String(Math.round(h % 1 * 60)).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
        : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date());
      when.textContent = `Baltimore · ${t} · ${name}`;
    }
    paintedAt = h;
  }

  // ---------- small living details ----------
  let stars = [], clouds = [], flies = [], flock = null, nextFlock = 0, blades = [];
  function initLife() {
    s = 99;
    stars = Array.from({ length: Math.round(W / 8) }, () => ({ x: rnd() * W, y: rnd() * H * .55, r: rnd() * 1.2 + .3, p: rnd() * 6 }));
    clouds = Array.from({ length: 4 }, () => ({ x: rnd() * W, y: H * (.1 + rnd() * .25), w: 160 + rnd() * 220, v: .08 + rnd() * .12 }));
    flies = Array.from({ length: Math.round(W / 42) }, () => ({ x: rnd() * W, y: H * (.72 + rnd() * .24), vx: 0, vy: 0, p: rnd() * 6 }));
    blades = []; const L = layers[layers.length - 1];
    for (let x = 0; x <= W; x += 3) blades.push({ x, base: ridge(L, x) + 1, h: 5 + rnd() * 11, p: rnd() * 6 });
  }
  let mx = -999, my = -999, wind = 0, lastX = null;
  addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
    if (lastX !== null) wind = clamp(wind + (e.clientX - lastX) * .006, -1.5, 1.5);
    lastX = e.clientX;
  }, { passive: true });
  hero.addEventListener('mouseleave', () => { mx = my = -999; });

  function spawnFlock() {
    const n = 6 + Math.floor(Math.random() * 5), dir = Math.random() < .5 ? 1 : -1, y = H * (.14 + Math.random() * .22);
    flock = { dir, birds: Array.from({ length: n }, (_, i) => ({ x: (dir > 0 ? -40 : W + 40) - dir * (Math.abs(i - n / 2) * 18), y: y + Math.abs(i - n / 2) * 9 + (Math.random() - .5) * 8, vy: 0, p: Math.random() * 6, sz: 5 + Math.random() * 2.5 })) };
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible) return;
    if (Math.abs(hour() - paintedAt) > 1 / 60) paintStatic();
    const h = hour(), d = daylight(h); wind *= .97;
    ctx.drawImage(bg, 0, 0, W, H);

    if (d < .6) { // stars
      ctx.fillStyle = '#fff';
      stars.forEach(st => { ctx.globalAlpha = (1 - d / .6) * (.35 + .65 * Math.abs(Math.sin(t / 1600 + st.p))); ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    if (d > .15) clouds.forEach(c => { // soft clouds
      c.x += c.v; if (c.x - c.w > W) c.x = -c.w;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w * .5);
      g.addColorStop(0, `rgba(255,255,255,${.3 * d})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.scale(1, .5); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y / .5, c.w * .5, 0, 7); ctx.fill(); ctx.restore();
    });
    if (d > .25) { // birds, which swerve away from the cursor
      if (!flock && t > nextFlock) spawnFlock();
      if (flock) {
        let out = true;
        ctx.strokeStyle = `rgba(30,36,40,${.55 * d + .15})`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        flock.birds.forEach(b => {
          b.x += flock.dir * 1.15;
          const dx = b.x - mx, dy = b.y - my, dist = Math.hypot(dx, dy);
          if (dist < 140) b.vy += (dy > 0 ? 1 : -1) * (140 - dist) * .004;
          b.vy *= .95; b.y += b.vy + Math.sin(t / 700 + b.p) * .12;
          const flap = Math.sin(t / 110 + b.p) * b.sz * .6;
          ctx.beginPath(); ctx.moveTo(b.x - b.sz, b.y - flap); ctx.quadraticCurveTo(b.x - b.sz * .4, b.y - 1, b.x, b.y + 1);
          ctx.quadraticCurveTo(b.x + b.sz * .4, b.y - 1, b.x + b.sz, b.y - flap); ctx.stroke();
          if (b.x > -60 && b.x < W + 60) out = false;
        });
        if (out) { flock = null; nextFlock = t + 9000 + Math.random() * 14000; }
      }
    }
    if (d < .4) { // fireflies, drawn gently toward the cursor
      const a = 1 - d / .4;
      flies.forEach(f => {
        const dx = mx - f.x, dy = my - f.y, dist = Math.hypot(dx, dy);
        if (dist < 220) { f.vx += dx / dist * .03; f.vy += dy / dist * .03; }
        f.vx += (Math.random() - .5) * .08; f.vy += (Math.random() - .5) * .08; f.vx *= .96; f.vy *= .96; f.x += f.vx; f.y += f.vy;
        if (f.y < H * .62) f.vy += .05; if (f.y > H) f.vy -= .1; if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
        const blink = Math.max(0, Math.sin(t / 650 + f.p));
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
        g.addColorStop(0, `rgba(246,232,150,${a * blink})`); g.addColorStop(1, 'rgba(246,232,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, 7); ctx.fill();
      });
    }
    // grass along the front hill
    ctx.strokeStyle = rgb(groundColor); ctx.lineWidth = 1.6; ctx.beginPath();
    blades.forEach(b => {
      let bend = Math.sin(t / 900 + b.x * .015 + b.p) * 2 + wind * b.h * .6;
      const dx = b.x - mx, dy = b.base - my;
      if (Math.abs(dx) < 70 && Math.abs(dy) < 90) bend += Math.sign(dx || 1) * (70 - Math.abs(dx)) / 70 * b.h * .9;
      ctx.moveTo(b.x, b.base + 2); ctx.quadraticCurveTo(b.x + bend * .3, b.base - b.h * .5, b.x + bend, b.base - b.h);
    });
    ctx.stroke();
  }

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initLife(); paintStatic();
    if (reduce) ctx.drawImage(bg, 0, 0, W, H);
  }
  addEventListener('resize', size);
  size();
  nextFlock = performance.now() + 1500;
  if (!reduce) requestAnimationFrame(frame);
})();
