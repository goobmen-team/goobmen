// ======================================================================= places on the island
// the landmarks, what you bump into, where chests and enemies turn up, and the sign in the middle

// ---------------------------------------------------------------- solid things
// a convex outline (seen from above) of some points
function outline(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const q of list) { while (out.length > 1 && turn(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop(); out.push(q); }
    out.pop();
    return out;
  };
  return half(p).concat(half(p.reverse()));
}
// a solid with the real shape of its stone: an outline for walking into, the triangles for bullets
function addShape(tris, ground) {
  const all = tris.flat(), band = all.filter(q => q[1] > ground - 0.3 && q[1] < ground + 1.9);
  const top = Math.max(...all.map(q => q[1])) - ground;
  if (top < 0.5 || band.length < 3) return;                    // low enough to step over
  const hull = outline(band.map(q => [q[0], q[2]]));
  if (hull.length < 3) return;
  const x = hull.reduce((s, q) => s + q[0], 0) / hull.length, z = hull.reduce((s, q) => s + q[1], 0) / hull.length;
  const r = Math.max(...all.map(q => Math.hypot(q[0] - x, q[2] - z)));
  solids.push({ x, z, y: ground, r, h: top, hull, tris });
}
const BUCKET = 10;
let buckets = null;
function solidsNear(x, z) {
  if (!buckets) {
    buckets = new Map();
    for (const o of solids) {
      const reach = o.r + 1;
      for (let i = Math.floor((o.x - reach) / BUCKET); i <= Math.floor((o.x + reach) / BUCKET); i++)
        for (let j = Math.floor((o.z - reach) / BUCKET); j <= Math.floor((o.z + reach) / BUCKET); j++) {
          const key = i * 1000 + j;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(o);
        }
    }
  }
  return buckets.get(Math.floor(x / BUCKET) * 1000 + Math.floor(z / BUCKET)) || [];
}
// how far a point is from a solid (negative inside), and the nearest point of its edge
function edgeOf(o, x, z) {
  if (!o.hull) {
    const d = Math.hypot(x - o.x, z - o.z) || 1e-6;
    return { d: d - o.r, at: [o.x + (x - o.x) / d * o.r, o.z + (z - o.z) / d * o.r] };
  }
  let best = 1e9, at = null, inside = true;
  for (let k = 0; k < o.hull.length; k++) {
    const a = o.hull[k], b = o.hull[(k + 1) % o.hull.length], dx = b[0] - a[0], dz = b[1] - a[1];
    if (dx * (z - a[1]) - dz * (x - a[0]) < 0) inside = false;
    const u = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1), q = [a[0] + dx * u, a[1] + dz * u];
    const d = Math.hypot(x - q[0], z - q[1]);
    if (d < best) { best = d; at = q; }
  }
  return { d: inside ? -best : best, at };
}
function pushSolids(f, pad) {
  const p = f.pos;
  for (const o of solidsNear(p[0], p[2])) {
    if (o.upTo !== undefined && p[1] > o.upTo) continue;      // on the hill above a cave, not in it
    if (p[1] > o.y + o.h - 0.2 || p[1] < o.y - 2.5 || (o.thin && p[1] < o.y - 0.6)) continue;   // above it, or under a bridge rail
    const e = edgeOf(o, p[0], p[2]);
    if (e.d >= pad) continue;
    const dx = p[0] - e.at[0], dz = p[2] - e.at[1], len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const out = (e.d < 0 ? -pad : pad) / len;
    p[0] = e.at[0] + dx * out; p[2] = e.at[1] + dz * out;
  }
}
function rayTriangle(o, d, a, b, c) {
  const e1 = V.sub(b, a), e2 = V.sub(c, a), h = V.cross(d, e2), det = V.dot(e1, h);
  if (Math.abs(det) < 1e-9) return Infinity;
  const s = V.sub(o, a), u = V.dot(s, h) / det;
  if (u < 0 || u > 1) return Infinity;
  const q = V.cross(s, e1), v = V.dot(d, q) / det;
  if (v < 0 || u + v > 1) return Infinity;
  const t = V.dot(e2, q) / det;
  return t > 0 ? t : Infinity;
}
// distance to the first trunk, rock or post on the ray, or Infinity
function solidHit(origin, dir) {
  const a = dir[0] * dir[0] + dir[2] * dir[2];
  let best = Infinity;
  if (a < 1e-6) return best;
  for (const o of solids) {
    if (o.thin || o.wall) continue;
    const x = origin[0] - o.x, z = origin[2] - o.z, b = x * dir[0] + z * dir[2], disc = b * b - a * (x * x + z * z - o.r * o.r);
    if (disc < 0 || (-b + Math.sqrt(disc)) < 0) continue;
    const near = (-b - Math.sqrt(disc)) / a;
    if (near > best || near > 95) continue;
    if (o.tris) {
      for (const t of o.tris) best = Math.min(best, rayTriangle(origin, dir, t[0], t[1], t[2]));
    } else {
      const y = origin[1] + dir[1] * near;
      if (near > 0 && y > o.y - 0.3 && y < o.y + o.h) best = near;
    }
  }
  return best;
}

// ---------------------------------------------------------------- where you can walk to
const WALK = { cell: 2.5 };
let walkable = null;
function reachMap() {
  if (walkable) return walkable;
  const n = Math.floor(GRID.half * 2 / WALK.cell), seen = new Uint8Array(n * n), at = i => (i + 0.5) * WALK.cell - GRID.half;
  const start = Math.floor(GRID.half / WALK.cell), queue = [start * n + start];
  seen[start * n + start] = 1;
  const clear = (x, z) => solidsNear(x, z).every(o => o.thin || edgeOf(o, x, z).d > 0.2);
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head], i = k % n, j = (k - i) / n;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, next = b * n + a;
      if (a < 0 || b < 0 || a >= n || b >= n || seen[next]) continue;
      const x = at(a), z = at(b);
      let y = walkHeight(at(i), at(j)), ok = true;
      for (let s = 1; s <= 4 && ok; s++) {                     // no climbing a sheer face on the way
        const u = s / 4, h = walkHeight(at(i) + di * WALK.cell * u, at(j) + dj * WALK.cell * u);
        ok = h - y <= STEEP * WALK.cell / 4 && h > SEA.level;
        y = h;
      }
      if (ok && clear(x, z)) { seen[next] = 1; queue.push(next); }
    }
  }
  const cells = queue.map(k => [at(k % n), at((k - k % n) / n)]);
  walkable = { cells, has: (x, z) => !!seen[Math.floor((z + GRID.half) / WALK.cell) * n + Math.floor((x + GRID.half) / WALK.cell)] };
  return walkable;
}

// ---------------------------------------------------------------- chests
const CHEST_COUNT = 230;                                     // a hundred cavemen need something to find
// x, z, radius, how many: the places worth searching. whatever is left over lands anywhere
const area = (name, radius, count) => [SPOTS[name][0], SPOTS[name][1], radius, count];
const CHEST_AREAS = [
  area('circle', 15, 5), area('elder', 15, 4), area('bones', 16, 5), area('camp', 20, 7), area('boulders', 32, 6), area('crater', 22, 6),
  area('pines', 34, 5), area('cove', 30, 4), area('volcano', 90, 9), area('tables', 55, 8), area('arches', 28, 7), area('mammoths', 32, 8),
  area('fishers', 32, 8), area('grove', 38, 7), area('heads', 28, 7), area('fort', 26, 9), area('canyon', 50, 6), area('tower', 20, 5),
  [-124, 30, 22, 4], [-30, 96, 45, 4], [25, -125, 75, 4]
];
// level ground, room to stand in front of the lid, nothing growing through it
function goodChestSpot(x, z, taken) {
  if (Math.hypot(x, z) < 34 || pastCoast(x, z) > -7 || !reachMap().has(x, z)) return false;
  if (riverDistance(x, z) < RIVER.bank + 2 || nearBridge(x, z, 3) || caveAt(x, z, 2) || caveClear(x, z) || nearHouse(x, z, 9)) return false;
  const y = groundHeight(x, z);
  if (y < 1.0) return false;
  for (const [dx, dz, most] of [[0.6, 0, 0.16], [-0.6, 0, 0.16], [0, 0.4, 0.16], [0, -0.4, 0.16], [0, 0.8, 0.2], [0, 1.5, 0.3]])
    if (Math.abs(groundHeight(x + dx, z + dz) - y) > most) return false;
  for (const dz of [0, 0.9]) if (solidsNear(x, z + dz).some(o => edgeOf(o, x, z + dz).d < 0.9)) return false;
  return taken.every(c => Math.hypot(c.pos[0] - x, c.pos[2] - z) > 5);
}
// loot: rolled when somebody opens it
const newChest = (x, z) => ({ pos: [x, groundAt(x, z), z], loot: null, claimed: null, open: 0, openV: 0, wobble: 0, t: -1, forced: false });
let plateChests = null;
// the baseplate keeps its three; the island gets a fresh random scatter each visit
function setChests(name) {
  if (!plateChests) plateChests = chests.slice();
  chests.length = 0;
  if (name !== 'island') {
    for (const c of plateChests) { c.t = -1; c.open = c.openV = c.wobble = 0; c.forced = false; c.loot = null; c.claimed = null; chests.push(c); }
    return;
  }
  const tryAt = (x, z) => { if (goodChestSpot(x, z, chests)) chests.push(newChest(x, z)); };
  // one or two at the back of every cave
  for (const c of CAVES) {
    const mid = c.x + c.bend, z = c.z - CAVE.end + 2.6;
    chests.push(newChest(mid + rand(-0.4, 0.4), z));
    if (Math.random() < 0.5) chests.push(newChest(mid + (Math.random() < 0.5 ? -2.2 : 2.2), z + 1.8));
  }
  for (const [ax, az, radius, count] of CHEST_AREAS) {
    const want = Math.min(CHEST_COUNT, chests.length + Math.round(count * 1.4));
    for (let k = 0; k < count * 80 && chests.length < want; k++) {
      const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * radius;
      tryAt(ax + Math.sin(a) * d, az + Math.cos(a) * d);
    }
  }
  const cells = reachMap().cells;
  for (let k = 0; k < 40000 && chests.length < CHEST_COUNT; k++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    tryAt(c[0] + rand(-1, 1), c[1] + rand(-1, 1));
  }
}
// somewhere for an enemy to turn up: anywhere you could walk to, away from you and the middle
function enemySpot(avoid) {
  const cells = reachMap().cells;
  let pick = cells[0];
  for (let k = 0; k < 200; k++) {
    pick = cells[Math.floor(Math.random() * cells.length)];
    if (Math.hypot(pick[0] - avoid[0], pick[1] - avoid[2]) > 50 && Math.hypot(pick[0], pick[1]) > 45 && pastCoast(pick[0], pick[1]) < -8 && riverDistance(pick[0], pick[1]) > RIVER.bank + 2 && !caveAt(pick[0], pick[1], 2) && !nearHouse(pick[0], pick[1], 7)) break;
  }
  return [pick[0], walkHeight(pick[0], pick[1]), pick[1]];
}

// ---------------------------------------------------------------- the sign in the middle
const START = [0, 0, 7];                                     // you arrive facing it
const signProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; uniform mat4 uViewProj, uModel; out vec3 vW; out vec3 vN; out vec2 vUv;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aNrm; vUv = aUv; gl_Position = uViewProj * w; }`, `
in vec3 vW; in vec3 vN; in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
${COMMON}
${FOG}
void main() {
  vec3 N = normalize(vN);
  vec3 col = texture(uTex, vUv).rgb * (0.62 + 0.55 * max(dot(N, uSun), 0.0) * shadowAt(vW + N * 0.02));
  o = vec4(fogged(col, vW), 1.0);
}`);
let sign = null;
function makeSign() {
  const art = document.createElement('canvas'); art.width = 1024; art.height = 512;
  const g = art.getContext('2d');
  // top part: the painted board. bottom strip: bare wood for the posts and edges
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#7a5230' : '#855a35'; g.fillRect(0, i * 32, 1024, 32); }
  g.fillStyle = 'rgba(40,22,8,0.5)';
  for (let i = 0; i < 520; i++) g.fillRect(Math.random() * 1024, Math.random() * 512, 20 + Math.random() * 90, 2);
  g.fillStyle = '#fff3d6'; g.strokeStyle = '#2b1807'; g.lineWidth = 12; g.lineJoin = 'round';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 116px "Trebuchet MS", "Segoe UI", sans-serif';
  for (const [text, y] of [['something', 130], ['cool here', 266]]) { g.strokeText(text, 512, y); g.fillText(text, 512, y); }
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, art);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const v = [], idx = [];
  const quad = (pts, n, uv) => {
    const base = v.length / 8;
    pts.forEach((p, k) => v.push(...p, ...n, ...uv[k]));
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const wood = [[0.02, 0.8], [0.98, 0.8], [0.98, 0.98], [0.02, 0.98]], words = [[0, 0.77], [1, 0.77], [1, 0], [0, 0]];
  const box = (x0, x1, y0, y1, z0, z1, painted) => {
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], painted ? words : wood);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], painted ? words : wood);
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], wood);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], wood);
    quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], wood);
  };
  box(-1.45, -1.25, 0, 2.5, -0.1, 0.1); box(1.25, 1.45, 0, 2.5, -0.1, 0.1);
  box(-1.8, 1.8, 1.2, 2.45, 0.1, 0.2, true);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  buffer(gl.ARRAY_BUFFER, new Float32Array(v));
  attrib(0, null, 3, gl.FLOAT, false, 32, 0); attrib(1, null, 3, gl.FLOAT, false, 32, 12); attrib(2, null, 2, gl.FLOAT, false, 32, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length, tex };
}
function drawSign(vp, light, eye) {
  if (!sign) sign = makeSign();
  globals(signProg, vp, light, eye); gl.uniform1i(signProg.u.uTex, 0);
  gl.uniform3fv(signProg.u.uSky, SKY.island); gl.uniform2fv(signProg.u.uFog, fogRange());
  gl.uniformMatrix4fv(signProg.u.uModel, false, m4(M3.id(), [0, groundHeight(0, 0) - 0.05, 0]));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sign.tex);
  gl.bindVertexArray(sign.vao); gl.drawElements(gl.TRIANGLES, sign.count, gl.UNSIGNED_SHORT, 0);
}

// ---------------------------------------------------------------- the landmarks
// T: the tools the plant builder works with
function buildPlaces(T) {
  const { rnd, patch, add, limb, stone, boulder, leafy, pine, palm, clump, shadeOf, first } = T;
  const ground = (x, z) => groundHeight(x, z);
  const here = (x, z, seed) => { T.use(patch(x, z), seed); return [x, ground(x, z) - 0.1, z]; };
  const post = (x, z, r, h) => { if (first) solids.push({ x, z, y: ground(x, z), r, h }); };
  const GREY = [0.42, 0.40, 0.37], IVORY = [0.80, 0.74, 0.60], HIDE = [0.50, 0.34, 0.20], BARK = [0.27, 0.17, 0.10];

  if (first) { addRails(); addCaveWalls(); addHouseWalls(); }
  // the sign in the middle is solid too
  if (first) {
    const y = ground(0, 0), a = [-1.8, y + 0.2, 0.05], b = [1.8, y + 0.2, 0.05], c = [1.8, y + 2.4, 0.05], d = [-1.8, y + 2.4, 0.05];
    solids.push({ x: 0, z: 0.05, y, r: 2.3, h: 2.4, hull: [[-1.8, -0.1], [1.8, -0.1], [1.8, 0.2], [-1.8, 0.2]], tris: [[[a[0], y + 1.15, 0.2], [b[0], y + 1.15, 0.2], [c[0], c[1], 0.2]], [[a[0], y + 1.15, 0.2], [c[0], c[1], 0.2], [d[0], d[1], 0.2]]] });
  }

  // a ring of standing stones round a flat altar
  {
    const [cx, cz] = SPOTS.circle;
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2, x = cx + Math.sin(a) * 11, z = cz + Math.cos(a) * 11, at = here(x, z, 100 + k);
      const rock = stone([x, at[1] - 0.4, z], 1.0, shadeOf(GREY, rnd(0.9, 1.1)), 1, [0.85, 3.6, 0.7]);
      if (first) addShape(rock.tris, ground(x, z));
    }
    const at = here(cx, cz, 120), slab = stone([cx, at[1] - 0.15, cz], 1.7, shadeOf(GREY, 0.9), 1, [1.3, 0.45, 1]);
    if (first) addShape(slab.tris, ground(cx, cz));
  }
  // one enormous old tree
  {
    const [x, z] = SPOTS.elder, at = here(x, z, 200);
    leafy(at, 2.6, 0.3);
    for (let k = 0; k < 9; k++) clump([x + rnd(-4.5, 4.5), at[1] + rnd(10.5, 14.5), z + rnd(-4.5, 4.5)], rnd(2.0, 2.8), 90, 0.75, [0.17, 0.38, 0.10]);
    post(x, z, 1.0, 9);
  }
  // the skeleton of something very big
  {
    const [cx, cz] = SPOTS.bones, y = ground(cx, cz);
    let last = null;
    for (let k = 0; k <= 8; k++) {
      const x = cx - 8 + k * 2, size = 1 - Math.abs(k - 3.5) / 8, at = here(x, cz, 300 + k), top = [x, y + 2.9 * size + 0.4, cz];
      if (last) limb(last, top, 0.3, 0.3, IVORY, 7);
      last = top;
      if (k % 2 === 0) for (const side of [-1, 1]) {
        const knee = [x, y + 2.6 * size + 0.3, cz + side * 2.4 * size], foot = [x, ground(x, cz + side * 3.0 * size) - 0.2, cz + side * 3.0 * size];
        limb(top, knee, 0.2, 0.17, IVORY, 6); limb(knee, foot, 0.17, 0.07, IVORY, 6);
        post(x, foot[2], 0.22, 2.2 * size);
      }
    }
    const at = here(cx + 10.2, cz, 320), skull = stone([at[0], at[1] + 0.1, cz], 1.25, IVORY, 1, [1.25, 0.95, 0.9]);
    if (first) addShape(skull.tris, ground(cx + 10.2, cz));
    for (const side of [-1, 1]) limb([cx + 10.8, y + 1.0, cz + side * 0.8], [cx + 13.2, y + 2.0, cz + side * 1.5], 0.22, 0.03, IVORY, 6);
  }
  // an old camp: hide tents round a cold fire, and a totem
  {
    const [cx, cz] = SPOTS.camp;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, x = cx + Math.sin(a) * 12, z = cz + Math.cos(a) * 12, at = here(x, z, 400 + k), s = rnd(0.9, 1.2);
      add(coneData(2.3 * s, 3.4 * s, 9), at, shadeOf(HIDE, rnd(0.85, 1.15)));
      for (let p = 0; p < 4; p++) { const b = p * 1.57 + 0.4; limb([x + Math.cos(b) * 0.5, at[1] + 2.6 * s, z + Math.sin(b) * 0.5], [x - Math.cos(b) * 0.4, at[1] + 4.0 * s, z - Math.sin(b) * 0.4], 0.06, 0.04, BARK, 5); }
      post(x, z, 1.8 * s, 2.6 * s);
    }
    const at = here(cx, cz, 420);
    for (let k = 0; k < 10; k++) { const a = k * 0.628; stone([cx + Math.sin(a) * 1.2, at[1], cz + Math.cos(a) * 1.2], 0.3, shadeOf(GREY, rnd(0.8, 1)), 0); }
    for (let k = 0; k < 4; k++) { const a = k * 0.8; limb([cx - Math.sin(a) * 0.9, at[1] + 0.15, cz - Math.cos(a) * 0.9], [cx + Math.sin(a) * 0.9, at[1] + 0.3, cz + Math.cos(a) * 0.9], 0.12, 0.1, [0.12, 0.08, 0.05], 6); }
    const foot = here(cx + 4, cz - 3, 430);
    limb(foot, [foot[0], foot[1] + 4.6, foot[2]], 0.32, 0.24, BARK, 9);
    for (let k = 0; k < 3; k++) stone([foot[0], foot[1] + 1.3 + k * 1.25, foot[2]], 0.42, shadeOf(IVORY, 1 - k * 0.12), 1);
    for (const side of [-1, 1]) limb([foot[0], foot[1] + 4.4, foot[2]], [foot[0] + side * 1.3, foot[1] + 5.2, foot[2]], 0.13, 0.03, IVORY, 6);
    post(foot[0], foot[2], 0.4, 4.6);
  }
  // a field of big boulders to duck between
  {
    const [cx, cz] = SPOTS.boulders;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const x = cx + i * 9 + (bump(i * 5, j * 9) - 0.5) * 6, z = cz + j * 9 + (bump(j * 7, i * 3) - 0.5) * 6;
      if (Math.hypot(x - cx, z - cz) > 31 || pastCoast(x, z) > -8 || bump(i * 11, j * 13) < 0.2) continue;
      const at = here(x, z, 500 + i * 10 + j), size = 1.1 + bump(i, j * 17) * 1.5;
      const rock = boulder([x, at[1], z], size, bump(i * 2, j * 2));
      if (first) addShape(rock.flatMap(part => part.tris), ground(x, z));
    }
  }
  // a dark wood of tall pines
  {
    const [cx, cz] = SPOTS.pines;
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = cx + i * 6 + (bump(i * 3, j * 8) - 0.5) * 4, z = cz + j * 6 + (bump(j * 4, i * 6) - 0.5) * 4;
      if (Math.hypot(x - cx, z - cz) > 36 || pastCoast(x, z) > -8 || bump(i * 9, j * 5) < 0.25) continue;
      const at = here(x, z, 700 + i * 20 + j), s = 1.15 + bump(i, j) * 0.45;
      pine(at, s, bump(j, i));
      post(x, z, 0.3 * s, 3.5 * s);
    }
  }
  // black boulders thrown round the lip of the volcano
  {
    const [cx, cz] = SPOTS.volcano;
    for (let k = 0; k < 22; k++) {
      const a = k / 22 * Math.PI * 2, d = 23 + bump(k, 41) * 30, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      const at = here(x, z, 1000 + k), rock = stone([x, at[1] - 0.9, z], 0.8 + bump(k, 7) * 1.8, [0.17, 0.14, 0.13], 1);
      if (first) addShape(rock.tris, ground(x, z));
    }
  }
  // natural stone arches: one run of overlapping rock from the ground, over, and down again
  {
    const [cx, cz] = SPOTS.arches;
    [[-14, -8, 0.3, 1], [8, 4, 1.5, 1.35], [-4, 18, 2.4, 0.8]].forEach(([ox, oz, turn, s], k) => {
      const x = cx + ox, z = cz + oz, dx = Math.cos(turn), dz = Math.sin(turn), R = 5.2 * s, y = ground(x, z), PIECES = 17;
      for (let n = 0; n <= PIECES; n++) {
        const a = n / PIECES * Math.PI, out = Math.cos(a) * R, up = Math.pow(Math.sin(a), 0.75) * R * 1.15;
        const px = x + dx * out, pz = z + dz * out, fat = s * (1.45 - 0.5 * Math.sin(a));
        here(px, pz, 1100 + k * 20 + n);
        const rock = stone([px, y - 0.5 + up, pz], fat, shadeOf(GREY, rnd(0.85, 1.08)), 1, [1.1, 1.15, 1.1]);
        if (first && up < 1.4) addShape(rock.tris, ground(px, pz));    // only the feet get in your way
      }
    });
  }
  // where the mammoths went to die
  {
    const [cx, cz] = SPOTS.mammoths;
    [[-12, -6, 0.4], [10, -10, 2.1], [2, 14, 4.2]].forEach(([ox, oz, turn], n) => {
      const x = cx + ox, z = cz + oz, y = ground(x, z), at = here(x, z, 1200 + n), fx = Math.sin(turn), fz = Math.cos(turn);
      const place = (along, side, up) => [x + fx * along - fz * side, y + up, z + fz * along + fx * side];
      for (let k = 0; k < 4; k++) {
        const along = -3 + k * 1.7, size = 1 - Math.abs(k - 1.5) * 0.12;
        limb(place(along, 0, 2.3 * size), place(along + 1.7, 0, 2.3 * size), 0.22, 0.2, IVORY, 6);
        for (const side of [-1, 1]) {
          limb(place(along, 0, 2.3 * size), place(along, side * 1.7 * size, 1.9 * size), 0.15, 0.12, IVORY, 6);
          limb(place(along, side * 1.7 * size, 1.9 * size), place(along, side * 2.0 * size, -0.2), 0.12, 0.06, IVORY, 6);
          const foot = place(along, side * 2.0 * size, 0);
          post(foot[0], foot[2], 0.18, 1.6);
        }
      }
      const head = place(5.0, 0, 0), skull = stone([head[0], y + 0.1, head[2]], 1.1, IVORY, 1, [1, 1.1, 1]);
      if (first) addShape(skull.tris, ground(head[0], head[2]));
      for (const side of [-1, 1]) {                            // long curling tusks
        let last = place(5.6, side * 0.6, 1.2);
        for (let k = 1; k <= 7; k++) {
          const u = k / 7, next = place(5.6 + 3.4 * Math.sin(u * 2.2), side * (0.6 + 1.1 * u), 1.2 - 1.1 * Math.sin(u * Math.PI) + 1.7 * u * u);
          limb(last, next, 0.24 * (1 - u * 0.7), 0.24 * (1 - (u + 0.14) * 0.7), [0.88, 0.82, 0.68], 7);
          last = next;
        }
      }
    });
  }
  // a fishing camp: huts, drying racks and dugout boats
  {
    const [cx, cz] = SPOTS.fishers;
    [[-16, -4], [-6, -16], [9, -14], [18, -2], [-12, 13], [12, 12]].forEach(([ox, oz], k) => {
      const x = cx + ox, z = cz + oz, at = here(x, z, 1300 + k), s = 0.85 + bump(k, 5) * 0.4;
      add(coneData(2.4 * s, 3.1 * s, 8), at, shadeOf(HIDE, 0.85 + bump(k, 9) * 0.35));
      limb([x, at[1] + 2.8 * s, z], [x + 0.4, at[1] + 4.0 * s, z - 0.3], 0.07, 0.04, BARK, 5);
      post(x, z, 1.8 * s, 2.4 * s);
    });
    for (let r = 0; r < 3; r++) {
      const x = cx - 7 + r * 7, z = cz + 1, at = here(x, z, 1320 + r), y = at[1];
      for (const side of [-1.6, 1.6]) { limb([x + side, y, z], [x + side, y + 2.2, z], 0.12, 0.1, BARK, 6); post(x + side, z, 0.16, 2.2); }
      limb([x - 1.8, y + 2.1, z], [x + 1.8, y + 2.1, z], 0.07, 0.07, BARK, 6);
      for (let f = 0; f < 6; f++) add(blob(0.12, 0.34, 0.05, [0, 0, 0], 0.1, 6), [x - 1.25 + f * 0.5, y + 1.7, z], [0.35, 0.45, 0.55]);
    }
    for (let k = 0; k < 3; k++) {
      const x = cx - 9 + k * 9, z = cz + 20 + bump(k, 3) * 3, at = here(x, z, 1340 + k);
      const boat = stone([x, at[1], z], 0.9, [0.38, 0.25, 0.13], 1, [2.6, 0.55, 0.75]);
      if (first) addShape(boat.tris, ground(x, z));
    }
  }
  // a grove of giant old trees
  {
    const [cx, cz] = SPOTS.grove;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const x = cx + i * 17 + (bump(i * 7, j * 3) - 0.5) * 9, z = cz + j * 17 + (bump(j * 5, i * 11) - 0.5) * 9;
      if (pastCoast(x, z) > -10 || riverDistance(x, z) < RIVER.bank + 3 || bump(i * 13, j * 17) < 0.2) continue;
      const at = here(x, z, 1400 + i * 9 + j), s = 1.7 + bump(i, j * 3) * 0.8;
      leafy(at, s, bump(j * 2, i));
      post(x, z, 0.4 * s, 3.5 * s);
    }
  }
  // great stone heads, staring
  {
    const [cx, cz] = SPOTS.heads;
    for (let k = 0; k < 6; k++) {
      const x = cx - 6 + bump(k, 19) * 5, z = cz - 20 + k * 8, at = here(x, z, 1500 + k), y = at[1], s = 0.9 + bump(k, 23) * 0.35;
      // a column of rock with the face built out of it, everything sunk into its neighbour
      const head = stone([x, y - 0.5, z], 1.6 * s, [0.38, 0.37, 0.34], 1, [0.95, 1.2, 1.0]);
      stone([x, y + 0.9 * s, z], 1.45 * s, [0.37, 0.36, 0.33], 1, [0.9, 1.2, 0.95]);
      stone([x, y + 2.2 * s, z], 1.35 * s, [0.39, 0.38, 0.35], 1, [0.9, 1.2, 0.95]);
      stone([x - 0.75 * s, y + 2.85 * s, z], 0.75 * s, [0.30, 0.29, 0.26], 1, [1.0, 0.6, 1.6]);    // brow
      stone([x - 1.0 * s, y + 1.7 * s, z], 0.55 * s, [0.44, 0.42, 0.38], 1, [0.9, 1.9, 0.7]);      // nose
      stone([x - 0.85 * s, y + 1.0 * s, z], 0.55 * s, [0.24, 0.23, 0.21], 1, [0.9, 0.5, 1.5]);     // mouth
      if (first) addShape(head.tris, ground(x, z));
    }
  }
  // a ring of sharpened logs with two ways in
  {
    const [cx, cz] = SPOTS.fort, R = 21;
    for (let k = 0; k < 120; k++) {
      const a = k / 120 * Math.PI * 2;
      if (Math.abs(Math.sin(a * 0.5 - 0.55)) < 0.09 || Math.abs(Math.sin(a * 0.5 - 2.1)) < 0.09) continue;
      const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R, at = here(x, z, 1600 + k), high = 3.0 + bump(k, 29) * 0.7;
      limb(at, [x, at[1] + high, z], 0.52, 0.48, BARK, 7);
      limb([x, at[1] + high, z], [x, at[1] + high + 0.8, z], 0.48, 0.03, [0.45, 0.30, 0.17], 7);
      post(x, z, 0.55, high);
    }
    for (const [ox, oz] of [[-7, -6], [8, 3], [-2, 9]]) {
      const x = cx + ox, z = cz + oz, at = here(x, z, 1750 + ox);
      add(coneData(2.5, 3.5, 9), at, shadeOf(HIDE, 0.95));
      post(x, z, 1.9, 2.7);
    }
  }
  // a lookout built of logs
  {
    const [cx, cz] = SPOTS.tower, at = here(cx, cz, 1800), y = at[1];
    const corner = (i, j, h) => [cx + i * (2.6 - h * 0.09), y + h, cz + j * (2.6 - h * 0.09)];
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    ring.forEach(([i, j], k) => {
      const [ni, nj] = ring[(k + 1) % 4];
      limb(corner(i, j, 0), corner(i, j, 11), 0.28, 0.2, BARK, 8);
      for (const h of [0, 3.6, 7.2]) { limb(corner(i, j, h), corner(ni, nj, h + 3.6), 0.09, 0.09, BARK, 6); limb(corner(i, j, h + 3.6), corner(ni, nj, h + 3.6), 0.12, 0.12, BARK, 6); }
      limb(corner(i, j, 12), corner(ni, nj, 12), 0.1, 0.1, BARK, 6);
      limb(corner(i, j, 11), corner(i, j, 12.1), 0.12, 0.1, BARK, 6);
      post(cx + i * 2.6, cz + j * 2.6, 0.32, 10);
    });
    for (let k = -5; k <= 5; k++) limb([cx - 2, y + 11, cz + k * 0.36], [cx + 2, y + 11, cz + k * 0.36], 0.17, 0.17, [0.42, 0.28, 0.15], 6);
    add(coneData(2.9, 2.3, 8), [cx, y + 13.3, cz], shadeOf(HIDE, 0.8));
    for (const [i, j] of ring) limb(corner(i, j, 12), [cx + i * 1.7, y + 13.4, cz + j * 1.7], 0.09, 0.09, BARK, 5);
  }
  // palms crowding the shore of the bay
  for (let k = 0; k < 46; k++) {
    const a = 0.62 + bump(k, 91) * 0.26, d = coast(a) - 8 - bump(k, 57) * 24, x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (ground(x, z) < 0.3) continue;
    const at = here(x, z, 900 + k), s = 0.8 + bump(k, 13) * 0.5;
    palm(at, s, bump(k, 3) * 6.3);
    post(x, z, 0.24 * s, 2.2 * s);
  }
}
