// ======================================================================= looting
// Hold E by a chest or a knocked-out caveman. Releasing before the ring is full cancels.
let looting = null, lootCam = 0, lootShot = null, lootHeld = false;
const props = [], pops = [], stars = [];

// ---------------------------------------------------------------- the camera and the scope
function scopeAmount() {
  const g = player.weapon && GUNS[player.weapon];
  return g && g.scoped && player.dead < 0 && !looting ? smooth(0.25, 0.97, player.ads) : 0;
}
function scopedView(view, sc) {
  if (sc <= 0) return view;
  // slide forward along the line of sight, so zooming never moves the crosshair off the target
  const head = V.add(player.pos, [0, 1.5, 0]), along = Math.max(0, V.dot(V.sub(head, view.eye), view.fwd) + 0.45);
  return { eye: V.mad(view.eye, view.fwd, along * smooth(0, 0.75, sc)), fwd: view.fwd, at: view.at, dist: view.dist };
}
function lootCamera(view) {
  if (lootCam <= 0.001 || !lootShot) return view;
  const k = smooth(0, 1, lootCam), eye = V.lerp(view.eye, lootShot.eye, k);
  const fwd = V.norm(V.lerp(view.fwd, V.norm(V.sub(lootShot.at, lootShot.eye)), k));
  return { eye, fwd, at: view.at, dist: view.dist };
}

// ---------------------------------------------------------------- junk that falls out
function blob(rx, ry, rz, at, rough, seg) {
  const n = seg || 10, v = [], i = [], noise = [];
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
    const th = a / n * Math.PI, ph = b / n * Math.PI * 2, d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const key = a === 0 || a === n ? a * 100 : a * 100 + (b % n);
    if (noise[key] === undefined) noise[key] = 1 + (rough || 0) * (Math.random() - 0.5);
    const k = noise[key], nr = V.norm([d[0] / rx, d[1] / ry, d[2] / rz]);
    v.push(at[0] + d[0] * rx * k, at[1] + d[1] * ry * k, at[2] + d[2] * rz * k, ...nr, 0, 0);
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const p = a * (n + 1) + b, q = p + n + 1; i.push(p, q, p + 1, p + 1, q, q + 1); }
  return { v, i };
}
function starData() {
  const v = [], i = [];
  for (const z of [0.012, -0.012]) {
    const base = v.length / 8;
    v.push(0, 0, z * 1.6, 0, 0, Math.sign(z), 0, 0);
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, r = k % 2 ? 0.024 : 0.058; v.push(Math.sin(a) * r, Math.cos(a) * r, z * 0.3, 0, 0, Math.sign(z), 0, 0); }
    for (let k = 0; k < 10; k++) i.push(base, base + 1 + k, base + 1 + (k + 1) % 10);
  }
  return { v, i };
}
const JUNK = {
  rock: [{ mesh: mergeMesh([blob(0.085, 0.065, 0.075, [0, 0, 0], 0.55, 7)]), color: [0.17, 0.16, 0.15], rough: 0.9 }],
  bone: [{ mesh: mergeMesh([blob(0.03, 0.03, 0.12, [0, 0, 0]), blob(0.036, 0.036, 0.036, [0.027, 0, 0.12]), blob(0.036, 0.036, 0.036, [-0.027, 0, 0.12]), blob(0.036, 0.036, 0.036, [0.027, 0, -0.12]), blob(0.036, 0.036, 0.036, [-0.027, 0, -0.12])]), color: [0.75, 0.68, 0.52], rough: 0.6 }],
  fish: [{ mesh: mergeMesh([blob(0.035, 0.065, 0.14, [0, 0, 0]), blob(0.01, 0.07, 0.03, [0, 0.025, -0.15]), blob(0.01, 0.07, 0.03, [0, -0.025, -0.15]), blob(0.006, 0.035, 0.05, [0, 0.062, 0])]), color: [0.12, 0.28, 0.42], rough: 0.35 },
         { mesh: mergeMesh([blob(0.04, 0.014, 0.014, [0, 0.018, 0.088])]), color: [0.01, 0.01, 0.01], rough: 0.2 }],
  meat: [{ mesh: mergeMesh([blob(0.075, 0.075, 0.11, [0, 0, 0.03])]), color: [0.32, 0.085, 0.03], rough: 0.5 },
         { mesh: mergeMesh([blob(0.02, 0.02, 0.09, [0, 0, -0.11]), blob(0.028, 0.028, 0.028, [0.017, 0, -0.19]), blob(0.028, 0.028, 0.028, [-0.017, 0, -0.19])]), color: [0.75, 0.68, 0.52], rough: 0.6 }]
};
const starMesh = mergeMesh([starData()]);
function spawnProp(kind, p, v, o) {
  const prop = Object.assign({ kind, p: p.slice(), v: v.slice(), R: M3.ry(rand(0, 6.3)), axis: [rand(-1, 1), rand(-1, 1), rand(-1, 1)], spin: rand(5, 11), life: 7, rest: false, floor: 0.06, scale: 1.25 }, o || {});
  props.push(prop);
  if (props.length > 40) props.shift();
  return prop;
}
// a lob from one point that lands on another after t seconds
const lob = (from, to, t) => [(to[0] - from[0]) / t, (to[1] - from[1]) / t + 4.9 * t, (to[2] - from[2]) / t];
function propsStep(dt) {
  for (let i = props.length - 1; i >= 0; i--) {
    const o = props[i];
    if ((o.life -= dt) <= 0) { props.splice(i, 1); continue; }
    if (o.rest) continue;
    o.v[1] -= 9.8 * dt; o.p = V.mad(o.p, o.v, dt); o.R = M3.mul(M3.axis(o.axis, o.spin * dt), o.R);
    const low = floorAt(o.p[0], o.p[2]) + o.floor;
    if (o.p[1] < low && o.v[1] < 0) {
      o.p[1] = low;
      if (-o.v[1] > 1.1) { o.v = [o.v[0] * 0.45, -o.v[1] * 0.3, o.v[2] * 0.45]; o.spin *= 0.5; Sound.play('click', 0.25); }
      else { o.rest = true; o.R = o.kind === 'gun' ? M3.mul(M3.ry(rand(0, 6.3)), M3.rz(Math.PI / 2)) : o.kind === 'fish' ? M3.mul(M3.ry(rand(0, 6.3)), M3.rz(Math.PI / 2)) : M3.ry(rand(0, 6.3)); }
    }
  }
  for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.t += dt; if (q.t > q.life) { q.el.remove(); pops.splice(i, 1); } }
}
function drawProps(prog, textured) {
  for (const o of props) {
    const k = o.scale * Math.min(1, o.life / 0.4), S = o.R.map(x => x * k);
    if (o.kind === 'gun') { const g = GUNS[o.gun]; drawGun(prog, textured, g, S.map(x => x * g.scale / 1.25), V.add(o.p, M3.vec(S, [0, -0.04, -0.1])), {}); continue; }
    for (const part of JUNK[o.kind]) { flat(prog, part.color, part.rough, 0.05); drawMesh(prog, part.mesh, S, o.p); }
  }
  // seeing stars
  for (const f of stars) {
    const head = V.add(bonePos(f.f, 'head'), M3.vec(f.f.R, [0, 0.36, 0.04]));
    flat(prog, [0.95, 0.65, 0.02], 0.3, 0.7);
    for (let i = 0; i < 3; i++) {
      const a = game.time * 7 + i * Math.PI * 2 / 3;
      drawMesh(prog, starMesh, M3.mul(M3.ry(a * 0.5), M3.rz(a)).map(x => x * f.w * 1.3), V.add(head, [Math.cos(a) * 0.2, Math.sin(a * 2) * 0.025, Math.sin(a) * 0.2]));
    }
  }
}
function popWord(p, text, life) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; ui.pops.appendChild(el);
  pops.push({ el, p: p.slice(), t: 0, life: life || 0.75, tilt: rand(-14, 14) });
}

// ---------------------------------------------------------------- scripted poses
const LEG = s => ({ up: IDX['thigh_' + s], low: IDX['shin_' + s], foot: IDX['foot_' + s] });
const LEGS = { R: LEG('R'), L: LEG('L') };
function solveLeg(leg, S, goal) {
  const L1 = V.len(Rig.offset[leg.low]), L2 = V.len(Rig.offset[leg.foot]);
  const to = V.sub(goal.ankle, S); let d = V.len(to);
  const dir = V.mul(to, 1 / (d || 1));
  d = clamp(d, 0.16, (L1 + L2) * 0.999);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const side = V.orth(goal.pole || [0, 0, 1], dir);
  const K = V.add(V.add(S, V.mul(dir, a)), V.mul(side, h)), A = V.add(S, V.mul(dir, d));
  return [M3.frame(Rig.offset[leg.low], [0, 0, 1], V.sub(K, S), side), M3.frame(Rig.offset[leg.foot], [0, 0, 1], V.sub(A, K), side)];
}
const restAt = name => Rig.rest[IDX[name]];
let scratchPose = null;
// S: hips, bend, twist, tilt, head, arms {R, L}, legs {R, L}; everything in the fighter's own space
function scriptPose(f, S) {
  const P = scratchPose || (scratchPose = newPose());
  poseReset(P); poseAdd(P, 'Idle', f.time, 1);
  const wr = new Array(NB), wp = new Array(NB), ik = {};
  const torso = M3.mul(M3.mul(M3.ry((S.twist || 0) / 2), M3.rx((S.bend || 0) / 2)), M3.rz((S.tilt || 0) / 2));
  for (let i = 0; i < NB; i++) {
    const p = Rig.parent[i];
    const off = i === IDX.hips ? (S.hips || Rig.rest[i]) : Rig.offset[i];
    if (p < 0) { wp[i] = off.slice(); wr[i] = localRot(P, i); }
    else { wp[i] = V.add(wp[p], M3.vec(wr[p], off)); wr[i] = M3.mul(wr[p], localRot(P, i)); }
    if (i === IDX.hips && S.hipsR) wr[i] = M3.mul(S.hipsR, wr[i]);
    if (UP_CHEST.includes(i)) wr[i] = M3.mul(torso, wr[i]);
    if (i === IDX.head && S.head) wr[i] = M3.mul(S.head, wr[i]);
    for (const s of ['R', 'L']) {
      const a = ARMS[s], arm = S.arms && S.arms[s], l = LEGS[s], leg = (S.legs && S.legs[s]) || { ankle: restAt('foot_' + s) };
      if (arm) {
        if (i === a.up) { ik[s] = solveArm(a, wp[i], arm); wr[i] = ik[s][0]; }
        else if (i === a.fore) wr[i] = ik[s][1];
        else if (i === a.hand) wr[i] = ik[s][2];
        else if (i === a.fingers) wr[i] = M3.mul(wr[a.hand], M3.rz(a.x < 0 ? arm.curl[0] : -arm.curl[0]));
        else if (i === a.tips) wr[i] = M3.mul(wr[a.fingers], M3.rz(a.x < 0 ? arm.curl[1] : -arm.curl[1]));
        else if (i === a.thumb) wr[i] = M3.mul(wr[a.hand], M3.mul(M3.ry(a.x * 0.75), M3.rx(0.55)));
      }
      if (i === l.up) { ik['leg' + s] = solveLeg(l, wp[i], leg); wr[i] = ik['leg' + s][0]; }
      else if (i === l.low) wr[i] = ik['leg' + s][1];
      else if (i === l.foot) wr[i] = leg.footR || M3.id();
    }
  }
  return { wr, wp };
}
// mix the walking or aiming pose with the scripted one, joint by joint
function blendPose(f, other, w) {
  if (w >= 0.999) { for (let i = 0; i < NB; i++) { f.wr[i] = other.wr[i]; f.wp[i] = other.wp[i]; } return; }
  const wr = new Array(NB), wp = new Array(NB);
  for (let i = 0; i < NB; i++) {
    const p = Rig.parent[i];
    const la = p < 0 ? f.wr[i] : M3.mul(M3.tr(f.wr[p]), f.wr[i]), lb = p < 0 ? other.wr[i] : M3.mul(M3.tr(other.wr[p]), other.wr[i]);
    const l = M3.mix(la, lb, w);
    if (p < 0) { wr[i] = l; wp[i] = V.lerp(f.wp[i], other.wp[i], w); }
    else { wr[i] = M3.mul(wr[p], l); wp[i] = V.add(wp[p], M3.vec(wr[p], Rig.offset[i])); }
  }
  for (let i = 0; i < NB; i++) { f.wr[i] = wr[i]; f.wp[i] = wp[i]; }
}
// a hand whose palm is on a point
function hand(at, dir, palm, pole, curl) {
  const d = V.norm(dir), q = V.orth(palm, d);
  return { wrist: V.add(V.add(at, V.mul(d, -0.085)), V.mul(q, -0.036)), dir: d, palm: q, pole, curl: [curl === undefined ? 0.5 : curl, curl === undefined ? 0.5 : curl] };
}
// keyframes: [[time, value], ...] with eased steps between them
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], u = smooth(a[0], b[0], t);
    return Array.isArray(a[1]) ? V.lerp(a[1], b[1], u) : a[1] + (b[1] - a[1]) * u;
  }
  return keys[keys.length - 1][1];
}
const gunHands = (id, G) => {
  const g = GUNS[id], at = grip => { const dir = V.norm(M3.vec(G.R, grip.dir)), palm = V.orth(M3.vec(G.R, grip.palm), dir); return { wrist: V.add(V.add(V.add(G.p, M3.vec(G.R, V.mul(grip.at, g.scale))), V.mul(dir, -0.085)), V.mul(palm, -0.038)), dir, palm, curl: grip.curl }; };
  return { R: Object.assign(at(g.right), { pole: [-1, -0.3, -0.2] }), L: Object.assign(at(g.left), { pole: [1, -0.3, -0.2] }) };
};
const idleArm = x => hand([x * 0.42, 0.62, 0.05], [x * 0.1, -1, 0.1], [-x, 0, 0], [x * 0.3, 0, -1], 0.35);
const scratchArm = (x, t) => hand([x * 0.13 + Math.sin(t * 26) * 0.028, 1.74, 0.02 + Math.cos(t * 26) * 0.018], [-x, 0.15, 0.1], [0, -1, 0], [x, -0.2, 0.1], 0.9);

// run one-off cues (sounds, words, junk) the first time the clock passes them
function cue(L, at, fn) { if (L.prev < at && L.t >= at) fn(); }
const localToWorld = (L, q) => V.add(L.spot, M3.vec(M3.ry(L.face), q));

// ---------------------------------------------------------------- shake a knocked-out caveman
const BODY = { hold: 3.7, end: 6.5, label: 'loot this caveman' };
function bodyStep(L) {
  const t = L.t, v = L.victim, pr = M3.ry(L.face);
  const ankle = [0, restAt('foot_L')[1], restAt('foot_L')[2]];
  const lying = M3.mul(M3.ry(v.yaw), M3.rx(-1.5)), lyingP = [v.pos[0], v.pos[1] + 0.2, v.pos[2]];
  const ground = V.add(lyingP, M3.vec(lying, ankle));
  const g0 = M3.vec(M3.tr(pr), V.sub(ground, L.spot));            // the ankles, seen by the looter
  const high = [0, 1.78, 0.48];
  const up = smooth(0.95, 1.65, t) * (1 - smooth(3.7, 4.05, t));
  const shaking = t >= 1.7 && t < 3.7, ph = shaking ? ((t - 1.7) % 0.5) / 0.5 : 0;
  const jolt = shaking ? track([[0, 0], [0.28, 0.07], [0.52, -0.17], [0.7, -0.08], [1, 0]], ph) : 0;
  const G = V.add(V.lerp(g0, high, up), [0, jolt, 0]);

  // the looter
  const stoop = track([[0.35, 0], [0.9, 1], [1.5, 0], [3.9, 0], [4.35, 1], [4.8, 0]], t);
  const S = { hips: V.add(restAt('hips'), [0, -0.24 * stoop + jolt * 0.35, -0.06 * stoop]), bend: 1.45 * stoop - 0.16 * up - jolt * 1.4, head: M3.rx(-0.5 * stoop + 0.35 * up), arms: {} };
  if (t < 4.05) {
    const spread = Math.abs(restAt('foot_L')[0]);
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const grab = hand([x * spread, G[1], G[2]], [-x * 0.25, 0.15 + 0.2 * up, 1], [-x, 0, 0], [x, -0.5, -0.2], 1.35);
      const w = smooth(0.4, 0.9, t) * (1 - smooth(3.85, 4.05, t)), rest = idleArm(x);
      S.arms[s] = Object.assign(grab, { wrist: V.lerp(rest.wrist, grab.wrist, w) });
    }
  } else {
    const id = L.gun, gdef = GUNS[id];
    const spot = [-0.36, 0.14, 0.38];                              // where the gun lands
    const mouth = [-0.2 * gdef.scale - (id === 'glock' ? 0 : 0.05), 1.36, 0.28];
    const chew = track([[4.9, 0], [5.0, 0.06], [5.1, 0], [5.25, 0.07], [5.36, 0]], t);
    const low = [-0.32, 0.86, 0.22];
    const at = track([[4.35, spot], [4.85, V.add(mouth, [0, 0, 0.04])], [5.45, V.add(mouth, [0, 0, 0.04])], [5.8, low]], t);
    const turn = track([[4.35, 0], [4.85, 1], [5.45, 1], [5.8, 0]], t);
    const R = M3.mix(M3.mul(M3.ry(0.25), M3.rx(0.15)), M3.mul(M3.ry(Math.PI / 2), M3.rz(0.1)), turn);
    const gp = V.add(at, [0, 0, -chew * 0.5]);
    const H = gunHands(id, { p: gp, R });
    if (t >= 4.35) { S.gun = { id, p: gp, R }; S.arms.R = H.R; }
    else { const w = smooth(4.05, 4.35, t); S.arms.R = hand(V.lerp([-0.42, 0.62, 0.05], spot, w), [0.1, -0.6, 0.8], [0.4, -0.8, 0], [-1, -0.2, -0.3], 0.6); }
    S.arms.L = idleArm(1);
    if (t >= 4.5 && t < 5.45) { const w = smooth(4.5, 4.8, t); S.arms.L = Object.assign(H.L, { wrist: V.lerp(S.arms.L.wrist, H.L.wrist, w), pole: [1, -0.5, 0] }); }
    if (t >= 5.45) {
      const w = smooth(5.5, 5.8, t) * (1 - smooth(6.3, 6.5, t)), s = scratchArm(1, t);
      S.arms.L = Object.assign(s, { wrist: V.lerp(idleArm(1).wrist, s.wrist, w) });
      S.head = M3.mul(M3.rz(-0.3 * w), M3.rx(-0.1 * w));
    } else S.head = M3.mul(M3.rx(-0.5 * stoop + chew * 4.5 + 0.12 * turn), M3.rz(0.05 * turn));
  }
  L.f.script = S;

  // the caveman being shaken, hung by the ankles from the looter's hands
  const turnOver = Math.pow(up, 1.4), swing = shaking ? Math.sin((t - 1.7) * Math.PI * 4 - 0.9) * 0.11 : 0;
  const R = M3.mul(M3.ry(v.yaw), M3.rx(-1.5 + (-Math.PI + 1.5) * turnOver + swing * up));
  const A = localToWorld(L, G);
  const wave = Math.sin(t * 13), V2 = { arms: {}, head: M3.mul(M3.rx(jolt * 2.2 + 0.2), M3.rz(Math.sin(t * 9) * 0.25)), bend: jolt * 1.1 + swing * 1.5 };
  for (const [s, x] of [['R', -1], ['L', 1]]) V2.arms[s] = hand([x * (0.40 + 0.08 * Math.sin(t * 11 + x)), 1.93 - 0.1 * Math.max(0, -jolt * 6), 0.02 + wave * x * 0.2], [x * 0.2, 1, 0], [-x, 0, 0], [x, 0, -0.6], 0.35);
  V2.legs = {};
  for (const [s, x] of [['R', -1], ['L', 1]]) V2.legs[s] = { ankle: restAt('foot_' + s) };
  V2.root = { R, p: V.sub(A, M3.vec(R, ankle)) };
  v.script = V2;

  cue(L, 0.5, () => Sound.play('huh', 0.9));
  cue(L, 0.95, () => { Sound.play('whoosh', 0.9); popWord(V.add(L.spot, [0, 2.2, 0]), 'HNNGH!'); });
  for (let k = 0; k < 4; k++) cue(L, 1.7 + 0.26 + 0.5 * k, () => {
    const under = localToWorld(L, [0, 0.06, G[2]]);
    Sound.play('bonk', 0.9); puff(under, 7, [0.5, 0.47, 0.42, 0.7], 0.8, 0.06, 0.5, 1.5);
    popWord(localToWorld(L, [0, k % 2 ? 0.75 : 0.4, G[2] + (k % 2 ? 0.62 : -0.62)]), ['BONK!', 'DONK!', 'BONK!', 'CLONK!'][k], 0.55);
    const from = localToWorld(L, [0, 0.95, G[2]]);
    if (k < 3) {
      const side = k === 1 ? 1 : -1, land = localToWorld(L, [side * rand(0.55, 0.95), 0.07, G[2] + rand(-0.3, 0.45)]);
      spawnProp(['rock', 'fish', 'bone'][k], from, lob(from, land, 0.6));
    } else L.drop = spawnProp('gun', from, lob(from, localToWorld(L, [-0.36, 0.07, 0.38]), 0.55), { gun: L.gun, life: 4, spin: 9 });
    Sound.play('pop', 0.7);
  });
  cue(L, 4.03, () => { Sound.play('thud', 1); puff(V.add(v.pos, M3.vec(M3.ry(v.yaw), [0, 0.1, -0.8])), 14, [0.5, 0.47, 0.42, 0.7], 1.3, 0.07, 0.6, 1.5); });
  cue(L, 4.35, () => { if (L.drop) L.drop.life = 0; Sound.play('rack', 0.6); });
  for (const at of [5.0, 5.25]) cue(L, at, () => { Sound.play('chomp', 0.9); popWord(localToWorld(L, [at < 5.1 ? -0.4 : 0.35, 1.75, 0.3]), 'CHOMP', 0.5); });
  cue(L, 5.65, () => { Sound.play('huh', 1); popWord(localToWorld(L, [0, 2.2, 0]), '???', 0.85); });
}

// ---------------------------------------------------------------- open a chest the caveman way
const CHEST = { hold: 4.5, end: 6.5, label: 'open the chest' };
function chestStep(L) {
  const t = L.t, c = L.chest, hips0 = restAt('hips');
  const S = { arms: {}, legs: {} };
  // headbutts: lean back, then slam the forehead into the lid
  const bend = track([[0.45, 0], [0.9, 0.12], [1.05, 0], [1.28, -0.5], [1.40, 1.75], [1.52, 1.2], [1.75, -0.1], [1.95, 0], [2.18, -0.65], [2.33, 1.85], [2.46, 1.5], [4.45, 1.5], [4.9, 0]], t);
  const lunge = Math.max(0, bend);
  S.bend = bend; S.hips = V.add(hips0, [0, -0.11 * lunge, -0.05 * lunge]); S.head = M3.rx(bend * 0.12);
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    const back = idleArm(x), fling = hand([x * 0.55, 1.02, -0.38 - 0.1 * lunge], [x * 0.3, -0.5, -0.8], [-x, 0, 0], [x, 0, -1], 0.7);
    const w = smooth(1.05, 1.28, t);
    S.arms[s] = Object.assign(back, { wrist: V.lerp(back.wrist, fling.wrist, w), dir: V.lerp(back.dir, fling.dir, w) });
  }
  // first of all, think about it
  if (t < 1.25) {
    const w = smooth(0.4, 0.65, t) * (1 - smooth(1.0, 1.22, t)), s = scratchArm(-1, t);
    S.arms.R = Object.assign(s, { wrist: V.lerp(S.arms.R.wrist, s.wrist, w) }); S.head = M3.mul(M3.rz(0.28 * w), M3.rx(0.25 * w));
  }
  const dizzy = smooth(1.45, 1.6, t) * (1 - smooth(1.95, 2.1, t));
  if (dizzy > 0) { S.tilt = Math.sin(t * 11) * 0.3 * dizzy; S.twist = Math.cos(t * 11) * 0.25 * dizzy; S.head = M3.mul(M3.rz(Math.sin(t * 14) * 0.35 * dizzy), M3.rx(Math.cos(t * 14) * 0.2 * dizzy)); }

  // then dive in head first, legs in the air
  const dive = smooth(2.5, 2.95, t) * (1 - smooth(4.5, 4.95, t));
  const arc = t < 3.5 ? Math.sin(Math.PI * smooth(2.5, 2.95, t)) : Math.sin(Math.PI * smooth(4.5, 4.95, t));
  const rummage = smooth(2.9, 3.05, t) * (1 - smooth(4.4, 4.5, t));
  if (dive > 0) {
    const theta = 2.32 * dive + Math.sin(t * 15) * 0.07 * rummage;
    const H = V.add(V.lerp(hips0, [0, 0.84, 0.47], dive), [Math.sin(t * 11) * 0.04 * rummage, 0.28 * arc + Math.abs(Math.sin(t * 15)) * 0.035 * rummage, 0]);
    const lr = M3.rx(theta), face = M3.ry(L.face);
    S.root = { R: M3.mul(face, lr), p: localToWorld(L, V.sub(H, M3.vec(lr, hips0))) };
    S.bend = S.bend * (1 - dive) + 0.25 * dive; S.hips = V.lerp(S.hips, hips0, dive); S.head = M3.rx(-0.3 * dive);
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const kick = Math.sin(t * 17 + (x > 0 ? Math.PI : 0)) * rummage;
      S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.1 * dive, (0.16 + 0.1 * kick) * rummage, 0.3 * kick - 0.05 * rummage]), footR: M3.rx(kick * 0.5) };
      const dig = hand([x * (0.18 + 0.09 * Math.sin(t * 13 + x)), 1.72 + 0.12 * Math.cos(t * 19 + x), 0.3 + 0.17 * Math.sin(t * 19 + x * 2)], [0, 1, 0.3], [-x * 0.5, 0, 1], [x, 0, -0.5], 0.8);
      S.arms[s] = Object.assign(dig, { wrist: V.lerp(S.arms[s].wrist, dig.wrist, dive) });
    }
  }

  // and hold the prize up for everyone to see
  if (t >= 4.75) {
    const id = L.gun, take = smooth(4.75, 5.0, t), w = smooth(4.85, 5.2, t), hop = t > 5.15 && t < 6.15 ? Math.abs(Math.sin((t - 5.15) * Math.PI * 2)) : 0;
    const R = M3.mul(M3.ry(Math.PI / 2), M3.rx(-0.08 + Math.sin(t * 9) * 0.1));
    const gp = V.lerp([-0.2, 0.8, 0.35], [id === 'glock' ? -0.12 : -0.25 * GUNS[id].scale, 1.86 + hop * 0.04, 0.12], w);
    const H = gunHands(id, { p: gp, R });
    S.gun = { id, p: gp, R };
    const other = id === 'glock' ? hand([0.34, 0.86, 0.06], [-0.4, -1, 0], [-1, 0, 0], [1, 0, -0.2], 1.1) : H.L;
    for (const [s, goal] of [['R', H.R], ['L', other]]) S.arms[s] = Object.assign(goal, { wrist: V.lerp(S.arms[s].wrist, goal.wrist, take) });
    S.bend = S.bend * (1 - w) - 0.2 * w; S.head = M3.rx(-0.3 * w); S.hips = V.lerp(S.hips, hips0, take);
    S.root = { R: M3.ry(L.face), p: V.add(L.spot, [0, hop * 0.14, 0]) };
    for (const s of ['R', 'L']) S.legs[s] = { ankle: V.add(restAt('foot_' + s), [0, hop * 0.07, 0]) };
  }
  L.f.script = S;

  const lid = V.add(c.pos, [0, 0.62, 0.15]);
  cue(L, 0.55, () => { Sound.play('huh', 0.9); popWord(V.add(L.spot, [0, 2.15, 0]), '?', 0.6); });
  cue(L, 1.39, () => { Sound.play('bonk', 1); c.wobble = 1; popWord(V.add(lid, [0.45, 0.35, 0]), 'BONK!'); puff(lid, 6, [0.6, 0.45, 0.25, 0.8], 1.1, 0.04, 0.4, 4); cam.shake = 0.8; });
  cue(L, 2.32, () => {
    Sound.play('bonk', 1); Sound.play('boing', 0.9); c.wobble = 1; c.forced = true; c.openV += 9; cam.shake = 1;
    popWord(V.add(lid, [-0.4, 0.55, 0]), 'KLONK!'); puff(lid, 12, [0.6, 0.45, 0.25, 0.8], 1.6, 0.045, 0.5, 4);
  });
  cue(L, 2.52, () => Sound.play('whoosh', 1));
  const junk = ['rock', 'bone', 'fish', 'meat', 'rock', 'bone'];
  junk.forEach((kind, k) => cue(L, 3.05 + k * 0.22, () => {
    const from = V.add(c.pos, [rand(-0.2, 0.2), 0.55, 0]);
    // thrown back over his shoulders
    const land = V.add(c.pos, [(k % 2 ? 1 : -1) * rand(0.7, 1.5), 0.07, rand(-0.2, 1.5)]);
    spawnProp(kind, from, lob(from, land, rand(0.75, 0.95)));
    Sound.play('pop', 0.8); c.wobble = Math.max(c.wobble, 0.45);
    if (k === 1 || k === 4) Sound.play('thud', 0.5);
  }));
  cue(L, 4.9, () => { Sound.play('thud', 0.8); puff(L.spot.slice(), 8, [0.5, 0.47, 0.42, 0.7], 0.9, 0.05, 0.4, 1.5); });
  cue(L, 5.1, () => { Sound.play('tada', 0.9); Sound.play('ooga', 0.9); popWord(localToWorld(L, [0, 2.05, -0.8]), 'OOGA!!', 1.1); });

  // stars after each knock on the head
  const see = Math.max(smooth(1.4, 1.52, t) * (1 - smooth(2.0, 2.15, t)), smooth(2.34, 2.42, t) * (1 - smooth(2.55, 2.75, t)));
  if (see > 0) stars.push({ f: L.f, w: see });
}

// ---------------------------------------------------------------- starting, holding, finishing
function lootTarget() {
  if (player.dead >= 0) return null;
  const p = player.pos;
  let best = null, bestD = 1e9;
  for (const b of bots) {
    if (b.dead < 1.2 || b.looted || b.send) continue;
    // anywhere along the body counts
    const back = [-Math.sin(b.yaw), 0, -Math.cos(b.yaw)], u = clamp((p[0] - b.pos[0]) * back[0] + (p[2] - b.pos[2]) * back[2], 0, 1.4);
    const d = Math.hypot(p[0] - b.pos[0] - back[0] * u, p[2] - b.pos[2] - back[2] * u);
    if (d < 1.15 && d < bestD) { bestD = d; best = { kind: 'body', victim: b }; }
  }
  for (const c of chests) {
    const d = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]) - 0.4;
    if (c.t < 0 && d < 1.25 && d < bestD) { bestD = d; best = { kind: 'chest', chest: c }; }
  }
  return best;
}
function startLoot(target) {
  const f = player;
  const L = Object.assign({ f, t: 0, prev: -1, cancel: -1, given: false, vw: 0, start: f.pos.slice(), yaw0: f.yaw }, target);
  if (L.kind === 'body') {
    const v = L.victim, fwd = [Math.sin(v.yaw), 0, Math.cos(v.yaw)];
    L.spot = [v.pos[0] + fwd[0] * 0.55, v.pos[1], v.pos[2] + fwd[2] * 0.55]; L.face = v.yaw + Math.PI;
    L.gun = v.weapon || 'glock'; L.def = BODY; v.beingLooted = true;
  } else {
    L.spot = V.add(L.chest.pos, [0, 0, 0.80]); L.face = Math.PI; L.gun = L.chest.gun; L.def = CHEST;
  }
  f.reload = -1; f.cycle = -1; f.inspect = -1; f.jump = -1; f.air = 0; f.punch = -1; f.ads = 0; f.sprintW = 0; f.crouch = false; f.legYaw = 0; f.speed = 0;
  game.aimToggle = false; mouse.fire = mouse.aim = false;
  looting = L;
  // film it from whichever side the camera is already nearer
  const right = [-Math.cos(L.face), 0, Math.sin(L.face)], fwd = [Math.sin(L.face), 0, Math.cos(L.face)];
  const eye = cameraEye().eye, side = (eye[0] - L.spot[0]) * right[0] + (eye[2] - L.spot[2]) * right[2] >= 0 ? 1 : -1;
  const at = V.add(L.spot, [fwd[0] * 0.42, L.kind === 'body' ? 1.07 : 0.98, fwd[2] * 0.42]);
  const lean = L.kind === 'body' ? 0.06 : -0.34;
  const dir = V.norm([right[0] * side + fwd[0] * lean, 0.16, right[2] * side + fwd[2] * lean]);
  lootShot = { at, eye: V.mad(at, dir, 3.7) };
}
function releaseTarget(L) {
  if (L.victim && L.victim.dead >= 0) { L.victim.beingLooted = false; L.victim.script = null; L.victim.scriptW = 0; if (L.given) { L.victim.looted = true; L.victim.dead = 1.3; } else L.victim.dead = Math.min(L.victim.dead, LOOT_WINDOW - 4); }
  if (L.chest) L.chest.forced = false;
}
function endLoot() {
  const L = looting; if (!L) return;
  releaseTarget(L);
  player.script = null; player.scriptW = 0; looting = null; stars.length = 0;
}
function abortLoot() { endLoot(); }
function grant(L) {
  L.given = true;
  const id = L.gun, had = player.inv.includes(id);
  give(player, id, L.kind === 'body' ? GUNS[id].mag * 2 : undefined);
  const what = had ? GUNS[id].name + ' ammo' : GUNS[id].article + ' ' + GUNS[id].name;
  notify((L.kind === 'body' ? 'Shook out ' : 'Found ') + what);
  if (L.chest) { L.chest.t = 0; L.chest.forced = false; }
  hudDirty = true;
}
// true while the looting animation owns the player
function lootStep(dt) {
  const holding = keys.has('KeyE');
  const pressed = holding && !lootHeld;
  lootHeld = holding;
  stars.length = 0;
  lootCam = clamp(lootCam + (looting && looting.cancel < 0 && looting.t < looting.def.end - 0.45 ? dt / 0.65 : -dt / 0.55), 0, 1);
  if (!looting) {
    const target = pressed ? lootTarget() : null;
    if (!target) return false;
    startLoot(target);
  }
  const L = looting, f = player;
  f.time += dt;
  if (L.victim && L.victim.dead < 0) { endLoot(); return false; }
  if (L.cancel < 0 && !L.given && !holding) {
    L.cancel = 0;
    if (L.victim) L.vw = L.victim.scriptW;
    if (L.kind === 'body' && L.vw > 0.3) Sound.play('thud', 0.7);
  }
  if (L.cancel >= 0) {                                    // let go: ease back out
    L.cancel += dt;
    const w = 1 - smooth(0, 0.35, L.cancel);
    f.scriptW = L.w0 === undefined ? w : L.w0 * w;
    if (L.victim) L.victim.scriptW = L.vw * w;
    if (L.chest) L.chest.forced = false;
    weaponStep(f, dt);
    if (L.cancel >= 0.35) { endLoot(); f.equip = 0; return false; }
    return true;
  }
  L.prev = L.t; L.t += dt;
  const t = L.t;
  // step into place, turning to face it
  const go = smooth(0, 0.45, t);
  if (t < 0.6) {
    const before = f.pos.slice();
    f.pos = V.lerp(L.start, L.spot, go);
    f.yaw = L.yaw0 + wrap(L.face - L.yaw0) * go;
    f.speed = Math.min(2.2, V.len(V.sub(f.pos, before)) / dt);
    f.phase = (f.phase + dt * 1.6) % 1;
  } else f.speed = 0;
  const gait = f.speed > 0.2 ? 'Walk' : 'Idle';
  for (const n of CLIP_NAMES) f.weights[n] = n === gait ? 1 : 0;
  cam.yaw += wrap(L.face - Math.PI - cam.yaw) * Math.min(1, dt * 5);
  cam.pitch += (0.18 - cam.pitch) * Math.min(1, dt * 5);

  (L.kind === 'body' ? bodyStep : chestStep)(L);
  const out = 1 - smooth(L.def.end - 0.28, L.def.end, t);
  f.scriptW = smooth(0.28, 0.55, t) * out; L.w0 = f.scriptW;
  if (L.victim) L.victim.scriptW = t < 0.95 || t > 4.05 ? 0 : smooth(0.95, 1.2, t) * (1 - smooth(3.9, 4.05, t));
  if (!L.given && t >= L.def.hold) grant(L);
  weaponStep(f, dt);
  if (t >= L.def.end) {
    const id = L.gun;
    endLoot();
    if (f.weapon === id) f.equip = 0; else equip(f, id);
  }
  return true;
}
function hudLoot(dt) {
  const target = looting ? null : lootTarget();
  const L = looting && !looting.given && looting.cancel < 0 ? looting : null;
  const show = (target || L) && player.dead < 0;
  ui.prompt.style.display = show ? 'flex' : 'none';
  ui.prompt.classList.toggle('holding', !!L);
  if (show) {
    const kind = L ? L.kind : target.kind, def = kind === 'body' ? BODY : CHEST;
    const gun = kind === 'chest' ? ' (' + GUNS[(L || target).chest.gun].name + ')' : '';
    ui.prompttext.textContent = (L ? 'Keep holding… ' : 'Hold E to ' + def.label) + (L ? '' : gun);
    ui.ring.style.setProperty('--p', (L ? clamp(L.t / L.def.hold, 0, 1) * 100 : 0) + '%');
  }
  for (const q of pops) {
    const at = project(V.add(q.p, [0, q.t * 0.25, 0]));
    q.el.style.display = at ? 'block' : 'none';
    if (!at) continue;
    const grow = q.t < 0.14 ? q.t / 0.14 * 1.25 : 1 + 0.25 * Math.max(0, 1 - (q.t - 0.14) / 0.1);
    q.el.style.left = at[0] + 'px'; q.el.style.top = at[1] + 'px';
    q.el.style.transform = `translate(-50%, -50%) rotate(${q.tilt}deg) scale(${grow})`;
    q.el.style.opacity = Math.min(1, (q.life - q.t) / 0.2);
  }
}
