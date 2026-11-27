// ======================================================================= jumping
// A natural jump: a quick dip with the arms swinging back, a push off with the arms swinging forward and up to chest
// height, the knees drawn up a little at the top, legs reaching for the ground, and a soft knees-bent landing.
// Running, it is a stride: lead knee up, back leg trailing, arms swinging the other way.
const JUMP = { speed: 3.9, gravity: 12.5, pre: 0.12, preMoving: 0.05, land: 0.3, landMoving: 0.18 };
JUMP.air = 2 * JUMP.speed / JUMP.gravity;
function startJump(f) {
  if (f.jump >= 0 || f.dead >= 0) return;
  f.crouch = false; f.jump = 0; f.jumpMoving = f.speed > 0.3; f.jumpBack = f.back;
}
function jumpTimes(f) {
  const pre = f.jumpMoving ? JUMP.preMoving : JUMP.pre, land = f.jumpMoving ? JUMP.landMoving : JUMP.land;
  return { pre, land, down: pre + JUMP.air, end: pre + JUMP.air + land };
}
function jumpStep(f, dt) {
  if (f.dead >= 0) { f.jump = -1; f.air = Math.max(0, f.air - dt * 3); return; }
  if (f.jump < 0) { f.air = 0; return; }
  const T = jumpTimes(f), t0 = f.jump;
  f.jump += dt;
  const tau = f.jump - T.pre;
  f.air = tau > 0 && tau < JUMP.air ? JUMP.speed * tau - JUMP.gravity * tau * tau / 2 : 0;
  const crossed = at => t0 < at && f.jump >= at, mine = f.isPlayer;
  if (crossed(T.pre)) { Sound.play('hup', mine ? 0.8 : 0.2); puff([f.pos[0], f.pos[1] + 0.04, f.pos[2]], 6, [0.52, 0.50, 0.46, 0.55], 0.7, 0.05, 0.35, 1); }
  if (crossed(T.down)) {
    Sound.play('land', mine ? 0.8 : 0.2); puff([f.pos[0], f.pos[1] + 0.04, f.pos[2]], 12, [0.52, 0.50, 0.46, 0.65], 1.0, 0.065, 0.45, 1);
    f.riseV -= 2.2;                                            // the gun dips with the landing
    if (mine) cam.shake = Math.max(cam.shake, 0.3);
  }
  if (f.jump >= T.end) f.jump = -1;
}
// how the body is shaped this frame: null when not jumping
function jumpShape(f) {
  if (f.jump < 0 || f.dead >= 0) return null;
  const T = jumpTimes(f), t = f.jump, A = JUMP.air, P = T.pre, D = T.down, E = T.end, moving = f.jumpMoving, way = f.jumpBack ? -1 : 1;
  const w = smooth(0, 0.04, t) * (1 - smooth(E - 0.08, E, t));
  const at = k => P + A * k;                                       // a moment in the air, 0 to 1
  const shape = {
    w,
    drop: flow([[0, 0], [P, moving ? -0.05 : -0.12], [at(0.12), 0.02], [at(0.85), 0.01], [D, 0], [D + 0.07, moving ? -0.07 : -0.13], [E, 0]], t),
    bend: flow([[0, 0], [P, moving ? 0.15 : 0.3], [at(0.15), 0.02], [at(0.5), 0.1], [D, 0.05], [D + 0.07, moving ? 0.2 : 0.32], [E, 0]], t),
    head: flow([[0, 0], [P, -0.08], [at(0.2), 0.06], [at(0.8), -0.04], [D + 0.07, -0.1], [E, 0]], t),
    legs: {}, arms: {}
  };
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    const rest = Rig.rest[IDX['foot_' + s]], lead = s === 'L';
    let up, fwd, toe;
    if (moving) {                                                  // stride
      up = flow([[P, 0], [at(0.3), lead ? 0.26 : 0.18], [at(0.6), lead ? 0.24 : 0.2], [at(0.95), lead ? 0.06 : 0.1], [D, 0]], t);
      fwd = way * flow([[P, 0], [at(0.3), lead ? 0.28 : -0.3], [at(0.7), lead ? 0.24 : -0.22], [D, lead ? 0.08 : -0.06], [E, 0]], t);
      toe = flow([[P, 0.5], [at(0.3), lead ? -0.1 : 0.9], [at(0.8), 0.1], [D, 0], [E, 0]], t);
    } else {                                                       // knees drawn up a little, one more than the other
      up = flow([[P, 0], [at(0.12), -0.02], [at(0.45), lead ? 0.2 : 0.15], [at(0.62), lead ? 0.18 : 0.14], [at(0.92), 0.02], [D, 0]], t);
      fwd = flow([[P, 0], [at(0.45), lead ? 0.08 : 0.03], [at(0.9), 0.02], [D, 0]], t);
      toe = flow([[0, 0], [P, 0], [at(0.12), 0.7], [at(0.45), 0.25], [at(0.85), 0.25], [D, 0]], t);
    }
    const spread = flow([[0, 0], [D, 0], [D + 0.07, 0.04], [E, 0]], t);
    shape.legs[s] = { ankle: V.add(rest, [x * spread, up, fwd]), foot: M3.rx(toe), pole: [x * 0.3, 0, 1] };
    // arms, by their joints: relaxed, back on the dip, swung forward and up as he goes, out a little at the top, forward and
    // bent for the landing. Running, they swing opposite the legs.
    const K = (ab, sw, el, wf) => ({ ab, sw, el, wf, tw: 0.15 });
    let keys;
    if (moving) {
      const o = (lead ? -1 : 1) * way;                                // the arm opposite the lead leg goes forward
      keys = [[0, K(0.15, 0.05, 0.4, 0)], [P, K(0.18, 0.1 * o, 0.55, 0)], [at(0.22), K(0.3, 0.75 * o + 0.1, 0.8, 0.1)], [at(0.6), K(0.55, 0.35 * o + 0.1, 0.6, 0)], [D, K(0.6, 0.15, 0.45, 0)], [D + 0.08, K(0.3, 0.35, 0.7, 0)], [E, K(0.15, 0.05, 0.4, 0)]];
    } else {
      keys = [[0, K(0.15, 0.05, 0.3, 0)], [P, K(0.22, -0.6, 0.25, -0.1)], [at(0.14), K(0.3, 0.95, 0.45, 0.1)], [at(0.42), K(0.75, 0.3, 0.4, 0)], [at(0.82), K(0.8, 0.15, 0.3, 0)], [D + 0.07, K(0.35, 0.4, 0.65, 0.1)], [E, K(0.15, 0.05, 0.3, 0)]];
    }
    const fk = {};
    for (const key of ['ab', 'sw', 'el', 'wf', 'tw']) fk[key] = flow(keys.map(([kt, kv]) => [kt, kv[key]]), t);
    shape.arms[s] = { fk, curl: [0.75, 0.8] };
  }
  return shape;
}

// ======================================================================= collapsing
// knees give way, then he flops onto his back. the last frame is a straight lie, so looting lines up
function collapsePose(f) {
  const d = f.dead;
  const stiff = smooth(0, 0.1, d) * (1 - smooth(0.14, 0.3, d));
  const buckle = smooth(0.12, 0.55, d);
  const flop = Math.pow(clamp((d - 0.5) / 0.5, 0, 1), 1.8);
  const bounce = d > 1.0 && d < 1.2 ? Math.sin((d - 1.0) / 0.2 * Math.PI) : 0;
  const kneel = buckle * (1 - flop);
  const hips0 = Rig.rest[IDX.hips];
  const S = {
    hips: V.add(hips0, [0.04 * kneel, -0.40 * kneel, -0.20 * kneel]),
    bend: -0.3 * stiff + 0.75 * kneel - 0.12 * bounce, tilt: 0.28 * kneel, twist: 0.2 * kneel,
    head: M3.mul(M3.rz(0.45 * buckle), M3.rx(-0.5 * stiff + 0.7 * kneel - 0.1 * flop + 0.25 * bounce)),
    arms: {}, legs: {}
  };
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    const limp = hand([x * 0.40, 0.66, 0.08], [x * 0.1, -1, 0.15], [-x, 0, 0], [x * 0.4, 0, -1], 0.3).wrist;
    const jerk = [x * 0.62, 1.45, 0.05];
    const sprawl = [x * 0.82, x > 0 ? 1.22 : 0.94, -0.13];
    let wrist = V.lerp(limp, jerk, stiff);
    wrist = V.lerp(wrist, [x * 0.46, 0.42, 0.12], kneel);
    wrist = V.add(V.lerp(wrist, sprawl, flop), [0, 0, 0.12 * bounce]);
    S.arms[s] = { wrist, dir: V.norm(V.lerp([x * 0.15, -1, 0.1], [x, -0.2, 0], flop)), palm: V.norm(V.lerp([-x, 0, 0], [0, 0, 1], flop)), pole: [x * 0.6, 0, -1], curl: [0.35, 0.35] };
    S.legs[s] = { ankle: V.add(Rig.rest[IDX['foot_' + s]], [x * 0.04 * buckle, 0, 0]), pole: [x * 0.35, 0, 1] };
  }
  const R = M3.mul(M3.ry(f.yaw), M3.rx(-1.5 * flop + 0.07 * bounce));
  return { S, R, p: [f.pos[0], f.pos[1] + f.air + 0.2 * flop, f.pos[2]] };
}
function deathCues(f, prev) {                                  // the thumps and dust come from the ragdoll hitting the ground
  const crossed = at => prev < at && f.dead >= at, loud = f.isPlayer ? 1 : 0.55;
  if (crossed(0.02)) Sound.play('ugh', loud);
}

// ======================================================================= the balloon send-off
const LOOT_WINDOW = 30;                      // seconds a body waits to be looted; after that he turns up with a bomb instead
const FUSE = 10, FUSE_AT = 3.4;              // the bomb's timer, and when in the visit it gets lit
const sends = [], helpers = [];
const BALLOONS = [
  { bone: 'hand_L', color: [0.85, 0.02, 0.02], out: [0.34, 0.0], len: 0.78 },
  { bone: 'hand_R', color: [0.02, 0.16, 0.85], out: [-0.34, 0.0], len: 0.86 },
  { bone: 'foot_L', color: [0.95, 0.60, 0.0], out: [0.22, 0.16], len: 0.66 },
  { bone: 'foot_R', color: [0.02, 0.50, 0.07], out: [-0.22, 0.16], len: 0.98 },
  { bone: 'chest', color: [0.90, 0.04, 0.40], out: [0.0, -0.05], len: 1.28 }
];
function coneData(r, h, n) {
  const v = [], i = [];
  for (let k = 0; k <= n; k++) {
    const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), nr = V.norm([c * h, r, s * h]);
    v.push(c * r, 0, s * r, ...nr, 0, 0, 0, h, 0, ...nr, 0, 0);
  }
  for (let k = 0; k < n; k++) { const p = k * 2; i.push(p, p + 1, p + 2); }
  return { v, i };
}
let partyMeshes = null;
function party() {
  return partyMeshes || (partyMeshes = {
    balloon: mergeMesh([blob(1, 1, 1, [0, 0, 0], 0, 16)]), cone: mergeMesh([coneData(1, 1, 16)]), pom: mergeMesh([blob(1, 1, 1, [0, 0, 0], 0, 8)])
  });
}

function startSend(f, delay, bomb) {
  const helper = makeFighter(false, [1.2, 1.1, 0.35]);
  helper.gone = true;
  const s = { f, helper, t: -(delay || 0), prev: -(delay || 0) - 1, inflate: 0, inflateV: 0, strokes: 0, tied: 0, rise: [0, 0, 0], sparkle: null,
    bomb: !!bomb, end: bomb ? FUSE_AT + FUSE + 1.3 + TAPE : f.isPlayer ? 7.9 : 10.2 };
  placeSend(s);
  f.send = s; sends.push(s); helpers.push(helper);
  return s;
}
// where he comes from and where he works: worked out from where the body lies now (the ragdoll may still be settling)
function placeSend(s) {
  const f = s.f, back = [-Math.sin(f.yaw), 0, -Math.cos(f.yaw)], hips = V.mad(f.pos, back, 0.72);
  const perp = [Math.cos(f.yaw), 0, -Math.sin(f.yaw)];
  // he works on the far side of the body, so the camera can see
  const eye = cameraEye().eye;
  const side = (eye[0] - hips[0]) * perp[0] + (eye[2] - hips[2]) * perp[2] > 0 ? -1 : 1;
  const out = V.mul(perp, side);
  let away = V.norm([hips[0] - player.pos[0], 0, hips[2] - player.pos[2]]);
  if (f.isPlayer) away = out;
  const spot = V.add([hips[0], f.pos[1], hips[2]], V.mul(out, 0.92));
  const from = V.add(spot, V.add(V.mul(out, 11), V.mul(back, 9)));
  Object.assign(s, { spot, from, hips, out, away, face: Math.atan2(-out[0], -out[2]) });
  s.helper.pos = from.slice();
}
function endSend(f) {
  const s = f.send;
  if (!s) return;
  sends.splice(sends.indexOf(s), 1); helpers.splice(helpers.indexOf(s.helper), 1);
  f.send = null; f.script = null; f.scriptW = 0; f.gone = false;
}

function sendStep(s, dt) {
  if (s.bomb) return bombStep(s, dt);
  const f = s.f, h = s.helper;
  s.prev = s.t; s.t += dt;
  const t = s.t;
  if (t < 0) return;
  h.time += dt;
  const crossed = at => s.prev < at && t >= at;
  const near = clamp(1.5 - V.len(V.sub(s.spot, player.pos)) / 30, 0.25, 1);

  // ---------- the man himself
  h.gone = false; h.script = null; h.scriptW = 0; h.tilt = 0;
  let gait = 'Idle';
  const runTo = (a, b, u) => { h.pos = V.lerp(a, b, u); h.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]); gait = 'Run'; h.phase = (h.phase + dt * 5.5) % 1; h.tilt = 0.38; };
  const dust = () => puff([h.pos[0], floorAt(h.pos[0], h.pos[2]) + 0.07, h.pos[2]], 3, [0.55, 0.53, 0.49, 0.6], 0.5, 0.1, 0.5, -0.2);
  const arm = (x, wrist, dir, palm, curl) => ({ wrist, dir: dir || [0, -0.3, 1], palm: palm || [-x, 0, 0], pole: [x, -0.4, -0.5], curl: [curl === undefined ? 0.7 : curl, curl === undefined ? 0.7 : curl] });
  const hips0 = Rig.rest[IDX.hips];
  const script = (S, w) => { h.script = S; h.scriptW = w === undefined ? 1 : w; };

  if (t < 0.72) {                                                  // here he comes
    const u = t / 0.72;
    runTo(s.from, s.spot, 1 - Math.pow(1 - u, 1.35)); dust();
  } else if (t < 0.98) {                                           // brakes
    h.pos = s.spot.slice();
    const dirIn = Math.atan2(s.spot[0] - s.from[0], s.spot[2] - s.from[2]), turn = smooth(0.82, 0.98, t);
    h.yaw = dirIn + wrap(s.face - dirIn) * turn;
    h.tilt = -0.42 * (1 - turn); dust();
  } else if (t < 2.0) {                                            // ties on the balloons
    h.pos = s.spot.slice(); h.yaw = s.face;
    const w = smooth(0.98, 1.12, t) * (1 - smooth(1.9, 2.05, t));
    const S = { hips: V.add(hips0, [0, -0.30, -0.12]), bend: 1.0, head: M3.rx(-0.2 + Math.sin(t * 23) * 0.12), twist: Math.sin(t * 17) * 0.35, arms: {} };
    for (const [side, x] of [['R', -1], ['L', 1]]) S.arms[side] = arm(x, [x * 0.24 + Math.sin(t * 31 + x) * 0.2, 0.46 + Math.cos(t * 43 + x * 2) * 0.11, 0.52 + Math.sin(t * 27 + x) * 0.12], [0, -0.5, 1], [0, -1, 0]);
    script(S, w);
  } else if (t < 4.0) {                                            // pumps like mad
    h.pos = s.spot.slice(); h.yaw = s.face;
    const ph = clamp(t - 2.05, 0, 1.8) % 0.36 / 0.36;
    s.handle = t < 3.85 ? track([[0, 0.98], [0.45, 0.70], [1, 0.98]], ph) : 0.98;
    const low = (0.98 - s.handle) / 0.28;
    const S = { hips: V.add(hips0, [0, -0.17 * low, -0.04 * low]), bend: 0.22 + 0.85 * low, head: M3.rx(-0.4 * low), arms: {} };
    for (const [side, x] of [['R', -1], ['L', 1]]) S.arms[side] = arm(x, [x * 0.15, s.handle + 0.055, 0.40], [-x * 0.25, -0.15, 1], [0, -1, 0], 1.2);
    script(S, smooth(1.98, 2.1, t) * (1 - smooth(3.9, 4.0, t)));
  } else if (t < 5.7) {                                            // waves him off
    h.pos = s.spot.slice(); h.yaw = s.face + wrap(Math.atan2(s.away[0], s.away[2]) - s.face) * smooth(4.2, 4.8, t) * 0.6;
    const w = smooth(4.0, 4.3, t) * (1 - smooth(5.45, 5.7, t));
    const wag = Math.sin(t * 14);
    const S = { bend: -0.12, head: M3.rx(-0.45), arms: {
      R: arm(-1, [-0.52 + wag * 0.16, 1.82, 0.12], [wag * 0.5, 1, 0], [0, 0, 1], 0.15),
      L: arm(1, [0.30, 0.82, 0.06], [-0.4, -1, 0], [-1, 0, 0], 1.0) } };
    script(S, w);
  } else if (t < 6.45) {                                           // and he is gone
    const u = (t - 5.7) / 0.75;
    runTo(s.spot, s.from, Math.pow(u, 1.6)); dust();
  } else h.gone = true;
  if (world.map === 'island') h.pos = [h.pos[0], floorAt(h.pos[0], h.pos[2]), h.pos[2]];   // he runs over the hills
  for (const n of CLIP_NAMES) h.weights[n] = n === gait ? 1 : 0;

  if (crossed(0.001)) { Sound.play('zoom', near); popWord(V.add(V.lerp(s.from, s.spot, 0.75), [0, 2.0, 0]), 'NYOOOM!', 0.8); }
  if (crossed(0.74)) { Sound.play('screech', near); popWord(V.add(s.spot, [0, 2.05, 0]), 'SKRRT', 0.5); puff(s.spot.slice(), 20, [0.55, 0.53, 0.49, 0.75], 1.7, 0.09, 0.6, 0.8); }
  for (let k = 0; k < BALLOONS.length; k++) if (crossed(1.12 + k * 0.17)) { s.tied = k + 1; Sound.play('pop', near); }
  for (let k = 0; k < 5; k++) if (crossed(2.05 + k * 0.36 + 0.14)) {
    s.strokes = k + 1; Sound.play('pump', near, k);
    popWord(V.add(s.spot, [rand(-0.5, 0.5), 1.95 + rand(0, 0.3), rand(-0.5, 0.5)]), ['PFF', 'PFFF', 'PFFFT', 'PFFFF', 'FWOOMP!'][k], 0.4);
  }
  if (crossed(3.75)) Sound.play('slideup', near);
  if (crossed(4.35)) popWord(V.add(s.spot, [0, 2.2, 0]), 'BYE BYE!', 1.1);
  if (crossed(5.7)) Sound.play('zoom', near * 0.8);

  // ---------- the balloons fill with every stroke, with a bit of wobble
  const want = s.strokes / 5;
  s.inflateV += ((want - s.inflate) * 260 - s.inflateV * 17) * dt; s.inflate += s.inflateV * dt;

  // ---------- up, up and away
  const tau = Math.max(0, t - 3.7);
  // mostly away, a bit up: you watch him shrink into the distance
  const up = 0.55 * tau + 0.22 * tau * tau, off = 0.2 * tau + 1.35 * tau * tau;
  s.rise = [s.away[0] * off + Math.sin(tau * 2.1) * 0.12 * Math.min(1, tau), up, s.away[2] * off];
  if (t >= 2.4 && !f.gone) {
    const lift = smooth(2.45, 3.9, t), air = smooth(0, 1.4, tau);
    const lie = M3.mul(M3.ry(f.yaw), M3.rx(-1.5));
    const hipsLie = V.add([f.pos[0], f.pos[1] + 0.2, f.pos[2]], M3.vec(lie, hips0));
    const centre = V.add(V.add(hipsLie, [0, 0.12 * lift, 0]), s.rise);
    const swing = M3.mul(M3.ry(Math.sin(tau * 0.9) * 0.5 * air + tau * 0.18), M3.rz(Math.sin(tau * 2.6) * 0.14 * air));
    const R = M3.mul(swing, M3.mul(M3.ry(f.yaw), M3.rx(-1.5 + Math.sin(tau * 2.2) * 0.18 * air)));
    const S = { arms: {}, legs: {}, bend: -0.1 * lift, head: M3.mul(M3.rz(0.45 + Math.sin(t * 2.7) * 0.2 * air), M3.rx(-0.35 * lift)), root: { R, p: V.sub(centre, M3.vec(R, hips0)) } };
    for (const [side, x] of [['R', -1], ['L', 1]]) {
      const sway = Math.sin(t * 3.1 + x) * 0.07 * air;
      S.arms[side] = { wrist: V.lerp([x * 0.82, x > 0 ? 1.22 : 0.94, -0.13], [x * 0.58 + sway, 1.34, 0.42], lift), dir: V.norm([x * 0.4, 0, lift]), palm: [0, 0, 1], pole: [x, 0, -1], curl: [0.4, 0.4] };
      S.legs[side] = { ankle: V.lerp(Rig.rest[IDX['foot_' + side]], [x * 0.27, 0.30 + sway, 0.38], lift), pole: [x * 0.3, 0, 1], footR: M3.rx(-0.4 * lift) };
    }
    f.script = S; f.scriptW = smooth(2.4, 2.8, t);               // eases him out of however he fell
  }
  if (crossed(s.end - 0.75)) {
    // a twinkle where he was last seen
    s.sparkle = { p: V.add(V.add(s.hips, [0, 0.5, 0]), s.rise), t };
    Sound.play('ting', near);
    f.gone = true;
  }
}

// ---------------------------------------------------------------- the bomb visit
// a caveman who has never seen a bomb, planting one
// on top of whichever side faces up: his belly, or his back if he went down face first
function bellyTop(f) {
  const side = V.sub(bonePos(f, 'upperArm_L'), bonePos(f, 'upperArm_R')), up = V.sub(bonePos(f, 'neck'), bonePos(f, 'hips'));
  const n = V.norm(V.cross(side, up));
  return V.add(V.lerp(bonePos(f, 'spine'), bonePos(f, 'chest'), 0.75), [0, n[1] >= 0 ? 0.25 : 0.19, 0]);   // up off his loincloth
}
// ---------------------------------------------------------------- his skin, exactly
// where a body's skin really is: its own vertices, posed the way it lies right now (done on the CPU, only near the bomb)
function skinAt(f, prim, k) {
  const P = prim.cpu.pos, J = prim.cpu.j, W = prim.cpu.w, B = f.bones, M = f.model;
  const px = P[k * 3], py = P[k * 3 + 1], pz = P[k * 3 + 2];
  let x = 0, y = 0, z = 0;
  for (let c = 0; c < 4; c++) {
    const w = W[k * 4 + c]; if (w <= 0) continue;
    const m = J[k * 4 + c] * 16;
    x += w * (B[m] * px + B[m + 4] * py + B[m + 8] * pz + B[m + 12]);
    y += w * (B[m + 1] * px + B[m + 5] * py + B[m + 9] * pz + B[m + 13]);
    z += w * (B[m + 2] * px + B[m + 6] * py + B[m + 10] * pz + B[m + 14]);
  }
  return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
}
// his vertices within reach of a spot, and the triangles made of them
function skinNear(f, c, r) {
  const verts = [], tris = [];
  for (const prim of Rig.prims) {
    const n = prim.cpu.pos.length / 3, slot = new Int32Array(n).fill(-1);
    for (let k = 0; k < n; k++) { const q = skinAt(f, prim, k); if (Math.abs(q[0] - c[0]) < r && Math.abs(q[1] - c[1]) < r && Math.abs(q[2] - c[2]) < r) { slot[k] = verts.length; verts.push([prim, k]); } }
    const I = prim.cpu.idx;
    for (let i = 0; i < I.length; i += 3) { const a = slot[I[i]], b = slot[I[i + 1]], d = slot[I[i + 2]]; if (a >= 0 && b >= 0 && d >= 0) tris.push([a, b, d]); }
  }
  return { verts, tris };
}
// the height of his skin straight below (x, z), in some local space: the top-most triangle there, exactly
function skinHeight(L, tris, x, z) {
  let best = -Infinity;
  for (const [ia, ib, ic] of tris) {
    const A = L[ia], B = L[ib], C = L[ic];
    const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
    if (Math.abs(d) < 1e-10) continue;
    const u = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d;
    const v = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d;
    if (u < -1e-4 || v < -1e-4 || u + v > 1.0001) continue;
    const y = u * A[1] + v * B[1] + (1 - u - v) * C[1];
    if (y > best) best = y;
  }
  return best;
}
// the bomb sitting on him: tipped to follow his shape, then lowered until it just rests on the highest skin under it.
// Also hands back the skin around it in the bomb's own space, so the tape can be laid right on it.
function seatOn(f, face, cache) {
  const top = bellyTop(f), hp = bonePos(f, 'hips'), nk = bonePos(f, 'neck');
  // a body lying still gives the same answer every frame: only work it out again when he has moved
  if (cache.seat && cache.face === face && V.len(V.sub(cache.top, top)) < 0.004 && V.len(V.sub(cache.hp, hp)) < 0.004 && V.len(V.sub(cache.nk, nk)) < 0.004) return cache.seat;
  cache.top = top; cache.hp = hp; cache.nk = nk; cache.face = face;
  if (!cache.near || V.len(V.sub(cache.c, top)) > 0.1) { cache.near = skinNear(f, top, 0.3); cache.c = top; }
  const pts = cache.near.verts.map(([prim, k]) => skinAt(f, prim, k));
  const toLocal = R => { const T = M3.tr(R); return pts.map(q => M3.vec(T, V.sub(q, top))); };
  const Ry = M3.ry(face);
  let L = toLocal(Ry);
  // only the triangles under the bomb matter (about a hundred of thousands): short list, fast lookups
  const tris = cache.near.tris.filter(([a, b, c]) => {
    const A = L[a], B = L[b], C = L[c];
    return Math.min(A[0], B[0], C[0]) < 0.3 && Math.max(A[0], B[0], C[0]) > -0.3 && Math.min(A[2], B[2], C[2]) < 0.25 && Math.max(A[2], B[2], C[2]) > -0.25;
  });
  // tip it to follow his shape: a plane fitted (least squares) to the skin all round the edge of the bomb
  let n = 0, Sx = 0, Sz = 0, Sy = 0, Sxx = 0, Szz = 0, Sxz = 0, Sxy = 0, Szy = 0;
  for (let gx = -0.16; gx <= 0.1601; gx += 0.02) for (let gz = -0.12; gz <= 0.1201; gz += 0.02) {
    if (Math.abs(gx) < 0.11 && Math.abs(gz) < 0.07) continue;
    const y = skinHeight(L, tris, gx, gz);
    if (!isFinite(y)) continue;
    n++; Sx += gx; Sz += gz; Sy += y; Sxx += gx * gx; Szz += gz * gz; Sxz += gx * gz; Sxy += gx * y; Szy += gz * y;
  }
  let sx = 0, sz = 0;
  if (n > 12) {
    const mx = Sx / n, mz = Sz / n, my = Sy / n;
    const cxx = Sxx / n - mx * mx, czz = Szz / n - mz * mz, cxz = Sxz / n - mx * mz, cxy = Sxy / n - mx * my, czy = Szy / n - mz * my;
    const det = cxx * czz - cxz * cxz;
    if (Math.abs(det) > 1e-9) { sx = clamp((cxy * czz - czy * cxz) / det, -0.6, 0.6); sz = clamp((czy * cxx - cxy * cxz) / det, -0.6, 0.6); }
  }
  const R = M3.mul(Ry, M3.frame([0, 1, 0], [1, 0, 0], V.norm([-sx, 1, -sz]), [1, sx, 0]));
  L = toLocal(R);
  // settle it until its edges just touch his skin all round (the round top of his belly tucks up inside the brick,
  // where nothing can see it), but never so far that skin would come out through the top
  let edge = -Infinity, mid = -Infinity;
  for (let gx = -0.15; gx <= 0.1501; gx += 0.025) for (let gz = -0.105; gz <= 0.1051; gz += 0.021) {
    const y = skinHeight(L, tris, gx, gz);
    if (!isFinite(y)) continue;
    if (Math.abs(gx) > 0.12 || Math.abs(gz) > 0.08) edge = Math.max(edge, y); else mid = Math.max(mid, y);
  }
  for (const q of L) if (Math.abs(q[0]) < 0.15 && Math.abs(q[2]) < 0.105 && q[1] > mid) mid = q[1];   // and any vertex poking up in the middle
  let lift = isFinite(edge) ? Math.max(edge, mid - 0.066) : isFinite(mid) ? mid : 0;
  lift += 0.003;                                               // a hair above his skin at the edges: touching, never in it
  const at = V.add(top, M3.vec(R, [0, lift, 0]));
  for (const q of L) q[1] -= lift;
  const seat = { at, R, skin: (x, z) => skinHeight(L, tris, x, z) };
  cache.seat = seat;
  return seat;
}
const bombSpot = s => s.seat ? s.seat.at : bellyTop(s.f);
// after he puts it down he tapes it on. The taping is a pause slipped into his timeline; inside it (u = seconds in):
const TAPE_AT = 1.6, TAPE = 3.0;
const GRAB = 0.32, TOSS = 0.62, CATCH = 1.0, BITE = 1.24, RIP = 1.3, LAY = 1.7, LAID = 2.7, YEET = 2.82;
const KNEEL_IN = 0.3;                                                       // how far he shuffles in to reach the belly
// both hands on the ends of the bomb; c is the bottom middle of the bomb, in his own space
function holdGoals(c) {
  return {
    R: hand(V.add(c, [-0.16, 0.045, 0]), [0, -0.3, 1], [1, 0, 0], [-1, -0.6, -0.3], 0.6),
    L: hand(V.add(c, [0.16, 0.045, 0]), [0, -0.3, 1], [-1, 0, 0], [1, -0.6, -0.3], 0.6)
  };
}
let blast = null;                             // the latest one, for the light it throws
const blasts = [];                            // every explosion still going: fire, smoke, chunks, the ring
const fx = (p, v, life, size, color, grav, grow, add) => particles.push({ p: p.slice(), v, life, max: life, size, color, grav, grow, add });
const ball = r => [rand(-1, 1) * r, rand(-0.3, 1) * r, rand(-1, 1) * r];
const BLAST_LIFE = 9;
// a proper explosion: blinding flash, a fireball that rolls up into a mushroom of black smoke, a shockwave
// ring racing over the ground, burning chunks trailing smoke, a scorched crater and fire that keeps going
function explode(c, owner) {
  const d = V.len(V.sub(c, cameraEye().eye)), floor = floorAt(c[0], c[2]);
  Sound.play('explode', clamp(1.8 - d / 45, 0.3, 1), d);
  cam.shake = Math.max(cam.shake, clamp(2.2 - d / 18, 0, 1));
  const b = { p: c.slice(), g: [c[0], floor, c[2]], t: game.time, near: clamp(1 - d / 30, 0, 1), chunks: [] };
  blast = b; blasts.push(b);
  const g = b.g;
  // the flash: white-hot core
  for (let i = 0; i < 14; i++) fx(V.add(c, ball(0.4)), ball(2), rand(0.1, 0.25), rand(1.6, 2.6), [1, 0.97, 0.88, 1], 0, 4, true);
  // the fireball: a big boiling ball of orange that climbs and cools
  for (let i = 0; i < 150; i++) {
    const v = ball(rand(2, 9)); v[1] = Math.abs(v[1]) * 0.8 + rand(1.5, 4);
    const hot = Math.random();
    fx(V.add(c, ball(0.5)), v, rand(0.6, 1.6), rand(0.45, 0.95), hot < 0.3 ? [1, 0.85, 0.45, 1] : hot < 0.75 ? [1, 0.48, 0.08, 0.95] : [0.9, 0.22, 0.04, 0.9], -2.2, 1.3, true);
  }
  // sparks
  for (let i = 0; i < 220; i++) { const v = ball(rand(7, 24)); v[1] = Math.abs(v[1]) * 0.9 + 2.5; fx(c, v, rand(0.7, 2.2), rand(0.018, 0.034), [1, rand(0.6, 0.9), 0.3, 1], 9.8, 0, true); }
  // dust blown out along the ground, two rings: a fast low one and a slower billowing one
  for (let i = 0; i < 110; i++) { const a = i / 110 * Math.PI * 2 + rand(-0.03, 0.03), sp = rand(11, 16); fx([g[0], g[1] + 0.15, g[2]], [Math.cos(a) * sp, rand(0, 0.8), Math.sin(a) * sp], rand(1.0, 1.7), rand(0.4, 0.7), [0.58, 0.52, 0.43, 0.6], 0, 1.4); }
  for (let i = 0; i < 70; i++) { const a = rand(0, 6.3), sp = rand(3, 7); fx(V.add(g, [0, 0.4, 0]), [Math.cos(a) * sp, rand(0.5, 2.5), Math.sin(a) * sp], rand(2.0, 3.5), rand(0.8, 1.3), [0.5, 0.45, 0.38, 0.5], -0.2, 0.9); }
  // the first rush of black smoke
  for (let i = 0; i < 90; i++) { const v = ball(rand(1, 4)); v[1] = rand(3, 9); fx(V.add(c, ball(0.8)), v, rand(3.5, 6), rand(0.7, 1.2), [0.1, 0.095, 0.1, 0.7], -1.4, 0.8); }
  // scorch and a crater full of little marks
  for (let i = 0; i < 40; i++) { const a = rand(0, 6.3), r = Math.sqrt(Math.random()) * 2.4, x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r; marks.push([x, floorAt(x, z), z]); }
  while (marks.length > 120) marks.shift();
  // junk, and burning chunks that leave trails of smoke
  for (let i = 0; i < 16; i++) { const a = rand(0, 6.3), sp = rand(3, 10); spawnProp(['rock', 'bone', 'fish', 'meat', 'rock'][i % 5], V.add(c, [0, 0.3, 0]), [Math.cos(a) * sp, rand(6, 14), Math.sin(a) * sp], { life: 9 }); }
  shoveProps(c, 9, 9);                                        // and whatever was lying around goes flying
  for (let i = 0; i < 14; i++) { const a = rand(0, 6.3), sp = rand(4, 11); b.chunks.push({ p: V.add(c, [0, 0.3, 0]), v: [Math.cos(a) * sp, rand(7, 16), Math.sin(a) * sp], life: rand(1.6, 3.2) }); }
  for (const v of [player, ...bots]) {
    const dd = Math.hypot(v.pos[0] - c[0], v.pos[2] - c[2]);
    // your own bomb counts as your knockout (but blowing yourself up doesn't)
    if (v.dead < 0 && dd < 8) damage(v, dd < 3 ? 150 : Math.round(25 + 75 * (1 - dd / 8)), { pos: c, isPlayer: !!(owner && owner.isPlayer && v !== owner), blast: true });
    else if (v.rag && !v.gone) ragBlast(v, c, 10);            // bodies already down get thrown too
  }
}
// what an explosion keeps doing after the bang
function blastsStep(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i], age = game.time - b.t;
    if (age > BLAST_LIFE + 12) { blasts.splice(i, 1); if (blast === b) blast = null; continue; }
    if (age < 0.25) cam.shake = Math.max(cam.shake, b.near);                    // it keeps shaking while the wave passes
    else if (age < 2.5) cam.shake = Math.max(cam.shake, b.near * 0.25 * (1 - age / 2.5));
    const g = b.g, rate = (k, n) => Math.random() < dt * n * k;
    // the mushroom: a stem of smoke feeding a cap that spreads out up top
    if (age < 5) {
      const k = 1 - age / 5;
      if (rate(k, 40)) { const top = Math.min(9, 2 + age * 3.5); fx(V.add(g, [rand(-0.5, 0.5), rand(0.5, 1.2), rand(-0.5, 0.5)]), [rand(-0.3, 0.3), rand(3, 5) * (0.5 + 0.5 * k), rand(-0.3, 0.3)], top / 4 + rand(0.5, 1.5), rand(0.6, 1.0), [0.16, 0.15, 0.15, 0.55], 0, 0.6); }
      if (age > 0.5 && rate(k, 30)) { const h = Math.min(9, 2 + age * 3.2), a = rand(0, 6.3), r = rand(0.5, 2.2); fx(V.add(g, [Math.cos(a) * r, h, Math.sin(a) * r]), [Math.cos(a) * rand(0.6, 1.6), rand(0.2, 0.8), Math.sin(a) * rand(0.6, 1.6)], rand(4, 7), rand(1.2, 2.0), [0.24, 0.22, 0.21, 0.45], -0.15, 0.55); }
    }
    // the fireball's glow inside the smoke, early on
    if (age < 1.6 && rate(1 - age / 1.6, 60)) { const h = 0.6 + age * 3; fx(V.add(g, [rand(-0.6, 0.6), h + rand(-0.4, 0.6), rand(-0.6, 0.6)]), [rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5)], rand(0.4, 0.8), rand(0.7, 1.2), [1, 0.4, 0.06, 0.8], -1, 0.8, true); }
    // the fire left on the ground, and its smoke
    if (age < BLAST_LIFE) {
      const k = 1 - age / BLAST_LIFE, a = rand(0, 6.3), r = Math.sqrt(Math.random()) * 1.3, x = g[0] + Math.cos(a) * r, z = g[2] + Math.sin(a) * r;
      if (rate(k, 45)) fx([x, floorAt(x, z) + 0.05, z], [rand(-0.2, 0.2), rand(0.8, 2.2), rand(-0.2, 0.2)], rand(0.3, 0.8), rand(0.15, 0.4), Math.random() < 0.4 ? [1, 0.75, 0.25, 0.9] : [1, 0.38, 0.06, 0.85], -1.5, 0.3, true);
      if (rate(k, 9)) fx([x, floorAt(x, z) + 0.3, z], [rand(-0.3, 0.3), rand(1, 2), rand(-0.3, 0.3)], rand(3, 5), rand(0.4, 0.7), [0.13, 0.12, 0.12, 0.5], -0.4, 0.5);
      if (rate(k, 6)) fx([x, floorAt(x, z) + 0.1, z], [rand(-1, 1), rand(1.5, 4), rand(-1, 1)], rand(1, 2), 0.02, [1, 0.7, 0.3, 1], 2, 0, true);   // embers
    }
    // burning chunks arcing out, trailing smoke, then a puff where they land
    for (let k = b.chunks.length - 1; k >= 0; k--) {
      const ch = b.chunks[k];
      ch.v[1] -= 9.8 * dt; ch.p = V.mad(ch.p, ch.v, dt); ch.life -= dt;
      const low = floorAt(ch.p[0], ch.p[2]);
      if (ch.p[1] < low || ch.life <= 0) { puff([ch.p[0], low + 0.05, ch.p[2]], 6, [0.3, 0.28, 0.26, 0.6], 0.8, 0.15, 0.6, -0.5); b.chunks.splice(k, 1); continue; }
      fx(ch.p, [0, 0.2, 0], rand(0.2, 0.35), rand(0.12, 0.2), [1, 0.5, 0.1, 0.9], 0, 0.3, true);
      fx(ch.p, [rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2)], rand(1.2, 2.2), rand(0.12, 0.2), [0.15, 0.14, 0.14, 0.6], -0.3, 0.45);
    }
  }
}
// drawn with the other effects: the scorch on the ground, the shockwave ring, and a flash too big for one particle
function drawBlasts(quad, right, up, additive) {
  for (const b of blasts) {
    const age = game.time - b.t, g = b.g;
    if (!additive) {
      const fade = 1 - smooth(BLAST_LIFE + 4, BLAST_LIFE + 12, age), grow = smooth(0, 0.15, age);
      quad([g[0], g[1] + 0.02, g[2]], [2.8 * grow, 0, 0], [0, 0, 2.8 * grow], [0.03, 0.025, 0.02, 0.85 * fade]);       // scorch
      quad([g[0], g[1] + 0.025, g[2]], [1.4 * grow, 0, 0], [0, 0, 1.4 * grow], [0.01, 0.01, 0.01, 0.8 * fade]);
      if (age < 1.2) {                                                                                                     // shockwave dust ring
        const r = 1 + 16 * Math.pow(age / 1.2, 0.55), a = 0.5 * (1 - age / 1.2), n = 56;
        for (let k = 0; k < n; k++) {
          const t = k / n * Math.PI * 2, x = g[0] + Math.cos(t) * r, z = g[2] + Math.sin(t) * r;
          quad([x, floorAt(x, z) + 0.25, z], V.mul(right, 0.75 + r * 0.04), [0, 0.35 + r * 0.02, 0], [0.62, 0.57, 0.5, a]);
        }
      }
    } else {
      if (age < 0.35) {                                                                                                    // the flash
        const k = 1 - age / 0.35, s = 2 + age * 18;
        quad(b.p, V.mul(right, s), V.mul(up, s), [k, k * 0.92, k * 0.75, k]);
        quad(b.p, V.mul(right, s * 2.2), V.mul(up, s * 2.2), [k * 0.6, k * 0.35, k * 0.1, k * 0.6]);
      }
      if (age < 0.4) {                                                                                                     // the hot ring, a flat flash on the ground
        const r = 1 + 30 * age, a = 1 - age / 0.4;
        quad([g[0], g[1] + 0.1, g[2]], [r, 0, 0], [0, 0, r], [a * 0.9, a * 0.45, a * 0.12, a * 0.6]);
      }
    }
  }
}
// the C4: the textured brick, its screen lighting up when armed and flashing with each beep
// the roll of duct tape, and strips of its tape
function bindRoll(prog) {
  if (!prog.u.uOrm) return;
  gl.uniform1i(prog.u.uHasTex, 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ROLL.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ROLL.normal);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ROLL.orm);
}
function drawRoll(prog, at, R) { bindRoll(prog); drawMesh(prog, ROLL.parts.body, R, at); }
// a flat piece of tape from a to b; across says which way its width lies
function drawStrip(prog, a, b, across, lift) {
  const d = V.sub(b, a), len = V.len(d);
  if (len < 1e-4) return;
  const along = V.mul(d, 1 / len), X = V.norm(V.orth(across, along)), out = V.cross(X, along);
  drawMesh(prog, ROLL.seg, M3.cols(V.mul(X, 0.034), V.mul(out, 0.0018), V.mul(along, len + 0.002)), V.mad(V.lerp(a, b, 0.5), out, lift || 0));
}
// two strips, each one piece: a tail stuck to his skin, up the far side of an end brick, across its top, down the near
// side, a tail onto his skin again. The tails lie on his real skin (skin: its height in the bomb's own space).
// k is how far along the taping is (far side first). Returns the end of the strip being laid, if one is.
function drawTape(prog, at, R0, k, skin) {
  if (k <= 0) return null;
  const Z = 0.099, TOP = 0.075, X = M3.vec(R0, [1, 0, 0]);
  bindRoll(prog);
  let end = null;
  for (let j = 0; j < 2; j++) {
    const g = clamp(k * 2 - j, 0, 1);
    if (g <= 0) continue;
    const x0 = j ? 0.118 : -0.118, skew = j ? 0.1 : -0.13, xs = z => x0 + z * skew;
    const tail = z => { const h = skin ? skin(xs(z), z) : -Infinity; return isFinite(h) ? h + 0.0022 : -0.004 - (Math.abs(z) - Z) * (Math.abs(z) - Z) * 6; };
    const zy = [];
    // the tails: one straight span from the brick's bottom edge down to his skin, then flat along his skin
    for (const z of [0.15, 0.125]) zy.push([z, tail(z)]);
    zy.push([Z, 0.002], [Z, TOP], [-Z, TOP], [-Z, 0.002]);
    for (const z of [-0.125, -0.15]) zy.push([z, tail(z)]);
    const P = zy.map(([z, y]) => V.add(at, M3.vec(R0, [xs(z), y, z])));
    let total = 0; for (let i = 1; i < P.length; i++) total += V.len(V.sub(P[i], P[i - 1]));
    let left = total * g;
    for (let i = 1; i < P.length && left > 0; i++) {
      const seg = V.len(V.sub(P[i], P[i - 1])), b = seg <= left ? P[i] : V.lerp(P[i - 1], P[i], left / seg);
      // lifted a touch off whatever it lies on (the brick or his skin), on the outside
      const mid = V.lerp(P[i - 1], b, 0.5), away = V.sub(mid, V.add(at, M3.vec(R0, [xs(0), TOP * 0.5, 0])));
      const out = V.cross(V.norm(V.orth(X, V.sub(b, P[i - 1]))), V.norm(V.sub(b, P[i - 1])));
      drawStrip(prog, P[i - 1], b, X, 0.0011 * (V.dot(out, away) >= 0 ? 1 : -1));
      left -= seg; end = b;
    }
    if (g >= 1) end = null;
  }
  return end;
}
function drawC4(prog, at, R0, lit, glow) {
  const R = M3.mul(R0, M3.ry(Math.PI / 2)), q = o => V.add(at, M3.vec(R, o));
  if (prog.u.uOrm) {
    gl.uniform1i(prog.u.uHasTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C4.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, C4.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, C4.orm);
  }
  drawMesh(prog, C4.parts.body, R, at);
  const k = lit ? 0.25 + 0.75 * glow : 0;
  flat(prog, [0.04 + 0.3 * k, 0.08 + 0.85 * k, 0.05 + 0.3 * k], 0.2, 0.0); drawMesh(prog, C4.parts.panel, R, V.add(at, M3.vec(R, [0, 0.001, 0])));
}
function bombStep(s, dt) {
  const f = s.f, h = s.helper;
  s.prev = s.t; s.t += dt;
  // the taping is slipped in as a pause in his timeline: everything after it runs TAPE seconds later
  const raw = s.t, warp = x => x < TAPE_AT ? x : x < TAPE_AT + TAPE ? TAPE_AT : x - TAPE;
  const t = warp(raw), u = raw - TAPE_AT, taping = u >= 0 && u < TAPE, tp = (u - LAY) / (LAID - LAY);
  s.tape = clamp(tp, 0, 1); s.taping = taping; s.u = u;
  if (raw < 0) return;
  if (!f.gone) s.seat = seatOn(f, s.face, s.seatCache || (s.seatCache = {}));
  h.time += dt;
  const crossed = at => warp(s.prev) < at && t >= at, crossedRaw = at => s.prev < at && raw >= at;
  const near = clamp(1.5 - V.len(V.sub(s.spot, player.pos)) / 30, 0.25, 1);
  const wrong = V.mad(s.spot, s.away, -3.2);                   // he runs the wrong way first
  h.gone = false; h.script = null; h.scriptW = 0; h.tilt = 0;
  let gait = 'Idle';
  const runTo = (a, b, u) => { h.pos = V.lerp(a, b, u); h.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]); gait = 'Run'; h.phase = (h.phase + dt * 5.5) % 1; h.tilt = 0.38; };
  const dust = () => puff([h.pos[0], floorAt(h.pos[0], h.pos[2]) + 0.07, h.pos[2]], 3, [0.55, 0.53, 0.49, 0.6], 0.5, 0.1, 0.5, -0.2);
  const arm = (x, wrist, dir, palm, curl) => ({ wrist, dir: dir || [0, -0.3, 1], palm: palm || [-x, 0, 0], pole: [x, -0.4, -0.5], curl: [curl === undefined ? 0.7 : curl, curl === undefined ? 0.7 : curl] });
  const hips0 = Rig.rest[IDX.hips];
  const script = (S, w) => { h.script = S; h.scriptW = w === undefined ? 1 : w; };
  s.bonk = 0; h.carry = null; s.hold = null;
  // where the bomb sits on the belly, seen from where he kneels
  const kneel = V.mad(s.spot, [Math.sin(s.face), 0, Math.cos(s.face)], KNEEL_IN);
  const onBelly = M3.vec(M3.ry(-s.face), V.sub(bombSpot(s), kneel));
  const CARRY = [0, 0.9, 0.36];

  if (t < 0.72) {                                              // here he comes, hugging the bomb to his belly
    runTo(s.from, s.spot, 1 - Math.pow(1 - u01(t / 0.72), 1.35)); dust();
    s.hold = CARRY; h.carry = holdGoals(CARRY);
  } else if (t < 1.0) {                                        // brakes, a bit too late
    h.pos = s.spot.slice();
    const dirIn = Math.atan2(s.spot[0] - s.from[0], s.spot[2] - s.from[2]), turn = smooth(0.82, 1.0, t);
    h.yaw = dirIn + wrap(s.face - dirIn) * turn; h.tilt = -0.42 * (1 - turn); dust();
    s.hold = CARRY; h.carry = holdGoals(CARRY);
  } else if (t < 2.2) {                                         // kneels, lowers it gently onto the belly, then punches in a code
    const inn = smooth(1.0, 1.25, t) * (1 - smooth(2.05, 2.2, t));
    h.pos = V.lerp(s.spot, kneel, inn); h.yaw = s.face;
    const down = smooth(1.0, 1.45, t) * (1 - smooth(2.05, 2.2, t));
    const lower = smooth(1.1, 1.55, t);
    const c = V.lerp(CARRY, onBelly, lower);
    if (t < 1.6) s.hold = c;                                    // still in his hands
    const S = { hips: V.add(hips0, [0, -0.42 * down, -0.1 * down]), bend: 0.85 * down, head: M3.rx(-0.45 * down), arms: {} };
    const G = holdGoals(c);
    S.arms.L = G.L;
    if (t < 1.62) S.arms.R = G.R;
    else {                                                      // the right hand lets go and taps the keypad, beep, beep, beep, beep
      const key = V.add(onBelly, M3.vec(M3.ry(Math.PI / 2), V.add(C4.panelAt, [0, 0.0, -0.05])));
      const tap = t > 1.72 && t < 2.08 ? Math.abs(Math.sin((t - 1.72) / 0.09 * Math.PI)) : 0;
      const lift = smooth(1.6, 1.72, t) * (1 - smooth(2.05, 2.15, t));
      S.arms.R = hand(V.add(key, [0.02 * Math.sin(t * 40), 0.03 + 0.06 * (1 - tap) * lift + 0.05 * (1 - lift), 0]), [0.25, -0.55, 0.8], [0.3, -0.2, -1], [-1, -1, -0.1], 1.1);
    }
    if (taping) {
      // his left hand keeps the bomb still the whole time; the right does the show
      S.arms.L = hand(V.add(onBelly, [0.1, 0.09, 0.0]), [0, -0.6, 1], [0, -1, -0.6], [1, -0.6, -0.3], 0.3);
      const W = (wrist, dir, palm, pole, curl) => ({ wrist, dir: V.norm(dir), palm, pole, curl: [curl, curl] });
      const BACK = [-0.24, 0.38, -0.17], UP = [-0.13, 0.8, 0.34], OUT = [-0.5, 0.62, 0.32], SHOULDER = [-0.22, 1.12, -0.12];
      const mouth = V.add(h.wp[IDX.head], [-0.03, 0.0, 0.12]);
      let R = null;
      if (u < TOSS) {                                           // reaches round to his back, grabs the roll off his hip, brings it out
        const reach = smooth(0, 0.26, u), out = smooth(GRAB + 0.04, TOSS, u);
        const from = holdGoals(onBelly).R.wrist, wrist = V.lerp(V.lerp(from, BACK, reach), V.add(UP, [0, 0.13 * smooth(0.5, TOSS, u), 0]), out);
        R = W(wrist, V.lerp([0, -1, -0.5], [0, 0.4, 1], out), [1, 0, 0], [-1, -0.2, 0.4], u > GRAB ? 1.1 : 0.4);
        S.twist = -0.55 * reach * (1 - out);
        S.head = M3.mul(M3.rx(-0.3), M3.ry(-0.6 * reach * (1 - out)));
      } else if (u < CATCH) {                                   // flips it up spinning... and catches it one-handed
        const w = (u - TOSS) / (CATCH - TOSS), dip = u > CATCH - 0.06 ? 0.05 : 0;
        R = W(V.add(UP, [0, -dip, 0]), [0, 0.15, 1], [0, 1, 0], [-1, -0.6, -0.2], 0.35);
        S.head = M3.rx(-0.75 + 0.35 * Math.sin(w * Math.PI));
      } else if (u < RIP) {                                     // up to his mouth, bites the end of the tape
        R = W(V.lerp(UP, V.add(mouth, [-0.05, -0.07, 0.02]), smooth(CATCH, BITE, u)), [0.3, 0.6, 0.6], [1, 0, 0], [-1, -0.8, 0], 1.1);
        S.head = M3.rx(-0.2);
      } else if (u < LAY) {                                     // and RIIIP: yanks the roll away, a strip stretched to his teeth
        R = W(V.lerp(V.add(mouth, [-0.05, -0.07, 0.02]), OUT, smooth(RIP, RIP + 0.16, u)), [-0.6, 0, 1], [0, 1, 0], [-1, -0.8, 0], 1.1);
        S.head = M3.mul(M3.rx(-0.15), M3.ry(0.35 * smooth(RIP, RIP + 0.16, u)));
      } else if (u < LAID) {                                    // lays the two strips over the bricks, far side to near
        const k = tp < 0.5 ? 0 : 1, v = smooth(0.08, 0.85, (tp - k * 0.5) / 0.5), sx = k ? 0.118 : -0.118;
        R = hand(V.add(onBelly, [sx, 0.15 + 0.04 * Math.sin(v * Math.PI), 0.24 - 0.48 * v]), [0, -0.5, 1], [0, -1, -0.5], [-1, -1, -0.1], 0.9);
        S.head = M3.mul(M3.rx(-0.55), M3.ry(-sx * 2));
      } else {                                                  // done: the roll goes over his shoulder
        const wind = smooth(LAID, YEET, u), follow = smooth(YEET, TAPE, u);
        R = W(V.lerp(V.lerp(holdGoals(onBelly).R.wrist, SHOULDER, wind), [-0.35, 0.75, -0.3], follow), [0, 1, -0.5], [1, 0, 0], [-1, 0, -0.6], u < YEET ? 1.1 : 0.3);
        S.twist = 0.3 * wind * (1 - follow);
      }
      S.arms.R = R;
    }
    script(S, smooth(1.0, 1.12, t) * (1 - smooth(2.05, 2.2, t)));
    if (t < 1.12) h.carry = holdGoals(CARRY);
  } else if (t < FUSE_AT) {                                     // bangs two rocks to make a spark... and bonks himself
    h.pos = s.spot.slice(); h.yaw = s.face;
    const swing = t < 2.85 ? Math.abs(Math.sin((t - 2.2) * 9)) : 0;     // clack clack clack
    const self = smooth(2.85, 2.95, t) * (1 - smooth(3.05, 3.3, t));    // the last one goes into his own forehead
    const gap = 0.25 * (1 - swing) * (1 - self);
    const S = { bend: -0.1, head: M3.mul(M3.rx(-0.2 - 0.5 * self), M3.rz(0.4 * self)), arms: {} };
    const hit = V.lerp([0, 1.15, 0.42], [0, 1.78, 0.2], self);
    for (const [side, x] of [['R', -1], ['L', 1]]) S.arms[side] = arm(x, V.add(hit, [x * (0.04 + gap), 0, 0]), [-x * 0.6, 0.1, 1], [0, -1, 0], 1.0);
    script(S, smooth(2.2, 2.35, t) * (1 - smooth(3.2, FUSE_AT, t)));
    if (self > 0.5) s.bonk = self;
  } else if (t < 4.7) {                                         // proud
    h.pos = s.spot.slice(); h.yaw = s.face + wrap(Math.atan2(s.away[0], s.away[2]) - s.face) * smooth(4.3, 4.7, t) * 0.4;
    const bounce = Math.abs(Math.sin(t * 9)) * 0.06, wag = Math.sin(t * 14);
    const S = { hips: V.add(hips0, [0, bounce, 0]), bend: -0.12, head: M3.rx(-0.4), arms: {
      R: arm(-1, [-0.5, 1.5 + bounce, 0.25], [-0.2, 1, 0.2], [0, 0, 1], 0.2),             // thumbs up
      L: arm(1, [0.5 + wag * 0.06, 1.5 + bounce, 0.25], [0.2, 1, 0.2], [0, 0, 1], 0.2) } };
    script(S, smooth(FUSE_AT, FUSE_AT + 0.2, t) * (1 - smooth(4.55, 4.7, t)));
  } else if (t < 5.4) {                                         // runs, confidently, the wrong way
    runTo(s.spot, wrong, smooth(4.7, 5.4, t)); dust();
  } else if (t < 6.2) {                                         // stops. thinks. scratches head
    h.pos = wrong.slice(); h.yaw = Math.atan2(s.spot[0] - wrong[0], s.spot[2] - wrong[2]) + Math.sin(t * 5) * 0.6;
    script({ bend: 0.05, head: M3.mul(M3.rz(Math.sin(t * 6) * 0.25), M3.rx(-0.15)), arms: { R: scratchArm(-1, t) } }, smooth(5.4, 5.55, t) * (1 - smooth(6.05, 6.2, t)));
  } else if (t < 7.1) {                                         // the penny drops. gone
    runTo(wrong, s.from, Math.pow((t - 6.2) / 0.9, 1.8)); dust();
  } else h.gone = true;
  if (world.map === 'island') h.pos = [h.pos[0], floorAt(h.pos[0], h.pos[2]), h.pos[2]];   // he runs over the hills
  for (const n of CLIP_NAMES) h.weights[n] = n === gait ? 1 : 0;

  // ---------- the cues
  if (crossed(0.001)) { Sound.play('zoom', near); popWord(V.add(V.lerp(s.from, s.spot, 0.75), [0, 2.0, 0]), 'NYOOOM!', 0.8); }
  if (crossed(0.74)) { Sound.play('screech', near); popWord(V.add(s.spot, [0, 2.05, 0]), 'SKRRT', 0.5); puff(s.spot.slice(), 20, [0.55, 0.53, 0.49, 0.75], 1.7, 0.09, 0.6, 0.8); }
  const at = x => crossedRaw(TAPE_AT + x);
  if (at(GRAB)) Sound.play('click', near);
  if (at(TOSS)) Sound.play('whoosh', near * 0.8);
  if (at(CATCH)) { Sound.play('thud', near * 0.5); popWord(V.add(s.spot, [0, 1.5, 0]), 'HA!', 0.6); }
  if (at(BITE)) Sound.play('chomp', near);
  if (at(RIP)) { Sound.play('rip', near); popWord(V.add(s.spot, [0, 1.6, 0]), 'RIIIP', 0.6); }
  if (at(LAY + (LAID - LAY) * 0.5)) Sound.play('tape', near);
  if (at(LAID - 0.05)) popWord(V.add(s.spot, [0, 1.5, 0]), 'STICKY.', 0.7);
  if (at(YEET)) {                                              // the roll flies off over his shoulder, and lands where it lands
    Sound.play('whoosh', near); popWord(V.add(s.spot, [0, 1.8, 0]), 'YEET!', 0.7);
    const Hw = M3.mul(h.R, h.wr[IDX.hand_R]), back = [-Math.sin(s.face), 0, -Math.cos(s.face)], side = [Math.cos(s.face), 0, -Math.sin(s.face)];
    spawnProp('roll', V.add(bonePos(h, 'hand_R'), M3.vec(Hw, ROLL_IN_HAND)), V.add(V.add(V.mul(back, 3.2), V.mul(side, -1.2)), [0, 4.2, 0]), { R: Hw, scale: 1, life: 40, w: [rand(-9, 9), rand(-4, 4), rand(-9, 9)] });
  }
  if (crossed(1.56)) { Sound.play('set', near); popWord(V.add(s.spot, [0, 1.6, 0]), 'OOK.', 0.7); }
  for (let k = 0; k < 4; k++) if (crossed(1.765 + k * 0.09)) Sound.play('key', near, k);
  for (let k = 0; k < 4; k++) if (crossed(2.2 + k * 0.7 + 0.31) && 2.2 + k * 0.7 < 2.85) { Sound.play('bonk', near * 0.6); puff(V.add(s.spot, M3.vec(M3.ry(s.face), [0, 1.2, 0.42])), 4, [1, 0.8, 0.3, 1], 1.4, 0.03, 0.3, 4); }
  if (crossed(2.9)) { Sound.play('bonk', near); popWord(V.add(s.spot, [0, 2.1, 0]), 'OUCH!!', 0.9); }
  if (crossed(FUSE_AT)) { Sound.play('armed', near, 0, panAt(s.spot)); popWord(V.add(s.spot, [0, 1.6, 0]), 'BEEP BEEP', 0.8); s.lit = true; s.beepAt = game.time; }
  if (crossed(4.0)) popWord(V.add(s.spot, [0, 2.2, 0]), 'OOGA BOOGA!', 1.0);
  if (crossed(5.4)) { Sound.play('huh', near); popWord(V.add(wrong, [0, 2.1, 0]), 'HUH?', 1.0); }
  if (crossed(6.1)) { Sound.play('ooga', near * 0.8); popWord(V.add(wrong, [0, 2.1, 0]), 'OH NO!', 0.8); }
  if (crossed(6.2)) Sound.play('zoom', near * 0.8);

  // ---------- the countdown
  if (s.lit && !s.boom) {
    const left = FUSE - (t - FUSE_AT), c = bombSpot(s);
    tickBomb(s, left, FUSE, c);
    if (left <= 0) {                                             // KABOOM
      s.boom = true; s.boomAt = t; f.gone = true;
      explode(c);
      popWord(V.add(c, [0, 1.6, 0]), 'KABOOM!!', 1.6);
    }
  }
  if (s.boom && t - s.boomAt < 3.5 && Math.random() < dt * 30) {  // it keeps burning a while
    const c = c0(s), v = ball(0.5); v[1] = rand(0.6, 2);
    fx(V.add(c, ball(0.6)), v, rand(0.4, 0.9), rand(0.25, 0.45), [1, 0.45, 0.08, 0.8], -1.5, 0.5, true);
    if (Math.random() < 0.5) fx(V.add(c, [0, 0.5, 0]), [rand(-0.3, 0.3), rand(1.2, 2.2), rand(-0.3, 0.3)], rand(2, 3.5), 0.5, [0.12, 0.12, 0.13, 0.55], -0.6, 0.5);
  }
}
const u01 = x => clamp(x, 0, 1);
const c0 = s => V.add(s.hips, [0, 0.3, 0]);
// where a sound is, left to right from the camera, and how loud it is from you
const panAt = p => { const v = cameraEye(), d = V.norm(V.sub(p, v.eye)), r = V.norm(V.cross(v.fwd, [0, 1, 0])); return clamp(V.dot(d, r) * 0.8, -0.8, 0.8); };
const nearAt = p => clamp(1.5 - V.len(V.sub(p, player.pos)) / 30, 0.25, 1);
// a lit bomb's countdown: bips that come smoothly faster, the seconds over it, one long tone at the end
function tickBomb(b, left, fuse, c) {
  const near = nearAt(c), pan = panAt(c);
  if (b.nextBeep === undefined) b.nextBeep = fuse - 1;
  if (left <= b.nextBeep && left > 0.45) { Sound.play('beep', near, 1 - left / fuse, pan); b.beepAt = game.time; b.nextBeep = left - clamp(0.08 + left * 0.095, 0.11, 1); }
  if (left <= 0.45 && !b.final) { b.final = true; Sound.play('final', near, 0, pan); }
  const n = Math.ceil(left);
  if (n >= 1 && n !== b.shown) { b.shown = n; popWord(V.add(c, [0, 0.9, 0]), String(n), 0.9); }
}

// ---------------------------------------------------------------- your own C4
// 5 to hold it, click to kneel and plant it (on a knocked-out caveman's belly if one is right there),
// G to drop it, E to pick one up. On the baseplate you shake one out of every body you loot.
const C4_FUSE = 5, C4_MAX = 3, PLANT = 2.1;
const C4_HOLD = [0, 0.95, 0.38];
const planted = [];
player.c4 = 0; player.holdC4 = false; player.plantT = -1;
function holdC4(f) {
  if (!f.c4 || f.dead >= 0 || looting) return;
  if (f.holdC4) return;
  equip(f, null); f.holdC4 = true; f.equip = 1; Sound.play('magin', 0.5); hudDirty = true;
}
function giveC4(f, n) { takeItem(f, { t: 'c4', n: n || 1 }, false); }
// where it goes: a body's belly if there is one close in front, otherwise the ground in front of you
function plantSpot(f) {
  const fwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)], at = V.mad(f.pos, fwd, 0.74);
  for (const b of bots) {
    if (b.dead < 1 || b.send || b.gone) continue;
    const belly = bellyTop(b);
    if (Math.hypot(belly[0] - at[0], belly[2] - at[2]) < 0.8) return { p: belly, body: b };
  }
  return { p: [at[0], floorAt(at[0], at[2]), at[2]] };
}
function startPlant(f) {
  if (f.plantT >= 0 || !f.c4) return;
  f.plantT = 0; f.plantAt = plantSpot(f); f.plantYaw = f.yaw;
}
// runs inside playerStep: the carrying pose, and the plant itself
// planting: kneel, set it down, steady it with one hand and punch a code into the keypad with the other, press to arm
// it (only then does the clock start), give it two pats like a good pet, get up
const PL = { kneel: 0.3, set: 0.55, keys: [0.86, 1.0, 1.13, 1.27], arm: 1.45, pats: [1.62, 1.76], up: 1.92 };
function c4Step(f, dt) {
  f.carry = null;
  if (!f.holdC4 || f.dead >= 0 || looting) { if (f.plantT >= 0) { f.plantT = -1; f.script = null; f.scriptW = 0; if (f.plantBomb && !f.plantBomb.armed) f.plantBomb.armed = true; f.plantBomb = null; } return; }
  if (f.plantT < 0) { f.carry = holdGoals(C4_HOLD); f.c4Hold = C4_HOLD; return; }
  const t0 = f.plantT, t = f.plantT += dt, hips0 = Rig.rest[IDX.hips], crossed = at => t0 < at && t >= at;
  const local = M3.vec(M3.ry(-f.yaw), V.sub(f.plantAt.p, f.pos));
  const key = V.add(local, M3.vec(M3.ry(f.plantYaw - f.yaw + Math.PI / 2), V.add(C4.panelAt, [0, 0, -0.05])));   // the keypad, in his space
  const kneel = flow([[0, 0], [PL.kneel, 1], [PL.up - 0.15, 1], [PLANT, 0]], t);
  const lower = smooth(0.08, PL.set, t), c = V.lerp(C4_HOLD, local, lower);
  f.c4Hold = t < PL.set ? c : null;
  const S = {
    hips: V.add(hips0, [0.02 * kneel, -0.33 * kneel, -0.06 * kneel]),
    bend: flow([[0, 0], [PL.kneel, 0.5], [PL.set, 0.65], [PL.keys[0], 0.55], [PL.arm, 0.6], [PL.pats[1], 0.55], [PL.up, 0.1], [PLANT, 0]], t),
    head: M3.rx(flow([[0, 0], [PL.set, 0.4], [PL.arm, 0.45], [PL.arm + 0.12, 0.2], [PL.up, 0], [PLANT, 0]], t)),
    arms: {}, legs: {
      R: { ankle: V.lerp(restAt('foot_R'), [-0.16, 0.07, -0.3], kneel), pole: [-0.2, -0.5, 1], footR: M3.rx(1.1 * kneel) },
      L: { ankle: V.lerp(restAt('foot_L'), [0.18, 0.08, 0.32], kneel), pole: [0.3, 0.3, 1] }
    }
  };
  const G = holdGoals(t < PL.set ? c : local);
  const steady = reach(V.add(local, [0.11, 0.1, 0.02]), [0, -0.6, 0.8], [0, -1, 0], [1, -0.6, -0.3], 0.5);           // left hand flat on the far end
  // right hand: lets go, finger to the keypad, four taps, one firm press, then two pats on top
  let tap = 0;
  for (const at of PL.keys) tap = Math.max(tap, Math.max(0, Math.sin((t - at + 0.06) / 0.12 * Math.PI)) * (t > at - 0.06 && t < at + 0.06 ? 1 : 0));
  const press = Math.max(0, Math.sin((t - PL.arm + 0.09) / 0.18 * Math.PI)) * (t > PL.arm - 0.09 && t < PL.arm + 0.09 ? 1 : 0);
  let pat = 0;
  for (const at of PL.pats) pat = Math.max(pat, Math.max(0, Math.sin((t - at + 0.07) / 0.14 * Math.PI)) * (t > at - 0.07 && t < at + 0.07 ? 1 : 0));
  const finger = reach(V.add(key, [0.01 * Math.sin(t * 23), 0.035 + 0.05 * (1 - tap) * (1 - press) - 0.01 * press, 0]), [0.25, -0.55, 0.8], [0.3, -0.2, -1], [-1, -1, -0.1], 1.1, 0.55);
  const patGoal = reach(V.add(local, [-0.03, 0.12 + 0.08 * (1 - pat), 0]), [0, -0.7, 0.7], [0, -1, 0], [-1, -0.6, -0.2], 0.2);
  let R;
  if (t < PL.set + 0.08) R = G.R;
  else if (t < PL.arm + 0.1) R = armBlend(G.R, finger, smooth(PL.set + 0.08, PL.keys[0] - 0.1, t));
  else if (t < PL.pats[1] + 0.08) R = armBlend(finger, patGoal, smooth(PL.arm + 0.1, PL.pats[0] - 0.06, t));
  else R = armBlend(patGoal, relaxed(), smooth(PL.pats[1] + 0.08, PLANT, t));
  const Lh = t < PL.set + 0.08 ? G.L : t < PL.pats[1] ? armBlend(G.L, steady, smooth(PL.set + 0.08, PL.set + 0.25, t)) : armBlend(steady, relaxed(), smooth(PL.pats[1], PLANT, t));
  S.arms.R = R; S.arms.L = Lh;
  f.script = S;
  f.scriptW = smooth(0, 0.12, t) * (1 - smooth(PLANT - 0.15, PLANT, t));
  if (crossed(PL.set)) {                                         // it's down
    f.c4--;
    f.plantBomb = { p: f.plantAt.p.slice(), R: M3.ry(f.plantYaw), t: 0, owner: f, armed: false };
    planted.push(f.plantBomb);
    Sound.play('set', 0.8); hudDirty = true;
  }
  PL.keys.forEach((at, k) => { if (crossed(at)) { Sound.play('key', 0.8, k); if (f.plantBomb) f.plantBomb.beepAt = game.time; } });
  if (crossed(PL.arm) && f.plantBomb) { f.plantBomb.armed = true; f.plantBomb.t = 0; f.plantBomb.beepAt = game.time; Sound.play('armed', 0.9, 0, 0); }
  for (const at of PL.pats) if (crossed(at)) Sound.play('thud', 0.3);
  if (t >= PLANT) {
    f.plantT = -1; f.script = null; f.scriptW = 0; f.plantBomb = null;
    if (!f.c4) f.holdC4 = false;
    syncC4(f);
  }
}
function plantedStep(dt) {
  for (let i = planted.length - 1; i >= 0; i--) {
    const b = planted[i];
    if (!b.armed) continue;                                      // still having its code typed in
    b.t += dt;
    const left = C4_FUSE - b.t;
    tickBomb(b, left, C4_FUSE, b.p);
    if (left <= 0) {
      planted.splice(i, 1);
      const c = V.add(b.p, [0, 0.08, 0]);
      explode(c, b.owner);
    }
  }
}
function drawPlanted(prog) {
  for (const b of planted) drawC4(prog, b.p, b.R, true, Math.max(b.armed ? 0 : -0.25, 1 - (game.time - (b.beepAt || -9)) / 0.12));
  const f = player;
  if (f.holdC4 && f.c4Hold && f.dead < 0 && !looting && !f.gone) {
    const R = M3.mul(M3.ry(f.yaw), M3.rx(f.tilt || 0));
    drawC4(prog, V.add(V.add(f.pos, [0, f.air || 0, 0]), M3.vec(R, f.c4Hold)), R, false, 0);
  }
}

function sendsStep(dt) {
  ragsStep(dt);
  blastsStep(dt);
  plantedStep(dt);
  for (const s of sends.slice()) {
    if (!sends.includes(s)) continue;        // your own respawn just cleared everyone's
    if (!s.placed && s.t + dt >= 0) { s.placed = true; placeSend(s); if (s.f.isPlayer) aimDeathCam(); }
    sendStep(s, dt);
    if (s.t >= s.end) {
      const f = s.f;
      endSend(f);
      if (royaleOn()) f.gone = true;                         // on the island there is no coming back
      else if (!f.isPlayer) spawnBot(f, bots.indexOf(f)); else respawnPlayer();
    }
  }
}

// ---------------------------------------------------------------- drawing the party
// a thin rod from a to b
function rod(prog, a, b, thick) {
  const d = V.sub(b, a), len = V.len(d);
  if (len < 1e-3) return;
  const y = V.mul(d, 1 / len), x = V.norm(V.cross(y, Math.abs(y[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])), z = V.cross(x, y);
  drawMesh(prog, meshes.shell, M3.cols(V.mul(x, thick), V.mul(y, len), V.mul(z, thick)), V.lerp(a, b, 0.5));
}
const scaled = (R, x, y, z) => M3.mul(R, [x, 0, 0, 0, y, 0, 0, 0, z]);
// where the roll of tape is during the bomb visit: on his hip, in his hand, in the air, or already thrown away
const ROLL_IN_HAND = [-0.08, -0.065, 0.01];
function drawRollAt(prog, s, h) {
  if (h.gone || (s.u !== undefined && s.u >= YEET)) return;
  const u = s.u === undefined ? -1 : s.u, Hw = M3.mul(h.R, h.wr[IDX.hand_R]);
  const inHand = { p: V.add(bonePos(h, 'hand_R'), M3.vec(Hw, ROLL_IN_HAND)), R: Hw };
  let r;
  if (u < GRAB) { const Rh = M3.mul(h.R, h.wr[IDX.hips]); r = { p: V.add(bonePos(h, 'hips'), M3.vec(Rh, [-0.2, 0.03, -0.1])), R: M3.mul(Rh, M3.rz(Math.PI / 2)) }; }
  else if (u >= TOSS && u < CATCH) {                          // up it goes, spinning, and back down into his hand
    const w = (u - TOSS) / (CATCH - TOSS);
    r = { p: V.add(inHand.p, [0, 0.62 * 4 * w * (1 - w), 0]), R: M3.mul(Hw, M3.rx(w * Math.PI * 4)) };
  } else r = inHand;
  drawRoll(prog, r.p, r.R);
  // tape coming off the roll: stretched to his teeth, then to the end of the strip being laid
  const rim = to => V.add(r.p, V.mul(V.norm(V.sub(to, r.p)), 0.065));
  const across = M3.vec(r.R, [0, 1, 0]);
  if (u >= RIP && u < LAY) { const m = V.add(bonePos(h, 'head'), M3.vec(M3.mul(h.R, h.wr[IDX.head]), [0, 0.0, 0.13])); drawStrip(prog, rim(m), m, across); }
  else if (u >= LAY && u < LAID && s.tapeEnd) drawStrip(prog, rim(s.tapeEnd), s.tapeEnd, across);
}
function drawSends(prog) {
  if (!sends.length) return;
  const P = party(), I = M3.id();
  for (const s of sends) {
    const f = s.f, h = s.helper, t = s.t;
    if (t < 0) continue;
    if (!h.gone) {                                            // party hat (he wears it to the bomb job too)
      const top = M3.mul(h.R, h.wr[IDX.head]), at = V.add(bonePos(h, 'head'), M3.vec(top, [0, 0.285, 0.035]));
      const R = M3.mul(top, M3.rz(-0.18));
      flat(prog, [0.85, 0.03, 0.28], 0.35, 0.2); drawMesh(prog, P.cone, scaled(R, 0.095, 0.25, 0.095), at);
      flat(prog, [0.95, 0.72, 0.02], 0.4, 0.2); drawMesh(prog, P.pom, scaled(R, 0.04, 0.04, 0.04), V.add(at, M3.vec(R, [0, 0.255, 0])));
    }
    const chest = !f.gone ? bonePos(f, 'chest') : null;

    if (s.bomb && !(s.boom)) {                                // the bomb, and the poor helper's sore head
      if (s.hold) {                                           // in his hands
        const R = M3.mul(M3.ry(h.yaw), M3.rx(h.tilt));
        drawC4(prog, V.add(h.pos, M3.vec(R, s.hold)), R, false, 0);
      } else {
        const seat = s.seat || { at: bombSpot(s), R: M3.ry(s.face) };
        drawC4(prog, seat.at, seat.R, !!s.lit, s.lit ? Math.max(0, 1 - (game.time - s.beepAt) / 0.12) : 0);
        s.tapeEnd = drawTape(prog, seat.at, seat.R, s.tape || 0, seat.skin);
      }
      drawRollAt(prog, s, h);
      if (s.bonk > 0 && !h.gone) {                            // seeing stars
        const head = V.add(bonePos(h, 'head'), [0, 0.38, 0]);
        flat(prog, [0.95, 0.65, 0.02], 0.3, 0.7);
        for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; drawMesh(prog, starMesh, M3.mul(M3.ry(a * 0.5), M3.rz(a)).map(x => x * 1.3), V.add(head, [Math.cos(a) * 0.2, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.2])); }
      }
    }
    if (!s.bomb && t >= 1.98 && t < 5.7) {                               // the pump stays until he leaves
      const R = M3.ry(s.face), at = q => V.add(s.spot, M3.vec(R, q));
      const top = t < 4.0 && s.handle ? s.handle : 0.98;
      flat(prog, [0.05, 0.05, 0.06], 0.4, 0.6); drawMesh(prog, meshes.shell, scaled(R, 0.30, 0.04, 0.16), at([0, 0.02, 0.40]));
      flat(prog, [0.75, 0.04, 0.03], 0.3, 0.4); drawMesh(prog, meshes.shell, scaled(R, 0.11, 0.52, 0.11), at([0, 0.30, 0.40]));
      flat(prog, [0.55, 0.57, 0.60], 0.25, 0.9); rod(prog, at([0, 0.54, 0.40]), at([0, top, 0.40]), 0.03);
      flat(prog, [0.05, 0.05, 0.06], 0.5, 0.3); drawMesh(prog, meshes.shell, scaled(R, 0.40, 0.05, 0.05), at([0, top, 0.40]));
      if (t < 3.9 && chest) {                                 // hose, sagging to the body
        const a = at([0, 0.07, 0.46]), b = chest, mid = V.add(V.lerp(a, b, 0.5), [0, -0.12, 0]);
        let last = a;
        for (let k = 1; k <= 8; k++) { const u = k / 8, p = V.lerp(V.lerp(a, mid, u), V.lerp(mid, b, u), u); p[1] = Math.max(p[1], floorAt(p[0], p[2]) + 0.02); rod(prog, last, p, 0.022); last = p; }
      }
    }
    if (!s.bomb && !f.gone) for (let k = 0; k < s.tied; k++) {           // balloons
      const b = BALLOONS[k], anchor = bonePos(f, b.bone), fill = Math.max(0, s.inflate);
      const radius = 0.045 + 0.19 * fill, tall = radius * (0.3 + 0.92 * Math.min(1, fill * 1.4));
      const len = 0.05 + b.len * smooth(0.1, 0.9, fill);
      const sway = Math.sin(t * 2.3 + k * 1.9) * 0.06 * fill, trail = V.mul(s.rise, -Math.min(0.012, 0.012 * fill));
      const c = V.add(anchor, [b.out[0] * fill + sway + trail[0], len + tall * 0.6, b.out[1] * fill + Math.cos(t * 1.7 + k) * 0.05 * fill + trail[2]]);
      const lean = M3.frame([0, 1, 0], [1, 0, 0], V.sub(c, anchor), [1, 0, 0]);
      const R = M3.mix(I, lean, Math.min(1, fill));
      flat(prog, b.color, 0.16, 0.25); drawMesh(prog, P.balloon, scaled(R, radius, tall, radius), c);
      const knot = V.add(c, M3.vec(R, [0, -tall - 0.035, 0]));
      drawMesh(prog, P.cone, scaled(R, 0.03, 0.05, 0.03), knot);
      flat(prog, [0.80, 0.80, 0.76], 0.8, 0.0); rod(prog, anchor, knot, 0.007);
    }
    if (s.sparkle) {
      const u = (t - s.sparkle.t) / 0.7;
      if (u < 1) {
        const k = Math.sin(Math.PI * u) * 22, face = M3.mul(M3.ry(cam.yaw), M3.rz(u * 2.5));
        flat(prog, [1.0, 0.62, 0.0], 0.6, 0.0); drawMesh(prog, starMesh, face.map(v => v * k), s.sparkle.p);
      }
    }
  }
}

// ---------------------------------------------------------------- watching yourself leave
let deathCam = 0, deathShot = null;
function aimDeathCam() {
  const s = player.send;
  deathShot = { eye: V.add(s.hips, V.add(V.mul(s.out, -4.3), [0, 1.9, 0])), at: V.add(s.hips, [0, 0.55, 0]), base: V.add(s.hips, [0, 0.55, 0]) };
}
function deathCamStep(dt) {
  if (player.dead < 0 || !deathShot) { deathCam = 0; return; }
  deathCam = Math.min(1, deathCam + dt / 0.7);
  const s = player.send;
  if (!s || s.t < 0) return;
  const up = Math.min(1, Math.max(0, s.t - 3.7) / 1.0);
  const want = V.add(deathShot.base, V.mul(s.rise, up));
  deathShot.at = V.lerp(deathShot.at, want, Math.min(1, dt * 6));
}
function deathCamera(view) {
  if (deathCam <= 0.001 || !deathShot) return view;
  const k = smooth(0, 1, deathCam), eye = V.lerp(view.eye, deathShot.eye, k);
  const fwd = V.norm(V.lerp(view.fwd, V.norm(V.sub(deathShot.at, deathShot.eye)), k));
  return { eye, fwd, at: view.at, dist: view.dist };
}
