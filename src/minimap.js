// ======================================================================= the minimap
// Top right, square, turning with your view so straight ahead is always up. The island's land is drawn once into a
// picture; on top goes your planted C4 and you. Enemies and chests are not shown.
const MINI = { size: 180, range: 55 };                          // pixels across, metres from the middle to the edge
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
