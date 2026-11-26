// ======================================================================= the minimap
// Top right, square, in a carved frame, turning with your view so straight ahead is always up. The island is painted
// once in natural colours: grass that varies from patch to patch, sandy beaches, rock and snow up the hill with the
// relief shaded, clear water with foam on the coast, every tree drawn as a lit canopy, plus rocks, houses and bridges.
// On top go your planted C4 and you. Enemies and chests are not shown.
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
  const SAND = [218, 200, 146], MEADOW = [128, 170, 78], GRASS = [82, 132, 58], DEEPG = [52, 96, 46], DIRT = [150, 126, 86], ROCK = [136, 132, 124], SNOW = [196, 202, 210];
  const wetAt = (i, j) => H[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] < SEA.level;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 4, h = H[j * n + i], x = (i + 0.5) / px - half, z = (j + 0.5) / px - half;
    const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)], hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
    const slope = Math.hypot(hx, hz) * px / 2;                       // rise over run
    let c;
    if (h < SEA.level) {
      // water: deep blue out and in the river bed, turquoise in the shallows by the shore
      const deep = Math.min(1, (SEA.level - h) / 3.2);
      c = mix([86, 186, 196], [24, 74, 132], deep);
      if (wetAt(i + 1, j) === false || wetAt(i - 1, j) === false || wetAt(i, j + 1) === false || wetAt(i, j - 1) === false) c = [214, 236, 232];   // foam on the coast
    } else {
      const above = h - SEA.level, pt = patch(x, z);
      if (above < 1.1) c = mix(SAND, mix(DIRT, SAND, 0.5), pt);                              // beaches
      else {
        c = mix(mix(DEEPG, MEADOW, pt), GRASS, 0.35);                                        // patchy grass
        c = mix(c, mix(DIRT, GRASS, 0.5), clamp((slope - 0.35) / 0.6, 0, 0.7));              // bare earth on the steeper bits
        c = mix(c, ROCK, clamp((h - 10) / 12, 0, 1) * 0.9 + clamp((slope - 0.8) / 0.8, 0, 0.7));
        c = mix(c, SNOW, clamp((h - 31) / 9, 0, 1) * 0.85);
        c = mix(c, SAND, clamp(1 - (above - 1.1) / 0.9, 0, 1) * 0.6);                        // grass thins out to sand
      }
      // light from the top left: sunny slopes bright, shaded slopes dark
      const shade = clamp(1 - (hx + hz) * 0.5 * px, 0.6, 1.15);
      c = c.map(v => v * shade);
    }
    d[k] = clamp(c[0], 0, 255); d[k + 1] = clamp(c[1], 0, 255); d[k + 2] = clamp(c[2], 0, 255); d[k + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  // what stands on the island
  const at = (x, z) => [(x + half) * px, (z + half) * px];
  const dot = (x, y, r, dark, light) => {                                                   // a lit tree top: dark disc, bright disc to the top left
    g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = light; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.28, r * 0.68, 0, Math.PI * 2); g.fill();
  };
  g.globalAlpha = 0.9;
  for (const l of leaves) { const [x, y] = at(l[0], l[2]); dot(x, y, Math.max(2.2, l[3] * 1.1 * px), 'rgb(26,64,30)', 'rgb(58,110,48)'); }
  for (const o of solids) if (!o.hull && o.h > 1.5 && o.h / o.r < 10) { const [x, y] = at(o.x, o.z); dot(x, y, Math.max(1.8, o.r / 0.24 * 1.0 * px), 'rgb(52,100,40)', 'rgb(108,158,62)'); }   // palms
  g.globalAlpha = 1;
  const poly = (hull, fill, line, w, lit) => {
    g.beginPath(); hull.forEach((q, i) => { const [x, y] = at(q[0], q[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.lineWidth = w; g.lineJoin = 'round'; g.stroke();
  };
  for (const o of solids) {
    if (!o.hull || (o.h === HOUSE_TALL && o.tris && o.tris.length === 2)) continue;   // house walls: drawn as whole houses below
    if (o.thin) poly(o.hull, 'rgb(150,108,62)', 'rgb(70,46,24)', 1.1);                   // bridges: planks
    else if (o.wall) poly(o.hull, 'rgb(112,104,96)', 'rgb(44,40,36)', 1.1);              // cave walls
    else poly(o.hull, 'rgb(150,146,138)', 'rgb(70,66,60)', 1.1);                         // rocks
  }
  for (const q of HOUSES) {                                                              // houses: a roof with a ridge line
    const corners = [[-3.8, -3.2], [3.8, -3.2], [3.8, 3.2], [-3.8, 3.2]].map(([a, b]) => houseWorld(q, a, b));
    poly(corners, 'rgb(168,82,52)', 'rgb(70,30,18)', 1.8);
    const a = at(...houseWorld(q, -3.8, 0).filter((_, i) => true).slice(0, 2)), b = at(...houseWorld(q, 3.8, 0).slice(0, 2));
    g.strokeStyle = 'rgb(112,50,32)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  return (miniLand = { img, half, px });
}
function drawMinimap() {
  const cv = ui.minimap; if (!cv) return;
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
  for (const b of planted) {                                    // your armed C4, blinking
    if (!b.armed || Math.sin(game.time * 14) < 0) continue;
    const [x, y] = toMap(b.p); if (x < 4 || y < 4 || x > S - 4 || y > S - 4) continue;
    g.fillStyle = 'rgb(220,40,28)'; g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // north: a small compass mark on the rim that swings round as you turn (north is -z)
  const [nx, ny] = toMap([me[0], 0, me[2] - 1000]), nd = Math.hypot(nx - r, ny - r), px2 = r + (nx - r) / nd * (r - 11), py2 = r + (ny - r) / nd * (r - 11);
  g.fillStyle = 'rgba(20,14,8,.72)'; g.beginPath(); g.arc(px2, py2, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2e6c4'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', px2, py2 + 0.5);
  // you: a white-edged arrow pointing up, the way you're looking
  g.fillStyle = 'rgb(214,42,30)'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(r, r - 9); g.lineTo(r + 6.5, r + 7); g.lineTo(r, r + 3); g.lineTo(r - 6.5, r + 7); g.closePath(); g.stroke(); g.fill();
}
