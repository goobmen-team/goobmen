// ======================================================================= the minimap
// Top right, square, turning with your view so straight ahead is always up. The island's land is drawn once into a
// picture; on top goes your planted C4 and you. Enemies and chests are not shown.
const MINI = { size: 180, range: 85 };                          // pixels across, metres from the middle to the edge
let miniLand = null;                                            // { img, half, px } for the island, made the first time it's needed
function miniIsland() {
  if (miniLand) return miniLand;
  const half = GRID.half, n = 900, img = document.createElement('canvas');
  img.width = img.height = n;
  const g = img.getContext('2d'), data = g.createImageData(n, n), d = data.data;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * 2 * half - half, z = (j + 0.5) / n * 2 * half - half, h = groundAt(x, z), k = (j * n + i) * 4;
    let c;
    if (h < SEA.level) { const deep = clamp((SEA.level - h) / 3, 0, 1); c = [40 - 20 * deep, 110 - 45 * deep, 150 - 30 * deep]; }
    else if (h < SEA.level + 0.7) c = [205, 190, 140];                                            // sand
    else if (h < 9) { const u = clamp(h / 9, 0, 1); c = [86 - 20 * u, 128 - 25 * u, 62 - 10 * u]; }   // grass, darker as it climbs
    else if (h < 24) { const u = clamp((h - 9) / 15, 0, 1); c = [110 + 20 * u, 104 + 18 * u, 92 + 18 * u]; }   // rock
    else c = [225, 228, 232];                                                                     // snow on the top
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  return (miniLand = { img, half, px: n / (2 * half) });
}
// what stands on the island, worked out once: tree tops, palms, rocks, house roofs, bridges, cave walls
let miniThings = null;
function miniFeatures() {
  if (miniThings) return miniThings;
  const round = [], shapes = [];
  for (const l of leaves) round.push({ x: l[0], z: l[2], r: Math.max(1.2, l[3] * 1.05), c: '#2c5626', e: '#1c3a18' });   // tree tops
  for (const o of solids) {
    if (!o.hull) { if (o.h > 1.5 && o.h / o.r < 10) round.push({ x: o.x, z: o.z, r: o.r / 0.24 * 1.25, c: '#557f36', e: '#33521f' }); continue; }   // palms (trees come from their tops)
    if (o.h === HOUSE_TALL && o.tris && o.tris.length === 2) continue;   // a house wall: the house is drawn whole below
    shapes.push({ hull: o.hull, c: o.thin ? '#8a6a40' : o.wall ? '#4b4a48' : '#8b8a84', e: o.thin ? '#4d3a20' : '#2e2d2b' });
  }
  if (typeof HOUSES !== 'undefined') for (const q of HOUSES) shapes.push({ hull: [[-3.8, -3.2], [3.8, -3.2], [3.8, 3.2], [-3.8, 3.2]].map(([a, b]) => houseWorld(q, a, b)), c: '#8a4b33', e: '#3d1f14' });
  for (const t of shapes) { let x = 0, z = 0; for (const q of t.hull) { x += q[0]; z += q[1]; } t.x = x / t.hull.length; t.z = z / t.hull.length; }
  return (miniThings = { round, shapes });
}
function drawMinimap() {
  const cv = ui.minimap; if (!cv) return;
  const g = cv.getContext('2d'), S = MINI.size, r = S / 2, scale = r / MINI.range;
  const me = player.pos, yaw = cam.yaw + Math.PI;                // the way the camera looks
  const theta = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));   // turns the world so that way is up
  const toMap = p => { const dx = p[0] - me[0], dz = p[2] - me[2], c = Math.cos(theta), s = Math.sin(theta); return [r + (dx * c - dz * s) * scale, r + (dx * s + dz * c) * scale]; };
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.rect(0, 0, S, S); g.clip();
  g.translate(r, r); g.rotate(theta);
  if (world.map === 'island') {
    const L = miniIsland(), k = scale / L.px;
    g.fillStyle = 'rgb(20,65,120)'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.drawImage(L.img, (-me[0] - L.half) * scale, (-me[2] - L.half) * scale, L.img.width * k, L.img.height * k);
    const F = miniFeatures(), far = MINI.range * 1.5, at = (x, z) => [(x - me[0]) * scale, (z - me[2]) * scale];
    g.lineWidth = 1;
    for (const t of F.shapes) {
      if (Math.abs(t.x - me[0]) > far || Math.abs(t.z - me[2]) > far) continue;
      g.beginPath(); t.hull.forEach((q, i) => { const [x, y] = at(q[0], q[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = t.c; g.fill(); g.strokeStyle = t.e; g.stroke();
    }
    for (const t of F.round) {
      if (Math.abs(t.x - me[0]) > far || Math.abs(t.z - me[2]) > far) continue;
      const [x, y] = at(t.x, t.z);
      g.beginPath(); g.arc(x, y, Math.max(1.4, t.r * scale), 0, Math.PI * 2); g.fillStyle = t.c; g.fill(); g.strokeStyle = t.e; g.stroke();
    }
  } else {                                                      // the training plate: a grey square with a grid
    g.fillStyle = '#2b2d31'; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.fillStyle = '#8b8e94'; g.fillRect((-HALF - me[0]) * scale, (-HALF - me[2]) * scale, 2 * HALF * scale, 2 * HALF * scale);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    for (let v = -HALF; v <= HALF; v += 5) {
      g.beginPath(); g.moveTo((v - me[0]) * scale, (-HALF - me[2]) * scale); g.lineTo((v - me[0]) * scale, (HALF - me[2]) * scale); g.stroke();
      g.beginPath(); g.moveTo((-HALF - me[0]) * scale, (v - me[2]) * scale); g.lineTo((HALF - me[0]) * scale, (v - me[2]) * scale); g.stroke();
    }
  }
  g.restore();
  // markers (drawn upright); anything off the edge sits on the rim so you know which way it is
  const pin = p => { const [x, y] = toMap(p); return x < 4 || y < 4 || x > S - 4 || y > S - 4 ? null : [x, y]; };
  for (const b of planted) {
    if (!b.armed || Math.sin(game.time * 14) < 0) continue;
    const q = pin(b.p); if (!q) continue;
    g.fillStyle = '#ff3b2f'; g.beginPath(); g.arc(q[0], q[1], 4, 0, Math.PI * 2); g.fill();
  }
  // you: an arrow pointing up, the way you're looking
  g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(r, r - 8); g.lineTo(r + 6, r + 6); g.lineTo(r, r + 2); g.lineTo(r - 6, r + 6); g.closePath(); g.fill(); g.stroke();
}
