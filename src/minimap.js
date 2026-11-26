// ======================================================================= the minimap
// Top right, square, in a wooden frame, turning with your view so straight ahead is always up. The island is painted
// once like an old map: parchment land with hill shading, an inked coastline, muted water, forests, rocks, houses and
// bridges. On top go your planted C4 and you. Enemies and chests are not shown.
const MINI = { size: 180, range: 85 };                          // pixels across, metres from the middle to the edge
const INK = 'rgb(58,40,24)';
let miniLand = null;                                            // { img, half, px } for the island, made the first time it's needed
function miniIsland() {
  if (miniLand) return miniLand;
  const half = GRID.half, n = 1200, px = n / (2 * half), img = document.createElement('canvas');
  img.width = img.height = n;
  const g = img.getContext('2d'), data = g.createImageData(n, n), d = data.data;
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = groundAt((i + 0.5) / px - half, (j + 0.5) / px - half);
  const wet = (i, j) => H[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)] < SEA.level;
  let seed = 7; const grain = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 4, h = H[j * n + i];
    let c;
    if (h < SEA.level) {
      // water: muted teal, a little lighter in the shallows next to the land
      const deep = clamp((SEA.level - h) / 4, 0, 1);
      c = [150 - 45 * deep, 176 - 40 * deep, 168 - 28 * deep];
    } else {
      // land: parchment, browner up the hills, pale at the very top; shaded as if lit from the top left
      const up = clamp(h / 22, 0, 1), top = clamp((h - 24) / 8, 0, 1);
      c = [226 - 30 * up + 18 * top, 207 - 40 * up + 25 * top, 162 - 42 * up + 40 * top];
      const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)], hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
      const shade = clamp(1 - (hx + hz) * 0.45 * px, 0.72, 1.12);
      c = c.map(v => v * shade);
      if (wet(i + 1, j) || wet(i - 1, j) || wet(i, j + 1) || wet(i, j - 1)) c = [86, 62, 40];   // the coastline, in ink
    }
    const gr = grain() * 10;                                    // a bit of paper grain
    d[k] = clamp(c[0] + gr, 0, 255); d[k + 1] = clamp(c[1] + gr, 0, 255); d[k + 2] = clamp(c[2] + gr, 0, 255); d[k + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  // then what stands on the island, inked on top
  const at = (x, z) => [(x + half) * px, (z + half) * px];
  g.fillStyle = 'rgba(78,104,58,0.5)';                          // forests: soft overlapping blobs, no outlines
  for (const l of leaves) { const [x, y] = at(l[0], l[2]); g.beginPath(); g.arc(x, y, Math.max(1.6, l[3] * 1.2 * px), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(96,124,62,0.55)';                         // palms
  for (const o of solids) if (!o.hull && o.h > 1.5 && o.h / o.r < 10) { const [x, y] = at(o.x, o.z); g.beginPath(); g.arc(x, y, Math.max(1.3, o.r / 0.24 * 1.1 * px), 0, Math.PI * 2); g.fill(); }
  const poly = (hull, fill, line, w) => {
    g.beginPath(); hull.forEach((q, i) => { const [x, y] = at(q[0], q[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
    g.fillStyle = fill; g.fill(); if (line) { g.strokeStyle = line; g.lineWidth = w || 1; g.stroke(); }
  };
  for (const o of solids) {
    if (!o.hull || (o.h === HOUSE_TALL && o.tris && o.tris.length === 2)) continue;   // house walls: drawn as whole houses below
    if (o.thin) poly(o.hull, 'rgb(120,86,50)', INK, 0.8);                                // bridges
    else if (o.wall) poly(o.hull, 'rgb(96,88,78)', INK, 0.8);                            // cave walls
    else poly(o.hull, 'rgb(150,138,118)', 'rgba(58,40,24,0.8)', 0.8);                    // rocks
  }
  for (const q of HOUSES) poly([[-3.8, -3.2], [3.8, -3.2], [3.8, 3.2], [-3.8, 3.2]].map(([a, b]) => houseWorld(q, a, b)), 'rgb(140,72,46)', INK, 1.2);
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
  g.imageSmoothingEnabled = true;
  if (world.map === 'island') {
    const L = miniIsland(), k = scale / L.px;
    g.fillStyle = 'rgb(105,136,128)'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.drawImage(L.img, (-me[0] - L.half) * scale, (-me[2] - L.half) * scale, L.img.width * k, L.img.height * k);
  } else {                                                      // the training plate: a stone slab on parchment
    g.fillStyle = 'rgb(214,196,156)'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.fillStyle = 'rgb(160,150,132)'; g.strokeStyle = INK; g.lineWidth = 1.5;
    g.fillRect((-HALF - me[0]) * scale, (-HALF - me[2]) * scale, 2 * HALF * scale, 2 * HALF * scale);
    g.strokeRect((-HALF - me[0]) * scale, (-HALF - me[2]) * scale, 2 * HALF * scale, 2 * HALF * scale);
  }
  g.restore();
  for (const b of planted) {                                    // your armed C4, blinking
    if (!b.armed || Math.sin(game.time * 14) < 0) continue;
    const [x, y] = toMap(b.p); if (x < 4 || y < 4 || x > S - 4 || y > S - 4) continue;
    g.fillStyle = 'rgb(190,30,20)'; g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // you: an inked arrow pointing up, the way you're looking
  g.fillStyle = 'rgb(160,32,24)'; g.strokeStyle = 'rgb(245,233,205)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(r, r - 8); g.lineTo(r + 6, r + 6); g.lineTo(r, r + 2.5); g.lineTo(r - 6, r + 6); g.closePath(); g.stroke(); g.fill();
}
