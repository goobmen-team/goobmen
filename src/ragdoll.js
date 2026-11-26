// ======================================================================= ragdolls
// A knocked-out caveman is a bag of points at his joints, held together by his bone lengths, with knees and
// elbows that only bend the right way. He falls from whatever he was doing, shoved by whatever hit him, so no
// two falls are the same. Afterwards he can be shoved, shot, blown up and dragged around (hold X).
// The skeleton is then turned to follow the points.

const RAG_PTS = ['hips', 'spine', 'chest', 'neck', 'head', 'top', 'upperArm_L', 'foreArm_L', 'hand_L', 'upperArm_R', 'foreArm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
const RP = {}; RAG_PTS.forEach((n, i) => { RP[n] = i; });
const TOP = [0, 0.22, 0.03];                                  // a made-up point on top of the head, for which way it faces
const RAD = { hips: 0.15, spine: 0.16, chest: 0.17, neck: 0.09, head: 0.12, top: 0.1, hand_L: 0.05, hand_R: 0.05, foot_L: 0.06, foot_R: 0.06, toe_L: 0.04, toe_R: 0.04 };
let ragDef = null;
function ragRest(n) { return n === 'top' ? V.add(Rig.rest[IDX.head], TOP) : Rig.rest[IDX[n]]; }
function ragSetup() {
  if (ragDef) return ragDef;
  const links = [], d = (a, b) => V.len(V.sub(ragRest(a), ragRest(b)));
  const link = (a, b, lo, hi) => { const L = d(a, b); links.push([RP[a], RP[b], L * (lo || 1), L * (hi || lo || 1)]); };
  // the trunk is one stiff piece
  const trunk = ['hips', 'spine', 'chest', 'neck', 'upperArm_L', 'upperArm_R', 'thigh_L', 'thigh_R'];
  for (let i = 0; i < trunk.length; i++) for (let j = i + 1; j < trunk.length; j++) link(trunk[i], trunk[j]);
  // a neck that nods and turns a bit
  link('neck', 'head'); link('head', 'top'); link('neck', 'top'); link('chest', 'head', 0.85, 1.05); link('chest', 'top', 0.82, 1.03);
  for (const s of ['L', 'R']) {
    link('upperArm_' + s, 'foreArm_' + s); link('foreArm_' + s, 'hand_' + s);
    link('upperArm_' + s, 'hand_' + s, 0.3, 1);                // elbows bend, but not past the shoulder
    link('thigh_' + s, 'shin_' + s); link('shin_' + s, 'foot_' + s); link('foot_' + s, 'toe_' + s);
    link('shin_' + s, 'toe_' + s, 0.88, 1.06);                  // ankles flex a little
    link('thigh_' + s, 'foot_' + s, 0.4, 1);                    // knees bend, but not through the thigh
    link('hips', 'foot_' + s, 0.35, 1.25);
  }
  link('thigh_L', 'shin_R', 0.45, 3); link('thigh_R', 'shin_L', 0.45, 3);   // legs don't pass through each other
  link('shin_L', 'shin_R', 0.7, 6);
  ragDef = { links, rad: RAG_PTS.map(n => RAD[n] || 0.07) };
  return ragDef;
}

// world position of a ragdoll point on the body as it is posed right now
function liveRagPoint(f, n) {
  if (n === 'top') return toWorld(f, V.add(f.wp[IDX.head], M3.vec(f.wr[IDX.head], TOP)));
  return bonePos(f, n);
}
// h: the step size the points move with (velocity is position minus last position)
const RAG_H = 1 / 120;
function ragStart(f, v0) {
  ragSetup();
  const p = RAG_PTS.map(n => liveRagPoint(f, n));
  const v = p.map(() => (v0 || [0, 0, 0]).slice());
  f.rag = { p, q: p.map((x, i) => V.sub(x, V.mul(v[i], RAG_H))), still: 0, sleep: false, thudAt: 0, grab: -1, held: false };
}
// the blow that knocks him out: a shove from where it came from, a bit of a spin, legs giving way. Never the same twice.
function ragKnock(f) {
  const hit = f.lastHit || {};
  const walk = f.vel ? [f.vel[0], 0, f.vel[1]] : [0, 0, 0];
  ragStart(f, walk);
  const R = f.rag, from = hit.from || V.add(f.pos, [rand(-1, 1), 0, rand(-1, 1)]);
  let dir = V.sub(f.pos, from); dir[1] = 0; dir = V.norm(dir);
  if (V.len(dir) < 0.5) dir = V.norm([rand(-1, 1), 0, rand(-1, 1)]);
  const blast = !!hit.blast, k = blast ? 5 + hit.amount * 0.03 : 0.8 + Math.min(4, (hit.amount || 30) * 0.035);
  const side = [dir[2], 0, -dir[0]], twist = rand(-1, 1), wobble = rand(0.4, 1.2);
  for (let i = 0; i < RAG_PTS.length; i++) {
    const n = RAG_PTS[i], y = R.p[i][1] - f.pos[1];
    let dv = V.mul(dir, k * (blast ? rand(0.8, 1.2) : clamp(y / 1.4, 0.15, 1.2)));   // high hits tip him over
    if (blast) dv[1] += rand(3.5, 6) + hit.amount * 0.02;
    if (hit.head && (n === 'head' || n === 'top' || n === 'neck')) dv = V.mad(dv, dir, 2.5);
    dv = V.mad(dv, side, twist * y * 1.2);                         // turns as he goes
    if (n.startsWith('shin') || n.startsWith('thigh')) dv = V.add(dv, V.mul([-dir[0], -0.6, -dir[2]], wobble));   // knees buckle
    dv = V.add(dv, [rand(-0.4, 0.4), rand(-0.2, 0.3), rand(-0.4, 0.4)]);
    R.q[i] = V.sub(R.q[i], V.mul(dv, RAG_H));
  }
  f.lastHit = null;
}
// give one point (and a little of its neighbours) a kick
function ragPush(f, at, dv, radius) {
  const R = f.rag; if (!R) return;
  for (let i = 0; i < R.p.length; i++) {
    const d = V.len(V.sub(R.p[i], at)), k = clamp(1 - d / (radius || 0.6), 0, 1);
    if (k > 0) R.q[i] = V.sub(R.q[i], V.mul(dv, RAG_H * k));
  }
  R.sleep = false; R.still = 0;
}
// an explosion: every point thrown away from it and up, harder the closer it is
function ragBlast(f, c, radius) {
  const R = f.rag; if (!R || f.scriptW > 0.01) return;
  for (let i = 0; i < R.p.length; i++) {
    const d = V.sub(R.p[i], c), len = V.len(d), k = clamp(1 - len / radius, 0, 1);
    if (k <= 0) continue;
    const dv = V.add(V.mul(V.norm([d[0], 0, d[2]]), 9 * k + rand(-1, 1)), [0, 7 * k + rand(0, 2), 0]);
    R.q[i] = V.sub(R.q[i], V.mul(dv, RAG_H));
  }
  R.sleep = false; R.still = 0;
}
function ragWake(f) { if (f.rag) { f.rag.sleep = false; f.rag.still = 0; } }

function ragStep(f, dt) {
  const R = f.rag, def = ragSetup(), n = R.p.length, h = RAG_H;
  // drag: one point is pulled toward a spot in front of the player
  const drag = dragging && dragging.f === f ? dragging : null;
  if (drag || R.pin) { R.sleep = false; R.still = 0; }
  if (R.sleep) return;
  R.acc = (R.acc || 0) + dt;
  let fall = 0;
  while (R.acc >= h) {
    R.acc -= h;
    for (let i = 0; i < n; i++) {                                 // move, with gravity and a little air
      const p = R.p[i], q = R.q[i], v = V.mul(V.sub(p, q), 0.996);
      R.q[i] = p; R.p[i] = [p[0] + v[0], p[1] + v[1] - 9.8 * h * h, p[2] + v[2]];
    }
    for (let it = 0; it < 7; it++) {
      for (const [a, b, lo, hi] of def.links) {                   // bone lengths, and the bend limits
        const pa = R.p[a], pb = R.p[b], d = V.sub(pb, pa), len = V.len(d) || 1e-6;
        const want = len < lo ? lo : len > hi ? hi : len;
        if (want === len) continue;
        const k = (len - want) / len * 0.5;
        R.p[a] = V.mad(pa, d, k); R.p[b] = V.mad(pb, d, -k);
      }
      hinges(R);
      if (drag) { const g = R.p[drag.pt], to = drag.to; R.p[drag.pt] = V.lerp(g, to, 0.35); }
      if (R.pin) R.p[R.pin.pt] = V.lerp(R.p[R.pin.pt], R.pin.to, R.pin.k || 0.35);     // someone holding a hand or a foot
      for (let i = 0; i < n; i++) {                               // the ground, and the things standing on it
        const p = R.p[i], r = def.rad[i], g = floorAt(p[0], p[2], p[1]) + r;
        if (p[1] < g) {
          const sink = R.q[i][1] - p[1];
          if (sink > fall) fall = sink;
          p[1] = g;
          // friction: most of the sideways slide since last step is undone
          const q = R.q[i]; q[0] += (p[0] - q[0]) * 0.18; q[2] += (p[2] - q[2]) * 0.18;
        }
        if (world.map === 'island') for (const s of solidsNear(p[0], p[2])) {
          if (p[1] > s.y + s.h) continue;
          const e = edgeOf(s, p[0], p[2]);
          if (e.d >= r) continue;
          let dx = p[0] - e.at[0], dz = p[2] - e.at[1], l = Math.hypot(dx, dz) || 1;
          if (e.d < 0) { dx = -dx; dz = -dz; }
          p[0] += dx / l * (r - e.d); p[2] += dz / l * (r - e.d);
        }
      }
    }
  }
  // thumps when he lands hard
  const speed = fall / h;
  if (speed > 2.2 && game.time - R.thudAt > 0.18) {
    R.thudAt = game.time;
    const vol = clamp(speed / 7, 0.15, 1) * (f.isPlayer ? 1 : 0.6) * clamp(1.4 - V.len(V.sub(R.p[0], player.pos)) / 30, 0.1, 1);
    Sound.play('thud', vol);
    if (speed > 3.5) puff([R.p[0][0], floorAt(R.p[0][0], R.p[0][2], R.p[0][1]) + 0.05, R.p[0][2]], 10, [0.52, 0.50, 0.46, 0.7], 1.0, 0.07, 0.5, 1.2);
  }
  // fall asleep once he has stopped moving
  let move = 0; for (let i = 0; i < n; i++) move = Math.max(move, V.len(V.sub(R.p[i], R.q[i])) / h);
  R.still = move < 0.06 ? R.still + dt : 0;
  if (R.still > 0.6 && !drag && !R.pin) R.sleep = true;
  // where the game thinks the body is: feet end on the ground, lying head-ward along "back"
  const H = R.p[RP.hips], C = R.p[RP.neck];
  let back = [C[0] - H[0], 0, C[2] - H[2]];
  if (Math.hypot(back[0], back[2]) > 0.05) { back = V.norm(back); f.yaw = Math.atan2(-back[0], -back[2]); }
  else back = [-Math.sin(f.yaw), 0, -Math.cos(f.yaw)];
  const x = H[0] - back[0] * 0.72, z = H[2] - back[2] * 0.72;
  f.pos = [x, floorAt(x, z, H[1]), z];
}
// knees bend forward, elbows bend back: if one went the wrong way, fold it back
function hinges(R) {
  const P = R.p, up = V.sub(P[RP.neck], P[RP.hips]), side = V.sub(P[RP.thigh_L], P[RP.thigh_R]);
  const fwd = V.norm(V.cross(side, up));                          // the way his belly faces
  for (const s of ['L', 'R']) {
    for (const [a, b, c, sign] of [['thigh_', 'shin_', 'foot_', 1], ['upperArm_', 'foreArm_', 'hand_', -1]]) {
      const A = P[RP[a + s]], B = P[RP[b + s]], C = P[RP[c + s]], mid = V.lerp(A, C, 0.5);
      const off = V.dot(V.sub(B, mid), fwd) * sign;
      if (off < 0) { P[RP[b + s]] = V.mad(B, fwd, -off * sign * 0.6); P[RP[c + s]] = V.mad(C, fwd, off * sign * 0.2); }
    }
  }
}

// turn the skeleton to follow the points; everything in world space (the body's own transform is then identity)
function ragPose(f) {
  const P = f.rag.p, wr = f.wr, wp = f.wp, at = n => P[RP[n]], rest = ragRest;
  const fix = {};
  const restSide = V.sub(rest('upperArm_L'), rest('upperArm_R')), side = V.sub(at('upperArm_L'), at('upperArm_R'));
  const restLegs = V.sub(rest('thigh_L'), rest('thigh_R')), legs = V.sub(at('thigh_L'), at('thigh_R'));
  const aim = (bone, a, b, rs, cs) => { fix[IDX[bone]] = M3.frame(V.sub(rest(b), rest(a)), rs, V.sub(at(b), at(a)), cs); };
  aim('hips', 'hips', 'spine', restLegs, legs);
  aim('spine', 'spine', 'chest', restSide, V.lerp(legs, side, 0.5));
  aim('chest', 'chest', 'neck', restSide, side);
  aim('neck', 'neck', 'head', restSide, side);
  aim('head', 'head', 'top', restSide, side);
  const chestR = fix[IDX.chest], hipsR = fix[IDX.hips];
  for (const s of ['L', 'R']) {
    aim('upperArm_' + s, 'upperArm_' + s, 'foreArm_' + s, [0, 0, 1], M3.vec(chestR, [0, 0, 1]));
    aim('foreArm_' + s, 'foreArm_' + s, 'hand_' + s, [0, 0, 1], M3.vec(fix[IDX['upperArm_' + s]], [0, 0, 1]));
    aim('thigh_' + s, 'thigh_' + s, 'shin_' + s, [1, 0, 0], M3.vec(hipsR, [1, 0, 0]));
    aim('shin_' + s, 'shin_' + s, 'foot_' + s, [1, 0, 0], M3.vec(fix[IDX['thigh_' + s]], [1, 0, 0]));
    aim('foot_' + s, 'foot_' + s, 'toe_' + s, [1, 0, 0], M3.vec(fix[IDX['shin_' + s]], [1, 0, 0]));
  }
  for (let i = 0; i < NB; i++) {
    const p = Rig.parent[i];
    if (p < 0) { wr[i] = M3.id(); wp[i] = V.sub(at('hips'), Rig.offset[IDX.hips]); continue; }
    wp[i] = V.add(wp[p], M3.vec(wr[p], Rig.offset[i]));
    const name = Rig.names[i];
    if (fix[i]) wr[i] = fix[i];
    else if (name.startsWith('fingers') || name.startsWith('fingerTips')) wr[i] = M3.mul(wr[p], M3.rz(name.endsWith('R') ? 0.45 : -0.45));
    else wr[i] = wr[p];                                           // hands, clavicles, toes, skirt: go along with their parent
  }
}

// ---------------------------------------------------------------- running them all
let dragging = null;                                            // { f, pt, to }
function ragsStep(dt) {
  dragStep();
  for (const f of fighters) {
    if (f.dead < 0 || f.gone) { f.rag = null; continue; }
    if (!f.rag) { ragKnock(f); continue; }
    // while someone is handling him (looting, balloons), the animation owns the body; let go and he falls from there
    if (f.scriptW > 0.01) { f.rag.held = true; continue; }
    if (f.rag.held) { ragStart(f); f.rag.held = false; }
    ragStep(f, dt);
    // walking into a body shoves it along
    if (player.dead < 0 && f !== player) {
      const P = f.rag.p, pv = player.vel ? [player.vel[0], 0, player.vel[1]] : [0, 0, 0];
      for (let i = 0; i < P.length; i++) {
        const dx = P[i][0] - player.pos[0], dz = P[i][2] - player.pos[2], d = Math.hypot(dx, dz), y = P[i][1] - player.pos[1];
        if (d < 0.38 && y > -0.1 && y < 1.7 && d > 1e-4) {
          const push = (0.38 - d) / d;
          P[i][0] += dx * push * 0.5; P[i][2] += dz * push * 0.5;
          f.rag.q[i] = V.sub(f.rag.q[i], V.mul(pv, RAG_H * 0.3));
          ragWake(f);
        }
      }
    }
  }
}
// hold X near a body: grab a hand, a foot or the head and drag him along
function dragTarget() {
  if (player.dead >= 0 || looting) return null;
  let best = null, bestD = 1.6;
  for (const f of bots) {
    if (!f.rag || f.dead < 0 || f.gone || f.send || f.beingLooted) continue;
    for (const n of ['hand_L', 'hand_R', 'foot_L', 'foot_R', 'head']) {
      const p = f.rag.p[RP[n]], d = Math.hypot(p[0] - player.pos[0], p[2] - player.pos[2]);
      if (d < bestD) { bestD = d; best = { f, pt: RP[n] }; }
    }
  }
  return best;
}
function dragStep() {
  const want = keys.has('KeyX') && game.running;
  if (!want || player.dead >= 0 || looting) { if (dragging) { ragWake(dragging.f); dragging = null; player.carry = player.holdC4 ? player.carry : null; } return; }
  if (!dragging) { const t = dragTarget(); if (!t) return; dragging = t; Sound.play('thud', 0.3); }
  const f = dragging.f;
  if (f.dead < 0 || f.gone || f.send || f.beingLooted || !f.rag) { dragging = null; return; }
  // the spot in his hand, a little in front and down
  const fwd = [Math.sin(player.yaw), 0, Math.cos(player.yaw)], side = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
  dragging.to = V.add(V.add(player.pos, V.mul(fwd, 0.55)), V.add(V.mul(side, -0.12), [0, 0.75, 0]));
  if (!player.weapon && !player.holdC4) player.carry = { R: hand(V.add([-0.12, 0.75, 0.55], [0, 0, 0]), [0, -0.6, 1], [0, -1, 0], [-1, -0.5, -0.3], 1.2) };
}
// a body in the way of a bullet or a punch: the nearest point along the ray
function rayBody(origin, dir, maxT) {
  let best = null;
  for (const f of fighters) {
    if (!f.rag || f.dead < 0 || f.gone || f.scriptW > 0.5) continue;
    const P = f.rag.p, def = ragSetup();
    for (let i = 0; i < P.length; i++) {
      const oc = V.sub(P[i], origin), t = V.dot(oc, dir);
      if (t < 0 || t > (best ? best.t : maxT)) continue;
      const r = def.rad[i] + 0.04, q = V.dot(oc, oc) - t * t;
      if (q <= r * r) best = { t: t - Math.sqrt(r * r - q), f, pt: i };
    }
  }
  return best;
}
