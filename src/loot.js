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
// The body is a ragdoll the whole time. He pokes the belly (it wobbles), lifts an arm and lets go (it flops: dead),
// hops on and sits on him like a bench, and bounces: junk pops out of the poor guy's mouth with every bounce, and on the
// big one the gun shoots out and he catches it. Then he looks down the barrel at his own face, and bites it.
const BODY = { hold: 3.7, end: 6.5, label: 'loot this caveman' };
const BD = { poke: 0.6, arm: 1.15, drop: 1.55, hop: 1.78, sat: 2.12, bounces: [2.45, 2.85, 3.25], big: 3.55, catch: 4.1, off: 4.55, look: 4.75, bite: 5.4, huh: 5.95 };
function bodyStep(L) {
  const t = L.t, v = L.victim, hips0 = restAt('hips'), rag = v.rag;
  const toLocal = w => M3.vec(M3.ry(-L.face), V.sub(w, L.spot));
  const belly = bellyTop(v), bl = toLocal(belly);
  const S = { arms: {}, legs: {} };
  for (const [s, x] of [['R', -1], ['L', 1]]) S.arms[s] = idleArm(x);
  // sitting on him: turned round, bum on his belly, feet on the ground in front
  const seatH = Math.max(0.3, bl[1] + 0.08);
  const sitP = localToWorld(L, [0, 0, 0.2]), sitR = M3.ry(L.face + Math.PI);
  const sitHips = [0, seatH, -0.42];
  let root = null;
  if (rag) rag.pin = null;

  if (t < BD.arm) {                                               // poke, poke, poke
    const w = smooth(0.5, 0.65, t) * (1 - smooth(1.05, BD.arm, t));
    const tap = t > BD.poke && t < BD.poke + 0.45 ? Math.max(0, Math.sin((t - BD.poke) / 0.15 * Math.PI)) : 0;
    S.bend = 1.1 * w; S.hips = V.add(hips0, [0, -0.25 * w, -0.12 * w]); S.head = M3.rx(0.25 * w);
    const finger = hand(V.add(bl, [-0.02, 0.03 + 0.12 * (1 - tap), -0.04]), [0, -0.9, 0.4], [0, 0.4, 0.9], [-1, -0.3, -0.4], 0.15);
    S.arms.R = Object.assign(finger, { wrist: V.lerp(S.arms.R.wrist, finger.wrist, w) });
  } else if (t < BD.hop) {                                        // lift his arm... let go. flop. dead.
    if (L.vh === undefined && rag) {                              // whichever of his hands is nearer
      const a = rag.p[RP.hand_L], b = rag.p[RP.hand_R];
      L.vh = V.len(V.sub(a, L.spot)) < V.len(V.sub(b, L.spot)) ? RP.hand_L : RP.hand_R;
    }
    const reach = smooth(BD.arm, BD.arm + 0.15, t), lift = smooth(BD.arm + 0.12, 1.45, t), letGo = t >= BD.drop;
    const from = rag ? toLocal(rag.p[L.vh]) : [0, 0.1, 0.5];
    const hold = V.lerp(from, V.add(bl, [-0.05, 0.62, -0.12]), lift);       // as high as a floppy arm goes without lifting him
    const w = reach * (1 - smooth(BD.drop + 0.05, BD.hop, t));
    S.bend = 0.8 * w * (1 - lift) + 0.1; S.hips = V.add(hips0, [0, -0.15 * w * (1 - lift), 0]);
    S.head = M3.mul(M3.rx(0.3 - 0.4 * lift), M3.rz(letGo ? 0.35 : 0));
    const grab = hand(letGo ? V.add(bl, [-0.08, 0.75, -0.15]) : hold, [0, 0.3, 1], [1, 0, 0], [-1, -0.4, -0.3], letGo ? 0.1 : 1.2);
    S.arms.R = Object.assign(grab, { wrist: V.lerp(S.arms.R.wrist, grab.wrist, w) });
    if (!letGo && reach > 0.9 && rag) { rag.pin = { pt: L.vh, to: localToWorld(L, hold), k: 0.5 }; rag.sleep = false; }
  }
  // hops up and sits on him, turning round in the air
  if (t >= BD.hop) {
    const w = smooth(BD.hop, BD.sat, t), off = smooth(BD.catch + 0.05, BD.off, t);
    const sit = w * (1 - off), arc = Math.sin(Math.PI * w) * (1 - off) + Math.sin(Math.PI * off);
    let bounce = 0;
    for (const [k, b] of BD.bounces.concat([BD.big]).entries()) { const a = b - (k === 3 ? 0.32 : 0.28); if (t >= a && t < b) bounce = Math.sin(Math.PI * (t - a) / (b - a)) * (k === 3 ? 0.42 : 0.24); }
    const yaw = L.face + Math.PI * (t < BD.catch ? w : 1 - off);
    root = { R: M3.ry(yaw), p: V.add(V.lerp(L.spot, sitP, sit), [0, 0.3 * arc, 0]) };
    S.hips = V.add(V.lerp(hips0, sitHips, sit), [0, bounce, 0]);
    S.bend = 0.25 * sit - 0.15 * (bounce > 0.05 ? 1 : 0);
    const riding = sit * smooth(BD.sat, BD.sat + 0.15, t);
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      S.legs[s] = { ankle: V.lerp(restAt('foot_' + s), [x * 0.22, 0.07 + 0.25 * bounce, 0.12], sit), pole: [x * 0.3, 0.3, 1] };
      // hands up like a cowboy while he bounces; both up high for the catch
      const ride = hand([x * (0.38 + 0.06 * Math.sin(t * 20 + x)), seatH + 1.05 + 0.6 * bounce, -0.25], [x * 0.3, 1, 0], [0, 0, 1], [x, -0.2, -0.4], 1.2);
      const catchUp = hand([x * 0.15, seatH + 1.35, -0.3], [x * 0.2, 1, 0], [-x, 0, 0], [x, -0.2, -0.4], 0.8);
      const up = smooth(BD.big - 0.1, BD.big + 0.1, t);
      const goal = mixGoal(ride, catchUp, up);
      S.arms[s] = mixGoal(S.arms[s], goal, riding * (1 - off));
    }
    S.head = M3.rx(-0.2 * bounce - 0.5 * smooth(BD.big, BD.catch, t) * (1 - off));
  }
  // the gun: caught overhead, brought down as he hops off, then the inspection
  if (t >= BD.catch) {
    const id = L.gun, inspect = smooth(BD.look - 0.1, BD.look + 0.2, t), bite = smooth(BD.bite, BD.bite + 0.2, t), done = smooth(BD.huh, BD.huh + 0.3, t);
    const off = smooth(BD.catch + 0.05, BD.off, t);
    const over = [-0.2 * GUNS[id].scale, seatH + 1.3, -0.3], chest = [-0.22, 0.95, 0.35];
    const barrel = [0.05, 1.48, 0.38 + 0.25 * GUNS[id].scale];     // pointing at his own face
    const mouth = [-0.2 * GUNS[id].scale - (id === 'glock' ? 0 : 0.05), 1.36, 0.3];
    const chew = t > BD.bite + 0.2 && t < BD.huh ? 0.05 * Math.max(0, Math.sin((t - BD.bite) * 18)) : 0;
    let gp = V.lerp(over, chest, off), R = M3.mul(M3.ry(0.25), M3.rx(0.15));
    if (t >= BD.look) { gp = V.lerp(V.lerp(chest, barrel, inspect), V.add(mouth, [0, 0, 0.04 - chew]), bite); R = M3.mix(M3.mix(R, M3.ry(Math.PI), inspect), M3.mul(M3.ry(Math.PI / 2), M3.rz(0.1)), bite); }
    gp = V.lerp(gp, [-0.32, 0.86, 0.22], done);
    R = M3.mix(R, M3.mul(M3.ry(0.25), M3.rx(0.15)), done);
    const H = gunHands(id, { p: gp, R });
    S.gun = { id, p: gp, R };
    S.arms.R = H.R;
    S.arms.L = t < BD.off ? H.L : t < BD.huh ? mixGoal(H.L, idleArm(1), smooth(BD.off, BD.look, t)) : (() => { const s2 = scratchArm(1, t), w = smooth(BD.huh, BD.huh + 0.25, t) * (1 - smooth(6.3, 6.5, t)); return Object.assign(s2, { wrist: V.lerp(idleArm(1).wrist, s2.wrist, w) }); })();
    if (t >= BD.look) S.head = M3.mul(M3.rx(-0.1 + chew * 3 - 0.15 * inspect * (1 - bite)), M3.rz(t >= BD.huh ? -0.3 * done : 0));
  }
  if (root) S.root = root;
  L.f.script = S;

  // the poor guy: poked, dropped, bounced on
  const word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  const headPt = () => rag ? rag.p[RP.head] : V.add(belly, [0, 0, 0]);
  for (let k = 0; k < 3; k++) cue(L, BD.poke + 0.075 + k * 0.15, () => { Sound.play('pop', 0.6); if (rag) ragPush(v, belly, [0, -1.6, 0], 0.35); if (k === 0) word([0, 1.5, 0.3], 'poke?', 0.6); });
  cue(L, BD.drop, () => Sound.play('whoosh', 0.5));
  cue(L, BD.drop + 0.18, () => { Sound.play('thud', 0.7); word([0, 1.55, 0.3], '...DEAD.', 0.8); });
  cue(L, BD.hop, () => Sound.play('hup', 0.8));
  cue(L, BD.sat, () => { Sound.play('thud', 0.9); if (rag) ragPush(v, belly, [0, -2.5, 0], 0.5); });
  ['rock', 'fish', 'bone'].forEach((kind, k) => cue(L, BD.bounces[k], () => {
    Sound.play('boing', 0.8); Sound.play('thud', 0.6);
    if (rag) { ragPush(v, belly, [0, -3.8, 0], 0.5); ragPush(v, headPt(), [0, 2.6, 0], 0.3); }
    const h = headPt(); spawnProp(kind, V.add(h, [0, 0.12, 0]), [rand(-1.2, 1.2), rand(4, 5.5), rand(-1.2, 1.2)]);
    word([0.3 * (k % 2 ? 1 : -1), 1.9, 0.2], ['BOING', 'BLEH', 'HURK'][k], 0.5);
  }));
  cue(L, BD.big, () => {                                          // the big one: out comes the gun
    Sound.play('boing', 1); Sound.play('pop', 1); cam.shake = Math.max(cam.shake, 0.5);
    if (rag) { ragPush(v, belly, [0, -5, 0], 0.5); ragPush(v, headPt(), [0, 3.5, 0], 0.35); }
    const h = V.add(headPt(), [0, 0.15, 0]), catchAt = V.add(sitP, M3.vec(sitR, [-0.2 * GUNS[L.gun].scale, seatH + 1.3, -0.3]));
    L.drop = spawnProp('gun', h, lob(h, catchAt, BD.catch - BD.big), { gun: L.gun, life: BD.catch - BD.big + 0.02, spin: 12 });
    word([0, 2.1, 0.2], 'PTOOO!', 0.6);
  });
  cue(L, BD.catch, () => { if (L.drop) L.drop.life = 0; Sound.play('rack', 0.7); word([0, 2.2, 0.2], 'HA!', 0.5); });
  cue(L, BD.off, () => Sound.play('land', 0.7));
  cue(L, BD.look + 0.1, () => { Sound.play('ooo', 0.8, 0); word([0.1, 1.95, 0.3], 'ooo', 0.6); });
  for (const at of [BD.bite + 0.25, BD.bite + 0.5]) cue(L, at, () => { Sound.play('chomp', 0.9); word([at < BD.bite + 0.4 ? -0.4 : 0.35, 1.75, 0.3], 'CHOMP', 0.5); });
  cue(L, BD.huh + 0.1, () => { Sound.play('huh', 1); word([0, 2.2, 0], '???', 0.85); });
}

// ---------------------------------------------------------------- open a chest the caveman way
// He knocks, politely. Puts his ear to it: hello? Nobody answers, so he climbs on top and stomps on the lid until it
// bursts open and throws him off onto his bum. Junk everywhere; the prize sails out and lands on his head.
const CHEST = { hold: 4.5, end: 6.5, label: 'open the chest' };
const CH = { knock: 0.6, listen: 1.25, climb: 1.75, onTop: 2.15, stomps: [2.45, 2.8, 3.15], land: 3.75, bonk: 4.22, up: 4.32, stand: 4.75 };
function chestStep(L) {
  const t = L.t, c = L.chest, hips0 = restAt('hips');
  const S = { arms: {}, legs: {}, hips: hips0, bend: 0 };
  for (const [s, x] of [['R', -1], ['L', 1]]) S.arms[s] = idleArm(x);
  const TOP = 0.58, MID = 0.8, FRONT = 0.5;                       // the lid's height, the chest's middle and front, in his space
  const at = (q, R) => ({ R: M3.mul(M3.ry(L.face), R || M3.id()), p: localToWorld(L, q) });
  let root = null;

  if (t < CH.listen) {                                            // knock knock
    const w = smooth(0.5, 0.65, t) * (1 - smooth(1.15, 1.25, t));
    const tap = t > CH.knock && t < 1.1 ? Math.max(0, Math.sin((t - CH.knock) / 0.15 * Math.PI)) : 0;
    const fist = hand([-0.08, 0.5, FRONT - 0.06 - 0.07 * tap], [0, 0.2, 1], [0, 0, 1], [-1, -0.3, -0.4], 1.5);
    S.arms.R = Object.assign(fist, { wrist: V.lerp(S.arms.R.wrist, fist.wrist, w) });
    S.bend = 0.35 * w; S.hips = V.add(hips0, [0, -0.06 * w, 0]); S.head = M3.rx(0.1 * w);
  } else if (t < CH.climb) {                                      // ear to the lid. hello? hello??
    const w = smooth(CH.listen, 1.45, t) * (1 - smooth(1.62, CH.climb, t));
    S.bend = 1.05 * w; S.hips = V.add(hips0, [0, -0.2 * w, -0.12 * w]); S.twist = 0.25 * w;
    S.head = M3.mul(M3.rz(-0.85 * w), M3.rx(0.25 * w));
    const cup = hand([0.12, 1.08 - 0.2 * w, 0.32], [-0.3, 0.6, 0.6], [-1, 0, 0], [1, -0.3, -0.5], 0.8);
    S.arms.L = Object.assign(cup, { wrist: V.lerp(S.arms.L.wrist, cup.wrist, w) });
  } else if (t < CH.onTop) {                                      // climbs up, knee first
    const w = smooth(CH.climb, CH.onTop, t), arc = Math.sin(Math.PI * w);
    root = at([0, TOP * smooth(0.15, 0.85, w) + 0.25 * arc, MID * smooth(0.05, 0.9, w)]);
    S.bend = 0.6 * arc; S.hips = V.add(hips0, [0, -0.15 * arc, 0]);
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      S.legs[s] = { ankle: V.add(restAt('foot_' + s), [0, (s === 'L' ? 0.35 : 0.12) * arc, (s === 'L' ? 0.25 : -0.1) * arc]), pole: [x * 0.3, 0, 1] };
      S.arms[s] = hand([x * 0.3, 0.75 + 0.2 * arc, 0.4], [x * 0.2, -0.6, 0.8], [0, -1, 0], [x, -0.3, -0.6], 0.5);
    }
  } else if (t < CH.stomps[2] + 0.02) {                           // stomp. stomp. STOMP.
    let hop = 0;
    for (let k = 0; k < 3; k++) { const a = CH.stomps[k] - 0.3, b = CH.stomps[k]; if (t >= a && t < b) hop = Math.sin(Math.PI * (t - a) / (b - a)) * (k === 2 ? 0.45 : 0.3); }
    const squash = CH.stomps.some(b => t >= b - 0.02 && t < b + 0.12) ? 1 : 0;
    root = at([0, TOP + hop, MID]);
    S.hips = V.add(hips0, [0, -0.14 * squash + 0.04 * hop, 0]); S.bend = 0.2 * squash - 0.1 * hop;
    S.head = M3.rx(-0.25 * hop);
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const lift = (s === 'L' ? 1 : 0.6) * hop;
      S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.04, 0.5 * lift, 0.08 * lift]), pole: [x * 0.5, 0, 1] };
      S.arms[s] = hand([x * (0.42 + 0.1 * hop), 1.55 + 0.4 * hop + 0.05 * Math.sin(t * 30 + x), 0.05], [x * 0.3, 1, 0], [0, 0, 1], [x, -0.2, -0.5], 1.4);
    }
  } else if (t < CH.land) {                                       // the lid bursts open and throws him off, backwards
    const w = (t - CH.stomps[2]) / (CH.land - CH.stomps[2]), arc = Math.sin(Math.PI * w);
    const H = [0, (TOP + hips0[1]) * (1 - w) + 0.24 * w + 1.05 * arc, MID * (1 - smooth(0, 1, w)) + 0.12 * smooth(0, 1, w)];
    const spin = M3.rx(-1.15 * Math.sin(Math.PI * 0.5 * Math.min(1, w * 1.2)) * (1 - smooth(0.75, 1, w)) - 0.25 * smooth(0.75, 1, w));
    root = { R: M3.mul(M3.ry(L.face), spin), p: localToWorld(L, V.sub(H, M3.vec(spin, hips0))) };
    S.bend = -0.3 * arc;
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.15 * arc, 0.42 * arc, 0.45 * arc]), pole: [x * 0.3, 0.6, 1] };
      S.arms[s] = hand([x * (0.6 + 0.08 * Math.sin(t * 40 + x)), 1.6 + 0.1 * Math.cos(t * 33 + x), 0.0], [x * 0.4, 1, 0], [0, 0, 1], [x, -0.2, -0.5], 0.2);
    }
  }
  // on his bum, seeing stars, until the prize comes down on his head; then he gets up with it
  const sitting = t >= CH.land - 0.02 && t < CH.stand;
  if (sitting) {
    const getUp = smooth(CH.up, CH.stand, t);
    const H = V.lerp([0, 0.2, 0.08], hips0, getUp), dazed = 1 - getUp;
    S.hips = V.sub(H, [0, 0, 0]); S.bend = -0.25 * dazed + 0.3 * Math.sin(Math.PI * getUp);
    S.head = M3.mul(M3.rz(Math.sin(t * 9) * 0.3 * dazed), M3.rx(Math.cos(t * 9) * 0.15 * dazed));
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      S.legs[s] = { ankle: V.lerp([x * 0.2, 0.07, 0.62], restAt('foot_' + s), getUp), pole: [x * 0.3, 1, 0.4] };
      S.arms[s] = hand(V.lerp([x * 0.32, 0.1, -0.28], [x * 0.22, 0.85, 0.3], smooth(CH.bonk, CH.stand, t)), [x * 0.2, -1, -0.3], [0, -1, 0], [x, 0, -0.4], 0.4);
    }
    root = at([0, 0, 0]);
  }
  if (root) S.root = root;

  // the prize, flying out of the chest onto his head, then into his hands
  if (t >= CH.land && t < CH.stand) {
    const fly = smooth(CH.land, CH.bonk, t), head = [0, 1.12 + 0.04 * Math.max(0, Math.sin((t - CH.bonk) * 30)) * (t > CH.bonk ? 1 : 0), 0.05];
    const from = [0, TOP, MID], pos = t < CH.bonk ? V.add(V.lerp(from, head, fly), [0, 1.0 * Math.sin(Math.PI * fly), 0]) : V.lerp(head, [-0.2, 0.8, 0.35], smooth(CH.up, CH.stand, t));
    const R = M3.mul(M3.ry(Math.PI / 2), M3.rx(t < CH.bonk ? fly * 9 : 0));
    if (L.gun === 'vest') S.vest = { p: pos, R: M3.rx(t < CH.bonk ? fly * 7 : -0.12) }; else S.gun = { id: L.gun, p: pos, R };
  }

  // and hold the prize up for everyone to see
  if (t >= 4.75 && L.gun === 'vest') {
    const take = smooth(4.75, 5.0, t), w = smooth(4.85, 5.2, t), hop = t > 5.15 && t < 6.15 ? Math.abs(Math.sin((t - 5.15) * Math.PI * 2)) : 0;
    const gp = V.lerp([0, 0.8, 0.4], [0, 1.9 + hop * 0.04, 0.14], w);
    S.vest = { p: gp, R: M3.mul(M3.rz(Math.sin(t * 9) * 0.06), M3.rx(-0.12)) };
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const goal = hand([x * 0.205, gp[1] - 0.04, gp[2]], [-x * 0.1, 1, 0.1], [-x, 0, 0], [x, -0.3, -0.3], 1.1);
      S.arms[s] = Object.assign(goal, { wrist: V.lerp(S.arms[s].wrist, goal.wrist, take) });
    }
    S.bend = S.bend * (1 - w) - 0.2 * w; S.head = M3.rx(-0.3 * w); S.hips = V.lerp(S.hips, hips0, take);
    S.root = { R: M3.ry(L.face), p: V.add(L.spot, [0, hop * 0.14, 0]) };
    for (const s of ['R', 'L']) S.legs[s] = { ankle: V.add(restAt('foot_' + s), [0, hop * 0.07, 0]) };
  } else if (t >= 4.75) {
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

  const lid = V.add(c.pos, [0, 0.62, 0.15]), word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  for (let k = 0; k < 3; k++) cue(L, CH.knock + 0.075 + k * 0.15, () => { Sound.play('knock', 0.9); c.wobble = Math.max(c.wobble, 0.15); if (k === 0) word([0, 1.6, 0.4], 'knock knock?', 0.7); });
  cue(L, CH.listen + 0.25, () => { Sound.play('huh', 0.8); word([0.2, 1.4, 0.3], 'hello??', 0.8); });
  cue(L, CH.climb + 0.05, () => Sound.play('hup', 0.8));
  CH.stomps.forEach((at, k) => cue(L, at, () => {
    Sound.play('thud', 1); Sound.play('bonk', 0.5); c.wobble = 1; cam.shake = Math.max(cam.shake, 0.5 + 0.25 * k);
    puff(lid, 6, [0.6, 0.45, 0.25, 0.8], 1.0, 0.04, 0.4, 4);
    word([0.4 * (k % 2 ? 1 : -1), 1.25, 0.8], ['STOMP', 'STOMP!', 'STOMP!!'][k], 0.5);
  }));
  cue(L, CH.stomps[2] + 0.01, () => {                              // KA-BOING: the lid gives
    c.forced = true; c.openV += 14; Sound.play('boing', 1); Sound.play('whoosh', 1); cam.shake = 1;
    word([0, 1.9, 0.8], 'BOING!', 0.8); puff(lid, 14, [0.6, 0.45, 0.25, 0.8], 1.8, 0.05, 0.5, 4);
    ['rock', 'bone', 'fish', 'meat', 'rock'].forEach((kind, k) => {
      const from = V.add(c.pos, [rand(-0.2, 0.2), 0.55, 0]), land = V.add(c.pos, [(k % 2 ? 1 : -1) * rand(0.8, 1.8), 0.07, rand(-0.3, 1.8)]);
      spawnProp(kind, from, lob(from, land, rand(0.7, 1.0)));
    });
  });
  cue(L, CH.land, () => { Sound.play('thud', 1); Sound.play('ugh', 0.7); puff(L.spot.slice(), 12, [0.5, 0.47, 0.42, 0.7], 1.1, 0.06, 0.5, 1.5); });
  cue(L, CH.bonk, () => { Sound.play('bonk', 1); word([0.3, 1.6, 0.1], 'BONK!', 0.6); });
  cue(L, CH.stand + 0.1, () => { Sound.play('tada', 0.9); Sound.play('ooga', 0.9); word([0, 2.05, -0.8], 'OOGA!!', 1.1); });

  // stars while he sits there dazed
  const see = smooth(CH.land, CH.land + 0.1, t) * (1 - smooth(CH.up, CH.up + 0.15, t));
  if (see > 0) stars.push({ f: L.f, w: see });
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
