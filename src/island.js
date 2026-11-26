// ======================================================================= the island (map in progress)
// the island, its hills, the ocean around it and water that hurts. no caves yet. T swaps maps for now
// low: the optimized island for weaker computers. asking: the map choice is on screen
const world = { map: 'plate', low: false, asking: false };
// the land climbs from the beach to a meadow, hills and one mountain; past the coast it drops to the sea floor
const SEA = { level: -0.2, floor: -1.0, wade: 5, swim: 60, grace: 0.6, every: 0.5, bite: 8 };
const SKY = { plate: [219 / 255, 219 / 255, 219 / 255], island: [0.66, 0.80, 0.91] };
// how far the coast is from the middle, in each direction (the same formula is in the water shader)
const bulge = (a, at, wide) => Math.exp(-((Math.sin((a - at) / 2) / wide) ** 2));
const coast = a => 4 * (105 + 13 * Math.sin(3 * a + 1.1) + 9 * Math.sin(5 * a + 2.6) + 4 * Math.sin(11 * a) + 3 * Math.sin(19 * a + 0.7)
  - 34 * bulge(a, 0.75, 0.11) + 28 * bulge(a, -2.3, 0.09));      // a deep bay and a long headland
const pastCoast = (x, z) => Math.hypot(x, z) - coast(Math.atan2(x, z));
const MEADOW = 2.0;                                          // the flat clearing you start in
// x, z, how much ground to keep clear of ordinary trees
const SPOTS = {
  circle: [-62, -52, 18], elder: [92, 36, 17], bones: [-96, 128, 18], camp: [168, 14, 22],
  boulders: [38, 188, 36], crater: [150, -96, 40], pines: [-196, -34, 0], cove: [104, 112, 0],
  // the outer island
  volcano: [-318, 48, 40], tables: [262, -168, 0], arches: [240, 56, 30], mammoths: [-222, -246, 34],
  fishers: [36, 372, 36], grove: [-218, 214, 0], heads: [300, -22, 30], fort: [-262, -92, 34], canyon: [52, -352, 0], tower: [140, 258, 22]
};
// x, z, height, radius of the smaller hills
const HILLS = [[112, 82, 11, 30], [104, -42, 9, 26], [-72, -104, 8, 24], [-16, 168, 8, 26], [158, -26, 7, 22], [-170, -44, 8, 26],
  [62, -190, 10, 32], [-150, 108, 9, 28], [112, 170, 7, 24], [-46, -186, 11, 34], [196, 70, 8, 26], [-190, 40, 6, 22], [44, 62, 5, 18], [-52, 38, 4, 16],
  [230, 20, 12, 40], [300, 190, 11, 44], [150, 215, 8, 30], [-60, 300, 13, 48], [-170, 170, 9, 34], [-330, 190, 15, 55], [-300, -190, 10, 40],
  [-130, -300, 14, 52], [190, -260, 12, 46], [330, -110, 9, 38], [-390, -40, 12, 44], [110, 380, 8, 34], [-140, 390, 11, 42], [10, -430, 9, 36], [370, 120, 7, 30], [-250, 30, 8, 30]];
const PEAK_AT = [25, -125], TWIN_AT = [-112, -118], MESA_AT = [-124, 30];
const GORGE = [[-92, 94], [-48, 80], [-2, 106], [46, 90], [84, 70]];   // a winding pass with rock walls
const CANYON = [[-4, -318], [34, -352], [72, -340], [104, -372]];     // a second, deeper one far to the south
const TABLES = [[236, -150, 15, 11], [270, -182, 19, 14], [300, -146, 12, 8], [228, -196, 11, 9], [292, -214, 13, 10]];   // x, z, radius, height
// two rivers from coast to coast. the bed is below sea level, so the same water fills them
const RIVER = { wet: 6, bank: 10, valley: 30 };
const smoothPath = knots => {
  const out = [];
  for (let k = 0; k + 1 < knots.length; k++) {
    const p0 = knots[Math.max(0, k - 1)], p1 = knots[k], p2 = knots[k + 1], p3 = knots[Math.min(knots.length - 1, k + 2)];
    for (let s = 0; s < 6; s++) {
      const t = s / 6, at = i => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t * t * t);
      out.push([at(0), at(1)]);
    }
  }
  out.push(knots[knots.length - 1]);
  return out;
};
const RIVERS = [
  [[-70, -760], [-96, -560], [-34, -420], [-40, -290], [-52, -200], [-55, -135], [-34, -82], [-30, -40], [-48, 2], [-74, 42], [-112, 78], [-140, 132], [-146, 205], [-170, 290], [-132, 392], [-196, 490], [-262, 740]],
  [[250, -740], [190, -540], [138, -400], [160, -285], [108, -192], [96, -122], [80, -62], [52, -22], [46, 20], [62, 54], [102, 60], [152, 72], [204, 112], [275, 150], [372, 204], [480, 196], [720, 262]]
].map(smoothPath);
// in short pieces with a box round each, so far-off ones are skipped quickly
const REACHES = RIVERS.flatMap(path => {
  const out = [];
  for (let k = 0; k + 1 < path.length; k += 6) {
    const pts = path.slice(k, k + 7), xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    out.push({ pts, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  return out;
});
function riverDistance(x, z) {
  let best = 99;                                             // further than anything cares about
  for (const r of REACHES) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
    if (dx < best && dz < best) best = Math.min(best, pathDistance(x, z, r.pts));
  }
  return best;
}
const bridges = [];                                          // filled in by bridges.js
const MOUTHS = [];                                           // x, z of each place a river meets the coast
for (const path of RIVERS) {
  const found = [];
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1], ea = pastCoast(a[0], a[1]), eb = pastCoast(b[0], b[1]);
    if ((ea < 0) === (eb < 0)) continue;
    const u = ea / (ea - eb);
    found.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  MOUTHS.push(...found[0], ...found[found.length - 1]);      // one at each end
}
const bump = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
// caves. every mouth faces +z, on ground levelled for it
const CAVE = { depth: 3.9, half: 1.9, length: 12, room: 4.3, want: 12, cut: 3.4 };    // cut: how deep the doorway is dug in
CAVE.end = CAVE.length + CAVE.room * 2 - 1.4;
const CAVES = [];
// a good spot on a south-facing flank: clear of the water and the landmarks, with ground behind to hold the roof
function caveSite(x, z, base) {
  const back = z - CAVE.end / 2;
  if (Math.hypot(x, back) < 55 || pastCoast(x, back) > -40 || pastCoast(x, z + 10) > -30) return false;
  if (riverDistance(x, back) < RIVER.valley + 6 || riverDistance(x, z + 6) < RIVER.valley) return false;
  if (Object.entries(SPOTS).some(([name, [px, pz, r]]) => name !== 'volcano' && Math.hypot(x - px, back - pz) < r + 26)) return false;
  if (pathDistance(x, back, GORGE) < 28 || pathDistance(x, back, CANYON) < 28) return false;
  // the ground in front has to fall away so the way in comes out in the open, without becoming a drop
  const ahead = natural(x, z + 8);
  if (ahead > base + 0.9 || ahead < base - 2.6) return false;
  for (const s of [2, 5, 9]) for (const dx of [-2.5, 2.5]) if (natural(x + dx, z - s) < base + 2.4) return false;
  if (Math.abs(natural(x - 4.5, z) - natural(x + 4.5, z)) > 3.2) return false;
  return CAVES.every(c => Math.hypot(c.x - x, c.z - z) > 60);
}
function findCaves() {
  const mounds = [[...PEAK_AT, 74], [...TWIN_AT, 48], [SPOTS.volcano[0], SPOTS.volcano[1], 105], [...MESA_AT, 42],
    ...HILLS.filter(h => h[2] >= 7).map(([x, z, , r]) => [x, z, r])];
  for (const [hx, hz, r] of mounds) {
    if (CAVES.length >= CAVE.want) break;
    search: for (const off of [0, -0.2, 0.2, -0.38, 0.38, -0.55, 0.55]) {
      const x = hx + off * r;
      // the mouth sits on a row of the ground mesh, so the cliff above it starts exactly there
      const onRow = v => Math.round((v + GRID.half) / GRID.cell) * GRID.cell - GRID.half;
      for (let w = hz + r * 1.05; w > hz + 3; w -= GRID.cell) {  // walk up the south side until it is steep enough
        const z = onRow(w);
        const base = natural(x, z) - CAVE.cut;
        if (base < 3.0 || natural(x, z) - natural(x, z + 6) < 1.1 || !caveSite(x, z, base)) continue;
        const k = CAVES.length;
        let lip = 0;
        for (let s = 0.5; s <= 4.5; s += 0.5) lip = Math.max(lip, natural(x, z - s) - base, 3.7);
        CAVES.push({ x, z, base, depth: Math.min(CAVE.depth, base - 0.7), lip: lip + 0.4, bend: (bump(k, 911) < 0.5 ? -1 : 1) * (1.2 + bump(k, 1201) * 1.8) });
        break search;
      }
    }
  }
}
// the only change to the land: a cutting up to the mouth, and enough earth over the roof
function cutCaves(x, z, h) {
  for (const c of CAVES) {
    const s = c.z - z, t = Math.abs(x - c.x);
    if (s < -15 || s > CAVE.end + 5 || t > CAVE.room + 7) continue;
    if (s < 0.3) {
      // ragged banks, never closer than the doorway is wide
      const ragged = roll(x, z, 6) * 2.4 * smooth(CAVE.half + 0.4, CAVE.half + 2.0, t);
      const open = smooth(CAVE.half + 3.8, CAVE.half + 1.0, t + ragged) * smooth(-14, -8, s);
      // near the door the floor is level; further out only what stands above it is dug away
      const level = s > -4.5 ? c.base : Math.min(h, c.base);
      h += (level - h) * open;
    } else {
      const need = c.base - c.depth * smooth(1.5, 11.5, s) + 3.8 + 0.8 * smooth(CAVE.length - 1, CAVE.length + 2.5, s);
      const over = smooth(CAVE.room + 3.5, CAVE.room + 0.8, t) * smooth(CAVE.end + 4, CAVE.end, s);
      if (need > h) h += (need - h) * over;
    }
  }
  return h;
}
function roll(x, z, size) {
  const u = x / size, v = z / size, i = Math.floor(u), j = Math.floor(v), a = smooth(0, 1, u - i), b = smooth(0, 1, v - j);
  return (bump(i, j) * (1 - a) + bump(i + 1, j) * a) * (1 - b) + (bump(i, j + 1) * (1 - a) + bump(i + 1, j + 1) * a) * b - 0.5;
}
function pathDistance(x, z, path) {
  let best = 1e9;
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, az] = path[k], dx = path[k + 1][0] - ax, dz = path[k + 1][1] - az, u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * u, z - az - dz * u));
  }
  return best;
}
function shape(x, z) { return levelHouses(x, z, cutCaves(x, z, natural(x, z))); }
// ---------------------------------------------------------------- where the abandoned houses stand
// x, z, which way the door faces, floor height. the first is in sight of the sign; the rest are
// spread round the island wherever the land is already fairly flat. houses.js builds on these
const HOUSES = [];
const HOUSE_COUNT = 12;
const addHouse = (x, z, base, turn) => HOUSES.push({ x, z, base, yaw: Math.atan2(z, -x) + turn, cos: 0, sin: 0 });
function findHouses() {
  addHouse(-19, -16, MEADOW, 0.1);
  for (let k = 0; k < 6000 && HOUSES.length < HOUSE_COUNT; k++) {
    const a = bump(k, 7001) * Math.PI * 2, d = 70 + Math.sqrt(bump(k, 7013)) * 370, x = Math.sin(a) * d, z = Math.cos(a) * d;
    // the early tries keep them far apart, later ones may come closer
    if (HOUSES.some(q => Math.hypot(q.x - x, q.z - z) < (k < 3000 ? 140 : 95))) continue;
    if (pastCoast(x, z) > -34 || riverDistance(x, z) < RIVER.valley - 4) continue;
    if (pathDistance(x, z, GORGE) < 32 || pathDistance(x, z, CANYON) < 32) continue;
    if (Object.values(SPOTS).some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + 24)) continue;
    if (CAVES.some(c => Math.abs(x - c.x) < 26 && z > c.z - CAVE.end - 18 && z < c.z + 24)) continue;
    const around = [natural(x, z)];
    for (const r of [5, 11]) for (let i = 0; i < 8; i++) around.push(natural(x + Math.sin(i * 0.785) * r, z + Math.cos(i * 0.785) * r));
    const low = Math.min(...around), high = Math.max(...around);
    if (low < 1.5 || high > 14 || high - low > (k < 3000 ? 2.6 : 3.4)) continue;
    addHouse(x, z, around.reduce((s, h) => s + h, 0) / around.length, (bump(k, 7027) - 0.5) * 1.2);
  }
  for (const q of HOUSES) { q.cos = Math.cos(q.yaw); q.sin = Math.sin(q.yaw); }
}
function levelHouses(x, z, h) {
  for (const q of HOUSES) {
    const dx = x - q.x, dz = z - q.z;
    if (Math.abs(dx) > 16 || Math.abs(dz) > 16) continue;
    const flat = smooth(15, 9, Math.hypot(dx, dz));
    h += (q.base - h) * flat;
  }
  return h;
}
const nearHouse = (x, z, r) => HOUSES.some(q => Math.hypot(q.x - x, q.z - z) < r);
// a point in a house's own space (+x out of the door), and whether it is under that roof
const houseLocal = (q, x, z) => [(x - q.x) * q.cos - (z - q.z) * q.sin, (x - q.x) * q.sin + (z - q.z) * q.cos];
const houseWorld = (q, lx, lz) => [q.x + lx * q.cos + lz * q.sin, q.z - lx * q.sin + lz * q.cos];
function houseAt(x, z, pad) {
  for (const q of HOUSES) {
    if (Math.abs(x - q.x) > 12 || Math.abs(z - q.z) > 12) continue;
    const [lx, lz] = houseLocal(q, x, z);
    if (lx > -3.7 - pad && lx < 4.8 + pad && Math.abs(lz) < 3.1 + pad) return q;
  }
  return null;
}
function natural(x, z) {
  const e = pastCoast(x, z);
  return carveRivers(x, z, e >= 0 ? SEA.floor * clamp(e / SEA.wade, 0, 1) : rawGround(x, z, e), e);
}
// a sandy bank beside the water, then the ground eases back up to what it was
function carveRivers(x, z, h, e) {
  const d = riverDistance(x, z) + roll(x, z, 13) * 2.4 - 5 * smooth(-38, 0, e);   // a wider mouth at the coast
  if (d >= RIVER.valley) return h;
  const bed = d < RIVER.bank ? SEA.floor + (1.1 - SEA.floor) * smooth(RIVER.wet - 2.5, RIVER.bank, d) : 1.1;
  const back = smooth(RIVER.bank, RIVER.valley, d);
  return Math.min(h, bed + (Math.max(h, bed) - bed) * back);
}
function rawGround(x, z, e) {
  // rolling ground at three sizes
  let h = MEADOW + 1.2 + roll(x, z, 37) * 5 + roll(x + 40, z, 16) * 2.4 + roll(x, z + 70, 6) * 0.6;
  for (const [hx, hz, top, r] of HILLS) {
    const d = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
    if (d < 1) h += top * (1 - d) * (1 - d) * (1 + roll(x, z, 9) * 0.5);
  }
  // the two mountains: spurs and gullies running down from each summit
  for (const [at, wide, tall] of [[PEAK_AT, 74, 36], [TWIN_AT, 48, 22]]) {
    const mx = x - at[0], mz = z - at[1], m = Math.hypot(mx, mz) / wide;
    if (m < 1) {
      const spur = Math.abs(Math.sin(Math.atan2(mx, mz) * 3.5 + roll(x, z, 21) * 3));
      h += tall * (1 - m) ** 1.6 * (0.72 + 0.4 * (0.5 + (spur - 0.5) * smooth(0, 0.35, m))) + roll(x, z, 8) * 4 * (1 - m);
    }
  }
  // the mesa: flat top, cliffs all round, one ramp on the side facing the start
  const qx = x - MESA_AT[0], qz = z - MESA_AT[1], q = Math.hypot(qx, qz) + roll(x, z, 7) * 4;
  const ramp = smooth(0.80, 0.97, qx / (Math.hypot(qx, qz) || 1));
  const rise = smooth(25, 21.5, q) * (1 - ramp) + smooth(42, 16, q) * ramp;
  h = h * (1 - rise) + (11.5 + roll(x, z, 9) * 0.8) * rise;
  // the gorge: raised rock either side of a low winding floor
  const g = pathDistance(x, z, GORGE) + roll(x, z, 8) * 3;
  h += 7.5 * smooth(17, 9, g);
  const floor = smooth(7, 3.5, g);
  h = h * (1 - floor) + (1.3 + roll(x, z, 12) * 0.5) * floor;

  // the crater: a ring of rock with a way in on two sides
  const [kx, kz] = SPOTS.crater, kd = Math.hypot(x - kx, z - kz) + roll(x, z, 9) * 3;
  if (kd < 48) {
    const side = Math.abs(Math.sin(Math.atan2(x - kx, z - kz) - Math.atan2(-kx, -kz)));     // 0 at the two ways in
    const rim = smooth(40, 31, kd) * smooth(19, 27, kd) * smooth(0.18, 0.42, side);
    h = h * (1 - smooth(44, 30, kd)) + (2.0 + roll(x, z, 11) * 0.5) * smooth(44, 30, kd) + 10 * rim;
  }
  // the volcano: a tall cone with a bowl in the top
  const [vx, vz] = SPOTS.volcano, vm = Math.hypot(x - vx, z - vz) / 105;
  if (vm < 1) h += 52 * (1 - vm) ** 1.5 * (0.9 + 0.2 * Math.abs(Math.sin(Math.atan2(x - vx, z - vz) * 5 + roll(x, z, 19) * 3))) - 17 * smooth(0.2, 0.05, vm);
  // table rocks: flat tops on sheer sides
  for (const [tx, tz, wide, tall] of TABLES) {
    const q = Math.hypot(x - tx, z - tz) + roll(x, z, 7) * 3.5;
    if (q < wide + 3) { const up = smooth(wide + 2, wide - 1.5, q); h = h * (1 - up) + (tall + roll(x, z, 8) * 0.8) * up; }
  }
  // the far canyon
  const c = pathDistance(x, z, CANYON) + roll(x, z, 8) * 3;
  if (c < 24) {
    h += 11 * smooth(23, 11, c);
    const bottom = smooth(8, 4, c);
    h = h * (1 - bottom) + (1.3 + roll(x, z, 12) * 0.5) * bottom;
  }
  // level ground where something stands
  for (const name of ['circle', 'elder', 'bones', 'camp', 'boulders', 'arches', 'mammoths', 'fishers', 'heads', 'fort', 'tower']) {
    const [px, pz, r] = SPOTS[name], flat = smooth(r + 10, r - 2, Math.hypot(x - px, z - pz));
    h = h * (1 - flat) + (name === 'circle' || name === 'elder' || name === 'tower' || name === 'heads' ? 4.2 : 2.4) * flat;
  }

  h = MEADOW + (h - MEADOW) * smooth(12, 27, Math.hypot(x, z));
  return Math.max(0, h) * smooth(0, 24, -e);
}
// heights on a grid: the drawn land and your feet read the same numbers
const GRID = { half: 660, n: 760 };
GRID.cell = GRID.half * 2 / GRID.n;
const heights = new Float32Array((GRID.n + 1) * (GRID.n + 1));
findCaves();
findHouses();
for (let j = 0; j <= GRID.n; j++) for (let i = 0; i <= GRID.n; i++) heights[j * (GRID.n + 1) + i] = shape(i * GRID.cell - GRID.half, j * GRID.cell - GRID.half);

function groundAt(x, z, y) {
  return world.map === 'island' ? walkHeight(x, z, y) : 0;
}
function groundHeight(x, z) {
  const u = (x + GRID.half) / GRID.cell, v = (z + GRID.half) / GRID.cell;
  if (u < 0 || v < 0 || u >= GRID.n || v >= GRID.n) return SEA.floor;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * (GRID.n + 1) + i;
  const h00 = heights[k], h10 = heights[k + 1], h01 = heights[k + GRID.n + 1], h11 = heights[k + GRID.n + 2];
  // the same two triangles per square as the mesh
  return a > b ? h00 + (h10 - h00) * a + (h11 - h10) * b : h00 + (h11 - h01) * a + (h01 - h00) * b;
}
const inSea = p => groundAt(p[0], p[2]) < SEA.level;
// what loose things come to rest on
const floorAt = (x, z, y) => world.map === 'island' ? Math.max(groundAt(x, z, y), SEA.level) : 0;

// keeps a fighter on the map: bots stay on land, you can wade out a bit further
function confine(f) {
  const p = f.pos;
  if (world.map !== 'island') {
    p[0] = clamp(p[0], -HALF + 0.6, HALF - 0.6); p[2] = clamp(p[2], -HALF + 0.6, HALF - 0.6);
    return;
  }
  pushSolids(f, 0.28); pushSolids(f, 0.28);                    // twice, so being pushed off one cannot leave you in the next
  const d = Math.hypot(p[0], p[2]), max = coast(Math.atan2(p[0], p[2])) + (f.isPlayer ? SEA.swim : -1.5);
  if (d > max) { p[0] *= max / d; p[2] *= max / d; }
}
// cliffs: you cannot walk up a sheer face (slide along it instead), but you can step off the top
const STEEP = 1.3;
function cliffs(f, x0, z0) {
  if (world.map !== 'island') return;
  const sheer = (x, z) => {
    const d = Math.hypot(x - x0, z - z0);
    if (d < 1e-5) return false;
    // look a little ahead, so a single frame's tiny step cannot creep up a face
    const k = Math.max(1, 0.5 / d), y = groundAt(x0 + (x - x0) * k, z0 + (z - z0) * k, f.pos[1]);
    return y - groundAt(x0, z0, f.pos[1]) > STEEP * d * k;
  };
  const p = f.pos;
  if (!sheer(p[0], p[2])) return;
  if (!sheer(p[0], z0)) p[2] = z0;
  else if (!sheer(x0, p[2])) p[0] = x0;
  else { p[0] = x0; p[2] = z0; }
}

// where a ray meets the ground, the sea, a tree or a rock, or null
function surfaceHit(origin, dir) {
  if (world.map !== 'island') {
    if (dir[1] >= -1e-4) return null;
    const t = -origin[1] / dir[1], p = V.mad(origin, dir, t);
    return Math.abs(p[0]) < HALF && Math.abs(p[2]) < HALF ? { t, kind: 'ground' } : null;
  }
  const solid = solidHit(origin, dir);
  const under = t => { const p = V.mad(origin, dir, t); return p[1] < floorAt(p[0], p[2], p[1] + 1) || caveRock(p); };
  for (let last = 0, t = 0.4; t < Math.min(90, solid); last = t, t += 0.4 + t * 0.012) {
    if (!under(t)) continue;
    let lo = last, hi = t;
    for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (under(mid)) hi = mid; else lo = mid; }
    return { t: hi, kind: inSea(V.mad(origin, dir, hi)) ? 'water' : 'ground' };
  }
  return solid < 90 ? { t: solid, kind: 'solid' } : null;
}
// is the ground in the way between two points? (so health bars do not show through hills)
function behindHill(from, to) {
  if (world.map !== 'island') return false;
  const d = V.sub(to, from), len = V.len(d), s = surfaceHit(from, V.mul(d, 1 / (len || 1)));
  return !!s && s.t < len - 0.5;
}
// pull the camera in when a hill gets between it and you
function cameraRoom(at, fwd, dist) {
  if (world.map !== 'island') return dist;
  for (let d = 0.2; d <= dist; d += 0.2) {
    const p = V.mad(at, fwd, -d);
    if (caveCamera(p) || houseBlocks(p)) return Math.max(0.35, d - 0.25);
    if (p[1] < floorAt(p[0], p[2], p[1]) + 0.2 || leaves.some(c => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < c[3])) return Math.max(0.4, d - 0.2);
  }
  return dist;
}

// ---------------------------------------------------------------- the sea bites
function seaStep(f, dt) {
  if (f.dead >= 0 || !inSea(f.pos)) { f.wet = 0; return; }
  const before = f.wet || 0;
  f.wet = before + dt;
  const bites = t => t < SEA.grace ? 0 : 1 + Math.floor((t - SEA.grace) / SEA.every);
  if (bites(f.wet) === bites(before) || game.godMode) return;
  f.hp = Math.max(0, f.hp - SEA.bite); f.hurt = 0.22; hudDirty = true;
  Sound.play('hurt', 0.6); game.hurtFade = 0.9; ui.vignette.style.opacity = 1;
  ui.hurtDir.style.transform = 'scale(0)';                   // no attacker to point at
  puff([f.pos[0], SEA.level + 0.05, f.pos[2]], 10, [0.85, 0.93, 0.97, 0.8], 1.1, 0.05, 0.5, 4);
  if (f.hp > 0) notify('The water hurts! Get back to land');
  else { f.pos[1] = SEA.level - 0.15; knockOut(f, 'The water got you'); }
}

// ---------------------------------------------------------------- swapping maps
function askMap(on) {
  world.asking = on;
  document.getElementById('mapask').hidden = !on;
}
function setMap(name, low) {
  askMap(false);
  abortLoot(); endSend(player); FLY.on = false;
  world.map = name; world.low = name === 'island' && !!low;
  if (name === 'island') loadFlora();
  setChests(name);
  setBikes(name);
  grassNow = true;
  for (const q of pops) q.el.remove();
  for (const list of [pops, props, stars, particles, tracers, shells, flashes, marks]) list.length = 0;
  player.yaw = Math.PI; cam.yaw = 0; cam.pitch = 0.12;
  player.hurt = 0; player.wet = 0; player.reload = -1; player.cycle = -1; game.hurtFade = 0;
  respawnPlayer();
  notify(name !== 'island' ? 'Back on the baseplate' : (world.low ? 'Optimized island' : 'The island') + ' (work in progress). T to go back');
}

// ---------------------------------------------------------------- drawing the island
const FOG = `
uniform vec3 uSky; uniform vec2 uFog;
vec3 fogged(vec3 col, vec3 w) { return mix(col, uSky, smoothstep(uFog.x, uFog.y, length(w - uEye))); }`;
// ground and plants share one shader: the colour comes from the mesh, the fine grain is made up here
const landProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aCol; layout(location=2) in vec3 aNrm; uniform mat4 uViewProj; out vec3 vW; out vec3 vC; out vec3 vN;
void main() { vW = aPos; vC = aCol; vN = aNrm; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec3 vW; in vec3 vC; in vec3 vN; out vec4 o;
uniform int uKind;                                          // 0 the ground, 1 things standing on it
uniform int uLow;                                           // optimized: no fine detail, one shadow sample
uniform highp sampler2DShadow uBaked; uniform mat4 uBakedLight;
uniform int uCut; uniform vec4 uCaves[12];                  // each cave mouth: x, z, floor height at the door, how far down it goes
// is this bit of ground standing in the way into a cave?
bool doorway(vec3 w) {
  for (int k = 0; k < 12; k++) {
    vec4 c = uCaves[k];
    float s = c.y - w.z;
    if (s < -0.3 || s > 8.0 || abs(w.x - c.x) > 5.0) continue;
    float rel = w.y - (c.z - c.w * smoothstep(1.5, 11.5, s));
    if (rel < (s < 0.4 ? 0.06 : -0.4) || rel > 3.1) continue;
    float across = pow(abs(w.x - c.x) / 1.93, 1.667), up = pow(max(rel, 0.0) / 3.03, 1.333);    // the same arch as the walls
    if (across * across + up * up < 1.0) return true;
  }
  return false;
}
${COMMON}
${FOG}
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// shadows of the whole island, drawn once
float bakedShadow(vec3 w) {
  vec4 q = uBakedLight * vec4(w, 1.0); vec3 p = q.xyz / q.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float sum = 0.0; vec2 t = 1.0 / vec2(textureSize(uBaked, 0));
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) sum += texture(uBaked, vec3(p.xy + vec2(x, y) * t * 1.2, p.z - 0.0008));
  return sum / 9.0;
}
void main() {
  if (uCut == 1 && doorway(vW)) discard;
  vec3 N = normalize(vN), col = vC;
  float far = length(vW - uEye), near = 1.0 - smoothstep(14.0, 55.0, far);   // fine grain fades out before it can shimmer
  if (uKind == 0 && uLow == 1) {
    float stoneish = 1.0 - smoothstep(0.10, 0.19, max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b)));
    col *= 0.84 + 0.20 * noise(vW.xz * 0.9) + 0.14 * noise(vW.xz * 0.23) + near * 0.16 * (noise(vW.xz * 5.0) - 0.5);
    col *= 1.0 + stoneish * 0.30 * (noise(vec2(vW.y * 1.7, 3.0)) - 0.5);
  } else if (uKind == 0) {
    vec2 p = vW.xz;
    float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
    float rock = 1.0 - smoothstep(0.10, 0.19, sat);
    float sand = (1.0 - rock) * smoothstep(0.62, 0.74, col.r);
    float grass = (1.0 - rock) * (1.0 - sand) * smoothstep(-0.10, -0.06, col.g - col.r);
    float dirt = max(0.0, 1.0 - rock - sand - grass);
    float broad = noise(p * 0.23), middle = noise(p * 1.1), fine = noise(p * 5.0), grit = noise(p * 17.0);
    float calm = 1.0 - 0.8 * grass;
    col *= 0.86 + calm * (0.16 * broad + 0.12 * middle + near * (0.22 * (fine - 0.5) + 0.20 * (grit - 0.5))) + grass * (0.16 * broad + 0.07 * middle);
    // grass: a soft mottle, with a few yellowed patches. the blades themselves are real
    col *= 1.0 + grass * near * (fine - 0.5) * 0.10;
    col = mix(col, col * vec3(1.10, 1.04, 0.86), grass * smoothstep(0.56, 0.85, noise(p * 0.3 + 7.0)));
    // sand: wind ripples and grains
    float ripple = sin(p.x * 7.0 + p.y * 2.5 + 5.0 * noise(p * 0.7));
    col *= 1.0 + sand * near * (0.07 * ripple + 0.22 * (noise(p * 38.0) - 0.5));
    // rock: soft layers up the cliffs, broad patches and a little speckle
    float layer = noise(vec2(vW.y * 1.7 + 1.2 * noise(p * 0.2), 3.0));
    float patchy = noise(p * 0.55 + vec2(vW.y * 0.45, 0.0));
    col *= 1.0 + rock * (0.24 * (layer - 0.5) + 0.26 * (patchy - 0.5) + near * 0.16 * (noise(vec2(p.x * 7.0, p.y * 7.0 + vW.y * 7.0)) - 0.5));
    // a bumpy surface for the light to catch
    vec2 e = vec2(0.09, 0.0);
    float h0 = noise(p * 2.6) + 0.4 * noise(p * 8.0);
    float hx = noise((p + e.xy) * 2.6) + 0.4 * noise((p + e.xy) * 8.0), hz = noise((p + e.yx) * 2.6) + 0.4 * noise((p + e.yx) * 8.0);
    N = normalize(N - vec3(hx - h0, 0.0, hz - h0) * (0.35 + 0.65 * rock) * (0.25 + 0.75 * near) * (1.0 - 0.85 * grass));
  } else if (uLow == 0) {
    float bark = step(col.g, col.r);                          // trunks and rocks are not greener than they are red
    float stony = bark * (1.0 - step(0.11, col.r - col.b));   // and of those, the greys are stone
    if (stony > 0.5) {
      // noise laid on from three sides, so it does not smear down the faces
      vec3 side = abs(N); side /= side.x + side.y + side.z;
      float blotch = noise(vW.yz * 2.2) * side.x + noise(vW.xz * 2.2) * side.y + noise(vW.xy * 2.2) * side.z;
      float speck = noise(vW.yz * 14.0) * side.x + noise(vW.xz * 14.0) * side.y + noise(vW.xy * 14.0) * side.z;
      col *= 0.78 + 0.38 * blotch + near * 0.24 * (speck - 0.5);
      col = mix(col, vec3(0.22, 0.29, 0.12), 0.65 * smoothstep(0.55, 0.9, N.y) * smoothstep(0.45, 0.7, noise(vW.xz * 1.3 + 4.0)));   // moss on top
    } else {
      float grain = noise(vec2((vW.x + vW.z) * 14.0, vW.y * 3.5));
      col *= mix(0.84 + 0.32 * noise(vW.xz * 3.0 + vW.y * 2.0), 0.70 + 0.62 * grain, bark);
    }
  }
  float sh;
  if (uLow == 1) {
    vec3 q = (uBakedLight * vec4(vW + N * 0.4, 1.0)).xyz * 0.5 + 0.5;
    vec2 d = 0.6 / vec2(textureSize(uBaked, 0));
    sh = 0.5 * (texture(uBaked, vec3(q.xy + d, q.z - 0.0012)) + texture(uBaked, vec3(q.xy - d, q.z - 0.0012)));
    vec3 m = (uLight * vec4(vW + N * 0.02, 1.0)).xyz * 0.5 + 0.5;
    if (m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0 && m.z < 1.0) sh = min(sh, texture(uShadow, vec3(m.xy, m.z - 0.0012)));
  } else sh = min(shadowAt(vW + N * 0.02), bakedShadow(vW + N * 0.22));
  float sun = max(dot(N, uSun), 0.0);
  vec3 sky = mix(vec3(0.42, 0.39, 0.34), vec3(0.54, 0.60, 0.72), N.y * 0.5 + 0.5);
  col *= sky * 0.95 + vec3(0.86, 0.80, 0.66) * sun * sh;
  col += flashLight(vW, vec3(0.0, 1.0, 0.0)) * col;
  o = vec4(fogged(col, vW), 1.0);
}`);
const seaProg = program(`layout(location=0) in vec3 aPos; uniform mat4 uViewProj; out vec3 vW;
void main() { vW = aPos; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec3 vW; out vec4 o;
uniform float uTime;
uniform vec2 uMouths[4];
${COMMON}
${FOG}
float bulge(float a, float at, float wide) { float q = sin((a - at) / 2.0) / wide; return exp(-q * q); }
void main() {
  float a = atan(vW.x, vW.z);
  float past = length(vW.xz) - 4.0 * (105.0 + 13.0 * sin(3.0 * a + 1.1) + 9.0 * sin(5.0 * a + 2.6) + 4.0 * sin(11.0 * a) + 3.0 * sin(19.0 * a + 0.7)
    - 34.0 * bulge(a, 0.75, 0.11) + 28.0 * bulge(a, -2.3, 0.09));
  float wave = sin(vW.x * 0.9 + uTime * 1.4) * sin(vW.z * 0.7 - uTime * 1.1) + 0.5 * sin((vW.x + vW.z) * 2.1 + uTime * 2.3);
  float mouth = 0.0;                                        // 1 where a river runs into the sea
  for (int i = 0; i < 4; i++) mouth = max(mouth, 1.0 - smoothstep(16.0, 34.0, length(vW.xz - uMouths[i])));
  float from = mix(1.0, -26.0, mouth), to = mix(16.0, 40.0, mouth);
  vec3 col = mix(vec3(0.22, 0.62, 0.66), vec3(0.04, 0.24, 0.42), smoothstep(from, to, past)) + 0.035 * wave;
  float foam = 1.0 - smoothstep(0.2, 0.9, abs(past - 1.5 - 0.35 * sin(uTime * 1.6 + a * 40.0)));
  col = mix(col, vec3(0.93, 0.97, 0.98), foam * 0.75 * (1.0 - mouth));
  o = vec4(fogged(col, vW), mix(0.62, 1.0, smoothstep(from, mix(12.0, 30.0, mouth), past)));
}`);

const SAND = [0.80, 0.70, 0.47], GRASS = [0.31, 0.45, 0.20], LUSH = [0.17, 0.33, 0.13], DRY = [0.45, 0.46, 0.21], DIRT = [0.52, 0.40, 0.25], ROCK = [0.40, 0.36, 0.31], PEAK = [0.66, 0.63, 0.58], DEEP = [0.30, 0.34, 0.27];
function groundColour(x, z, h, up) {
  let col = V.lerp(GRASS, LUSH, smooth(-0.1, 0.2, roll(x, z, 29)));
  col = V.lerp(col, DRY, smooth(0.08, 0.28, roll(x + 90, z, 23)));
  col = V.lerp(SAND, col, smooth(0.7, 1.5, h));
  col = V.lerp(col, DIRT, smooth(7, 4, Math.min(pathDistance(x, z, GORGE), pathDistance(x, z, CANYON))));
  const ash = Math.hypot(x - SPOTS.volcano[0], z - SPOTS.volcano[1]);
  col = V.lerp(col, [0.20, 0.17, 0.15], smooth(80, 45, ash + roll(x, z, 9) * 14) * smooth(8, 16, h));     // dark rock up the volcano
  col = V.lerp(col, ROCK, Math.max(smooth(0.17, 0.30, 1 - up), smooth(17, 21, h)));
  col = V.lerp(col, PEAK, smooth(24, 28, h) * smooth(60, 90, Math.hypot(x - SPOTS.volcano[0], z - SPOTS.volcano[1])));
  for (const q of HOUSES) if (Math.abs(x - q.x) < 11 && Math.abs(z - q.z) < 11) col = V.lerp(col, DIRT, smooth(9.5, 4, Math.hypot(x - q.x, z - q.z) + roll(x, z, 4) * 3) * 0.85);
  return V.lerp(col, DEEP, smooth(0, 0.8, -h));
}
// the grid as a mesh
const land = (() => {
  const n = GRID.n, row = n + 1, v = [], idx = [];
  const at = (i, j) => heights[clamp(j, 0, n) * row + clamp(i, 0, n)];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const h = at(i, j), nrm = V.norm([at(i - 1, j) - at(i + 1, j), 2 * GRID.cell, at(i, j - 1) - at(i, j + 1)]);
    const x = i * GRID.cell - GRID.half, z = j * GRID.cell - GRID.half;
    const col = groundColour(x, z, h, nrm[1]);
    v.push(x, h, z, ...col, ...nrm);
  }
  const PIECE = 50, pieces = [];
  for (let pj = 0; pj < n; pj += PIECE) for (let pi = 0; pi < n; pi += PIECE) {
    const from = idx.length;
    for (let j = pj; j < Math.min(n, pj + PIECE); j++) for (let i = pi; i < Math.min(n, pi + PIECE); i++) {
      const k = j * row + i;
      idx.push(k, k + row + 1, k + 1, k, k + row, k + row + 1);
    }
    pieces.push({ x: (pi + PIECE / 2) * GRID.cell - GRID.half, z: (pj + PIECE / 2) * GRID.cell - GRID.half, from, count: idx.length - from });
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array(v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length, pieces, reach: PIECE * GRID.cell * 0.75 };
})();
// ---------------------------------------------------------------- trees, bushes, rocks and grass
const solids = [], leaves = [];                              // what you bump into, what the camera avoids
// built in square patches, so only the ones in view get drawn
const PATCH = 44;
// what stands where is decided once. the shapes are only made for the patches you come near, in a
// full version close by and a light one further off
function buildFlora() {
  const patches = new Map(), first = !solids.length;
  let cur = null, seed = 1, low = false;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const patch = (x, z) => {
    const i = Math.floor((x + GRID.half) / PATCH), j = Math.floor((z + GRID.half) / PATCH), key = i * 100 + j;
    if (!patches.has(key)) patches.set(key, { x: (i + 0.5) * PATCH - GRID.half, z: (j + 0.5) * PATCH - GRID.half, big: { v: [], i: [] }, jobs: [], mesh: [null, null] });
    return patches.get(key);
  };
  const vert = (m, p, col, n) => { m.v.push(p[0], p[1], p[2], col[0], col[1], col[2], n[0], n[1], n[2]); };
  const add = (mesh, at, col, R) => {                        // mesh: pos, normal, uv from the mesh helpers
    const m = cur.big, base = m.v.length / 9;
    for (let k = 0; k < mesh.v.length; k += 8) {
      let p = [mesh.v[k], mesh.v[k + 1], mesh.v[k + 2]], n = [mesh.v[k + 3], mesh.v[k + 4], mesh.v[k + 5]];
      if (R) { p = M3.vec(R, p); n = M3.vec(R, n); }
      vert(m, V.add(at, p), col, n);
    }
    for (const i of mesh.i) m.i.push(base + i);
  };
  // a tapering limb from a to b
  const limb = (a, b, r0, r1, col, sides) => {
    const m = cur.big, base = m.v.length / 9, n = low ? 5 : sides || 7;
    const y = V.norm(V.sub(b, a)), x = V.norm(V.cross(y, Math.abs(y[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])), z = V.cross(x, y);
    for (let k = 0; k <= n; k++) {
      const t = k / n * Math.PI * 2, d = V.add(V.mul(x, Math.cos(t)), V.mul(z, Math.sin(t)));
      vert(m, V.mad(a, d, r0), col, d); vert(m, V.mad(b, d, r1), col, d);
    }
    for (let k = 0; k < n; k++) { const q = base + k * 2; m.i.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
  };
  // a single pointed leaf: it starts at `from`, runs along `along` and is as wide as `side`
  const leaf = (from, along, side, col, nrm) => {
    const m = cur.big, base = m.v.length / 9, mid = V.mad(from, along, 0.45);
    for (const p of [from, V.add(mid, side), V.add(from, along), V.sub(mid, side)]) vert(m, p, col, nrm);
    m.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const anyway = () => V.norm([rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]);
  const shadeOf = (col, k) => [col[0] * k, col[1] * k, col[2] * k];
  // a ball of leaves with a darker heart, ragged round the edge
  const clump = (c, r, count, size, col) => {
    add(blob(r * 0.58, r * 0.48, r * 0.58, [0, 0, 0], 0.5, 6), c, shadeOf(col, 0.6));
    if (low) { count = Math.ceil(count / 3); size *= 1.45; }
    for (let k = 0; k < count; k++) {
      const d = anyway(), at = V.add(c, [d[0] * r * rnd(0.6, 1.02), d[1] * r * 0.8 * rnd(0.6, 1.02), d[2] * r * rnd(0.6, 1.02)]);
      const along = V.norm(V.add(anyway(), V.mul(d, 0.7))), side = V.norm(V.cross(along, anyway()));
      leaf(at, V.mul(along, size * rnd(0.8, 1.3)), V.mul(side, size * 0.34), shadeOf(col, rnd(0.8, 1.3) * (0.92 + 0.18 * d[1])), V.norm(V.add(d, [0, 0.35, 0])));
    }
  };
  const BARK = [0.27, 0.17, 0.10], PALM = [0.46, 0.34, 0.19];

  const leafy = (at, s, shade) => {
    const up = (x, y, z) => V.add(at, [x * s, y * s, z * s]), col = [0.15 + shade * 0.10, 0.37 + shade * 0.09, 0.09];
    const bend = [rnd(-0.25, 0.25), rnd(-0.25, 0.25)];
    limb(up(0, 0, 0), up(0, 0.55, 0), 0.52 * s, 0.31 * s, BARK, 9);
    limb(up(0, 0.55, 0), up(bend[0], 2.5, bend[1]), 0.31 * s, 0.24 * s, BARK, 9);
    limb(up(bend[0], 2.5, bend[1]), up(0, 4.3, 0), 0.24 * s, 0.13 * s, BARK);
    for (let k = 0; k < (low ? 0 : 4); k++) {                 // roots
      const a = k * 1.6 + rnd(0, 0.7);
      limb(up(0, 0.4, 0), up(Math.cos(a) * 0.75, -0.05, Math.sin(a) * 0.75), 0.17 * s, 0.03 * s, BARK, 5);
    }
    const start = rnd(0, 6.3);
    for (let k = 0; k < 5; k++) {                             // boughs, each carrying its own leaves
      const a = start + k * 1.26 + rnd(-0.25, 0.25), reach = rnd(1.1, 1.8), high = rnd(3.7, 5.0), from = up(bend[0] * 0.8, rnd(2.4, 3.4), bend[1] * 0.8);
      const knee = up(Math.cos(a) * reach * 0.55, high - 0.65, Math.sin(a) * reach * 0.55), end = up(Math.cos(a) * reach, high, Math.sin(a) * reach);
      limb(from, knee, 0.13 * s, 0.09 * s, BARK, 5); limb(knee, end, 0.09 * s, 0.03 * s, BARK, 5);
      clump(end, rnd(0.8, 1.1) * s, 48, 0.42 * s, col);
    }
    clump(up(0, 5.2, 0), 1.3 * s, 75, 0.42 * s, col);
  };

  const pine = (at, s, shade) => {
    const up = (x, y, z) => V.add(at, [x * s, y * s, z * s]), col = [0.07 + shade * 0.05, 0.25 + shade * 0.09, 0.13];
    limb(up(0, 0, 0), up(0, 0.5, 0), 0.42 * s, 0.27 * s, BARK, 8);
    limb(up(0, 0.5, 0), up(0, 8.25, 0), 0.27 * s, 0.03 * s, BARK, 8);
    const TIERS = low ? 7 : 10;
    for (let t = 0; t < TIERS; t++) {
      const u = t / TIERS, y = 3.1 + t * 5.2 / TIERS, reach = 2.2 * (1 - u * 0.82) * rnd(0.9, 1.1), turn = rnd(0, 6.3), arms = low ? 6 : 9;
      for (let k = 0; k < arms; k++) {
        const a = turn + k * Math.PI * 2 / arms + rnd(-0.18, 0.18), out = [Math.cos(a), 0, Math.sin(a)], across = [-out[2], 0, out[0]];
        const len = reach * rnd(0.78, 1.12), drop = rnd(0.25, 0.5), from = up(0, y + rnd(-0.1, 0.1), 0);
        const nrm = V.norm([out[0] * 0.55, 0.85, out[2] * 0.55]), tip = shadeOf(col, rnd(0.85, 1.3));
        leaf(from, V.mul([out[0], -drop, out[2]], len * s), V.mul(across, len * (low ? 0.42 : 0.17) * s), tip, nrm);
        for (const side of [-1, 1]) for (const v of low ? [] : [0.28, 0.55]) {       // needles off each side of the bough
          const root = V.add(from, V.mul([out[0], -drop, out[2]], len * v * s));
          const dir = V.norm([out[0] + across[0] * side * 0.9, -drop - 0.15, out[2] + across[2] * side * 0.9]);
          leaf(root, V.mul(dir, len * 0.42 * s), V.mul(V.norm(V.cross(dir, [0, 1, 0])), len * 0.07 * s), shadeOf(tip, 0.9), nrm);
        }
      }
    }
    for (let k = 0; k < 6; k++) leaf(up(0, 7.95, 0), V.mul([Math.cos(k) * 0.28, 0.75, Math.sin(k) * 0.28], s), V.mul([-Math.sin(k), 0, Math.cos(k)], 0.1 * s), col, V.norm([Math.cos(k), 0.6, Math.sin(k)]));
  };

  const palm = (at, s, turn) => {
    const R = M3.ry(turn), lean = rnd(0.7, 1.5), h = rnd(4.4, 5.4);
    const spine = u => V.add(at, M3.vec(R, [lean * u * u * s, h * u * s, 0]));
    const SEGS = low ? 5 : 11;
    for (let k = 0; k < SEGS; k++) {                          // ringed trunk, each ring flaring at the top
      const r = (0.25 - 0.11 * k / SEGS) * s;
      limb(spine(k / SEGS), spine((k + 1) / SEGS), r * 0.88, r * 1.13, shadeOf(PALM, k % 2 ? 1.08 : 0.9), 8);
    }
    const top = spine(1);
    for (let f = 0; f < 10; f++) {
      const a = turn + f * Math.PI * 0.2 + rnd(-0.2, 0.2), rise = f % 2 ? rnd(0.5, 0.9) : rnd(0.0, 0.4), len = rnd(2.4, 3.1) * s;
      const out = [Math.cos(a), 0, Math.sin(a)], across = [-out[2], 0, out[0]], col = [0.14, rnd(0.36, 0.50), 0.09];
      const at_ = u => V.add(top, [out[0] * len * u, len * (rise * u - 0.95 * u * u), out[2] * len * u]);
      const parts = low ? 6 : 9;
      for (let k = 0; k < parts; k++) {
        const u = k / parts, here = at_(u), next = at_(u + 1 / parts), ahead = V.norm(V.sub(next, here));
        limb(here, next, 0.035 * s * (1 - u * 0.7), 0.035 * s * (1 - (u + 1 / parts) * 0.7), [0.30, 0.40, 0.10], 4);
        const wide = (0.9 - 0.5 * u) * s;
        for (const side of [-1, 1]) {
          const dir = V.norm(V.add(V.mul(across, side), V.add(V.mul(ahead, 0.75), [0, -0.35, 0])));
          leaf(here, V.mul(dir, wide), V.mul(ahead, (low ? 0.27 : 0.17) * s), shadeOf(col, rnd(0.85, 1.2)), V.norm([out[0] * 0.3, 1, out[2] * 0.3]));
        }
      }
    }
    for (let k = 0; k < 4; k++) add(blob(0.15 * s, 0.17 * s, 0.15 * s, [0, 0, 0], 0.1, 6), V.add(top, [Math.cos(k * 1.7) * 0.2 * s, -0.22 * s, Math.sin(k * 1.7) * 0.2 * s]), [0.24, 0.15, 0.06]);
  };

  const bush = (at, s, shade) => {
    const col = [0.17 + shade * 0.12, 0.34 + shade * 0.12, 0.08];
    for (let k = 0; k < (low ? 2 : 3); k++) clump(V.add(at, [rnd(-0.45, 0.45) * s, rnd(0.25, 0.5) * s, rnd(-0.45, 0.45) * s]), rnd(0.35, 0.55) * s, 32, 0.2 * s, col);
  };
  // a ball of triangles, each corner split in four `depth` times
  const ball = depth => {
    const t = (1 + Math.sqrt(5)) / 2;
    const pts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(V.norm);
    let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]].map(f => f.map(i => pts[i]));
    for (let d = 0; d < depth; d++) faces = faces.flatMap(([a, b, c]) => {
      const ab = V.norm(V.add(a, b)), bc = V.norm(V.add(b, c)), ca = V.norm(V.add(c, a));
      return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
    });
    return faces;
  };
  // one stone: every corner pushed in or out by its own amount, then broken off flat on a few sides
  const stone = (at, size, col, depth, stretch) => {
    const [fx, fy, fz] = stretch || [1, 1, 1];
    const cuts = Array.from({ length: 8 }, () => ({ n: anyway(), k: rnd(0.45, 0.85) }));
    const turn = M3.ry(rnd(0, 6.3)), wide = rnd(0.9, 1.35), tall = rnd(0.65, 1.05), lean = rnd(-0.35, 0.35), corners = new Map();
    const carve = d => {
      const key = d.map(v => v.toFixed(3)).join();         // faces that share a corner must agree on it
      if (!corners.has(key)) {
        let q = V.mul(d, rnd(0.72, 1.38));
        for (const c of cuts) { const over = V.dot(q, c.n) - c.k; if (over > 0) q = V.mad(q, c.n, -over); }
        corners.set(key, V.add(at, M3.vec(turn, [(q[0] + q[1] * lean) * size * wide * fx, (q[1] * tall + 0.28) * size * fy, q[2] * size * fz])));
      }
      return corners.get(key);
    };
    const m = cur.big;
    const tris = [];
    for (const face of ball(depth)) {
      const pts = face.map(carve);
      let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
      if (V.dot(n, M3.vec(turn, face[0])) < 0) n = V.mul(n, -1);
      const base = m.v.length / 9, tone = shadeOf(col, rnd(0.86, 1.14));
      for (const q of pts) vert(m, q, tone, n);
      tris.push(pts);
      m.i.push(base, base + 1, base + 2);
    }
    return { tris };
  };
  const boulder = (at, s, shade) => {
    const grey = 0.36 + shade * 0.10, col = [grey + 0.02, grey, grey - 0.035];
    const parts = [stone(at, s * 0.95, col, s > 0.8 ? 2 : 1)];
    if (s > 0.8) {                                            // big ones are a heap: a slab leaning on the main lump
      const a = rnd(0, 6.3);
      parts.push(stone(V.add(at, [Math.cos(a) * s * 0.65, 0, Math.sin(a) * s * 0.65]), s * rnd(0.5, 0.65), shadeOf(col, rnd(0.88, 1.08)), 1));
    }
    for (let k = 0; k < (low ? 2 : 4); k++) {                 // broken bits round the foot
      const a = rnd(0, 6.3), r = s * rnd(0.08, 0.18);
      const far = s * rnd(1.05, 1.5), x = at[0] + Math.cos(a) * far, z = at[2] + Math.sin(a) * far;
      stone([x, groundHeight(x, z) - r * 0.25, z], r, shadeOf(col, rnd(0.85, 1.1)), 0);        // each on its own patch of ground
    }
    return parts;                                            // the parts big enough to bump into
  };

  // one chance every few metres, nudged about; woods grow where the noise says so
  const STEP = 6.2, ACROSS = Math.ceil(GRID.half / STEP);
  for (let i = -ACROSS; i <= ACROSS; i++) for (let j = -ACROSS; j <= ACROSS; j++) {
    const r = k => bump(i * 3 + k * 17, j * 5 - k * 11);
    const x = (i + r(1) - 0.5) * STEP, z = (j + r(2) - 0.5) * STEP;
    if (Math.hypot(x, z) > GRID.half) continue;
    const e = pastCoast(x, z);
    if (e > -4 || Math.hypot(x, z) < 17 || pathDistance(x, z, GORGE) < 5 || pathDistance(x, z, CANYON) < 6) continue;
    if (riverDistance(x, z) < RIVER.bank + 1 || nearBridge(x, z, 4) || caveClear(x, z) || nearHouse(x, z, 11)) continue;
    if (Object.values(SPOTS).some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)) continue;
    const y = groundHeight(x, z), slope = Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y), s = 0.75 + r(3) * 0.6, at = [x, y - 0.15, z];
    const woods = roll(x - 50, z + 30, 31);
    const here = patch(x, z), start = 1 + Math.floor(r(8) * 2147483000);
    const later = make => here.jobs.push([start, make]);      // built when someone gets close
    if (e > -26 && y < 3) {
      if (r(4) < 0.2) { const turn = r(5) * 6.3; later(() => palm(at, s, turn)); if (first) solids.push({ x, z, y, r: 0.24 * s, h: 2.2 * s }); }
    } else if (slope < 0.8 && y < 20 && r(4) < (woods > 0.04 ? 0.7 : 0.05)) {
      const kind = woods > 0.17 || y > 9 ? pine : leafy, shade = r(5);
      later(() => kind(at, s, shade));
      if (first) { solids.push({ x, z, y, r: 0.3 * s, h: 3.5 * s }); leaves.push([x, y + 4.4 * s, z, 1.9 * s]); }
    } else if (r(6) < (y > 12 || slope > 0.8 ? 0.2 : 0.07)) {
      const size = 0.35 + r(7) ** 2 * 1.9;
      const base = y - 0.1 - Math.min(slope, 1) * size * 0.6;                         // sunk in, so none hang off a slope
      const spot = [x, base, z], shade = r(5);
      later(() => boulder(spot, size, shade));
      // its real shape is needed now, for walking into
      if (first) { cur = { big: { v: [], i: [] } }; seed = start; low = false; addShape(boulder(spot, size, shade).flatMap(part => part.tris), y); }
    } else if (slope < 0.7 && y < 16 && r(6) < (woods > 0 ? 0.5 : 0.17)) { const shade = r(5); later(() => bush(at, s, shade)); }
  }

  buildPlaces({ rnd, patch, add, limb, stone, boulder, leafy, pine, palm, clump, shadeOf, first, use: (p, k) => { cur = p; seed = 1 + k * 7919; } });
  const upload = m => {
    if (!m.i.length) return { count: 0 };
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const points = buffer(gl.ARRAY_BUFFER, new Float32Array(m.v));
    attrib(0, null, 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
    const order = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.i));
    gl.bindVertexArray(null);
    return { vao, count: m.i.length, points, order };
  };
  // make one patch's shapes: the landmarks standing in it, then each tree, rock and bush
  const realize = (p, light) => {
    const m = { v: p.big.v.slice(), i: p.big.i.slice() };
    cur = { big: m }; low = !!light;
    for (const [start, make] of p.jobs) { seed = start; make(); }
    p.mesh[light] = upload(m);
  };
  return { list: [...patches.values()], realize };
}
let plants = null, flora = [];
const treeWork = { prime: false, built: 0 };
function loadFlora() {
  if (!plants) plants = buildFlora();
  flora = plants.list;
  treeWork.prime = true;
}
// make what is needed, a little each frame, and let go of detail far behind
function growFlora(eye, wanted) {
  let budget = treeWork.prime ? Infinity : 5;
  treeWork.prime = false;
  wanted.sort((a, b) => a[0] - b[0]);
  for (const [d, p] of wanted) {
    const light = world.low || d > 95 ? 1 : 0;
    if (!p.mesh[light] && budget > 0) { plants.realize(p, light); budget -= light ? 1 : 3; treeWork.built++; }
  }
  for (const p of flora) {
    const full = p.mesh[0];
    if (full && Math.hypot(p.x - eye[0], p.z - eye[2]) > 190) {
      if (full.count) { gl.deleteVertexArray(full.vao); gl.deleteBuffer(full.points); gl.deleteBuffer(full.order); }
      p.mesh[0] = null;
    }
  }
}
const meshOf = (p, d) => (world.low || d > 95 ? p.mesh[1] || p.mesh[0] : p.mesh[0] || p.mesh[1]);

// ---------------------------------------------------------------- grass
const TURF = 18, turf = new Map();                           // square patches of grass, made when you come near
let grassNow = false;
const grassHere = (x, z) => {
  const y = groundHeight(x, z);
  if (houseAt(x, z, 0.7) || y < 1.4 || y > 18 || pastCoast(x, z) > -6 || pathDistance(x, z, GORGE) < 7 || pathDistance(x, z, CANYON) < 8 || riverDistance(x, z) < RIVER.bank || nearBridge(x, z, 0.5) || CAVES.some(c => Math.abs(x - c.x) < CAVE.room + 1 && c.z - z > -0.5 && c.z - z < 4)) return null;
  return Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y) > 0.6 ? null : y;
};
function growTurf(ti, tj, low) {
  const v = [], idx = [];
  let seed = 1;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const vert = (p, col) => v.push(p[0], p[1], p[2], col[0], col[1], col[2], 0, 1, 0);
  // one blade: two bends, narrowing to a point, darker at the root
  const blade = (x, y, z, a, tall, wide, lean, col) => {
    const base = v.length / 9, cx = Math.cos(a), cz = Math.sin(a);
    const root = [col[0] * 0.8, col[1] * 0.85, col[2] * 0.8], mid = [col[0] * 1.05, col[1] * 1.15, col[2]], tip = [col[0] * 1.3, col[1] * 1.45, col[2] * 1.1];
    for (const [u, w, c] of [[0, 1, root], [0.55, 0.72, mid]]) {
      const out = lean * u * u, px = x + cx * out, pz = z + cz * out, py = y + tall * u;
      vert([px + cz * wide * w, py, pz - cx * wide * w], c);
      vert([px - cz * wide * w, py, pz + cx * wide * w], c);
    }
    vert([x + cx * lean, y + tall * 0.9, z + cz * lean], tip);
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
  };
  const sow = (cell, salt, chance, count, spread, height, wide) => {
    const first = v => Math.ceil(v * TURF / cell), last = v => Math.ceil((v + 1) * TURF / cell);
    for (let i = first(ti); i < last(ti); i++) for (let j = first(tj); j < last(tj); j++) {
      seed = 1 + Math.floor(bump(i * 7 + salt, j * 3 - salt) * 2147483000);
      const x = (i + rnd(-0.5, 0.5)) * cell, z = (j + rnd(-0.5, 0.5)) * cell;
      if (rnd(0, 1) > chance) continue;
      const y = grassHere(x, z);
      if (y === null) continue;
      const col = groundColour(x, z, y, 1), tall = rnd(height[0], height[1]);
      for (let k = 0; k < count; k++) {
        const a = rnd(0, 6.3), d = Math.sqrt(rnd(0, 1)) * spread, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
        // blades fan out from the middle, the outer ones leaning further
        blade(bx, groundHeight(bx, bz) - 0.03, bz, a + rnd(-0.7, 0.7), tall * rnd(0.55, 1.15), wide, tall * rnd(0.15, 0.4) + d * 0.35, col);
      }
    }
  };
  if (low) sow(2.5, 53, 0.55, 16, 0.34, [0.28, 0.55], 0.032);
  else {
    sow(1.0, 11, 0.85, 7, 0.24, [0.13, 0.27], 0.022);
    sow(1.9, 53, 0.65, 30, 0.34, [0.32, 0.62], 0.028);
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const points = buffer(gl.ARRAY_BUFFER, new Float32Array(v));
  attrib(0, null, 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  const order = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length, points, order };
}
function drawGrass(eye) {
  const low = world.low, far = (low ? 26 : 52), reach = Math.ceil(far / TURF) + 1;
  const ci = Math.floor(eye[0] / TURF), cj = Math.floor(eye[2] / TURF), wanted = [];
  for (let i = ci - reach; i <= ci + reach; i++) for (let j = cj - reach; j <= cj + reach; j++) {
    const d = Math.hypot((i + 0.5) * TURF - eye[0], (j + 0.5) * TURF - eye[2]);
    if (d < far + TURF * 0.6) wanted.push([d, i, j, (low ? 'low ' : '') + i + ' ' + j]);
  }
  wanted.sort((a, b) => a[0] - b[0]);
  let budget = grassNow ? Infinity : 1;                      // one new patch a frame, so walking stays smooth
  grassNow = false;
  for (const [, i, j, key] of wanted) {
    let t = turf.get(key);
    if (!t) { if (budget <= 0) continue; budget--; t = growTurf(i, j, low); }
    else turf.delete(key);
    turf.set(key, t);                                        // newest last
    drawPart(t);
  }
  while (turf.size > 90) {
    const [key, t] = turf.entries().next().value;
    gl.deleteVertexArray(t.vao); gl.deleteBuffer(t.points); gl.deleteBuffer(t.order); turf.delete(key);
  }
}
const drawPart = m => { if (m.count) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); } };
// moving shadows only cover the ground round you, so only the patches there are needed
function drawFloraShadow(light, eye) {
  globals(staticDepth, light, light, eye);
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  drawCaveShadow();                                          // in both versions: it keeps the sun out
  if (world.low) return;
  drawBridgeShadow();
  drawHouseShadow(player.pos, 30);
  for (const p of flora) if (Math.hypot(p.x - player.pos[0], p.z - player.pos[2]) < PATCH * 0.75 + 16) { const m = meshOf(p, 0); if (m) drawPart(m); }
}

// ---------------------------------------------------------------- the long shadows
// nothing on the island moves, so these are drawn for the ground round you and only redone as you travel
const baked = [];
const REACH = 190;
function bakeShadows(shade, at) {
  if (!shade) {
    const SIZE = Math.min(world.low ? 2048 : 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SIZE, SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0); gl.drawBuffers([gl.NONE]);
    shade = { tex, fbo, size: SIZE };
  }
  const centre = [at[0], 0, at[2]];
  shade.light = mul4(ortho(REACH, REACH, 1, 500), lookAt(V.mad(centre, SUN, 250), centre));
  shade.at = centre; shade.built = treeWork.built; shade.time = game.time;
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shade.fbo);
  gl.viewport(0, 0, shade.size, shade.size); gl.clear(gl.DEPTH_BUFFER_BIT);
  globals(staticDepth, shade.light, shade.light, [0, 0, 0]);
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  gl.bindVertexArray(land.vao);
  for (const p of land.pieces) if (Math.hypot(p.x - at[0], p.z - at[2]) < REACH + land.reach) gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, p.from * 4);
  for (const p of flora) if (Math.hypot(p.x - at[0], p.z - at[2]) < REACH + PATCH) { const m = p.mesh[1] || p.mesh[0]; if (m) drawPart(m); }
  drawBridgeShadow();
  drawCaveShadow();
  drawHouseShadow(at, REACH);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  return shade;
}
function longShadows(eye) {
  const k = world.low ? 1 : 0, s = baked[k];
  const stale = !s || Math.hypot(eye[0] - s.at[0], eye[2] - s.at[2]) > 60 || (s.built !== treeWork.built && game.time - s.time > 0.8);
  if (stale) baked[k] = bakeShadows(s, eye);
  return baked[k];
}
const seaVao = (() => {
  const vao = gl.createVertexArray(), S = 2400, y = SEA.level; gl.bindVertexArray(vao);
  attrib(0, new Float32Array([-S, y, S, S, y, S, S, y, -S, -S, y, S, S, y, -S, -S, y, -S]), 3, gl.FLOAT);
  gl.bindVertexArray(null); return vao;
})();
const fogRange = () => FLY.on ? [450, 1400] : world.low ? [70, 200] : [90, 330];
let doorwayList = null;
const doorways = () => doorwayList || (doorwayList = new Float32Array(Array.from({ length: 12 }, (_, k) => {
  const c = CAVES[k];
  return c ? [c.x, c.z, c.base, c.depth] : [1e6, 1e6, 0, 0];
}).flat()));
function drawLand(vp, light, eye) {
  const k = world.low ? 1 : 0;
  // skip what is behind you, off to the side or lost in the haze
  const seen = (p, R) => {
    const x = vp[0] * p.x + vp[4] * 8 + vp[8] * p.z + vp[12], w = vp[3] * p.x + vp[7] * 8 + vp[11] * p.z + vp[15];
    return w > -R && Math.abs(x) <= Math.max(w, 0) + R * 2.5 && Math.hypot(p.x - eye[0], p.z - eye[2]) < fogRange()[1] + R;
  };
  const shown = [], wanted = [];
  for (const p of flora) {
    const d = Math.hypot(p.x - eye[0], p.z - eye[2]);
    if (d > fogRange()[1] + PATCH) continue;
    if (seen(p, PATCH * 0.75)) { shown.push([d, p]); wanted.push([d, p]); }
    else if (d < 110) wanted.push([d, p]);                    // behind you, but close enough to turn to
  }
  growFlora(eye, wanted);
  const shade = longShadows(eye);
  globals(landProg, vp, light, eye); gl.uniform3fv(landProg.u.uSky, SKY.island); gl.uniform2fv(landProg.u.uFog, fogRange());
  gl.uniform1i(landProg.u.uLow, k);
  gl.uniform1i(landProg.u.uBaked, 4); gl.uniformMatrix4fv(landProg.u.uBakedLight, false, shade.light);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, shade.tex);
  gl.uniform4fv(landProg.u.uCaves, doorways()); gl.uniform1i(landProg.u.uCut, 1);
  gl.uniform1i(landProg.u.uKind, 0); gl.bindVertexArray(land.vao);
  for (const p of land.pieces) if (seen(p, land.reach)) gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, p.from * 4);
  gl.uniform1i(landProg.u.uCut, 0);
  gl.uniform1i(landProg.u.uKind, 1);
  drawCaveCliffs();
  drawCaveTrim();
  for (const [d, p] of shown) { const m = meshOf(p, d); if (m) drawPart(m); }
  drawGrass(eye);
  drawSign(vp, light, eye);
  drawBridges(vp, light, eye);
  drawHouses(vp, light, eye);
  drawCaveInsides(vp, light, eye);
}
// after everything solid, so legs show through the water
function drawSea(vp, light, eye) {
  globals(seaProg, vp, light, eye); gl.uniform3fv(seaProg.u.uSky, SKY.island); gl.uniform2fv(seaProg.u.uFog, fogRange()); gl.uniform1f(seaProg.u.uTime, game.time); gl.uniform2fv(seaProg.u.uMouths, MOUTHS);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(seaVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
}

