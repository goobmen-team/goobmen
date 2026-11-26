// ======================================================================= jumping
// squash, spring off, tuck, reach for the ground, land with a squish
const JUMP = { speed: 3.9, gravity: 12.5, pre: 0.09, preMoving: 0.04, land: 0.28, landMoving: 0.16 };
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
    if (mine) cam.shake = Math.max(cam.shake, 0.4);
  }
  if (f.jump >= T.end) f.jump = -1;
}
// how the body is shaped this frame: null when not jumping
function jumpShape(f) {
  if (f.jump < 0 || f.dead >= 0) return null;
  const T = jumpTimes(f), t = f.jump, u = clamp((t - T.pre) / JUMP.air, 0, 1);
  const squash = t < T.pre ? smooth(0, T.pre, t) : t < T.down ? 1 - smooth(T.pre, T.pre + 0.08, t) : track([[T.down, 0], [T.down + 0.06, 1.15], [T.down + T.land * 0.62, 0.15], [T.end, 0]], t);
  const air = t >= T.pre && t < T.down;
  const tuck = air ? smooth(0.04, 0.42, u) * (1 - smooth(0.62, 0.97, u)) : 0;
  const stretch = air ? 1 - smooth(0.05, 0.35, u) : 0;
  const w = smooth(0, 0.04, t) * (1 - smooth(T.end - 0.08, T.end, t));
  const moving = f.jumpMoving ? 1 : 0, way = f.jumpBack ? -1 : 1;
  const shape = {
    w, drop: -0.19 * squash + 0.035 * stretch,
    bend: 0.42 * squash + (moving ? 0.2 : 0.1) * tuck - 0.16 * stretch,
    head: -0.18 * squash + 0.12 * tuck,
    legs: {}, arms: {}
  };
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    const rest = Rig.rest[IDX['foot_' + s]], lead = s === 'L';
    // standing: both knees up. moving: a big caveman stride through the air
    const lift = moving ? (lead ? 0.24 : 0.36) : 0.36, reach = moving ? (lead ? 0.40 : -0.36) * way : 0.09;
    shape.legs[s] = { ankle: V.add(rest, [x * 0.06 * tuck, lift * tuck - 0.025 * stretch, reach * tuck - 0.07 * stretch]), foot: M3.rx(0.55 * stretch + (moving && !lead ? 0.7 : -0.2) * tuck) };
    // free arms fling up: back for the wind-up, high at the top, out for balance on landing
    const wrist = track([[0, [x * 0.42, 0.66, 0.02]], [T.pre, [x * 0.50, 0.80, -0.38]], [T.pre + JUMP.air * 0.3, [x * 0.66, 1.78, 0.12]], [T.pre + JUMP.air * 0.65, [x * 0.82, 1.66, 0.05]], [T.down, [x * 0.80, 1.12, 0.18]], [T.down + 0.08, [x * 0.68, 0.82, 0.30]], [T.end, [x * 0.42, 0.66, 0.05]]], t);
    shape.arms[s] = { wrist, dir: V.norm([x * 0.5, wrist[1] > 1.2 ? 0.8 : -0.8, 0.25]), palm: [-x * 0.3, 0, 1], pole: [x * 0.4, -0.3, -1], curl: [0.3, 0.3] };
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
function deathCues(f, prev) {
  const crossed = at => prev < at && f.dead >= at, loud = f.isPlayer ? 1 : 0.55;
  if (crossed(0.02)) Sound.play('ugh', loud);
  if (crossed(0.5)) Sound.play('thud', loud * 0.5);
  if (crossed(1.0)) {
    Sound.play('thud', loud);
    const back = [-Math.sin(f.yaw), 0, -Math.cos(f.yaw)];
    puff(V.add(V.mad(f.pos, back, 0.9), [0, 0.08, 0]), 16, [0.52, 0.50, 0.46, 0.7], 1.2, 0.08, 0.6, 1.2);
  }
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
  const back = [-Math.sin(f.yaw), 0, -Math.cos(f.yaw)], hips = V.mad(f.pos, back, 0.72);
  const perp = [Math.cos(f.yaw), 0, -Math.sin(f.yaw)];
  // he works on the far side of the body, so the camera can see
  const eye = cameraEye().eye;
  const side = (eye[0] - hips[0]) * perp[0] + (eye[2] - hips[2]) * perp[2] > 0 ? -1 : 1;
  const out = V.mul(perp, side);
  let away = V.norm([hips[0] - player.pos[0], 0, hips[2] - player.pos[2]]);
  if (f.isPlayer) away = out;
  const spot = V.add([hips[0], f.pos[1], hips[2]], V.mul(out, 0.92));
  const from = V.add(spot, V.add(V.mul(out, 11), V.mul(back, 9)));
  const helper = makeFighter(false, [1.2, 1.1, 0.35]);
  helper.pos = from.slice(); helper.gone = true;
  const s = { f, helper, t: -(delay || 0), prev: -(delay || 0) - 1, spot, from, hips, out, away, face: Math.atan2(-out[0], -out[2]), inflate: 0, inflateV: 0, strokes: 0, tied: 0, rise: [0, 0, 0], sparkle: null,
    bomb: !!bomb, end: bomb ? FUSE_AT + FUSE + 1.3 : f.isPlayer ? 7.9 : 10.2 };
  f.send = s; sends.push(s); helpers.push(helper);
  return s;
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
    f.script = S; f.scriptW = 1;
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
const bombSpot = s => V.add(bonePos(s.f, 'chest'), [0, 0.17, 0]);
let blast = null;
const fx = (p, v, life, size, color, grav, grow, add) => particles.push({ p: p.slice(), v, life, max: life, size, color, grav, grow, add });
const ball = r => [rand(-1, 1) * r, rand(-0.3, 1) * r, rand(-1, 1) * r];
// a proper explosion: flash, fireball, sparks, a ring of dust, a column of black smoke, scorching and flying junk
function explode(c) {
  const d = Math.hypot(c[0] - player.pos[0], c[2] - player.pos[2]);
  Sound.play('explode', clamp(1.7 - d / 40, 0.35, 1));
  if (d < 14) Sound.play('ring', 1 - d / 14);
  cam.shake = Math.max(cam.shake, clamp(1.7 - d / 22, 0, 1));
  blast = { p: c.slice(), t: game.time };
  for (let i = 0; i < 10; i++) fx(V.add(c, ball(0.3)), ball(1.5), rand(0.12, 0.22), rand(1.0, 1.7), [1, 0.95, 0.8, 1], 0, 2, true);
  for (let i = 0; i < 90; i++) { const v = ball(rand(2, 8)); v[1] = Math.abs(v[1]) * 0.9 + 1.5; fx(V.add(c, ball(0.4)), v, rand(0.5, 1.2), rand(0.3, 0.6), i % 3 ? [1, 0.5, 0.1, 0.9] : [1, 0.8, 0.3, 0.9], -1.2, 0.9, true); }
  for (let i = 0; i < 90; i++) { const v = ball(rand(6, 17)); v[1] = Math.abs(v[1]) * 0.8 + 2; fx(c, v, rand(0.9, 1.9), 0.022, [1, 0.8, 0.35, 1], 9, 0, true); }
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, sp = rand(8, 11); fx(V.add(c, [0, 0.15, 0]), [Math.cos(a) * sp, rand(0, 0.6), Math.sin(a) * sp], rand(0.9, 1.4), rand(0.4, 0.6), [0.55, 0.49, 0.4, 0.55], 0, 0.9); }
  for (let i = 0; i < 70; i++) { const v = ball(rand(1, 3)); v[1] = rand(2, 6); fx(V.add(c, ball(0.5)), v, rand(2.5, 4.5), rand(0.5, 0.9), [0.11, 0.11, 0.12, 0.8], -1, 0.55); }
  for (let i = 0; i < 28; i++) { const a = rand(0, 6.3), r = Math.sqrt(Math.random()) * 1.5, x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r; marks.push([x, floorAt(x, z), z]); }
  while (marks.length > 90) marks.shift();
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.3), sp = rand(3, 8); spawnProp(['rock', 'bone', 'fish', 'meat', 'rock'][i % 5], V.add(c, [0, 0.3, 0]), [Math.cos(a) * sp, rand(5, 11), Math.sin(a) * sp], { life: 6, floor: floorAt(c[0], c[2]) + 0.06 }); }
  for (const v of [player, ...bots]) {
    const dd = Math.hypot(v.pos[0] - c[0], v.pos[2] - c[2]);
    if (v.dead < 0 && dd < 7) damage(v, Math.round(25 + 75 * (1 - dd / 7)), { pos: c });
  }
}
// the C4: two bricks and a tape strip, a detonator with a blinking light
function drawC4(prog, at, R, t, left, lit) {
  const P = party(), I = M3.id(), q = o => V.add(at, M3.vec(R, o));
  flat(prog, [0.76, 0.72, 0.6], 0.85, 0.0); drawMesh(prog, meshes.shell, scaled(R, 0.34, 0.1, 0.19), at);
  flat(prog, [0.06, 0.06, 0.06], 0.6, 0.1); drawMesh(prog, meshes.shell, scaled(R, 0.035, 0.104, 0.195), at);
  flat(prog, [0.08, 0.08, 0.1], 0.35, 0.5); drawMesh(prog, meshes.shell, scaled(R, 0.13, 0.04, 0.09), q([0.07, 0.07, 0]));
  const on = lit && (left < 1 ? true : Math.sin(t * (left > 3 ? 6.3 : 20)) > 0);
  flat(prog, [0.02, 0.18, 0.04], 0.3, 0.0); drawMesh(prog, meshes.shell, scaled(R, 0.075, 0.012, 0.045), q([0.075, 0.095, 0.01]));
  flat(prog, on ? [1, 0.08, 0.04] : [0.3, 0.04, 0.03], 0.3, 0.0); drawMesh(prog, P.pom, scaled(R, 0.024, 0.024, 0.024), q([-0.05, 0.1, -0.025]));
  flat(prog, [0.75, 0.1, 0.06], 0.5, 0.0); rod(prog, q([0.0, 0.09, 0.0]), q([-0.16, 0.12, 0.07]), 0.008); rod(prog, q([-0.16, 0.12, 0.07]), q([-0.2, 0.05, 0.075]), 0.008);
  flat(prog, [0.1, 0.1, 0.65], 0.5, 0.0); rod(prog, q([0.0, 0.09, -0.02]), q([-0.12, 0.14, -0.09]), 0.008);
}
function bombStep(s, dt) {
  const f = s.f, h = s.helper;
  s.prev = s.t; s.t += dt;
  const t = s.t;
  if (t < 0) return;
  h.time += dt;
  const crossed = at => s.prev < at && t >= at;
  const near = clamp(1.5 - V.len(V.sub(s.spot, player.pos)) / 30, 0.25, 1);
  const wrong = V.mad(s.spot, s.away, -3.2);                   // he runs the wrong way first
  h.gone = false; h.script = null; h.scriptW = 0; h.tilt = 0;
  let gait = 'Idle';
  const runTo = (a, b, u) => { h.pos = V.lerp(a, b, u); h.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]); gait = 'Run'; h.phase = (h.phase + dt * 5.5) % 1; h.tilt = 0.38; };
  const dust = () => puff([h.pos[0], floorAt(h.pos[0], h.pos[2]) + 0.07, h.pos[2]], 3, [0.55, 0.53, 0.49, 0.6], 0.5, 0.1, 0.5, -0.2);
  const arm = (x, wrist, dir, palm, curl) => ({ wrist, dir: dir || [0, -0.3, 1], palm: palm || [-x, 0, 0], pole: [x, -0.4, -0.5], curl: [curl === undefined ? 0.7 : curl, curl === undefined ? 0.7 : curl] });
  const hips0 = Rig.rest[IDX.hips];
  const script = (S, w) => { h.script = S; h.scriptW = w === undefined ? 1 : w; };
  s.bonk = 0;

  if (t < 0.72) {                                              // here he comes, hugging a big black ball
    runTo(s.from, s.spot, 1 - Math.pow(1 - u01(t / 0.72), 1.35)); dust();
  } else if (t < 1.0) {                                        // brakes, a bit too late
    h.pos = s.spot.slice();
    const dirIn = Math.atan2(s.spot[0] - s.from[0], s.spot[2] - s.from[2]), turn = smooth(0.82, 1.0, t);
    h.yaw = dirIn + wrap(s.face - dirIn) * turn; h.tilt = -0.42 * (1 - turn); dust();
  } else if (t < 2.2) {                                         // puts the bomb down, then pats it. twice. good bomb.
    h.pos = s.spot.slice(); h.yaw = s.face;
    const pat = Math.max(0, Math.sin((t - 1.5) * 13)) * smooth(1.45, 1.6, t) * (1 - smooth(2.0, 2.15, t));
    const S = { hips: V.add(hips0, [0, -0.30, -0.12]), bend: 1.0, head: M3.rx(-0.3), arms: {} };
    for (const [side, x] of [['R', -1], ['L', 1]]) S.arms[side] = arm(x, [x * 0.2, 0.52 + pat * 0.1, 0.5], [0, -0.5, 1], [0, -1, 0], 0.4);
    script(S, smooth(1.0, 1.15, t) * (1 - smooth(2.05, 2.2, t)));
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
  if (crossed(1.2)) { Sound.play('thud', near); popWord(V.add(s.spot, [0, 1.9, 0]), 'OOK.', 0.7); }
  for (const at of [1.55, 1.9]) if (crossed(at)) Sound.play('click', near);
  for (let k = 0; k < 4; k++) if (crossed(2.2 + k * 0.7 + 0.31) && 2.2 + k * 0.7 < 2.85) { Sound.play('bonk', near * 0.6); puff(V.add(s.spot, M3.vec(M3.ry(s.face), [0, 1.2, 0.42])), 4, [1, 0.8, 0.3, 1], 1.4, 0.03, 0.3, 4); }
  if (crossed(2.9)) { Sound.play('bonk', near); popWord(V.add(s.spot, [0, 2.1, 0]), 'OUCH!!', 0.9); }
  if (crossed(FUSE_AT)) { Sound.play('beep', near); popWord(V.add(s.spot, [0, 1.6, 0]), 'BEEP BEEP', 0.8); s.lit = true; }
  if (crossed(4.0)) popWord(V.add(s.spot, [0, 2.2, 0]), 'OOGA BOOGA!', 1.0);
  if (crossed(5.4)) { Sound.play('huh', near); popWord(V.add(wrong, [0, 2.1, 0]), 'HUH?', 1.0); }
  if (crossed(6.1)) { Sound.play('ooga', near * 0.8); popWord(V.add(wrong, [0, 2.1, 0]), 'OH NO!', 0.8); }
  if (crossed(6.2)) Sound.play('zoom', near * 0.8);

  // ---------- the countdown
  if (s.lit && !s.boom) {
    const left = FUSE - (t - FUSE_AT), c = bombSpot(s);
    if (s.nextBeep === undefined) s.nextBeep = FUSE;
    if (left <= s.nextBeep) { Sound.play('beep', near); s.nextBeep = left > 3.5 ? Math.floor(left - 0.01) : left > 1.5 ? left - 0.5 : left - 0.2; }
    for (let n = FUSE; n >= 1; n--) if (s.prev - FUSE_AT < FUSE - n && t - FUSE_AT >= FUSE - n) popWord(V.add(c, [0, 0.9, 0]), String(n), 0.9);
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
function sendsStep(dt) {
  for (const s of sends.slice()) {
    if (!sends.includes(s)) continue;        // your own respawn just cleared everyone's
    sendStep(s, dt);
    if (s.t >= s.end) {
      const f = s.f;
      endSend(f);
      if (f.isPlayer) respawnPlayer(); else spawnBot(f, bots.indexOf(f));
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
      const hand = V.add(bonePos(h, 'hand_R'), [0, 0.12, 0.1]), left = FUSE - (t - FUSE_AT);
      let at = t < 1.0 ? hand : t < 1.4 ? V.lerp(hand, bombSpot(s), smooth(1.0, 1.4, t)) : bombSpot(s);
      drawC4(prog, at, t < 1.4 ? M3.ry(h.yaw + 0.4) : M3.ry(f.yaw + 0.3), t, left, !!s.lit);
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
