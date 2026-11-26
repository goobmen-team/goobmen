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
  return p[1] > c.c.base - 0.2;
}
// the camera must not poke through a wall or the roof
function caveCamera(p) {
  const c = world.map === 'island' ? caveAt(p[0], p[2]) : null;
  if (!c || c.s < 0 || p[1] > c.c.base + c.c.lip) return false;
  if (c.s <= CAVE.end && Math.abs(c.t) < c.wide - 0.25) return p[1] > caveRoof(c.s, c.c) - 0.3 || p[1] < caveFloorAt(c.s, c.c) + 0.2;
  return true;
}

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
      solids.push({ x, z, y: c.base - c.depth - 1, r: len / 2 + 1, h: c.depth + 4.5, hull, wall: true });
    }
  }
}

// ---------------------------------------------------------------- the stone inside
// daylight spills in from the mouth, two torches do the rest, and the rock is painted point by point
const caveProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aCol; layout(location=2) in vec3 aNrm; uniform mat4 uViewProj, uModel; out vec3 vW; out vec3 vC; out vec3 vN;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vC = aCol; vN = aNrm; gl_Position = uViewProj * w; }`, `
in vec3 vW; in vec3 vC; in vec3 vN; out vec4 o;
uniform float uTime, uMouth; uniform vec3 uTorchA, uTorchB;
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
  return vec3(1.0, 0.84, 0.66) * wobble * (0.2 + 0.8 * max(dot(N, d * inversesqrt(r2 + 1e-4)), 0.0)) * 2.1 / (1.0 + r2 * 0.20);
}
void main() {
  if (vC.r > 1.5) { o = vec4(vC.r - 1.5, vC.g, vC.b, 1.0); return; }          // flames light themselves
  vec3 N = normalize(vN);
  if (dot(N, uEye - vW) < 0.0) N = -N;
  // rough surface: tip the normal with the same lumps the colour uses
  float h = lumps(vW), e = 0.07;
  vec3 slope = vec3(lumps(vW + vec3(e, 0, 0)), lumps(vW + vec3(0, e, 0)), lumps(vW + vec3(0, 0, e))) - h;
  N = normalize(N - (slope - N * dot(N, slope)) * 1.5);
  // stone: broad blotches, soft tilted beds of rock, grain and speckle
  float broad = noise(vW * 0.55), bed = noise(vec3((vW.y + vW.x * 0.12 + 0.9 * broad) * 2.4, 0.0, 0.0));
  vec3 col = vC * (0.66 + 0.40 * broad + 0.24 * (bed - 0.5) + 0.12 * (h - 0.9) + 0.08 * (noise(vW * 34.0) - 0.5));
  float day = exp(-max(0.0, uMouth - vW.z) / 4.2);
  vec3 light = vec3(0.17, 0.20, 0.26) + vec3(0.85, 0.90, 1.0) * day * (0.45 + 0.4 * max(dot(N, normalize(vec3(0.0, 0.5, 1.0))), 0.0));
  light += torch(uTorchA, N, 1.0 + 0.09 * sin(uTime * 11.0) * sin(uTime * 6.7));
  light += torch(uTorchB, N, 1.0 + 0.09 * sin(uTime * 9.3 + 2.0) * sin(uTime * 7.9));
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
    const grey = k => [0.39 * k, 0.40 * k, 0.43 * k];
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
        // knobbly rock: big bulges and small, pushed outward only so nobody walks into it
        const push = Math.max(0, lump(p, 1.7) - 0.32) * 1.3 + Math.max(0, lump(p, 0.6) - 0.4) * 0.5;
        return [p[0] + cx * push, p[1] + sn * push * 0.8 - (k === 0 || k === ARC ? 0.15 : 0), p[2] + (lump(p, 0.9) - 0.5) * 0.45 * smooth(0.3, 1.2, s)];
      });
    });
    const toneOf = p => { const k = 0.8 + 0.45 * lump(p, 2.6), warm = lump(p, 4.0) - 0.5; return [0.40 * k + 0.02 * warm, 0.41 * k, 0.43 * k - 0.02 * warm]; };
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
      const tone = [0.27, 0.27, 0.275].map(v => v * (0.75 + 0.6 * lump(q[0], 1.3)));
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
      const long = rnd(0.2, 0.9) * (k % 7 ? 1 : 1.5);
      spike([x, roof + 0.18, z], rnd(0.09, 0.24), [x + rnd(-0.06, 0.06), Math.max(roof - long, caveFloorAt(s, c) + 2.15), z], grey(rnd(0.85, 1.15)), 6);
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
    list.push({ cave: c, torches, mesh: m, door: rings[0] });
  }

  // round each mouth: rock showing through the hillside. it starts dark at the passage, and its outer edge
  // sinks into the slope and takes on the colour of the ground there, so there is no seam to see
  const face = { v: [], i: [] }, rock = { v: [], i: [] };
  for (const { cave: c, door } of list) {
    const tri = (pts, col, away) => {
      const base = rock.v.length / 9;
      let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
      if (V.dot(n, V.sub(pts[0], away)) < 0) n = V.mul(n, -1);
      pts.forEach(p => rock.v.push(...p, ...col, ...n));
      rock.i.push(base, base + 1, base + 2);
    };

    // the face: a fine sheet from the ragged edge of the passage out to where the hill swallows it
    const ARC = door.length - 1, LAYERS = 12, salt = rnd(0, 50);
    const skewL = rnd(0.92, 1.15), skewR = rnd(0.92, 1.15), peak = rnd(-0.1, 0.1), top = Math.min(c.lip, 5.4);
    const point = (layer, k) => {
      if (!layer) return door[k];
      const a = Math.PI * (1 - k / ARC), cx = Math.cos(a), sn = Math.sin(a), u = layer / LAYERS;
      const out = (CAVE.half + 3.3) * (cx < 0 ? skewL : skewR), high = top * (1 + peak * cx);
      let x = door[k][0] + (c.x + Math.sign(cx) * Math.pow(Math.abs(cx), 0.5) * out - door[k][0]) * u;
      let y = door[k][1] + (c.base + Math.pow(sn, 0.55) * high - door[k][1]) * u;
      let z = c.z + 0.15 - u * u * 4.4;
      // weathered rock: a few broad bulges with smaller knuckles on them
      const here = [x * 1.2 + salt, y * 1.5, 0];
      const rough = smooth(0, 0.25, u) * (1 - smooth(0.7, 1, u));
      z += ((lump(here, 2.2) - 0.5) * 1.5 + (lump(here, 0.8) - 0.5) * 0.45) * rough;
      x += (lump([here[1], here[0], 3], 1.6) - 0.5) * 0.5 * rough;
      y += (lump([here[0], here[1], 7], 1.5) - 0.5) * 0.4 * rough;
      // the outer edge goes down into the ground that is really there
      const sink = smooth(0.62, 1, u);
      const under = Math.abs(x - c.x) < CAVE.half + 0.7 ? Math.max(groundHeight(x, z), c.base + 3.9) : groundHeight(x, z);    // never droops into the door
      y += (Math.min(y, under - 0.2) - y) * sink;
      if (k === 0 || k === ARC) y = Math.min(y, c.base - 0.3);
      return [x, y, z];
    };
    const grid = Array.from({ length: LAYERS + 1 }, (_, layer) => Array.from({ length: ARC + 1 }, (_, k) => point(layer, k)));
    const behind = [c.x, c.base + 1.2, c.z - 7];
    // one normal per point, so the light runs smoothly over it like it does over the land
    const normals = grid.map((row, layer) => row.map((p, k) => {
      const a = grid[Math.max(0, layer - 1)][k], b = grid[Math.min(LAYERS, layer + 1)][k], l = row[Math.max(0, k - 1)], r = row[Math.min(ARC, k + 1)];
      let n = V.norm(V.cross(V.sub(r, l), V.sub(b, a)));
      if (V.dot(n, V.sub(p, behind)) < 0) n = V.mul(n, -1);
      return n;
    }));
    const first = face.v.length / 9;
    for (let layer = 0; layer <= LAYERS; layer++) for (let k = 0; k <= ARC; k++) {
      const p = grid[layer][k], n = normals[layer][k], u = layer / LAYERS;
      const stone = V.mul([0.41, 0.37, 0.31], 0.62 + 0.38 * smooth(0, 0.22, u) + (lump(p, 1.4) - 0.5) * 0.25);
      const ground = groundColour(p[0], p[2], groundHeight(p[0], p[2]), 1);
      // grass creeps in from the edges and settles on whatever faces up
      const green = clamp(smooth(0.5, 0.95, u + (lump(p, 1.1) - 0.5) * 0.45) + smooth(0.55, 0.85, n[1]) * smooth(0.35, 0.65, lump(p, 0.9)) * smooth(0.2, 0.45, u), 0, 1);
      face.v.push(...p, ...V.lerp(stone, ground, green), ...n);
    }
    for (let layer = 0; layer < LAYERS; layer++) for (let k = 0; k < ARC; k++) {
      const q = first + layer * (ARC + 1) + k, up = q + ARC + 1;
      face.i.push(q, up, up + 1, q, up + 1, q + 1);
    }

    // two or three boulders resting against the foot of the face, rounded off like the others on the island
    const T = (1 + Math.sqrt(5)) / 2;
    const CORNERS = [[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]].map(V.norm);
    const FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const block = (x, z, size) => {
      const mid = [x, groundHeight(x, z) + size * 0.05, z], turn = M3.ry(rnd(0, 6.3));
      const pts = CORNERS.map(d => { const q = M3.vec(turn, V.mul(d, rnd(0.8, 1.2))); return [mid[0] + q[0] * size * 1.15, mid[1] + q[1] * size * 0.75, mid[2] + q[2] * size]; });
      const tone = rnd(0.92, 1.06);
      for (const f of FACES) tri(f.map(k => pts[k]), [0.39 * tone, 0.36 * tone, 0.31 * tone], mid);
    };
    for (const side of rnd(0, 1) < 0.5 ? [-1, 1] : [1, -1]) {
      block(c.x + side * (CAVE.half + rnd(1.1, 1.7)), c.z + rnd(0, 0.6), rnd(0.55, 0.85));
      if (rnd(0, 1) < 0.5) block(c.x + side * (CAVE.half + rnd(2.2, 3.2)), c.z + rnd(0.4, 1.4), rnd(0.25, 0.45));
    }

    // a few tufts and trailing stems along the brow
    const leaf = (at, along, across, col) => {
      const mid = V.mad(at, along, 0.45), away = [at[0], at[1], at[2] - 3];
      tri([at, V.add(mid, across), V.add(at, along)], col, away);
      tri([at, V.add(at, along), V.sub(mid, across)], col, away);
    };
    for (let n = 0; n < 3; n++) {
      const k = Math.round(rnd(4, ARC - 4));
      let p = V.add(grid[2][k], [0, 0.05, 0.12]);
      const long = Math.min(rnd(0.4, 1.1), Math.max(0.2, p[1] - c.base - 2.3));
      for (let d = 0; d < long; d += 0.15) {
        const next = [p[0] + rnd(-0.04, 0.04), p[1] - 0.15, p[2] + rnd(-0.02, 0.04)];
        leaf(p, V.sub(next, p), [0.012, 0, 0], [0.18, 0.24, 0.08]);
        for (const side of [-1, 1]) leaf(next, [side * rnd(0.07, 0.15), rnd(-0.09, 0.01), rnd(0, 0.06)], [0.01, rnd(0.035, 0.065), 0], [0.18, rnd(0.34, 0.44), 0.09]);
        p = next;
      }
    }
    for (let n = 0; n < 14; n++) {
      const k = Math.round(rnd(3, ARC - 3)), at = grid[Math.round(rnd(7, 9))][k];
      for (let f = 0; f < 9; f++) {
        const dir = V.norm([rnd(-0.6, 0.6), 1, rnd(-0.3, 0.6)]);
        leaf(at, V.mul(dir, rnd(0.16, 0.34)), [0.022, 0, 0.008], [rnd(0.22, 0.34), rnd(0.42, 0.55), 0.12]);
      }
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
  return { list: list.map(e => ({ ...e, mesh: upload(e.mesh) })), face: upload(face), mouths: upload(rock) };
}
const loadCaves = () => caveWork || (caveWork = makeCaves());
// the crag casts shadows, which also keeps the sun off whoever is inside
function drawCaveShadow() {
  drawPart(loadCaves().face); drawPart(loadCaves().mouths);
  const near = CAVES.find(c => Math.abs(player.pos[0] - c.x) < 26 && Math.abs(player.pos[2] - (c.z - CAVE.end / 2)) < 26);
  if (!near) return;
  gl.bindVertexArray(land.vao);
  for (const p of land.pieces) if (Math.abs(p.x - near.x) < land.reach && Math.abs(p.z - near.z + CAVE.end / 2) < land.reach) gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, p.from * 4);
}
// the face is painted like the land it comes out of, the loose rock and leaves like the rest
function drawCaveFaces() { drawPart(loadCaves().face); }
function drawCaveRocks() { drawPart(loadCaves().mouths); }
function drawCaveInsides(vp, light, eye) {
  globals(caveProg, vp, light, eye);
  gl.uniform3fv(caveProg.u.uSky, SKY.island); gl.uniform2fv(caveProg.u.uFog, fogRange()); gl.uniform1f(caveProg.u.uTime, game.time);
  gl.uniformMatrix4fv(caveProg.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  for (const e of loadCaves().list) {
    if (Math.hypot(e.cave.x - eye[0], e.cave.z - eye[2]) > 160) continue;
    gl.uniform1f(caveProg.u.uMouth, e.cave.z); gl.uniform3fv(caveProg.u.uTorchA, e.torches[0]); gl.uniform3fv(caveProg.u.uTorchB, e.torches[1]);
    drawPart(e.mesh);
  }
}
