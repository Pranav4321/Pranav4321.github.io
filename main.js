// Shared script for every page of the portfolio
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;
  const $ = id => document.getElementById(id);

  // ----- Theme toggle (remembers choice) -----
  const themeBtn = $('themeBtn');
  if (themeBtn) themeBtn.onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  };

  // ----- Name: letters drop in, then spring up when hovered -----
  const name = $('name');
  if (name) {
    let k = 0;
    name.querySelectorAll('.row').forEach(row => {
      const text = row.textContent; row.textContent = '';
      [...text].forEach(ch => {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = ch; s.style.animationDelay = (k++ * 45) + 'ms';
        s.addEventListener('mouseenter', () => {
          s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
        });
        row.appendChild(s);
      });
    });
  }

  // ----- Rotating words in hero -----
  const rot = $('rotator');
  if (rot && !reduce) {
    const words = (rot.dataset.words || rot.textContent).split('|');
    rot.textContent = words[0];
    let w = 0, c = words[0].length, deleting = true;
    setTimeout(function tick() {
      rot.textContent = words[w].slice(0, c);
      if (deleting) { c--; if (c < 0) { deleting = false; w = (w + 1) % words.length; c = 0; } }
      else { c++; if (c > words[w].length) { deleting = true; return setTimeout(tick, 1900); } }
      setTimeout(tick, deleting ? 35 : 75);
    }, 2400);
  }

  // ----- Reveal on scroll -----
  const io = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), i * 70);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ----- Robot arm (2-link inverse kinematics) -----
  const arm = $('arm');
  if (arm) {
    const S = { x: 240, y: 350 }, L1 = 150, L2 = 150;
    const a1 = $('arm1'), a2 = $('arm2'), trail = $('armTrail'), tgt = $('armTarget');
    const fA = $('fingerA'), fB = $('fingerB');
    const out = { t1: $('t1'), t2: $('t2'), grip: $('grip') };

    // ground hatching
    let h = '';
    for (let x = 30; x < 460; x += 16) h += `<line class="hatch" x1="${x}" y1="394" x2="${x - 10}" y2="406"/>`;
    $('hatch').innerHTML = h;

    let goal = { x: 360, y: 130 }, cur = { ...goal }, lastMove = -1e9, points = [];

    function toSvg(cx, cy) {
      const m = arm.getScreenCTM(); if (!m) return null;
      const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    }
    function setGoal(e) {
      const p = toSvg(e.clientX, e.clientY); if (!p) return;
      goal = p; lastMove = performance.now();
    }
    addEventListener('pointermove', e => {
      const r = arm.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      if (e.pointerType === 'mouse' || e.target.closest('#arm')) setGoal(e);
    }, { passive: true });
    arm.addEventListener('pointerdown', e => { setGoal(e); grip(true); });
    addEventListener('pointerup', () => grip(false));
    function grip(closed) {
      fA.style.transform = closed ? 'translateY(6px)' : '';
      fB.style.transform = closed ? 'translateY(-6px)' : '';
      out.grip.textContent = closed ? 'closed' : 'open';
    }

    function solve(T) {
      // keep the target reachable and above the floor
      let dx = T.x - S.x, dy = Math.min(T.y, 370) - S.y;
      let d = Math.hypot(dx, dy);
      const max = L1 + L2 - 2, min = 30;
      if (d > max) { dx *= max / d; dy *= max / d; d = max; }
      if (d < min) { dx = dx / (d || 1) * min; dy = dy / (d || 1) * min; d = min; }
      const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const best = [1, -1].map(sgn => {
        const q2 = sgn * Math.acos(Math.max(-1, Math.min(1, c2)));
        const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
        return { q1, q2, ey: S.y + L1 * Math.sin(q1) };
      }).sort((a, b) => a.ey - b.ey)[0]; // elbow-up solution
      return { ...best, wx: S.x + dx, wy: S.y + dy };
    }

    const deg = r => r * 180 / Math.PI;
    let t0 = performance.now();
    function frame(now) {
      // idle: trace a slow figure-eight when nobody is steering
      if (now - lastMove > 2500 || reduce) {
        const t = (now - t0) / 1000 * .6;
        goal = { x: S.x + 130 * Math.sin(t), y: S.y - 190 + 55 * Math.sin(2 * t) };
      }
      const ease = reduce ? 1 : .14;
      cur.x += (goal.x - cur.x) * ease; cur.y += (goal.y - cur.y) * ease;
      const s = solve(cur);
      a1.setAttribute('transform', `translate(${S.x} ${S.y}) rotate(${deg(s.q1)})`);
      a2.setAttribute('transform', `translate(${L1} 0) rotate(${deg(s.q2)})`);
      tgt.setAttribute('cx', goal.x.toFixed(1)); tgt.setAttribute('cy', Math.min(goal.y, 370).toFixed(1));
      out.t1.textContent = (-deg(s.q1)).toFixed(1) + '°';
      out.t2.textContent = (-deg(s.q2)).toFixed(1) + '°';

      // fading trail behind the gripper
      points.push([s.wx, s.wy]); if (points.length > 70) points.shift();
      trail.setAttribute('points', points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ----- Scroll: progress bar, nav, active links, experience carriage -----
  const bar = $('progress'), nav = document.querySelector('nav');
  const spyLinks = [...document.querySelectorAll('nav a[href^="#"]:not(.brand), .toc a[href^="#"]')];
  const railWrap = $('railWrap'), carriage = $('carriage');
  const jobs = railWrap ? [...railWrap.querySelectorAll('.job')] : [];
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    if (nav) nav.classList.toggle('scrolled', h.scrollTop > 10);

    ['nav', '.toc'].forEach(group => {
      const links = spyLinks.filter(a => a.closest(group));
      if (!links.length) return;
      let idx = -1;
      links.forEach((a, i) => {
        const t = document.querySelector(a.getAttribute('href'));
        if (t && t.getBoundingClientRect().top < innerHeight * 0.4) idx = i;
      });
      links.forEach((a, i) => a.classList.toggle('active', i === idx));
    });

    if (railWrap && carriage) {
      const r = railWrap.getBoundingClientRect();
      const y = Math.max(0, Math.min(r.height - 40, innerHeight * 0.5 - r.top - 20));
      carriage.style.top = y + 'px';
      jobs.forEach(j => {
        const top = j.offsetTop, bottom = top + j.offsetHeight;
        j.classList.toggle('on', y + 20 >= top - 8 && y + 20 < bottom + 8);
      });
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // ----- Project list: floating preview that follows the cursor -----
  const preview = $('preview');
  const rows = [...document.querySelectorAll('.prow')];
  rows.forEach(row => {
    const img = row.dataset.img, label = row.querySelector('h3')?.textContent || '';
    const inner = img ? `<img src="${img}" alt="">` : `<div class="ph">${label}</div>`;
    const thumb = row.querySelector('.pthumb');
    if (thumb && img) thumb.innerHTML = inner;
    row._preview = inner;
  });
  if (preview && fine && !reduce) {
    let x = 0, y = 0, px = 0, py = 0, active = false;
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        preview.innerHTML = row._preview;
        preview.style.setProperty('--c', row.style.getPropertyValue('--c'));
        preview.classList.add('show'); active = true;
      });
      row.addEventListener('mouseleave', () => { preview.classList.remove('show'); active = false; });
    });
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; if (!active) { px = x; py = y; } }, { passive: true });
    (function loop() {
      const vx = x - px;
      px += (x - px) * .16; py += (y - py) * .16;
      preview.style.transform = `translate(${px + 28}px, ${py - 110}px) rotate(${Math.max(-12, Math.min(12, vx * .12))}deg)`;
      requestAnimationFrame(loop);
    })();
  }

  // ----- Copy email -----
  const copyBtn = $('copyEmail');
  if (copyBtn) copyBtn.onclick = async () => {
    const email = copyBtn.dataset.email;
    try { await navigator.clipboard.writeText(email); } catch (err) { location.href = 'mailto:' + email; return; }
    const c = $('copied');
    c.classList.add('show'); setTimeout(() => c.classList.remove('show'), 1800);
  };

  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();
})();
