// Train, project screens, bridge lanterns, constellations, scroll timeline and render loop.
(function () {
  const T = THREE, W = WORLD, scene = W.scene;
  const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  // Renderer and post
  const canvas = $('scene');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  const camera = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 4200);
  let rt;
  if (renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget) { rt = new T.WebGLMultisampleRenderTarget(innerWidth, innerHeight, { format: T.RGBAFormat }); rt.samples = 4; }
  const composer = new T.EffectComposer(renderer, rt);
  composer.addPass(new T.RenderPass(scene, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.62, 0.45, 0.88);
  composer.addPass(bloom);
  composer.addPass(new T.ShaderPass(T.GammaCorrectionShader));
  function resize() {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    $('spacer').style.height = (TOTAL * innerHeight + innerHeight) + 'px';
  }

  // Environment map for glossy car paint: a dusk sky with warm city glow and a few bright lights
  {
    const es = new T.Scene(), g = new T.SphereGeometry(50, 32, 16), p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 50; const c = y < -0.05 ? lin('#141216') : y < 0.12 ? lin('#c98a5c').lerp(lin('#3a3550'), (y + 0.05) / 0.17) : lin('#3a3550').lerp(lin('#141a2e'), Math.min(1, (y - 0.12) / 0.6));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    es.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    for (let i = 0; i < 10; i++) { const b = new T.Mesh(new T.BoxGeometry(3, 1, 8), new T.MeshBasicMaterial({ color: new T.Color(4, 3.4, 2.6) })); const a = i / 10 * Math.PI * 2; b.position.set(Math.cos(a) * 40, 18 + (i % 3) * 6, Math.sin(a) * 40); b.lookAt(0, 0, 0); es.add(b); }
    const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(es, 0.02).texture;
    (W.envTargets || []).forEach((mt) => { mt.envMap = env; mt.needsUpdate = true; });
  }

  // ---------- Train ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.canvas = c; t.ctx = g; return t;
  }
  let ps = 3;
  const prand = () => { ps = (ps * 16807) % 2147483647; return ps / 2147483647; };
  // Car sides: a lit interior (ceiling light, grab rail, seats, far windows) with shaded passengers.
  // Three variants so neighbouring cars don't repeat. The emissive map is the interior, slightly dimmed.
  const pickP = (a) => a[Math.floor(prand() * a.length)];
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shadeHex(hex, k) { const c = new T.Color(hex); c.multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return '#' + c.getHexString(); }
  function interior(g, x, y, w, h) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#fff0cf'); gr.addColorStop(0.45, '#f1d29e'); gr.addColorStop(1, '#d9ad74');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#2b3550'; g.fillRect(x + 6, y + 26, w - 12, h * 0.3);
    for (let fx = x + 6; fx < x + w; fx += 64) { g.fillStyle = '#d8b884'; g.fillRect(fx, y + 26, 5, h * 0.3); }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,${200 + Math.floor(prand() * 50)},150,.5)`; g.fillRect(x + 10 + prand() * (w - 20), y + 30 + prand() * h * 0.25, 2, 2); }
    g.fillStyle = 'rgba(255,253,244,1)'; g.fillRect(x, y + 1, w, 7);
    g.fillStyle = '#bdb6a6'; g.fillRect(x, y + 17, w, 3);
    g.fillStyle = '#3d5d88'; g.fillRect(x, y + h - 30, w, 30); g.fillStyle = '#2f4a70'; g.fillRect(x, y + h - 30, w, 4);
  }
  function person(g, cx, top, bottom, stand, railY) {
    const skin = pickP(['#f2cba9', '#e3b08a', '#c98e66', '#a96d47', '#80502f', '#5b3523']);
    const hair = pickP(['#16100c', '#2b1b12', '#4b301d', '#6e4c2b', '#a98450', '#d9c7a3', '#0e0e10', '#7a2a1a']);
    const cloth = pickP(['#2f3b52', '#7a2e2e', '#3d5a3d', '#c9a26b', '#e6e1d6', '#1f1f24', '#5b4a7a', '#8a5a2b', '#2d6a8a', '#b8b2a8', '#9a3f5a']);
    const style = pickP(['short', 'short', 'long', 'bun', 'cap', 'bald']);
    const hr = 10.5, hy = top + hr, sw = 23 + prand() * 6, tt = hy + hr + 5;
    if (style === 'long') { g.fillStyle = hair; rrect(g, cx - hr - 2, hy - 4, hr * 2 + 4, 34, 8); g.fill(); }
    // torso with top light
    const tg = g.createLinearGradient(0, tt, 0, bottom); tg.addColorStop(0, shadeHex(cloth, 1.25)); tg.addColorStop(0.5, cloth); tg.addColorStop(1, shadeHex(cloth, 0.6));
    g.fillStyle = tg; rrect(g, cx - sw, tt, sw * 2, bottom - tt + 20, 11); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - sw, tt + 8, 6, bottom - tt); g.fillRect(cx + sw - 6, tt + 8, 6, bottom - tt);
    if (stand && railY != null) { g.strokeStyle = shadeHex(cloth, 0.85); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + sw - 5, tt + 6); g.lineTo(cx + sw + 4, railY + 4); g.stroke(); g.fillStyle = skin; g.beginPath(); g.arc(cx + sw + 4, railY + 2, 4.5, 0, 7); g.fill(); }
    // neck and head
    g.fillStyle = shadeHex(skin, 0.82); g.fillRect(cx - 4.5, hy + hr - 3, 9, 9);
    const hg = g.createRadialGradient(cx - 3, hy - 4, 2, cx, hy, hr + 2); hg.addColorStop(0, shadeHex(skin, 1.12)); hg.addColorStop(1, shadeHex(skin, 0.78));
    g.fillStyle = hg; g.beginPath(); g.ellipse(cx, hy, hr * 0.88, hr, 0, 0, 7); g.fill();
    g.fillStyle = shadeHex(skin, 0.7); g.beginPath(); g.arc(cx - hr * 0.88, hy + 1, 2.4, 0, 7); g.arc(cx + hr * 0.88, hy + 1, 2.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(30,20,15,.55)'; g.fillRect(cx - 4.5, hy, 2.2, 1.6); g.fillRect(cx + 2.3, hy, 2.2, 1.6);
    g.fillStyle = hair;
    if (style === 'short' || style === 'long') { g.beginPath(); g.ellipse(cx, hy - 3, hr * 0.95, hr * 0.72, 0, Math.PI, 0); g.fill(); g.fillRect(cx - hr * 0.95, hy - 4, 3, 7); g.fillRect(cx + hr * 0.95 - 3, hy - 4, 3, 7); }
    if (style === 'bun') { g.beginPath(); g.ellipse(cx, hy - 3, hr * 0.92, hr * 0.7, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(cx, hy - hr - 2, 5, 0, 7); g.fill(); }
    if (style === 'cap') { g.fillStyle = pickP(['#1d2a44', '#7a1f1f', '#222', '#c8b28a']); g.beginPath(); g.ellipse(cx, hy - 4, hr, hr * 0.62, 0, Math.PI, 0); g.fill(); g.fillRect(cx - 2, hy - 5, hr + 6, 3); }
    // some read their phones; the screen lights their face
    if (!stand && prand() < 0.35) {
      g.fillStyle = 'rgba(150,200,255,.25)'; g.beginPath(); g.ellipse(cx, hy + 2, hr * 0.8, hr * 0.8, 0, 0, 7); g.fill();
      g.fillStyle = '#bfe0ff'; g.fillRect(cx - 5, tt + 12, 10, 15); g.fillStyle = skin; g.fillRect(cx - 8, tt + 22, 16, 6);
    }
    if (prand() < 0.2) { g.strokeStyle = '#1a1a1a'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, hy - 1, hr + 1.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
  }
  function carSideTex(vs) {
    ps = vs;
    const map = canvasTex(1800, 340, () => {}), emi = canvasTex(1800, 340, () => {});
    const g = map.ctx, px = (m) => (m + 9) * 100, py = (m) => m * 100, lit = [];
    const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#5d4c55'); gr.addColorStop(0.5, '#4b3d45'); gr.addColorStop(1, '#3a2f36');
    g.fillStyle = gr; g.fillRect(0, 0, 1800, 340);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 1800, 22);
    for (let x = 0; x < 1800; x += 22) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, py(2.5), 2, 70); }
    g.fillStyle = '#d6732b'; g.fillRect(0, py(2.28), 1800, 13);
    g.fillStyle = '#1e191c'; g.fillRect(0, py(3.22), 1800, 20);
    for (const rel of W.WIN_REL) {
      const x = px(rel - W.WIN_W / 2), y = py(0.675), w = W.WIN_W * 100, h = W.WIN_H * 100;
      g.fillStyle = '#18151a'; g.fillRect(x - 9, y - 9, w + 18, h + 18);
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      interior(g, x, y, w, h);
      const n = 1 + Math.floor(prand() * 3), slots = [0.18, 0.5, 0.82].sort(() => prand() - 0.5).slice(0, n);
      for (const sl of slots) { const stand = prand() < 0.3; person(g, x + w * sl + (prand() - 0.5) * 20, stand ? y + 24 : y + 50, y + h, stand, y + 17); }
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y); g.lineTo(x + 30, y + h); g.lineTo(x, y + h); g.fill();
      g.restore(); lit.push([x, y, w, h]);
    }
    for (const rel of [-8.1, -2.8, 2.8, 8.1]) {
      const x = px(rel - 0.65), y = py(0.35), w = 130, h = 290;
      g.fillStyle = '#2a2328'; g.fillRect(x - 5, y - 5, w + 10, h + 10); g.fillStyle = '#56474f'; g.fillRect(x, y, w, h); g.fillStyle = '#2a2328'; g.fillRect(x + 63, y, 4, h);
      for (const lx of [x + 10, x + 73]) {
        const wy = py(0.62); g.save(); g.beginPath(); g.rect(lx, wy, 46, 100); g.clip(); interior(g, lx, wy, 46, 100);
        if (prand() < 0.45) person(g, lx + 23, wy + 26, wy + 100, true, null);
        g.restore(); lit.push([lx, wy, 46, 100]);
      }
    }
    g.fillStyle = '#d9d2c4'; g.font = '700 18px Inconsolata, monospace'; g.fillText(String(8400 + vs % 97), px(6.9), py(3.05));
    const e = emi.ctx; e.fillStyle = '#000'; e.fillRect(0, 0, 1800, 340); e.filter = 'brightness(0.8)';
    for (const [x, y, w, h] of lit) e.drawImage(map.canvas, x, y, w, h, x, y, w, h);
    e.filter = 'none'; map.needsUpdate = emi.needsUpdate = true;
    return new T.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.5, metalness: 0.15 });
  }
  const sideMats = [carSideTex(3), carSideTex(17), carSideTex(41)];
  const sideMat = sideMats[0];
  const endMat = new T.MeshStandardMaterial({ color: lin('#3c3138'), roughness: 0.6, metalness: 0.2 });
  const roofMat = new T.MeshStandardMaterial({ color: lin('#6d6a72'), roughness: 0.45, metalness: 0.55 });
  const darkMat = new T.MeshStandardMaterial({ color: lin('#141316'), roughness: 0.9 });
  function cabTex(emi) {
    return canvasTex(300, 340, (g) => {
      g.fillStyle = emi ? '#000' : '#40353c'; g.fillRect(0, 0, 300, 340);
      if (!emi) { g.fillStyle = '#121a20'; g.fillRect(24, 40, 108, 120); g.fillRect(168, 40, 108, 120); g.fillStyle = '#d6732b'; g.fillRect(0, 228, 300, 13); }
      g.fillStyle = emi ? '#ff9a30' : '#ffb347'; g.fillRect(170, 50, 100, 22);
      g.fillStyle = emi ? '#3a2400' : '#2a1a00'; g.font = '700 15px Inconsolata, monospace'; g.fillText('NIGHT LINE', 178, 67);
      g.fillStyle = emi ? '#7a5208' : '#f2b233'; g.beginPath(); g.arc(78, 100, 28, 0, 7); g.fill();
      g.fillStyle = emi ? '#000' : '#fff'; g.font = '800 34px Archivo, Arial'; g.textAlign = 'center'; g.fillText('H', 78, 112);
      g.fillStyle = emi ? '#fffbe8' : '#fff7dc'; for (const x of [55, 245]) { g.beginPath(); g.arc(x, 262, 17, 0, 7); g.fill(); }
    });
  }
  const cabMat = new T.MeshStandardMaterial({ map: cabTex(false), emissiveMap: cabTex(true), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5 });

  const train = new T.Group(); scene.add(train);
  const carGeo = new T.BoxGeometry(W.CAR_L, W.CAR_H, W.CAR_W);
  const screens = [];
  const screenGeo = new T.PlaneGeometry(W.WIN_W, W.WIN_H), frameGeo = new T.PlaneGeometry(W.WIN_W + 0.13, W.WIN_H + 0.13);
  const yC = W.CAR_BOT + W.CAR_H / 2;
  for (let c = 0; c < W.NCARS; c++) {
    const cx = -W.CAR_L / 2 - c * W.PITCH;
    const head = c === 0, tail = c === W.NCARS - 1;
    const body = new T.Mesh(carGeo, [head ? cabMat : endMat, tail ? cabMat : endMat, roofMat, darkMat, sideMats[c % 3], sideMats[c % 3]]);
    body.position.set(cx, yC, 0); train.add(body);
    const roof = new T.Mesh(new T.BoxGeometry(W.CAR_L - 0.5, 0.32, W.CAR_W - 0.5), roofMat); roof.position.set(cx, yC + W.CAR_H / 2 + 0.14, 0); train.add(roof);
    for (const dx of [-4.5, 4.5]) { const ac = new T.Mesh(new T.BoxGeometry(2.4, 0.35, 1.6), roofMat); ac.position.set(cx + dx, yC + W.CAR_H / 2 + 0.45, 0); train.add(ac); }
    const under = new T.Mesh(new T.BoxGeometry(W.CAR_L - 3, 0.55, W.CAR_W - 0.6), darkMat); under.position.set(cx, W.CAR_BOT - 0.25, 0); train.add(under);
    for (const dx of [-6.4, 6.4]) { const b = new T.Mesh(new T.BoxGeometry(2.8, 0.55, 2.3), darkMat); b.position.set(cx + dx, W.CAR_BOT - 0.4, 0); train.add(b); }
    if (!tail) { const gw = new T.Mesh(new T.BoxGeometry(0.7, 2.6, 2.2), darkMat); gw.position.set(cx - W.CAR_L / 2 - 0.3, yC - 0.1, 0); train.add(gw); }
    W.WIN_REL.forEach((rel, j) => {
      const k = c * 3 + j; if (k >= PROJECTS.length) return;
      const frame = new T.Mesh(frameGeo, new T.MeshBasicMaterial({ color: lin('#59b8ff').multiplyScalar(0.85), transparent: true, opacity: 0, depthWrite: false }));
      frame.position.set(cx + rel, W.WIN_CY - yC + yC, -W.CAR_W / 2 - 0.008); frame.rotation.y = Math.PI; train.add(frame);
      const mat = new T.MeshBasicMaterial({ color: new T.Color(0.86, 0.86, 0.86), transparent: true, opacity: 0, depthWrite: false });
      const m = new T.Mesh(screenGeo, mat); m.position.set(cx + rel, W.WIN_CY, -W.CAR_W / 2 - 0.016); m.rotation.y = Math.PI; train.add(m);
      screens.push({ k, rel: cx + rel, mesh: m, frame, p: PROJECTS[k] });
    });
  }
  frameFix();
  function frameFix() { screens.forEach((s) => (s.frame.position.y = W.WIN_CY)); }
  // head and tail lights
  const hx = 0.06;
  for (const z of [-0.95, 0.95]) { W.glow('#fffaf0', 3.2, 1.3, hx, W.CAR_BOT + 0.85, z, train); }
  W.glow('#fff1d6', 0.55, 10, hx + 0.5, W.CAR_BOT + 0.9, 0, train);
  const beam = new T.Mesh(new T.PlaneGeometry(22, 3), new T.MeshBasicMaterial({ map: (() => canvasTex(256, 64, (g) => { const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,240,210,.16)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); }))(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(11.5, W.DECK + 0.25, 0); train.add(beam);
  const tailX = -W.NCARS * W.PITCH + 0.6 - 0.06;
  for (const z of [-0.95, 0.95]) W.glow('#ff2a1a', 2.2, 1.0, tailX, W.CAR_BOT + 0.85, z, train);
  const winX = (k) => HEAD_A + screens[k].rel;
  const FRAME_C = lin('#59b8ff').multiplyScalar(0.85), HOVER_C = lin('#cfeeff').multiplyScalar(1.9);

  // ---------- Screens ----------
  const ART = {
    tiles(g, w, h, t, a) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const x = 16 + c * 97, y = 52 + r * 72; g.fillStyle = '#121a2b'; g.fillRect(x, y, 89, 64);
        const ok = Math.sin(t * 1.3 + r * 3 + c * 7) > -0.7; g.fillStyle = ok ? a : '#ff5d5d'; g.beginPath(); g.arc(x + 10, y + 10, 4, 0, 7); g.fill();
        g.strokeStyle = a; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i < 12; i++) g.lineTo(x + 6 + i * 7, y + 44 - 14 * Math.abs(Math.sin(t * 2 + i * 0.7 + c + r * 2)));
        g.stroke(); g.fillStyle = '#7d8aa5'; g.font = '600 10px Inconsolata'; g.fillText('S-' + (r * 5 + c + 1), x + 20, y + 14);
      }
    },
    chat(g, w, h, t, a) {
      const msgs = ['hey, can you send the report?', 'Formal: Could you share the report?', 'ship it tonight 🚀', 'Friendly: Excited to ship this tonight!', 'why is this broken', 'Polite: Could you help me debug this?'];
      const off = (t * 22) % 60;
      for (let i = 0; i < 6; i++) {
        const y = 60 + i * 38 - off, me = i % 2; if (y < 40 || y > h - 20) continue;
        g.fillStyle = me ? 'rgba(110,231,168,.18)' : '#162033'; const tw = 30 + msgs[i].length * 6.4;
        g.fillRect(me ? w - tw - 18 : 18, y, tw, 28); g.fillStyle = me ? a : '#cdd6e6'; g.font = '600 12px Archivo'; g.fillText(msgs[i], (me ? w - tw - 18 : 18) + 10, y + 18);
      }
    },
    cards(g, w, h, t, a) {
      for (let i = 0; i < 3; i++) {
        const x = 18 + i * 162, y = 50; const gr = g.createLinearGradient(x, y, x + 150, y + 120);
        gr.addColorStop(0, ['#ff7ac8', '#7a8cff', '#ffcc4d'][i]); gr.addColorStop(1, '#1a1030'); g.fillStyle = gr; g.fillRect(x, y, 150, 120);
        g.fillStyle = '#121a2b'; g.fillRect(x, y + 130, 150, 70);
        const v = 0.5 + 0.45 * Math.sin(t * 0.9 + i * 2); g.fillStyle = a; g.fillRect(x + 10, y + 176, 130 * v, 8);
        g.fillStyle = '#cdd6e6'; g.font = '700 12px Archivo'; g.fillText(['Campaign A', 'Campaign B', 'Campaign C'][i], x + 10, y + 154);
      }
    },
    term(g, w, h, t, a) {
      const lines = ['$ myme convert ./openapi.yaml', '  parsing 42 endpoints…', '  validating tool schemas ✓', '  generating MCP server ✓', '$ myme serve --port 8080', '  MCP server ready: 42 tools'];
      const n = (t * 1.6) % (lines.length + 2);
      g.font = '600 14px Inconsolata';
      lines.forEach((l, i) => { if (i < n) { g.fillStyle = l[0] === '$' ? a : '#9fb0c8'; const s = i + 1 > n ? l.slice(0, Math.floor((n - i) * l.length)) : l; g.fillText(s, 20, 64 + i * 26); } });
      if (Math.floor(t * 2) % 2) { g.fillStyle = a; g.fillRect(20, 64 + Math.min(Math.floor(n), lines.length - 1) * 26 + 6, 9, 3); }
    },
    wave(g, w, h, t, a) {
      g.strokeStyle = a; g.lineWidth = 3; g.strokeRect(40, 56, 150, 150);
      g.fillStyle = '#1a2235'; g.beginPath(); g.arc(115, 125, 46, 0, 7); g.fill(); g.fillRect(70, 170, 90, 36);
      g.strokeStyle = '#6cc0f5'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < 260; i++) g.lineTo(220 + i, 120 + Math.sin(i * 0.15 + t * 6) * 26 * Math.sin(i * 0.02 + t));
      g.stroke();
      const sc = Math.round(78 + 12 * Math.sin(t * 0.7)); g.fillStyle = '#cdd6e6'; g.font = '800 30px Archivo'; g.fillText(sc + '%', 220, 210); g.font = '600 12px Inconsolata'; g.fillText('pitch confidence', 300, 205);
    },
  };
  function genDraw(s, t) {
    const g = s.tex.ctx, w = 512, h = 276, p = s.p;
    g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111827'; g.fillRect(0, 0, w, 30);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(16 + i * 16, 15, 5, 0, 7); g.fill(); });
    g.fillStyle = '#cdd6e6'; g.font = '700 13px Archivo'; g.fillText(p.name, 72, 20);
    if (ART[p.art]) ART[p.art](g, w, h, t, p.accent || '#6cc0f5');
    else { g.fillStyle = '#fff'; g.font = '800 34px Archivo'; g.fillText(p.name, 24, 140); g.fillStyle = '#7d8aa5'; g.font = '600 14px Inconsolata'; g.fillText(p.sub || '', 24, 170); }
    s.tex.needsUpdate = true;
  }
  const loader = new T.TextureLoader(); loader.setCrossOrigin('anonymous');
  const ASPECT = W.WIN_W / W.WIN_H;
  screens.forEach((s) => {
    const p = s.p;
    s.tex = canvasTex(512, 276, () => {}); s.mesh.material.map = s.tex; genDraw(s, 0);
    const url = p.kind === 'video' ? `https://i.ytimg.com/vi/${p.yt}/hqdefault.jpg` : p.kind === 'image' ? p.img : null;
    if (!url) { s.anim = true; return; }
    loader.load(url, (tx) => {
      tx.encoding = T.sRGBEncoding; tx.anisotropy = 8;
      const iw = tx.image.width, ih = tx.image.height;
      if (p.kind === 'video') { s.rep = [1, 0.75 * (16 / 9) / ASPECT]; }
      else { const a = iw / ih; s.rep = a > ASPECT ? [ASPECT / a, 1] : [1, a / ASPECT]; }
      tx.repeat.set(s.rep[0], s.rep[1]); tx.offset.set((1 - s.rep[0]) / 2, (1 - s.rep[1]) / 2);
      s.img = tx; s.mesh.material.map = tx; s.mesh.material.needsUpdate = true;
    }, undefined, () => { s.anim = true; });
  });

  // ---------- Experience lanterns on the bridge ----------
  // Each job is printed on a paper lantern hanging from the bridge cable; it glows once the train passes.
  const LANX = EXPERIENCE.map((_, k) => W.SHORE_A + 18 + k * 50);
  function wrap(g, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function fit(g, text, weight, size, maxW) { let s = size; g.font = `${weight} ${s}px Archivo, Arial`; while (g.measureText(text).width > maxW && s > 18) { s -= 2; g.font = `${weight} ${s}px Archivo, Arial`; } return s; }
  function drawLantern(g, e, k, img) {
    const w = 512, h = 648, PAD = 24;
    const r = g.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.5, 440);
    r.addColorStop(0, '#fff7e6'); r.addColorStop(0.6, '#f9e3bb'); r.addColorStop(1, '#e8b878');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,70,20,.09)'; g.lineWidth = 3; for (let x = 32; x < w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = e.color; g.fillRect(0, 0, w, 50);
    g.fillStyle = '#fff'; g.font = '700 22px Inconsolata, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('NIGHT LINE', PAD, 26); g.textAlign = 'right'; g.fillText(`${k + 1} OF ${EXPERIENCE.length}`, w - PAD, 26);
    // header: logo, big company name, dates
    g.fillStyle = '#fff'; g.beginPath(); g.arc(PAD + 44, 112, 44, 0, 7); g.fill(); g.strokeStyle = e.color; g.lineWidth = 5; g.stroke();
    if (img) { const s = 66, a = img.width / img.height; const iw = a > 1 ? s : s * a, ih = a > 1 ? s / a : s; g.drawImage(img, PAD + 44 - iw / 2, 112 - ih / 2, iw, ih); }
    else if (e.letter) { g.fillStyle = e.color; g.textAlign = 'center'; g.font = '800 46px Archivo, Arial'; g.fillText(e.letter, PAD + 44, 115); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#1a1410'; fit(g, e.org, 900, 60, w - 138 - PAD); g.fillText(e.org, 130, 118);
    g.fillStyle = e.color; g.font = '700 22px Inconsolata, monospace'; g.fillText(e.when.toUpperCase(), 132, 150);
    g.fillStyle = '#3a2c1e'; fit(g, e.role, 800, 32, w - 2 * PAD); g.fillText(e.role, PAD, 206);
    g.fillStyle = 'rgba(80,50,20,.28)'; g.fillRect(PAD, 224, w - 2 * PAD, 2);
    // stat band pinned to the bottom
    const SB = h - 112;
    g.fillStyle = 'rgba(138,60,14,.1)'; g.fillRect(0, SB, w, h - SB);
    g.fillStyle = 'rgba(80,50,20,.28)'; g.fillRect(0, SB, w, 2);
    g.textAlign = 'center'; g.fillStyle = '#8a3c0e'; fit(g, e.stat, 900, 58, 380); g.fillText(e.stat, w / 2, SB + 62);
    g.fillStyle = '#4a3a2a'; g.font = '600 21px Inconsolata, monospace'; g.fillText(e.statLbl, w / 2, SB + 94);
    // bullets fill the space between, centred vertically
    g.textAlign = 'left';
    const avail = SB - 226 - 30; let fs = 31, LHt, blocks, gap, total;
    do {
      g.font = `500 ${fs}px Archivo, Arial`; LHt = Math.round(fs * 1.28); gap = Math.round(fs * 0.7);
      blocks = e.pts.slice(0, 3).map((p) => wrap(g, p, w - 2 * PAD - 26));
      total = blocks.reduce((s, b) => s + b.length * LHt, 0) + gap * (blocks.length - 1); fs -= 1;
    } while (total > avail && fs > 16);
    let y = 226 + (SB - 226 - total) / 2 + LHt * 0.8;
    for (const lines of blocks) {
      g.fillStyle = e.color; g.beginPath(); g.arc(PAD + 6, y - LHt * 0.3, 6, 0, 7); g.fill();
      g.fillStyle = '#2a2016'; lines.forEach((l) => { g.fillText(l, PAD + 24, y); y += LHt; }); y += gap;
    }
  }
  const LW = 3.4, LH = 4.3, LD = 1.5;
  const lanterns = EXPERIENCE.map((e, k) => {
    const x = LANX[k], g = new T.Group(); g.position.set(x, 15.6, 13.9); g.rotation.y = -0.55; scene.add(g);
    const tex = canvasTex(512, 648, (c) => drawLantern(c, e, k, null));
    if (e.logo) { const im = new Image(); im.onload = () => { drawLantern(tex.ctx, e, k, im); tex.needsUpdate = true; }; im.src = e.logo; }
    const face = new T.MeshBasicMaterial({ map: tex, color: new T.Color(0.3, 0.3, 0.3) });
    const sideBase = lin(e.color).lerp(lin('#ffd9a0'), 0.55);
    const side = new T.MeshBasicMaterial({ color: sideBase.clone() });
    g.add(new T.Mesh(new T.BoxGeometry(LW, LH, LD), [side, side, darkMat, darkMat, face, face]));
    for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const p = new T.Mesh(new T.BoxGeometry(0.12, LH + 0.1, 0.12), darkMat); p.position.set(px * LW / 2, 0, pz * LD / 2); g.add(p); }
    for (const yy of [LH / 2 + 0.16, -LH / 2 - 0.16]) { const c = new T.Mesh(new T.BoxGeometry(LW + 0.4, 0.32, LD + 0.4), darkMat); c.position.y = yy; g.add(c); }
    const roof = new T.Mesh(new T.ConeGeometry(Math.hypot(LW, LD) / 2 + 0.25, 0.9, 4), darkMat); roof.rotation.y = Math.PI / 4; roof.scale.z = LD / LW + 0.15; roof.position.y = LH / 2 + 0.77; g.add(roof);
    const hook = new T.Mesh(new T.BoxGeometry(0.1, 2.4, 0.1), darkMat); hook.position.y = LH / 2 + 2.2; g.add(hook);
    const col = lin(e.color).lerp(lin('#ffd9a0'), 0.35);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: W.GLOW, color: col.clone().multiplyScalar(0), blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    halo.scale.set(11, 11, 1); halo.position.z = -0.4; g.add(halo);
    return { x, g, face, side, sideBase, halo, col };
  });

  // ---------- Skill constellations over the river ----------
  const cons = new T.Group(); scene.add(cons);
  const camMid = V3(959 - 28, 13, 7), C = V3(1450, 330, -640);
  const D = C.clone().sub(camMid).normalize(), R = D.clone().cross(V3(0, 1, 0)).normalize(), U = R.clone().cross(D).normalize();
  const origin = camMid.clone().add(D.clone().multiplyScalar(650));
  const at = (u, v) => origin.clone().add(R.clone().multiplyScalar(u)).add(U.clone().multiplyScalar(v));
  function textSprite(txt, color, h, size, weight = 700) {
    const c = document.createElement('canvas'); let g = c.getContext('2d');
    g.font = `${weight} ${size}px Archivo, Arial`;
    c.width = Math.ceil(g.measureText(txt).width + 48); c.height = 128; g = c.getContext('2d');
    g.font = `${weight} ${size}px Archivo, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 10; g.fillStyle = color; g.fillText(txt, c.width / 2, 64);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: true, fog: false }));
    sp.scale.set(h * c.width / 128, h, 1); sp.renderOrder = 10; return sp;
  }
  const CENT = [[-350, 20], [0, 150], [350, 20]];
  const SHAPE = [[0, 0], [1.1, 34], [2.0, 12], [3.2, 46], [4.0, 20], [5.1, -6], [6.0, 26], [7.1, 50], [8.0, 18], [9.1, 38]];
  const groups = SKILLS.map((grp, gi) => {
    const n = grp.items.length, [cu, cv] = CENT[gi], stars = [], pts = [];
    grp.items.forEach((name, k) => {
      const sh = SHAPE[k], prev = SHAPE[k - 1] || sh, next = SHAPE[k + 1] || sh, up = sh[1] >= (prev[1] + next[1]) / 2;
      const u = cu + (sh[0] - (n - 1) / 2) * 33, v = cv + (sh[1] - 22) * (gi === 1 ? -1 : 1) * 1.15;
      const p = at(u, v); pts.push(p);
      const glowC = lin(grp.color).lerp(new T.Color(1, 1, 1), 0.45).multiplyScalar(1.8);
      const star = new T.Sprite(new T.SpriteMaterial({ map: W.GLOW, color: glowC, blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: true, fog: false }));
      star.scale.set(13, 13, 1); star.position.copy(p); star.renderOrder = 9; cons.add(star);
      const lab = textSprite(name, '#f4f1ea', 22, 44, 700); lab.position.copy(at(u, v + ((gi === 1 ? !up : up) ? 17 : -17))); cons.add(lab);
      stars.push({ star, lab });
    });
    const segs = []; for (let k = 0; k < n - 1; k++) segs.push(pts[k], pts[k + 1]);
    const lg = new T.BufferGeometry().setFromPoints(segs);
    const line = new T.LineSegments(lg, new T.LineBasicMaterial({ color: lin(grp.color).multiplyScalar(1.2), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthTest: true, depthWrite: false, fog: false }));
    line.renderOrder = 8; cons.add(line);
    const title = textSprite(grp.group.toUpperCase(), grp.color, 37.5, 46, 800); title.position.copy(at(cu, cv + 92)); cons.add(title);
    return { stars, line, title, n };
  });
  function V3(x, y, z) { return new T.Vector3(x, y, z); }

  // ---------- Billboard canyon for achievements (a Times Square-style stretch beside the El) ----------
  const billboards = [];
  {
    const towerMat = new T.MeshStandardMaterial({ color: lin('#15161b'), roughness: 0.8, metalness: 0.3 });
    const PAL = [['#ff3d8b', '#2a0716'], ['#36d6ff', '#04182a'], ['#ffc531', '#241703'], ['#5dff9b', '#03200f'], ['#b07bff', '#150829'], ['#ff7a3d', '#2a0e03']];
    function awardBoard(a, k) {
      const [hi, bg] = PAL[k % PAL.length];
      const draw = (g, img) => {
        const gr = g.createLinearGradient(0, 0, 1024, 640); gr.addColorStop(0, bg); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
        // photo from the post, cover-fit into the left panel
        const PX = 34, PY = 34, PW = 400, PH = 572;
        g.fillStyle = '#000'; g.fillRect(PX, PY, PW, PH);
        if (img) {
          const ia = img.width / img.height, pa = PW / PH; let sw, sh, sx, sy;
          if (ia > pa) { sh = img.height; sw = sh * pa; sx = (img.width - sw) / 2; sy = 0; } else { sw = img.width; sh = sw / pa; sx = 0; sy = (img.height - sh) * 0.3; }
          if (/NYU_Logo/.test(a.img)) { g.fillStyle = '#fff'; g.fillRect(PX, PY, PW, PH); const s = 260; g.drawImage(img, PX + (PW - s) / 2, PY + (PH - s) / 2, s, s); }
          else { if (/\.png$/.test(a.img)) { g.fillStyle = '#fff'; g.fillRect(PX, PY, PW, PH); } g.drawImage(img, sx, sy, sw, sh, PX, PY, PW, PH); }
        }
        for (let y = 0; y < 640; y += 4) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(0, y, 1024, 1); }
        g.strokeStyle = hi; g.lineWidth = 14; g.strokeRect(14, 14, 996, 612);
        const isPaper = /IEEE/.test(a.what), TX = 470, TW = 520;
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.fillStyle = hi; g.font = '800 30px Inconsolata, monospace'; g.fillText((isPaper ? 'PUBLISHED  ·  ' : 'ACHIEVEMENT  ·  ') + a.when.toUpperCase(), TX, 120);
        g.fillStyle = '#fff'; let fs = 64; g.font = `900 ${fs}px Archivo, Arial`;
        const split = () => { const words = a.what.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > TW && cur) { lines.push(cur); cur = w; } else cur = t; } lines.push(cur); return lines; };
        let lines = split(); if (lines.length > 3) { fs = 52; g.font = `900 ${fs}px Archivo, Arial`; lines = split(); }
        lines.slice(0, 4).forEach((l, i) => g.fillText(l, TX, 210 + i * (fs + 8)));
        g.fillStyle = hi; g.fillRect(TX, 210 + Math.min(4, lines.length) * (fs + 8) - 18, 60, 6);
        g.fillStyle = '#d9dbe4'; g.font = '600 32px Archivo, Arial'; g.fillText(a.note, TX, 210 + Math.min(4, lines.length) * (fs + 8) + 34);
      };
      const tex = canvasTex(1024, 640, (g) => draw(g, null));
      if (a.img) { const im = new Image(); im.onload = () => { draw(tex.ctx, im); tex.needsUpdate = true; }; im.src = a.img; }
      return tex;
    }
    function decoBoard(k) {
      const [hi, bg] = PAL[(k + 2) % PAL.length], words = ['NIGHT LINE', 'NEW YORK', 'DATA · AI · BUILD', 'NEXT STOP', 'SHIP IT', 'OPEN LATE'];
      return canvasTex(512, 512, (g) => {
        const gr = g.createRadialGradient(256, 256, 20, 256, 256, 360); gr.addColorStop(0, hi); gr.addColorStop(1, bg); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
        g.globalAlpha = 0.25; for (let i = 0; i < 8; i++) { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 40 + i * 40, 0, 7); g.stroke(); } g.globalAlpha = 1;
        g.fillStyle = '#fff'; g.font = '900 64px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words[k % words.length], 256, 256);
      });
    }
    const board = (tex, w, h, x, y, z, ry, k = 1) => {
      const mt = new T.MeshBasicMaterial({ map: tex, color: new T.Color(k, k, k), toneMapped: false });
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mt); mesh.position.set(x, y, z); mesh.rotation.y = ry; scene.add(mesh);
      const frame = new T.Mesh(new T.BoxGeometry(w + 0.6, h + 0.6, 0.4), towerMat); frame.position.set(x, y, z - (ry ? -0.25 : 0.25)); frame.rotation.y = ry; scene.add(frame);
      billboards.push({ mesh, base: k }); return mesh;
    };
    // towers that carry the screens, on both sides of the track
    const X0 = 1085, X1 = 1235;
    for (const [z, dir] of [[-8.6, -1], [25.6, 1]]) for (let x = X0; x < X1; x += 24) {
      const h = 52 + ((x / 24) % 3) * 14, d = 22;
      const t = new T.Mesh(new T.BoxGeometry(22, h, d), towerMat); t.position.set(x + 11, h / 2, z + dir * d / 2); scene.add(t);
    }
    // all awards on the far wall (facing the track), 4 columns x 2 rows
    W.AW_COLS = [];
    AWARDS.forEach((a, k) => {
      const col = Math.floor(k / 2), row = k % 2, x = X1 - 22 - col * 26;
      if (row === 0) W.AW_COLS.push(x);
      board(awardBoard(a, k), 21, 13.1, x, row === 0 ? 27.6 : 14.0, 25.2, Math.PI, 1.05);
    });
    // decorative screens on the near wall and above the ticker
    let dk = 0;
    for (let x = X0 + 4; x < X1; x += 26) {
      board(decoBoard(dk++), 7, 7, x, 36 + (dk % 2) * 6, -8.2, 0, 0.9);
      board(decoBoard(dk++), 5, 9, x + 15, 8.5 + (dk % 3), -8.2, 0, 0.8);
    }
    for (let x = X0 + 8; x < X1; x += 18) board(decoBoard(dk++), 6, 5, x, 41, 25.2, Math.PI, 0.85);
    const tick = canvasTex(4096, 128, (g) => {
      g.fillStyle = '#050505'; g.fillRect(0, 0, 4096, 128);
      g.font = '800 72px Archivo, Arial'; g.textBaseline = 'middle'; let x = 30;
      for (const a of [...AWARDS, ...AWARDS]) { g.fillStyle = '#ffc531'; g.fillText('●', x, 66); x += 70; g.fillStyle = '#fff'; g.fillText(a.what.toUpperCase(), x, 66); x += g.measureText(a.what.toUpperCase()).width + 70; if (x > 4000) break; }
    });
    tick.wrapS = T.RepeatWrapping;
    for (const [z, ry] of [[-8.25, 0], [25.25, Math.PI]]) {
      const t = new T.Mesh(new T.PlaneGeometry(X1 - X0, 2.4), new T.MeshBasicMaterial({ map: tick, color: new T.Color(1.1, 1.1, 1.1) }));
      t.position.set((X0 + X1) / 2, z > 0 ? 36.6 : 30, z); t.rotation.y = ry; scene.add(t);
    }
    W.ticker = tick;
  }

  // ---------- Timeline ----------
  const SC = [
    { id: 'start', len: 1.3, tr: 0.7, arc: 9 },
    { id: 'projects', len: 4.0, tr: 0.6, arc: 10 },
    { id: 'experience', len: 3.4, tr: 0.45, arc: 6 },
    { id: 'skills', len: 2.0, tr: 0.5 },
    { id: 'education', len: 1.5, tr: 0.5 },
    { id: 'awards', len: 2.0, tr: 0.35 },
    { id: 'contact', len: 1.0, tr: 0 },
  ];
  let acc = 0; SC.forEach((s) => { s.at = acc; acc += s.len; });
  const TOTAL = acc;
  const HEAD_A = W.STATION_A[1] - 13, HEAD_B = W.STATION_B[1] - 13, HEAD_C = W.STATION_C[1] - 13;
  const ease = { out: (t) => 1 - Math.pow(1 - t, 3), inq: (t) => t * t, io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) };
  const TRAIN = [
    (f) => lerp(96, HEAD_A, ease.out(f)),
    () => HEAD_A,
    (f) => (f < 0.1 ? lerp(HEAD_A, W.SHORE_A, ease.inq(f / 0.1)) : lerp(W.SHORE_A, W.SHORE_B - 4, (f - 0.1) / 0.9)),
    (f) => lerp(W.SHORE_B - 4, 985, f),
    (f) => lerp(985, HEAD_C, ease.out(Math.min(1, f / 0.45))),
    (f) => lerp(HEAD_C, 1240, ease.out(f)),
    (f) => lerp(1240, HEAD_B, ease.out(f)),
  ];
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const lanU = (f) => clamp((f - 0.11) / 0.66); // lantern walk finishes early so the last one holds before the next stop
  function walkX(f) {
    const n = screens.length, u = clamp(f, 0, 1) * (n - 1), k = Math.min(n - 2, Math.floor(u)), fr = u - k;
    const e = smooth(0.18, 0.82, fr);
    return lerp(winX(k), winX(k + 1), e);
  }
  const SHOTS = [
    (f, x) => ({ p: V(136 - f * 2, 8.3 + f * 0.6, 17), t: V(x - 16, 9.0, -2), fov: 50 }),
    (f) => { const cx = walkX(f); return { p: V(cx, W.WIN_CY + 0.35, -7.6), t: V(cx, W.WIN_CY + 0.35, 0), fov: 56, hf: 46 }; },
    (f, x) => {
      const chase = { p: V(x - 26, 13.5, 19), t: V(x + 30, 12.8, 2) };
      const n = LANX.length, u = lanU(f) * (n - 1), k = Math.min(n - 2, Math.floor(u)), lx = lerp(LANX[k], LANX[k + 1], smooth(0.22, 0.78, u - k));
      const walk = { p: V(lx - 4.3, 15.2, 21.0), t: V(lx, 15.3, 13.9) }, w = smooth(0.05, 0.13, f);
      return { p: chase.p.lerp(walk.p, w), t: chase.t.lerp(walk.t, w), fov: 52 };
    },
    (f, x) => ({ p: V(x - 28, 13, 7), t: V(x + 140, 95, -160), fov: 56 }),
    (f, x) => ({ p: V(HEAD_C + 26, 13.5 + f * 1.5, 13), t: V(HEAD_C - 120, 12, -4), fov: 54 }),
    (f) => { const C = W.AW_COLS, n = C.length, u = clamp(f * 1.4 - 0.05) * (n - 1), k = Math.min(n - 2, Math.floor(u)), cx = lerp(C[k], C[k + 1], smooth(0.2, 0.8, u - k)); return { p: V(cx, 12.5, -7), t: V(cx, 17, 25), fov: 62, hf: 52 }; },
    (f, x) => ({ p: V(x + 40 - f * 6, 30, 36), t: V(x - 32, 8, 0), fov: 50 }),
  ];
  function sceneAt(s) {
    for (let i = SC.length - 1; i >= 0; i--) if (s >= SC[i].at) return { i, f: clamp((s - SC[i].at) / SC[i].len) };
    return { i: 0, f: 0 };
  }
  function state(s) {
    const { i, f } = sceneAt(s);
    const x = TRAIN[i](f);
    let shot = SHOTS[i](f, x);
    const pres = SC.map(() => 0); pres[i] = 1;
    const sc = SC[i], into = s - (sc.at + sc.len - sc.tr);
    if (i < SC.length - 1 && sc.tr && into > 0) {
      const w = smooth(0, 1, into / sc.tr), nx = SHOTS[i + 1](0, x);
      shot = { p: shot.p.clone().lerp(nx.p, w), t: shot.t.clone().lerp(nx.t, w), fov: lerp(shot.fov, nx.fov, w) };
      if (sc.arc) shot.p.y += Math.sin(w * Math.PI) * sc.arc;
      pres[i] = 1 - w; pres[i + 1] = w;
    }
    return { i, f, x, shot, pres };
  }

  // ---------- UI hooks ----------
  const L = { title: $('title'), ds: $('dock-start'), de: $('dock-end'), pj: $('pj'), xp: $('xp'), sk: $('sk'), edx: $('edx'), aw: $('aw') };
  const show = (el, o) => { el.style.opacity = o.toFixed(3); el.style.visibility = o < 0.01 ? 'hidden' : 'visible'; };
  const plates = [...document.querySelectorAll('.plate')];
  const meterCells = [...document.querySelectorAll('#cars i')];
  const lans = [...document.querySelectorAll('.lan')];
  const lm = [...document.querySelectorAll('#linemap li')];
  const edBlk = [...document.querySelectorAll('.edx .blk')];
  const goTo = (i) => scrollTo({ top: (SC[i].at + (i === 1 ? 0.02 : 0.05)) * innerHeight, behavior: 'smooth' });
  $('linemap').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) goTo(+li.dataset.i); });
  document.querySelectorAll('.lines li').forEach((li) => li.addEventListener('click', () => goTo(+li.dataset.i)));

  const frames = $('frames'), iframes = {};
  const v3 = new T.Vector3();
  function rectOf(k) {
    const cx = train.position.x + screens[k].rel;
    v3.set(cx - W.WIN_W / 2, W.WIN_CY + W.WIN_H / 2, -W.CAR_W / 2).project(camera);
    const x0 = (v3.x + 1) / 2 * innerWidth, y0 = (1 - v3.y) / 2 * innerHeight;
    v3.set(cx + W.WIN_W / 2, W.WIN_CY - W.WIN_H / 2, -W.CAR_W / 2).project(camera);
    const x1 = (v3.x + 1) / 2 * innerWidth, y1 = (1 - v3.y) / 2 * innerHeight;
    return { l: Math.min(x0, x1), t: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), z: v3.z };
  }
  let hoverK = -1, plateHover = -1;
  const winAt = (cx, cy) => { for (const s of screens) { const r = rectOf(s.k); if (cx > r.l && cx < r.l + r.w && cy > r.t && cy < r.t + r.h) return s.k; } return -1; };
  canvas.addEventListener('pointermove', (e) => { hoverK = curPres[1] > 0.6 ? winAt(e.clientX, e.clientY) : -1; canvas.style.cursor = hoverK >= 0 ? 'pointer' : ''; });
  canvas.addEventListener('pointerleave', () => { hoverK = -1; canvas.style.cursor = ''; });
  plates.forEach((p, k) => { p.addEventListener('pointerenter', () => (plateHover = k)); p.addEventListener('pointerleave', () => (plateHover = -1)); });
  canvas.addEventListener('click', (e) => {
    if (curPres[1] < 0.6) return;
    for (const s of screens) { const r = rectOf(s.k); if (e.clientX > r.l && e.clientX < r.l + r.w && e.clientY > r.t && e.clientY < r.t + r.h) { openProject(s.k); return; } }
  });
  let curPres = [];

  function ui(st, time) {
    const { i, f, pres, x } = st; curPres = pres;
    show(L.title, i === 0 ? 1 - smooth(0.05, 0.4, f) : 0);
    show(L.ds, i === 0 ? 1 - smooth(0.45, 0.75, f) : 0);
    show(L.de, pres[6]);
    // projects
    const pjo = smooth(0.4, 1, pres[1]); show(L.pj, pjo);
    let lo = 99, hi = -1;
    if (pjo > 0) {
      screens.forEach((s) => {
        const r = rectOf(s.k), vis = r.l + r.w > 0 && r.l < innerWidth && r.z < 1;
        const b = plates[s.k];
        if (vis) { b.style.display = ''; b.style.left = (r.l + r.w / 2) + 'px'; b.style.top = (r.t + r.h + Math.max(10, r.h * 0.16)) + 'px'; }
        else b.style.display = 'none';
        if (r.l + r.w * 0.5 > 0 && r.l + r.w * 0.5 < innerWidth) { lo = Math.min(lo, s.k); hi = Math.max(hi, s.k); }
        // live video in the window
        const want = vis && s.p.kind === 'video' && pres[1] > 0.7;
        let fr = iframes[s.k];
        if (want && !fr) {
          fr = document.createElement('div'); fr.className = 'vframe';
          const y = s.p.yt;
          fr.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${y}?autoplay=1&mute=1&loop=1&playlist=${y}&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&disablekb=1&start=${s.p.start || 0}" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" title="${s.p.name} demo" tabindex="-1"></iframe>`;
          frames.appendChild(fr); iframes[s.k] = fr;
          fr.querySelector('iframe').addEventListener('load', () => setTimeout(() => fr.classList.add('on'), 900));
        }
        if (fr) {
          if (!want) { fr.remove(); delete iframes[s.k]; }
          else {
            Object.assign(fr.style, { left: r.l + 'px', top: r.t + 'px', width: r.w + 'px', height: r.h + 'px' });
            const ifr = fr.firstChild, cw = Math.max(r.w, r.h * 16 / 9) * 1.32;
            ifr.style.width = cw + 'px'; ifr.style.height = (cw * 9 / 16) + 'px';
          }
        }
      });
    } else for (const k in iframes) { iframes[k].remove(); delete iframes[k]; }
    // hover card: two points about the window under the pointer
    const hk = pjo > 0.5 ? (hoverK >= 0 ? hoverK : plateHover) : -1, tip = $('pjtip');
    if (hk >= 0) {
      if (tip.dataset.k !== String(hk)) { const p = PROJECTS[hk]; tip.innerHTML = `<b>${p.name}</b><small>${p.sub} · ${p.year}</small><ul>${(p.pts || []).map((t) => `<li>${t}</li>`).join('')}</ul>`; tip.dataset.k = hk; }
      const r = rectOf(hk), above = r.t > 150;
      tip.style.transform = above ? 'translate(-50%,-100%)' : 'translate(-50%,0)';
      tip.style.left = clamp(r.l + r.w / 2, 170, innerWidth - 170) + 'px';
      tip.style.top = (above ? r.t - 12 : r.t + r.h + 56) + 'px';
      tip.classList.add('on');
    } else tip.classList.remove('on');
    if (hi >= 0) { $('metertxt').textContent = `Windows ${lo + 1} to ${hi + 1} of ${screens.length}`; meterCells.forEach((c, k) => c.classList.toggle('on', k >= lo && k <= hi)); }
    // experience: lanterns light as the train passes; the newest lit one carries its caption
    show(L.xp, smooth(0.35, 1, pres[2]));
    let act = -1;
    lanterns.forEach((l, k) => {
      const wu = i === 2 ? lanU(f) * (lanterns.length - 1) : i > 2 ? 99 : -1;
      const b = Math.max(clamp((x - l.x + 4) / 6), clamp((wu - k + 0.45) / 0.25));
      if (b > 0.5) act = k;
      l.face.color.setScalar(lerp(0.3, 0.95, b));
      l.side.color.copy(l.sideBase).multiplyScalar(lerp(0.25, 1.2, b));
      l.halo.material.color.copy(l.col).multiplyScalar(lerp(0.0, 0.5, b));
    });
    if (pres[2] > 0) {
      lans.forEach((el, k) => {
        const on = k === act && i === 2;
        if (on) el.style.transform = `translate(${Math.round(innerWidth * (innerWidth < 760 ? 0.5 : 0.3))}px, ${Math.round(innerHeight * (innerWidth < 760 ? 0.62 : 0.17))}px) translate(-50%, 0)`;
        el.style.opacity = on ? 1 : 0;
      });
      $('xpcount').textContent = `${Math.max(0, act + 1)} of ${lans.length}`;
    }
    // skills: constellations draw themselves star by star
    show(L.sk, smooth(0.3, 1, pres[3]));
    const cvis = pres[3];
    cons.visible = cvis > 0.01;
    let lit = 0;
    if (cons.visible) {
      const ff = i === 3 ? f : i > 3 ? 1 : 0;
      groups.forEach((g, gi) => {
        const pg = clamp((ff - gi * 0.24) / 0.34) * g.n;
        g.stars.forEach((s, k) => {
          const o = clamp(pg - k); if (o > 0.5) lit++;
          const tw = 1 + 0.12 * Math.sin(time * 3 + k * 1.7 + gi);
          s.star.material.opacity = o * cvis; s.star.scale.set(13 * tw * (0.6 + 0.4 * o), 13 * tw * (0.6 + 0.4 * o), 1);
          s.lab.material.opacity = clamp(o * 1.5 - 0.5) * cvis;
        });
        g.line.geometry.setDrawRange(0, Math.max(0, Math.floor(pg) - 1) * 2 + (pg % 1 > 0.5 && pg < g.n ? 2 : 0));
        g.line.material.opacity = 0.75 * cvis;
        g.title.material.opacity = clamp(pg) * cvis;
      });
    }
    $('skcount').textContent = `${lit} of ${SKILL_LIST.length}`;
    // education and awards in the air
    show(L.edx, smooth(0.4, 1, pres[4]));
    if (pres[4] > 0) { const ff = i === 4 ? f : i > 4 ? 1 : 0; edBlk.forEach((b, k) => { const o = k === 0 ? 1 - smooth(0.46, 0.56, ff) : smooth(0.54, 0.64, ff); b.style.opacity = o; b.style.transform = `translateY(${(1 - o) * (k ? 16 : -16)}px)`; }); }
    show(L.aw, smooth(0.4, 1, pres[5]));
    if (W.ticker) W.ticker.offset.x = (time * 0.03) % 1;
    billboards.forEach((b, k) => b.mesh.material.color.setScalar(b.base * (0.92 + 0.08 * Math.sin(time * 2.2 + k * 1.7))));
    // line map
    const here = pres[i + 1] > 0.5 ? i + 1 : i;
    lm.forEach((li, k) => { li.classList.toggle('past', k < here); li.classList.toggle('here', k === here); });
    const nowTxt = 'Now at ' + STOPS[here].name;
    if ($('now').lastChild.textContent !== nowTxt) $('now').lastChild.textContent = nowTxt;
  }

  // ---------- Loop ----------
  let sm = scrollY / innerHeight, last = performance.now(), lastArt = 0, first = true;
  W.train = train; W.camera = camera;
  function frame(now) { step(now); requestAnimationFrame(frame); }
  function step(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    const target = clamp(scrollY / innerHeight, 0, TOTAL);
    sm += (target - sm) * Math.min(1, dt * 5);
    if (Math.abs(target - sm) < 1e-4) sm = target;
    const time = now / 1000, st = state(sm);
    train.position.x = st.x;
    camera.position.copy(st.shot.p); camera.lookAt(st.shot.t);
    const asp = innerWidth / innerHeight, pj = st.pres[1], hT = lerp(Math.tan(st.shot.fov * Math.PI / 360) * 1.5, Math.tan(46 * Math.PI / 360), pj);
    const fov = asp < 1.5 ? Math.max(st.shot.fov * (1 - pj), Math.min(82, 2 * Math.atan(hT / asp) * 180 / Math.PI)) : st.shot.fov;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    // project screens
    const so = smooth(0.25, 0.95, st.pres[1]);
    const camX = camera.position.x;
    let focus = -1, best = 1e9;
    screens.forEach((s) => { const d = Math.abs(st.x + s.rel - camX); if (d < best) { best = d; focus = s.k; } });
    screens.forEach((s) => {
      s.mesh.material.opacity = so; s.mesh.visible = so > 0.001;
      const hov = s.k === hoverK || s.k === plateHover;
      s.frame.material.color.copy(hov ? HOVER_C : FRAME_C).multiplyScalar(hov ? 1 + 0.25 * Math.sin(time * 6) : 1);
      s.frame.scale.setScalar(hov ? 1.025 : 1);
      s.frame.material.opacity = so * (hov ? 1 : s.k === focus ? 0.55 : 0.0); s.frame.visible = so > 0.001;
      plates[s.k].classList.toggle('hov', hov);
      if (iframes[s.k]) iframes[s.k].classList.toggle('hov', hov);
      if (s.img && s.rep) { const sl = [1 - s.rep[0], 1 - s.rep[1]]; s.img.offset.set(sl[0] * (0.5 + 0.5 * Math.sin(time * 0.15 + s.k)), sl[1] * (0.5 + 0.5 * Math.cos(time * 0.12 + s.k))); }
    });
    if (so > 0.01 && now - lastArt > 80) { lastArt = now; screens.forEach((s) => { if (s.anim && Math.abs(st.x + s.rel - camX) < 14) genDraw(s, time); }); }
    W.camLight.position.set(camera.position.x, camera.position.y - 0.4, camera.position.z + 2.2);
    W.camLight.intensity = 0.9 * st.pres[1];
    W.updateTraffic(time);
    (W.towerLights || []).forEach((l) => (l.material.opacity = Math.sin(time * 3) > 0 ? 1 : 0.15));
    W.sky.position.copy(camera.position); W.stars.position.copy(camera.position);
    const day = 1 - smooth(6.4, 8.5, sm); W.setDay(day, camera.position, 2.86 * smooth(4.9, 6.1, sm), time); W.updateShips(time);
    sideMats.forEach((sm2) => (sm2.emissiveIntensity = lerp(0.95, 0.45, day)));
    bloom.threshold = lerp(0.88, 0.97, day); bloom.strength = lerp(0.62, 0.4, day);
    ui(st, time);
    composer.render();
    if (first) { first = false; $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 700); }
  }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
