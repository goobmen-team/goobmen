// ======================================================================= the minimap
// Top right, square, in a plain frame, turning with your view so straight ahead is always up. The island is painted
// once in flat colours with hard edges: grass in three tones, sand, rock and a little snow with the relief shaded in
// three steps, two tones of water with a pale line on the coast, a flat disc for every tree, rocks, houses and bridges.
// A grid and the four directions go over it, then your planted C4 and you. Enemies and chests are not shown.
const MINI = { size: 180, range: 85 };                          // pixels across, metres from the middle to the edge
let miniLand = null;                                            // { img, half, px } for the island, made the first time it's needed
function miniIsland() {
  if (miniLand) return miniLand;
  const half = Math.min(GRID.half, 520), n = 1560, px = n / (2 * half), img = document.createElement('canvas');
  img.width = img.height = n;
  const g = img.getContext('2d'), data = g.createImageData(n, n), d = data.data;
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = groundAt((i + 0.5) / px - half, (j + 0.5) / px - half);
  // soft patchy noise (value noise at three scales), so the grass is not one flat colour
  const G = 64, cells = new Float32Array(G * G); let seed = 11;
  for (let i = 0; i < cells.length; i++) { seed = (seed * 16807) % 2147483647; cells[i] = seed / 2147483647; }
  const val = (x, z) => { const fx = Math.floor(x), fz = Math.floor(z), u = x - fx, v = z - fz, s = t => t * t * (3 - 2 * t), at = (a, b) => cells[((b % G + G) % G) * G + ((a % G + G) % G)];
    return at(fx, fz) * (1 - s(u)) * (1 - s(v)) + at(fx + 1, fz) * s(u) * (1 - s(v)) + at(fx, fz + 1) * (1 - s(u)) * s(v) + at(fx + 1, fz + 1) * s(u) * s(v); };
  const patch = (x, z) => val(x / 70, z / 70) * 0.55 + val(x / 26, z / 26 + 9) * 0.3 + val(x / 9, z / 9 + 31) * 0.15;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const SAND = [208, 192, 142], GRASS = [[112, 152, 68], [96, 138, 60], [82, 122, 54]], DIRT = [142, 120, 84], ROCK = [[132, 128, 118], [108, 104, 96]], SNOW = [204, 208, 214];
  const wetAt = (i, j) => H[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] < SEA.level;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 4, h = H[j * n + i], x = (i + 0.5) / px - half, z = (j + 0.5) / px - half;
    const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)], hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
    const slope = Math.hypot(hx, hz) * px / 2;                       // rise over run
    let c;
    if (h < SEA.level) {                                             // water: two flat tones, and a thin pale line where it meets the land
      c = SEA.level - h > 1.6 ? [44, 98, 142] : [76, 148, 170];
      if (!wetAt(i + 1, j) || !wetAt(i - 1, j) || !wetAt(i, j + 1) || !wetAt(i, j - 1)) c = [222, 232, 226];
    } else {
      const above = h - SEA.level, pt = patch(x, z);
      if (above < 1.0) c = SAND;
      else {
        c = GRASS[pt < 0.4 ? 2 : pt < 0.6 ? 1 : 0];                                          // grass in three flat tones, patch by patch
        if (slope > 0.55) c = DIRT;                                                           // bare earth on the steep bits
        if (h > 11 || slope > 1.0) c = ROCK[slope > 1.0 ? 1 : 0];                             // rock up the hill
        if (h > 31) c = SNOW;                                                                 // and a little snow on the very top
      }
      const sh = 1 - (hx + hz) * 0.5 * px;                          // light from the top left, in three steps
      const f = sh < 0.9 ? 0.8 : sh > 1.08 ? 1.12 : 1;
      c = c.map(v => v * f);
    }
    d[k] = clamp(c[0], 0, 255); d[k + 1] = clamp(c[1], 0, 255); d[k + 2] = clamp(c[2], 0, 255); d[k + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  // what stands on the island
  const at = (x, z) => [(x + half) * px, (z + half) * px];
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };   // a tree top: one flat disc
  for (const l of leaves) { const [x, y] = at(l[0], l[2]); dot(x, y, Math.max(2, l[3] * 1.05 * px), 'rgb(40,86,40)'); }
  for (const o of solids) if (!o.hull && o.h > 1.5 && o.h / o.r < 10) { const [x, y] = at(o.x, o.z); dot(x, y, Math.max(1.6, o.r / 0.24 * 0.95 * px), 'rgb(66,116,48)'); }   // palms: lighter
  const poly = (hull, fill, line, w, lit) => {
    g.beginPath(); hull.forEach((q, i) => { const [x, y] = at(q[0], q[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.lineWidth = w; g.lineJoin = 'round'; g.stroke();
  };
  for (const o of solids) {
    if (!o.hull || (o.h === HOUSE_TALL && o.tris && o.tris.length === 2)) continue;   // house walls: drawn as whole houses below
    if (o.thin) poly(o.hull, 'rgb(150,108,62)', 'rgb(60,40,20)', 1);                   // bridges: planks
    else if (o.wall) poly(o.hull, 'rgb(112,104,96)', 'rgb(44,40,36)', 1.1);              // cave walls
    else poly(o.hull, 'rgb(150,146,138)', 'rgb(60,56,50)', 1);                         // rocks
  }
  for (const q of HOUSES) {                                                              // houses: a roof with a ridge line
    const corners = [[-3.8, -3.2], [3.8, -3.2], [3.8, 3.2], [-3.8, 3.2]].map(([a, b]) => houseWorld(q, a, b));
    poly(corners, 'rgb(166,84,54)', 'rgb(60,26,16)', 1.6);
    const a = at(...houseWorld(q, -3.8, 0).filter((_, i) => true).slice(0, 2)), b = at(...houseWorld(q, 3.8, 0).slice(0, 2));
    g.strokeStyle = 'rgb(112,50,32)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  return (miniLand = { img, half, px });
}
function drawMinimap() {
  const cv = ui.minimap; if (!cv) return;
  buildMapFrame();
  const g = cv.getContext('2d'), S = MINI.size, r = S / 2, scale = r / MINI.range;
  const me = player.pos, yaw = cam.yaw + Math.PI;                // the way the camera looks
  const theta = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));   // turns the world so that way is up
  const toMap = p => { const dx = p[0] - me[0], dz = p[2] - me[2], c = Math.cos(theta), s = Math.sin(theta); return [r + (dx * c - dz * s) * scale, r + (dx * s + dz * c) * scale]; };
  g.clearRect(0, 0, S, S);
  g.save();
  g.translate(r, r); g.rotate(theta);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (world.map === 'island') {
    const L = miniIsland(), k = scale / L.px;
    g.fillStyle = 'rgb(24,74,132)'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.drawImage(L.img, (-me[0] - L.half) * scale, (-me[2] - L.half) * scale, L.img.width * k, L.img.height * k);
  } else {                                                      // the training plate: a stone slab on grass
    g.fillStyle = 'rgb(82,132,58)'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.fillStyle = 'rgb(156,152,144)'; g.strokeStyle = 'rgb(70,66,60)'; g.lineWidth = 1.5;
    g.fillRect((-HALF - me[0]) * scale, (-HALF - me[2]) * scale, 2 * HALF * scale, 2 * HALF * scale);
    g.strokeRect((-HALF - me[0]) * scale, (-HALF - me[2]) * scale, 2 * HALF * scale, 2 * HALF * scale);
  }
  g.restore();
  // the grid: a line every 50 m of the world, a heavier one every 200 m; it turns with the map
  g.save(); g.beginPath(); g.rect(0, 0, S, S); g.clip(); g.translate(r, r); g.rotate(theta);
  const step = 50, lo = -MINI.range * 1.6;
  for (let gx = Math.ceil((me[0] + lo) / step) * step; gx < me[0] - lo; gx += step) { g.strokeStyle = gx % 200 === 0 ? 'rgba(15,12,8,.6)' : 'rgba(15,12,8,.38)'; g.lineWidth = gx % 200 === 0 ? 1.4 : 1; g.beginPath(); g.moveTo((gx - me[0]) * scale, lo * scale); g.lineTo((gx - me[0]) * scale, -lo * scale); g.stroke(); }
  for (let gz = Math.ceil((me[2] + lo) / step) * step; gz < me[2] - lo; gz += step) { g.strokeStyle = gz % 200 === 0 ? 'rgba(15,12,8,.6)' : 'rgba(15,12,8,.38)'; g.lineWidth = gz % 200 === 0 ? 1.4 : 1; g.beginPath(); g.moveTo(lo * scale, (gz - me[2]) * scale); g.lineTo(-lo * scale, (gz - me[2]) * scale); g.stroke(); }
  g.restore();
  if (world.map === 'island') {                                 // your stashes and your crew; a stash being robbed flashes
    const mark = (p, col, size, round) => { let [x, y] = toMap(p); x = clamp(x, 6, S - 6); y = clamp(y, 6, S - 6); g.fillStyle = col; g.strokeStyle = '#1b130a'; g.lineWidth = 1.6; g.beginPath(); if (round) g.arc(x, y, size, 0, Math.PI * 2); else g.rect(x - size, y - size, size * 2, size * 2); g.fill(); g.stroke(); };
    for (const b of raid.builds) if (b.kind === 'stash' && b.owner === player) mark([b.x, 0, b.z], '#ffd23f', 4);
    for (const q of bots) if (q.br && q.br.crew && q.dead < 0) mark(q.pos, '#46d65a', 3, true);
    if (raid.alarm && Math.sin(game.time * 12) > -0.2) mark([raid.alarm.x, 0, raid.alarm.z], '#ff3b30', 6.5, true);
  }
  for (const b of planted) {                                    // your armed C4, blinking
    if (!b.armed || Math.sin(game.time * 14) < 0) continue;
    const [x, y] = toMap(b.p); if (x < 4 || y < 4 || x > S - 4 || y > S - 4) continue;
    g.fillStyle = 'rgb(220,40,28)'; g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // the four directions, on the edge of the map, swinging round as you turn (north is -z, east is +x)
  for (const [name, dx, dz] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
    const [ex, ey] = toMap([me[0] + dx * 1000, 0, me[2] + dz * 1000]), vx = ex - r, vy = ey - r, m = Math.max(Math.abs(vx), Math.abs(vy)), lim = r - 10;
    const lx = r + vx / m * lim, ly = r + vy / m * lim;
    g.fillStyle = name === 'N' ? 'rgb(170,40,30)' : 'rgb(30,26,22)'; g.fillRect(lx - 8, ly - 8, 16, 16);
    g.fillStyle = '#f0e8d0'; g.font = "bold 12px 'Comic Sans MS', 'Comic Sans', 'Comic Neue', cursive, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, lx, ly + 0.5);
  }
  // you: a white-edged arrow pointing up, the way you're looking
  g.fillStyle = 'rgb(214,42,30)'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(r, r - 9); g.lineTo(r + 6.5, r + 7); g.lineTo(r, r + 3); g.lineTo(r - 6.5, r + 7); g.closePath(); g.stroke(); g.fill();
}

// ---------------------------------------------------------------- the frame around the map
// A slab of carved stone, drawn once at double size: a rock texture embossed from noise, chiselled edges, grooves of
// zigzags and rows of pits cut along each side, cracks, and in the corners two spirals and two red-ochre handprints
// like on a cave wall. The middle is cut out so the map shows through; the corner blocks overlap it a little.
function buildMapFrame() {
  const cv = document.getElementById('mapframecv');
  if (!cv || cv.dataset.done) return;
  cv.dataset.done = '1';
  const SC = 2, W = 220, N = W * SC, B = 18, CB = 30;
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  let seed = 4242; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const G = 96, cells = new Float32Array(G * G); for (let i = 0; i < cells.length; i++) cells[i] = rnd();
  const val = (x, y) => { const fx = Math.floor(x), fy = Math.floor(y), u = x - fx, v = y - fy, s = t => t * t * (3 - 2 * t), at = (a, b) => cells[((b % G + G) % G) * G + ((a % G + G) % G)];
    return at(fx, fy) * (1 - s(u)) * (1 - s(v)) + at(fx + 1, fy) * s(u) * (1 - s(v)) + at(fx, fy + 1) * (1 - s(u)) * s(v) + at(fx + 1, fy + 1) * s(u) * s(v); };
  const height = (x, y) => val(x / 7, y / 7) * 0.5 + val(x / 3, y / 3 + 20) * 0.3 + val(x / 1.3, y / 1.3 + 50) * 0.2;
  // the stone: patchy grey-brown, speckled, and embossed so every pit and grain catches the light from the top left
  const img = g.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / SC, fy = y / SC, k = (y * N + x) * 4;
    const patch = val(fx / 22, fy / 22 + 7) - 0.5, e = height(fx, fy) - height(fx + 0.5, fy + 0.5);
    let f = 1 + e * 2.6 + patch * 0.28;
    if (rnd() < 0.012) f *= 0.62;
    else if (rnd() < 0.006) f *= 1.22;
    d[k] = 134 * f + patch * 18; d[k + 1] = 124 * f + patch * 10; d[k + 2] = 110 * f; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const stone = document.createElement('canvas'); stone.width = stone.height = N; stone.getContext('2d').drawImage(cv, 0, 0);
  g.scale(SC, SC); g.lineCap = 'round'; g.lineJoin = 'round';
  // a groove cut into the stone: a pale lip on the lower right, a dark cut on top
  const groove = (draw, w) => {
    g.save(); g.translate(0.7, 0.8); g.strokeStyle = 'rgba(238,228,206,.5)'; g.lineWidth = w || 1.7; g.beginPath(); draw(); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(34,26,18,.88)'; g.lineWidth = w || 1.7; g.beginPath(); draw(); g.stroke();
  };
  const mid = B / 2;
  const zig = (x0, y0, x1, y1) => groove(() => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux, step = 6.5;
    g.moveTo(x0, y0);
    for (let t = step / 2, s = 1; t < len; t += step / 2, s = -s) g.lineTo(x0 + ux * t + nx * 3.2 * s, y0 + uy * t + ny * 3.2 * s);
    g.lineTo(x1, y1);
  });
  const pits = (x0, y0, x1, y1, off) => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    for (let t = 3; t < len; t += 6.5) for (const s of [-off, off]) {
      const px = x0 + ux * t + nx * s, py = y0 + uy * t + ny * s;
      g.fillStyle = 'rgba(238,228,206,.45)'; g.beginPath(); g.arc(px + 0.5, py + 0.6, 1.15, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(34,26,18,.85)'; g.beginPath(); g.arc(px, py, 1.1, 0, 6.3); g.fill();
    }
  };
  const lo = CB + 3, hi = W - CB - 3;
  const sides = [[lo, mid, hi, mid], [lo, W - mid, hi, W - mid], [mid, lo, mid, hi], [W - mid, lo, W - mid, hi]];
  for (const q of sides) zig(q[0], q[1], q[2], q[3]);
  for (const q of sides) pits(q[0], q[1], q[2], q[3], 5.6);
  // cracks: a few jagged lines across the slab
  const crack = (x, y, ang, len) => groove(() => { g.moveTo(x, y); for (let t = 0; t < len; t += 3) { ang += (rnd() - 0.5) * 1.1; x += Math.cos(ang) * 3; y += Math.sin(ang) * 3; g.lineTo(x, y); } }, 0.9);
  crack(70, 1, 1.5, 15); crack(160, W - 1, -1.6, 14); crack(1, 150, 0.1, 13); crack(W - 1, 70, 3.2, 14); crack(112, 2, 1.7, 9);
  // the chiselled edges: outer lip lit from the top left, the window's edge stepped down into the slab
  const edge = (x, y, w, h, up) => {
    const a = up ? 'rgba(244,236,216,.7)' : 'rgba(30,22,14,.75)', b = up ? 'rgba(30,22,14,.75)' : 'rgba(244,236,216,.7)';
    g.lineWidth = 1.6; g.strokeStyle = a; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.stroke();
    g.strokeStyle = b; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.stroke();
  };
  edge(1.2, 1.2, W - 2.4, W - 2.4, true); edge(B - 0.8, B - 0.8, W - 2 * B + 1.6, W - 2 * B + 1.6, false);
  g.strokeStyle = 'rgba(20,14,8,.95)'; g.lineWidth = 1.4; g.strokeRect(0.7, 0.7, W - 1.4, W - 1.4);
  g.clearRect(B, B, W - 2 * B, W - 2 * B);                        // the window for the map
  // the corner blocks, standing a little proud of the frame
  const handprint = (cx, cy, flip) => {
    g.save(); g.translate(cx, cy); if (flip) g.scale(-1, 1);
    const paint = 'rgba(158,50,32,.93)';
    g.fillStyle = paint; g.strokeStyle = paint; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(0, 3.5, 5.2, 5.6, 0, 0, 6.3); g.fill();
    for (const f of [[-3.8, -4], [-1.3, -7.5], [1.3, -8], [3.9, -5]]) { g.beginPath(); g.moveTo(f[0], 1.5); g.lineTo(f[0] * 1.08, f[1]); g.stroke(); }
    g.lineWidth = 2.8; g.beginPath(); g.moveTo(-4.4, 4.5); g.lineTo(-9.2, 0.6); g.stroke();
    for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(250,236,210,.34)' : 'rgba(70,20,12,.4)'; g.fillRect(-9 + rnd() * 18, -8 + rnd() * 17, 0.7, 0.7); }
    g.restore();
  };
  const spiral = (cx, cy) => groove(() => { for (let t = 0; t <= 13.2; t += 0.15) { const r = 1 + t * 0.62, px = cx + Math.cos(t) * r, py = cy + Math.sin(t) * r; if (t === 0) g.moveTo(px, py); else g.lineTo(px, py); } }, 1.6);
  const corners = [[0, 0, 'spiral'], [W - CB, 0, 'hand'], [0, W - CB, 'hand'], [W - CB, W - CB, 'spiral']];
  for (const c of corners) {
    const x = c[0], y = c[1];
    g.drawImage(stone, x * SC, y * SC, CB * SC, CB * SC, x, y, CB, CB);
    edge(x + 1, y + 1, CB - 2, CB - 2, true);
    g.strokeStyle = 'rgba(20,14,8,.95)'; g.lineWidth = 1.4; g.strokeRect(x + 0.7, y + 0.7, CB - 1.4, CB - 1.4);
    if (c[2] === 'spiral') spiral(x + CB / 2, y + CB / 2); else handprint(x + CB / 2, y + CB / 2 + 0.5, x > 0);
  }
}
