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

// ---------------------------------------------------------------- dropping what you hold (G), picking it back up (E)
function dropGun(f) {
  if (f.dead >= 0 || looting) return;
  if (f.holdC4) {                                          // drop one C4 (not armed)
    if (f.plantT >= 0 || !f.c4) return;
    const fwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)], R = M3.ry(f.yaw);
    spawnProp('c4', V.add(f.pos, M3.vec(R, C4_HOLD)), [fwd[0] * 2.2, 2.2, fwd[2] * 2.2], { R, scale: 1, life: 120, keep: true, w: [rand(-4, 4), rand(-2, 2), rand(-4, 4)] });
    f.c4--; syncC4(f);
    Sound.play('whoosh', 0.5); return;
  }
  if (f.hand) {                                            // food or plates: the whole bunch
    const k = findSlot(f, f.hand);
    if (k >= 0) dropSlot(f, k);
    f.hand = null; f.use = null; Sound.play('whoosh', 0.5); return;
  }
  if (!f.weapon) return;
  const id = f.weapon, am = f.ammo[id], fwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)];
  const from = f.gun ? f.gun.p.slice() : V.add(f.pos, [fwd[0] * 0.4, 1.2, fwd[2] * 0.4]);
  const R = f.gun ? f.gun.R.slice() : M3.ry(f.yaw);
  const v = [fwd[0] * 2.6 + (f.vel ? f.vel[0] : 0), 2.4, fwd[2] * 2.6 + (f.vel ? f.vel[1] : 0)];
  const w = V.add(V.mul([Math.cos(f.yaw), 0, -Math.sin(f.yaw)], rand(3, 6)), [0, rand(-3, 3), 0]);
  spawnProp('gun', from, v, { gun: id, R, w, life: 120, keep: true, ammo: { clip: am.clip, spare: am.spare, rarity: am.rarity } });
  emptySlot(f, findSlot(f, 'gun', id));
  f.gun = null; f.equip = 1;
  Sound.play('whoosh', 0.5);
}
// would it go in without anything having to come out
function fits(f, it) {
  if (it.t === 'vest' || it.t === 'ammo' || f.slots.indexOf(null) >= 0) return true;
  if (it.t === 'gun') return findSlot(f, 'gun', it.id) >= 0;
  if (it.t === 'c4') return findSlot(f, 'c4') >= 0 && f.c4 < C4_MAX;
  return f.slots.some(q => q && q.t === it.t && q.n < STACK);
}
// the nearest thing to pick up: a gun or bomb you threw down, or something lying about
function thingNear(p) {
  let best = null, bestD = 1.4;
  for (const o of props) {
    if (!(o.kind === 'gun' && o.ammo) && !(o.kind === 'c4' && player.c4 < C4_MAX)) continue;
    if (Math.abs(o.p[1] - p[1]) > 1.6) continue;               // not through a cave roof
    const d = Math.hypot(o.p[0] - p[0], o.p[2] - p[2]);
    if (d < bestD) { bestD = d; best = { prop: o, p: o.p }; }
  }
  const l = lootNear(p, bestD);
  return l ? { loot: l, item: l.item, p: l.p } : best;
}
function pickUp(o) {
  const f = player;
  const it = o.item || (o.prop.kind === 'c4' ? { t: 'c4' } : gunItem(o.prop.gun, o.prop.ammo.rarity, o.prop.ammo.clip, o.prop.ammo.spare));
  const list = o.loot ? floorLoot : props, at = list.indexOf(o.loot || o.prop);
  if (at < 0) return;
  list.splice(at, 1);
  if (!takeItem(f, it, true)) { list.push(o.loot || o.prop); Sound.play('nope', 0.7); return; }
  pickFlyers.push({ item: it, from: V.add(o.p, [0, 0.3, 0]), t0: game.time, a: o.loot ? o.loot.a + game.time * 0.9 : rand(0, 6.3) });
  Sound.play(it.t === 'gun' ? 'rarity' : it.t === 'vest' ? 'vest' : 'grab', 0.8, it.rarity);
  // a gun off the floor: he leans over it, pokes it, grabs it and brings it up. one already in his hands goes to his back first
  if (it.t === 'gun' && (f.weapon !== it.id) && !f.hand && !f.holdC4) {
    const st = { id: it.id, floorP: o.p.slice(), a: o.loot ? o.loot.a + game.time * 0.9 : rand(0, 6.3) };
    if (f.weapon) { equip(f, null); f.pickNext = st; } else if (!f.hol) f.hol = pickHol(f, st); else f.pickNext = st;
  } else pickFlyers.push({ item: it, from: V.add(o.p, [0, 0.3, 0]), t0: game.time, a: o.loot ? o.loot.a + game.time * 0.9 : rand(0, 6.3) });
  hudDirty = true;
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
  return;                                                      // the pop-up words are switched off
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
// an arm's three bone rotations from any kind of goal: by joints (fk), by where the hand goes (wrist), or a blend of two
// (blend: { a, b, w }), mixed bone by bone so switching between them is smooth
function armRots(a, shoulder, chestR, arm) {
  if (arm.blend) {
    const A = armRots(a, shoulder, chestR, arm.blend.a), B = armRots(a, shoulder, chestR, arm.blend.b), w = arm.blend.w;
    return w <= 0.001 ? A : w >= 0.999 ? B : [M3.mix(A[0], B[0], w), M3.mix(A[1], B[1], w), M3.mix(A[2], B[2], w)];
  }
  return arm.fk ? fkArm(a, chestR, arm.fk) : solveArm(a, shoulder, arm);
}
// a blend of two arm goals; its finger curl is mixed too
const armBlend = (a, b, w) => ({ blend: { a, b, w: clamp(w, 0, 1) }, curl: [a.curl[0] + (b.curl[0] - a.curl[0]) * clamp(w, 0, 1), a.curl[1] + (b.curl[1] - a.curl[1]) * clamp(w, 0, 1)] });
// a relaxed arm, hanging by his side
const relaxed = (ab, sw, el) => ({ fk: { ab: ab === undefined ? 0.13 : ab, sw: sw === undefined ? 0.06 : sw, el: el === undefined ? 0.3 : el, tw: 0.1 }, curl: [0.45, 0.5] });
// a hand goal whose wrist mostly follows the forearm, so it never bends the wrong way
const reach = (at, dir, palm, pole, curl, keep) => Object.assign(hand(at, dir, palm, pole, curl), { natural: keep === undefined ? 0.45 : keep });
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
        if (i === a.up) { ik[s] = armRots(a, wp[i], wr[IDX.chest], arm); wr[i] = ik[s][0]; }
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
// He kneels by the body (a ragdoll the whole time) and pats him down. He finds the gun and pulls it out by the barrel,
// because what else would you hold it by. A test swing, like a club. Hmm. He flips it round, and now it looks right.
const BODY = { hold: 3.0, end: 4.3, label: 'loot this caveman' };
const BD = { kneel: 0.3, down: 0.75, pat: 0.85, patEnd: 1.55, grab: 1.72, stood: 2.15, swing: 2.25, swingEnd: 2.78, puzzle: 2.98, toss: 3.12, caught: 3.42, ready: 3.85 };
const SHOULDER_R = [-0.22, 1.42, -0.02];
function bodyStep(L) {
  const t = L.t, v = L.victim, hips0 = restAt('hips'), rag = v.rag;
  const toLocal = w => M3.vec(M3.ry(-L.face), V.sub(w, L.spot));
  const pt = n => rag ? toLocal(rag.p[RP[n]]) : toLocal(bonePos(v, n));
  const belly = toLocal(bellyTop(v)), chestP = V.add(pt('chest'), [0, 0.1, 0]), hipP = pt('hips');
  const kneel = flow([[BD.kneel, 0], [BD.down, 1], [BD.grab, 1], [BD.stood, 0]], t);
  const S = {
    hips: V.add(hips0, [0.02 * kneel, -0.33 * kneel, -0.06 * kneel]),
    bend: flow([[BD.kneel, 0], [BD.down, 0.6], [BD.patEnd, 0.7], [BD.grab, 0.65], [BD.stood, 0.05], [BD.swing, 0], [2.45, -0.15], [2.62, 0.35], [BD.swingEnd, 0.05], [BD.puzzle, 0.1], [BD.ready, 0]], t),
    twist: flow([[BD.down, 0], [BD.patEnd, 0], [BD.grab, -0.15], [BD.stood, 0], [2.45, -0.3], [2.62, 0.25], [BD.swingEnd, 0], [BD.ready, 0]], t),
    head: M3.mul(M3.rx(flow([[BD.kneel, 0], [BD.down, 0.35], [BD.patEnd, 0.45], [BD.grab, 0.35], [BD.stood, 0], [BD.swingEnd, 0], [BD.puzzle, 0.15], [BD.toss, -0.25], [BD.caught, 0], [BD.ready, 0]], t)),
      M3.rz(flow([[BD.swingEnd, 0], [BD.puzzle, 0.35], [BD.toss, 0.3], [BD.caught, 0], [BD.ready, 0]], t))),
    arms: {}, legs: {
      R: { ankle: V.lerp(restAt('foot_R'), [-0.16, 0.07, -0.3], kneel), pole: [-0.2, -0.5, 1], footR: M3.rx(1.1 * kneel) },   // knee on the ground
      L: { ankle: V.lerp(restAt('foot_L'), [0.18, 0.08, 0.32], kneel), pole: [0.3, 0.3, 1] }                                 // foot planted in front
    }
  };
  const idle = relaxed(), patY = k => 0.09 * Math.max(0, Math.cos((t - BD.pat) / 0.17 * Math.PI + k * Math.PI));
  const into = smooth(BD.kneel + 0.1, BD.down, t);
  // patting him down, the hands taking turns
  const patR = reach(V.add(belly, [-0.04, 0.02 + patY(0), 0]), [0, -0.6, 0.8], [0, -0.8, -0.6], [-1, -0.6, -0.2], 0.3);
  const patL = reach(V.add(chestP, [0.05, 0.02 + patY(1), 0]), [0, -0.6, 0.8], [0, -0.8, -0.6], [1, -0.6, -0.2], 0.3);
  S.arms.L = t < BD.grab ? armBlend(idle, patL, into) : armBlend(patL, relaxed(0.15, 0.1, 0.35), smooth(BD.grab - 0.15, BD.grab + 0.2, t));
  // the gun
  const id = L.gun, g = GUNS[id], mz = g.muzzle[2] * g.scale * 0.8;
  const clubR = hp => { const c = V.norm(V.sub(hp, SHOULDER_R)); return { c, R: M3.frame([0, 0, 1], [0, 1, 0], V.mul(c, -1), Math.abs(c[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]) }; };
  const readyP = [-0.2, 1.02, 0.38], readyR = M3.mul(M3.ry(0.15), M3.rx(0.08));
  if (t < BD.pat + 0.6) S.arms.R = armBlend(idle, patR, into);
  else if (t < BD.grab) S.arms.R = armBlend(patR, reach(V.add(hipP, [-0.05, 0.08, 0]), [0, -0.7, 0.7], [0, -1, 0], [-1, -0.5, -0.3], 1.1), smooth(BD.patEnd, BD.grab, t));
  if (t >= BD.grab - 0.05) {
    // where his right hand is: up from the hip as he stands, the swing, up to his face, then the toss and catch
    const hp = flow([[BD.grab - 0.05, V.add(hipP, [-0.05, 0.08, 0])], [BD.stood, [-0.15, 1.0, 0.36]], [BD.swing, [-0.16, 1.05, 0.34]], [2.45, [-0.24, 1.78, -0.05]], [2.62, [-0.1, 0.86, 0.6]],
      [BD.swingEnd, [-0.14, 1.02, 0.42]], [BD.puzzle, [-0.1, 1.3, 0.42]], [BD.toss, [-0.12, 1.12, 0.4]]], t);
    let gp, R;
    if (t < BD.puzzle) { const k = clubR(hp); R = k.R; gp = V.mad(hp, k.c, mz); }
    else if (t < BD.toss) {                                         // turns it in his hand to look at it, ready to flip it
      const k = clubR(hp), w = smooth(BD.puzzle, BD.toss, t), flipR = M3.mul(readyR, M3.rx(Math.PI));
      R = M3.mix(k.R, flipR, w); gp = V.mad(hp, k.c, mz * (1 - w) + 0.12 * w);
    } else {                                                        // up it goes, round it turns, caught by the handle
      const w = smooth(BD.toss, BD.caught, t), from = V.mad(hp, clubR(hp).c, 0.12);
      gp = V.add(V.lerp(from, readyP, w), [0, 0.38 * Math.sin(Math.PI * w), 0]);
      R = M3.mul(readyR, M3.rx(Math.PI * (1 - w)));
    }
    S.gun = { id, p: gp, R };
    const H = gunHands(id, { p: gp, R });
    if (t < BD.toss) S.arms.R = armBlend(S.arms.R || idle, reach(hp, V.norm(V.sub(hp, SHOULDER_R)), [0, 0, 1], [-1, -0.5, -0.3], 1.25, 0.3), smooth(BD.grab - 0.05, BD.grab + 0.1, t));
    else if (t < BD.caught) S.arms.R = reach([-0.16, 1.05, 0.4], [0, 0.3, 1], [1, 0, 0], [-1, -0.5, -0.3], 0.3);     // open hand, waiting
    else S.arms.R = H.R;
    if (t >= BD.caught - 0.05 && id !== 'glock') S.arms.L = armBlend(S.arms.L, H.L, smooth(BD.caught - 0.05, BD.caught + 0.15, t));
  }
  if (rag) rag.pin = null;
  L.f.script = S;

  const word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  for (let k = 0; k < 4; k++) cue(L, BD.pat + 0.085 + k * 0.17, () => { Sound.play('thud', 0.25); if (rag) ragPush(v, localToWorld(L, k % 2 ? chestP : belly), [0, -0.8, 0], 0.3); });
  cue(L, BD.grab, () => Sound.play('magout', 0.6));
  cue(L, 2.5, () => { Sound.play('whoosh', 0.8); word([0, 2.0, 0.3], 'OOGA?', 0.6); });
  cue(L, BD.puzzle, () => { Sound.play('huh', 0.8); word([0, 1.9, 0.3], 'hmm', 0.5); });
  cue(L, BD.toss, () => Sound.play('whoosh', 0.5));
  cue(L, BD.caught, () => { Sound.play('rack', 0.7); Sound.play('hmph', 0.6); });
}

// ---------------------------------------------------------------- the first chest of a match, the caveman way
// He has never seen one. He thinks, headbutts it, headbutts it again until it flies open, dives in head first, throws
// all the junk out and holds up the prize. After that one he has learned how a chest works.
const CHEST_FIRST = { hold: 4.5, end: 6.5, label: 'open the chest' };
function chestFunny(L) {
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
  } else if (t >= 4.75 && !GUNS[L.gun]) {                       // food, ammo or a plate, held up like treasure
    const take = smooth(4.75, 5.0, t), w = smooth(4.85, 5.2, t), hop = t > 5.15 && t < 6.15 ? Math.abs(Math.sin((t - 5.15) * Math.PI * 2)) : 0;
    const gp = V.lerp([0, 0.8, 0.4], [0, 1.96 + hop * 0.04, 0.14], w);
    S.thing = { kind: L.gun, p: V.add(gp, [0, 0.03, 0]), R: M3.mul(M3.ry(L.gun === 'fish' || L.gun === 'meat' ? Math.PI / 2 : 0), M3.rz(Math.sin(t * 9) * 0.09)) };
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const goal = hand([x * 0.14, gp[1] - 0.03, gp[2]], [-x * 0.2, 1, 0.1], [-x, 0, 0], [x, -0.3, -0.3], 1.0);
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

  const lid = V.add(c.pos, [0, 0.62, 0.15]);
  cue(L, 0.55, () => { Sound.play('huh', 0.9); popWord(V.add(L.spot, [0, 2.15, 0]), '?', 0.6); });
  cue(L, 1.39, () => { Sound.play('bonk', 1); c.wobble = 1; popWord(V.add(lid, [0.45, 0.35, 0]), 'BONK!'); puff(lid, 6, [0.6, 0.45, 0.25, 0.8], 1.1, 0.04, 0.4, 4); cam.shake = 0.8; });
  cue(L, 2.32, () => {
    Sound.play('bonk', 1); Sound.play('boing', 0.9); c.wobble = 1; c.forced = true; c.openV += 9; cam.shake = 1;
    popWord(V.add(lid, [-0.4, 0.55, 0]), 'KLONK!'); puff(lid, 12, [0.6, 0.45, 0.25, 0.8], 1.6, 0.045, 0.5, 4);
  });
  cue(L, 2.34, () => Sound.play('chestopen', 0.9));
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

// ---------------------------------------------------------------- every chest after that: he has learned
// No tugging at the lock, no thinking. He lifts the lid, has a look inside, takes the prize out and has a look at it.
const CS = { lock: 0.3, tug: 0.75, tugEnd: 1.35, scratch: 1.45, scratchEnd: 1.95, grip: 2.25, lift: 2.62, peek: 2.8, inside: 3.12, out: 3.45, up: 3.75 };
const CS_SKIP = CS.scratchEnd - CS.lock;                      // the tugging and head scratching he now leaves out
const CHEST = { hold: 3.45 - CS_SKIP, end: 4.5 - CS_SKIP, label: 'open the chest' };
function chestStep(L) {
  const t = L.t, c = L.chest, hips0 = restAt('hips');
  const toLocal = w => M3.vec(M3.ry(-L.face), V.sub(w, L.spot));
  const lidEdge = (x, open) => toLocal(V.add(V.add(c.pos, [0, 0.44, -0.30]), M3.vec(M3.rx(-1.9 * open), [x, 0.07, 0.6])));
  const lock = toLocal(V.add(c.pos, [0, 0.33, 0.31]));
  const open = flow([[CS.grip, 0], [CS.lift, 0.55]], t);
  if (t >= CS.grip && t < CS.lift) c.held = open;
  else if (t >= CS.lift && c.held !== null && c.held !== undefined) { c.held = null; c.forced = true; c.openV = 4; }
  const tugs = t > CS.tug && t < CS.tugEnd ? Math.max(0, Math.sin((t - CS.tug) / 0.2 * Math.PI)) : 0;
  const crouch = flow([[CS.lock, 0], [CS.tug, 0.45], [CS.tugEnd, 0.45], [CS.scratch, 0], [CS.scratchEnd, 0], [CS.grip, 1], [CS.lift, 0.6], [CS.inside, 0.8], [CS.out, 0.6], [CS.up, 0], [CHEST.end, 0]], t);
  const S = {
    hips: V.add(hips0, [0, -0.36 * crouch, -0.12 * crouch - 0.06 * tugs]),
    bend: flow([[CS.lock, 0], [CS.tug, 0.55], [CS.tugEnd, 0.5], [CS.scratch, 0], [CS.scratchEnd, 0], [CS.grip, 0.55], [CS.lift, 0.25], [CS.peek, 0.7], [CS.inside, 0.8], [CS.out, 0.5], [CS.up, 0.05], [CHEST.end, 0]], t) - 0.25 * tugs,
    head: M3.mul(M3.rx(flow([[CS.lock, 0], [CS.tug, 0.2], [CS.tugEnd, 0.2], [CS.scratch, 0], [CS.scratchEnd, 0], [CS.grip, 0.15], [CS.lift, -0.05], [CS.peek, 0.4], [CS.out, 0.3], [CS.up, -0.1], [CHEST.end, 0]], t)),
      M3.rz(flow([[CS.tugEnd, 0], [CS.scratch, 0.3], [CS.scratchEnd, 0.25], [CS.grip, 0], [CHEST.end, 0]], t))),
    arms: {}, legs: {}
  };
  for (const [s, x] of [['R', -1], ['L', 1]]) S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.06 * crouch, 0, -0.04 * crouch]), pole: [x * 0.45, 0, 1] };
  const idle = relaxed();
  const onLock = x => reach(V.add(lock, [x * 0.05, 0, -0.03 - 0.05 * tugs]), [x * 0.2, 0, 1], [-x, 0, 0], [x, -0.6, -0.3], 1.2);
  const onLid = x => reach(V.add(lidEdge(x * 0.28, open), [0, -0.02, -0.02]), [x * 0.1, 0.1, 1], [0, 1, 0], [x, -0.6, -0.3], 1.0, 0.35);
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    let arm;
    if (t < CS.tugEnd) arm = armBlend(idle, onLock(x), smooth(CS.lock, CS.tug, t));
    else if (t < CS.scratchEnd) {
      const back = armBlend(onLock(x), idle, smooth(CS.tugEnd, CS.scratch, t));
      arm = s === 'R' ? armBlend(back, Object.assign(scratchArm(-1, t), { natural: 0.5 }), smooth(CS.scratch, CS.scratch + 0.15, t) * (1 - smooth(CS.scratchEnd - 0.15, CS.scratchEnd, t))) : back;
    } else if (t < CS.lift) arm = armBlend(idle, onLid(x), smooth(CS.scratchEnd, CS.grip, t));
    else if (s === 'L') arm = armBlend(onLid(x), reach([0.24, 0.5, 0.5], [0, -0.5, 1], [0, -1, 0], [1, -0.6, -0.3], 0.8), smooth(CS.lift, CS.peek, t));   // a hand on the front
    else {
      const dig = t > CS.peek + 0.1 && t < CS.inside ? [0.06 * Math.sin(t * 13), 0.04 * Math.abs(Math.sin(t * 9)), 0.05 * Math.cos(t * 11)] : [0, 0, 0];
      arm = armBlend(onLid(x), reach(V.add(flow([[CS.lift, [-0.12, 0.75, 0.45]], [CS.peek, [-0.1, 0.6, 0.62]], [CS.inside, [-0.08, 0.36, 0.8]]], t), dig), [0, -0.7, 0.7], [0, -0.7, -0.7], [-1, -0.6, -0.2], 0.9), smooth(CS.lift, CS.peek, t));
    }
    S.arms[s] = arm;
  }
  // the prize: out of the chest, held up to have a look, then held ready
  if (t >= CS.inside && L.gun !== 'vest' && !GUNS[L.gun]) {
    const pos = flow([[CS.inside, [-0.08, 0.38, 0.8]], [CS.out, [-0.08, 0.8, 0.55]], [CS.up, [-0.06, 1.3, 0.42]], [4.5, [-0.06, 1.28, 0.4]]], t);
    S.thing = { kind: L.gun, p: pos, R: M3.mul(M3.ry(L.gun === 'fish' || L.gun === 'meat' ? 1.3 : 0.15), M3.rx(-0.15)) };
    S.arms.R = armBlend(S.arms.R, reach(V.add(pos, [-0.12, -0.02, 0]), [0.2, 0.8, 0.5], [1, 0, 0], [-1, -0.5, -0.3], 1.0), smooth(CS.inside, CS.out, t));
    S.arms.L = armBlend(S.arms.L, reach(V.add(pos, [0.12, -0.02, 0]), [-0.2, 0.8, 0.5], [-1, 0, 0], [1, -0.5, -0.3], 1.0), smooth(CS.out, CS.up, t));
  } else if (t >= CS.inside) {
    const id = L.gun, vest = id === 'vest';
    const pos = flow([[CS.inside, [-0.08, 0.38, 0.8]], [CS.out, [-0.1, 0.8, 0.55]], [CS.up, [-0.08, 1.3, 0.42]], [CS.up + 0.3, [-0.08, 1.32, 0.42]], [CHEST.end - 0.2, vest ? [0, 1.1, 0.35] : [-0.2, 1.02, 0.38]]], t);
    if (vest) {
      S.vest = { p: pos, R: M3.rx(-0.1) };
      S.arms.R = armBlend(S.arms.R, reach(V.add(pos, [-0.2, 0.06, 0]), [0.1, 1, 0.1], [1, 0, 0], [-1, -0.3, -0.3], 1.1), smooth(CS.inside, CS.out, t));
      S.arms.L = armBlend(S.arms.L, reach(V.add(pos, [0.2, 0.06, 0]), [-0.1, 1, 0.1], [-1, 0, 0], [1, -0.3, -0.3], 1.1), smooth(CS.out, CS.up, t));
    } else {
      const side = M3.mul(M3.ry(Math.PI / 2), M3.rz(0.15)), readyR = M3.mul(M3.ry(0.15), M3.rx(0.08));
      const R = t < CS.up + 0.3 ? side : M3.mix(side, readyR, smooth(CS.up + 0.3, CHEST.end - 0.2, t));
      const H = gunHands(id, { p: pos, R });
      S.gun = { id, p: pos, R }; S.arms.R = H.R;
      if (id !== 'glock') S.arms.L = armBlend(S.arms.L, H.L, smooth(CS.out, CS.up, t));
      else S.arms.L = armBlend(S.arms.L, relaxed(), smooth(CS.out, CS.up, t));
    }
  }
  L.f.script = S;

  const word = (q, text, life) => popWord(localToWorld(L, q), text, life);
  for (let k = 0; k < 3; k++) cue(L, CS.tug + 0.1 + k * 0.2, () => { Sound.play('click', 0.7); Sound.play('knock', 0.4); c.wobble = Math.max(c.wobble, 0.35); if (k === 1) word([0, 1.5, 0.4], 'hnng', 0.5); });
  cue(L, CS.scratch + 0.1, () => { Sound.play('huh', 0.8); word([0, 1.95, 0.1], '?', 0.6); });
  cue(L, CS.grip + 0.05, () => Sound.play('creak', 0.9));
  cue(L, CS.lift + 0.02, () => Sound.play('chestopen', 0.8));
  cue(L, CS.peek, () => Sound.play('whoosh', 0.35));
  cue(L, CS.out, () => Sound.play(L.gun === 'vest' ? 'vest' : 'rack', 0.6));
  cue(L, CS.up + 0.05, () => { Sound.play('ooo', 0.6, 0.3); word([0, 1.75, 0.4], 'ooh', 0.6); });
}

// the same moves, joined from the walk up straight to the lid
function chestQuick(L) {
  const at = t => t < CS.lock ? t : t + CS_SKIP;
  chestStep(Object.assign({}, L, { t: at(L.t), prev: at(L.prev) }));
}

// ---------------------------------------------------------------- starting, holding, finishing
function lootTarget() {
  if (player.dead >= 0 || player.ride) return null;
  const p = player.pos;
  let best = null, bestD = 1e9;
  for (const b of bots) {
    if (b.dead < 1.2 || b.looted || b.send || b.gone || Math.abs(b.pos[1] - p[1]) > 1.6) continue;
    if (royaleOn() && !b.inv.length) continue;                 // nothing on him: his things are on the floor
    // anywhere along the body counts
    const back = [-Math.sin(b.yaw), 0, -Math.cos(b.yaw)], u = clamp((p[0] - b.pos[0]) * back[0] + (p[2] - b.pos[2]) * back[2], 0, 1.4);
    const d = Math.hypot(p[0] - b.pos[0] - back[0] * u, p[2] - b.pos[2] - back[2] * u);
    if (d < 1.15 && d < bestD) { bestD = d; best = { kind: 'body', victim: b }; }
  }
  for (const c of chests) {
    const d = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]) - 0.4;
    if (c.t < 0 && !(c.claimed && c.claimed !== player) && Math.abs(c.pos[1] - p[1]) < 1.4 && d < 1.25 && d < bestD) { bestD = d; best = { kind: 'chest', chest: c }; }
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
    L.gun = bestGun(v) || 'glock'; L.def = BODY; L.step = bodyStep; v.beingLooted = true;
  } else {
    L.spot = V.add(L.chest.pos, [0, 0, 0.80]); L.face = Math.PI;
    const it = L.chest.loot || (L.chest.loot = rollLoot());
    L.loot = it; L.gun = it.t === 'gun' ? it.id : it.t; L.chest.claimed = player;
    L.def = game.chestLearned ? CHEST : CHEST_FIRST; L.step = game.chestLearned ? chestQuick : chestFunny;
  }
  f.hand = null; f.use = null; f.holdC4 = false; f.carry = null; f.thing = null; f.headTilt = null;
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
  if (L.chest) { L.chest.forced = false; L.chest.held = null; if (L.chest.claimed === player) L.chest.claimed = null; }
}
function endLoot() {
  const L = looting; if (!L) return;
  releaseTarget(L);
  player.script = null; player.scriptW = 0; looting = null; stars.length = 0;
}
function abortLoot() { endLoot(); }
function grant(L) {
  L.given = true;
  if (L.chest) {
    const it = L.loot;
    game.chestLearned = true;
    // no room for it: it goes on the floor by the chest, to swap for later
    if (!takeItem(player, it, !!player.weapon)) dropLoot(it, V.add(L.chest.pos, [0.7, 0, 0.8]), 0.15);
    if (it.t === 'gun') Sound.play('rarity', 0.8, it.rarity); else Sound.play(it.t === 'vest' ? 'vest' : 'grab', 0.9);
    L.chest.t = 0; L.chest.forced = false; L.chest.loot = null;
  } else lootBody(L.victim);
  hudDirty = true;
}
// the best gun on a fighter (rarest first)
function bestGun(f) { return f.inv.length ? f.inv.slice().sort((a, b) => rarityOf(f, b) - rarityOf(f, a))[0] : null; }
// take his best gun; the rest of what he carried spills out round him
function lootBody(v) {
  const id = bestGun(v), am = id && v.ammo[id];
  if (!royaleOn()) {                                         // the baseplate: the gun and a bomb, every time
    const gun = id || 'glock';
    if (!takeItem(player, gunItem(gun, am ? am.rarity : 0, GUNS[gun].mag, GUNS[gun].mag * 2), !!player.weapon)) dropLoot(gunItem(gun, 0), v.pos, 0.5);
    if (player.c4 < C4_MAX) takeItem(player, { t: 'c4' }, false);
    Sound.play('grab', 0.8);
    return;
  }
  if (id) {
    const it = gunItem(id, am.rarity, Math.max(am.clip, Math.ceil(GUNS[id].mag / 2)), Math.max(GUNS[id].mag, Math.min(am.spare, GUNS[id].reserve)));
    if (!takeItem(player, it, !!player.weapon)) dropLoot(it, v.pos, 0.6);
    Sound.play('rarity', 0.8, it.rarity);
    v.inv = v.inv.filter(g => g !== id); if (v.weapon === id) v.weapon = null;
  }
  spillPockets(v);
}

// true while the looting animation owns the player
function lootStep(dt) {
  const holding = keys.has('KeyE');
  const pressed = holding && !lootHeld;
  lootHeld = holding;
  lootCam = 0;                                                 // the camera stays yours while he does it
  if (!looting) {
    const target = pressed ? lootTarget() : null;
    if (!target) {
      if (pressed && player.dead < 0) { const o = thingNear(player.pos), b = !o && bikeNear(player.pos); if (o) pickUp(o); else if (b) startRide(b); }
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
    if (L.cancel >= 0.35) { endLoot(); if (!f.hol) f.equip = 1; return false; }     // what he held stays in his hands: no drawing it again
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

  L.step(L);
  const out = 1 - smooth(L.def.end - 0.28, L.def.end, t);
  f.scriptW = smooth(0.28, 0.55, t) * out; L.w0 = f.scriptW;
  if (L.victim) { L.victim.script = null; L.victim.scriptW = 0; }   // the body stays a ragdoll: he gets poked and bounced on for real
  if (!L.given && t >= L.def.hold) grant(L);
  // the gun he just took is already in his hands: just before the animation lets go, it becomes the one he holds, so nothing is put away or taken out again
  if (L.given && !L.armed && t >= L.def.end - 0.34 && GUNS[L.gun] && f.inv.includes(L.gun)) { L.armed = true; equipNow(f, L.gun); }
  weaponStep(f, dt);
  if (t >= L.def.end) {
    const id = L.gun, armed = L.armed;
    endLoot();
    if (armed || !f.hol) f.equip = 1;                          // whatever was in his hands still is: nothing is put away or drawn again
    if (!armed && GUNS[id] && f.weapon !== id && f.inv.includes(id)) equipNow(f, id);
  }
  return true;
}
function hudLoot(dt) {
  const target = looting ? null : lootTarget();
  const L = looting && !looting.given && looting.cancel < 0 ? looting : null;
  const free = !target && !looting && player.dead < 0 && !player.ride;
  const lying = free ? thingNear(player.pos) : null;
  const bike = free && !lying ? bikeNear(player.pos) : null;
  const use = free && !lying && !bike && player.hand && !player.use ? player.hand : null;
  const show = (target || L || lying || bike || use) && player.dead < 0;
  ui.prompt.style.display = show ? 'flex' : 'none';
  ui.prompt.classList.toggle('holding', !!L);
  ui.prompttext.style.color = '';
  ui.ring.style.display = use ? 'none' : '';
  if (lying) {
    const it = lying.item || (lying.prop.kind === 'c4' ? { t: 'c4' } : gunItem(lying.prop.gun, lying.prop.ammo.rarity));
    const stuck = !fits(player, it) && heldSlot(player) < 0;
    ui.prompttext.textContent = stuck ? 'Pockets full: hold the thing to swap for the ' + lootName(it) : 'Press E to ' + (fits(player, it) ? 'pick up ' : 'swap for ') + 'the ' + lootName(it);
    if (it.t === 'gun') ui.prompttext.style.color = RARITY[it.rarity].css;
    ui.ring.style.setProperty('--p', '100%');
  }
  else if (bike) { ui.prompttext.textContent = 'Press E to ride the tiny bike'; ui.ring.style.setProperty('--p', '100%'); }
  else if (use) ui.prompttext.textContent = useBlock(player, use) || (use === 'plate' ? 'Click to put the plate in your vest' : 'Click to eat the ' + FOOD[use].name.toLowerCase());
  else if (show) {
    const kind = L ? L.kind : target.kind, def = L ? L.def : kind === 'body' ? BODY : game.chestLearned ? CHEST : CHEST_FIRST;
    ui.prompttext.textContent = L ? 'Keep holding… ' : 'Hold E to ' + def.label;
    ui.ring.style.setProperty('--p', (L ? clamp(L.t / def.hold, 0, 1) * 100 : 0) + '%');
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
