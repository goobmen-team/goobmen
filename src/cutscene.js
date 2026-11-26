// ======================================================================= the boat trip
// choosing the island from the menu plays this: you and the skipper cruising in with the boombox going,
// a cheers, a rock, and waking up on the beach beside the burning wreck. Space skips it
const CINE_WORDS = false;
const CINE = {
  driver: 5.5, you: 10.0, boom: 14.5, cheers: 18.5, chug: 24.0, point: 27.0, huh: 28.2, rock: 29.0, hit: 31.0, black: 33.2, eyes: 36.0, up: 41.0, end: 49.5
};
// where it happens: in over the palm cove. D points out to sea from the middle of the island
const TRIP = (() => {
  const a = 0.75, D = [Math.sin(a), 0, Math.cos(a)], R = coast(a), left = [Math.cos(a), 0, -Math.sin(a)];
  const yaw = a + Math.PI, fwd = [-D[0], 0, -D[2]];                    // the boat comes straight in
  const at = (out, side, y) => [D[0] * (R + out) + left[0] * (side || 0), y || 0, D[2] * (R + out) + left[2] * (side || 0)];
  return { a, D, R, left, yaw, fwd, at, rock: at(13, 0.2, SEA.level), impact: at(16.4, 0, 0) };
})();

// ---------------------------------------------------------------- the sea and the sky, dressed up for it
// four swells, the same sum here and in the shader
const SWELL = [[0.96, 0.28, 17, 0.17], [0.50, -0.87, 9.5, 0.085], [-0.30, 0.95, 5.5, 0.045], [0.80, -0.60, 3.3, 0.022]];
const shoal = (x, z) => smooth(2, 34, pastCoast(x, z));                 // the swell dies away in the shallows
function swell(x, z, t) {
  let h = 0;
  for (const [dx, dz, L, A] of SWELL) { const k = 6.28318 / L; h += A * Math.sin((x * dx + z * dz) * k - t * Math.sqrt(9.8 * k)); }
  return SEA.level + h * shoal(x, z);
}
const SKYCOL = `
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vn(p) * 0.5 + vn(p * 2.03 + 7.1) * 0.25 + vn(p * 4.01 + 3.7) * 0.15 + vn(p * 8.1) * 0.1; }
vec3 skyColour(vec3 d, vec3 sunDir, float t) {
  float y = max(d.y, 0.0);
  vec3 col = mix(vec3(1.0, 0.84, 0.68), vec3(0.62, 0.81, 0.96), smoothstep(0.0, 0.17, y));
  col = mix(col, vec3(0.18, 0.44, 0.84), smoothstep(0.10, 0.72, y));
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.82, 0.52) * (pow(s, 900.0) * 1.6 + pow(s, 28.0) * 0.26);
  vec2 uv = d.xz / (y + 0.13) * 1.15 + vec2(t * 0.006, 0.0);
  float c = fbm(uv + 0.6 * fbm(uv * 1.7));
  float cloud = smoothstep(0.50, 0.76, c) * smoothstep(0.015, 0.11, y);
  vec3 body = mix(vec3(1.0, 0.96, 0.90), vec3(0.74, 0.74, 0.86), smoothstep(0.62, 0.9, c));
  return mix(col, body, cloud * 0.92);
}`;
const skyProg = program(`layout(location=0) in vec2 aPos; out vec2 vP; void main() { vP = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`, `
in vec2 vP; out vec4 o; uniform vec3 uRight, uUp, uFwd, uSun; uniform vec2 uTan; uniform float uTime;
${SKYCOL}
void main() { o = vec4(skyColour(normalize(uFwd + uRight * vP.x * uTan.x + uUp * vP.y * uTan.y), uSun, uTime), 1.0); }`);
const oceanProg = program(`layout(location=0) in vec3 aPos; uniform mat4 uViewProj; uniform vec2 uCentre; uniform float uTime;
out vec3 vW; out float vPast;
const vec4 SW[4] = vec4[4](vec4(0.96, 0.28, 17.0, 0.17), vec4(0.50, -0.87, 9.5, 0.085), vec4(-0.30, 0.95, 5.5, 0.045), vec4(0.80, -0.60, 3.3, 0.022));
float bulge(float a, float at, float wide) { float q = sin((a - at) / 2.0) / wide; return exp(-q * q); }
void main() {
  vec2 p = aPos.xz + uCentre;
  float a = atan(p.x, p.y);
  vPast = length(p) - 4.0 * (105.0 + 13.0 * sin(3.0 * a + 1.1) + 9.0 * sin(5.0 * a + 2.6) + 4.0 * sin(11.0 * a) + 3.0 * sin(19.0 * a + 0.7) - 34.0 * bulge(a, 0.75, 0.11) + 28.0 * bulge(a, -2.3, 0.09));
  float h = 0.0;
  for (int i = 0; i < 4; i++) { float k = 6.28318 / SW[i].z; h += SW[i].w * sin(dot(p, SW[i].xy) * k - uTime * sqrt(9.8 * k)); }
  vW = vec3(p.x, ${SEA.level.toFixed(2)} + h * smoothstep(2.0, 34.0, vPast), p.y);
  gl_Position = uViewProj * vec4(vW, 1.0);
}`, `
in vec3 vW; in float vPast; out vec4 o;
uniform float uTime, uWake; uniform vec3 uEye, uSun, uSky; uniform vec2 uFog; uniform vec3 uBoat; uniform vec2 uHead; uniform vec3 uRock; uniform mat4 uHull; uniform int uCutHull;
${SKYCOL}
const vec4 SW[4] = vec4[4](vec4(0.96, 0.28, 17.0, 0.17), vec4(0.50, -0.87, 9.5, 0.085), vec4(-0.30, 0.95, 5.5, 0.045), vec4(0.80, -0.60, 3.3, 0.022));
float beam(float u) { return u < 0.55 ? 0.92 + 0.14 * smoothstep(0.0, 0.55, u) : 1.06 * sqrt(max(0.0, 1.0 - pow((u - 0.55) / 0.45, 2.1))); }
void main() {
  if (uCutHull == 1) {                                   // no sea inside the boat
    vec3 q = (uHull * vec4(vW, 1.0)).xyz;
    if (q.z > -2.4 && q.z < 2.55 && q.y < 0.7 && q.y > -0.6 && abs(q.x) < beam((q.z + 2.4) / 5.0) * 0.99) discard;
  }
  vec2 p = vW.xz;
  float far = length(vW - uEye), calm = smoothstep(2.0, 34.0, vPast);
  vec2 slope = vec2(0.0); float h = 0.0;
  for (int i = 0; i < 4; i++) { float k = 6.28318 / SW[i].z, ph = dot(p, SW[i].xy) * k - uTime * sqrt(9.8 * k); slope += SW[i].xy * SW[i].w * k * cos(ph); h += SW[i].w * sin(ph); }
  slope *= calm;
  // small ripples, two sets crossing, fading with distance
  vec2 e = vec2(0.12, 0.0), a = p * 1.7 + vec2(uTime * 0.9, uTime * 0.4), b = p * 4.3 - vec2(uTime * 0.7, uTime * 1.3);
  float ra = vn(a), rb = vn(b);
  slope += (vec2(vn(a + e.xy) - ra, vn(a + e.yx) - ra) * 0.75 + vec2(vn(b + e.xy) - rb, vn(b + e.yx) - rb) * 0.45) * (1.0 - smoothstep(18.0, 110.0, far));
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y)), V = normalize(uEye - vW);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float shallow = 1.0 - smoothstep(2.0, 46.0, vPast);
  vec3 body = mix(vec3(0.015, 0.20, 0.34), vec3(0.14, 0.66, 0.62), shallow);
  body += vec3(0.02, 0.17, 0.16) * clamp(h * 3.2, 0.0, 1.0) * calm;
  body *= 0.82 + 0.22 * max(dot(N, uSun), 0.0);
  vec3 col = mix(body, skyColour(R, uSun, uTime), fres * 0.88);
  float s = max(dot(reflect(-V, N), uSun), 0.0);
  col += vec3(1.0, 0.86, 0.6) * (pow(s, 500.0) * 2.4 + pow(s, 60.0) * 0.22);
  // foam: the shore, the crests, round the rock and the wake
  float grain = vn(p * 3.1 + uTime * vec2(0.6, -0.4)) * 0.65 + vn(p * 9.0 - uTime) * 0.35;
  float foam = (1.0 - smoothstep(0.2, 1.1, abs(vPast - 1.5 - 0.4 * sin(uTime * 1.6 + atan(p.x, p.y) * 40.0)))) * 0.85;
  foam = max(foam, smoothstep(0.21, 0.29, h * calm) * step(0.62, grain) * 0.5);
  float rd = length(p - uRock.xz);
  foam = max(foam, (1.0 - smoothstep(1.6, 3.8 + 0.5 * sin(uTime * 2.4), rd)) * step(0.42, grain));
  vec2 d = p - uBoat.xz; float along = dot(d, uHead), side = abs(d.x * uHead.y - d.y * uHead.x);
  float back = -along - 2.3;
  if (back > -0.6 && uWake > 0.0) {
    float spread = 0.85 + max(back, 0.0) * 0.27, fade = exp(-max(back, 0.0) / 17.0);
    float arms = 1.0 - smoothstep(0.1, 0.55 + back * 0.04, abs(side - spread));
    float churn = (1.0 - smoothstep(0.2, 0.9 + back * 0.09, side)) * exp(-max(back, 0.0) / 9.0);
    foam = max(foam, uWake * max(arms * fade * smoothstep(0.30, 0.62, grain), churn * smoothstep(0.22, 0.55, grain)));
  }
  foam = max(foam, uWake * (1.0 - smoothstep(0.05, 0.45, abs(side - 0.98))) * smoothstep(-2.4, -1.6, along) * (1.0 - smoothstep(1.0, 2.6, along)) * smoothstep(0.38, 0.66, grain));
  col = mix(col, vec3(0.96, 0.98, 0.99), clamp(foam, 0.0, 1.0));
  col = mix(col, uSky, smoothstep(uFog.x, uFog.y, far));
  o = vec4(col, mix(0.68, 1.0, smoothstep(-1.0, 16.0, vPast)));
}`);
const oceanMesh = (() => {                                    // rings round the boat, closer together near it
  const NR = 104, NA = 144, v = [], i = [];
  for (let r = 0; r <= NR; r++) { const d = 640 * (r / NR) ** 2.6 + r * 0.12; for (let a = 0; a <= NA; a++) { const t = a / NA * Math.PI * 2; v.push(Math.sin(t) * d, 0, Math.cos(t) * d, 0, 1, 0, 0, 0); } }
  for (let r = 0; r < NR; r++) for (let a = 0; a < NA; a++) { const k = r * (NA + 1) + a; i.push(k, k + 1, k + NA + 2, k, k + NA + 2, k + NA + 1); }
  return staticMesh(new Float32Array(v), new Uint32Array(i));
})();
const skyVao = (() => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); attrib(0, new Float32Array([-1, -1, 3, -1, -1, 3]), 2, gl.FLOAT); gl.bindVertexArray(null); return vao; })();

// ---------------------------------------------------------------- flames and smoke
const puffVs = `layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
uniform mat4 uViewProj; out vec2 vUv; out vec4 vCol; void main() { vUv = aUv; vCol = aCol; gl_Position = uViewProj * vec4(aPos, 1.0); }`;
const fireProg = program(puffVs, `
in vec2 vUv; in vec4 vCol; out vec4 o; uniform float uTime;
${SKYCOL}
void main() {
  // vCol: r a seed, g 0 for a flame and 1 for smoke, a how strong
  float seed = vCol.r * 37.0;
  if (vCol.g < 0.5) {
    float x = vUv.x, y = vUv.y * 0.5 + 0.5;
    float n = fbm(vec2(x * 2.3 + seed, y * 2.4 - uTime * 2.9)), n2 = fbm(vec2(x * 5.0 - seed, y * 5.0 - uTime * 5.5));
    float wob = (n - 0.5) * 0.9 * y;
    float body = 1.0 - abs(x + wob) * (1.15 + y * 1.5) - y * 0.95 + (n * 0.9 + n2 * 0.5 - 0.55);
    float f = clamp(body * 2.1, 0.0, 1.0) * smoothstep(0.0, 0.09, y) * vCol.a;
    vec3 col = mix(vec3(0.85, 0.10, 0.01), vec3(1.0, 0.50, 0.03), smoothstep(0.08, 0.55, f));
    col = mix(col, vec3(1.0, 0.93, 0.55), smoothstep(0.55, 1.0, f));
    o = vec4(col * min(1.0, f * 1.7), min(1.0, f * 1.15) * 0.82);
  } else {
    float r = length(vUv);
    float n = fbm(vUv * 1.9 + seed + vec2(0.0, -uTime * 0.25));
    float a = clamp((1.0 - r) * 1.5 + (n - 0.55) * 1.6, 0.0, 1.0) * vCol.a;
    vec3 col = mix(vec3(0.07, 0.065, 0.065), vec3(0.36, 0.34, 0.33), vCol.b + (n - 0.5) * 0.4 + vUv.y * 0.12);
    o = vec4(col * a, a);
  }
}`);
const smoke = [];
let smokeWait = 0;
// flames at each fire (p, size), and the smoke rising off them
function drawFires(vp, eye, fwd, fires, t) {
  const right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd);
  gl.useProgram(fireProg.p); gl.uniformMatrix4fv(fireProg.u.uViewProj, false, vp); gl.uniform1f(fireProg.u.uTime, t);
  gl.enable(gl.BLEND); gl.depthMask(false);
  for (const s of smoke.slice().sort((a, b) => V.len(V.sub(b.p, eye)) - V.len(V.sub(a.p, eye)))) {
    const k = s.age / s.life, size = s.size * (0.5 + 2.4 * k);
    quad(s.p, V.mul(right, size), V.mul(up, size), [s.seed, 1, 0.15 + 0.75 * k, 0.78 * smooth(0, 0.08, k) * (1 - k)]);
  }
  flushFx(false);
  const across = V.norm([right[0], 0, right[2]]);
  fires.forEach(([p, size], n) => {
    for (let j = 0; j < 3; j++) {
      const seed = ((n * 3 + j) * 0.137) % 1, tall = size * (1.25 + 0.3 * Math.sin(t * (7 + j) + n * 2.1)), wide = size * (0.62 - 0.1 * j);
      const base = V.add(p, V.mul(across, (j - 1) * size * 0.28));
      quad(V.add(base, [0, tall * 0.88, 0]), V.mul(across, wide), [0, tall, 0], [seed, 0, 0, 1]);
    }
  });
  flushFx(false);
  gl.depthMask(true); gl.disable(gl.BLEND);
}
function fireStep(dt, fires) {
  for (let i = smoke.length - 1; i >= 0; i--) {
    const s = smoke[i]; s.age += dt;
    if (s.age >= s.life) { smoke.splice(i, 1); continue; }
    s.p = V.mad(s.p, s.v, dt); s.v[0] += 0.12 * dt;
  }
  smokeWait -= dt;
  while (smokeWait <= 0) {
    smokeWait += 0.07;
    if (!fires.length || smoke.length > 120) continue;
    const [p, size] = fires[Math.floor(Math.random() * fires.length)];
    smoke.push({ p: [p[0] + rand(-0.2, 0.2), p[1] + size * 1.7, p[2] + rand(-0.2, 0.2)], v: [rand(-0.15, 0.25), rand(0.9, 1.5), rand(-0.2, 0.2)], age: 0, life: rand(3.2, 5), size: rand(0.28, 0.5) * (0.6 + size), seed: Math.random() });
    if (Math.random() < 0.6) particles.push({ p: [p[0] + rand(-0.3, 0.3), p[1] + rand(0.2, 0.9), p[2] + rand(-0.3, 0.3)], v: [rand(-0.4, 0.5), rand(0.8, 2.2), rand(-0.4, 0.4)], life: rand(0.8, 1.8), max: 1.8, size: rand(0.012, 0.028), color: [1.0, 0.55, 0.12, 1], grav: -0.25, add: true });
  }
}

// ---------------------------------------------------------------- the wreck left on the beach
let wreck = null;
function makeWreck() {
  const g = (out, side) => { const p = TRIP.at(out, side); p[1] = groundAt(p[0], p[2], 99); return p; };
  const yaw = TRIP.yaw;
  const half = (out, side, lift, turn, tip, nose, middle) => {
    const p = g(out, side), R = M3.mul(M3.ry(yaw + turn), M3.mul(M3.rz(tip), M3.rx(nose)));
    return { R, p: V.sub([p[0], p[1] + lift, p[2]], M3.vec(R, [0, 0.12, middle])) };
  };
  const stern = half(-1.1, 2.3, 0.24, 0.55, 0.50, -0.10, -1.35), bow = half(-0.6, -2.1, 0.20, -0.75, -0.40, 0.08, 1.2);
  const on = (h, q) => V.add(h.p, M3.vec(h.R, q));
  const planks = [];
  for (let i = 0; i < 18; i++) {
    const p = g(rand(-4.5, 1.2), rand(-5, 5));
    planks.push({ R: M3.mul(M3.ry(rand(0, 6.3)), M3.rz(rand(-0.25, 0.25))), p: [p[0], p[1] + 0.025, p[2]], s: rand(0.45, 1.2), burnt: i % 3 > 0 });
  }
  const loose = (out, side, y, R) => { const p = g(out, side); return { R, p: [p[0], p[1] + y, p[2]] }; };
  const w = {
    stern, bow, planks, t: 0,
    boombox: loose(-3.3, 1.6, -0.03, M3.mul(M3.ry(yaw - 0.35), M3.mul(M3.rz(0.22), M3.rx(-0.18)))),
    cans: [[-4.1, -1.3, 0.2], [-2.9, 3.6, 2.4], [-5.4, 1.0, 4.1]].map(([o, s, a]) => loose(o, s, 0.036, M3.mul(M3.ry(a), M3.rx(Math.PI / 2)))),
    ring: loose(-3.9, -2.5, 0.06, M3.mul(M3.ry(0.8), M3.rx(1.52))),
    fires: [], blocks: []
  };
  w.fires = [[on(stern, [0.35, 0.18, -1.5]), 0.55], [on(stern, [-0.4, 0.3, -0.9]), 0.36], [on(stern, [0, 0.55, -2.5]), 0.30], [on(bow, [-0.2, 0.2, 0.7]), 0.42], [planks[1].p, 0.16], [planks[5].p, 0.13]];
  for (const [h, zs] of [[stern, [-2.0, -1.3, -0.6]], [bow, [0.2, 1.1, 1.9]]]) for (const z of zs) { const c = on(h, [0, 0.2, z]); w.blocks.push([c, z > 1.5 ? 0.6 : 1.0]); }
  return w;
}
// keep people from walking through the hull
function wreckPush(f) {
  if (!wreck || world.map !== 'island') return;
  for (const [c, r] of wreck.blocks) if (Math.abs(c[1] - f.pos[1]) < 1.8) push(f, c, r + 0.25);
  const s = snoreSpot();
  push(f, s, 0.75);
}
function drawWreck(prog, w, t) {
  for (const k of ['sternBurnt', 'bowBurnt']) for (const part of BOAT[k].parts) if (part.kind === 9) part.glow = (k === 'sternBurnt' ? 1 : 0.7) * (0.75 + 0.25 * Math.sin(t * 5.3) * Math.sin(t * 2.1));
  drawBoatHalf(prog, false, m4(w.stern.R, w.stern.p, boatM), { burnt: true, prop: 0.7 });
  drawBoatHalf(prog, true, m4(w.bow.R, w.bow.p, boatM), { burnt: true, wheel: 2.1 });
  for (const q of w.planks) drawParts(prog, q.burnt ? CHARRED : PLANK, placed(M3.mul(q.R, [1, 0, 0, 0, 1, 0, 0, 0, q.s]), q.p));
  drawBoombox(prog, w.boombox.R, w.boombox.p, w.thump || 0, w.thump || 0, t * (w.thump ? 3 : 0));
  for (const c of w.cans) drawParts(prog, CAN, placed(c.R, c.p));
  drawParts(prog, [BOAT.stern.ring], placed(w.ring.R, w.ring.p));
  drawParts(prog, ROCKS, placed(M3.ry(0.7), TRIP.rock));
}

// ---------------------------------------------------------------- the two of them
const mate = makeFighter(false, [1, 1, 1]), skip = makeFighter(false, [0.82, 0.72, 0.70]);
mate.shades = true; skip.hat = true;
const SEAT = { mate: [-0.34, 0.30 + FLOOR, -1.55], skip: [0, 0.34 + FLOOR, 0.30] };

const HIP = 0.43;                                            // hips above the boat floor, sitting
const Arm = (wrist, dir, palm, elbow, curl) => ({ wrist, dir, palm, elbow, curl });
const Leg = (ankle, knee, foot) => ({ ankle, knee, foot: foot || 0 });
// an arm that puts a held can at `centre`, its top pointing along `up`, fingers going round toward `dir`
function canArm(s, centre, up, dir, elbow) {
  const t = V.norm(up), d = V.orth(dir, t), p = s === 'R' ? V.cross(t, d) : V.cross(d, t);
  return Arm(V.sub(centre, V.add(V.mul(d, 0.061), V.mul(p, 0.047))), d, p, elbow, 1.15);
}
// where his mouth is just now, in his own space
const mouthOf = f => f.wp[IDX.head] ? V.add(f.wp[IDX.head], M3.vec(f.wr[IDX.head], [0, 0.062, 0.275])) : [0, 1.1, 0.3];
// the can brought up to his lips and tipped (k: how far)
function drink(f, s, from, k) {
  const m = mouthOf(f), tip = V.norm([0, -0.62, -0.78]);
  const up = canArm(s, V.mad(m, tip, -0.075), tip, [s === 'R' ? 1 : -1, 0.15, 0.1], [s === 'R' ? -1 : 1, -0.45, 0.1]);
  const mix = (a, b) => V.lerp(a, b, k);
  return Arm(mix(from.wrist, up.wrist), V.norm(mix(from.dir, up.dir)), V.norm(mix(from.palm, up.palm)), mix(from.elbow, up.elbow), 1.15);
}
const window_ = (t, a, b, ease) => smooth(a, a + (ease || 0.35), t) * (1 - smooth(b - (ease || 0.35), b, t));

// you, sat at the back
function matePose(t, beat) {
  const nod = 0.5 + 0.5 * Math.cos(beat * 6.28318), sway = Math.sin(beat * Math.PI);
  const rest = canArm('R', [-0.31, 0.70, 0.30], [0, 1, 0.06], [0.45, 0, 0.9], [-1, -0.6, -0.3]);
  const P = {
    hips: [0, HIP - 0.012 * nod, 0], bend: -0.13 + 0.07 * nod, tilt: 0.07 * sway, head: [0.13 * nod - 0.04, 0.12 * Math.sin(t * 0.8), 0.09 * sway],
    L: Leg([0.25, 0.095, 0.50 + 0.0], [0.5, 0.4, 1], 0), R: Leg([-0.24, 0.095 + 0.03 * nod * 0, 0.58], [-0.35, 0.4, 1], -0.16 * (1 - nod)),
    armR: rest,
    armL: Arm([0.66, 0.79 + 0.008 * nod, 0.02], [0.7, -0.15, 0.7], [0, -1, 0], [0.2, -1, -0.5], 0.55)       // flung over the boombox
  };
  // sips
  const sip = Math.max(window_(t, 7.0, 9.2, 0.6), window_(t, 11.7, 13.8, 0.6));
  if (sip > 0) { P.armR = drink(mate, 'R', rest, sip); P.head = [P.head[0] - 0.34 * sip, P.head[1] * (1 - sip), P.head[2] * (1 - sip)]; P.bend -= 0.06 * sip; }
  // "yeah!": the other hand pumping along
  const pump = Math.max(window_(t, 16.0, 18.4), window_(t, 19.0, 20.8));
  if (pump > 0) P.armL = mixArm(P.armL, Arm([0.46, 1.34 + 0.13 * nod, 0.20], [0, 1, 0.2], [0, 0, 1], [1, -0.6, -0.2], 1.4), pump);
  // cheers
  const cheer = window_(t, 21.2, 23.7, 0.55);
  if (cheer > 0) {
    const hit = Math.exp(-(((t - 22.2) / 0.09) ** 2));
    P.armR = mixArm(P.armR, canArm('R', [0.10 - 0.015 * hit, 0.99, 0.60 + 0.035 * hit], [0.12 * hit, 1, 0.16], [0.4, 0.1, 0.9], [-1, -0.7, -0.1]), cheer);
    P.bend += 0.38 * cheer; P.head = [P.head[0] - 0.2 * cheer, 0.05, 0];
  }
  const after = window_(t, 24.0, 26.0, 0.5);
  if (after > 0) { P.armR = drink(mate, 'R', P.armR, after); P.head = [P.head[0] - 0.3 * after, 0, 0]; }
  // he has seen the rock
  const see = smooth(CINE.point - 0.1, CINE.point + 0.25, t);
  if (see > 0) {
    const shake = Math.sin(t * 31) * 0.016;
    P.armL = mixArm(P.armL, Arm([0.10 + shake, 1.13 + shake, 0.82], [-0.1, 0.1, 1], [0, -1, 0], [1, -0.8, 0], 0.1), see);
    P.armR = mixArm(P.armR, canArm('R', [-0.40, 0.66, 0.34], [0, 1, 0], [0.45, 0, 0.9], [-1, -0.5, -0.4]), see);
    P.bend = P.bend * (1 - see) + 0.34 * see; P.head = [-0.1 * see, 0.08 * Math.sin(t * 19) * see, 0]; P.tilt *= 1 - see;
    P.hips = [0, HIP + 0.05 * see, 0.03 * see];
  }
  return P;
}
const mixArm = (a, b, k) => Arm(V.lerp(a.wrist, b.wrist, k), V.norm(V.lerp(a.dir, b.dir, k)), V.norm(V.lerp(a.palm, b.palm, k)), V.lerp(a.elbow, b.elbow, k), a.curl + (b.curl - a.curl) * k);
// the skipper: at the wheel, then up and turned right round for a cheers (nobody steering)
function skipPose(t, beat) {
  const nod = 0.5 + 0.5 * Math.cos(beat * 6.28318 + 0.4), sway = Math.sin(beat * Math.PI + 0.6);
  const up = smooth(CINE.cheers + 1.2, CINE.cheers + 2.6, t);                 // 0 sat, 1 stood facing you
  const turn = Math.PI * up, step = Math.sin(Math.PI * up);
  const wheel = [0.13, 0.70, 0.45];
  const can = canArm('R', [-0.34, 0.76, 0.27], [0, 1, 0.05], [0.5, 0, 0.86], [-1, -0.55, -0.3]);
  const sat = {
    hips: [0, HIP + 0.03 - 0.014 * nod, 0], bend: 0.04 + 0.09 * nod, tilt: 0.09 * sway, head: [0.16 * nod - 0.05, 0.1 * Math.sin(t * 0.7 + 2), 0.1 * sway],
    L: Leg([0.22, 0.095, 0.42], [0.45, 0.3, 1]), R: Leg([-0.22, 0.095, 0.40], [-0.45, 0.3, 1], -0.2 * (1 - nod)),
    armL: Arm(wheel, [-0.3, 0.25, 1], [-0.2, -1, 0.15], [1, -0.7, -0.2], 1.0), armR: can
  };
  const sip = Math.max(window_(t, 8.0, 10.2, 0.6), window_(t, 15.0, 17.0, 0.6));
  if (sip > 0) { sat.armR = drink(skip, 'R', can, sip); sat.head = [sat.head[0] - 0.36 * sip, 0, 0]; }
  const stand = {
    hips: [0, 0.64 - 0.016 * nod, 0], bend: 0.12 + 0.05 * nod, tilt: 0.05 * sway, head: [0.1 * nod - 0.05, 0, 0.07 * sway],
    L: Leg([0.24, 0.095, 0.06], [0.25, 0, 1]), R: Leg([-0.24, 0.095, -0.02], [-0.25, 0, 1]),
    armL: Arm([0.52, 0.86, 0.12], [0.4, -1, 0.2], [-1, 0, 0], [1, 0, -0.7], 0.5), armR: can
  };
  const cheer = window_(t, 21.2, 23.7, 0.55);
  if (cheer > 0) {
    const hit = Math.exp(-(((t - 22.2) / 0.09) ** 2));
    stand.armR = canArm('R', [-0.10 - 0.015 * hit, 0.99, 0.585 + 0.035 * hit], [-0.12 * hit, 1, 0.16], [0.5, 0.1, 0.86], [-1, -0.7, -0.1]);
    stand.armR = mixArm(can, stand.armR, cheer);
    stand.bend += 0.34 * cheer;
  }
  // down the hatch
  const chug = window_(t, CINE.chug, CINE.huh + 0.3, 0.55);
  if (chug > 0) { stand.armR = drink(skip, 'R', stand.armR, chug); stand.head = [-0.55 * chug + 0.05 * Math.sin(t * 17), 0, 0]; stand.bend -= 0.14 * chug; stand.armL = mixArm(stand.armL, Arm([0.62, 1.0, 0.1], [1, 0.2, 0], [0, 0, 1], [0.5, -1, -0.2], 0.2), chug); }
  const huh = smooth(CINE.huh, CINE.huh + 0.4, t);
  if (huh > 0) { stand.head = [stand.head[0] * (1 - huh) + 0.05 * huh, 1.35 * smooth(CINE.huh + 0.45, CINE.huh + 0.9, t), -0.2 * (1 - smooth(CINE.huh + 0.5, CINE.huh + 0.9, t)) * huh]; stand.tilt = 0; }
  const P = up <= 0 ? sat : up >= 1 ? stand : mixRide([[sat, 1 - up], [stand, up]]);
  if (step > 0) { P.L.ankle = V.add(P.L.ankle, [0, 0.16 * Math.max(0, Math.sin(up * Math.PI * 2)), 0]); P.R.ankle = V.add(P.R.ankle, [0, 0.16 * Math.max(0, -Math.sin(up * Math.PI * 2)), 0]); }
  return { P, turn, root: [0, FLOOR, SEAT.skip[2] - 0.55 * up] };
}
// flung through the air
function flail(t, seed) {
  const w = t * 17 + seed;
  return {
    hips: [0, 0.7, -0.015], bend: 0.25 * Math.sin(w * 0.6), tilt: 0.1 * Math.sin(w * 0.4), head: [-0.1, 0.4 * Math.sin(w * 0.7), 0],
    L: Leg([0.36, 0.26 + 0.22 * (1 + Math.sin(w)), 0.1 + 0.25 * Math.cos(w)], [0.3, 0, 1]), R: Leg([-0.36, 0.26 + 0.22 * (1 - Math.sin(w)), 0.1 - 0.25 * Math.cos(w)], [-0.3, 0, 1]),
    armL: Arm([0.8, 1.3 + 0.45 * Math.sin(w), 0.02], [1, 0, 0], [0, 0, 1], [0, -1, 0], 0.2), armR: Arm([-0.8, 1.3 - 0.45 * Math.sin(w), 0.02], [-1, 0, 0], [0, 0, 1], [0, -1, 0], 0.2)
  };
}
// on his back on the sand, sitting up, standing
const LIE = () => ({
  hips: [0, 0.185, 0], lie: 1.5, bend: -0.04, tilt: 0, head: [0.24, 0.2, 0.06],
  L: Leg([0.30, 0.12, 0.56], [0.3, 1, 0.2], -0.5), R: Leg([-0.22, 0.12, 0.60], [-0.2, 1, 0.2], -0.5),
  armL: Arm([0.72, 0.13, -0.24], [1, 0, 0.2], [0, 1, 0], [0.2, 0.2, -1], 0.4), armR: Arm([-0.70, 0.13, -0.10], [-1, 0, 0.3], [0, 1, 0], [-0.2, 0.2, -1], 0.4)
});
const SIT = () => ({
  hips: [0, 0.17, 0], bend: 0.08, tilt: 0, head: [0.2, 0, 0],
  L: Leg([0.30, 0.10, 0.56], [0.4, 1, 0.3], -0.2), R: Leg([-0.22, 0.10, 0.46], [-0.3, 1, 0.3]),
  armL: Arm([0.36, 0.09, -0.30], [0.3, -0.2, -1], [0, -1, 0], [1, 0, -0.5], 0.2), armR: Arm([-0.34, 0.36, 0.24], [0.2, -0.3, 1], [0, -1, 0], [-1, 0, -0.4], 0.5)
});
const STAND = () => ({
  hips: [0, 0.69, -0.015], bend: 0.03, tilt: 0, head: [0, 0, 0],
  L: Leg([0.2, 0.095, 0.03], [0.1, 0, 1]), R: Leg([-0.2, 0.095, 0.03], [-0.1, 0, 1]),
  armL: Arm([0.42, 0.72, 0.02], [0.1, -1, 0.1], [-1, 0, 0], [1, 0, -1], 0.35), armR: Arm([-0.42, 0.72, 0.02], [-0.1, -1, 0.1], [1, 0, 0], [-1, 0, -1], 0.35)
});
// waking up (u: seconds since the third person shot began)
function wakePose(u) {
  const rise = smooth(1.3, 2.7, u), stand = smooth(5.6, 6.9, u);
  let P = mixRide([[LIE(), 1 - rise], [SIT(), rise]]);
  P.lie = LIE().lie * (1 - rise);
  const rub = window_(u, 2.7, 4.0, 0.35), fix = window_(u, 3.9, 5.6, 0.45);
  if (rub > 0) { P.armR = mixArm(P.armR, Arm([-0.17 + 0.05 * Math.sin(u * 15), 0.88, 0.10], [1, 0.5, 0], [0.1, -1, 0], [-1, 0, 0.1], 0.5), rub); P.head = [0.28 * rub, 0.1 * Math.sin(u * 7) * rub, 0.18 * rub]; }
  if (fix > 0) {                                             // a finger and thumb on the arm of his shades
    const h = mate.wp[IDX.head] || [0, 0.9, 0];
    P.armR = mixArm(P.armR, Arm(V.add(h, [-0.29, 0.03, 0.06]), [0.8, 0.45, 0.4], [0.7, 0, -0.7], [-1, -0.9, 0.1], 0.9), fix);
    P.head = [-0.08 * smooth(4.7, 5.0, u) * fix, 0, 0];
  }
  if (stand > 0) P = mixRide([[P, 1 - stand], [STAND(), stand]]);
  P.hips = V.add(P.hips, [0, 0.1 * Math.sin(Math.PI * stand), 0]);
  if (u > 6.9) P.head = [-0.02, -0.25 * window_(u, 7.0, 8.6, 0.5), 0];
  return P;
}
function act(f, P, R, p, dt) {
  f.time += dt; f.speed = 0; f.weapon = null; f.dead = -1; f.jump = -1; f.legYaw = 0; f.air = 0;
  f.script = rideScript(P); f.script.root = { R, p }; f.scriptW = 1;
  if (P.lie) f.script.hipsR = M3.rx(-P.lie);               // flat on his back
  f.pos = p.slice();
  poseFighter(f);
}

// ---------------------------------------------------------------- the boat's own journey
function boatAt(t) {
  const slow = CINE.rock;
  const left = t < slow ? 5.5 * (slow - t) + 4.4 : 4.4 * Math.max(0, 1 - (t - slow) / (CINE.hit - slow));      // metres still to go
  const loose = smooth(CINE.cheers + 1.5, CINE.chug + 1, t);                      // nobody at the wheel
  const weave = (1.4 * Math.sin(t * 0.34) * (1 - loose) + 0.5 * Math.sin(t * 1.3) * loose) * smooth(0, 6, CINE.hit - t);
  const x = TRIP.impact[0] - TRIP.fwd[0] * left + TRIP.left[0] * weave, z = TRIP.impact[2] - TRIP.fwd[2] * left + TRIP.left[2] * weave;
  const yaw = TRIP.yaw + (0.07 * Math.cos(t * 0.34) * (1 - loose) + 0.1 * Math.cos(t * 1.3) * loose) * smooth(0, 6, CINE.hit - t);
  const f = [Math.sin(yaw), Math.cos(yaw)], l = [Math.cos(yaw), -Math.sin(yaw)];
  const h = (a, b) => swell(x + f[0] * a + l[0] * b, z + f[1] * a + l[1] * b, t);
  const bowY = h(1.8, 0), aftY = h(-1.8, 0), lY = h(0, 0.9), rY = h(0, -0.9);
  const speed = t < slow ? 1 : 0.5;
  const pitch = -Math.atan((bowY - aftY) / 3.6) * 0.7 - 0.045 * speed, roll = Math.atan((lY - rY) / 1.8) * 0.6;
  const p = [x, (bowY + aftY + lY + rY + 2 * h(0, 0)) / 6 + 0.06, z];
  const R = M3.mul(M3.ry(yaw), M3.mul(M3.rx(pitch), M3.rz(roll)));
  return { p, R, yaw, speed, left };
}
const inBoat = (b, q) => V.add(b.p, M3.vec(b.R, q));
// the same but without the rocking, for the cameras
const overBoat = (b, q) => V.add([b.p[0], SEA.level + 0.06, b.p[2]], M3.vec(M3.ry(b.yaw), q));

// ---------------------------------------------------------------- running it
const cine = { on: false, t: 0, boat: null, halves: null, bits: [], said: new Set(), words: [], shot: '', thump: 0, view: null, fires: [], low: false };
const cineEl = id => document.getElementById(id);
function cineStart() {
  Object.assign(cine, { on: true, t: 0, boat: boatAt(0), halves: null, bits: [], thump: 0, shot: '', fires: [] });
  cine.said = new Set(); cineClearWords();
  endRide(true); abortLoot();
  wreck = null; smoke.length = 0; particles.length = 0;
  world.cine = true;
  const w = TRIP.at(-7, 0); player.pos = [w[0], groundAt(w[0], w[2], 99), w[2]];        // where you will end up
  keys.clear(); mouse.fire = mouse.pressed = mouse.aim = false;
  mate.crooked = 0;
  SKY.island.splice(0, 3, 0.93, 0.86, 0.80);                    // the haze turns warm
  cineEl('cine').hidden = false; ui.hud.hidden = true;
  cineFade(1, '#000');
  cineStep(0);
}
// put the game back as it was; `keep`: carry on from the beach, beside the wreck
function cineEnd(keep) {
  if (!cine.on) return;
  cine.on = false; world.cine = false;
  SKY.island.splice(0, 3, 0.66, 0.80, 0.91);
  Sound.music.stop(); Sound.loopsOff();
  cineEl('cine').hidden = true; canvas.style.filter = '';
  cineClearWords(); particles.length = 0; smoke.length = 0;
  ui.hud.hidden = !game.running; hudDirty = true;
  if (keep) washUp();
}
// stood on the beach with the wreck still burning
function washUp() {
  if (!wreck) wreck = makeWreck();
  const p = TRIP.at(-7, 0);
  player.pos = [p[0], groundAt(p[0], p[2], 99), p[2]];
  player.yaw = TRIP.a; cam.yaw = player.yaw - Math.PI; cam.pitch = 0.12; cam.side = 0.92; cam.dist = 2.25; cam.height = 1.7; cam.fov = 0.95;
  player.script = null; player.scriptW = 0; player.hp = 100; player.dead = -1; player.air = 0; player.speed = 0;
  player.weights = { Idle: 1, Walk: 0, Run: 0, Crouch: 0, CrouchWalk: 0 };
  keys.clear(); mouse.fire = mouse.pressed = mouse.aim = false;
  bots.forEach(spawnBot);
  poseFighter(player);
  notify('You washed up on Goob Island');
}
function cineSkip() {
  if (!cine.on) return;
  cineEnd(true);
}
function cineClearWords() { cine.words.length = 0; cineEl('cinewords').textContent = ''; cineEl('cinecaption').textContent = ''; cineEl('cinetitle').style.opacity = 0; }
function cineFade(a, colour) { const el = cineEl('cinefade'); el.style.opacity = a; if (colour) el.style.background = colour; }
// a word that pops up over something in the world
function cineSay(where, text, life, size) {
  if (!CINE_WORDS && text !== '♪' && text !== '♫') return;       // the pop-up words are switched off, like in the game
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; if (size) el.style.fontSize = size + 'px';
  cineEl('cinewords').appendChild(el);
  cine.words.push({ el, where, t: 0, life });
}
// once, when the time passes `at`
function cineCue(at, key, fn) { if (cine.t >= at && !cine.said.has(key)) { cine.said.add(key); if (cine.t - at < 0.5) fn(); } }

function flyingBit(parts, p, v, R, spin, s) { cine.bits.push({ parts, p: p.slice(), v, R, a: 0, axis: V.norm([rand(-1, 1), rand(-1, 1), rand(-1, 1)]), spin, s: s || 1, wet: false }); }
function crashNow() {
  const b = cine.boat;
  Sound.play('crash', 1); Sound.play('splash', 1); Sound.loop('motor', 0); Sound.loop('water', 0.15);
  const F = TRIP.fwd, hit = inBoat(b, [0, 0.5, 2.5]);
  for (let i = 0; i < 34; i++) flyingBit(PLANK, V.add(hit, [rand(-0.7, 0.7), rand(-0.2, 0.5), rand(-0.7, 0.7)]), [F[0] * rand(-1, 4) + rand(-3, 3), rand(2, 6.5), F[2] * rand(-1, 4) + rand(-3, 3)], M3.ry(rand(0, 6)), rand(3, 11), rand(0.2, 0.75));
  flyingBit('boombox', inBoat(b, [0.4, FLOOR + 0.32, -1.55]), [F[0] * 4.2 + 0.8, 5.2, F[2] * 4.2 - 0.4], b.R, 3.2);
  for (let i = 0; i < 7; i++) flyingBit(CAN, inBoat(b, [rand(-0.6, 0.6), 0.8, rand(-1.5, 0.4)]), [F[0] * rand(2, 6) + rand(-2, 2), rand(2.5, 6), F[2] * rand(2, 6) + rand(-2, 2)], M3.id(), rand(6, 16));
  puff(hit, 90, [0.92, 0.96, 0.98, 0.9], 4.5, 0.12, 1.6, 7);
  puff(hit, 30, [0.45, 0.28, 0.14, 1], 4, 0.05, 1.4, 8);
  cineSay(() => inBoat(b, [0, 2.6, 1.0]), 'KA-BONK!', 1.7, 54);
}

function cineStep(dt) {
  if (!cine.on) return;
  cine.t += dt; game.time += dt;
  const t = cine.t, beat = (Sound.music.time() ?? t) * Sound.music.bpm / 60;
  // ---- sound
  if (t < CINE.point) {
    Sound.music.tick(t);
    const near = t >= CINE.boom && t < CINE.cheers ? 1 : t < CINE.driver ? 0.55 + 0.25 * smooth(0, 5, t) : 0.75;
    Sound.music.volume(near);
  }
  if (t < CINE.hit) { Sound.loop('motor', 0.42 * smooth(0, 1.2, t) * (t > CINE.rock ? 0.55 : 1)); Sound.loop('water', 0.5); }
  cineCue(3.2, 'psh', () => Sound.play('pshh', 0.8));
  cineCue(7.5, 'gulp', () => Sound.play('gulp', 0.7));
  cineCue(8.6, 'gulp2', () => Sound.play('gulp', 0.5));
  cineCue(12.2, 'gulp3', () => Sound.play('gulp', 0.7));
  cineCue(13.5, 'ahh', () => Sound.play('ahh', 0.8));
  cineCue(16.2, 'yeah', () => cineSay(() => inBoat(cine.boat, [0.12, 1.12, -1.5]), 'YEAHHH!', 1.6, 44));
  cineCue(22.2, 'clink', () => { Sound.play('clink', 1); cineSay(() => inBoat(cine.boat, [-0.1, 1.72, -0.9]), 'CHEERS!', 1.5, 44); puff(inBoat(cine.boat, [-0.12, 1.12, -0.92]), 14, [1.0, 0.93, 0.7, 0.85], 0.9, 0.018, 0.6, 5); });
  cineCue(24.6, 'gulp4', () => Sound.play('gulp', 0.9));
  cineCue(25.8, 'gulp5', () => Sound.play('gulp', 0.9));
  cineCue(CINE.point, 'scratch', () => { Sound.music.stop(); Sound.play('scratch', 1); });
  cineCue(CINE.point + 0.25, 'yell', () => { Sound.play('yell', 0.9); cineSay(() => inBoat(cine.boat, [-0.3, 0.9, -1.25]), 'BRO!! ROCK!!', 1.3, 52); });
  cineCue(CINE.huh + 0.15, 'huh', () => { Sound.play('huh', 1); cineSay(() => inBoat(cine.boat, [0.42, 1.72, -0.2]), 'huh?', 0.9, 40); });
  cineCue(CINE.rock + 0.5, 'ooga', () => cineSay(() => inBoat(cine.boat, [0, 2.4, -0.4]), 'AAAAA!', 1.4, 40));
  cineCue(CINE.hit, 'crash', crashNow);
  cineCue(CINE.black, 'ring', () => { Sound.play('ring', 0.8); Sound.loop('water', 0); });

  // ---- notes drifting out of the boombox
  if (t < CINE.point && Math.floor(beat) !== cine.lastBeat && dt > 0) {
    cine.lastBeat = Math.floor(beat);
    const x = rand(0.1, 0.75), from = cine.t;
    const close = t >= CINE.boom && t < CINE.cheers;
    cineSay(() => inBoat(cine.boat, [x + 0.08 * Math.sin((cine.t - from) * 4), FLOOR + (close ? 0.66 : 0.85) + (cine.t - from) * (close ? 0.3 : 0.55), -1.55]), Math.random() < 0.5 ? '♪' : '♫', 1.3, close ? 46 : 26);
  }
  const heard = Sound.music.loudness(), kick = Math.exp(-((beat % 1) * 6));
  cine.thump = t >= CINE.point ? cine.thump * Math.exp(-dt * 9) : heard === null ? kick : clamp(kick * 0.6 + heard * 0.6, 0, 1);

  // ---- the boat and who is in it
  cine.fires = [];
  if (t < CINE.hit) {
    const b = cine.boat = boatAt(t);
    mate.crooked = 0.3 * smooth(CINE.point, CINE.point + 0.25, t);           // they slide down his nose when he sees it
    const M = matePose(t, t < CINE.point ? beat : 0);
    act(mate, M, b.R, inBoat(b, [SEAT.mate[0], FLOOR, SEAT.mate[2]]), dt);
    const S = skipPose(t, t < CINE.point ? beat : 0);
    act(skip, S.P, M3.mul(b.R, M3.ry(S.turn)), inBoat(b, S.root), dt);
    if (Math.random() < dt * 40) { const side = Math.random() < 0.5 ? -1 : 1; puff(inBoat(b, [side * 0.95, -0.02, rand(0.4, 1.6)]), 2, [0.95, 0.98, 1.0, 0.7], 1.1, 0.045, 0.7, 6); }
    if (Math.random() < dt * 30) puff(inBoat(b, [rand(-0.2, 0.2), 0.05, -2.95]), 3, [0.95, 0.98, 1.0, 0.75], 1.5, 0.06, 0.8, 6);
  } else if (t < CINE.black + 0.4) {                          // the crash, slowed right down
    const u = (t - CINE.hit) * 0.55, from = boatAt(CINE.hit);
    cine.boat = from;
    const F = TRIP.fwd;
    const toss = (seat, vel, spin, lift, who, seed) => {
      const start = inBoat(from, [seat[0], FLOOR + 0.75, seat[2]]);
      const c = [start[0] + F[0] * vel * u + TRIP.left[0] * lift * u, start[1] + 5.0 * u - 4.4 * u * u, start[2] + F[2] * vel * u + TRIP.left[2] * lift * u];
      const R = M3.mul(M3.ry(from.yaw), M3.mul(M3.rx(spin * u), M3.rz(lift * 1.2 * u)));
      const k = smooth(0, 0.18, u);
      const P = flail(u * 1.4, seed);
      act(who, P, M3.mix(who === skip ? M3.mul(from.R, M3.ry(Math.PI)) : from.R, R, k), V.sub(c, M3.vec(R, [0, 0.75, 0])), dt);
    };
    toss(SEAT.mate, 5.6, 5.2, -0.5, mate, 0);
    toss([0, 0, -0.25], 6.6, -4.4, 0.9, skip, 2.3);
    const k = smooth(0, 0.9, u);
    const half = (turn, shift, pivot) => { const R = M3.mul(from.R, turn), c = inBoat(from, pivot); return { R, p: V.add(V.sub(c, M3.vec(R, pivot)), shift) }; };
    cine.halves = {
      bow: half(M3.mul(M3.rx(-0.55 * k), M3.rz(0.6 * k)), [0, 0.35 * k, 0], [0, 0, 1.6]),
      stern: half(M3.mul(M3.rx(0.95 * k), M3.rz(-0.35 * k)), [F[0] * 1.1 * k, 0.75 * Math.sin(Math.min(1.9, u * 2.2)), F[2] * 1.1 * k], [0, 0, -1.3])
    };
    if (Math.random() < dt * 25) puff(inBoat(from, [rand(-1, 1), 0.2, rand(-1, 2.4)]), 4, [0.94, 0.97, 0.99, 0.85], 2.4, 0.09, 1.0, 6);
  }
  for (const b of cine.bits) {
    const k = dt * 0.55;
    if (b.wet) continue;
    b.v[1] -= 8.8 * k; b.p = V.mad(b.p, b.v, k); b.a += b.spin * k;
    if (b.p[1] < SEA.level && b.v[1] < 0) { b.wet = true; b.p[1] = SEA.level - 0.03; puff(b.p, 5, [0.94, 0.97, 0.99, 0.8], 1.4, 0.05, 0.7, 6); }
  }

  // ---- the beach
  if (t >= CINE.black + 0.4) {
    if (!wreck) { wreck = makeWreck(); particles.length = 0; cine.bits = []; cine.halves = null; smoke.length = 0; for (let i = 0; i < 90; i++) fireStep(0.07, wreck.fires); Sound.loop('motor', 0); }
    cine.fires = wreck.fires;
    const W = TRIP.at(-7, 0); W[1] = groundAt(W[0], W[2], 99);
    const u = t - CINE.up;
    act(mate, wakePose(Math.max(0, u)), M3.ry(TRIP.a), W, dt);
    mate.crooked = 1 - smooth(4.55, 4.95, Math.max(0, u));
    const s = TRIP.at(-5.6, 2.9); s[1] = groundAt(s[0], s[2], 99);
    const snooze = LIE(); snooze.bend += 0.05 * Math.sin(t * 2.2);
    act(skip, snooze, M3.ry(TRIP.a + 1.1), s, dt);
    Sound.loop('surf', 0.5 * smooth(CINE.black + 0.4, CINE.black + 2, t)); Sound.loop('fire', 0.55 * smooth(CINE.eyes - 0.5, CINE.eyes + 2.5, t));
    cineCue(CINE.eyes + 0.9, 'ugh', () => Sound.play('ugh', 0.8));
    cineCue(CINE.up + 3.0, 'ow', () => cineSay(() => V.add(W, [0, 1.5, 0]), 'owww...', 1.2));
    cineCue(CINE.up + 5.0, 'ting', () => { Sound.play('ting', 0.8); cine.glint = 1; });
    cineCue(CINE.up + 2.2, 'snore1', () => { Sound.play('snore', 0.8); cineSay(() => V.add(s, [0, 0.9, 0]), 'Zzz', 2.0); });
    cineCue(CINE.up + 6.0, 'snore2', () => { Sound.play('snore', 0.8); cineSay(() => V.add(s, [0, 0.9, 0]), 'Zzz...', 2.2); });
  }
  cine.glint = Math.max(0, (cine.glint || 0) - dt * 1.6);
  fireStep(dt, cine.fires);
  effectsStep(dt);
  cineOverlay(dt);
  if (t >= CINE.end) cineEnd(true);
}
// the black bars, fades, eyelids, captions and words
function cineOverlay(dt) {
  const t = cine.t;
  let fade = 0, colour = '#000';
  if (t < 1.4) fade = 1 - smooth(0.2, 1.4, t);
  else if (t >= CINE.hit && t < CINE.hit + 0.35) { fade = 1 - (t - CINE.hit) / 0.35; colour = '#fff4dc'; }
  else if (t >= CINE.black - 0.35 && t < CINE.eyes) fade = smooth(CINE.black - 0.35, CINE.black, t);
  else if (t >= CINE.up - 0.25 && t < CINE.up + 0.35) fade = 1 - smooth(0, 0.35, Math.abs(t - CINE.up)) ;
  else if (t > CINE.end - 0.35) fade = smooth(CINE.end - 0.35, CINE.end, t) * 0.6;
  cineFade(fade, colour);
  cineEl('cinecaption').textContent = t > 1.2 && t < 5.0 ? 'Somewhere off Goob Island...' : t > CINE.black + 0.5 && t < CINE.eyes - 0.1 ? 'Later...' : '';
  cineEl('cinetitle').style.opacity = window_(t, CINE.up + 6.0, CINE.end - 0.3, 0.7);
  // eyelids: opening, falling shut again, opening for good
  const lids = cineEl('eyelids');
  if (t >= CINE.eyes && t < CINE.up) {
    const u = t - CINE.eyes;
    const keysOpen = [[0, 0], [0.7, 0.22], [1.15, 0.02], [1.9, 0.55], [2.25, 0.08], [3.0, 1.0]];
    let open = 1;
    for (let i = 1; i < keysOpen.length; i++) if (u < keysOpen[i][0]) { const [a, x] = keysOpen[i - 1], [b, y] = keysOpen[i]; open = x + (y - x) * smooth(a, b, u); break; }
    lids.style.display = 'block'; lids.style.setProperty('--open', open);
    const blur = 9 * (1 - smooth(0.6, 3.8, u)) + 3 * (1 - open);
    canvas.style.filter = blur > 0.15 ? `blur(${blur.toFixed(1)}px) saturate(${(1 + 0.3 * (1 - open)).toFixed(2)})` : '';
  } else { lids.style.display = 'none'; canvas.style.filter = ''; }
  for (let i = cine.words.length - 1; i >= 0; i--) {
    const w = cine.words[i]; w.t += dt;
    if (w.t > w.life || (cine.t >= CINE.black - 0.1 && cine.t < CINE.black + 0.3)) { w.el.remove(); cine.words.splice(i, 1); continue; }
    const at = lastView && project(w.where());
    w.el.style.display = at ? 'block' : 'none';
    if (!at) continue;
    const pop = Math.min(1, w.t / 0.13), s = 0.4 + 0.6 * pop + 0.25 * Math.sin(Math.PI * pop);
    w.el.style.left = at[0] + 'px'; w.el.style.top = at[1] + 'px'; w.el.style.opacity = 1 - smooth(w.life - 0.3, w.life, w.t);
    w.el.style.transform = `translate(-50%, -50%) scale(${s}) rotate(${Math.sin(w.t * 7) * 5}deg)`;
  }
}

// ---------------------------------------------------------------- the cameras
function cineCamera() {
  const t = cine.t, b = cine.boat, ease = (a, c) => smooth(a, c, t);
  const boat = (q) => overBoat(b, q), L = (p, q, k) => V.lerp(p, q, k);
  const sway = [Math.sin(t * 1.7) * 0.012, Math.sin(t * 2.3) * 0.009, 0];      // handheld
  const shot = (eye, at, fov) => ({ eye: V.add(eye, sway), at, fov });
  if (t < CINE.driver) { const k = ease(0, CINE.driver); return shot(boat(L([-11, 6.2, -12.5], [-3.9, 2.3, -6.0], k)), boat([0, 0.9 + 0.2 * (1 - k), 0.6]), 0.80); }
  if (t < CINE.you) { const k = ease(CINE.driver, CINE.you); return shot(boat(L([1.25, 1.62, 2.75], [0.62, 1.42, 2.15], k)), boat([-0.06, 1.12, 0.22]), 0.62); }
  if (t < CINE.boom) { const k = ease(CINE.you, CINE.boom); return shot(boat(L([-1.6, 1.66, 0.55], [-0.80, 1.56, -0.40], k)), boat(L([-0.16, 1.17, -1.55], [-0.33, 1.39, -1.55], k)), 0.62 - 0.06 * k); }
  if (t < CINE.cheers) { const k = ease(CINE.boom, CINE.cheers); return shot(boat(L([0.95, 1.12, -0.42], [0.25, 0.92, -0.50], k)), boat([0.41, 0.70, -1.55]), 0.60 - 0.04 * cine.thump); }
  if (t < CINE.chug) { const k = ease(CINE.cheers, CINE.chug); return shot(boat(L([3.5, 2.0, 0.5], [2.75, 1.55, -0.95], k)), boat([-0.2, 1.02, -0.72]), 0.72); }
  if (t < CINE.point) { const k = ease(CINE.chug, CINE.point); return shot(boat(L([-1.75, 2.25, -2.75], [-1.40, 2.06, -2.25], k)), boat([0.0, 1.15, 0.7]), 0.72); }
  if (t < CINE.huh) { const k = ease(CINE.point, CINE.huh); return shot(boat(L([-1.05, 1.45, 0.05], [-0.8, 1.38, -0.3], k)), boat([-0.28, 1.2, -1.45]), 0.60); }
  if (t < CINE.rock) return shot(boat([1.15, 1.7, -1.75]), boat([-0.1, 1.38, 0.0]), 0.62);
  if (t < CINE.black) {                                        // from beside the rock
    const k = ease(CINE.rock, CINE.black), R = TRIP.rock;
    const eye = V.add(R, V.add(V.mul(TRIP.left, 8.6 - 1.2 * k), V.add(V.mul(TRIP.fwd, -2.5), [0, 2.3, 0])));
    return shot(eye, V.add(R, V.add(V.mul(TRIP.fwd, -2.2 + 2.5 * smooth(CINE.hit, CINE.black, t)), [0, 1.45, 0])), 0.84);
  }
  const W = TRIP.at(-7, 0); W[1] = groundAt(W[0], W[2], 99);
  const sea = TRIP.D, L2 = TRIP.left, near = (out, side, up) => V.add(W, [sea[0] * out + L2[0] * side, up, sea[2] * out + L2[2] * side]);
  if (t < CINE.up) {                                           // out of your own eyes
    const u = t - CINE.eyes, eye = near(-0.55, 0, 0.30 + 0.22 * smooth(2.8, 4.8, u));
    const turn = smooth(2.7, 4.6, u);
    const sky = near(0.25, 0.15, 2.4), look = V.add(near(5.8, 0.6, 0.9), [0, 0, 0]);
    return { eye, at: L(sky, look, turn), fov: 1.05 };
  }
  const u = t - CINE.up;
  const crane = smooth(4.6, 7.9, u);
  const eye = L(L(near(2.3, -1.5, 0.55), near(1.9, -1.1, 1.05), smooth(0.8, 3.4, u)), near(-3.3, -1.7, 2.35), crane);
  const at = L(L(near(-0.5, 0, 0.35), near(-0.1, 0, 1.0), smooth(1.2, 3.0, u)), near(3.4, 0.2, 0.75), crane);
  if (u > 6.9) {                                               // settle into where the game's own camera will be
    const k = smooth(6.9, CINE.end - CINE.up, u);
    const right = [-Math.cos(TRIP.a), 0, Math.sin(TRIP.a)];
    const pivot = V.add(W, [right[0] * 0.92, 1.7, right[2] * 0.92]), f = [Math.sin(TRIP.a) * Math.cos(0.12), -Math.sin(0.12), Math.cos(TRIP.a) * Math.cos(0.12)];
    const g = V.mad(pivot, f, -2.25);
    return { eye: L(eye, g, k), at: L(at, V.mad(g, f, 6), k), fov: 0.72 + 0.23 * k };
  }
  return shot(eye, at, 0.72);
}

// ---------------------------------------------------------------- drawing
// looking out of your own eyes: your body is not drawn
const yourEyes = () => cine.t >= CINE.black + 0.4 && cine.t < CINE.up;
function drawActors(prog, list) {
  for (const f of list || (yourEyes() ? [skip] : [mate, skip])) {
    gl.uniformMatrix4fv(prog.u.uBones, false, f.bones); gl.uniformMatrix4fv(prog.u.uModel, false, f.model);
    if (prog === skinProg) gl.uniform1f(prog.u.uHurt, 0);
    for (const p of Rig.prims) {
      if (prog === skinProg) {
        gl.uniform1i(prog.u.uHasTex, p.tex ? 1 : 0); gl.uniform1i(prog.u.uHasNormal, p.normal ? 1 : 0);
        gl.uniform3fv(prog.u.uColor, p.color); gl.uniform1f(prog.u.uRough, p.rough);
        gl.uniform3fv(prog.u.uTint, p.name === 'cloth' || p.name === 'skin' ? (p.name === 'skin' ? f.tint.map(t => 1 + (t - 1) * 0.35) : f.tint) : [1, 1, 1]);
        if (p.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex); }
        if (p.normal) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, p.normal); }
      }
      gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
    }
  }
}
// everything solid that is not a person: the boat or what is left of it
function drawCineThings(prog) {
  const t = cine.t;
  if (cine.t >= CINE.black + 0.4 && wreck) drawWreck(prog, wreck, t);
  else {
    const b = cine.boat, o = { wheel: t < CINE.cheers + 1.2 ? Math.sin(t * 1.4) * 0.25 : (t - CINE.cheers - 1.2) * 0.9 * Math.sin(t * 0.8), prop: t * 38, burnt: false };
    const broken = t >= CINE.hit && cine.halves;
    drawBoatHalf(prog, false, m4(broken ? cine.halves.stern.R : b.R, broken ? cine.halves.stern.p : b.p, boatM), o);
    drawBoatHalf(prog, true, m4(broken ? cine.halves.bow.R : b.R, broken ? cine.halves.bow.p : b.p, boatM), o);
    if (!broken) drawBoombox(prog, b.R, inBoat(b, [0.41, FLOOR + 0.315, -1.55]), cine.thump, cine.thump, t * 4);
    drawParts(prog, ROCKS, placed(M3.ry(0.7), TRIP.rock));
    drawHeldCan(prog, mate, 'R'); drawHeldCan(prog, skip, 'R');
  }
  for (const q of cine.bits) {
    const R = M3.mul(M3.axis(q.axis, q.a), q.R);
    if (q.parts === 'boombox') drawBoombox(prog, R, q.p, 0, 0, 0);
    else drawParts(prog, q.parts, placed(M3.mul(R, [1, 0, 0, 0, 1, 0, 0, 0, q.parts === PLANK ? q.s : 1]), q.p));
  }
  if (!yourEyes()) drawShadesOn(prog, mate);
  drawParts(prog, HAT, headMatrix(skip, wornM));
}
function cineRender() {
  const low = world.low;
  const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5) * quality * (low ? 0.9 : 1);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const C = cineCamera();
  const t = cine.t;
  let shake = 0;
  if (t >= CINE.hit && t < CINE.black) shake = 0.13 * Math.exp(-(t - CINE.hit) * 3);
  const eye = V.add(C.eye, [rand(-shake, shake), rand(-shake, shake), rand(-shake, shake)]);
  const fwd = V.norm(V.sub(C.at, C.eye));
  const aspect = w / Math.max(1, h), fov = aspect < 1.5 ? 2 * Math.atan(Math.tan(C.fov / 2) * Math.min(1.6, 1.5 / aspect)) : C.fov;   // keep it all in frame on narrow screens
  const vp = mul4(perspective(fov, aspect, 0.08, low ? 330 : 700), lookAt(eye, V.add(eye, fwd)));
  lastView = { vp, w: canvas.clientWidth, h: canvas.clientHeight, hideSelf: false };

  const ashore = t >= CINE.black + 0.4;
  const centre = ashore ? TRIP.at(-4, 0, 0.6) : V.add(cine.boat.p, [0, 0.7, 0]);
  if (ashore) centre[1] = groundAt(centre[0], centre[2], 99) + 0.5;
  const light = mul4(ortho(ashore ? 8 : 5, ashore ? 8 : 5, 1, 30), lookAt(V.mad(centre, SUN, 14), centre));
  flashCol[0] = flashCol[1] = flashCol[2] = 0;
  if (cine.fires.length) {
    const f = cine.fires[0][0], k = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 7.3);
    flashPos[0] = f[0]; flashPos[1] = f[1] + 0.9; flashPos[2] = f[2]; flashCol[0] = 3.4 * k; flashCol[1] = 1.4 * k; flashCol[2] = 0.35 * k;
  }

  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo); gl.viewport(0, 0, SHADOW, SHADOW); gl.clear(gl.DEPTH_BUFFER_BIT);
  globals(skinDepth, light, light, eye); drawActors(skinDepth);
  globals(staticDepth, light, light, eye); drawCineThings(staticDepth);
  if (ashore) drawFloraShadow(light, eye);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  gl.viewport(0, 0, w, h); gl.clearColor(...SKY.island, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // the sky first, behind everything
  const right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd), tan = Math.tan(fov / 2);
  gl.useProgram(skyProg.p); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
  gl.uniform3fv(skyProg.u.uRight, right); gl.uniform3fv(skyProg.u.uUp, up); gl.uniform3fv(skyProg.u.uFwd, fwd); gl.uniform3fv(skyProg.u.uSun, SUN);
  gl.uniform2f(skyProg.u.uTan, tan * aspect, tan); gl.uniform1f(skyProg.u.uTime, t);
  gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.depthMask(true); gl.enable(gl.DEPTH_TEST);

  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  drawLand(vp, light, eye);
  globals(skinProg, vp, light, eye); gl.uniform1i(skinProg.u.uTex, 0); gl.uniform1i(skinProg.u.uNormalMap, 1); drawActors(skinProg);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  globals(propProg, vp, light, eye); gl.uniform1i(propProg.u.uTex, 0); gl.uniform1f(propProg.u.uTime, t); drawCineThings(propProg);

  // the sea
  const b = cine.boat, afloat = !ashore;
  gl.useProgram(oceanProg.p);
  gl.uniformMatrix4fv(oceanProg.u.uViewProj, false, vp);
  const mid = ashore ? TRIP.at(8, 0) : b.p;
  gl.uniform2f(oceanProg.u.uCentre, mid[0], mid[2]); gl.uniform1f(oceanProg.u.uTime, t);
  gl.uniform3fv(oceanProg.u.uEye, eye); gl.uniform3fv(oceanProg.u.uSun, SUN); gl.uniform3fv(oceanProg.u.uSky, SKY.island); gl.uniform2fv(oceanProg.u.uFog, fogRange());
  gl.uniform3fv(oceanProg.u.uBoat, b.p); gl.uniform2f(oceanProg.u.uHead, Math.sin(b.yaw), Math.cos(b.yaw)); gl.uniform3fv(oceanProg.u.uRock, TRIP.rock);
  gl.uniform1f(oceanProg.u.uWake, afloat && t < CINE.hit ? b.speed : 0);
  const Ri = M3.tr(b.R), back = M3.vec(Ri, b.p);
  gl.uniformMatrix4fv(oceanProg.u.uHull, false, m4(Ri, [-back[0], -back[1], -back[2]]));
  gl.uniform1i(oceanProg.u.uCutHull, afloat && t < CINE.hit ? 1 : 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(oceanMesh.vao); gl.drawElements(gl.TRIANGLES, oceanMesh.count, gl.UNSIGNED_INT, 0);
  gl.disable(gl.BLEND);

  // the windscreen, then spray, fire, smoke and glints
  if (!ashore) {
    globals(propProg, vp, light, eye); gl.uniform1f(propProg.u.uTime, t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const part = BOAT.bow.glass, M = m4(t >= CINE.hit && cine.halves ? cine.halves.bow.R : b.R, t >= CINE.hit && cine.halves ? cine.halves.bow.p : b.p, boatM);
    drawParts(propProg, [part], M);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  drawEffects(vp, eye, fwd);
  if (cine.fires.length) drawFires(vp, eye, fwd, cine.fires, t);
  // the shades catching the sun
  const glint = Math.max(cine.glint || 0, window_(t, 13.6, 14.4, 0.3));
  if (glint > 0.01) {
    const m = headMatrix(mate, wornM), q = [-0.095, 1.57, 0.19];
    const p = [0, 1, 2].map(i => m[i] * q[0] + m[4 + i] * q[1] + m[8 + i] * q[2] + m[12 + i]);
    gl.useProgram(fxProg.p); gl.uniformMatrix4fv(fxProg.u.uViewProj, false, vp); gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    const s = 0.11 * glint, turn = t * 1.4;
    for (const a of [turn, turn + Math.PI / 2]) { const x = V.add(V.mul(right, Math.cos(a)), V.mul(up, Math.sin(a))), y = V.add(V.mul(right, -Math.sin(a)), V.mul(up, Math.cos(a))); quad(p, V.mul(x, s), V.mul(y, s * 0.07), [1, 0.97, 0.85, glint]); }
    quad(p, V.mul(right, s * 0.25), V.mul(up, s * 0.25), [1, 1, 0.95, glint]);
    flushFx(true); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
  }
}

// ---------------------------------------------------------------- the wreck afterwards, in the game itself
const snoreSpot = () => { const s = TRIP.at(-5.6, 2.9); s[1] = groundAt(s[0], s[2], 99); return s; };
function snoozeSkipper(t, dt) {
  const P = LIE(); P.bend += 0.05 * Math.sin(t * 2.2);
  act(skip, P, M3.ry(TRIP.a + 1.1), snoreSpot(), dt);
}
const wreckNear = () => !!wreck && world.map === 'island' && !cine.on && Math.hypot(player.pos[0] - TRIP.rock[0], player.pos[2] - TRIP.rock[2]) < fogRange()[1];
function wreckStep(dt) {
  if (!wreck || world.map !== 'island') { Sound.loop('fire', 0); Sound.loop('surf', 0); return; }
  wreck.t += dt;
  const d = V.len(V.sub(player.pos, wreck.stern.p));
  fireStep(dt, d < 140 ? wreck.fires : []);
  Sound.loop('fire', d < 40 ? 0.6 * (1 - d / 40) ** 1.5 : 0);
  Sound.loop('surf', d < 60 ? 0.3 * (1 - d / 60) : 0);
  if (!wreckNear()) return;
  snoozeSkipper(wreck.t, dt);
  const s = snoreSpot();
  if (Math.floor(wreck.t / 3.6) !== Math.floor((wreck.t - dt) / 3.6) && V.len(V.sub(player.pos, s)) < 14) {
    Sound.play('snore', 0.45); popWord(V.add(s, [0, 0.9, 0]), 'Zzz', 1.8);
  }
}
// light from the fire, unless something brighter is going on
function wreckLight() {
  if (!wreckNear()) return;
  const f = wreck.fires[0][0];
  if (V.len(V.sub(player.pos, f)) > 30 || flashCol[0] > 0) return;
  const t = game.time, k = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 7.3);
  flashPos[0] = f[0]; flashPos[1] = f[1] + 0.9; flashPos[2] = f[2]; flashCol[0] = 3.0 * k; flashCol[1] = 1.2 * k; flashCol[2] = 0.3 * k;
}
// the boat, the junk and his hat (with the shadow or the prop shader), then the man himself (skin shaders)
function drawBeachThings(prog) {
  if (!wreckNear()) return;
  drawWreck(prog, wreck, game.time);
  drawParts(prog, HAT, headMatrix(skip, wornM));
}
function drawBeachSkipper(prog) { if (wreckNear()) drawActors(prog, [skip]); }
