// ======================================================================= the island (map in progress)
// the island, its hills, the ocean around it and water that hurts. no caves yet. T swaps maps for now
const world = { map: 'plate' };
// the land climbs from the beach to a meadow, hills and one mountain; past the coast it drops to the sea floor
const SEA = { level: -0.2, floor: -1.0, wade: 5, swim: 22, grace: 0.6, every: 0.5, bite: 8 };
const SKY = { plate: [219 / 255, 219 / 255, 219 / 255], island: [0.66, 0.80, 0.91] };
// how far the coast is from the middle, in each direction (the same formula is in the water shader)
const bulge = (a, at, wide) => Math.exp(-((Math.sin((a - at) / 2) / wide) ** 2));
const coast = a => 105 + 13 * Math.sin(3 * a + 1.1) + 9 * Math.sin(5 * a + 2.6) + 4 * Math.sin(11 * a) + 3 * Math.sin(19 * a + 0.7)
  - 34 * bulge(a, 0.75, 0.11) + 28 * bulge(a, -2.3, 0.09);      // a deep bay and a long headland
const pastCoast = (x, z) => Math.hypot(x, z) - coast(Math.atan2(x, z));
const MEADOW = 2.0;                                          // the flat clearing you start in
// x, z, height, radius of the smaller hills
const HILLS = [[58, 42, 9, 24], [55, -22, 8, 22], [-45, -55, 10, 24], [-8, 88, 6, 18], [82, -48, 7, 20], [-88, -22, 6, 18]];
const PEAK_AT = [12, -66], MESA_AT = [-62, 14];
const GORGE = [[-52, 50], [-22, 40], [6, 56], [34, 47], [62, 62]];   // a winding pass with rock walls
const bump = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
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
function shape(x, z) {
  const e = pastCoast(x, z);
  if (e >= 0) return SEA.floor * clamp(e / SEA.wade, 0, 1);
  // rolling ground at three sizes
  let h = MEADOW + 1.2 + roll(x, z, 37) * 5 + roll(x + 40, z, 16) * 2.4 + roll(x, z + 70, 6) * 0.6;
  for (const [hx, hz, top, r] of HILLS) {
    const d = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
    if (d < 1) h += top * (1 - d) * (1 - d) * (1 + roll(x, z, 9) * 0.5);
  }
  // the mountain: spurs and gullies running down from the summit
  const mx = x - PEAK_AT[0], mz = z - PEAK_AT[1], m = Math.hypot(mx, mz) / 54;
  if (m < 1) {
    const spur = Math.abs(Math.sin(Math.atan2(mx, mz) * 3.5 + roll(x, z, 21) * 3));
    h += 27 * (1 - m) ** 1.6 * (0.72 + 0.4 * (0.5 + (spur - 0.5) * smooth(0, 0.35, m))) + roll(x, z, 8) * 4 * (1 - m);
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

  h = MEADOW + (h - MEADOW) * smooth(12, 27, Math.hypot(x, z));
  return Math.max(0, h) * smooth(0, 20, -e);
}
// heights on a grid: the drawn land and your feet read the same numbers
const GRID = { half: 175, n: 300 };
GRID.cell = GRID.half * 2 / GRID.n;
const heights = new Float32Array((GRID.n + 1) * (GRID.n + 1));
for (let j = 0; j <= GRID.n; j++) for (let i = 0; i <= GRID.n; i++) heights[j * (GRID.n + 1) + i] = shape(i * GRID.cell - GRID.half, j * GRID.cell - GRID.half);

function groundAt(x, z) {
  if (world.map !== 'island') return 0;
  const u = (x + GRID.half) / GRID.cell, v = (z + GRID.half) / GRID.cell;
  if (u < 0 || v < 0 || u >= GRID.n || v >= GRID.n) return SEA.floor;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * (GRID.n + 1) + i;
  const h00 = heights[k], h10 = heights[k + 1], h01 = heights[k + GRID.n + 1], h11 = heights[k + GRID.n + 2];
  // the same two triangles per square as the mesh
  return a > b ? h00 + (h10 - h00) * a + (h11 - h10) * b : h00 + (h11 - h01) * a + (h01 - h00) * b;
}
const inSea = p => groundAt(p[0], p[2]) < SEA.level;
// what loose things come to rest on
const floorAt = (x, z) => world.map === 'island' ? Math.max(groundAt(x, z), SEA.level) : 0;

// keeps a fighter on the map: bots stay on land, you can wade out a bit further
function confine(f) {
  const p = f.pos;
  if (world.map !== 'island') {
    p[0] = clamp(p[0], -HALF + 0.6, HALF - 0.6); p[2] = clamp(p[2], -HALF + 0.6, HALF - 0.6);
    return;
  }
  for (const o of solids) if (Math.abs(p[0] - o.x) < 3 && Math.abs(p[2] - o.z) < 3) push(f, [o.x, 0, o.z], o.r + 0.28);
  const d = Math.hypot(p[0], p[2]), max = coast(Math.atan2(p[0], p[2])) + (f.isPlayer ? SEA.swim : -1.5);
  if (d > max) { p[0] *= max / d; p[2] *= max / d; }
}
// cliffs: a step that climbs or drops too sharply is refused, sliding along the face if it can
const STEEP = 1.3;
function cliffs(f, x0, z0) {
  if (world.map !== 'island') return;
  const sheer = (x, z) => {
    const d = Math.hypot(x - x0, z - z0);
    if (d < 1e-5) return false;
    // look a little ahead, so a single frame's tiny step cannot creep up a face
    const k = Math.max(1, 0.5 / d), y = groundAt(x0 + (x - x0) * k, z0 + (z - z0) * k);
    return Math.abs(y - groundAt(x0, z0)) > STEEP * d * k;
  };
  const p = f.pos;
  if (!sheer(p[0], p[2])) return;
  if (!sheer(p[0], z0)) p[2] = z0;
  else if (!sheer(x0, p[2])) p[0] = x0;
  else { p[0] = x0; p[2] = z0; }
}

// distance to the first trunk or boulder on the ray, or Infinity
function solidHit(origin, dir) {
  const a = dir[0] * dir[0] + dir[2] * dir[2];
  let best = Infinity;
  if (a < 1e-6) return best;
  for (const o of solids) {
    const x = origin[0] - o.x, z = origin[2] - o.z, b = x * dir[0] + z * dir[2], disc = b * b - a * (x * x + z * z - o.r * o.r);
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / a, y = origin[1] + dir[1] * t;
    if (t > 0 && t < best && y > o.y - 0.3 && y < o.y + o.h) best = t;
  }
  return best;
}
// where a ray meets the ground, the sea, a tree or a rock, or null
function surfaceHit(origin, dir) {
  if (world.map !== 'island') {
    if (dir[1] >= -1e-4) return null;
    const t = -origin[1] / dir[1], p = V.mad(origin, dir, t);
    return Math.abs(p[0]) < HALF && Math.abs(p[2]) < HALF ? { t, kind: 'ground' } : null;
  }
  const solid = solidHit(origin, dir);
  const under = t => origin[1] + dir[1] * t < floorAt(origin[0] + dir[0] * t, origin[2] + dir[2] * t);
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
    if (p[1] < floorAt(p[0], p[2]) + 0.2 || leaves.some(c => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < c[3])) return Math.max(0.4, d - 0.2);
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
  else { f.pos[1] = SEA.level - 0.15; knockOut(f, 'The sea got you'); }
}

// ---------------------------------------------------------------- swapping maps
function setMap(name) {
  abortLoot(); endSend(player);
  world.map = name;
  for (const q of pops) q.el.remove();
  for (const list of [pops, props, stars, particles, tracers, shells, flashes, marks]) list.length = 0;
  for (const c of chests) { c.t = -1; c.open = c.openV = c.wobble = 0; c.forced = false; c.pos[1] = groundAt(c.pos[0], c.pos[2]); }
  player.yaw = Math.PI; cam.yaw = 0; cam.pitch = 0.12;
  player.hurt = 0; player.wet = 0; player.reload = -1; player.cycle = -1; game.hurtFade = 0;
  respawnPlayer();
  notify(name === 'island' ? 'The island (work in progress). T to go back' : 'Back on the baseplate');
}

// ---------------------------------------------------------------- drawing the island
const FOG = `
uniform vec3 uSky;
vec3 fogged(vec3 col, vec3 w) { return mix(col, uSky, smoothstep(90.0, 420.0, length(w - uEye))); }`;
const landProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aCol; layout(location=2) in vec3 aNrm; uniform mat4 uViewProj; out vec3 vW; out vec3 vC; out vec3 vN;
void main() { vW = aPos; vC = aCol; vN = aNrm; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec3 vW; in vec3 vC; in vec3 vN; out vec4 o;
${COMMON}
${FOG}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec3 col = vC * (0.86 + 0.18 * noise(vW.xz * 1.7) + 0.12 * noise(vW.xz * 0.23));
  vec3 N = normalize(vN);
  col *= (0.50 + 0.65 * max(dot(N, uSun), 0.0)) * mix(0.56, 1.0, shadowAt(vW));
  col += flashLight(vW, vec3(0.0, 1.0, 0.0)) * 0.35;
  o = vec4(fogged(col, vW), 1.0);
}`);
const seaProg = program(`layout(location=0) in vec3 aPos; uniform mat4 uViewProj; out vec3 vW;
void main() { vW = aPos; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec3 vW; out vec4 o;
uniform float uTime;
${COMMON}
${FOG}
float bulge(float a, float at, float wide) { float q = sin((a - at) / 2.0) / wide; return exp(-q * q); }
void main() {
  float a = atan(vW.x, vW.z);
  float past = length(vW.xz) - (105.0 + 13.0 * sin(3.0 * a + 1.1) + 9.0 * sin(5.0 * a + 2.6) + 4.0 * sin(11.0 * a) + 3.0 * sin(19.0 * a + 0.7)
    - 34.0 * bulge(a, 0.75, 0.11) + 28.0 * bulge(a, -2.3, 0.09));
  float wave = sin(vW.x * 0.9 + uTime * 1.4) * sin(vW.z * 0.7 - uTime * 1.1) + 0.5 * sin((vW.x + vW.z) * 2.1 + uTime * 2.3);
  vec3 col = mix(vec3(0.22, 0.62, 0.66), vec3(0.04, 0.24, 0.42), smoothstep(1.0, 16.0, past)) + 0.035 * wave;
  float foam = 1.0 - smoothstep(0.2, 0.9, abs(past - 1.5 - 0.35 * sin(uTime * 1.6 + a * 40.0)));
  col = mix(col, vec3(0.93, 0.97, 0.98), foam * 0.75);
  o = vec4(fogged(col, vW), mix(0.62, 1.0, smoothstep(1.0, 12.0, past)));
}`);

// the grid as a mesh, coloured by height and steepness: sand, grass, bare rock, pale summit
const land = (() => {
  const n = GRID.n, row = n + 1, v = [], idx = [];
  const SAND = [0.80, 0.70, 0.47], GRASS = [0.31, 0.45, 0.20], LUSH = [0.17, 0.33, 0.13], DRY = [0.55, 0.52, 0.24], DIRT = [0.52, 0.40, 0.25], ROCK = [0.40, 0.36, 0.31], PEAK = [0.66, 0.63, 0.58], DEEP = [0.30, 0.34, 0.27];
  const at = (i, j) => heights[clamp(j, 0, n) * row + clamp(i, 0, n)];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const h = at(i, j), nrm = V.norm([at(i - 1, j) - at(i + 1, j), 2 * GRID.cell, at(i, j - 1) - at(i, j + 1)]);
    const x = i * GRID.cell - GRID.half, z = j * GRID.cell - GRID.half;
    let col = V.lerp(GRASS, LUSH, smooth(-0.1, 0.2, roll(x, z, 29)));
    col = V.lerp(col, DRY, smooth(0.08, 0.28, roll(x + 90, z, 23)));
    col = V.lerp(SAND, col, smooth(0.7, 1.5, h));
    col = V.lerp(col, DIRT, smooth(7, 4, pathDistance(x, z, GORGE)));
    col = V.lerp(col, ROCK, Math.max(smooth(0.17, 0.30, 1 - nrm[1]), smooth(17, 21, h)));
    col = V.lerp(col, PEAK, smooth(24, 28, h));
    col = V.lerp(col, DEEP, smooth(0, 0.8, -h));
    v.push(x, h, z, ...col, ...nrm);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * row + i; idx.push(k, k + row + 1, k + 1, k, k + row, k + row + 1); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array(v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();
// ---------------------------------------------------------------- trees and rocks
const solids = [], leaves = [];                              // what you bump into, what the camera avoids
const flora = (() => {
  const v = [], idx = [];
  const add = (m, at, col, R) => {                           // m: pos, normal, uv from the mesh helpers
    const base = v.length / 9;
    for (let k = 0; k < m.v.length; k += 8) {
      let p = [m.v[k], m.v[k + 1], m.v[k + 2]], n = [m.v[k + 3], m.v[k + 4], m.v[k + 5]];
      if (R) { p = M3.vec(R, p); n = M3.vec(R, n); }
      v.push(at[0] + p[0], at[1] + p[1], at[2] + p[2], ...col, ...n);
    }
    for (const i of m.i) idx.push(base + i);
  };
  const trunk = (r0, r1, h, lean) => {
    const m = { v: [], i: [] }, n = 6;
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      m.v.push(c * r0, 0, s * r0, c, 0, s, 0, 0, c * r1 + lean, h, s * r1, c, 0, s, 0, 0);
    }
    for (let k = 0; k < n; k++) { const p = k * 2; m.i.push(p, p + 1, p + 2, p + 2, p + 1, p + 3); }
    return m;
  };
  const BARK = [0.24, 0.15, 0.08], PALM = [0.45, 0.33, 0.18];
  const palm = (at, s, turn) => {
    const lean = 0.9 * s, R = M3.ry(turn), h = 4.6 * s;
    add(trunk(0.22 * s, 0.13 * s, h, lean), at, PALM, R);
    const top = V.add(at, M3.vec(R, [lean, h, 0]));
    for (let k = 0; k < 6; k++) add(blob(0.34 * s, 0.05 * s, 1.5 * s, [0, 0, 1.35 * s], 0, 6), top, [0.13, 0.40 + (k % 2) * 0.07, 0.10], M3.mul(M3.ry(k * 1.05 + turn), M3.rx(0.38)));
    add(blob(0.22 * s, 0.2 * s, 0.22 * s, [0, -0.15 * s, 0], 0, 6), top, BARK);
  };
  const pine = (at, s, shade) => {
    add(trunk(0.26 * s, 0.16 * s, 3.4 * s, 0), at, BARK);
    for (let k = 0; k < 3; k++) add(coneData((1.8 - k * 0.45) * s, (2.1 - k * 0.2) * s, 9), [at[0], at[1] + (3.0 + k * 1.15) * s, at[2]], [0.07 + shade * 0.04, 0.25 + shade * 0.1, 0.11]);
  };
  const leafy = (at, s, shade) => {
    add(trunk(0.3 * s, 0.2 * s, 4.0 * s, 0), at, BARK);
    for (const [x, y, z, r] of [[0, 4.8, 0, 1.6], [0.9, 4.3, 0.3, 1.0], [-0.8, 4.4, -0.5, 1.1]])
      add(blob(r * s, r * 0.8 * s, r * s, [x * s, y * s, z * s], 0.25, 7), at, [0.16 + shade * 0.08, 0.36 + shade * 0.08, 0.08]);
  };
  const boulder = (at, s, shade) => add(blob(s, s * 0.75, s * 0.9, [0, s * 0.3, 0], 0.5, 7), at, [0.34 + shade * 0.1, 0.32 + shade * 0.09, 0.29 + shade * 0.08], M3.ry(shade * 20));

  // one chance every few metres, nudged about; woods grow where the noise says so
  const STEP = 5.5;
  for (let i = -24; i <= 24; i++) for (let j = -24; j <= 24; j++) {
    const r = k => bump(i * 3 + k * 17, j * 5 - k * 11);
    const x = (i + r(1) - 0.5) * STEP, z = (j + r(2) - 0.5) * STEP, e = pastCoast(x, z);
    if (e > -4 || Math.hypot(x, z) < 17 || pathDistance(x, z, GORGE) < 5) continue;
    const y = shape(x, z), slope = Math.hypot(shape(x + 1, z) - y, shape(x, z + 1) - y), s = 0.75 + r(3) * 0.6, at = [x, y - 0.15, z];
    const woods = roll(x - 50, z + 30, 31);
    if (e > -22 && y < 3) {
      if (r(4) < 0.2) { palm(at, s, r(5) * 6.3); solids.push({ x, z, y, r: 0.24 * s, h: 4.4 * s }); }
    } else if (slope < 0.8 && y < 18 && r(4) < (woods > 0.04 ? 0.75 : 0.05)) {
      (woods > 0.17 || y > 9 ? pine : leafy)(at, s, r(5));
      solids.push({ x, z, y, r: 0.3 * s, h: 3.5 * s });
      leaves.push([x, y + 4.4 * s, z, 1.9 * s]);
    } else if (r(6) < (y > 12 || slope > 0.8 ? 0.2 : 0.07)) {
      const size = 0.35 + r(7) ** 2 * 1.9;
      boulder(at, size, r(5));
      if (size > 0.6) solids.push({ x, z, y, r: size * 0.85, h: size });
    }
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array(v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();
// shadows of the trees and rocks
function drawFloraShadow(light, eye) {
  globals(staticDepth, light, light, eye);
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  gl.bindVertexArray(flora.vao); gl.drawElements(gl.TRIANGLES, flora.count, gl.UNSIGNED_INT, 0);
}
const seaVao = (() => {
  const vao = gl.createVertexArray(), S = 900, y = SEA.level; gl.bindVertexArray(vao);
  attrib(0, new Float32Array([-S, y, S, S, y, S, S, y, -S, -S, y, S, S, y, -S, -S, y, -S]), 3, gl.FLOAT);
  gl.bindVertexArray(null); return vao;
})();
function drawLand(vp, light, eye) {
  globals(landProg, vp, light, eye); gl.uniform3fv(landProg.u.uSky, SKY.island);
  gl.bindVertexArray(land.vao); gl.drawElements(gl.TRIANGLES, land.count, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(flora.vao); gl.drawElements(gl.TRIANGLES, flora.count, gl.UNSIGNED_INT, 0);
}
// after everything solid, so legs show through the water
function drawSea(vp, light, eye) {
  globals(seaProg, vp, light, eye); gl.uniform3fv(seaProg.u.uSky, SKY.island); gl.uniform1f(seaProg.u.uTime, game.time);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(seaVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
}

