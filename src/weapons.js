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
  const loud = f.isPlayer ? 0.9 : 0.2, crossed = at => t0 < at && t >= at, mag = g.item.kind === 'mag';
  const near = f.isPlayer || V.len(V.sub(f.pos, player.pos)) < 18;
  const cue = (at, s, v) => { if (crossed(at)) Sound.play(s, loud * (v || 1)); };
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
function launchGrenade(f, from, to) {
  const T = clamp(V.len(V.sub(to, from)) / 24, 0.06, 2.2), d = V.sub(to, from);
  grenades.push({ p: from.slice(), v: [d[0] / T, d[1] / T + 4.9 * T, d[2] / T], owner: f, life: 5, puff: 0 });
}
function grenadesStep(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const n = grenades[i];
    n.v[1] -= 9.8 * dt; n.life -= dt;
    const move = V.mul(n.v, dt), len = V.len(move), hit = trace(n.p, V.mul(move, 1 / (len || 1)), n.owner, 0);
    if ((hit.kind !== 'none' && hit.t <= len + 0.04) || n.life <= 0) {
      grenades.splice(i, 1);
      const at = n.life <= 0 ? n.p : hit.p;
      grenadeBoom([at[0], Math.max(at[1], floorAt(at[0], at[2]) + 0.12), at[2]], n.owner);
      continue;
    }
    n.p = V.add(n.p, move);
    if ((n.puff -= dt) <= 0) { n.puff = 0.025; fx(n.p, [rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2)], 0.5, 0.05, [0.7, 0.7, 0.72, 0.35], -0.2, 0.25); }
  }
}
function grenadeBoom(c, owner) {
  const d = V.len(V.sub(c, cameraEye().eye)), floor = floorAt(c[0], c[2]);
  Sound.play('boom', clamp(1.2 - d / 55, 0.15, 1));
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
    const dd = V.len(V.sub(V.add(v.pos, [0, 0.9, 0]), c));
    if (v.dead >= 0) { if (v.rag && !v.gone) ragBlast(v, c, BLAST_REACH + 1); continue; }   // and so do bodies
    if (dd >= BLAST_REACH) continue;
    const mine = v === owner, amount = Math.round((20 + 130 * (1 - dd / BLAST_REACH)) * (mine ? 0.4 : 1));
    damage(v, amount, { pos: c, isPlayer: owner.isPlayer && !mine, blast: true }, false);
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
// called while the skinned program is drawing this fighter
function drawWornVest(prog, f) {
  if (!(f.vest > 0) || (f.script && f.script.vest && f.scriptW > 0.3)) return;
  const skin = Rig.prims.find(p => p.name === 'skin');
  gl.uniform1i(prog.u.uHasTex, 0); gl.uniform1i(prog.u.uHasNormal, 0); gl.uniform3fv(prog.u.uTint, [1, 1, 1]); gl.uniform1f(prog.u.uRough, 0.75);
  gl.uniform3fv(prog.u.uColor, OLIVE); gl.uniform1i(prog.u.uVest, 1); gl.uniform1f(prog.u.uInflate, 0.028);
  gl.bindVertexArray(skin.vao); gl.drawElements(gl.TRIANGLES, skin.count, gl.UNSIGNED_SHORT, 0);
  gl.uniform1i(prog.u.uVest, 0); gl.uniform1f(prog.u.uInflate, 0);
  gl.uniform3fv(prog.u.uColor, BLACK);
  gl.bindVertexArray(pouches.vao); gl.drawElements(gl.TRIANGLES, pouches.count, gl.UNSIGNED_SHORT, 0);
}
// the vest on its own, for holding up out of a chest
const vestShape = {
  cloth: mergeMesh([boxData(0.40, 0.30, 0.06, 0, -0.04, 0.08), boxData(0.40, 0.30, 0.06, 0, -0.04, -0.08), boxData(0.085, 0.14, 0.06, -0.125, 0.18, 0.08), boxData(0.085, 0.14, 0.06, 0.125, 0.18, 0.08),
    boxData(0.085, 0.14, 0.06, -0.125, 0.18, -0.08), boxData(0.085, 0.14, 0.06, 0.125, 0.18, -0.08), boxData(0.085, 0.05, 0.22, -0.125, 0.27, 0), boxData(0.085, 0.05, 0.22, 0.125, 0.27, 0)]),
  trim: mergeMesh([boxData(0.10, 0.11, 0.04, -0.12, -0.11, 0.125), boxData(0.10, 0.11, 0.04, 0, -0.11, 0.125), boxData(0.10, 0.11, 0.04, 0.12, -0.11, 0.125), boxData(0.41, 0.028, 0.23, 0, -0.175, 0), boxData(0.41, 0.018, 0.23, 0, 0.0, 0)])
};
function drawHeldVest(prog, R, p) {
  flat(prog, OLIVE, 0.75, 0); drawMesh(prog, vestShape.cloth, R, p);
  flat(prog, BLACK, 0.6, 0.1); drawMesh(prog, vestShape.trim, R, p);
}
const itemName = id => id === 'vest' ? 'bulletproof vest' : GUNS[id].name;
