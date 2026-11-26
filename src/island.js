// ======================================================================= the island (map in progress)
// the island, its hills, the ocean around it and water that hurts. no caves yet. T swaps maps for now
// low: the optimized island for weaker computers. asking: the map choice is on screen
const world = { map: 'plate', low: false, asking: false };
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
  return world.map === 'island' ? groundHeight(x, z) : 0;
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
function askMap(on) {
  world.asking = on;
  document.getElementById('mapask').hidden = !on;
}
function setMap(name, low) {
  askMap(false);
  abortLoot(); endSend(player);
  world.map = name; world.low = name === 'island' && !!low;
  if (name === 'island') loadFlora();
  for (const q of pops) q.el.remove();
  for (const list of [pops, props, stars, particles, tracers, shells, flashes, marks]) list.length = 0;
  for (const c of chests) { c.t = -1; c.open = c.openV = c.wobble = 0; c.forced = false; c.pos[1] = groundAt(c.pos[0], c.pos[2]); }
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

const SAND = [0.80, 0.70, 0.47], GRASS = [0.31, 0.45, 0.20], LUSH = [0.17, 0.33, 0.13], DRY = [0.45, 0.46, 0.21], DIRT = [0.52, 0.40, 0.25], ROCK = [0.40, 0.36, 0.31], PEAK = [0.66, 0.63, 0.58], DEEP = [0.30, 0.34, 0.27];
function groundColour(x, z, h, up) {
  let col = V.lerp(GRASS, LUSH, smooth(-0.1, 0.2, roll(x, z, 29)));
  col = V.lerp(col, DRY, smooth(0.08, 0.28, roll(x + 90, z, 23)));
  col = V.lerp(SAND, col, smooth(0.7, 1.5, h));
  col = V.lerp(col, DIRT, smooth(7, 4, pathDistance(x, z, GORGE)));
  col = V.lerp(col, ROCK, Math.max(smooth(0.17, 0.30, 1 - up), smooth(17, 21, h)));
  col = V.lerp(col, PEAK, smooth(24, 28, h));
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
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * row + i; idx.push(k, k + row + 1, k + 1, k, k + row, k + row + 1); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array(v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();
// ---------------------------------------------------------------- trees, bushes, rocks and grass
const solids = [], leaves = [];                              // what you bump into, what the camera avoids
// built in square patches, so only the ones in view get drawn
const PATCH = 44;
function buildFlora(low) {
  const patches = new Map(), first = !solids.length;          // what you bump into is the same for both
  let cur = null, seed = 1;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const patch = (x, z) => {
    const i = Math.floor((x + GRID.half) / PATCH), j = Math.floor((z + GRID.half) / PATCH), key = i * 100 + j;
    if (!patches.has(key)) patches.set(key, { x: (i + 0.5) * PATCH - GRID.half, z: (j + 0.5) * PATCH - GRID.half, big: { v: [], i: [] }, grass: { v: [], i: [] } });
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
      clump(end, rnd(0.8, 1.1) * s, 75, 0.34 * s, col);
    }
    clump(up(0, 5.2, 0), 1.3 * s, 120, 0.34 * s, col);
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
  const stone = (at, size, col, depth) => {
    const cuts = Array.from({ length: 8 }, () => ({ n: anyway(), k: rnd(0.45, 0.85) }));
    const turn = M3.ry(rnd(0, 6.3)), wide = rnd(0.9, 1.35), tall = rnd(0.65, 1.05), lean = rnd(-0.35, 0.35), corners = new Map();
    const carve = d => {
      const key = d.map(v => v.toFixed(3)).join();         // faces that share a corner must agree on it
      if (!corners.has(key)) {
        let q = V.mul(d, rnd(0.72, 1.38));
        for (const c of cuts) { const over = V.dot(q, c.n) - c.k; if (over > 0) q = V.mad(q, c.n, -over); }
        corners.set(key, V.add(at, M3.vec(turn, [(q[0] + q[1] * lean) * size * wide, q[1] * size * tall + size * 0.28, q[2] * size])));
      }
      return corners.get(key);
    };
    const m = cur.big;
    for (const face of ball(depth)) {
      const pts = face.map(carve);
      let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
      if (V.dot(n, M3.vec(turn, face[0])) < 0) n = V.mul(n, -1);
      const base = m.v.length / 9, tone = shadeOf(col, rnd(0.86, 1.14));
      for (const q of pts) vert(m, q, tone, n);
      m.i.push(base, base + 1, base + 2);
    }
  };
  const boulder = (at, s, shade) => {
    const grey = 0.36 + shade * 0.10, col = [grey + 0.02, grey, grey - 0.035];
    stone(at, s * 0.95, col, s > 0.8 ? 2 : 1);
    if (s > 0.8) {                                            // big ones are a heap: a slab leaning on the main lump
      const a = rnd(0, 6.3);
      stone(V.add(at, [Math.cos(a) * s * 0.65, 0, Math.sin(a) * s * 0.65]), s * rnd(0.5, 0.65), shadeOf(col, rnd(0.88, 1.08)), 1);
    }
    for (let k = 0; k < (low ? 2 : 4); k++) {                 // broken bits round the foot
      const a = rnd(0, 6.3), r = s * rnd(0.1, 0.28);
      const far = s * rnd(1.05, 1.5), x = at[0] + Math.cos(a) * far, z = at[2] + Math.sin(a) * far;
      stone([x, groundHeight(x, z) - r * 0.25, z], r, shadeOf(col, rnd(0.85, 1.1)), 0);        // each on its own patch of ground
    }
  };

  // one chance every few metres, nudged about; woods grow where the noise says so
  const STEP = 5.5;
  for (let i = -24; i <= 24; i++) for (let j = -24; j <= 24; j++) {
    const r = k => bump(i * 3 + k * 17, j * 5 - k * 11);
    const x = (i + r(1) - 0.5) * STEP, z = (j + r(2) - 0.5) * STEP, e = pastCoast(x, z);
    if (e > -4 || Math.hypot(x, z) < 17 || pathDistance(x, z, GORGE) < 5) continue;
    const y = groundHeight(x, z), slope = Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y), s = 0.75 + r(3) * 0.6, at = [x, y - 0.15, z];
    const woods = roll(x - 50, z + 30, 31);
    cur = patch(x, z); seed = 1 + Math.floor(r(8) * 2147483000);
    if (e > -22 && y < 3) {
      if (r(4) < 0.2) { palm(at, s, r(5) * 6.3); if (first) solids.push({ x, z, y, r: 0.24 * s, h: 4.4 * s }); }
    } else if (slope < 0.8 && y < 18 && r(4) < (woods > 0.04 ? 0.7 : 0.05)) {
      (woods > 0.17 || y > 9 ? pine : leafy)(at, s, r(5));
      if (first) { solids.push({ x, z, y, r: 0.3 * s, h: 3.5 * s }); leaves.push([x, y + 4.4 * s, z, 1.9 * s]); }
    } else if (r(6) < (y > 12 || slope > 0.8 ? 0.2 : 0.07)) {
      const size = 0.35 + r(7) ** 2 * 1.9;
      boulder([x, y - 0.1 - Math.min(slope, 1) * size * 0.6, z], size, r(5));        // sunk in, so none hang off a slope
      if (size > 0.6 && first) solids.push({ x, z, y, r: size * 0.85, h: size });
    } else if (slope < 0.7 && y < 16 && r(6) < (woods > 0 ? 0.5 : 0.17)) bush(at, s, r(5));
  }

  // grass wherever the ground is green: short tufts everywhere, and thick piles of long bending blades
  const grassHere = (x, z) => {
    const y = groundHeight(x, z);
    if (y < 1.4 || y > 16 || pastCoast(x, z) > -6 || pathDistance(x, z, GORGE) < 7) return null;
    return Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y) > 0.6 ? null : y;
  };
  // one blade: two bends, narrowing to a point, darker at the root
  const blade = (m, x, y, z, a, tall, wide, lean, col) => {
    const base = m.v.length / 9, cx = Math.cos(a), cz = Math.sin(a);
    const root = [col[0] * 0.8, col[1] * 0.85, col[2] * 0.8], mid = [col[0] * 1.05, col[1] * 1.15, col[2]], tip = [col[0] * 1.3, col[1] * 1.45, col[2] * 1.1];
    for (const [u, w, c] of [[0, 1, root], [0.55, 0.72, mid]]) {
      const out = lean * u * u, px = x + cx * out, pz = z + cz * out, py = y + tall * u;
      vert(m, [px + cz * wide * w, py, pz - cx * wide * w], c, [0, 1, 0]);
      vert(m, [px - cz * wide * w, py, pz + cx * wide * w], c, [0, 1, 0]);
    }
    vert(m, [x + cx * lean, y + tall * 0.9, z + cz * lean], tip, [0, 1, 0]);
    m.i.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
  };
  const sow = (cell, salt, chance, count, spread, height, wide) => {
    const half = Math.floor(135 / cell);
    for (let i = -half; i <= half; i++) for (let j = -half; j <= half; j++) {
      seed = 1 + Math.floor(bump(i * 7 + salt, j * 3 - salt) * 2147483000);
      const x = (i + rnd(-0.5, 0.5)) * cell, z = (j + rnd(-0.5, 0.5)) * cell;
      if (rnd(0, 1) > chance) continue;
      const y = grassHere(x, z);
      if (y === null) continue;
      const m = patch(x, z).grass, col = groundColour(x, z, y, 1), tall = rnd(height[0], height[1]);
      for (let k = 0; k < count; k++) {
        const a = rnd(0, 6.3), d = Math.sqrt(rnd(0, 1)) * spread, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
        // blades fan out from the middle, the outer ones leaning further
        blade(m, bx, groundHeight(bx, bz) - 0.03, bz, a + rnd(-0.7, 0.7), tall * rnd(0.55, 1.15), wide, tall * rnd(0.15, 0.4) + d * 0.35, col);
      }
    }
  };
  if (low) sow(2.5, 53, 0.55, 16, 0.34, [0.28, 0.55], 0.032);
  else {
    sow(1.0, 11, 0.85, 7, 0.24, [0.13, 0.27], 0.022);
    sow(1.9, 53, 0.65, 30, 0.34, [0.32, 0.62], 0.028);
  }

  const upload = m => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    attrib(0, new Float32Array(m.v), 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
    buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.i));
    gl.bindVertexArray(null);
    return { vao, count: m.i.length };
  };
  return [...patches.values()].map(p => ({ x: p.x, z: p.z, big: upload(p.big), grass: upload(p.grass) }));
}
const floras = [];
let flora = [];
function loadFlora() {
  const k = world.low ? 1 : 0;
  if (!floras[k]) floras[k] = buildFlora(world.low);
  flora = floras[k];
}
const drawPart = m => { if (m.count) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); } };
// moving shadows only cover the ground round you, so only the patches there are needed
function drawFloraShadow(light, eye) {
  if (world.low) return;
  globals(staticDepth, light, light, eye);
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  for (const p of flora) if (Math.hypot(p.x - player.pos[0], p.z - player.pos[2]) < PATCH * 0.75 + 16) drawPart(p.big);
}

// ---------------------------------------------------------------- shadows of the whole island
// the land and everything on it never moves, so its shadows are drawn once, the first time they are needed
const baked = [];
function bakeShadows() {
  const SIZE = Math.min(world.low ? 3072 : 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SIZE, SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0); gl.drawBuffers([gl.NONE]);
  const light = mul4(ortho(GRID.half, GRID.half, 1, 500), lookAt(V.mul(SUN, 250), [0, 0, 0]));
  gl.viewport(0, 0, SIZE, SIZE); gl.clear(gl.DEPTH_BUFFER_BIT);
  globals(staticDepth, light, light, [0, 0, 0]);
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  drawPart(land);
  for (const p of flora) drawPart(p.big);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tex);       // it stays on unit 4
  return { tex, light };
}
const seaVao = (() => {
  const vao = gl.createVertexArray(), S = 900, y = SEA.level; gl.bindVertexArray(vao);
  attrib(0, new Float32Array([-S, y, S, S, y, S, S, y, -S, -S, y, S, S, y, -S, -S, y, -S]), 3, gl.FLOAT);
  gl.bindVertexArray(null); return vao;
})();
const fogRange = () => world.low ? [70, 200] : [90, 420];
function drawLand(vp, light, eye) {
  const k = world.low ? 1 : 0, shade = baked[k] || (baked[k] = bakeShadows());
  globals(landProg, vp, light, eye); gl.uniform3fv(landProg.u.uSky, SKY.island); gl.uniform2fv(landProg.u.uFog, fogRange());
  gl.uniform1i(landProg.u.uLow, k);
  gl.uniform1i(landProg.u.uBaked, 4); gl.uniformMatrix4fv(landProg.u.uBakedLight, false, shade.light);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, shade.tex);
  gl.uniform1i(landProg.u.uKind, 0); drawPart(land);
  gl.uniform1i(landProg.u.uKind, 1);
  // skip the patches behind you or off to the side; grass is only drawn close by
  const R = PATCH * 0.75;
  for (const p of flora) {
    const x = vp[0] * p.x + vp[4] * 8 + vp[8] * p.z + vp[12], w = vp[3] * p.x + vp[7] * 8 + vp[11] * p.z + vp[15];
    if (w < -R || Math.abs(x) > Math.max(w, 0) + R * 2.5) continue;
    if (world.low && Math.hypot(p.x - eye[0], p.z - eye[2]) > fogRange()[1] + R) continue;
    drawPart(p.big);
    if (Math.hypot(p.x - eye[0], p.z - eye[2]) < (world.low ? 18 : 40) + R) drawPart(p.grass);
  }
}
// after everything solid, so legs show through the water
function drawSea(vp, light, eye) {
  globals(seaProg, vp, light, eye); gl.uniform3fv(seaProg.u.uSky, SKY.island); gl.uniform2fv(seaProg.u.uFog, fogRange()); gl.uniform1f(seaProg.u.uTime, game.time);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(seaVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
}

