// Shared script for every page of the portfolio
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;
  // '' on top-level pages, '../' inside projects/
  const base = (document.querySelector('script[src*="main.js"]')?.getAttribute('src') || 'main.js').split('main.js')[0];

  // ----- Theme toggle (remembers choice) -----
  function toggleTheme() {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  }
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.onclick = toggleTheme;

  // ----- Name scramble on load (home page) -----
  const name = document.getElementById('name');
  if (name && !reduce) {
    const glyphs = '!<>-_\\/[]{}=+*^?#01';
    // wrap every letter so we can scramble it without moving the layout
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach(ch => {
            if (ch === ' ') return frag.appendChild(document.createTextNode(' '));
            const s = document.createElement('span'); s.className = 'ch'; s.dataset.c = ch; s.textContent = ch;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else walk(n);
      });
    };
    walk(name);
    const chars = [...name.querySelectorAll('.ch')];
    const scramble = () => chars.forEach((s, i) => {
      let t = 0; const stop = 6 + i * 2;
      const iv = setInterval(() => {
        s.textContent = ++t >= stop ? s.dataset.c : glyphs[Math.random() * glyphs.length | 0];
        if (t >= stop) clearInterval(iv);
      }, 40);
    });
    scramble();
    name.addEventListener('mouseenter', () => { if (!name.dataset.busy) { name.dataset.busy = 1; scramble(); setTimeout(() => delete name.dataset.busy, 900); } });
  }

  // ----- Rotating words in hero -----
  const rot = document.getElementById('rotator');
  if (rot && !reduce) {
    const words = (rot.dataset.words || rot.textContent).split('|');
    rot.textContent = words[0];
    let w = 0, c = words[0].length, deleting = true;
    setTimeout(function tick() {
      rot.textContent = words[w].slice(0, c);
      if (deleting) { c--; if (c < 0) { deleting = false; w = (w + 1) % words.length; c = 0; } }
      else { c++; if (c > words[w].length) { deleting = true; return setTimeout(tick, 1800); } }
      setTimeout(tick, deleting ? 40 : 80);
    }, 2200);
  } else if (rot) {
    rot.textContent = (rot.dataset.words || rot.textContent).split('|')[0];
  }

  // ----- Reveal on scroll -----
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), i * 70);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ----- Scroll progress, nav border, active nav/toc link -----
  const bar = document.getElementById('progress');
  const nav = document.querySelector('nav');
  const spyLinks = [...document.querySelectorAll('nav a[href^="#"]:not(.brand), .toc a[href^="#"]')];
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
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Card tilt + spotlight (desktop only) -----
  if (!reduce && fine) {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
        const rx = ((y / r.height) - .5) * -3, ry = ((x / r.width) - .5) * 3;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => card.style.transform = '');
    });
  }

  // ----- Draggable polaroid (springs back on release) -----
  const pol = document.getElementById('polaroid');
  if (pol && !reduce) {
    let sx = 0, sy = 0, dragging = false;
    pol.addEventListener('pointerdown', e => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      pol.classList.add('dragging'); pol.setPointerCapture(e.pointerId);
    });
    pol.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      pol.style.transform = `translate(${dx}px, ${dy}px) rotate(${3 + dx / 18}deg) scale(1.04)`;
    });
    const end = () => { if (!dragging) return; dragging = false; pol.classList.remove('dragging'); pol.style.transform = ''; };
    pol.addEventListener('pointerup', end);
    pol.addEventListener('pointercancel', end);
  }

  // ----- Local time in Baltimore -----
  const clock = document.getElementById('clock');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    const tick = () => clock.textContent = fmt.format(new Date()) + ' ET';
    tick(); setInterval(tick, 15000);
  }

  // ----- Copy email -----
  const copyBtn = document.getElementById('copyEmail');
  const email = copyBtn ? copyBtn.dataset.email : 'you@email.com';
  async function copyEmail() {
    try { await navigator.clipboard.writeText(email); } catch (err) { location.href = 'mailto:' + email; return; }
    const c = document.getElementById('copied');
    if (c) { c.classList.add('show'); setTimeout(() => c.classList.remove('show'), 1800); }
  }
  if (copyBtn) copyBtn.onclick = copyEmail;

  // ----- Command menu (⌘K / Ctrl+K) -----
  const go = path => () => location.href = base + path;
  const commands = [
    { label: 'Home', hint: 'page', run: go('index.html') },
    { label: 'About', hint: 'section', run: go('index.html#about') },
    { label: 'Experience', hint: 'section', run: go('index.html#experience') },
    { label: 'Experience (full)', hint: 'page', run: go('experience.html') },
    { label: 'Projects', hint: 'section', run: go('index.html#projects') },
    { label: 'Woodworking', hint: 'page', run: go('woodworking.html') },
    { label: 'Contact', hint: 'section', run: go('index.html#contact') },
    { label: 'Copy email', hint: 'action', run: () => { navigator.clipboard?.writeText(email); } },
    { label: 'Toggle dark mode', hint: 'action', run: toggleTheme },
    { label: 'Résumé', hint: 'pdf', run: () => open(base + 'resume.pdf', '_blank') },
    { label: 'GitHub', hint: 'link', run: () => open('https://github.com/yourusername', '_blank') },
    { label: 'LinkedIn', hint: 'link', run: () => open('https://linkedin.com/in/yourusername', '_blank') },
  ];
  const cmd = document.createElement('div');
  cmd.className = 'cmd'; cmd.setAttribute('aria-hidden', 'true');
  cmd.innerHTML = '<div class="cmd-box" role="dialog" aria-modal="true" aria-label="Command menu"><input type="text" placeholder="Where to?" aria-label="Search commands" /><ul></ul></div>';
  document.body.appendChild(cmd);
  const input = cmd.querySelector('input'), list = cmd.querySelector('ul');
  let shown = commands, sel = 0, lastFocus = null;
  function render() {
    const q = input.value.trim().toLowerCase();
    shown = commands.filter(c => c.label.toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    list.innerHTML = shown.length ? '' : '<div class="empty">Nothing found.</div>';
    shown.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = i === sel ? 'sel' : '';
      li.innerHTML = `<span></span><span class="mono">${c.hint}</span>`;
      li.firstChild.textContent = c.label;
      li.onmouseenter = () => { sel = i; [...list.children].forEach((el, j) => el.classList.toggle('sel', j === i)); };
      li.onclick = () => run(i);
      list.appendChild(li);
    });
  }
  function openCmd() { lastFocus = document.activeElement; input.value = ''; sel = 0; render(); cmd.classList.add('open'); cmd.setAttribute('aria-hidden', 'false'); setTimeout(() => input.focus(), 20); }
  function closeCmd() { cmd.classList.remove('open'); cmd.setAttribute('aria-hidden', 'true'); if (lastFocus) lastFocus.focus(); }
  function run(i) { const c = shown[i]; closeCmd(); if (c) c.run(); }
  input.addEventListener('input', () => { sel = 0; render(); });
  cmd.addEventListener('click', e => { if (e.target === cmd) closeCmd(); });
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmd.classList.contains('open') ? closeCmd() : openCmd(); return; }
    if (!cmd.classList.contains('open')) return;
    if (e.key === 'Escape') closeCmd();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'Enter') run(sel);
  });
  const kBtn = document.getElementById('kBtn');
  if (kBtn) kBtn.onclick = openCmd;

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
