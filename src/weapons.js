// ======================================================================= the caveman reload
// He has no idea how this works. He yanks the magazine out, sniffs it, bites it like a coin to see if it is any good,
// shakes it by his ear, decides it is broken and throws it over his shoulder. He gets a fresh one, tries to jam it in
// sideways, stares, turns it round, slams it in, smacks the gun twice to make it work, and racks it.
// Shells and grenades get the sniff and the bite too, then go in one at a time. Times are fractions of the reload.
const RL = { reach: 0.07, out: 0.13, up: 0.2, sniff: 0.29, bite: 0.38, shake: 0.45, toss: 0.5, belt: 0.57, wrong: 0.65, flip: 0.71, seat: 0.78, smack: 0.86, rack: 0.93 };
const LITTER = 10, BIG = 1.5;                                                   // seconds a thrown magazine stays on the floor

const reloadAt = f => f.reload >= 0 && f.weapon ? f.reload / GUNS[f.weapon].reload : -1;
// how much he is busy with the thing in his hand rather than the gun (the gun sags, his head cocks)
const peerAmount = f => { const t = reloadAt(f); return t < 0 ? 0 : smooth(RL.out, RL.up, t) * (1 - smooth(RL.shake, RL.toss, t)); };
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
  return { wrist: V.lerp(a.wrist, b.wrist, w), dir, palm: V.orth(V.lerp(a.palm, b.palm, w), dir), pole: b.pole, curl: [a.curl[0] + (b.curl[0] - a.curl[0]) * w, a.curl[1] + (b.curl[1] - a.curl[1]) * w] };
}
// where the free hand is during a reload, and what it is holding. everything is in the fighter's own space
function reloadPose(f, g, G, rest, chest) {
  const t = reloadAt(f), I = g.item, u = (a, b) => smooth(a, b, t), mag = I.kind === 'mag';
  const shift = V.sub(chest, Rig.rest[IDX.chest]);
  const eye = V.add([-0.01, 1.53, 0.12], shift);
  const nose = V.add(eye, [0, -0.05, 0.14]), mouth = V.add(eye, [0, -0.12, 0.13]), ear = V.add(eye, [0.17, -0.02, -0.02]);
  const atGun = onGun(G, I.grab), pulled = onGun(G, V.add(I.grab, I.pull));
  const gunDir = V.norm(M3.vec(G.R, [-0.5, 0.35, 0.8])), gunPalm = V.norm(M3.vec(G.R, [-0.4, 0.8, 0]));
  const upDir = V.norm([-0.35, 0.9, 0.25]), upPalm = [-1, -0.1, 0];
  // the hand cupped round whatever is at q; k turns it from the gun's angle to holding something up to his face
  const holding = (q, k) => {
    const dir = V.norm(V.lerp(gunDir, upDir, k)), palm = V.orth(V.lerp(gunPalm, upPalm, k), dir);
    return { wrist: V.add(V.add(q, V.mul(dir, -0.09)), V.mul(palm, -0.037)), dir, palm, pole: [0.8, -1, 0.1], curl: [0.9, 0.95] };
  };
  // held up to his face, open end towards him
  const toFace = V.norm(V.sub(nose, V.add(nose, [-0.12, -0.05, 0.22])));
  const faceR = M3.frame(I.mouth, [1, 0, 0], toFace, [1, 0, 0]);
  const sideways = M3.mul(G.R, M3.rx(Math.PI / 2));                 // the new one, the wrong way round: lying along the barrel
  const wind = V.add(eye, [0.28, 0.2, -0.22]), belt = V.add(chest, [0.24, -0.2, 0.08]);
  const smackAt = onGun(G, [0.075, 0.02, 0.06]);

  let p = null, k = 0, R = G.R, show = false, hand = null;
  if (t < RL.reach) hand = mixGoal(rest, holding(atGun, 0), u(0, RL.reach));
  else if (t < RL.out) { p = V.lerp(atGun, pulled, u(RL.reach, RL.out)); show = true; }                       // yank
  else if (t < RL.up) { const w = u(RL.out, RL.up); p = V.lerp(pulled, nose, w); R = M3.mix(G.R, faceR, w); k = w; show = true; }
  else if (t < RL.sniff) {                                                                                  // snf snf
    const w = (t - RL.up) / (RL.sniff - RL.up);
    p = V.add(nose, [0.02 * Math.sin(w * 30), 0.012 * Math.sin(w * 47), 0]); R = faceR; k = 1; show = true;
  } else if (t < RL.bite) {                                                                                 // a bite, like a coin
    const w = (t - RL.sniff) / (RL.bite - RL.sniff), chomp = Math.max(0, Math.sin(w * Math.PI * 2)) * 0.03;
    p = V.lerp(nose, V.add(mouth, [0, 0, -chomp]), smooth(0, 0.3, w)); R = M3.mul(faceR, M3.rz(0.4 * smooth(0, 0.3, w))); k = 1; show = true;
  } else if (t < RL.shake) {                                                                                // shake it by his ear: rattle?
    const w = (t - RL.bite) / (RL.shake - RL.bite);
    p = V.add(V.lerp(mouth, ear, smooth(0, 0.35, w)), [0, 0.035 * Math.sin(w * 40) * smooth(0.25, 0.4, w), 0]); R = faceR; k = 1; show = true;
  } else if (t < RL.toss) { const w = u(RL.shake, RL.toss); p = V.lerp(ear, wind, w); R = M3.mul(faceR, M3.rx(-1.2 * w)); k = 1; show = true; }   // nah: over the shoulder
  else if (t < RL.belt) { const w = u(RL.toss, RL.belt); p = V.lerp(wind, belt, w); k = 1 - w; }
  else if (!mag) {                                                                                         // shells and grenades go in one at a time
    if (t < RL.smack) {
      const v = (t - RL.belt) / (RL.smack - RL.belt), i = Math.min(2, Math.floor(v * 3)), w = v * 3 - i;
      if (w < 0.55) { p = V.lerp(belt, atGun, smooth(0, 0.55, w)); show = true; }
      else p = i === 2 || w < 0.7 ? atGun : V.lerp(atGun, belt, smooth(0.7, 1, w));
    } else hand = mixGoal(holding(atGun, 0), rest, u(RL.smack, 0.91));
  } else if (t < RL.wrong) {                                                                               // jams it in sideways. it won't go.
    const w = u(RL.belt, RL.wrong - 0.02), bump = t > RL.wrong - 0.03 ? 0.012 * Math.sin((t - RL.wrong) * 260) : 0;
    p = V.add(V.lerp(belt, pulled, w), [0, bump, 0]); R = M3.mix(G.R, sideways, smooth(0, 0.5, w)); show = true;
  } else if (t < RL.flip) {                                                                                // stares... turns it round
    const w = (t - RL.wrong) / (RL.flip - RL.wrong), spin = smooth(0.3, 0.9, w);
    p = V.add(pulled, [0, -0.05 * Math.sin(Math.PI * spin), 0]);
    R = M3.mul(G.R, M3.rx(Math.PI / 2 * (1 - spin))); show = true;
  } else if (t < RL.seat) { const w = u(RL.flip, RL.seat - 0.02); p = V.lerp(pulled, atGun, w * w); show = true; }   // SLAM
  else if (t < RL.smack) {                                                                                 // smack, smack: that will make it work
    const w = (t - RL.seat) / (RL.smack - RL.seat), hit = Math.abs(Math.sin(w * Math.PI * 2));
    const off = V.mad(smackAt, V.norm(M3.vec(G.R, [1, 0.2, 0])), 0.1 * (1 - hit));
    hand = { wrist: off, dir: V.norm(M3.vec(G.R, [-0.2, 0.3, 1])), palm: V.norm(M3.vec(G.R, [-1, 0, 0])), pole: [0.8, -1, 0.1], curl: [0.2, 0.2] };
  } else if (g.boltAction || g.pumpAction || g.drumLoad) hand = mixGoal(holding(atGun, 0), rest, u(RL.smack, g.boltAction ? 1 : 0.91));
  else {                                                                                                   // pull the charging handle
    const knob = holding(onGun(G, g.boltPoint), 0), back = holding(onGun(G, V.add(g.boltPoint, [0, 0, -g.boltTravel])), 0);
    hand = t < 0.93 ? mixGoal(holding(atGun, 0), knob, u(RL.smack, 0.93)) : t < 0.975 ? mixGoal(knob, back, u(0.93, 0.955)) : mixGoal(back, rest, u(0.975, 1));
  }
  return { hand: hand || holding(p, k), item: show ? { p, R, out: V.mul(toFace, 0.045 * k) } : null };
}

// the bits of a reload that happen once: sounds, words, the throw
function reloadCues(f, g, t0, t) {
  const loud = f.isPlayer ? 0.9 : 0.2, crossed = at => t0 < at && t >= at, mag = g.item.kind === 'mag';
  const near = f.isPlayer || V.len(V.sub(f.pos, player.pos)) < 22;
  const cue = (at, s, v) => { if (crossed(at)) Sound.play(s, loud * (v || 1)); };
  const word = (at, text, life) => { if (crossed(at) && near) popWord(V.add(bonePos(f, 'head'), [0, 0.42, 0]), text, life); };
  cue(RL.reach, mag ? 'magout' : 'shellin');
  cue(RL.up + 0.01, 'sniff'); word(RL.up + 0.01, 'snf snf?', g.reload * (RL.sniff - RL.up) + 0.2);
  cue(RL.sniff + (RL.bite - RL.sniff) * 0.25, 'chomp'); word(RL.sniff + (RL.bite - RL.sniff) * 0.25, 'CRONCH', 0.45);
  for (let i = 0; i < 3; i++) cue(RL.bite + (RL.shake - RL.bite) * (0.4 + i * 0.18), 'click', 0.6);
  if (crossed(RL.toss)) { tossItem(f, g); Sound.play('whoosh', loud * 0.5); }
  if (mag) {
    cue(RL.wrong - 0.02, 'bonk', 0.5); word(RL.wrong - 0.02, '?', 0.5);
    cue(RL.seat - 0.02, 'magin'); cue(RL.seat - 0.015, 'thud', 0.6);
    for (const w of [0.25, 0.75]) cue(RL.seat + (RL.smack - RL.seat) * w, 'punch', 0.45);
  } else for (let i = 0; i < 3; i++) if (crossed(RL.belt + (RL.smack - RL.belt) * (i + 0.55) / 3)) { Sound.play('shellin', loud); if (g.drumLoad) f.drumT += Math.PI / 3; }
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
  const kind = g.item.kind, v = M3.vec(M3.ry(f.yaw), [rand(0.4, 1.0), rand(1.6, 2.6), rand(-1.4, -2.2)]);   // over his shoulder
  const at = kind === 'mag' ? V.add(it.p, M3.vec(it.S, V.sub(g.magMid, g.item.grab))) : it.p;
  spawnProp(kind, at, v, { gun: it.gun, life: LITTER, scale: kind === 'mag' ? 1 : BIG, spin: rand(6, 11), R: it.R.slice() });
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
const CHEST_COLOURS = { ak: [0.75, 0.45, 0.08], awp: [0.10, 0.28, 0.08], glock: [0.30, 0.32, 0.35], mp5: [0.06, 0.16, 0.55], p90: [0.34, 0.07, 0.50], shotgun: [0.55, 0.05, 0.03], mgl: [0.80, 0.22, 0.01], vest: [0.025, 0.03, 0.025] };
