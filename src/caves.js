// ======================================================================= caves
// stone caves cut into the south flanks of the hills and mountains: a mouth in the slope, a passage that slopes down and a chamber
// at the back. the hill is the island's own (island.js digs the way in); the mouth and everything inside is here
const CAVE_ROCK = 2.4;                                       // how thick the walls are that you bump into
const caveShift = (c, s) => c.bend * smooth(3, 12, s);        // the passage swings a little to one side
const caveWide = s => {                                       // half the width of the hollow, s metres in
  const sc = CAVE.length + CAVE.room - 1, in_ = s - sc, room = Math.abs(in_) < CAVE.room ? Math.sqrt(CAVE.room * CAVE.room - in_ * in_) : 0;
  return s <= sc ? Math.max(CAVE.half, room) : Math.max(room, 0.4);
};
const caveFloorAt = (s, c) => c.base - c.depth * smooth(1.5, 11.5, s);
const caveRoof = (s, c) => caveFloorAt(s, c) + 3.0 + 0.8 * smooth(CAVE.length - 1, CAVE.length + 2.5, s);
// where a point is, measured from a cave: s inward from the mouth (the mouths face +z), t to the side
function caveAt(x, z, pad) {
  for (const c of CAVES) {
    const s = c.z - z;
    if (s < -0.6 || s > CAVE.end + (pad || 0) + CAVE_ROCK || Math.abs(x - c.x) > CAVE.room + CAVE_ROCK + (pad || 0) + 3) continue;
    const t = x - c.x - caveShift(c, s), wide = caveWide(clamp(s, 0, CAVE.end));
    if (Math.abs(t) < wide + CAVE_ROCK + (pad || 0)) return { c, s, t, wide, hollow: s >= 0 && s <= CAVE.end && Math.abs(t) < wide };
  }
  return null;
}
// the approach to the mouth and the shallow part over the passage, where no tree or boulder may stand
const caveClear = (x, z) => CAVES.some(c => { const s = c.z - z; return s > -14 && s < 10 && Math.abs(x - c.x) < CAVE.room + 5; });
// the floor under a point inside a cave, or null anywhere else
function caveFloor(x, z) {
  if (world.map !== 'island') return null;
  const c = caveAt(x, z);
  if (c && c.hollow) return caveFloorAt(c.s, c.c);
  // the doorstep is level too, so the rock rising beside it never reads as a wall across the way in
  const door = CAVES.find(k => { const s = k.z - z; return s > -1.8 && s < 0 && Math.abs(x - k.x) < CAVE.half + 0.2; });
  return door ? door.base : null;
}
// is this point inside solid rock? (bullets and the camera)
function caveRock(p) {
  if (world.map !== 'island') return false;
  const c = caveAt(p[0], p[2]);
  if (!c || c.s < 0 || p[1] > c.c.base + c.c.lip) return false;
  if (c.hollow) return p[1] > caveRoof(c.s, c.c) - 0.15;
  if (c.s > 5 && p[1] > groundHeight(p[0], p[2]) + 0.1) return false;     // open sky above the hill
  return p[1] > c.c.base - 0.2;
}
// the camera must not poke through a wall or the roof
function caveCamera(p) {
  const c = world.map === 'island' ? caveAt(p[0], p[2]) : null;
  if (!c || c.s < 0 || p[1] > c.c.base + c.c.lip) return false;
  if (c.s <= CAVE.end && Math.abs(c.t) < c.wide - 0.25) return p[1] > caveRoof(c.s, c.c) - 0.3 || p[1] < caveFloorAt(c.s, c.c) + 0.2;
  return true;
}

// in a cave the point the camera looks over is kept clear of the walls and roof
function caveShoulder(at) {
  const me = caveAt(player.pos[0], player.pos[2]);
  if (!me || !me.hollow || !inCave(player.pos)) return;
  const c = me.c, s = clamp(c.z - at[2], 0, CAVE.end), mid = c.x + caveShift(c, s), room = Math.max(0.2, caveWide(s) - 0.75);
  at[0] = clamp(at[0], mid - room, mid + room);
  at[1] = Math.min(at[1], caveRoof(s, c) - 0.6);
  at[2] = Math.max(at[2], c.z - CAVE.end + 0.7);
}
// how much light reaches someone: full outside, dim and fading as you go further in
const caveLight = p => {
  if (!inCave(p)) return 1;
  const s = caveAt(p[0], p[2]).s;
  return 0.42 + 0.58 * Math.exp(-s / 3.5);
};
const inCave = p => {
  const c = world.map === 'island' ? caveAt(p[0], p[2]) : null;
  return !!c && c.hollow && c.s > 0.3 && p[1] < caveRoof(c.s, c.c) - 0.5;
};
// the sides of the hollow as a list of points, round the whole cave from one side of the mouth to the other
function caveEdge(c) {
  const left = [], right = [];
  for (let s = 0; s <= CAVE.end + 0.01; s += 1) {
    const mid = c.x + caveShift(c, s), w = caveWide(s);
    left.push([mid - w, c.z - s]); right.push([mid + w, c.z - s]);
  }
  return left.concat([[c.x + caveShift(c, CAVE.end), c.z - CAVE.end - 0.3]], right.reverse());
}
// walls you cannot walk through
function addCaveWalls() {
  for (const c of CAVES) {
    const edge = caveEdge(c);
    for (let k = 0; k + 1 < edge.length; k++) {
      const [ax, az] = edge[k], [bx, bz] = edge[k + 1], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      // outward, away from the middle of the cave
      let nx = dz / len, nz = -dx / len;
      const mid = [(ax + bx) / 2, (az + bz) / 2], axis = [c.x + caveShift(c, clamp(c.z - mid[1], 0, CAVE.end - 2)), clamp(mid[1], c.z - CAVE.end + 2, c.z)];
      if (nx * (mid[0] - axis[0]) + nz * (mid[1] - axis[1]) < 0) { nx = -nx; nz = -nz; }
      const hull = outline([[ax, az], [bx, bz], [ax + nx * 1.5, az + nz * 1.5], [bx + nx * 1.5, bz + nz * 1.5]]);
      if (hull.length < 3) continue;
      const x = mid[0] + nx * 0.75, z = mid[1] + nz * 0.75;
      solids.push({ x, z, y: c.base - c.depth - 1, r: len / 2 + 1, h: c.depth + 4.5, hull, wall: true, upTo: c.base + 1.3 });
    }
  }
}

// ---------------------------------------------------------------- the stone inside
// daylight spills in from the mouth, two torches and a fire do the rest, and the rock is painted point by point
const caveProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aCol; layout(location=2) in vec3 aNrm; uniform mat4 uViewProj, uModel; out vec3 vW; out vec3 vC; out vec3 vN;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vC = aCol; vN = aNrm; gl_Position = uViewProj * w; }`, `
in vec3 vW; in vec3 vC; in vec3 vN; out vec4 o;
uniform float uTime, uMouth; uniform vec3 uTorchA, uTorchB, uFire;
${COMMON}
${FOG}
float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float lumps(vec3 p) { return noise(p * 2.3) + 0.5 * noise(p * 6.1) + 0.25 * noise(p * 15.0); }
vec3 torch(vec3 at, vec3 N, float wobble) {
  vec3 d = at - vW; float r2 = dot(d, d);
  return vec3(1.0, 0.68, 0.38) * wobble * (0.12 + 0.88 * max(dot(N, d * inversesqrt(r2 + 1e-4)), 0.0)) * 2.7 / (1.0 + r2 * 0.30);
}
void main() {
  if (vC.r > 1.5) { o = vec4(vC.r - 1.5, vC.g, vC.b, 1.0); return; }          // flames light themselves
  vec3 N = normalize(vN);
  if (dot(N, uEye - vW) < 0.0) N = -N;
  // rough surface: tip the normal with the same lumps the colour uses
  float h = lumps(vW), e = 0.07;
  vec3 slope = vec3(lumps(vW + vec3(e, 0, 0)), lumps(vW + vec3(0, e, 0)), lumps(vW + vec3(0, 0, e))) - h;
  N = normalize(N - (slope - N * dot(N, slope)) * 0.9);
  // stone: broad blotches, soft tilted beds of rock, grain and speckle
  float broad = noise(vW * 0.55), bed = noise(vec3((vW.y + vW.x * 0.12 + 0.9 * broad) * 2.4, 0.0, 0.0));
  vec3 col = vC * (0.76 + 0.24 * broad + 0.34 * (bed - 0.5) + 0.07 * (h - 0.9) + 0.07 * (noise(vW * 34.0) - 0.5));
  float day = exp(-max(0.0, uMouth - vW.z) / 4.2);
  vec3 light = vec3(0.18, 0.19, 0.24) + vec3(0.85, 0.90, 1.0) * day * (0.45 + 0.4 * max(dot(N, normalize(vec3(0.0, 0.5, 1.0))), 0.0));
  light += torch(uTorchA, N, 1.0 + 0.09 * sin(uTime * 11.0) * sin(uTime * 6.7));
  light += torch(uTorchB, N, 1.0 + 0.09 * sin(uTime * 9.3 + 2.0) * sin(uTime * 7.9));
  light += torch(uFire, N, 0.85 + 0.16 * sin(uTime * 13.0 + 1.0) * sin(uTime * 5.3));
  col = col * light + flashLight(vW, N) * col;
  o = vec4(fogged(col / (1.0 + col * 0.25), vW), 1.0);
}`);

let caveWork = null;
function makeCaves() {
  // smooth lumpy noise in three directions, so neighbouring faces agree with each other
  const dice = (i, j, k) => { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
  const lump = (p, size) => {
    const q = V.mul(p, 1 / size), i = q.map(Math.floor), f = q.map((v, n) => { const u = v - i[n]; return u * u * (3 - 2 * u); });
    let sum = 0;
    for (let c = 0; c < 8; c++) {
      const a = c & 1, b = (c >> 1) & 1, d = c >> 2;
      sum += dice(i[0] + a, i[1] + b, i[2] + d) * (a ? f[0] : 1 - f[0]) * (b ? f[1] : 1 - f[1]) * (d ? f[2] : 1 - f[2]);
    }
    return sum;
  };
  let seed = 31;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };

  const list = [];
  for (const c of CAVES) {
    const m = { v: [], i: [] };
    const tri = (pts, col, away) => {
      const base = m.v.length / 9;
      let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
      if (away && V.dot(n, V.sub(pts[0], away)) < 0) n = V.mul(n, -1);
      pts.forEach(p => m.v.push(...p, ...col, ...n));
      m.i.push(base, base + 1, base + 2);
    };
    const grey = k => [0.42 * k, 0.37 * k, 0.31 * k];
    const torches = [[c.x + caveShift(c, 7) - caveWide(7) + 0.35, caveFloorAt(7, c) + 1.85, c.z - 7],
      [c.x + caveShift(c, CAVE.end - 1.3) + 0.2, caveFloorAt(CAVE.end, c) + 2.2, c.z - CAVE.end + 1.2]];

    // the walls and roof: rings from the foot of one wall, over the top, to the foot of the other
    const ARC = 20, steps = [];
    for (let s = 0; s < CAVE.end; s += 0.6) steps.push(s);
    steps.push(CAVE.end);
    const rings = steps.map(s => {
      const mid = c.x + caveShift(c, s), floor = caveFloorAt(s, c), wide = caveWide(s), tall = caveRoof(s, c) - floor;
      return Array.from({ length: ARC + 1 }, (_, k) => {
        const a = Math.PI * (1 - k / ARC), cx = Math.cos(a), sn = Math.sin(a);
        const p = [mid + Math.sign(cx) * Math.pow(Math.abs(cx), 0.6) * wide, floor + Math.pow(sn, 0.75) * tall, c.z - s];
        // knobbly rock: big bulges, small ones and level shelves, pushed outward only so nobody walks into it
        const shelf = Math.max(0, lump([p[0] * 0.45, p[1] * 2.8, p[2] * 0.45], 1) - 0.42) * 1.0;
        const push = Math.max(0, lump(p, 1.7) - 0.32) * 1.2 + Math.max(0, lump(p, 0.6) - 0.4) * 0.45 + shelf;
        return [p[0] + cx * push, p[1] + sn * push * 0.8 - (k === 0 || k === ARC ? 0.45 : 0), p[2] + (lump(p, 0.9) - 0.5) * 0.45 * smooth(0.3, 1.2, s)];
      });
    });
    // beds of paler and darker rock, damp and dark along the foot, no two faces quite alike
    const toneOf = p => {
      const low = smooth(0.1, 1.0, p[1] - caveFloorAt(c.z - p[2], c)), warm = lump(p, 4.0) - 0.5;
      const k = (0.62 + 0.38 * low) * (0.72 + 0.62 * lump([p[0] * 0.3, p[1] * 3.2, p[2] * 0.3], 1)) * rnd(0.9, 1.1);
      return [0.43 * k + 0.05 * warm, 0.37 * k, 0.31 * k - 0.04 * warm];
    };
    for (let n = 0; n + 1 < rings.length; n++) for (let k = 0; k < ARC; k++) {
      const a = rings[n], b = rings[n + 1];
      for (const t of [[a[k], b[k], b[k + 1]], [a[k], b[k + 1], a[k + 1]]]) tri(t, toneOf(t[0]));
    }
    // the floor: trodden grit with bumps and loose pebbles
    const FLOOR = 8;
    const floorPoint = (n, k) => {
      const a = rings[n][0], b = rings[n][ARC], p = V.lerp(a, b, k / FLOOR), s = c.z - p[2];
      return [p[0], caveFloorAt(s, c) + (k > 0 && k < FLOOR ? (lump(p, 0.5) - 0.5) * 0.1 : -0.12), p[2]];
    };
    for (let n = 0; n + 1 < rings.length; n++) for (let k = 0; k < FLOOR; k++) {
      const q = [floorPoint(n, k), floorPoint(n + 1, k), floorPoint(n + 1, k + 1), floorPoint(n, k + 1)];
      const tone = [0.31, 0.25, 0.18].map(v => v * (0.75 + 0.6 * lump(q[0], 1.3)));
      tri([q[0], q[1], q[2]], tone); tri([q[0], q[2], q[3]], tone);
    }
    // close the back of the chamber
    {
      const last = rings[rings.length - 1], mid = V.lerp(V.lerp(last[0], last[ARC], 0.5), last[ARC / 2], 0.5), hub = [mid[0], mid[1], mid[2] - 0.9];
      for (let k = 0; k <= ARC; k++) { const t = [last[k], last[(k + 1) % (ARC + 1)], hub]; tri(t, toneOf(t[0])); }
    }
    // a rough stone: a point pushed out of a ring of corners
    const spike = (foot, size, tip, col, sides) => {
      const ring = Array.from({ length: sides }, (_, n) => { const a = n / sides * 6.283 + rnd(-0.3, 0.3), r = size * rnd(0.7, 1.25); return [foot[0] + Math.cos(a) * r, foot[1] + rnd(-0.05, 0.05), foot[2] + Math.sin(a) * r]; });
      const waist = ring.map(p => V.add(V.lerp(p, tip, 0.45), [rnd(-0.04, 0.04), 0, rnd(-0.04, 0.04)]));
      const core = V.lerp(foot, tip, 0.4);
      for (let n = 0; n < sides; n++) {
        const j = (n + 1) % sides;
        tri([ring[n], ring[j], waist[j]], col, core); tri([ring[n], waist[j], waist[n]], col, core); tri([waist[n], waist[j], tip], col, core);
      }
    };
    // stalactites hang in clumps, stalagmites and fallen rock keep to the sides
    for (let k = 0; k < 26; k++) {
      const s = rnd(2.5, CAVE.end - 0.8), mid = c.x + caveShift(c, s), w = caveWide(s) - 0.3, x = mid + rnd(-0.75, 0.75) * w, z = c.z - s;
      const side = Math.abs(x - mid) / (w + 0.3), roof = caveFloorAt(s, c) + Math.pow(Math.sin(Math.acos(Math.pow(side, 1 / 0.6))), 0.75) * (caveRoof(s, c) - caveFloorAt(s, c));
      const long = rnd(0.2, 0.75) * (k % 7 ? 1 : 1.5);
      spike([x, roof + 0.2, z], rnd(0.15, 0.34), [x + rnd(-0.06, 0.06), Math.max(roof - long, caveFloorAt(s, c) + 2.15), z], grey(rnd(1.25, 1.6)), 6);
    }
    for (let k = 0; k < 30; k++) {
      const s = rnd(2, CAVE.end - 0.6), mid = c.x + caveShift(c, s), w = caveWide(s), x = mid + (k % 2 ? 1 : -1) * (w - rnd(0.05, 0.35)), z = c.z - s, y = caveFloorAt(s, c);
      if (k < 10) spike([x, y - 0.1, z], rnd(0.12, 0.28), [x + rnd(-0.08, 0.08), y + rnd(0.35, 1.0), z + rnd(-0.08, 0.08)], grey(rnd(0.9, 1.15)), 6);
      else { const size = rnd(0.12, 0.4); spike([x, y - 0.08, z], size, [x + rnd(-0.1, 0.1), y + size * rnd(0.6, 1.1), z + rnd(-0.1, 0.1)], grey(rnd(0.7, 1.1)), 5); }
    }
    for (let k = 0; k < 40; k++) {
      const s = rnd(0.5, CAVE.end - 1), x = c.x + caveShift(c, s) + rnd(-0.8, 0.8) * caveWide(s), z = c.z - s, y = caveFloorAt(s, c), size = rnd(0.03, 0.09);
      spike([x, y - 0.02, z], size, [x, y + size * 0.8, z], grey(rnd(0.7, 1.2)), 4);
    }
    // torches: a stick wedged in the rock with a flame on it
    for (const t of torches) {
      spike([t[0], t[1] - 0.65, t[2]], 0.035, [t[0], t[1], t[2]], [0.22, 0.13, 0.06], 5);
      for (const [r, up, down, base, top] of [[0.11, 0.36, 0.1, [2.5, 0.45, 0.05], [2.5, 0.75, 0.2]], [0.055, 0.2, 0.05, [2.5, 0.85, 0.35], [2.5, 0.97, 0.7]]]) {
        for (let n = 0; n < 6; n++) {
          const p = k => [t[0] + Math.cos(k / 6 * 6.283) * r, t[1] + 0.04, t[2] + Math.sin(k / 6 * 6.283) * r];
          tri([p(n), p(n + 1), [t[0], t[1] + up, t[2]]], n % 2 ? base : top);
          tri([p(n), p(n + 1), [t[0], t[1] - down, t[2]]], base);
        }
      }
    }
    // someone lived here: a fire in a ring of stones, with gnawed bones and a skull beside it
    const ember = [c.x + caveShift(c, 13.6) - 2.7, caveFloorAt(13.6, c), c.z - 13.6];
    const fire = [ember[0], ember[1] + 0.55, ember[2]];
    const flame = (at, r, up, base, top) => {
      for (let n = 0; n < 6; n++) {
        const q = k => [at[0] + Math.cos(k / 6 * 6.283) * r, at[1], at[2] + Math.sin(k / 6 * 6.283) * r];
        tri([q(n), q(n + 1), [at[0], at[1] + up, at[2]]], n % 2 ? base : top);
      }
    };
    for (let n = 0; n < 9; n++) {
      const a = n / 9 * 6.283, x = ember[0] + Math.cos(a) * 0.44, z = ember[2] + Math.sin(a) * 0.44;
      spike([x, ember[1] - 0.04, z], rnd(0.1, 0.15), [x, ember[1] + rnd(0.11, 0.18), z], grey(rnd(0.75, 1.0)), 5);
    }
    flame([ember[0], ember[1] + 0.02, ember[2]], 0.32, 0.07, [2.1, 0.22, 0.02], [1.8, 0.1, 0.02]);
    for (const [dx, dz, r, up] of [[0, 0, 0.17, 0.62], [0.13, 0.08, 0.1, 0.4], [-0.12, -0.06, 0.1, 0.34]]) {
      flame([ember[0] + dx, ember[1] + 0.08, ember[2] + dz], r, up, [2.5, 0.42, 0.04], [2.5, 0.68, 0.14]);
      flame([ember[0] + dx, ember[1] + 0.09, ember[2] + dz], r * 0.5, up * 0.6, [2.5, 0.86, 0.35], [2.5, 0.97, 0.65]);
    }
    const rod = (a, b, r, col) => {
      const along = V.norm(V.sub(b, a)), u = V.norm(V.cross(along, [0.2, 1, 0.1])), v = V.cross(along, u), mid = V.lerp(a, b, 0.5);
      const end = at => Array.from({ length: 5 }, (_, n) => V.mad(V.mad(at, u, Math.cos(n / 5 * 6.283) * r), v, Math.sin(n / 5 * 6.283) * r));
      const p = end(a), q = end(b);
      for (let n = 0; n < 5; n++) {
        const j = (n + 1) % 5;
        tri([p[n], p[j], q[j]], col, mid); tri([p[n], q[j], q[n]], col, mid); tri([p[n], p[j], a], col, mid); tri([q[n], q[j], b], col, mid);
      }
    };
    for (const turn of [0.3, 1.5, 2.6]) {
      const d = [Math.cos(turn) * 0.26, 0, Math.sin(turn) * 0.26], at = [ember[0], ember[1] + 0.1, ember[2]];
      rod(V.sub(at, d), V.add(at, d), 0.045, [0.2, 0.12, 0.06]);
    }
    const BONE = [0.74, 0.7, 0.58];
    for (let n = 0; n < 6; n++) {
      const at = [ember[0] + rnd(0.1, 1.0), ember[1] + 0.05, ember[2] + rnd(0.55, 1.2)], a = rnd(0, 6.283), d = [Math.cos(a) * rnd(0.12, 0.24), 0, Math.sin(a) * rnd(0.12, 0.24)];
      const from = V.sub(at, d), to = V.add(at, d), knob = V.mul(V.norm(d), 0.045);
      rod(from, to, 0.025, BONE); rod(V.sub(from, knob), V.add(from, knob), 0.048, BONE); rod(V.sub(to, knob), V.add(to, knob), 0.048, BONE);
    }
    {
      const at = [ember[0] + 0.75, ember[1], ember[2] - 0.35];
      spike([at[0], at[1] + 0.09, at[2]], 0.15, [at[0], at[1] + 0.31, at[2]], BONE, 7);
      spike([at[0], at[1] + 0.1, at[2]], 0.15, [at[0], at[1], at[2]], BONE, 7);
      for (const side of [-1, 1]) {
        const eye = [at[0] + 0.15, at[1] + 0.14, at[2] + side * 0.055];
        tri([[eye[0], eye[1] + 0.04, eye[2]], [eye[0], eye[1] - 0.025, eye[2] - 0.035], [eye[0], eye[1] - 0.025, eye[2] + 0.035]], [0.04, 0.03, 0.02]);
      }
    }
    // paintings in red ochre: they are laid onto the very faces of the wall, a hair in front of them
    const onWall = (s, high, right) => {
      let n = 0;
      while (n + 2 < steps.length && steps[n + 1] <= s) n++;
      const u = clamp((s - steps[n]) / (steps[n + 1] - steps[n]), 0, 1);
      const turn = Math.asin(Math.pow(clamp(high / 3.8, 0, 1), 1 / 0.75)) / Math.PI * ARC;
      const kk = right ? ARC - turn : turn, k = Math.min(ARC - 1, Math.floor(kk)), v = kk - k;
      const a = rings[n], b = rings[n + 1];
      const p = u >= v ? V.add(V.add(a[k], V.mul(V.sub(b[k], a[k]), u)), V.mul(V.sub(b[k + 1], b[k]), v))
        : V.add(V.add(a[k], V.mul(V.sub(b[k + 1], a[k + 1]), u)), V.mul(V.sub(a[k + 1], a[k]), v));
      const axis = [c.x + caveShift(c, s), caveFloorAt(s, c) + 1.4, p[2]];
      return V.mad(p, V.norm(V.sub(axis, p)), 0.045);
    };
    for (const right of [false, true]) {
      const from = right ? 14.2 : 15.0, OCHRE = [0.62, 0.13, 0.05], SOOT = [0.07, 0.05, 0.04];
      // a line from one point of the picture to another: x along the wall, y above the floor, both in metres
      const stroke = (x0, y0, x1, y1, wide, col) => {
        const long = Math.hypot(x1 - x0, y1 - y0) || 1, ox = -(y1 - y0) / long * wide / 2, oy = (x1 - x0) / long * wide / 2;
        const parts = Math.ceil(long / 0.07);
        const at = (k, side) => onWall(from + x0 + (x1 - x0) * k / parts + ox * side, y0 + (y1 - y0) * k / parts + oy * side, right);
        for (let k = 0; k < parts; k++) {
          const q = [at(k, 1), at(k + 1, 1), at(k + 1, -1), at(k, -1)];
          tri([q[0], q[1], q[2]], col); tri([q[0], q[2], q[3]], col);
        }
      };
      const line = (pts, wide, col) => { for (let n = 0; n + 1 < pts.length; n++) stroke(pts[n][0], pts[n][1], pts[n + 1][0], pts[n + 1][1], wide, col); };
      // a mammoth: humped back, head, trunk, tusk and legs
      const big = right ? SOOT : OCHRE;
      line([[0.2, 1.25], [0.3, 1.7], [0.65, 1.92], [1.0, 1.72], [1.3, 1.78], [1.5, 1.6], [1.55, 1.25], [1.7, 1.0], [1.66, 0.85]], 0.1, big);
      line([[0.2, 1.25], [0.55, 1.15], [1.0, 1.18], [1.4, 1.3]], 0.09, big);
      for (const x of [0.3, 0.55, 1.0, 1.25]) stroke(x, 1.18, x - 0.04, 0.78, 0.085, big);
      line([[1.48, 1.35], [1.66, 1.22], [1.86, 1.28], [1.92, 1.42]], 0.045, big);
      stroke(0.35, 1.5, 1.05, 1.45, 0.22, big);
      // hunters with spears
      for (const [x, y] of [[2.35, 0.9], [2.75, 1.1], [3.1, 0.85]]) {
        stroke(x, y + 0.25, x, y + 0.55, 0.055, OCHRE);
        line([[x - 0.12, y], [x, y + 0.25], [x + 0.12, y]], 0.045, OCHRE);
        line([[x - 0.17, y + 0.36], [x, y + 0.47], [x + 0.15, y + 0.52]], 0.035, OCHRE);
        stroke(x, y + 0.6, x, y + 0.71, 0.1, OCHRE);
        stroke(x - 0.38, y + 0.5, x + 0.26, y + 0.55, 0.022, SOOT);
      }
      // hand prints
      for (const [x, y] of [[0.5, 2.25], [1.0, 2.38], [2.55, 2.1]]) {
        stroke(x - 0.07, y, x + 0.07, y, 0.14, OCHRE);
        for (let f = 0; f < 4; f++) stroke(x - 0.055 + f * 0.037, y + 0.05, x - 0.075 + f * 0.05, y + 0.2, 0.027, OCHRE);
        stroke(x + 0.06, y - 0.03, x + 0.16, y + 0.05, 0.03, OCHRE);
      }
    }
    // by the door the ground itself is the outline. anything that would stick out of the cliff is pushed
    // back into it, not down, so the passage keeps its full height right from the mouth
    for (let v = 0; v < m.v.length; v += 9) {
      const x = m.v[v], y = m.v[v + 1];
      if (c.z - m.v[v + 2] >= 2.4 || y <= c.base + 0.05) continue;
      let depth = 0;
      while (depth < 2.4 && groundHeight(x, c.z - depth) < y) depth += 0.06;
      m.v[v + 2] = Math.min(m.v[v + 2], c.z - depth);
    }
    list.push({ cave: c, torches, fire, mesh: m });
  }

  // round each doorway: creepers and rough grass, set on the ground that is really there. the rocks are all inside
  const trim = { v: [], i: [] }, cliff = { v: [], i: [] };
  for (const c of CAVES) {
    const tri = (pts, col, away) => {
      const base = trim.v.length / 9;
      let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
      if (V.dot(n, V.sub(pts[0], away)) < 0) n = V.mul(n, -1);
      pts.forEach(p => trim.v.push(...p, ...col, ...n));
      trim.i.push(base, base + 1, base + 2);
    };
    const leaf = (at, along, across, col) => {
      const mid = V.mad(at, along, 0.45), away = [at[0], at[1], at[2] - 3];
      tri([at, V.add(mid, across), V.add(at, along)], col, away);
      tri([at, V.add(at, along), V.sub(mid, across)], col, away);
    };
    // where the cliff in front of the door is at a given height
    const face = (x, y) => {
      for (let s = 0; s < 3.2; s += 0.08) if (groundHeight(x, c.z - s) >= y) {
        let lo = Math.max(0, s - 0.08), hi = s;
        for (let k = 0; k < 4; k++) { const m = (lo + hi) / 2; if (groundHeight(x, c.z - m) >= y) hi = m; else lo = m; }
        return c.z - hi;
      }
      return c.z - 3.2;
    };
    const tall = caveRoof(0, c) - c.base;
    // round the doorway one arch of weathered stone in broad flat faces, set against the cliff: it curls into
    // the passage on the inside, stands proud, and sinks back into the hill round its angular outer edge
    const REACH = CAVE.half + 2.3, HIGH = Math.min(tall + 1.15, 4.1);
    const proud = (x, y) => 0.85 * smooth(REACH, REACH - 1.2, Math.abs(x - c.x)) * smooth(HIGH + 0.2, HIGH - 0.8, y - c.base);
    {
      const ARC = 13;
      // each ring: how far from the doorway to the outer edge, how far forward of the cliff, how uneven
      const RINGS = [[0, -0.5, 0], [0, 0.4, 0.05], [0.28, 0.78, 0.18], [0.72, 0.66, 0.22], [1, -0.25, 0.14]];
      const skew = [rnd(0.9, 1.15), rnd(0.9, 1.15)];
      const grid = RINGS.map(([u, out, rough], ring) => Array.from({ length: ARC + 1 }, (_, k) => {
        const a = Math.PI * k / ARC, cs = Math.cos(a), sn = Math.max(0, Math.sin(a)), foot = k === 0 || k === ARC;
        const ix = c.x + Math.sign(cs) * Math.pow(Math.abs(cs), 0.6) * (CAVE.half + 0.03), iy = c.base + Math.pow(sn, 0.75) * (tall + 0.03);
        const ox = c.x + Math.sign(cs) * Math.pow(Math.abs(cs), 0.45) * REACH * skew[cs < 0 ? 0 : 1], oy = c.base + Math.pow(sn, 0.45) * HIGH;
        const x = ix + (ox - ix) * u + (ring > 1 && !foot ? rnd(-rough, rough) * 1.4 : 0);
        const y = foot ? c.base - 0.15 : iy + (oy - iy) * u + rnd(-rough, rough);
        return [x, y, face(x, Math.max(y, c.base + 0.05)) + out + rnd(-rough, rough)];
      }));
      for (let ring = 0; ring + 1 < RINGS.length; ring++) for (let k = 0; k < ARC; k++) {
        const q = [grid[ring][k], grid[ring + 1][k], grid[ring + 1][k + 1], grid[ring][k + 1]];
        for (const t of (k + ring) % 2 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]) {
          const mid = V.mul(V.add(V.add(t[0], t[1]), t[2]), 1 / 3);
          let n = V.norm(V.cross(V.sub(t[1], t[0]), V.sub(t[2], t[0])));
          if (V.dot(n, V.sub(mid, [c.x, c.base + 1.2, c.z - 6])) < 0) n = V.mul(n, -1);
          const base = cliff.v.length / 9, k2 = 0.88 + 0.28 * lump(mid, 2.0), warm = rnd(-0.012, 0.018);
          for (const p of t) cliff.v.push(...p, 0.39 * k2 + warm, 0.36 * k2, 0.31 * k2 - warm, ...n);
          cliff.i.push(base, base + 1, base + 2);
        }
      }
    }
    // creepers trailing down from the brow
    for (let n = 0; n < 2 + Math.floor(rnd(0, 3)); n++) {
      const x = c.x + rnd(-CAVE.half - 0.5, CAVE.half + 0.5), edge = Math.pow(Math.max(0, 1 - ((x - c.x) / (CAVE.half + 0.9)) ** 2), 0.5);
      let y = c.base + tall * edge + rnd(0.35, 0.7);
      const long = Math.min(rnd(0.6, 1.5), y - c.base - (Math.abs(x - c.x) < CAVE.half - 0.4 ? 2.4 : 0.4));
      let p = [x, y, face(x, y) + proud(x, y) + 0.14];
      for (let d = 0; d < long; d += 0.15) {
        const ny = p[1] - 0.15, next = [p[0] + rnd(-0.04, 0.04), ny, Math.max(face(p[0], ny) + proud(p[0], ny) + 0.08, p[2] + rnd(-0.03, 0.02))];
        leaf(p, V.sub(next, p), [0.014, 0, 0], [0.18, 0.24, 0.08]);
        for (const side of [-1, 1]) leaf(next, [side * rnd(0.07, 0.16), rnd(-0.1, 0.01), rnd(0.01, 0.07)], [0.01, rnd(0.035, 0.07), 0], [0.18, rnd(0.34, 0.46), 0.09]);
        p = next;
      }
    }
    // rough grass hanging over the top of the cliff and growing at its foot
    const tuft = (at, size, droop) => {
      for (let f = 0; f < 10; f++) {
        const dir = V.norm([rnd(-0.8, 0.8), rnd(0.4, 1) - droop * rnd(0, 1.1), rnd(0, 0.9)]);
        leaf(at, V.mul(dir, size * rnd(0.6, 1.2)), [0.022, 0, 0.008], [rnd(0.22, 0.34), rnd(0.40, 0.55), 0.11]);
      }
    };
    for (let n = 0; n < 13; n++) {
      const x = c.x + rnd(-CAVE.half - 1.8, CAVE.half + 1.8), y = c.base + rnd(3.2, 3.75), z = face(x, y);
      tuft([x, groundHeight(x, z) - 0.02, z], rnd(0.2, 0.45), 1);
    }
    for (const side of [-1, 1]) for (let n = 0; n < 4; n++) {
      const x = c.x + side * (CAVE.half + rnd(0.2, 2.4)), z = c.z + rnd(0, 1.2);
      tuft([x, groundHeight(x, z) - 0.02, z], rnd(0.22, 0.4), 0);
    }
  }

  const upload = m => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    buffer(gl.ARRAY_BUFFER, new Float32Array(m.v));
    attrib(0, null, 3, gl.FLOAT, false, 36, 0); attrib(1, null, 3, gl.FLOAT, false, 36, 12); attrib(2, null, 3, gl.FLOAT, false, 36, 24);
    buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.i));
    gl.bindVertexArray(null);
    return { vao, count: m.i.length };
  };
  return { list: list.map(e => ({ ...e, mesh: upload(e.mesh) })), trim: upload(trim), cliff: upload(cliff) };
}
const loadCaves = () => caveWork || (caveWork = makeCaves());
// the crag casts shadows, which also keeps the sun off whoever is inside
function drawCaveShadow() {
  drawPart(loadCaves().trim); drawPart(loadCaves().cliff);
  const near = CAVES.find(c => Math.abs(player.pos[0] - c.x) < 26 && Math.abs(player.pos[2] - (c.z - CAVE.end / 2)) < 26);
  if (!near) return;
  gl.bindVertexArray(land.vao);
  for (const p of land.pieces) if (Math.abs(p.x - near.x) < land.reach && Math.abs(p.z - near.z + CAVE.end / 2) < land.reach) gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, p.from * 4);
}
// the stonework and plants go through the same shader as the other rocks and leaves
function drawCaveCliffs() { drawPart(loadCaves().cliff); }       // plain stone, like the other rocks
function drawCaveTrim() { drawPart(loadCaves().trim); }
function drawCaveInsides(vp, light, eye) {
  globals(caveProg, vp, light, eye);
  gl.uniform3fv(caveProg.u.uSky, SKY.island); gl.uniform2fv(caveProg.u.uFog, fogRange()); gl.uniform1f(caveProg.u.uTime, game.time);
  gl.uniformMatrix4fv(caveProg.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  for (const e of loadCaves().list) {
    if (Math.hypot(e.cave.x - eye[0], e.cave.z - eye[2]) > 160) continue;
    gl.uniform1f(caveProg.u.uMouth, e.cave.z); gl.uniform3fv(caveProg.u.uTorchA, e.torches[0]); gl.uniform3fv(caveProg.u.uTorchB, e.torches[1]); gl.uniform3fv(caveProg.u.uFire, e.fire);
    drawPart(e.mesh);
  }
}
