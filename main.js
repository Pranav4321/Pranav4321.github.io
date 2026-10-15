// Shared script for every page of the portfolio
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // ----- Theme toggle (remembers choice) -----
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.onclick = () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  };

  // ----- Rotating words in hero (home page only) -----
  const rot = document.getElementById('rotator');
  if (rot && !reduce) {
    const words = (rot.dataset.words || rot.textContent).split('|');
    rot.textContent = words[0];
    let w = 0, c = words[0].length, deleting = true;
    setTimeout(function tick() {
      rot.textContent = words[w].slice(0, c);
      if (deleting) { c--; if (c < 0) { deleting = false; w = (w + 1) % words.length; c = 0; } }
      else { c++; if (c > words[w].length) { deleting = true; return setTimeout(tick, 1800); } }
      setTimeout(tick, deleting ? 45 : 85);
    }, 2000);
  } else if (rot) {
    rot.textContent = (rot.dataset.words || rot.textContent).split('|')[0];
  }

  // ----- Reveal on scroll -----
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), i * 80);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ----- Scroll progress bar + active nav/toc link -----
  const bar = document.getElementById('progress');
  // only links that point to a section on THIS page (start with #) get scroll-highlighting
  const spyLinks = [...document.querySelectorAll('nav a[href^="#"], .toc a[href^="#"]')];
  const spyTargets = spyLinks.map(a => document.querySelector(a.getAttribute('href')));
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    if (!spyLinks.length) return;
    ['nav', '.toc'].forEach(group => {
      const links = spyLinks.filter(a => a.closest(group));
      if (!links.length) return;
      let idx = 0;
      links.forEach((a, i) => {
        const t = document.querySelector(a.getAttribute('href'));
        if (t && t.getBoundingClientRect().top < innerHeight * 0.4) idx = i;
      });
      links.forEach((a, i) => a.classList.toggle('active', i === idx));
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Cursor glow + card tilt/spotlight (desktop only) -----
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    const glow = document.getElementById('glow');
    if (glow) addEventListener('mousemove', e => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; });

    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
        const rx = ((y / r.height) - .5) * -4, ry = ((x / r.width) - .5) * 4;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => card.style.transform = '');
    });
  }

  // ----- Copy email -----
  const copyBtn = document.getElementById('copyEmail');
  if (copyBtn) copyBtn.onclick = async () => {
    const email = copyBtn.dataset.email;
    try { await navigator.clipboard.writeText(email); } catch (err) { location.href = 'mailto:' + email; return; }
    const c = document.getElementById('copied');
    c.classList.add('show'); setTimeout(() => c.classList.remove('show'), 1800);
  };

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
