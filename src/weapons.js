// ======================================================================= the reload
// He pulls the magazine out and, not being sure what it is, holds it up to his eye and peers into it like a telescope.
// Ooo? Nothing to see. He shrugs, lets it drop, takes a fresh one off his hip and reloads properly.
// Shells go in one at a time from his hip. Times are fractions of the reload.
const RL = { reach: 0.07, out: 0.16, eye: 0.26, peer: 0.38, drop: 0.43, pouch: 0.56, grab: 0.61, up: 0.73, line: 0.79, seat: 0.85, rack: 0.93 };
const LITTER = 10, BIG = 1.5;                                                   // seconds a dropped magazine stays on the floor

const reloadAt = f => f.reload >= 0 && f.weapon ? f.reload / GUNS[f.weapon].reload : -1;
// how much he is busy peering into it (the gun sags, his head cocks towards it)
const peerAmount = f => { const t = reloadAt(f); return t < 0 || !GUNS[f.weapon] || GUNS[f.weapon].item.kind !== 'mag' ? 0 : smooth(RL.out, RL.eye, t) * (1 - smooth(RL.peer, RL.drop, t)); };
// the slide on the shotgun: 0 forward, 1 pulled right back
function pumpAmount(f, g) {
  if (!g.pumpAction) return 0;
  if (f.cycle >= 0) { const u = f.cycle / g.cycle; return smooth(0.22, 0.42, u) * (1 - smooth(0.55, 0.78, u)); }
  const t = reloadAt(f);
  return t < 0 ? 0 : smooth(0.91, 0.945, t) * (1 - smooth(0.95, 0.98, t));
}
const leftGrip = (f, g) => g.pumpAction ? Object.assign({}, g.left, { at: V.add(g.left.at, [0, 0, -g.pumpTravel * pumpAmount(f, g)]) }) : g.left;

function mixGoal(a, b, w) {
  const dir = V.norm(V.lerp(a.dir, b.dir, w));
  const o = { wrist: V.lerp(a.wrist, b.wrist, w), dir, palm: V.orth(V.lerp(a.palm, b.palm, w), dir), pole: b.pole, curl: [a.curl[0] + (b.curl[0] - a.curl[0]) * w, a.curl[1] + (b.curl[1] - a.curl[1]) * w] };
  if (a.natural !== undefined || b.natural !== undefined) o.natural = (a.natural === undefined ? 1 : a.natural) + ((b.natural === undefined ? 1 : b.natural) - (a.natural === undefined ? 1 : a.natural)) * w;
  return o;
}
// where the free hand is during a reload, and what it is holding. everything is in the fighter's own space
function reloadPose(f, g, G, rest, chest) {
  const t = reloadAt(f), I = g.item, mag = I.kind === 'mag', u = (a, b) => smooth(a, b, t);
  const shift = V.sub(chest, Rig.rest[IDX.chest]);
  const atGun = onGun(G, I.grab), pulled = onGun(G, V.add(I.grab, V.mul(I.pull, 0.3))), below = onGun(G, V.add(I.grab, V.mul(I.pull, 1.1)));
  const pouch = V.add([0.27, 0.86, 0.1], shift), side = V.add([0.36, 1.0, 0.26], shift);
  const eye = V.add([0.03, 1.54, 0.13], shift), scope = V.add(eye, [0.01, -0.01, 0.17]);     // his left eye, and the magazine held up to it
  const gunDir = V.norm(M3.vec(G.R, [-0.5, 0.35, 0.8])), gunPalm = V.norm(M3.vec(G.R, [-0.4, 0.8, 0]));
  const hipDir = V.norm([0.1, -0.85, 0.5]), hipPalm = [-1, 0, 0];
  const holding = (q, k, curl) => {
    const dir = V.norm(V.lerp(gunDir, hipDir, k)), palm = V.orth(V.lerp(gunPalm, hipPalm, k), dir);
    return { wrist: V.add(V.add(q, V.mul(dir, -0.09)), V.mul(palm, -0.037)), dir, palm, pole: [0.9, -1, -0.2], curl: [curl === undefined ? 0.9 : curl, curl === undefined ? 0.95 : curl], natural: 0.55 };
  };
  // held up to his eye from below, like a telescope
  const atEye = q => ({ wrist: V.add(q, [0.02, -0.12, -0.01]), dir: V.norm([-0.1, 1, 0.15]), palm: [-1, 0, 0.2], pole: [1, -0.8, -0.3], curl: [1.0, 1.05], natural: 0.6 });
  const toEye = V.norm(V.sub(eye, scope)), eyeR = M3.frame(I.mouth, [1, 0, 0], toEye, [1, 0, 0]);
  const tipped = a => M3.mul(G.R, M3.rx(a));

  let goal = null, item = null;
  if (t < RL.reach) goal = mixGoal(rest, holding(atGun, 0), u(0, RL.reach));
  else if (!mag) {                                                // shells: from his hip to the loading port, three times
    if (t < RL.seat) {
      const v = (t - RL.reach) / (RL.seat - RL.reach), n = Math.min(2, Math.floor(v * 3)), w = v * 3 - n;
      const q = flow([[0, atGun], [0.28, side], [0.45, pouch], [0.58, pouch], [0.78, below], [1, atGun]], w);
      const k = flow([[0, 0], [0.3, 0.6], [0.45, 1], [0.58, 1], [0.8, 0.1], [1, 0]], w);
      goal = holding(q, k);
      if (w > 0.5) item = { p: q, R: tipped(0.3 * (1 - smooth(0.8, 1, w))) };
    } else goal = mixGoal(holding(atGun, 0), rest, u(RL.seat, 0.91));
  } else if (t < RL.out) {                                        // thumb the catch, pull it down and out
    const w = u(RL.reach, RL.out);
    item = { p: V.lerp(atGun, below, w), R: tipped(0.3 * w) };
    goal = holding(item.p, 0);
  } else if (t < RL.drop) {                                       // up to his eye: a good long look inside. ooo?
    const w = u(RL.out, RL.eye), shrug = u(RL.peer, RL.drop);
    const wobble = t > RL.eye && t < RL.peer ? [0.012 * Math.sin(t * 60), 0.008 * Math.sin(t * 47), 0] : [0, 0, 0];
    const q = V.add(V.lerp(V.lerp(below, scope, w), V.add(scope, [0.12, -0.2, 0.1]), shrug), wobble);
    item = { p: q, R: M3.mix(tipped(0.3), eyeR, w) };
    goal = mixGoal(holding(below, 0), atEye(q), w);
  } else if (t < RL.up) {                                         // nothing in there. let go of it; get a fresh one; bring it up
    const q = flow([[RL.drop, V.add(scope, [0.12, -0.2, 0.1])], [0.49, side], [RL.pouch, pouch], [RL.grab, pouch], [0.67, side], [RL.up, below]], t);
    const k = flow([[RL.drop, 0.4], [0.49, 0.6], [RL.pouch, 1], [RL.grab, 1], [0.67, 0.55], [RL.up, 0]], t);
    goal = t < 0.47 ? mixGoal(atEye(V.add(scope, [0.12, -0.2, 0.1])), holding(q, k, 0.35), u(RL.drop, 0.47)) : holding(q, k, t < RL.pouch ? 0.35 : 0.9);
    if (t >= RL.grab) item = { p: q, R: tipped(flow([[RL.grab, 1.0], [0.67, 0.7], [RL.up, 0.35]], t)) };
  } else if (t < RL.seat) {                                       // line it up and push it home
    const q = flow([[RL.up, below], [RL.line, pulled], [RL.seat, atGun]], t);
    item = { p: q, R: tipped(0.35 * (1 - u(RL.up, RL.line))) };
    goal = holding(q, 0);
  } else if (g.boltAction || g.pumpAction || g.drumLoad) goal = mixGoal(holding(atGun, 0), rest, u(RL.seat, g.boltAction ? 1 : 0.91));
  else {                                                          // pull the charging handle
    const knob = holding(onGun(G, g.boltPoint), 0), back = holding(onGun(G, V.add(g.boltPoint, [0, 0, -g.boltTravel])), 0);
    goal = t < 0.93 ? mixGoal(holding(atGun, 0), knob, u(RL.seat, 0.93)) : t < 0.975 ? mixGoal(knob, back, u(0.93, 0.955)) : mixGoal(back, rest, u(0.975, 1));
  }
  return { hand: goal, item: item ? { p: item.p, R: item.R, out: [0, 0, 0] } : null };
}

// the bits of a reload that happen once: sounds, the "ooo?", the dropped magazine
function reloadCues(f, g, t0, t) {
  const loud = f.isPlayer ? 0.9 : clamp(1 - V.len(V.sub(f.pos, player.pos)) / 20, 0, 1) * 0.35, crossed = at => t0 < at && t >= at, mag = g.item.kind === 'mag';
  const near = f.isPlayer || V.len(V.sub(f.pos, player.pos)) < 18;
  const cue = (at, s, v) => { if (crossed(at) && loud > 0.01) Sound.play(s, loud * (v || 1)); };
  if (mag) {
    cue(RL.reach + 0.02, 'magout');
    if (crossed(RL.eye) && near) { Sound.play('ooo', f.isPlayer ? 0.7 : 0.3, 0.2); popWord(V.add(bonePos(f, 'head'), [0, 0.42, 0]), 'ooo?', g.reload * (RL.peer - RL.eye) + 0.2); }
    if (crossed(RL.drop)) tossItem(f, g);                          // it just drops out of his hand
    cue(RL.grab, 'click', 0.7);
    cue(RL.seat - 0.01, 'magin');
    if (crossed(RL.seat)) f.riseV += 1.2;                         // the gun jumps a little as it goes home
  } else for (let i = 0; i < 3; i++) if (crossed(RL.reach + (RL.seat - RL.reach) * (i + 0.97) / 3)) { Sound.play('shellin', loud); if (g.drumLoad) f.drumT += Math.PI / 3; }
  if (g.boltAction) { cue(0.885, 'boltup'); cue(0.915, 'boltback'); cue(0.955, 'boltfwd'); }
  else if (g.pumpAction) { cue(0.92, 'pumpback'); cue(0.965, 'pumpfwd'); }
  else if (g.drumLoad) cue(0.93, 'rack');
  else cue(RL.rack, 'rack');
}

// ---------------------------------------------------------------- the thing he throws away
function tubeData(r, z0, z1, n, tip) {                                // a cylinder along z, pointed if tip < 1
  const v = [], i = [], r1 = r * (tip === undefined ? 1 : tip);
  for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); v.push(c * r, s * r, z0, c, s, 0, 0, 0, c * r1, s * r1, z1, c, s, 0, 0, 0); }
  for (let k = 0; k < n; k++) { const a = k * 2; i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  for (const [z, rad, nz] of [[z0, r, -1], [z1, r1, 1]]) {
    const mid = v.length / 8; v.push(0, 0, z, 0, 0, nz, 0, 0);
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2; v.push(Math.cos(a) * rad, Math.sin(a) * rad, z, 0, 0, nz, 0, 0); }
    for (let k = 0; k < n; k++) i.push(mid, mid + 1 + (nz > 0 ? k : k + 1), mid + 1 + (nz > 0 ? k + 1 : k));
  }
  return { v, i };
}
JUNK.shell = [{ mesh: mergeMesh([tubeData(0.019, -0.026, 0.048, 10)]), color: [0.45, 0.015, 0.01], rough: 0.45 }, { mesh: mergeMesh([tubeData(0.0205, -0.05, -0.026, 10)]), color: [0.70, 0.48, 0.14], rough: 0.3 }];
JUNK.round = [{ mesh: mergeMesh([tubeData(0.031, -0.055, 0.005, 12)]), color: [0.62, 0.45, 0.12], rough: 0.3 }, { mesh: mergeMesh([tubeData(0.030, 0.005, 0.034, 12), tubeData(0.030, 0.034, 0.062, 12, 0.25)]), color: [0.06, 0.13, 0.03], rough: 0.5 }];

// what the physics feels of them: the corners of a magazine's box, and a few rings round a shell or grenade
function magShape(id) {
  const g = GUNS[id], h = V.mul(g.magHalf, g.scale);
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x * h[0], y * h[1], z * h[2]])));
}
const rings = (r, zs) => zs.flatMap(z => [[r, 0, z], [-r, 0, z], [0, r, z], [0, -r, z]]);
SHAPES.shell = rings(0.02, [-0.05, 0, 0.048]);
SHAPES.round = rings(0.031, [-0.055, 0, 0.055]);
// a magazine on its own (S includes the gun's size; p is the gun's origin)
function drawMag(prog, textured, g, S, p) {
  if (textured) {
    gl.uniform1i(prog.u.uHasTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.orm);
  }
  drawMesh(prog, g.parts.mag, S, p);
}
function drawItem(prog, textured, it) {
  const g = GUNS[it.gun];
  if (g.item.kind === 'mag') drawMag(prog, textured, g, it.S, V.sub(it.p, M3.vec(it.S, g.item.grab)));
  else {                                                  // drawn big, and poking out of his fist, so you can see it
    const S = it.R.map(x => x * BIG);
    for (const part of JUNK[g.item.kind]) { flat(prog, part.color, part.rough, 0.3); drawMesh(prog, part.mesh, S, V.add(it.p, it.out)); }
  }
}
function tossItem(f, g) {
  const it = f.item;
  if (!it) return;
  const kind = g.item.kind, v = M3.vec(M3.ry(f.yaw), [rand(0.1, 0.4), rand(-0.6, -0.2), rand(0.1, 0.4)]);   // let go of: it just drops
  const at = kind === 'mag' ? V.add(it.p, M3.vec(it.S, V.sub(g.magMid, g.item.grab))) : it.p;
  spawnProp(kind, at, v, { gun: it.gun, life: LITTER, scale: kind === 'mag' ? 1 : BIG, spin: rand(1.5, 4), R: it.R.slice() });
}

// ======================================================================= grenades
const grenades = [];
const BLAST_REACH = 4.5;
// lob it so that it lands on what the crosshair is on
function launchGrenade(f, from, to, rarity) {
  const T = clamp(V.len(V.sub(to, from)) / 24, 0.06, 2.2), d = V.sub(to, from);
  grenades.push({ p: from.slice(), v: [d[0] / T, d[1] / T + 4.9 * T, d[2] / T], owner: f, life: 5, puff: 0, rarity: rarity || 0 });
}
function grenadesStep(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const n = grenades[i];
    n.v[1] -= 9.8 * dt; n.life -= dt;
    const move = V.mul(n.v, dt), len = V.len(move), hit = trace(n.p, V.mul(move, 1 / (len || 1)), n.owner, 0);
    if ((hit.kind !== 'none' && hit.t <= len + 0.04) || n.life <= 0) {
      grenades.splice(i, 1);
      const at = n.life <= 0 ? n.p : hit.p;
      grenadeBoom([at[0], Math.max(at[1], floorAt(at[0], at[2]) + 0.12), at[2]], n.owner, n.rarity);
      continue;
    }
    n.p = V.add(n.p, move);
    if ((n.puff -= dt) <= 0) { n.puff = 0.025; fx(n.p, [rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2)], 0.5, 0.05, [0.7, 0.7, 0.72, 0.35], -0.2, 0.25); }
  }
}
function grenadeBoom(c, owner, rarity) {
  const d = V.len(V.sub(c, cameraEye().eye)), floor = floorAt(c[0], c[2]);
  Sound.play('boom', clamp(1.2 - d / 55, 0.15, 1), 0, 0, d);
  cam.shake = Math.max(cam.shake, clamp(1.4 - d / 14, 0, 1));
  for (let i = 0; i < 5; i++) fx(V.add(c, ball(0.15)), ball(1), rand(0.08, 0.18), rand(0.7, 1.1), [1, 0.95, 0.8, 1], 0, 3, true);
  for (let i = 0; i < 55; i++) { const v = ball(rand(1.5, 5)); v[1] = Math.abs(v[1]) * 0.8 + rand(0.5, 2); fx(V.add(c, ball(0.2)), v, rand(0.3, 0.85), rand(0.2, 0.5), Math.random() < 0.4 ? [1, 0.82, 0.4, 1] : [1, 0.42, 0.06, 0.95], -1.8, 0.8, true); }
  for (let i = 0; i < 60; i++) { const v = ball(rand(5, 14)); v[1] = Math.abs(v[1]) + 1; fx(c, v, rand(0.35, 1.1), rand(0.012, 0.026), [1, rand(0.6, 0.9), 0.3, 1], 9.8, 0, true); }
  for (let i = 0; i < 30; i++) { const v = ball(rand(0.4, 1.8)); v[1] = rand(1, 3.5); fx(V.add(c, ball(0.3)), v, rand(1.4, 2.8), rand(0.3, 0.55), [0.14, 0.13, 0.13, 0.6], -0.7, 0.55); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, s = rand(4, 7); fx([c[0], floor + 0.12, c[2]], [Math.cos(a) * s, rand(0, 0.6), Math.sin(a) * s], rand(0.6, 1.1), rand(0.2, 0.35), [0.55, 0.50, 0.42, 0.55], 0, 0.7); }
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.3), r = Math.sqrt(Math.random()) * 0.9, x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r; marks.push([x, floorAt(x, z), z]); }
  while (marks.length > 120) marks.shift();
  shoveProps(c, BLAST_REACH, 5);                                      // loose junk goes flying
  for (const v of [player, ...bots]) {
    if (v.gone) continue;
    const dd = V.len(V.sub(V.add(v.pos, [0, 0.9, 0]), c));
    if (v.dead >= 0) { if (v.rag && !v.gone) ragBlast(v, c, BLAST_REACH + 1); continue; }   // and so do bodies
    if (dd >= BLAST_REACH) continue;
    const mine = v === owner, amount = Math.round((20 + 130 * (1 - dd / BLAST_REACH)) * (mine ? 0.4 : RARITY[rarity || 0].mult * (!owner.isPlayer && v.isPlayer ? 0.6 : 1)));
    damage(v, amount, { pos: c, isPlayer: owner.isPlayer && !mine, blast: true }, false, rarity === EXOTIC && !mine);
    if (owner.isPlayer && !mine) { Sound.play('hit', 0.8); game.marker = 0.18; ui.marker.classList.toggle('head', v.dead >= 0); }
  }
}
function drawGrenades(prog) {
  for (const n of grenades) {
    const along = V.norm(n.v), R = M3.frame([0, 0, 1], [1, 0, 0], along, V.orth([1, 0, 0], along));
    for (const part of JUNK.round) { flat(prog, part.color, part.rough, 0.3); drawMesh(prog, part.mesh, R, n.p); }
  }
}

// ======================================================================= the bulletproof vest
const VEST = 100;                              // how much it soaks up before it breaks (headshots go straight past it)
const OLIVE = [0.052, 0.072, 0.036], BLACK = [0.012, 0.014, 0.012];
// pouches on his belly, fixed to the spine so they move with it
const pouches = (() => {
  const boxes = [boxData(0.078, 0.082, 0.05, -0.095, 0.95, 0.240), boxData(0.078, 0.082, 0.05, 0, 0.95, 0.258), boxData(0.078, 0.082, 0.05, 0.095, 0.95, 0.240)];
  const v = [], i = [];
  for (const b of boxes) { const base = v.length / 8; v.push(...b.v); for (const k of b.i) i.push(base + k); }
  const n = v.length / 8, joints = new Uint8Array(n * 4), weights = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) { joints[k * 4] = IDX.spine; weights[k * 4] = 1; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  buffer(gl.ARRAY_BUFFER, new Float32Array(v));
  attrib(0, null, 3, gl.FLOAT, false, 32, 0); attrib(1, null, 3, gl.FLOAT, false, 32, 12); attrib(2, null, 2, gl.FLOAT, false, 32, 24);
  attrib(3, joints, 4, gl.UNSIGNED_BYTE, true); attrib(4, weights, 4, gl.FLOAT); attrib(5, new Float32Array(n).fill(1), 1, gl.FLOAT);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(i));
  gl.bindVertexArray(null);
  return { vao, count: i.length };
})();
// (the vest he wears is painted on his skin by the skin shader: see uPaint)
function drawHeldVest(prog, R, p) { drawLoot(prog, 'vest', R, p, 2); }
const itemName = id => id === 'vest' ? 'bulletproof vest' : GUNS[id].name;

// ======================================================================= guns carried on the body
// rifles ride on the back, crossed; pistols hang on the hip. Every gun keeps its own place however he switches.
const BACK_SPOTS = [{ dir: [0.34, 1, 0], off: [0.03, 0.02, -0.20] }, { dir: [-0.34, 1, 0], off: [-0.03, 0.02, -0.235] }, { dir: [0.95, 0.28, 0], off: [0, -0.2, -0.205] }, { dir: [-0.95, 0.28, 0], off: [0, -0.26, -0.24] }];
const isPistol = g => g.muzzle[2] < 0.3;
// where the gun rests, in the fighter's own space (wr and wp must already hold the bones it hangs from)
function mountLocal(f, id) {
  const g = GUNS[id], pistol = isPistol(g), bone = pistol ? IDX.hips : IDX.chest;
  const Rb = f.wr[bone], base = f.wp[bone];
  let Rl, off;
  if (pistol) {                                                // muzzle down, slide to the back
    const z = V.norm([0, -1, 0.1]), x = [-1, 0, 0];
    Rl = M3.cols(x, V.cross(z, x), z); off = V.sub([-0.30, -0.02, 0.0], M3.vec(Rl, [0, 0, g.muzzle[2] * 0.4 * g.scale]));
  } else {                                                     // side flat against the back, muzzle up and across
    let n = 0; for (const other of f.inv) { if (other === id) break; if (!isPistol(GUNS[other])) n++; }
    const spot = BACK_SPOTS[Math.min(n, BACK_SPOTS.length - 1)], z = V.norm(spot.dir), x = [0, 0, -1];
    Rl = M3.cols(x, V.cross(z, x), z); off = V.sub(spot.off, M3.vec(Rl, [0, 0, g.muzzle[2] * 0.44 * g.scale]));
  }
  return { R: M3.mul(Rb, Rl), p: V.add(base, M3.vec(Rb, off)) };
}
function drawStowed(prog, textured, f, hideSelf) {
  if ((hideSelf && f.isPlayer) || f.gone || !f.vis || f.rag || !f.wr[IDX.chest] || f.away > (textured ? 40 : 14)) return;
  for (const id of f.inv) {
    const g = GUNS[id];
    if (f.gun && f.gun.g === g) continue;                        // that one is in his hands (or on its way)
    if ((f.hol && f.hol.id === id) || (f.pickNext && f.pickNext.id === id)) continue;     // still on the floor, or being picked up
    const m = mountLocal(f, id);
    drawGun(prog, textured, g, M3.mul(f.R, m.R).map(x => x * g.scale), toWorld(f, m.p), {});
  }
}

// ---------------------------------------------------------------- putting a gun away and taking one out
// f.hol = { mode: 'stow' | 'draw', id, a, rel | reach }: a runs 0 (in the hands) to 1 (on the back). The right hand carries the gun there
// and lets go of it; taking one out, the hand first reaches round to the back, takes hold and brings it to the front.
// he already has it in his hands (a chest or a body just gave it to him): no putting away, no taking out
function equipNow(f, id) {
  f.hol = null; f.holdC4 = false; f.hand = null; f.use = null;
  f.weapon = id; f.equip = 1; f.reload = -1; f.cool = Math.max(f.cool, 0.2); f.bolt = 0; f.cycle = -1; f.inspect = -1;
  if (f.isPlayer) { Sound.play('rack', 0.5); hudDirty = true; }
}
// picking a gun up off the floor, caveman style: leans over it, pokes it a few times, jumps back, tilts his head, grabs it,
// turns it the right way up and brings it to the ready position
const PICK = { reach: 0.30, tapEnd: 0.60, startle: 0.60, backEnd: 0.82, grab: 0.92, dur: 1.50 };
const toLocalPos = (f, w) => M3.vec(M3.tr(f.R), V.sub(w, [f.model[12], f.model[13], f.model[14]]));
function pickHol(f, st) {
  return { mode: 'pick', id: st.id, t: 0, a: st.a, item: toLocalPos(f, V.add(st.floorP, [0, 0.3, 0])) };
}
const pickBend = h => 1.2 * smooth(0, PICK.reach, h.t) * (1 - smooth(PICK.grab + 0.1, PICK.dur, h.t));
const pickPuzzled = h => smooth(PICK.startle - 0.05, PICK.startle + 0.12, h.t) * (1 - smooth(PICK.backEnd, PICK.grab + 0.05, h.t));
const HOL = { carry: 0.30, release: 0.16, reach: 0.20 };
function holsterOnEquip(f, id) {
  const h = f.hol, now = f.weapon;
  if (id === now) return;
  if (h && h.mode === 'draw') { f.hol = { mode: 'stow', id: h.id, a: h.a, rel: 0 }; return; }   // changed his mind half way: it goes back the way it came
  if (h) return;                                                                                  // already putting one away; the next one follows
  if (now && f.gun && !f.gun.held && f.dead < 0 && f.inv.includes(now)) f.hol = { mode: 'stow', id: now, a: 0, rel: 0 };
  else if (id) f.hol = { mode: 'draw', id, a: 1, reach: 0 };
}
function holsterStep(f, dt) {
  const h = f.hol;
  if (h.mode === 'pick') {
    const before = h.t; h.t += dt;
    const loud = f.isPlayer ? 0.8 : 0.35;
    if (before < PICK.startle && h.t >= PICK.startle) Sound.play('huh', loud);
    if (before < PICK.grab && h.t >= PICK.grab) Sound.play('grab', loud);
    if (h.t >= PICK.dur) { equipNow(f, h.id); return; }
    f.equip = 0;
    return;
  } else if (h.mode === 'stow') {
    if (h.a < 1) h.a = Math.min(1, h.a + dt / HOL.carry);
    else if ((h.rel += dt / HOL.release) >= 1) f.hol = f.weapon ? { mode: 'draw', id: f.weapon, a: 1, reach: 0 } : null;
  } else if (h.reach < 1) h.reach += dt / HOL.reach;
  else if ((h.a -= dt / HOL.carry) <= 0) f.hol = null;
  if (f.hol) f.equip = 0;
  else { f.equip = 1; f.cool = Math.max(f.cool, 0.05); if (f.isPlayer) hudDirty = true; }
}
// the gun's place and both hands for this moment of the holster, given where the gun sits in the hands (G)
function holsterPose(f, g, G, h) {
  if (h.mode === 'pick') {
    const t = h.t, restR0 = idleArm(-1), restL0 = idleArm(1);
    const lift = smooth(PICK.grab, PICK.dur, t), poking = smooth(PICK.reach, PICK.reach + 0.05, t) * (1 - smooth(PICK.tapEnd - 0.04, PICK.tapEnd, t));
    const R0 = M3.mul(M3.ry(h.a - f.yaw), M3.mul(M3.rz(0.12 * Math.sin(t * 31) * poking), M3.rx(0.08 * Math.sin(t * 23) * poking)));   // it jiggles when poked
    const onFloor = V.add(h.item, V.add([0, 0.03 * Math.abs(Math.sin(t * 13)) * poking, 0], M3.vec(R0, [0, 0, -0.18 * g.scale])));
    const flip = Math.PI * (1 - smooth(0.15, 0.7, lift));                                // he picks it up the wrong way round and turns it over
    const R = M3.mul(M3.mix(R0, G.R, lift), M3.rz(flip));                              // rolls over about its own length, so the muzzle never swings back into him
    const out = [-0.15, 1.0, 0.52];                                                      // it comes up out in front of him first, and is only drawn in once he is standing
    const p = V.lerp(V.lerp(onFloor, out, smooth(0, 0.6, lift)), G.p, smooth(0.6, 1, lift));
    const Gp = Object.assign({}, G, { R, p });
    let right = handGoal(Gp, g.right, [-0.8, -1, -0.15]);
    const tap = 0.07 * Math.abs(Math.sin((t - PICK.reach) * 13)) * poking, away = smooth(PICK.tapEnd - 0.02, PICK.tapEnd + 0.1, t) * (1 - smooth(PICK.backEnd, PICK.grab, t));
    right = Object.assign({}, right, { wrist: V.add(right.wrist, [0, tap, 0]) });
    right = mixGoal(restR0, right, smooth(0, PICK.reach, t));
    right = mixGoal(right, restR0, 0.65 * away);                                        // jumps back from it
    const left = mixGoal(restL0, handGoal(Gp, leftGrip(f, g), [0.75, -1, 0.1]), smooth(PICK.grab + 0.3, PICK.dur, t));
    return { G: Gp, goals: { R: right, L: left } };
  }
  const M = mountLocal(f, h.id), pistol = isPistol(g);
  const e = smooth(0, 1, h.a), s = Math.sin(Math.PI * e);
  // up and back past the shoulder on the way (the hip for a pistol), so it never cuts through him
  const arc = pistol ? [-0.1 * s, -0.05 * s, 0.14 * s] : [-0.14 * s, 0.34 * s, -0.10 * s];
  const Gp = Object.assign({}, G, { R: M3.mix(G.R, M.R, e), p: V.add(V.lerp(G.p, M.p, e), arc) });      // keeps the scale and aim the hands need
  const pole = V.lerp([-0.8, -1, -0.15], pistol ? [-1, -0.2, 0.1] : [-1, 0.1, -0.7], e);
  const grip = P => handGoal(P, g.right, pole), left = P => handGoal(P, leftGrip(f, g), [0.75, -1, 0.1]);
  const restR = idleArm(-1), restL = idleArm(1);
  let R, L;
  if (h.mode === 'stow') {
    R = h.a < 1 ? grip(Gp) : mixGoal(grip(Gp), restR, smooth(0, 1, h.rel));          // carries it there, then lets go and drops the hand
    L = mixGoal(left(Gp), restL, smooth(0, 0.4, h.a));                                  // the other hand lets go first
  } else {
    R = h.reach < 1 ? mixGoal(restR, grip(Gp), smooth(0, 1, h.reach)) : grip(Gp);      // reaches round, takes hold, then brings it out
    L = mixGoal(restL, left(Gp), smooth(0.6, 1, 1 - h.a));
  }
  return { G: Gp, goals: { R, L } };
}
