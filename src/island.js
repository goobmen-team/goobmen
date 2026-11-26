// ======================================================================= the island (map in progress)
// the island, its hills, the ocean around it and water that hurts. no caves yet. T swaps maps for now
const world = { map: 'plate' };
// the land climbs from the beach to a meadow, hills and one mountain; past the coast it drops to the sea floor
const SEA = { level: -0.2, floor: -1.0, wade: 5, swim: 22, grace: 0.6, every: 0.5, bite: 8 };
const SKY = { plate: [219 / 255, 219 / 255, 219 / 255], island: [0.66, 0.80, 0.91] };
// how far the coast is from the middle, in each direction (the same formula is in the water shader)
const coast = a => 105 + 13 * Math.sin(3 * a + 1.1) + 9 * Math.sin(5 * a + 2.6) + 4 * Math.sin(11 * a);
const pastCoast = (x, z) => Math.hypot(x, z) - coast(Math.atan2(x, z));
const MEADOW = 2.0;                                          // the flat clearing you start in
// x, z, height, radius. keep height / radius under 0.5 so every slope can be walked up
const HILLS = [[12, -62, 24, 50], [-65, 20, 14, 38], [58, 42, 11, 32], [-18, 72, 8, 28], [55, -22, 7, 25], [-45, -55, 9, 27]];
const bump = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
function roll(x, z, size) {
  const u = x / size, v = z / size, i = Math.floor(u), j = Math.floor(v), a = smooth(0, 1, u - i), b = smooth(0, 1, v - j);
  return (bump(i, j) * (1 - a) + bump(i + 1, j) * a) * (1 - b) + (bump(i, j + 1) * (1 - a) + bump(i + 1, j + 1) * a) * b - 0.5;
}
function shape(x, z) {
  const e = pastCoast(x, z);
  if (e >= 0) return SEA.floor * clamp(e / SEA.wade, 0, 1);
  let h = MEADOW + roll(x, z, 17) * 2.2 + roll(x, z, 6) * 0.5;
  for (const [hx, hz, top, r] of HILLS) {
    const d = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
    if (d < 1) h += top * (1 - d) * (1 - d) * (1 + roll(x, z, 11) * 0.25);
  }
  h = MEADOW + (h - MEADOW) * smooth(11, 24, Math.hypot(x, z));
  return h * smooth(0, 24, -e);
}
// heights on a grid: the drawn land and your feet read the same numbers
const GRID = { half: 175, n: 220 };
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
  const d = Math.hypot(p[0], p[2]), max = coast(Math.atan2(p[0], p[2])) + (f.isPlayer ? SEA.swim : -1.5);
  if (d > max) { p[0] *= max / d; p[2] *= max / d; }
}

// where a ray meets the ground or the sea, or null
function surfaceHit(origin, dir) {
  if (world.map !== 'island') {
    if (dir[1] >= -1e-4) return null;
    const t = -origin[1] / dir[1], p = V.mad(origin, dir, t);
    return Math.abs(p[0]) < HALF && Math.abs(p[2]) < HALF ? { t, kind: 'ground' } : null;
  }
  const under = t => origin[1] + dir[1] * t < floorAt(origin[0] + dir[0] * t, origin[2] + dir[2] * t);
  for (let last = 0, t = 0.4; t < 90; last = t, t += 0.4 + t * 0.012) {
    if (!under(t)) continue;
    let lo = last, hi = t;
    for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (under(mid)) hi = mid; else lo = mid; }
    return { t: hi, kind: inSea(V.mad(origin, dir, hi)) ? 'water' : 'ground' };
  }
  return null;
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
    if (p[1] < floorAt(p[0], p[2]) + 0.2) return Math.max(0.4, d - 0.2);
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
void main() {
  float a = atan(vW.x, vW.z);
  float past = length(vW.xz) - (105.0 + 13.0 * sin(3.0 * a + 1.1) + 9.0 * sin(5.0 * a + 2.6) + 4.0 * sin(11.0 * a));
  float wave = sin(vW.x * 0.9 + uTime * 1.4) * sin(vW.z * 0.7 - uTime * 1.1) + 0.5 * sin((vW.x + vW.z) * 2.1 + uTime * 2.3);
  vec3 col = mix(vec3(0.22, 0.62, 0.66), vec3(0.04, 0.24, 0.42), smoothstep(1.0, 16.0, past)) + 0.035 * wave;
  float foam = 1.0 - smoothstep(0.2, 0.9, abs(past - 1.5 - 0.35 * sin(uTime * 1.6 + a * 40.0)));
  col = mix(col, vec3(0.93, 0.97, 0.98), foam * 0.75);
  o = vec4(fogged(col, vW), mix(0.62, 1.0, smoothstep(1.0, 12.0, past)));
}`);

// the grid as a mesh, coloured by height and steepness: sand, grass, bare rock, pale summit
const land = (() => {
  const n = GRID.n, row = n + 1, v = [], idx = [];
  const SAND = [0.80, 0.70, 0.47], GRASS = [0.31, 0.45, 0.20], ROCK = [0.40, 0.36, 0.31], PEAK = [0.66, 0.63, 0.58], DEEP = [0.30, 0.34, 0.27];
  const at = (i, j) => heights[clamp(j, 0, n) * row + clamp(i, 0, n)];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const h = at(i, j), nrm = V.norm([at(i - 1, j) - at(i + 1, j), 2 * GRID.cell, at(i, j - 1) - at(i, j + 1)]);
    let col = V.lerp(SAND, GRASS, smooth(0.7, 1.4, h));
    col = V.lerp(col, ROCK, Math.max(smooth(0.14, 0.24, 1 - nrm[1]), smooth(14, 18, h)));
    col = V.lerp(col, PEAK, smooth(21, 24, h));
    col = V.lerp(col, DEEP, smooth(0, 0.8, -h));
    v.push(i * GRID.cell - GRID.half, h, j * GRID.cell - GRID.half, ...col, ...nrm);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * row + i; idx.push(k, k + row + 1, k + 1, k, k + row, k + row + 1); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array(v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();
const seaVao = (() => {
  const vao = gl.createVertexArray(), S = 900, y = SEA.level; gl.bindVertexArray(vao);
  attrib(0, new Float32Array([-S, y, S, S, y, S, S, y, -S, -S, y, S, S, y, -S, -S, y, -S]), 3, gl.FLOAT);
  gl.bindVertexArray(null); return vao;
})();
function drawLand(vp, light, eye) {
  globals(landProg, vp, light, eye); gl.uniform3fv(landProg.u.uSky, SKY.island);
  gl.bindVertexArray(land.vao); gl.drawElements(gl.TRIANGLES, land.count, gl.UNSIGNED_INT, 0);
}
// after everything solid, so legs show through the water
function drawSea(vp, light, eye) {
  globals(seaProg, vp, light, eye); gl.uniform3fv(seaProg.u.uSky, SKY.island); gl.uniform1f(seaProg.u.uTime, game.time);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(seaVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
}

