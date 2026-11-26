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
// ---------------------------------------------------------------- physics for the junk
// Each thing is a rigid body touching the world at a handful of points on its real shape: it falls, tumbles,
// bounces, slides with friction, rolls over onto its flattest side and goes to sleep. Points are in the
// thing's own space, before its draw scale.
const ell = (rx, ry, rz, c) => { c = c || [0, 0, 0]; const k = 0.62; const out = [];
  for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) out.push([c[0] + x * rx, c[1] + y * ry, c[2] + z * rz]);
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([c[0] + x * rx * k, c[1] + y * ry * k, c[2] + z * rz * k]);
  return out; };
const SHAPES = {
  rock: ell(0.085, 0.065, 0.075),
  bone: [...ell(0.03, 0.03, 0.12), ...[-1, 1].flatMap(z => [[0.063, 0, z * 0.12], [-0.063, 0, z * 0.12], [0, 0.036, z * 0.12], [0, -0.036, z * 0.12], [0, 0, z * 0.156]])],
  fish: ell(0.035, 0.065, 0.15),
  meat: [...ell(0.075, 0.075, 0.11, [0, 0, 0.03]), [0, 0.028, -0.21], [0, -0.028, -0.21], [0.045, 0, -0.21], [-0.045, 0, -0.21]],
  c4: [-1, 1].flatMap(x => [-1, 1].flatMap(z => [[x * 0.15, 0, z * 0.105], [x * 0.15, 0.093, z * 0.105]])),  // the brick, bottom at 0
  roll: [-1, 1].flatMap(y => Array.from({ length: 10 }, (_, i) => [Math.cos(i / 10 * Math.PI * 2) * 0.07, y * 0.024, Math.sin(i / 10 * Math.PI * 2) * 0.07]))   // duct tape, axis y
};
const gunShapes = {};
function gunShape(id) {                       // the corners of the gun's box, placed the way drawProps draws it
  if (gunShapes[id]) return gunShapes[id];
  const v = new Float32Array(b64bytes(window.GUN_DATA[id].body.v).buffer), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < v.length; i += 8) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], v[i + c]); hi[c] = Math.max(hi[c], v[i + c]); }
  const s = GUNS[id].scale / 1.25, out = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) out.push([x * s, y * s - 0.04, z * s - 0.1]);
  for (const z of [lo[2], hi[2]]) out.push([(lo[0] + hi[0]) / 2 * s, (lo[1] + hi[1]) / 2 * s - 0.04, z * s - 0.1]);   // nose and butt
  return (gunShapes[id] = out);
}
function spawnProp(kind, p, v, o) {
  const prop = Object.assign({ kind, p: p.slice(), v: v.slice(), R: M3.ry(rand(0, 6.3)), life: 7, rest: false, still: 0, scale: 1.25 }, o || {});
  // a random tumble to start with (old callers gave an axis and a spin rate)
  if (!prop.w) { const a = V.norm([rand(-1, 1), rand(-1, 1), rand(-1, 1)]); prop.w = V.mul(a, prop.spin || rand(5, 11)); }
  const local = kind === 'gun' ? gunShape(prop.gun) : kind === 'mag' ? magShape(prop.gun) : SHAPES[kind];
  prop.pts = local.map(q => V.mul(q, prop.scale));
  const r = Math.max(...prop.pts.map(V.len));
  prop.rad = r; prop.invI = 1 / (0.33 * r * r);           // a fair guess at how hard it is to spin
  props.push(prop);
  while (props.length > 60) { const k = props.findIndex(q => !q.keep); props.splice(k < 0 ? 0 : k, 1); }
  return prop;
}
// a lob from one point that lands on another after t seconds
const lob = (from, to, t) => [(to[0] - from[0]) / t, (to[1] - from[1]) / t + 4.9 * t, (to[2] - from[2]) / t];
function groundNormal(x, z) {
  if (world.map !== 'island') return [0, 1, 0];
  const e = 0.15;
  return V.norm([floorAt(x - e, z) - floorAt(x + e, z), 2 * e, floorAt(x, z - e) - floorAt(x, z + e)]);
}
// one contact: stop it going into the surface (with a little bounce if it hit hard), and rub with friction
function contact(o, r, n, bounce) {
  const vp = V.add(o.v, V.cross(o.w, r)), vn = V.dot(vp, n);
  if (vn >= 0) return 0;
  const rn = V.cross(r, n), j = -(1 + (vn < -1.6 ? bounce : 0)) * vn / (1 + o.invI * V.dot(rn, rn));
  o.v = V.mad(o.v, n, j); o.w = V.mad(o.w, rn, o.invI * j);
  const vp2 = V.add(o.v, V.cross(o.w, r)), vt = V.sub(vp2, V.mul(n, V.dot(vp2, n))), sl = V.len(vt);
  if (sl > 1e-4) {
    const t = V.mul(vt, 1 / sl), rt = V.cross(r, t);
    const jt = Math.max(-sl / (1 + o.invI * V.dot(rt, rt)), -0.55 * j);
    o.v = V.mad(o.v, t, jt); o.w = V.mad(o.w, rt, o.invI * jt);
  }
  return -vn;
}
function propStep(o, h) {
  o.v[1] -= 9.8 * h;
  o.p = V.mad(o.p, o.v, h);
  const spin = V.len(o.w);
  if (spin > 1e-5) {
    const R = M3.mul(M3.axis(o.w, spin * h), o.R);           // turn, then keep it a clean rotation
    const x = V.norm(M3.vec(R, [1, 0, 0])), y = V.norm(V.orth(M3.vec(R, [0, 1, 0]), x));
    o.R = M3.cols(x, y, V.cross(x, y));
  }
  // the ground: find every point that went under, push out of the deepest, then resolve each
  let touch = false, hit = 0, deep = 0, n = null;
  const under = [];
  for (const q of o.pts) {
    const r = M3.vec(o.R, q), x = o.p[0] + r[0], z = o.p[2] + r[2], g = floorAt(x, z, o.p[1] + r[1]), d = g - (o.p[1] + r[1]);
    if (d > -0.004) { under.push(r); if (d > deep) { deep = d; n = groundNormal(x, z); } }
  }
  if (under.length) {
    touch = true;
    n = n || groundNormal(o.p[0], o.p[2]);
    if (deep > 0) o.p = V.mad(o.p, [0, 1, 0], deep);
    for (let pass = 0; pass < 2; pass++) for (const r of under) hit = Math.max(hit, contact(o, r, n, 0.32));
    o.w = V.mul(o.w, Math.exp(-h * 2.5)); o.v = V.mul(o.v, Math.exp(-h * 0.6));   // rolling resistance
  }
  // trunks, rocks and posts: bounce off their sides
  if (world.map === 'island') for (const s of solidsNear(o.p[0], o.p[2])) {
    if (o.p[1] > s.y + s.h - 0.05) continue;
    const e = edgeOf(s, o.p[0], o.p[2]), pad = o.rad * 0.6;
    if (e.d >= pad) continue;
    let dx = o.p[0] - e.at[0], dz = o.p[2] - e.at[1], len = Math.hypot(dx, dz) || 1;
    if (e.d < 0) { dx = -dx; dz = -dz; }
    const nn = [dx / len, 0, dz / len];
    o.p[0] += nn[0] * (pad - e.d); o.p[2] += nn[2] * (pad - e.d);
    hit = Math.max(hit, contact(o, V.mul(nn, -o.rad * 0.6), nn, 0.4));
  }
  o.w = V.mul(o.w, Math.exp(-h * 0.15));                     // air
  return { touch, hit };
}
function propsStep(dt) {
  for (let i = props.length - 1; i >= 0; i--) {
    const o = props[i];
    if ((o.life -= dt) <= 0) { props.splice(i, 1); continue; }
    if (o.rest) continue;
    const steps = Math.max(1, Math.ceil(dt / 0.006)), h = dt / steps;
    let touch = false, hit = 0;
    for (let k = 0; k < steps; k++) { const c = propStep(o, h); touch = touch || c.touch; hit = Math.max(hit, c.hit); }
    if (hit > 1.4 && game.time - (o.clack || 0) > 0.08) {    // a clatter, louder for harder hits
      o.clack = game.time;
      const near = clamp(1.4 - V.len(V.sub(o.p, player.pos)) / 25, 0, 1), k = Math.min(1, hit / 7) * near;
      if (k > 0.03) { if (o.kind === 'gun') { Sound.play('magout', k * 0.9); Sound.play('thud', k * 0.5); } else Sound.play(o.kind === 'rock' ? 'thud' : 'click', k * 0.6); }
    }
    // asleep once it has been lying still for a moment
    o.still = touch && V.len(o.v) < 0.09 && V.len(o.w) < 0.5 ? o.still + dt : 0;
    if (o.still > 0.3) { o.rest = true; o.v = [0, 0, 0]; o.w = [0, 0, 0]; }
  }
  for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.t += dt; if (q.t > q.life) { q.el.remove(); pops.splice(i, 1); } }
}
// a blast or a shove: everything nearby gets thrown about, sleeping things included
function shoveProps(c, radius, power) {
  for (const o of props) {
    const d = V.sub(o.p, c), len = V.len(d);
    if (len > radius) continue;
    const k = power * (1 - len / radius), dir = V.norm(V.add(V.mul(d, 1 / (len || 1)), [0, 0.8, 0]));
    o.v = V.mad(o.v, dir, k); o.w = V.add(o.w, [rand(-1, 1) * k * 2, rand(-1, 1) * k * 2, rand(-1, 1) * k * 2]); o.rest = false; o.still = 0;
  }
}

// ---------------------------------------------------------------- dropping your gun (G), picking it back up (E)
function dropGun(f) {
  if (f.dead >= 0 || looting) return;
  if (f.holdC4) {                                          // drop one C4 (not armed)
    if (f.plantT >= 0 || !f.c4) return;
    const fwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)], R = M3.ry(f.yaw);
    spawnProp('c4', V.add(f.pos, M3.vec(R, C4_HOLD)), [fwd[0] * 2.2, 2.2, fwd[2] * 2.2], { R, scale: 1, life: 120, keep: true, w: [rand(-4, 4), rand(-2, 2), rand(-4, 4)] });
    f.c4--; if (!f.c4) f.holdC4 = false;
    Sound.play('whoosh', 0.5); notify('Dropped a C4'); hudDirty = true;
    return;
  }
  if (!f.weapon) return;
  const id = f.weapon, am = f.ammo[id], fwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)];
  const from = f.gun ? f.gun.p.slice() : V.add(f.pos, [fwd[0] * 0.4, 1.2, fwd[2] * 0.4]);
  const R = f.gun ? f.gun.R.slice() : M3.ry(f.yaw);
  const v = [fwd[0] * 2.6 + (f.vel ? f.vel[0] : 0), 2.4, fwd[2] * 2.6 + (f.vel ? f.vel[1] : 0)];
  const w = V.add(V.mul([Math.cos(f.yaw), 0, -Math.sin(f.yaw)], rand(3, 6)), [0, rand(-3, 3), 0]);
  spawnProp('gun', from, v, { gun: id, R, w, life: 120, keep: true, ammo: { clip: am.clip, spare: am.spare } });
  f.inv.splice(f.inv.indexOf(id), 1); delete f.ammo[id];
  f.weapon = null; f.reload = -1; f.cycle = -1; f.inspect = -1; f.bolt = 0; f.equip = 1;
  Sound.play('whoosh', 0.5);
  if (f.isPlayer) { notify('Dropped the ' + GUNS[id].name); hudDirty = true; }
}
function gunNear(p) {
  let best = null, bestD = 1.4;
  for (const o of props) {
    if (!(o.kind === 'gun' && o.ammo) && !(o.kind === 'c4' && player.c4 < C4_MAX)) continue;
    if (Math.abs(o.p[1] - p[1]) > 1.8) continue;               // not through a cave roof
    const d = Math.hypot(o.p[0] - p[0], o.p[2] - p[2]);
    if (d < bestD && Math.abs(o.p[1] - p[1]) < 1.6) { bestD = d; best = o; }
  }
  return best;
}
function pickUp(o) {
  if (o.kind === 'c4') { props.splice(props.indexOf(o), 1); giveC4(player); Sound.play('magin', 0.6); notify('Picked up a C4 (press 5)'); return; }
  const f = player, id = o.gun, g = GUNS[id];
  if (!f.inv.includes(id)) { f.inv.push(id); f.inv.sort((a, b) => SLOTS.indexOf(a) - SLOTS.indexOf(b)); f.ammo[id] = { clip: o.ammo.clip, spare: o.ammo.spare }; }
  else f.ammo[id].spare = Math.min(g.reserve * 3, f.ammo[id].spare + o.ammo.clip + o.ammo.spare);
  props.splice(props.indexOf(o), 1);
  notify('Picked up ' + g.article + ' ' + g.name); hudDirty = true;
  if (f.weapon !== id) equip(f, id); else Sound.play('rack', 0.5);
}
function drawProps(prog, textured) {
  for (const o of props) {
    const k = o.scale * Math.min(1, o.life / 0.4), S = o.R.map(x => x * k);
    if (o.kind === 'roll') { drawRoll(prog, o.p, o.R.map(x => x * Math.min(1, o.life / 0.4))); continue; }
    if (o.kind === 'c4') { drawC4(prog, o.p, o.R.map(x => x * Math.min(1, o.life / 0.4)), false, 0); continue; }
    if (o.kind === 'gun') { const g = GUNS[o.gun]; drawGun(prog, textured, g, S.map(x => x * g.scale / 1.25), V.add(o.p, M3.vec(S, [0, -0.04, -0.1])), {}); continue; }
    if (o.kind === 'mag') { const g = GUNS[o.gun], M = S.map(x => x * g.scale); drawMag(prog, textured, g, M, V.sub(o.p, M3.vec(M, g.magMid))); continue; }
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
// keyframes: [[time, value], ...] as one smooth curve that flows through them (Catmull-Rom), easing only at the very
// start and end. Unlike track() it does not stop at every key, so the motion carries on like a real one.
function flow(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 1; while (keys[i][0] < t) i++;
  const k0 = keys[Math.max(0, i - 2)], k1 = keys[i - 1], k2 = keys[i], k3 = keys[Math.min(n - 1, i + 1)];
  const u = (t - k1[0]) / (k2[0] - k1[0]);
  // tangents scaled for uneven key spacing; zero at the first and last key, so it eases in and out there
  const d1 = k2[0] - k1[0], m = (a, c, ta, tc) => (c - a) / (tc - ta) * d1;
  const one = (a, b, c, d) => {
    const m1 = k0 === k1 ? 0 : m(a, c, k0[0], k2[0]), m2 = k3 === k2 ? 0 : m(b, d, k1[0], k3[0]);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * b + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c + (u3 - u2) * m2;
  };
  if (Array.isArray(k1[1])) return k1[1].map((_, c) => one(k0[1][c], k1[1][c], k2[1][c], k3[1][c]));
  return one(k0[1], k1[1], k2[1], k3[1]);
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

// ---------------------------------------------------------------- loot a knocked-out caveman
// He kneels down by the body (a ragdoll the whole time), pokes the guy's cheek once to make sure he is out, pats him
// down, finds the gun on his hip, has a look at it and gets up with it.
const BODY = { hold: 2.5, end: 3.7, label: 'loot this caveman' };
const BD = { kneel: 0.35, down: 0.8, poke: 0.98, pat: 1.15, find: 1.9, pull: 2.15, look: 2.35, rise: 2.7, up: 3.1 };
function bodyStep(L) {
  const t = L.t, v = L.victim, hips0 = restAt('hips'), rag = v.rag;
  const toLocal = w => M3.vec(M3.ry(-L.face), V.sub(w, L.spot));
  const pt = n => rag ? toLocal(rag.p[RP[n]]) : toLocal(bonePos(v, n));
  const belly = toLocal(bellyTop(v)), chestP = V.add(pt('chest'), [0, 0.12, 0]), head = pt('head'), hipP = pt('hips');
  const kneel = flow([[BD.kneel, 0], [BD.down, 1], [BD.rise, 1], [BD.up, 0]], t);
  const S = {
    hips: V.add(hips0, [0.02 * kneel, -0.33 * kneel, -0.06 * kneel]),
    bend: flow([[BD.kneel, 0], [BD.down, 0.55], [BD.pat, 0.7], [BD.find, 0.75], [BD.look, 0.35], [BD.rise, 0.3], [BD.up, 0]], t),
    twist: flow([[BD.down, 0], [BD.poke, 0.25], [BD.pat, 0.1], [BD.find, -0.1], [BD.pull, -0.15], [BD.look, 0], [BD.up, 0]], t),
    arms: {}, legs: {
      R: { ankle: V.lerp(restAt('foot_R'), [-0.16, 0.07, -0.3], kneel), pole: [-0.2, -0.5, 1], footR: M3.rx(1.1 * kneel) },  // knee on the ground
      L: { ankle: V.lerp(restAt('foot_L'), [0.18, 0.08, 0.32], kneel), pole: [0.3, 0.3, 1] }                                // foot planted in front
    }
  };
  // where he is looking: at the face for the poke, down at his hands, at the gun
  S.head = M3.mul(M3.rx(flow([[BD.kneel, 0], [BD.down, 0.25], [BD.poke, 0.35], [BD.pat, 0.45], [BD.find, 0.4], [BD.look, -0.15], [BD.rise, -0.1], [BD.up, 0]], t)),
    M3.rz(flow([[BD.down, 0], [BD.look, 0], [BD.look + 0.15, 0.2], [BD.rise, 0.15], [BD.up, 0]], t)));
  // right hand: poke, pats, then the gun; left hand: pats, then rests on his knee
  const idleR = idleArm(-1), idleL = idleArm(1);
  const reachIn = flow([[BD.kneel, 0], [BD.down, 1], [BD.rise, 1], [BD.up, 0]], t);
  const patY = (k, base) => base + 0.1 * Math.max(0, Math.cos((t - BD.pat) / 0.18 * Math.PI + k * Math.PI));   // up and down, the hands taking turns
  let rh = null, lh = null;
  if (t < BD.pat) {
    const tap = Math.max(0, Math.sin((t - BD.poke + 0.08) / 0.16 * Math.PI)) * (t > BD.poke - 0.08 && t < BD.poke + 0.08 ? 1 : 0);
    const cheek = V.add(head, [0, 0.06, 0]), near = V.lerp(V.add(cheek, [0, 0.15, -0.08]), cheek, tap);
    rh = hand(V.lerp(idleR.wrist.map((x, k) => k === 1 ? x + 0.1 : x), near, smooth(BD.kneel + 0.2, BD.poke - 0.1, t)), [0.2, -0.9, 0.4], [0, 0.4, 0.9], [-1, -0.6, -0.2], 0.2);
    lh = hand([0.16, 0.48 * (1 - kneel) + 0.42 * kneel, 0.32], [0, -1, 0.3], [0, 0, 1], [1, -0.3, -0.5], 0.6);           // hand on his knee
  } else if (t < BD.find) {
    rh = hand(V.add(belly, [-0.05, patY(0, 0.02), 0.02]), [0, -0.6, 0.8], [0, -0.8, -0.6], [-1, -0.6, -0.2], 0.3);
    lh = hand(V.add(chestP, [0.05, patY(1, 0.02), 0]), [0, -0.6, 0.8], [0, -0.8, -0.6], [1, -0.6, -0.2], 0.3);
  } else lh = hand([0.16, 0.42 * kneel + 0.62 * (1 - kneel), 0.3 * kneel + 0.05], [0, -1, 0.3], [0, 0, 1], [1, -0.3, -0.5], 0.6);
  // the gun: found on his hip, pulled out, looked at, brought up as he stands
  if (t >= BD.find) {
    const id = L.gun, g = GUNS[id];
    const gp = flow([[BD.find, V.add(hipP, [0, 0.06, 0])], [BD.pull, V.add(hipP, [0, 0.12, -0.12])], [BD.look, [-0.08, 0.66, 0.48]], [BD.rise, [-0.1, 0.7, 0.46]], [BD.up + 0.2, [-0.22, 1.0, 0.36]]], t);
    const lookR = M3.mul(M3.ry(0.75), M3.rz(0.7)),   // held out in front, turned on its side so he can see it, pointing away from him
          readyR = M3.mul(M3.ry(0.15), M3.rx(0.08)), flat = M3.ry(Math.PI / 2);
    const R = t < BD.pull ? flat : t < BD.rise ? M3.mix(flat, lookR, smooth(BD.pull, BD.look, t)) : M3.mix(lookR, readyR, smooth(BD.rise, BD.up + 0.2, t));
    const H = gunHands(id, { p: gp, R });
    S.gun = { id, p: gp, R };
    rh = H.R;
    if (t > BD.look && id !== 'glock') lh = mixGoal(lh, H.L, smooth(BD.look, BD.rise, t));
  }
  S.arms.R = mixGoal(idleR, rh, reachIn > 0 || t >= BD.find ? Math.max(reachIn, t >= BD.find ? 1 : 0) : 0);
  S.arms.L = mixGoal(idleL, lh, Math.max(reachIn, t >= BD.look ? smooth(BD.look, BD.rise, t) : 0));
  if (rag) rag.pin = null;
  L.f.script = S;

  const word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  cue(L, BD.poke, () => { Sound.play('pop', 0.5); if (rag) ragPush(v, rag.p[RP.head], V.mul(V.norm(M3.vec(M3.ry(L.face), [0, -0.3, 1])), 1.2), 0.25); word([0, 1.4, 0.3], 'hm?', 0.5); });
  for (let k = 0; k < 4; k++) cue(L, BD.pat + 0.09 + k * 0.18, () => { Sound.play('thud', 0.25); if (rag) ragPush(v, localToWorld(L, k % 2 ? chestP : belly), [0, -0.8, 0], 0.3); });
  cue(L, BD.pull, () => Sound.play('rack', 0.6));
  cue(L, BD.look + 0.05, () => { Sound.play('ooo', 0.6, 0.4); word([0, 1.6, 0.3], 'ooh', 0.6); });
}

// ---------------------------------------------------------------- open a chest
// He crouches, lifts the lid with both hands until it swings open, has a peek, reaches in and rummages, pulls the
// prize out, stands up and blows the dust off it (the caveman bit), then holds it ready.
const CHEST = { hold: 2.7, end: 3.9, label: 'open the chest' };
const CS = { crouch: 0.3, grip: 0.8, lift: 1.25, peek: 1.45, rummage: 1.6, pull: 2.4, up: 2.75, blow: 2.95, ready: 3.4 };
function chestStep(L) {
  const t = L.t, c = L.chest, hips0 = restAt('hips');
  const toLocal = w => M3.vec(M3.ry(-L.face), V.sub(w, L.spot));
  // the front edge of the lid, wherever it is, in his space (x across the chest)
  const lidEdge = (x, open) => toLocal(V.add(V.add(c.pos, [0, 0.44, -0.30]), M3.vec(M3.rx(-1.9 * open), [x, 0.07, 0.6])));
  const open = flow([[CS.grip, 0], [CS.lift, 0.55]], t);
  if (t >= CS.grip && t < CS.lift) c.held = open;
  else if (t >= CS.lift && c.held !== null && c.held !== undefined) { c.held = null; c.forced = true; c.openV = 4; }   // lets go: it swings open
  const crouch = flow([[CS.crouch, 0], [CS.grip, 1], [CS.lift, 0.65], [CS.peek, 0.75], [CS.pull, 0.8], [CS.up, 0], [CS.ready, 0]], t);
  const S = {
    hips: V.add(hips0, [0, -0.36 * crouch, -0.12 * crouch]),
    bend: flow([[CS.crouch, 0], [CS.grip, 0.55], [CS.lift, 0.25], [CS.peek, 0.75], [CS.rummage, 0.8], [CS.pull, 0.6], [CS.up, 0.05], [CS.blow, 0.1], [CS.ready, 0]], t),
    head: M3.rx(flow([[CS.crouch, 0], [CS.grip, 0.15], [CS.lift, -0.05], [CS.peek, 0.4], [CS.pull, 0.3], [CS.up, 0.05], [CS.blow, 0.2], [CS.ready, 0]], t)),
    arms: {}, legs: {}
  };
  for (const [s, x] of [['R', -1], ['L', 1]]) S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.06 * crouch, 0, -0.04 * crouch]), pole: [x * 0.45, 0, 1] };
  const idleR = idleArm(-1), idleL = idleArm(1), into = flow([[CS.crouch, 0], [CS.grip, 1], [CS.ready, 1]], t);
  let rh, lh;
  if (t < CS.lift) {                                              // both hands under the front of the lid
    const grip = x => hand(V.add(lidEdge(x * 0.28, open), [0, -0.02, -0.02]), [x * 0.1, 0.1, 1], [0, 1, 0], [x, -0.6, -0.3], 1.0);
    rh = grip(-1); lh = grip(1);
  } else if (t < CS.pull) {                                       // left hand on the front edge, right hand in and rummaging
    lh = hand([0.24, 0.5, 0.5], [0, -0.5, 1], [0, -1, 0], [1, -0.6, -0.3], 0.8);
    const dig = t > CS.rummage ? [0.07 * Math.sin(t * 13), 0.05 * Math.abs(Math.sin(t * 9)), 0.06 * Math.cos(t * 11)] : [0, 0, 0];
    rh = hand(V.add(flow([[CS.lift, [-0.12, 0.75, 0.45]], [CS.peek, [-0.1, 0.62, 0.62]], [CS.rummage, [-0.08, 0.36, 0.8]], [CS.pull, [-0.08, 0.36, 0.8]]], t), dig), [0, -0.7, 0.7], [0, -0.7, -0.7], [-1, -0.6, -0.2], 0.9);
  }
  // the prize: out of the chest, dusted off, held ready
  if (t >= CS.pull) {
    const id = L.gun, vest = id === 'vest';
    const pos = flow([[CS.pull, [-0.08, 0.38, 0.8]], [CS.up, [-0.1, 1.0, 0.45]], [CS.blow, [-0.1, 1.42, 0.36]], [CS.blow + 0.25, [-0.1, 1.42, 0.36]], [CS.ready, vest ? [0, 1.1, 0.35] : [-0.22, 1.0, 0.36]], [CHEST.end, vest ? [0, 1.1, 0.35] : [-0.22, 1.0, 0.36]]], t);
    if (vest) {
      S.vest = { p: pos, R: M3.rx(-0.1) };
      rh = hand(V.add(pos, [-0.2, 0.06, 0]), [0.1, 1, 0.1], [1, 0, 0], [-1, -0.3, -0.3], 1.1);
      lh = hand(V.add(pos, [0.2, 0.06, 0]), [-0.1, 1, 0.1], [-1, 0, 0], [1, -0.3, -0.3], 1.1);
    } else {
      const side = M3.ry(Math.PI / 2), readyR = M3.mul(M3.ry(0.15), M3.rx(0.08));
      const R = t < CS.blow + 0.25 ? side : M3.mix(side, readyR, smooth(CS.blow + 0.25, CS.ready, t));
      const H = gunHands(id, { p: pos, R });
      S.gun = { id, p: pos, R }; rh = H.R;
      lh = id === 'glock' || t < CS.up ? hand([0.24, 0.5 + 0.4 * smooth(CS.pull, CS.up, t), 0.5 - 0.15 * smooth(CS.pull, CS.up, t)], [0, -0.5, 1], [0, -1, 0], [1, -0.6, -0.3], 0.8) : mixGoal(hand([0.24, 0.9, 0.35], [0, -0.5, 1], [0, -1, 0], [1, -0.6, -0.3], 0.8), H.L, smooth(CS.up, CS.blow, t));
    }
    S.head = M3.mul(S.head, M3.rz(0.12 * Math.sin(Math.PI * smooth(CS.blow - 0.1, CS.ready, t))));
  }
  S.arms.R = mixGoal(idleR, rh, into); S.arms.L = mixGoal(idleL, lh, into);
  L.f.script = S;

  const word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  cue(L, CS.grip + 0.05, () => Sound.play('click', 0.5));
  cue(L, CS.grip + 0.1, () => Sound.play('creak', 0.9));
  cue(L, CS.rummage + 0.05, () => Sound.play('whoosh', 0.35));
  cue(L, CS.rummage + 0.4, () => Sound.play('click', 0.5));
  cue(L, CS.pull, () => Sound.play(L.gun === 'vest' ? 'vest' : 'rack', 0.6));
  cue(L, CS.blow, () => {                                         // pfff: dust off it
    Sound.play('whoosh', 0.6); word([0, 1.75, 0.4], 'pff', 0.5);
    const at = localToWorld(L, [-0.1, 1.42, 0.42]);
    for (let k = 0; k < 14; k++) particles.push({ p: V.add(at, [rand(-0.12, 0.12), rand(-0.03, 0.05), rand(-0.12, 0.12)]), v: V.add(M3.vec(M3.ry(L.face), [rand(-0.3, 0.3), rand(0.1, 0.5), rand(0.6, 1.3)]), [0, 0, 0]), life: rand(0.6, 1.1), max: 1.1, size: rand(0.03, 0.06), color: [0.72, 0.66, 0.55, 0.55], grav: -0.15, grow: 0.12 });
  });
}

// ---------------------------------------------------------------- starting, holding, finishing
function lootTarget() {
  if (player.dead >= 0 || player.ride) return null;
  const p = player.pos;
  let best = null, bestD = 1e9;
  for (const b of bots) {
    if (b.dead < 1.2 || b.looted || b.send || Math.abs(b.pos[1] - p[1]) > 1.6) continue;
    // anywhere along the body counts
    const back = [-Math.sin(b.yaw), 0, -Math.cos(b.yaw)], u = clamp((p[0] - b.pos[0]) * back[0] + (p[2] - b.pos[2]) * back[2], 0, 1.4);
    const d = Math.hypot(p[0] - b.pos[0] - back[0] * u, p[2] - b.pos[2] - back[2] * u);
    if (d < 1.15 && d < bestD) { bestD = d; best = { kind: 'body', victim: b }; }
  }
  for (const c of chests) {
    const d = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]) - 0.4;
    if (c.t < 0 && Math.abs(c.pos[1] - p[1]) < 1.4 && d < 1.25 && d < bestD) { bestD = d; best = { kind: 'chest', chest: c }; }
  }
  return best;
}
function startLoot(target) {
  const f = player;
  const L = Object.assign({ f, t: 0, prev: -1, cancel: -1, given: false, vw: 0, start: f.pos.slice(), yaw0: f.yaw }, target);
  if (L.kind === 'body') {
    const v = L.victim, B = bellyTop(v), hp = bonePos(v, 'hips'), nk = bonePos(v, 'neck');
    let ax = [nk[0] - hp[0], 0, nk[2] - hp[2]];
    ax = Math.hypot(ax[0], ax[2]) > 0.05 ? V.norm(ax) : [-Math.sin(v.yaw), 0, -Math.cos(v.yaw)];
    const perp = [ax[2], 0, -ax[0]], side = (f.pos[0] - B[0]) * perp[0] + (f.pos[2] - B[2]) * perp[2] >= 0 ? 1 : -1, out = V.mul(perp, side);
    const x = B[0] + out[0] * 0.62, z = B[2] + out[2] * 0.62;
    L.spot = [x, floorAt(x, z), z]; L.face = Math.atan2(-out[0], -out[2]);   // beside his belly, facing him
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
  if (L.victim && L.victim.rag) L.victim.rag.pin = null;
  if (L.victim && L.victim.dead >= 0) { L.victim.beingLooted = false; L.victim.script = null; L.victim.scriptW = 0; if (L.given) { L.victim.looted = true; L.victim.dead = 1.3; } else L.victim.dead = Math.min(L.victim.dead, LOOT_WINDOW - 4); }
  if (L.chest) { L.chest.forced = false; L.chest.held = null; }
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
  if (id === 'vest') {
    player.vest = VEST; notify('Found a bulletproof vest'); Sound.play('vest', 0.9);
    if (L.chest) { L.chest.t = 0; L.chest.forced = false; }
    hudDirty = true; return;
  }
  give(player, id, L.kind === 'body' ? GUNS[id].mag * 2 : undefined);
  let what = had ? GUNS[id].name + ' ammo' : GUNS[id].article + ' ' + GUNS[id].name;
  if (L.kind === 'body' && player.c4 < C4_MAX) { giveC4(player); what += ' and a C4'; }   // bodies always have a bomb on them
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
    if (!target) {
      if (pressed && player.dead < 0) { const o = gunNear(player.pos), b = !o && bikeNear(player.pos); if (o) pickUp(o); else if (b) startRide(b); }
      return false;
    }
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
  if (L.victim) { L.victim.script = null; L.victim.scriptW = 0; }   // the body stays a ragdoll: he gets poked and bounced on for real
  if (!L.given && t >= L.def.hold) grant(L);
  weaponStep(f, dt);
  if (t >= L.def.end) {
    const id = L.gun;
    endLoot();
    if (id === 'vest' || f.weapon === id) f.equip = 0; else equip(f, id);
  }
  return true;
}
function hudLoot(dt) {
  const target = looting ? null : lootTarget();
  const L = looting && !looting.given && looting.cancel < 0 ? looting : null;
  const lying = !target && !looting && player.dead < 0 && !player.ride ? gunNear(player.pos) : null;
  const bike = !target && !looting && !lying && player.dead < 0 && !player.ride ? bikeNear(player.pos) : null;
  const show = (target || L || lying || bike) && player.dead < 0;
  ui.prompt.style.display = show ? 'flex' : 'none';
  ui.prompt.classList.toggle('holding', !!L);
  if (lying) { ui.prompttext.textContent = 'Press E to pick up ' + (lying.kind === 'c4' ? 'the C4' : 'the ' + GUNS[lying.gun].name); ui.ring.style.setProperty('--p', '100%'); }
  else if (bike) { ui.prompttext.textContent = 'Press E to ride the tiny bike'; ui.ring.style.setProperty('--p', '100%'); }
  else if (show) {
    const kind = L ? L.kind : target.kind, def = kind === 'body' ? BODY : CHEST;
    const gun = kind === 'chest' ? ' (' + itemName((L || target).chest.gun) + ')' : '';
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
