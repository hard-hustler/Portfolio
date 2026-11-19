// The 3D night city: avenue, elevated line, stations, bridge, river, skyline, train, coins.
(function () {
  const T = THREE;
  const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const W = (window.WORLD = {});
  const scene = (W.scene = new T.Scene());
  const FOG = lin('#2a2235');
  scene.fog = new T.FogExp2(FOG, 0.0021);

  // Layout constants
  const DECK = 7.0, CAR_L = 18, PITCH = 18.6, CAR_W = 3.0, CAR_H = 3.4, CAR_BOT = 7.55;
  const WIN_W = 2.7, WIN_H = 1.45, WIN_CY = 9.55, WIN_REL = [5.6, 0, -5.6];
  const NCARS = Math.ceil(PROJECTS.length / 3);
  Object.assign(W, { DECK, CAR_L, PITCH, CAR_W, CAR_H, CAR_BOT, WIN_W, WIN_H, WIN_CY, WIN_REL, NCARS });
  const SHORE_A = 488, SHORE_B = 922; // river between these x values
  const STATION_A = [18, 134], STATION_B = [1250, 1360], STATION_C = [950, 1062];
  W.SHORE_A = SHORE_A; W.SHORE_B = SHORE_B;

  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = 4; t.canvas = c; t.ctx = g;
    return t;
  }
  const GLOW = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,.75)'); r.addColorStop(0.45, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  }, false);
  const glowMats = {};
  function glowMat(hex, k) {
    const key = hex + k;
    if (!glowMats[key]) { glowMats[key] = new T.SpriteMaterial({ map: GLOW, color: lin(hex).multiplyScalar(k), blending: T.AdditiveBlending, depthWrite: false, transparent: true }); glowMats[key].userData.base = glowMats[key].color.clone(); }
    return glowMats[key];
  }
  function glow(hex, k, s, x, y, z, parent = scene) {
    const sp = new T.Sprite(glowMat(hex, k)); sp.scale.set(s, s, 1); sp.position.set(x, y, z); parent.add(sp); return sp;
  }
  W.glow = glow; W.GLOW = GLOW;

  // Instanced boxes
  const dummy = new T.Object3D();
  function boxes(list, color, opts = {}) {
    if (!list.length) return null;
    const mat = opts.mat || new T.MeshStandardMaterial({ color: lin(color), roughness: opts.rough ?? 0.8, metalness: opts.metal ?? 0.2, emissive: opts.emissive ? lin(opts.emissive) : 0x000000, emissiveIntensity: opts.ei ?? 1 });
    const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat, list.length);
    list.forEach((b, i) => {
      dummy.position.set(b[0], b[1], b[2]); dummy.scale.set(b[3], b[4], b[5]);
      dummy.rotation.set(b[6] || 0, b[7] || 0, b[8] || 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    scene.add(m); return m;
  }

  // Sky dome with vertex colours, stars, moon
  {
    const g = new T.SphereGeometry(2800, 64, 64);
    const cols = [], p = g.attributes.position;
    const stops = [[-1.01, '#15121d'], [-0.02, '#2a2236'], [0.02, '#3a2c45'], [0.1, '#2a2240'], [0.25, '#181932'], [0.5, '#0d0e1c'], [1.01, '#06070e']];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 2800; let c = lin(stops[0][1]);
      for (let k = 0; k < stops.length - 1; k++) if (y >= stops[k][0] && y <= stops[k + 1][0]) { const t = (y - stops[k][0]) / (stops[k + 1][0] - stops[k][0]); c = lin(stops[k][1]).lerp(lin(stops[k + 1][1]), t); }
      if (y > 1) c = lin('#05060c');
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    const sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -2; scene.add(sky); W.sky = sky;
    const sp = [];
    for (let i = 0; i < 1400; i++) { const a = rnd() * Math.PI * 2, e = 0.08 + Math.pow(rnd(), 0.7) * 1.4; sp.push(Math.cos(a) * Math.cos(e) * 2600, Math.sin(e) * 2600, Math.sin(a) * Math.cos(e) * 2600); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const stars = new T.Points(sg, new T.PointsMaterial({ color: 0xbfc8ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }));
    scene.add(stars); W.stars = stars;
    const moonTex = canvasTex(256, 256, (g2) => {
      const r = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,248,230,1)'); r.addColorStop(0.2, 'rgba(255,244,220,1)'); r.addColorStop(0.23, 'rgba(255,230,200,.35)'); r.addColorStop(0.5, 'rgba(220,200,255,.08)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = r; g2.fillRect(0, 0, 256, 256);
    });
    const moon = new T.Sprite(new T.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending, color: new T.Color(1.3, 1.25, 1.2) }));
    moon.scale.set(260, 260, 1); moon.position.set(800, 520, 1500); scene.add(moon); W.moon = moon;
  }

  // Lights
  const hemi = new T.HemisphereLight(lin('#6c6aa8'), lin('#2a1d16'), 0.55); scene.add(hemi);
  const sunLight = new T.DirectionalLight(lin('#ffb36b'), 0); sunLight.position.set(-520, 70, 30); scene.add(sunLight);
  const moonLight = new T.DirectionalLight(lin('#a8b4ff'), 0.35); moonLight.position.set(300, 500, 600); scene.add(moonLight);
  scene.add(new T.AmbientLight(lin('#3a3550'), 0.25));
  const camLight = (W.camLight = new T.PointLight(lin('#ffd9a0'), 0, 34, 1.6)); scene.add(camLight);

  // Facade textures
  const CELLW = 2.6, CELLH = 3.3, COLS = 8, ROWS = 8;
  function facade(wall, litP, warm) {
    const wins = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) wins.push(rnd() < litP ? pick(warm) : null);
    const draw = (emi) => (g, w, h) => {
      const cw = w / COLS, ch = h / ROWS;
      g.fillStyle = emi ? '#000' : wall; g.fillRect(0, 0, w, h);
      if (!emi) for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rr(0.02, 0.06)})`; g.fillRect(rnd() * w, rnd() * h, rr(4, 18), rr(2, 6)); }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = c * cw + cw * 0.22, y = r * ch + ch * 0.2, ww = cw * 0.56, hh = ch * 0.56, lit = wins[r * COLS + c];
        if (!emi) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 2, y + hh, ww + 4, 3); }
        if (lit) {
          const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, lit); gr.addColorStop(1, emi ? shade(lit, 0.55) : shade(lit, 0.7));
          g.fillStyle = gr; g.fillRect(x, y, ww, hh);
          if (rnd() < 0.4) { g.fillStyle = emi ? 'rgba(0,0,0,.55)' : 'rgba(40,25,10,.5)'; g.fillRect(x, y, ww, hh * rr(0.2, 0.5)); }
        } else if (!emi) { g.fillStyle = rnd() < .5 ? '#15171d' : '#1c1f27'; g.fillRect(x, y, ww, hh); }
      }
    };
    const map = canvasTex(256, 256, draw(false)), emi = canvasTex(256, 256, draw(true));
    [map, emi].forEach((t) => { t.wrapS = t.wrapT = T.RepeatWrapping; });
    return new T.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.92, metalness: 0.05 });
  }
  function shade(hex, k) { const c = new T.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
  const WARM = ['#ffd08a', '#ffc070', '#ffe2b0', '#ffb860', '#f7d7a0', '#cfdcff'];
  const COOL = ['#dfe8ff', '#cfe0ff', '#fff2d8', '#bcd2ff'];
  const MAT = {
    brick: [facade('#5a2c22', 0.32, WARM), facade('#4e2a24', 0.28, WARM), facade('#62372a', 0.36, WARM)],
    stone: [facade('#5a4c3e', 0.3, WARM), facade('#45403c', 0.3, WARM)],
    tower: [facade('#1e232d', 0.55, COOL), facade('#262b36', 0.45, COOL), facade('#2c2a2a', 0.5, WARM)],
  };
  const roofMat = new T.MeshStandardMaterial({ color: lin('#1b1a1f'), roughness: 1 });
  const towerWood = new T.MeshStandardMaterial({ color: lin('#4a382c'), roughness: 1 });
  const cyl = new T.CylinderGeometry(1, 1, 1, 12), cone = new T.ConeGeometry(1, 1, 12);

  function building(x, z, w, d, h, mats, opts = {}) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, sx = [d, d, 0, 0, w, w];
    for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) {
      const i = f * 4 + j;
      if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.99); continue; }
      uv.setXY(i, uv.getX(i) * sx[f] / (CELLW * COLS) + (opts.u || 0), uv.getY(i) * h / (CELLH * ROWS));
    }
    const m = new T.Mesh(g, pick(mats)); m.position.set(x, opts.y0 + h / 2 || h / 2, z); scene.add(m);
    if (h < 60 && rnd() < 0.55) { const c = new T.Mesh(new T.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat); c.position.set(x, h - 0.2, z); scene.add(c); }
    if (opts.tank && rnd() < 0.3) waterTower(x + rr(-w / 4, w / 4), h, z + rr(-d / 4, d / 4));
    if (opts.spire) { const s = new T.Mesh(cone, roofMat); s.scale.set(w * 0.3, opts.spire, d * 0.3); s.position.set(x, h + opts.spire / 2, z); scene.add(s); glow('#ff5040', 2.5, 4, x, h + opts.spire, z); }
    return m;
  }
  function waterTower(x, y, z) {
    const legs = new T.Mesh(new T.BoxGeometry(2.2, 2, 2.2), roofMat); legs.position.set(x, y + 1, z); scene.add(legs);
    const t = new T.Mesh(cyl, towerWood); t.scale.set(1.5, 2.6, 1.5); t.position.set(x, y + 3.3, z); scene.add(t);
    const r = new T.Mesh(cone, towerWood); r.scale.set(1.7, 1.2, 1.7); r.position.set(x, y + 5.2, z); scene.add(r);
  }
  function row(x0, x1, zFront, dir, hMin, hMax, mats, opts = {}) {
    let x = x0;
    while (x < x1) {
      if (opts.street && rnd() < 0.09) { x += 14; continue; }
      if (opts.canyon && x + 22 > 1076 && x < 1246) { x += 8; continue; }
      const w = rr(opts.wMin || 8, opts.wMax || 20), d = rr(opts.dMin || 14, opts.dMax || 26);
      let h = rr(hMin, hMax); if (opts.tall && rnd() < opts.tall) h *= rr(1.6, 2.6);
      building(x + w / 2, zFront + dir * d / 2, w, d, h, mats, { tank: opts.tank });
      x += w + rr(0, 0.8);
    }
  }

  // Ground: two shores, far shore, river
  const asphalt = new T.MeshStandardMaterial({ color: lin('#17171d'), roughness: 0.95 });
  const walk = new T.MeshStandardMaterial({ color: lin('#26252b'), roughness: 1 });
  function plane(x0, x1, z0, z1, y, mat) { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), mat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); return m; }
  plane(-900, SHORE_A, -140, 260, 0, asphalt);
  plane(SHORE_B, 2200, -140, 260, 0, asphalt);
  plane(-900, 2200, -1400, -260, 0, asphalt);
  plane(-900, SHORE_A, 24, 26, 0.05, walk); plane(-900, SHORE_A, 2.5, 4.5, 0.05, walk);
  const water = new T.Mesh(new T.PlaneGeometry(5000, 5000), new T.MeshStandardMaterial({ color: lin('#0b1222'), roughness: 0.28, metalness: 0.5 }));
  water.rotation.x = -Math.PI / 2; water.position.set(700, -6, 0); scene.add(water); W.water = water;
  boxes([[SHORE_A - 2, -3, 60, 4, 6, 400], [SHORE_B + 2, -3, 60, 4, 6, 400], [700, -3, -138, 2400, 6, 4], [700, -3, -262, 2400, 6, 4]], '#2b2826');
  // lane dashes and crosswalks
  const dashes = [];
  for (let x = -880; x < SHORE_A - 10; x += 9) { dashes.push([x, 0.06, 14, 3, 0.02, 0.18]); }
  for (let x = -840; x < SHORE_A - 20; x += 90) for (let k = 0; k < 8; k++) dashes.push([x, 0.06, 6 + k * 2.4, 3.5, 0.02, 1.1]);
  boxes(dashes, '#8a8676', { rough: 1 });
  // river glints: city light on the water
  for (let i = 0; i < 90; i++) {
    const x = rr(SHORE_A + 10, SHORE_B - 10), z = pick([rr(-130, -20), rr(20, 250)]);
    const s = new T.Mesh(new T.PlaneGeometry(rr(0.3, 0.8), rr(4, 14)), new T.MeshBasicMaterial({ color: lin(pick(WARM)).multiplyScalar(0.5), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.set(x, -5.95, z); scene.add(s);
  }

  // Manhattan avenue
  seed = 11;
  row(-900, SHORE_A - 18, 26, 1, 12, 34, [...MAT.brick, ...MAT.stone], { street: true, tank: true, tall: 0.12 });
  row(-900, SHORE_A - 18, 62, 1, 22, 60, [...MAT.stone, ...MAT.tower], { street: true, tall: 0.2, dMin: 18, dMax: 30 });
  row(-900, SHORE_A - 18, -9, -1, 9, 26, MAT.brick, { street: true, tank: true });
  row(-900, SHORE_A - 18, -42, -1, 14, 40, [...MAT.brick, ...MAT.stone], { street: true, tall: 0.1 });
  // downtown spires down the avenue
  building(-760, -50, 22, 22, 150, MAT.tower, { spire: 40 });
  building(-700, 60, 26, 26, 210, MAT.tower, { spire: 60 });
  building(-980, -20, 30, 30, 120, MAT.tower);
  // Brooklyn
  seed = 23;
  row(SHORE_B + 14, 2000, 26, 1, 8, 22, MAT.brick, { street: true, canyon: true, tank: true });
  row(SHORE_B + 14, 2000, -9, -1, 8, 20, MAT.brick, { street: true, tank: true });
  row(SHORE_B + 14, 2000, -42, -1, 10, 28, [...MAT.brick, ...MAT.stone], { street: true });
  row(SHORE_B + 14, 2000, 60, 1, 10, 30, [...MAT.brick, ...MAT.stone], { street: true, canyon: true });
  plane(SHORE_B, 2200, 24, 26, 0.05, walk);
  // Midtown across the water
  seed = 31;
  for (let i = 0; i < 160; i++) {
    const x = rr(-300, 1800), z = rr(-1100, -290), w = rr(14, 34);
    const near = 1 - Math.min(1, Math.abs(x - 700) / 900);
    building(x, z, w, w * rr(0.7, 1.2), rr(30, 90) + near * rr(30, 160) * (rnd() < 0.4 ? 1 : 0.3), MAT.tower);
  }
  building(640, -720, 40, 40, 300, MAT.tower, { spire: 70 }); // the tall one
  building(420, -600, 30, 30, 240, MAT.tower, { spire: 55 });
  building(980, -800, 36, 36, 260, MAT.tower);
  // shore buildings on the river sides
  seed = 41;
  for (let i = 0; i < 40; i++) building(rr(-200, SHORE_A - 30), rr(150, 250), rr(14, 26), rr(14, 26), rr(18, 70), [...MAT.brick, ...MAT.tower]);
  for (let i = 0; i < 40; i++) building(rr(SHORE_B + 30, 1700), rr(150, 250), rr(14, 26), rr(14, 26), rr(14, 50), MAT.brick);

  // Street lamps and lit pools
  const poolTex = GLOW;
  const poolMat = new T.MeshBasicMaterial({ map: poolTex, color: lin('#ffb866').multiplyScalar(0.35), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const poles = [];
  function lamp(x, z, side) {
    poles.push([x, 3.6, z, 0.18, 7.2, 0.18], [x, 7.2, z + side * 0.9, 0.14, 0.14, 1.8]);
    glow('#ffc27a', 2.4, 2.6, x, 7.05, z + side * 1.7);
    glow('#ffb060', 0.2, 6, x, 6.6, z + side * 1.7);
    const p = new T.Mesh(new T.PlaneGeometry(14, 14), poolMat); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.08, z + side * 1.7); scene.add(p);
  }
  for (let x = -880; x < SHORE_A - 10; x += 32) { lamp(x, 23.5, -1); lamp(x + 16, 5, 1); }
  for (let x = SHORE_B + 20; x < 1900; x += 32) lamp(x, 23.5, -1);
  boxes(poles, '#202228', { metal: 0.6, rough: 0.5 });

  // Elevated structure
  const cols = [], beams = [], decks = [], girders = [], rails = [], ties = [];
  function el(x0, x1) {
    for (let x = x0; x <= x1; x += 12) { cols.push([x, DECK / 2 - 0.3, -3.1, 0.6, DECK - 0.6, 0.6], [x, DECK / 2 - 0.3, 3.1, 0.6, DECK - 0.6, 0.6]); beams.push([x, DECK - 0.75, 0, 0.6, 0.6, 7]); }
    decks.push([(x0 + x1) / 2, DECK - 0.3, 0, x1 - x0, 0.6, 7.4]);
    girders.push([(x0 + x1) / 2, DECK - 0.1, -3.7, x1 - x0, 1.3, 0.22], [(x0 + x1) / 2, DECK - 0.1, 3.7, x1 - x0, 1.3, 0.22]);
  }
  el(-900, SHORE_A); el(SHORE_B, 2000);
  rails.push([550, DECK + 0.17, -0.72, 2900, 0.14, 0.12], [550, DECK + 0.17, 0.72, 2900, 0.14, 0.12]);
  for (let x = -900; x < 2000; x += 0.75) ties.push([x, DECK + 0.05, 0, 0.24, 0.12, 2.5]);
  boxes(cols, '#2a302e', { metal: 0.5, rough: 0.6 });
  boxes(beams, '#2a302e', { metal: 0.5, rough: 0.6 });
  boxes(decks, '#1c1d21');
  boxes(girders, '#2c3431', { metal: 0.4, rough: 0.6 });
  boxes(ties, '#2a2420', { rough: 1 });
  boxes(rails, '#9aa0ac', { metal: 0.9, rough: 0.3 });

  // Stations
  function station(x0, x1, label, color) {
    const L = x1 - x0, cx = (x0 + x1) / 2;
    boxes([[cx, DECK + 0.05, -4.95, L, 1.0, 6.4]], '#3a3a3e', { rough: 0.95 });
    boxes([[cx, CAR_BOT - 0.02, -1.95, L, 0.05, 0.5]], '#e2b13a', { rough: 0.6, emissive: '#3a2a05' });
    boxes([[cx, 12.55, -5.0, L, 0.25, 6.8]], '#1d1f24');
    boxes([[cx, 12.38, -2.2, L, 0.12, 0.25], [cx, 12.38, -5.2, L, 0.12, 0.25]], '#fff1d0', { emissive: '#ffdca0', ei: 0.55 });
    const sup = [];
    for (let x = x0 + 4; x < x1; x += 10) sup.push([x, (CAR_BOT + 12.5) / 2, -7.9, 0.25, 12.5 - CAR_BOT, 0.25]);
    sup.push([cx, CAR_BOT + 0.55, -8.1, L, 0.08, 0.08], [cx, CAR_BOT + 1.0, -8.1, L, 0.08, 0.08]);
    boxes(sup, '#3c4a46', { metal: 0.5 });
    for (let x = x0 + 8; x < x1; x += 14) glow('#ffe2b0', 0.4, 5, x, 12.1, -3.6);
    const tex = canvasTex(1024, 200, (g) => {
      g.fillStyle = color; g.fillRect(0, 0, 1024, 200);
      g.fillStyle = '#0c1424'; g.fillRect(8, 8, 1008, 184);
      g.fillStyle = color; g.beginPath(); g.arc(100, 100, 62, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#fff'; g.font = '800 82px Archivo, Helvetica, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label[0], 100, 106); g.textAlign = 'left'; g.font = '800 104px Archivo, Helvetica, Arial'; g.fillText(label, 192, 108);
    });
    const signs = [];
    for (let x = x1 - 10; x > x0 + 8; x -= 36) {
      const m = new T.Mesh(new T.PlaneGeometry(6.4, 1.25), new T.MeshBasicMaterial({ map: tex, color: new T.Color(0.95, 0.95, 0.95) }));
      m.position.set(x, 11.2, -2.45); m.rotation.y = Math.PI; scene.add(m); signs.push(m);
      const m2 = new T.Mesh(m.geometry, m.material); m2.position.set(x, 11.2, -2.38); scene.add(m2);
      boxes([[x - 2.6, 12.0, -2.45, 0.06, 1.1, 0.06], [x + 2.6, 12.0, -2.45, 0.06, 1.1, 0.06]], '#222');
    }
    return { signs, tex };
  }
  W.stationA = station(STATION_A[0], STATION_A[1], 'Projects', '#44a9e8');
  W.stationB = station(STATION_B[0], STATION_B[1], 'Last stop', '#f2b233');
  W.stationC = station(STATION_C[0], STATION_C[1], 'Education', '#a385ea');
  W.STATION_A = STATION_A; W.STATION_B = STATION_B; W.STATION_C = STATION_C;

  // Bridge
  {
    const steel = '#2d3442', b = [], deck = [], lacing = [];
    const x0 = SHORE_A - 20, x1 = SHORE_B + 20, cx = (x0 + x1) / 2, L = x1 - x0;
    deck.push([cx, DECK - 0.7, 0, L, 1.4, 31]);
    deck.push([cx, DECK + 0.02, -9, L, 0.04, 9], [cx, DECK + 0.02, 9, L, 0.04, 9]);
    boxes(deck, '#1d1f25');
    // stiffening trusses beside the track
    for (const z of [-4.4, 4.4, -14.6, 14.6]) {
      const top = z === -4.4 || z === 4.4 ? 10.6 : 9.4;
      b.push([cx, DECK - 1.2, z, L, 0.5, 0.4], [cx, top, z, L, 0.45, 0.4]);
      for (let x = x0; x <= x1; x += 6) {
        b.push([x, (DECK - 1.2 + top) / 2, z, 0.3, top - DECK + 1.2, 0.3]);
        const h = top - DECK + 1.2, ang = Math.atan2(h, 6);
        b.push([x + 3, (DECK - 1.2 + top) / 2, z, Math.hypot(6, h), 0.22, 0.22, 0, 0, (x / 6) % 2 ? ang : -ang]);
      }
    }
    // towers
    W.towerX = [600, 810];
    const TOP = 64;
    for (const tx of W.towerX) {
      for (const z of [-13.5, 13.5]) for (const dx of [-1.6, 1.6]) b.push([tx + dx, (TOP - 6) / 2, z, 1.1, TOP + 6, 1.4]);
      for (const z of [-13.5, 13.5]) for (let y = -4; y < TOP; y += 4) {
        const ang = Math.atan2(4, 3.2);
        lacing.push([tx, y + 2, z, Math.hypot(3.2, 4), 0.25, 0.25, 0, 0, (y / 4) % 2 ? ang : -ang]);
      }
      for (const y of [DECK + 6, 30, 46, TOP - 2]) b.push([tx, y, 0, 3.4, 1.6, 28.6]);
      for (let y = DECK + 15; y < TOP - 4; y += 8) {
        const ang = Math.atan2(8, 27);
        b.push([tx, y + 4, 0, 0.5, 0.5, Math.hypot(27, 8), ang, 0, 0], [tx, y + 4, 0, 0.5, 0.5, Math.hypot(27, 8), -ang, 0, 0]);
      }
      b.push([tx, TOP + 1.5, 0, 4.6, 2.2, 30]);
      for (const z of [-13.5, 13.5]) { W.towerLights = W.towerLights || []; W.towerLights.push(glow('#ff3a2a', 3, 5, tx, TOP + 3.2, z)); }
    }
    boxes(b, steel, { metal: 0.55, rough: 0.55 });
    boxes(lacing, '#262c38', { metal: 0.5, rough: 0.6 });
    // cables and suspenders
    const cableMat = new T.MeshStandardMaterial({ color: lin('#5a6274'), metalness: 0.6, roughness: 0.4 });
    const [ta, tb] = W.towerX, susp = [];
    const yMain = (x) => { const m = (ta + tb) / 2, half = (tb - ta) / 2; return 15 + (TOP - 15) * Math.pow((x - m) / half, 2); };
    const ySide = (x, xa, xt) => { const t = (x - xa) / (xt - xa); return DECK + 1 + (TOP - DECK - 1) * Math.pow(t, 1.6); };
    for (const z of [-12.2, 12.2]) {
      const pts = [];
      for (let x = x0; x <= ta; x += 6) pts.push(new T.Vector3(x, ySide(x, x0, ta), z));
      for (let x = ta; x <= tb; x += 6) pts.push(new T.Vector3(x, yMain(x), z));
      for (let x = tb; x <= x1; x += 6) pts.push(new T.Vector3(x, ySide(x, x1, tb), z));
      const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 260, 0.42, 6), cableMat); scene.add(tube);
      for (let x = x0 + 3; x < x1; x += 5) {
        const y = x < ta ? ySide(x, x0, ta) : x > tb ? ySide(x, x1, tb) : yMain(x);
        if (y - DECK > 1.5) susp.push([x, (y + DECK) / 2, z, 0.07, y - DECK, 0.07]);
      }
    }
    boxes(susp, '#6a7286', { metal: 0.6, rough: 0.4 });
    for (let x = x0; x <= x1; x += 18) { glow('#ffcf8a', 1.8, 2.4, x, DECK + 4.5, -15.6); glow('#ffcf8a', 1.8, 2.4, x, DECK + 4.5, 15.6); }
    // piers
    boxes([[ta, -1, 0, 10, 10, 34], [tb, -1, 0, 10, 10, 34]], '#3b3632', { rough: 1 });
  }

  // Traffic: luxury sedans, coupes and SUVs with clear-coat paint (reflections come from an env map set in main.js)
  const traffic = (W.traffic = []);
  {
    const merge = (list) => T.BufferGeometryUtils.mergeBufferGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    function extrude(pts, depth, bevel = 0.07) {
      const sh = new T.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); else sh.lineTo(p[0], p[1]); } sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 });
      g.translate(0, 0, -(depth - 2 * bevel) / 2); g.deleteAttribute('uv'); return g;
    }
    const boxG = (w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); g.deleteAttribute('uv'); return g; };
    const cylG = (r, w, x, y, z, seg = 20) => { const g = new T.CylinderGeometry(r, r, w, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); g.deleteAttribute('uv'); return g; };
    const TYPES = {
      sedan: { L: 5.1, W: 1.95, r: 0.36, wx: 1.55, belt: 0.98,
        low: [[-2.55, 0.32], [2.45, 0.32], [2.68, 0.34, 2.63, 0.58], [2.6, 0.8, 2.3, 0.85], [1.7, 0.94, 1.2, 0.98], [-1.9, 1.0], [-2.48, 1.0, -2.6, 0.84], [-2.7, 0.5, -2.55, 0.32]],
        cab: [[1.22, 0.97], [0.75, 1.2, 0.3, 1.41], [-0.38, 1.5, -1.0, 1.42], [-1.6, 1.3, -1.95, 0.99]],
        roof: [[0.32, 1.39], [-0.38, 1.47, -0.98, 1.4], [-0.98, 1.46], [-0.38, 1.53, 0.28, 1.45]], ly: 0.74, ty: 0.86 },
      coupe: { L: 4.7, W: 1.95, r: 0.37, wx: 1.45, belt: 0.88,
        low: [[-2.35, 0.3], [2.25, 0.3], [2.48, 0.32, 2.42, 0.52], [2.38, 0.72, 2.05, 0.77], [1.4, 0.85, 0.85, 0.88], [-1.65, 0.93], [-2.3, 0.93, -2.42, 0.72], [-2.5, 0.42, -2.35, 0.3]],
        cab: [[0.88, 0.87], [0.4, 1.05, -0.05, 1.26], [-0.6, 1.33, -1.0, 1.25], [-1.5, 1.08, -1.75, 0.92]],
        roof: [[-0.02, 1.24], [-0.6, 1.3, -0.98, 1.23], [-0.98, 1.29], [-0.6, 1.36, -0.05, 1.3]], ly: 0.64, ty: 0.8 },
      suv: { L: 5.0, W: 2.0, r: 0.43, wx: 1.6, belt: 1.18,
        low: [[-2.5, 0.42], [2.4, 0.42], [2.6, 0.45, 2.56, 0.72], [2.54, 1.0, 2.25, 1.1], [1.7, 1.15, 1.3, 1.18], [-2.35, 1.2], [-2.55, 1.18, -2.56, 0.95], [-2.6, 0.55, -2.5, 0.42]],
        cab: [[1.28, 1.17], [0.95, 1.5, 0.62, 1.76], [-0.8, 1.84, -2.15, 1.78], [-2.35, 1.5, -2.38, 1.2]],
        roof: [[0.65, 1.74], [-0.8, 1.82, -2.15, 1.76], [-2.15, 1.83], [-0.8, 1.89, 0.6, 1.81]], ly: 0.96, ty: 1.06 },
    };
    const GEO = {};
    for (const [k, t] of Object.entries(TYPES)) {
      const hw = t.W / 2, wheels = [[t.wx, 1], [t.wx, -1], [-t.wx, 1], [-t.wx, -1]];
      GEO[k] = {
        paint: merge([extrude(t.low, t.W, 0.09), extrude(t.roof, t.W - 0.36, 0.03)]),
        glass: extrude(t.cab, t.W - 0.3, 0.05),
        tire: merge(wheels.map(([x, s]) => cylG(t.r, 0.26, x, t.r, s * (hw - 0.14)))),
        rim: merge(wheels.map(([x, s]) => cylG(t.r * 0.6, 0.04, x, t.r, s * (hw - 0.0), 16))),
        hub: merge(wheels.map(([x, s]) => cylG(t.r * 0.2, 0.05, x, t.r, s * (hw + 0.01), 10))),
        chrome: merge([boxG(t.L * 0.62, 0.03, 0.02, -0.2, t.belt - 0.02, hw + 0.02), boxG(t.L * 0.62, 0.03, 0.02, -0.2, t.belt - 0.02, -hw - 0.02)]),
        clad: merge([boxG(t.wx * 2 - t.r * 2.4, 0.16, 0.03, 0, t.r * 0.95, hw + 0.03), boxG(t.wx * 2 - t.r * 2.4, 0.16, 0.03, 0, t.r * 0.95, -hw - 0.03), boxG(0.06, 0.18, t.W - 0.4, t.L / 2 + 0.02, 0.45, 0)]),
        led: merge([boxG(0.05, 0.06, 0.5, t.L / 2 + 0.03, t.ly, 0.58), boxG(0.05, 0.06, 0.5, t.L / 2 + 0.03, t.ly, -0.58)]),
        tail: boxG(0.05, 0.07, t.W - 0.25, -t.L / 2 - 0.05, t.ty, 0),
        t,
      };
    }
    const phys = (c, o = {}) => new T.MeshPhysicalMaterial({ color: lin(c), metalness: o.m ?? 0.65, roughness: o.r ?? 0.3, clearcoat: o.cc ?? 1, clearcoatRoughness: 0.06, envMapIntensity: o.ei ?? 1.1 });
    const paints = ['#07080b', '#07080b', '#0b1630', '#eceae4', '#3a0a12', '#0c2418', '#16181c', '#7d8187', '#1d2b40'].map((c) => phys(c, { m: 0.55, r: 0.22 }));
    const glass = phys('#010203', { m: 0.0, r: 0.03, ei: 0.55 });
    const tire = new T.MeshStandardMaterial({ color: lin('#0d0d0f'), roughness: 0.9 });
    const rim = phys('#8d939c', { m: 1, r: 0.3, cc: 0, ei: 0.9 });
    const led = new T.MeshBasicMaterial({ color: new T.Color(2.2, 2.2, 2.4) });
    const tail = new T.MeshBasicMaterial({ color: new T.Color(1.8, 0.08, 0.05) });
    W.envTargets = [...paints, glass, rim];
    function car(x0, x1, z, y, dir, speed) {
      const kind = pick(['sedan', 'sedan', 'coupe', 'suv', 'suv']), G = GEO[kind], g = new T.Group();
      for (const [geo, mat] of [[G.paint, pick(paints)], [G.glass, glass], [G.tire, tire], [G.rim, rim], [G.chrome, rim], [G.clad, tire], [G.hub, tire], [G.led, led], [G.tail, tail]]) g.add(new T.Mesh(geo, mat));
      const L = G.t.L / 2;
      glow('#f4f6ff', 1.8, 0.9, L + 0.1, G.t.ly, 0.6, g); glow('#f4f6ff', 1.8, 0.9, L + 0.1, G.t.ly, -0.6, g); glow('#e8eeff', 0.2, 4.5, L + 2.4, 0.5, 0, g);
      glow('#ff2a1a', 1.3, 0.9, -L - 0.1, G.t.ty, 0.6, g); glow('#ff2a1a', 1.3, 0.9, -L - 0.1, G.t.ty, -0.6, g);
      g.rotation.y = dir > 0 ? 0 : Math.PI; g.position.set(rr(x0, x1), y, z); scene.add(g);
      traffic.push({ g, x0, x1, dir, speed, off: rr(0, x1 - x0) });
    }
    seed = 51;
    for (let i = 0; i < 24; i++) { const lane = pick([[9, -1], [12, -1], [16.5, 1], [19.5, 1]]); car(-700, SHORE_A - 20, lane[0], 0.02, lane[1], rr(8, 14)); }
    for (let i = 0; i < 12; i++) { const lane = pick([[-7.5, 1], [-10.5, 1], [7.5, -1], [10.5, -1]]); car(SHORE_A - 20, SHORE_B + 20, lane[0], DECK + 0.05, lane[1], rr(10, 16)); }
    for (let i = 0; i < 10; i++) { const lane = pick([[12, -1], [17, 1]]); car(SHORE_B + 20, 1800, lane[0], 0.02, lane[1], rr(7, 12)); }
  }

  // Golden hour: a warm sky dome over the night one, a low sun at the end of the avenue
  {
    const SUN_DIR = new T.Vector3(-1, 0.05, 0.022).normalize();
    const g = new T.SphereGeometry(2790, 64, 64), p = g.attributes.position, cols = [], v = new T.Vector3();
    const stops = [[-1.01, '#b07a55'], [-0.02, '#e8a878'], [0.02, '#ffd09a'], [0.1, '#f6bf92'], [0.28, '#a9b6d2'], [0.6, '#6d8fc6'], [1.01, '#4a72b2']];
    const glowC = lin('#fff1cc'), warm = lin('#ff9c58');
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize(); const y = v.y; let c = lin(stops[0][1]);
      for (let k = 0; k < stops.length - 1; k++) if (y >= stops[k][0] && y <= stops[k + 1][0]) { const t = (y - stops[k][0]) / (stops[k + 1][0] - stops[k][0]); c = lin(stops[k][1]).lerp(lin(stops[k + 1][1]), t); }
      const a = Math.max(0, v.dot(SUN_DIR));
      c.lerp(warm, Math.pow(a, 3) * 0.55 * (1 - Math.min(1, Math.abs(y) * 2)));
      c.lerp(glowC, Math.pow(a, 24) * 0.9);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    const skyDay = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false, transparent: true, opacity: 1 }));
    skyDay.renderOrder = -1; scene.add(skyDay); W.skyDay = skyDay;
    const sunTex = canvasTex(256, 256, (c) => {
      const r = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,250,232,1)'); r.addColorStop(0.16, 'rgba(255,236,190,1)'); r.addColorStop(0.2, 'rgba(255,190,120,.55)'); r.addColorStop(0.45, 'rgba(255,150,80,.16)'); r.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = r; c.fillRect(0, 0, 256, 256);
    });
    const sun = new T.Sprite(new T.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending, color: new T.Color(1.4, 1.3, 1.2) }));
    sun.scale.set(420, 420, 1); sun.userData.dir = SUN_DIR.clone().multiplyScalar(2600); scene.add(sun); W.sun = sun;
  }
  const FOG_N = FOG.clone(), FOG_D = lin('#d59a72');
  const HEMI = { n: [lin('#6c6aa8'), lin('#2a1d16'), 0.55], d: [lin('#ffe2c0'), lin('#6e4a34'), 1.05] };
  const facades = [...MAT.brick, ...MAT.stone, ...MAT.tower];
  const L = (a, b, t) => a + (b - a) * t;
  // Sun glitter: a shimmering path on the water from under the sun toward the viewer
  const glitTex = canvasTex(1024, 128, (c) => {
    c.clearRect(0, 0, 1024, 128);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 1024, g = (rnd() + rnd() + rnd() - 1.5) / 1.5, y = 64 + g * 60 * (0.35 + 0.65 * x / 1024);
      const a = Math.max(0, 1 - Math.abs(g)) * rr(0.25, 1);
      c.fillStyle = `rgba(255,${Math.round(rr(200, 240))},${Math.round(rr(140, 200))},${a.toFixed(2)})`;
      c.fillRect(x, y, rr(2, 9), rr(1, 2.2));
    }
  });
  glitTex.wrapS = T.RepeatWrapping;
  const glitG = new T.PlaneGeometry(1500, 70); glitG.rotateX(-Math.PI / 2);
  const glit = new T.Mesh(glitG, new T.MeshBasicMaterial({ map: glitTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, color: new T.Color(1.15, 0.95, 0.75) }));
  const glitHolder = new T.Group(); glitHolder.add(glit); glit.position.x = 800; scene.add(glitHolder);
  const WATER_N = lin('#0b1222'), WATER_D = lin('#3b5670');
  const sunDir = new T.Vector3(), BASE_DIR = new T.Vector3(-1, 0.05, 0.022).normalize();

  W.setDay = (d, camPos, theta = 0, time = 0) => {
    sunDir.copy(BASE_DIR).applyAxisAngle(new T.Vector3(0, 1, 0), theta);
    W.skyDay.rotation.y = theta;
    W.sun.userData.dir.copy(sunDir).multiplyScalar(2600);
    sunLight.position.copy(sunDir).multiplyScalar(500);
    W.water.material.color.copy(WATER_N).lerp(WATER_D, d);
    glitHolder.visible = d > 0.02;
    if (glitHolder.visible) {
      glitHolder.position.set(camPos.x, -5.85, camPos.z);
      glitHolder.rotation.y = Math.atan2(-sunDir.z, sunDir.x);
      glit.material.opacity = d * 0.95;
      glitTex.offset.x = (time * 0.012) % 1;
    }
    const n = 1 - d;
    scene.fog.color.copy(FOG_N).lerp(FOG_D, d); scene.fog.density = L(0.0021, 0.0013, d);
    W.skyDay.material.opacity = d; W.skyDay.visible = d > 0.002; W.skyDay.position.copy(camPos);
    W.sun.material.opacity = d; W.sun.visible = d > 0.002; W.sun.position.copy(camPos).add(W.sun.userData.dir);
    W.stars.material.opacity = 0.7 * n * n; W.moon.material.opacity = n;
    hemi.color.copy(HEMI.n[0]).lerp(HEMI.d[0], d); hemi.groundColor.copy(HEMI.n[1]).lerp(HEMI.d[1], d); hemi.intensity = L(0.55, 1.05, d);
    sunLight.intensity = 2.4 * d; moonLight.intensity = 0.35 * n;
    for (const m of facades) m.emissiveIntensity = L(1.05, 0.12, d);
    for (const k in glowMats) glowMats[k].color.copy(glowMats[k].userData.base).multiplyScalar(L(1, 0.22, d));
  };


  const darkCap = new T.MeshStandardMaterial({ color: lin('#1b1b1f'), roughness: 0.8 });

  // Street steam: orange-and-white striped stacks with billowing steam
  const steamStacks = (W.steam = []);
  {
    const stripe = canvasTex(64, 256, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#e8641c'; g.fillRect(0, i * 32, 64, 32); } });
    const stackMat = new T.MeshStandardMaterial({ map: stripe, roughness: 0.6, emissive: lin('#3a1a08'), emissiveIntensity: 0.4 });
    const puff = canvasTex(128, 128, (g) => {
      for (let i = 0; i < 26; i++) {
        const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = rr(18, 40);
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      }
    }, false);
    for (const [x, z] of [[104, 12.5], [58, 15.5], [-20, 11.5], [210, 16], [1040, 14], [1300, 12.5], [1330, 16]]) {
      const st = new T.Mesh(new T.CylinderGeometry(0.42, 0.48, 2.6, 16, 1, true), stackMat); st.position.set(x, 1.3, z); scene.add(st);
      const cap = new T.Mesh(new T.CylinderGeometry(0.44, 0.44, 0.08, 16), darkCap); cap.position.set(x, 2.62, z); scene.add(cap);
      const parts = [];
      for (let i = 0; i < 22; i++) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: puff, color: lin('#d9dce3'), transparent: true, depthWrite: false, opacity: 0 }));
        sp.material.rotation = rnd() * 6.28; scene.add(sp); parts.push({ sp, off: i / 22, spin: rr(-0.4, 0.4) });
      }
      steamStacks.push({ x, z, parts });
    }
  }
  W.updateSteam = (t, day) => {
    const tint = 0.55 + 0.45 * day;
    for (const s of steamStacks) for (const p of s.parts) {
      const a = (t * 0.16 + p.off) % 1;
      p.sp.position.set(s.x + a * a * 6 + Math.sin(t * 0.7 + p.off * 9) * 0.6, 2.7 + a * 15, s.z + Math.sin(t * 0.5 + p.off * 5) * 0.8);
      const sc = 1.6 + a * 9; p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = Math.sin(Math.min(1, a * 1.25) * Math.PI) * 0.55;
      p.sp.material.rotation += p.spin * 0.005;
      p.sp.material.color.setScalar(tint * 0.85);
    }
  };

  // Boats on the river: a ferry, tugs, barges and sailboats
  const ships = (W.ships = []);
  {
    seed = 77;
    const M = (c, o = {}) => new T.MeshStandardMaterial({ color: lin(c), roughness: o.r ?? 0.6, metalness: o.m ?? 0.2, emissive: o.e ? lin(o.e) : 0x000000, emissiveIntensity: o.ei ?? 1 });
    const box = (g, w, h, d, x, y, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
    const wakeMat = new T.MeshBasicMaterial({ map: GLOW, color: new T.Color(0.55, 0.6, 0.65), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
    function hull(g, L, W2, H, color) {
      box(g, L, H, W2, 0, H / 2, 0, M(color));
      const bow = new T.Mesh(new T.CylinderGeometry(W2 / 2, W2 / 2, H, 3, 1), M(color)); bow.rotation.y = Math.PI / 2; bow.scale.set(1, 1, 1.4); bow.position.set(L / 2 + W2 * 0.3, H / 2, 0); g.add(bow);
      const w = new T.Mesh(new T.PlaneGeometry(L * 1.6, W2 * 2.2), wakeMat); w.rotation.x = -Math.PI / 2; w.position.set(-L * 0.75, 0.15, 0); g.add(w);
    }
    const kinds = {
      ferry(g) {
        hull(g, 34, 9, 3, '#e8792b');
        box(g, 26, 3, 8, -1, 4.5, 0, M('#f2efe6'));
        box(g, 26.2, 0.8, 8.2, -1, 4.3, 0, M('#fff3d6', { e: '#ffd79a', ei: 1.2 }));
        box(g, 14, 2.4, 6.6, -2, 7.2, 0, M('#f2efe6'));
        box(g, 14.2, 0.6, 6.8, -2, 7.2, 0, M('#fff3d6', { e: '#ffd79a', ei: 1.2 }));
        glow('#fff1d0', 1.2, 2, 18, 9, 0, g); glow('#ff3020', 1.2, 1.4, -17, 8, 0, g);
      },
      tug(g) {
        hull(g, 12, 5, 2.4, '#8a1f1a');
        box(g, 4.5, 3, 3.6, 0.5, 3.9, 0, M('#efe9dc'));
        box(g, 4.6, 0.6, 3.7, 0.5, 4.4, 0, M('#fff3d6', { e: '#ffd79a', ei: 1.1 }));
        box(g, 1, 3, 1, -1.5, 6.5, 0, M('#1b1b1f'));
        glow('#fff1d0', 1.3, 1.6, 6.5, 6, 0, g);
      },
      barge(g) {
        hull(g, 44, 12, 2.2, '#3b2a22');
        const cols = ['#b5402f', '#2f6aa3', '#d39a2a', '#3d7a4d', '#7a7f88'];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) box(g, 6, 2.6, 2.4, -16 + i * 6.4, 3.5, -2.6 + j * 5.2, M(pick(cols), { r: 0.8 }));
        glow('#ff3020', 1.2, 1.4, -22, 4, 0, g); glow('#30ff60', 1.2, 1.4, 22, 4, 0, g);
      },
      sail(g) {
        hull(g, 8, 2.6, 1, '#f4f2ec');
        box(g, 0.18, 11, 0.18, 0.5, 6.5, 0, M('#cfcfcf', { m: 0.6 }));
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 10); sh.lineTo(4.6, 0.4); sh.closePath();
        const sail = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color: lin('#fbf6ea'), side: T.DoubleSide, roughness: 0.9, emissive: lin('#3a2a18'), emissiveIntensity: 0.4 }));
        sail.position.set(0.6, 1.5, 0); sail.rotation.y = -Math.PI / 2 + 0.25; g.add(sail);
        glow('#fff1d0', 0.9, 1.2, 0.5, 12.2, 0, g);
      },
    };
    // Main river runs along z between the shores; the bend runs along x
    const plan = [
      ['ferry', 640, -120, 230, 1, 6], ['barge', 560, -110, 240, -1, 3.5], ['tug', 590, -100, 240, -1, 4.2],
      ['sail', 700, -120, 220, 1, 5], ['sail', 760, -110, 230, -1, 4], ['tug', 845, -120, 230, 1, 5], ['barge', 880, -120, 240, 1, 3],
      ['sail', 660, -100, 200, -1, 4.6],
    ];
    for (const [k, x, z0, z1, dir, sp] of plan) {
      const g = new T.Group(); kinds[k](g); g.position.set(x, -6, 0); g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(g);
      ships.push({ g, axis: 'z', a: z0, b: z1, dir, sp, off: rr(0, z1 - z0) });
    }
    for (const [k, z, dir, sp] of [['ferry', -200, -1, 6], ['barge', -225, 1, 3], ['sail', -180, 1, 5], ['tug', -240, -1, 4.5]]) {
      const g = new T.Group(); kinds[k](g); g.position.set(0, -6, z); g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g);
      ships.push({ g, axis: 'x', a: -400, b: 1800, dir, sp, off: rr(0, 2200) });
    }
  }
  W.updateShips = (t) => {
    for (const s of ships) {
      const L = s.b - s.a, u = (((s.off + s.dir * s.sp * t) % L) + L) % L, v = s.a + u;
      if (s.axis === 'z') s.g.position.z = v; else s.g.position.x = v;
      s.g.position.y = -6 + Math.sin(t * 1.3 + s.off) * 0.08;
    }
  };

  W.updateTraffic = (t) => {
    for (const c of traffic) { const L = c.x1 - c.x0; const u = (((c.off + c.dir * c.speed * t) % L) + L) % L; c.g.position.x = c.x0 + u; }
  };
})();
