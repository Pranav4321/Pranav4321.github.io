// Shared script for every page (the sky scene is in scene.js)
(function () {
  const $ = id => document.getElementById(id);

  // ----- Header turns solid once you scroll past the sky -----
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.scene-hero');
  function onScroll() {
    if (header) header.classList.toggle('solid', scrollY > (hero ? hero.offsetHeight - 80 : 10));
    spy();
  }

  // ----- Highlight the nav link / table-of-contents entry for the section on screen -----
  const spyLinks = [...document.querySelectorAll('.site-header nav a[href^="#"], .toc a[href^="#"]')];
  function spy() {
    ['.site-header', '.toc'].forEach(group => {
      const links = spyLinks.filter(a => a.closest(group));
      if (!links.length) return;
      let idx = -1;
      links.forEach((a, i) => {
        const t = document.querySelector(a.getAttribute('href'));
        if (t && t.getBoundingClientRect().top < innerHeight * .4) idx = i;
      });
      links.forEach((a, i) => a.classList.toggle('active', i === idx));
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Fade things in as they scroll into view -----
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ----- Copy email -----
  const copyBtn = $('copyEmail');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email;
    try { await navigator.clipboard.writeText(email); } catch (e) { location.href = 'mailto:' + email; return; }
    const c = $('copied'); c.classList.add('show'); setTimeout(() => c.classList.remove('show'), 1800);
  });

  // ----- Woodshop: filters + preview (lightbox) -----
  const pieces = [...document.querySelectorAll('.piece')];
  if (pieces.length) {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.toggle('on', c === chip));
      const f = chip.dataset.filter;
      pieces.forEach(p => { p.classList.toggle('hidden', f !== 'all' && p.dataset.cat !== f); p.classList.add('in'); });
    }));

    const lb = $('lightbox');
    let current = 0, lastFocus = null;
    const visible = () => pieces.filter(p => !p.classList.contains('hidden'));
    function show(piece) {
      const d = piece.dataset;
      $('lbTitle').textContent = d.title || '';
      $('lbYear').textContent = d.year || '';
      $('lbNote').textContent = d.note || '';
      $('lbWood').textContent = d.wood || '—';
      $('lbFinish').textContent = d.finish || '—';
      $('lbTime').textContent = d.time || '—';
      const img = piece.querySelector('img');
      $('lbMedia').innerHTML = img ? `<img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt') || ''}">` : '<div class="ph">photo</div>';
      current = visible().indexOf(piece);
    }
    function open(piece) {
      lastFocus = document.activeElement; show(piece);
      lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; $('lbClose').focus();
    }
    function close() {
      lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }
    const step = dir => { const v = visible(); if (v.length) show(v[(current + dir + v.length) % v.length]); };
    pieces.forEach(p => p.addEventListener('click', () => open(p)));
    $('lbClose').onclick = close; $('lbPrev').onclick = () => step(-1); $('lbNext').onclick = () => step(1);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();
})();
