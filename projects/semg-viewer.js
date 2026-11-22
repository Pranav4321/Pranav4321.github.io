// =========================================================
// sEMG armband: the CAD model in 3D (three.js).
// At rest the whole forearm is in view. Hover the model (or tap it on a phone)
// and the camera moves in on the electronics: the lid slides off, both
// processing boards and the Beetle slide out of the housing, the electrode
// boards lift off the band, and a label appears for every part.
// Hovering a row in the parts list lights up that part's label.
//
// Model: images/semg/semg_arm.glb. Parts are named groups in the file
// (Lid, Housing, Processing_Board_1, ...). Offsets below are in metres, in
// the model's world frame, and were worked out from the housing's own axes.
// =========================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const box = document.getElementById('semgViewer');
if (box) init();

function init() {
  const sheet = box.querySelector('.sheet');
  const canvas = sheet.querySelector('canvas');
  const credit = box.querySelector('.render-credit');
  const rows = [...document.querySelectorAll('#semgParts li')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // part groups in the GLB → which row they belong to, where they go, and when (fraction of the explode)
  const GROUPS = {
    Lid:                { part: 'lid',       off: [0.0949, -0.0254, -0.0189],     span: [0.00, 0.60] },
    Processing_Board_1: { part: 'proc',      off: [0.04881, -0.01918, -0.03629],  span: [0.22, 0.88] },
    Processing_Board_2: { part: 'proc',      off: [0.04686, -0.03003, -0.03154],  span: [0.28, 0.94] },
    Beetle_ESP32_C6:    { part: 'beetle',    off: [0.05233, -0.01234, -0.00661],  span: [0.34, 1.00] },
    Electrode_Board_1:  { part: 'electrode', off: [-0.0044, 0.00117, -0.01741],   span: [0.10, 0.70] },
    Electrode_Board_2:  { part: 'electrode', off: [0.00315, -0.0078, 0.01591],    span: [0.14, 0.74] },
    Housing:            { part: 'housing' },
    Band:               { part: 'band' },
    Cables:             { part: 'cables' },
    Forearm:            {},
  };
  // the parts the camera moves in on when exploded
  const FOCUS = ['Housing', 'Lid', 'Processing_Board_1', 'Processing_Board_2', 'Beetle_ESP32_C6', 'Electrode_Board_1', 'Electrode_Board_2', 'Band'];
  // camera looks at the model from this direction (world space), tuned so the housing faces you
  const VIEW_DIR = new THREE.Vector3(-0.33, 0.42, -0.85).normalize();

  // ---------- three.js setup ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.7); scene.add(fill, fill.target);
  // soft environment so the shiny cables pick up highlights
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(roomEnv(), 0.04).texture;

  // ---------- labels: a tag per row, with leader lines to each of its parts ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'leads'); svg.setAttribute('aria-hidden', 'true');
  sheet.append(svg);
  const tags = rows.map(r => {
    const t = document.createElement('span');
    t.className = 'tag'; t.textContent = r.dataset.label || r.querySelector('b').textContent;
    t.dataset.part = r.dataset.part; t.setAttribute('aria-hidden', 'true');
    sheet.append(t);
    return { part: r.dataset.part, el: t, lines: [], anchors: [], badges: [], n: rows.indexOf(r) + 1, x: 0, y: 0 };
  });

  // ---------- state ----------
  const groups = [];
  let t = 0, target = 0, active = null, ready = false;
  let rest = null, focus = null;          // {center, radius} framings
  const par = { x: 0, y: 0, tx: 0, ty: 0 }; // pointer parallax

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(box.dataset.model, gltf => {
    const root = gltf.scene;
    scene.add(root);
    root.updateMatrixWorld(true);
    root.traverse(o => { if (o.isMesh) { o.material.side = THREE.DoubleSide; if (o.parent?.name === 'Forearm') o.material.flatShading = true; } });

    for (const [name, cfg] of Object.entries(GROUPS)) {
      const obj = root.getObjectByName(name);
      if (!obj) { console.warn('missing part', name); continue; }
      scene.attach(obj); // keep world pose, so offsets are plain world-space moves
      const bb = new THREE.Box3().setFromObject(obj);
      const g = { name, obj, cfg, home: obj.position.clone(), off: new THREE.Vector3(...(cfg.off || [0, 0, 0])), bb,
                  anchor: nearestPoint(obj, bb.getCenter(new THREE.Vector3())) };
      groups.push(g);
      const tag = tags.find(x => x.part === cfg.part);
      if (tag) {
        tag.anchors.push(g);
        const ln = document.createElementNS(NS, 'line'); ln.dataset.part = cfg.part; svg.append(ln); tag.lines.push(ln);
        // on narrow screens each part gets a numbered marker (matching the list) instead of a text label
        const b = document.createElement('span'); b.className = 'badge'; b.textContent = tag.n; b.dataset.part = cfg.part; b.setAttribute('aria-hidden', 'true');
        sheet.append(b); tag.badges.push(b);
      }
    }
    rest = sphereOf(groups.map(g => g.bb));
    focus = sphereOf(groups.filter(g => FOCUS.includes(g.name)).flatMap(g => [g.bb, g.bb.clone().translate(g.off)]));
    ready = true;
    box.classList.add('loaded');
    if (credit) credit.textContent = matchMedia('(hover: hover)').matches ? 'Hover to take it apart' : 'Tap to take it apart';
    resize(); kick();
  }, undefined, err => { console.error(err); if (credit) credit.textContent = 'The 3D model could not load.'; });

  // ---------- interaction ----------
  const hoverable = matchMedia('(hover: hover)').matches;
  if (hoverable) {
    box.addEventListener('pointerenter', () => { target = 1; kick(); });
    box.addEventListener('pointerleave', () => { target = 0; par.tx = par.ty = 0; kick(); });
    box.addEventListener('pointermove', e => {
      const r = box.getBoundingClientRect();
      par.tx = (e.clientX - r.left) / r.width - 0.5; par.ty = (e.clientY - r.top) / r.height - 0.5; kick();
    });
  } else {
    box.addEventListener('click', () => { target = target ? 0 : 1; kick(); });
  }
  box.tabIndex = 0;
  box.setAttribute('role', 'button');
  box.setAttribute('aria-label', 'Interactive 3D model. Press Enter to take it apart.');
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); target = target ? 0 : 1; kick(); } });

  const setActive = p => {
    active = p;
    [...rows, ...tags.map(x => x.el), ...tags.flatMap(x => [...x.lines, ...x.badges])].forEach(el => el.classList.toggle('on', !!p && el.dataset.part === p));
  };
  rows.forEach(r => {
    r.tabIndex = 0;
    const on = () => { setActive(r.dataset.part); target = 1; kick(); };
    const off = () => { setActive(null); if (!box.matches(':hover')) target = 0; kick(); };
    r.addEventListener('pointerenter', on); r.addEventListener('pointerleave', off);
    r.addEventListener('focus', on); r.addEventListener('blur', off);
  });

  // ---------- render loop (only runs while something is moving) ----------
  let raf = 0, last = 0, visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(box);
  function kick() { if (!raf && ready && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dur = reduced ? 0.001 : 1.15;                  // seconds for a full explode
    t += Math.sign(target - t) * Math.min(Math.abs(target - t), dt / dur);
    par.x += (par.tx - par.x) * (reduced ? 1 : 0.08); par.y += (par.ty - par.y) * (reduced ? 1 : 0.08);
    draw();
    const moving = Math.abs(target - t) > 1e-4 || Math.abs(par.tx - par.x) + Math.abs(par.ty - par.y) > 1e-3;
    if (moving) raf = requestAnimationFrame(frame);
  }

  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const seg = (x, [a, b]) => ease(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));
  const v = new THREE.Vector3(), w = new THREE.Vector3();

  function draw() {
    // parts
    for (const g of groups) {
      const k = g.cfg.span ? seg(t, g.cfg.span) : 0;
      g.obj.position.copy(g.home).addScaledVector(g.off, k);
      g.k = k;
    }
    // camera: blend from the whole arm to the electronics
    const e = ease(t);
    const c = v.copy(rest.center).lerp(focus.center, e);
    const rad = THREE.MathUtils.lerp(rest.radius, focus.radius, e);
    const dir = w.copy(VIEW_DIR).applyAxisAngle(new THREE.Vector3(0, 1, 0), -par.x * 0.35);
    dir.y += par.y * 0.25; dir.normalize();
    // spheres are loose around a long, thin arm, so pull in a little (more on wide screens than tall ones)
    const fit = THREE.MathUtils.lerp(0.6, 0.78, e) * (camera.aspect < 1.2 ? 1.45 : 1.0);
    const dist = rad / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * fit;
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    key.position.copy(camera.position).add(new THREE.Vector3(0.6, 1, 0.2)); key.target.position.copy(c);
    fill.position.copy(c).add(new THREE.Vector3(-0.5, -0.2, -0.6)); fill.target.position.copy(c);
    renderer.render(scene, camera);
    placeLabels();
  }

  // labels sit beside the cluster, left or right of their parts, spread apart so they never overlap
  function placeLabels() {
    const W = sheet.clientWidth, H = sheet.clientHeight;
    const show = THREE.MathUtils.clamp((t - 0.65) / 0.3, 0, 1);
    sheet.style.setProperty('--label-o', show.toFixed(3));
    if (show <= 0) return;
    const proj = p => { const q = p.clone().project(camera); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
    const fc = proj(focus.center);
    const compact = W < 520;
    sheet.classList.toggle('compact', compact);
    if (compact) {
      for (const tag of tags) tag.anchors.forEach((g, i) => {
        const [x, y] = proj(g.anchor.clone().addScaledVector(g.off, g.k));
        tag.badges[i].style.left = x + 'px'; tag.badges[i].style.top = y + 'px';
      });
      return;
    }
    const items = tags.map(tag => {
      tag.pts = tag.anchors.map(g => proj(g.anchor.clone().addScaledVector(g.off, g.k)));
      const ax = tag.pts.reduce((s, p) => s + p[0], 0) / tag.pts.length, ay = tag.pts.reduce((s, p) => s + p[1], 0) / tag.pts.length;
      tag.side = ax < fc[0] ? -1 : 1; tag.y = ay; tag.ax = ax;
      return tag;
    });
    const gap = Math.max(18, H * 0.055), pad = 14;
    for (const side of [-1, 1]) {
      const col = items.filter(x => x.side === side).sort((a, b) => a.y - b.y);
      for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + gap);
      const over = col.length ? col[col.length - 1].y - (H - pad) : 0;
      if (over > 0) col.forEach(x => x.y -= over);
      for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - gap);
      col.forEach(x => x.y = Math.max(pad, x.y));
      // line the column up just past its parts, but keep every label fully on the sheet
      const xs = col.map(x => x.ax);
      const widest = Math.max(0, ...col.map(x => x.el.offsetWidth + 6));
      let edge = side < 0 ? Math.min(...xs) - W * 0.07 : Math.max(...xs) + W * 0.07;
      edge = side < 0 ? Math.max(edge, widest + pad / 2) : Math.min(edge, W - widest - pad / 2);
      col.forEach(x => { x.x = edge; });
    }
    for (const tag of items) {
      tag.el.classList.toggle('end', tag.side < 0);
      tag.el.style.left = tag.x + 'px'; tag.el.style.top = tag.y + 'px';
      tag.lines.forEach((ln, i) => {
        const [px, py] = tag.pts[i];
        ln.setAttribute('x1', px); ln.setAttribute('y1', py); ln.setAttribute('x2', tag.x); ln.setAttribute('y2', tag.y);
      });
    }
  }

  function resize() {
    const W = sheet.clientWidth, H = sheet.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (ready) draw();
  }
  new ResizeObserver(resize).observe(sheet);

  // ---------- helpers ----------
  function sphereOf(boxes) {
    const b = new THREE.Box3(); boxes.forEach(x => b.union(x));
    const s = b.getBoundingSphere(new THREE.Sphere());
    return { center: s.center, radius: s.radius };
  }
  // a point on the part's surface closest to its centre, so leader lines land on the part (not in mid-air)
  function nearestPoint(obj, c) {
    let best = null, bd = Infinity; const p = new THREE.Vector3();
    obj.traverse(m => {
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += step) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const d = p.distanceToSquared(c);
        if (d < bd) { bd = d; best = p.clone(); }
      }
    });
    return best || c;
  }
  function roomEnv() {
    const s = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const room = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x8c8880, side: THREE.BackSide }));
    room.scale.setScalar(10); s.add(room);
    const lamp = (x, y, z, sx, sz, c) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.scale.set(sx, 0.1, sz); s.add(m); };
    lamp(0, 4.8, 0, 4, 4, 0xffffff); lamp(3, 2, -4.8, 2, 0.1, 0xfff1dd);
    return s;
  }
}
