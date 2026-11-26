'use strict';
(async function () {
// ======================================================================= weapons
// all points are in the gun's own space: origin in the pistol grip, +Z muzzle, +Y up, +X shooter's left
const GUNS = {
  ak: {
    name: 'AK-74', article: 'an', auto: true, rate: 650, mag: 30, reserve: 90, damage: 27, reload: 2.35, spread: 0.006, bloom: 0.006, maxBloom: 0.05,
    kickUp: 0.025, kickSide: 0.010, kickBack: 0.075, climb: 0.18,
    scale: 1.16, hip: [-0.33, 1.13, 0.20], ads: [-0.30, 1.27, 0.19], blade: -0.80,
    muzzle: [0, 0.0905, 0.665], port: [-0.022, 0.108, 0.15], magPoint: [0, -0.04, 0.17], boltPoint: [-0.035, 0.105, 0.185], boltTravel: 0.075,
    right: { at: [0, -0.004, 0.0], dir: [0.18, 0.05, 1], palm: [1, 0, 0], curl: [1.15, 1.25] },
    left: { at: [0.006, 0.043, 0.27], dir: [-0.75, -0.05, 0.7], palm: [0, 1, 0], curl: [1.2, 1.35] },
    shell: [0.008, 0.008, 0.034], sound: 'ak', flash: 1.25
  },
  glock: {
    name: 'Glock 17', article: 'a', auto: false, rate: 420, mag: 17, reserve: 68, damage: 24, reload: 1.55, spread: 0.008, bloom: 0.012, maxBloom: 0.05,
    kickUp: 0.032, kickSide: 0.008, kickBack: 0.055, climb: 0.34,
    scale: 1.32, hip: [-0.30, 1.17, 0.40], ads: [-0.27, 1.31, 0.42], blade: -0.55,
    muzzle: [0, 0.077, 0.19], port: [-0.015, 0.085, 0.06], magPoint: [0, -0.07, -0.015], boltPoint: [0, 0.075, -0.015], boltTravel: 0.042,
    right: { at: [0, -0.002, -0.006], dir: [0.15, 0.1, 1], palm: [1, 0, 0], curl: [1.2, 1.3] },
    left: { at: [0.012, -0.022, 0.012], dir: [-0.45, 0.1, 1], palm: [-1, 0, 0], curl: [1.0, 1.1] },
    shell: [0.008, 0.008, 0.017], sound: 'glock', flash: 0.8
  },
  awp: {
    name: 'AWP', article: 'an', auto: false, rate: 44, mag: 5, reserve: 20, damage: 160, reload: 3.1, spread: 0.045, bloom: 0.02, maxBloom: 0.05,
    kickUp: 0.085, kickSide: 0.014, kickBack: 0.12, climb: 0.36,
    scale: 1.04, hip: [-0.31, 1.12, 0.17], ads: [-0.28, 1.28, 0.16], blade: -0.80,
    muzzle: [0, 0.068, 0.90], port: [-0.022, 0.082, 0.10], magPoint: [0, -0.025, 0.127], boltPoint: [-0.056, 0.048, 0.057], boltTravel: 0.065,
    boltAction: true, boltAxis: [0, 0.0703, 0], cycle: 1.3, scoped: true, draw: 0.75,
    right: { at: [0, -0.004, 0.0], dir: [0.18, 0.05, 1], palm: [1, 0, 0], curl: [1.15, 1.25] },
    left: { at: [0.008, 0.012, 0.285], dir: [-0.75, -0.05, 0.7], palm: [0, 1, 0], curl: [1.15, 1.3] },
    shell: [0.012, 0.012, 0.07], sound: 'awp', flash: 1.8
  }
};
const SLOTS = ['ak', 'glock', 'awp'];
await loadCaveman(window.MODEL_B64);
await loadGun(GUNS.ak, window.GUN_DATA.ak);
await loadGun(GUNS.glock, window.GUN_DATA.glock);
await loadGun(GUNS.awp, window.GUN_DATA.awp);
const IDX = Rig.idx, NB = Rig.NB;

// ======================================================================= scene
const HALF = 30;
const plate = (() => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attrib(0, new Float32Array([-HALF, 0, HALF, HALF, 0, HALF, HALF, 0, -HALF, -HALF, 0, HALF, HALF, 0, -HALF, -HALF, 0, -HALF]), 3, gl.FLOAT);
  gl.bindVertexArray(null); return vao;
})();
const meshes = {
  chest: mergeMesh([boxData(0.9, 0.05, 0.56, 0, 0.025, 0), boxData(0.9, 0.44, 0.05, 0, 0.22, 0.255), boxData(0.9, 0.44, 0.05, 0, 0.22, -0.255), boxData(0.05, 0.44, 0.46, 0.425, 0.22, 0), boxData(0.05, 0.44, 0.46, -0.425, 0.22, 0)]), lid: boxMesh(0.94, 0.14, 0.60, 0, 0.07, 0.30), band: boxMesh(0.07, 0.47, 0.59, 0, 0.225, 0),
  lidband: boxMesh(0.07, 0.165, 0.62, 0, 0.07, 0.30), strap: boxMesh(0.07, 0.45, 0.035, 0, 0.225, 0), lock: boxMesh(0.11, 0.13, 0.03, 0, 0.34, 0.29), shell: boxMesh(1, 1, 1)
};
const SHADOW = 2048;
const shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
const shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0); gl.drawBuffers([gl.NONE]); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
const fxVao = gl.createVertexArray(), fxBuf = gl.createBuffer();
gl.bindVertexArray(fxVao); gl.bindBuffer(gl.ARRAY_BUFFER, fxBuf);
attrib(0, null, 3, gl.FLOAT, false, 36, 0); attrib(1, null, 2, gl.FLOAT, false, 36, 12); attrib(2, null, 4, gl.FLOAT, false, 36, 20);
gl.bindVertexArray(null);

//MAP//
// ======================================================================= fighters
function makeFighter(isPlayer, tint) {
  return {
    isPlayer, tint, pos: [0, 0, 0], yaw: 0, hp: 100, dead: -1, weapon: null, ammo: {}, inv: [],
    pose: newPose(), weights: { Idle: 1, Walk: 0, Run: 0, Crouch: 0, CrouchWalk: 0 }, phase: 0, time: rand(0, 9), legYaw: 0, back: false,
    moveRel: 0, speed: 0, vel: [0, 0], jump: -1, jumpMoving: false, jumpBack: false, air: 0, tilt: 0, send: null, gone: false, crouch: false,
    aimW: 0, ads: 0, sprintW: 0, equip: 1, cycle: -1, inspect: -1, script: null, scriptW: 0, looted: false, beingLooted: false, reload: -1, cool: 0, kick: 0, kickV: 0, rise: 0, riseV: 0, roll: 0, bolt: 0, bloom: 0, punch: -1,
    target: [0, 1.2, 10], hurt: 0, bones: new Float32Array(NB * 16), wr: new Array(NB), wp: new Array(NB), gun: null, model: new Float32Array(16),
    ai: { wait: rand(0.8, 1.8), burst: 0, strafe: 1, strafeT: 0, seen: false }
  };
}
const player = makeFighter(true, [1, 1, 1]);
const bots = [[0.78, 0.95, 0.72], [1.0, 0.72, 0.66], [0.72, 0.82, 1.05]].map(t => makeFighter(false, t));
const fighters = [player, ...bots];
function give(f, id, spare) {
  const g = GUNS[id];
  if (!f.inv.includes(id)) { f.inv.push(id); f.inv.sort((a, b) => SLOTS.indexOf(a) - SLOTS.indexOf(b)); f.ammo[id] = { clip: g.mag, spare: spare === undefined ? g.reserve : spare }; }
  else f.ammo[id].spare = Math.min(g.reserve * 3, f.ammo[id].spare + g.mag * 2);
}
function equip(f, id) {
  if (f.weapon === id || (id && !f.inv.includes(id))) return;
  f.weapon = id; f.equip = 0; f.reload = -1; f.cool = Math.max(f.cool, 0.2); f.bolt = 0; f.cycle = -1; f.inspect = -1;
  if (f.isPlayer) { Sound.play('rack', 0.5); hudDirty = true; }
}
function spawnBot(b, i) {
  endSend(b);
  const a = Math.PI + (i - 1) * 0.75 + rand(-0.25, 0.25), d = rand(13, 19);
  b.pos = [clamp(player.pos[0] + Math.sin(a) * d, -HALF + 2, HALF - 2), 0, clamp(player.pos[2] + Math.cos(a) * d, -HALF + 2, HALF - 2)];
  if (world.map === 'island') { b.pos = [player.pos[0] + Math.sin(a) * d, 0, player.pos[2] + Math.cos(a) * d]; confine(b); b.pos[1] = groundAt(b.pos[0], b.pos[2]); }
  b.hp = 100; b.dead = -1; b.hurt = 0; b.air = 0; b.jump = -1; b.looted = b.beingLooted = false; b.script = null; b.scriptW = 0; b.cycle = -1; b.inv = []; b.ammo = {}; b.weapon = null; b.crouch = false; b.ai.wait = rand(1.0, 2.2); b.ai.seen = false;
  give(b, i === 1 ? 'ak' : 'glock', 999); equip(b, b.inv[0]);
  b.yaw = Math.atan2(player.pos[0] - b.pos[0], player.pos[2] - b.pos[2]);
}
const chests = [['glock', -2.2, -3.2], ['awp', 0, -4.7], ['ak', 2.2, -3.2]].map(([gun, x, z]) => ({ pos: [x, 0, z], gun, open: 0, openV: 0, wobble: 0, t: -1, forced: false }));
player.yaw = Math.PI;
bots.forEach(spawnBot);

// ======================================================================= posing
const UP_CHEST = [IDX.spine, IDX.chest];
const ARM = s => ({ up: IDX['upperArm_' + s], fore: IDX['foreArm_' + s], hand: IDX['hand_' + s], fingers: IDX['fingers_' + s], tips: IDX['fingerTips_' + s], thumb: IDX['thumb_' + s], x: s === 'L' ? 1 : -1 });
const ARMS = { R: ARM('R'), L: ARM('L') };

function yawOf(R, a) { return M3.mul(M3.ry(a), R); }

// two-bone IK: returns world rotations for upper arm, forearm and hand
function solveArm(arm, S, goal) {
  const L1 = V.len(Rig.offset[arm.fore]), L2 = V.len(Rig.offset[arm.hand]);
  let to = V.sub(goal.wrist, S), d = V.len(to);
  const dir = V.mul(to, 1 / (d || 1));
  d = clamp(d, 0.12, (L1 + L2) * 0.998);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const side = V.orth(goal.pole, dir);
  const E = V.add(V.add(S, V.mul(dir, a)), V.mul(side, h)), W = V.add(S, V.mul(dir, d));
  const u = V.norm(V.sub(E, S)), f = V.norm(V.sub(W, E));
  const Ru = M3.frame(Rig.offset[arm.fore], [0, 0, -1], u, side);
  let Rf = M3.frame(Rig.offset[arm.hand], [0, 0, -1], f, side);
  const restD = [arm.x, 0, 0], Rh = M3.frame(restD, [0, -1, 0], goal.dir, goal.palm);
  // share the wrist twist with the forearm so the skin does not wring
  const a0 = V.orth(M3.vec(Rf, [0, 1, 0]), f), a1 = V.orth(M3.vec(Rh, [0, 1, 0]), f);
  const twist = Math.atan2(V.dot(V.cross(a0, a1), f), V.dot(a0, a1));
  Rf = M3.mul(M3.axis(f, clamp(twist, -2.2, 2.2) * 0.65), Rf);
  return [Ru, Rf, Rh];
}

// where the gun is this frame, in the fighter's own space
function gunTransform(f, g, chestPos) {
  const rest = Rig.rest[IDX.chest], shift = V.sub(chestPos, rest);
  let p = V.lerp(g.hip, g.ads, f.ads);
  p = V.add(p, [shift[0] * 0.7, shift[1], shift[2] * 0.7]);
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), rel = V.sub(f.target, f.pos);
  const local = [c * rel[0] - s * rel[2], rel[1] - f.air, s * rel[0] + c * rel[2]];
  const pivot = V.add([-0.18, 1.24, 0.0], shift);
  const look = V.sub(local, pivot);
  const pitch = clamp(Math.atan2(look[1], Math.hypot(look[0], look[2])), -0.95, 0.95);
  const swing = M3.rx(-pitch * 0.85);                         // arms and gun travel with the aim
  p = V.add(pivot, M3.vec(swing, V.sub(p, pivot)));
  let aim = V.norm(V.sub(local, V.add(p, [0, 0.08, 0])));
  if (aim[2] < 0.45) aim = V.norm([clamp(aim[0], -0.6, 0.6), aim[1], 0.45]);
  const x = V.norm(V.cross([0, 1, 0], aim)), y = V.cross(aim, x);
  let R = M3.cols(x, y, aim);
  const sp = f.sprintW, down = 1 - smooth(0, 1, f.equip);
  // working the bolt tips the rifle so the action shows; inspecting turns it over
  const bp = boltState(f, g), work = bp.hand;
  const iu = f.inspect >= 0 ? f.inspect / 2.6 : 0, look1 = smooth(0, 0.18, iu) * (1 - smooth(0.42, 0.56, iu)), look2 = smooth(0.46, 0.6, iu) * (1 - smooth(0.82, 1, iu));
  const rl = f.reload >= 0 ? smooth(0, 0.14, f.reload / g.reload) * (1 - smooth(0.84, 1, f.reload / g.reload)) : 0;
  R = M3.mul(R, M3.ry(0.62 * sp));                            // sprint: muzzle across the body
  R = M3.mul(R, M3.rx(0.38 * sp + 1.15 * down - 0.22 * rl - f.rise));
  R = M3.mul(R, M3.rz(0.55 * rl + f.roll));
  R = M3.mul(R, M3.mul(M3.rz(0.30 * work - 0.9 * down * (g.draw ? 1 : 0)), M3.rx(0.05 * bp.back)));
  R = M3.mul(R, M3.mul(M3.ry(0.75 * look1 - 0.35 * look2), M3.mul(M3.rx(-0.25 * look1 - 0.45 * look2), M3.rz(-1.0 * look1 + 1.15 * look2))));
  p = V.add(p, [0.03 * sp + 0.03 * rl, -0.07 * sp - 0.25 * down + 0.015 * rl, -0.05 * rl]);
  p = V.mad(p, aim, -f.kick);
  p = V.add(p, [0.03 * (look1 + look2), 0.05 * (look1 + look2) + 0.012 * work, -0.04 * work]);
  return { R, p, aim, pitch, k: g.scale };
}
const onGun = (G, q) => V.add(G.p, M3.vec(G.R, V.mul(q, G.k)));

function handGoal(G, grip, pole, reach) {
  const dir = V.norm(M3.vec(G.R, grip.dir)), palm = V.orth(M3.vec(G.R, grip.palm), dir);
  const wrist = V.add(V.add(onGun(G, grip.at), V.mul(dir, -(reach || 0.085))), V.mul(palm, -0.038));
  return { wrist, dir, palm, pole, curl: grip.curl };
}
// the support hand leaves the gun to swap the magazine and rack it
function reloadHand(f, g, G, goal) {
  const t = f.reload / g.reload;
  const mag = g.magPoint, below = [mag[0] + 0.07, mag[1] - 0.30, mag[2] - 0.08], bolt = g.boltPoint;
  const keys = [[0, g.left.at], [0.17, mag], [0.34, below], [0.50, below], [0.66, mag], [0.72, mag], [0.80, bolt], [0.87, [bolt[0], bolt[1], bolt[2] - g.boltTravel]], [1, g.left.at]];
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const at = V.lerp(keys[i][1], keys[i + 1][1], smooth(keys[i][0], keys[i + 1][0], t));
  const away = smooth(0, 0.15, t) * (1 - smooth(0.9, 1, t));
  const grip = { at, dir: V.lerp(g.left.dir, [-0.5, 0.35, 0.8], away), palm: V.lerp(g.left.palm, [-0.4, 0.8, 0], away), curl: [0.9, 0.9] };
  return handGoal(G, grip, goal.pole, 0.095);
}

// 0..1 amounts for the bolt: hand reaching it, handle lifted, bolt drawn back
function boltState(f, g) {
  let u = -1;
  if (g.boltAction) {
    if (f.cycle >= 0) u = f.cycle / g.cycle;
    else if (f.reload >= 0) u = (f.reload / g.reload - 0.68) / 0.32;
  }
  if (u < 0 || u > 1) return { hand: 0, lift: 0, back: 0 };
  return {
    hand: smooth(0.10, 0.27, u) * (1 - smooth(0.82, 0.99, u)),
    lift: smooth(0.27, 0.38, u) * (1 - smooth(0.71, 0.81, u)),
    back: smooth(0.39, 0.53, u) * (1 - smooth(0.57, 0.70, u))
  };
}
// where a point on the bolt handle is, in gun space, for a given lift and pull
function boltMove(g, q, s) {
  const R = M3.rz(-1.15 * s.lift), p = V.add(g.boltAxis, M3.vec(R, V.sub(q, g.boltAxis)));
  return [p[0], p[1], p[2] - g.boltTravel * s.back];
}
function boltHand(f, g, G, goal) {
  const s = boltState(f, g);
  if (s.hand <= 0) return goal;
  const k = boltMove(g, g.boltPoint, s);
  const grip = { at: V.lerp(g.right.at, k, s.hand), dir: V.lerp(g.right.dir, [0.55, -0.15, 0.8], s.hand), palm: V.lerp(g.right.palm, [0.8, -0.5, 0], s.hand), curl: [1.15 + 0.2 * s.hand, 1.25 + 0.2 * s.hand] };
  const out = handGoal(G, grip, goal.pole, 0.085 + 0.02 * s.hand);
  out.wrist = V.mad(out.wrist, [0, 1, 0], 0.03 * Math.sin(Math.PI * s.hand));
  return out;
}

function poseFighter(f) {
  const P = f.pose; poseReset(P);
  for (const n of CLIP_NAMES) {
    const gait = n === 'Walk' || n === 'Run' || n === 'CrouchWalk';
    poseAdd(P, n, gait ? f.phase * Rig.clips[n].T : f.time, f.weights[n]);
  }
  const J = jumpShape(f);
  const g = f.weapon && f.dead < 0 && f.scriptW < 0.3 ? GUNS[f.weapon] : null;
  const wr = f.wr, wp = f.wp;
  const aw = f.aimW;
  let G = null, goals = null, arms = null;
  const jumpIK = {};
  const lean = g ? clamp(Math.atan2(f.target[1] - (f.pos[1] + 1.3), Math.hypot(f.target[0] - f.pos[0], f.target[2] - f.pos[2])), -0.9, 0.9) : 0;
  const blade = g ? g.blade * aw * (1 - 0.7 * f.sprintW) : 0;
  const punching = !g && f.punch >= 0;
  for (let i = 0; i < NB; i++) {
    const parent = Rig.parent[i];
    let off = Rig.offset[i];
    if (i === IDX.hips) { off = [P.hips[0] / P.w, P.hips[1] / P.w, P.hips[2] / P.w]; if (J) off[1] += J.drop * J.w; }
    if (parent < 0) { wp[i] = off.slice(); wr[i] = localRot(P, i); }
    else { wp[i] = V.add(wp[parent], M3.vec(wr[parent], off)); wr[i] = M3.mul(wr[parent], localRot(P, i)); }
    // legs turn toward the direction of travel, the chest keeps facing the aim
    if (f.legYaw) {
      if (i === IDX.hips) { wr[i] = yawOf(wr[i], f.legYaw); wp[i] = M3.vec(M3.ry(f.legYaw), wp[i]); }
      else if (UP_CHEST.includes(i)) wr[i] = yawOf(wr[i], -f.legYaw / 2);
    }
    if (UP_CHEST.includes(i) && (g || punching)) {
      wr[i] = M3.mul(M3.mul(M3.ry(blade / 2 + (punching ? 0.2 * Math.sin(Math.PI * f.punch / 0.4) : 0)), M3.rx(-lean * 0.22)), wr[i]);
    }
    if (i === IDX.head && g) wr[i] = M3.mul(M3.mul(M3.ry(-blade * 0.9), M3.rx(-lean * 0.25)), wr[i]);
    if (J) {
      // jumping: lean, head, legs and (with nothing in them) arms
      if (UP_CHEST.includes(i)) wr[i] = M3.mul(M3.rx(J.bend * J.w / 2), wr[i]);
      if (i === IDX.head) wr[i] = M3.mul(M3.rx(J.head * J.w), wr[i]);
      for (const s of ['R', 'L']) {
        const l = LEGS[s], leg = J.legs[s], a = ARMS[s];
        if (i === l.up) { jumpIK['leg' + s] = solveLeg(l, wp[i], leg); wr[i] = M3.mix(wr[i], jumpIK['leg' + s][0], J.w); }
        else if (i === l.low) wr[i] = M3.mix(wr[i], jumpIK['leg' + s][1], J.w);
        else if (i === l.foot) wr[i] = M3.mix(wr[i], leg.foot, J.w);
        if (!g && !punching) {
          const arm = J.arms[s];
          if (i === a.up) { jumpIK[s] = solveArm(a, wp[i], arm); wr[i] = M3.mix(wr[i], jumpIK[s][0], J.w); }
          else if (i === a.fore) wr[i] = M3.mix(wr[i], jumpIK[s][1], J.w);
          else if (i === a.hand) wr[i] = M3.mix(wr[i], jumpIK[s][2], J.w);
        }
      }
    }
    if (i === IDX.chest && g) {
      G = gunTransform(f, g, wp[i]);
      goals = { R: handGoal(G, g.right, [-0.8, -1, -0.15]), L: handGoal(G, g.left, [0.75, -1, 0.1]) };
      if (f.reload >= 0 && !(g.boltAction && f.reload / g.reload > 0.68)) goals.L = reloadHand(f, g, G, goals.L);
      if (g.boltAction) goals.R = boltHand(f, g, G, goals.R);
      arms = {};
    }
    if (i === IDX.chest && punching) {
      const t = f.punch / 0.4, out = Math.sin(Math.PI * clamp(t, 0, 1));
      goals = { R: { wrist: V.add(wp[i], [-0.2 + 0.1 * out, 0.13 + 0.05 * out, 0.16 + 0.48 * out]), dir: [0, 0, 1], palm: [0, -1, 0], pole: [-1, -0.6, -0.2], curl: [1.4, 1.4] } };
      arms = {};
    }
    if (goals) {
      for (const s of ['R', 'L']) {
        const a = ARMS[s], goal = goals[s];
        if (!goal) continue;
        if (i === a.up) { arms[s] = solveArm(a, wp[i], goal); wr[i] = arms[s][0]; }
        else if (i === a.fore) wr[i] = arms[s][1];
        else if (i === a.hand) wr[i] = arms[s][2];
        else if (i === a.fingers) wr[i] = M3.mul(wr[a.hand], M3.rz(a.x < 0 ? goal.curl[0] : -goal.curl[0]));
        else if (i === a.tips) wr[i] = M3.mul(wr[a.fingers], M3.rz(a.x < 0 ? goal.curl[1] : -goal.curl[1]));
        else if (i === a.thumb) wr[i] = M3.mul(wr[a.hand], M3.mul(M3.ry(a.x * 0.75), M3.rx(0.55)));
      }
    }
  }
  let R = M3.mul(M3.ry(f.yaw), M3.rx(f.tilt)), root = [f.pos[0], f.pos[1] + f.air, f.pos[2]];
  let held = null;
  if (f.dead >= 0) {
    const fall = collapsePose(f), w = smooth(0, 0.1, f.dead);
    blendPose(f, scriptPose(f, fall.S), w);
    R = M3.mix(R, fall.R, w); root = fall.p;
  }
  if (f.script && f.scriptW > 0.001) {
    const S = f.script, w = f.scriptW;
    blendPose(f, scriptPose(f, S), w);
    if (S.root) { R = M3.mix(R, S.root.R, w); root = V.lerp(root, S.root.p, w); }
    if (S.gun && w >= 0.3) held = S.gun;
  }
  for (let i = 0; i < NB; i++) {
    const R = wr[i], t = V.sub(wp[i], M3.vec(R, Rig.rest[i]));
    m4(R, t, f.bones.subarray(i * 16, i * 16 + 16));
  }
  // the whole body
  m4(R, root, f.model);
  f.R = R;
  if (held) {
    const hg = GUNS[held.id];
    G = { R: held.R, p: held.p };
    const world = { R: M3.mul(R, G.R), p: toWorld(f, G.p) };
    f.gun = { g: hg, R: world.R, S: world.R.map(x => x * hg.scale), p: world.p, held: true };
  } else if (G) {
    const world = { R: M3.mul(R, G.R), p: toWorld(f, G.p) };
    f.gun = { g, R: world.R, S: world.R.map(x => x * g.scale), p: world.p };
  } else f.gun = null;
}
const toWorld = (f, q) => V.add([f.model[12], f.model[13], f.model[14]], M3.vec(f.R, q));
const bonePos = (f, name) => toWorld(f, f.wp[IDX[name]]);

// ======================================================================= effects
const particles = [], tracers = [], shells = [], flashes = [], marks = [];
function puff(p, n, color, speed, size, life, grav) {
  for (let i = 0; i < n; i++) particles.push({ p: p.slice(), v: [rand(-1, 1) * speed, rand(-0.2, 1) * speed, rand(-1, 1) * speed], life: rand(0.5, 1) * life, max: life, size: rand(0.6, 1.3) * size, color, grav: grav === undefined ? 4 : grav });
}
function muzzleFx(f) {
  const g = f.gun.g, m = V.add(f.gun.p, M3.vec(f.gun.S, g.muzzle)), fwd = M3.vec(f.gun.R, [0, 0, 1]);
  flashes.push({ f, life: 0.05, spin: rand(0, Math.PI), size: g.flash * rand(0.85, 1.15), p: m, fwd });
  for (let i = 0; i < 2; i++) particles.push({ p: V.mad(m, fwd, 0.04), v: [fwd[0] * rand(0.3, 1) + rand(-0.2, 0.2), rand(0.15, 0.5), fwd[2] * rand(0.3, 1) + rand(-0.2, 0.2)], life: 0.5, max: 0.5, size: 0.03, color: [0.42, 0.42, 0.45, 0.22], grav: -0.3, grow: 0.22 });
  if (!g.boltAction) eject(f);
  return m;
}
function eject(f) {
  if (!f.gun) return;
  const g = f.gun.g, fwd = M3.vec(f.gun.R, [0, 0, 1]), side = M3.vec(f.gun.R, [-1, 0, 0]);
  shells.push({ p: V.add(f.gun.p, M3.vec(f.gun.S, g.port)), v: V.add(V.mul(side, rand(1.3, 2.2)), V.add(V.mul(fwd, rand(-0.3, 0.3)), [0, rand(1.2, 2.2), 0])), size: g.shell, spin: [rand(-1, 1), rand(-1, 1), rand(-1, 1)], a: 0, life: 2.5, R: f.gun.R, rest: false });
  if (shells.length > 80) shells.shift();
}

// ======================================================================= shooting
function capsules(f) {
  const out = [];
  const head = V.add(bonePos(f, 'head'), M3.vec(f.R, [0, 0.13, 0.05]));
  out.push([head, head, 0.18, 2.4]);
  out.push([bonePos(f, 'hips'), V.add(bonePos(f, 'chest'), M3.vec(f.R, [0, 0.17, 0])), 0.25, 1]);
  for (const s of ['L', 'R']) {
    out.push([bonePos(f, 'upperArm_' + s), bonePos(f, 'foreArm_' + s), 0.065, 0.65], [bonePos(f, 'foreArm_' + s), bonePos(f, 'hand_' + s), 0.055, 0.65]);
    out.push([bonePos(f, 'thigh_' + s), bonePos(f, 'shin_' + s), 0.095, 0.75], [bonePos(f, 'shin_' + s), bonePos(f, 'foot_' + s), 0.08, 0.7]);
  }
  return out;
}
// distance along the ray to a capsule, or Infinity
function rayCapsule(o, d, a, b, r) {
  let best = Infinity;
  const steps = a === b ? 0 : Math.ceil(V.len(V.sub(b, a)) / (r * 0.7));
  for (let i = 0; i <= steps; i++) {
    const c = steps ? V.lerp(a, b, i / steps) : a, oc = V.sub(c, o), t = V.dot(oc, d);
    if (t < 0) continue;
    const q = V.dot(oc, oc) - t * t;
    if (q <= r * r) best = Math.min(best, t - Math.sqrt(r * r - q));
  }
  return best;
}
function trace(origin, dir, shooter, minT) {
  let best = { t: 90, kind: 'none' };
  const s = surfaceHit(origin, dir); if (s && s.t > (minT || 0) && s.t < best.t) best = s;
  for (const c of chests) { const t = rayCapsule(origin, dir, V.add(c.pos, [-0.25, 0.25, 0]), V.add(c.pos, [0.25, 0.25, 0]), 0.3); if (t > (minT || 0) && t < best.t) best = { t, kind: 'chest' }; }
  for (const f of fighters) {
    if (f === shooter || f.dead >= 0) continue;
    for (const [a, b, r, mult] of capsules(f)) {
      const t = rayCapsule(origin, dir, a, b, r);
      if (t > (minT || 0) && t < best.t) best = { t, kind: 'fighter', f, mult };
    }
  }
  best.p = V.mad(origin, dir, best.t);
  return best;
}
function jitter(dir, spread) {
  const x = V.norm(V.cross(dir, [0, 1, 0])), y = V.cross(x, dir), a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * spread;
  return V.norm(V.add(dir, V.add(V.mul(x, Math.cos(a) * r), V.mul(y, Math.sin(a) * r))));
}
function damage(victim, amount, from, head) {
  if (victim.dead >= 0 || (victim.isPlayer && game.godMode)) return;
  victim.hp -= amount; victim.hurt = 0.22;
  if (victim.isPlayer) {
    Sound.play('hurt', 0.8); hudDirty = true;
    const to = V.sub(from.pos, victim.pos), a = Math.atan2(to[0], to[2]) - (cam.yaw + Math.PI);
    ui.hurtDir.style.transform = `rotate(${-a}rad)`; ui.hurtDir.style.opacity = 1; ui.vignette.style.opacity = 1;
    game.hurtFade = 0.9;
  } else victim.ai.seen = true;
  if (victim.hp <= 0) {
    if (from.isPlayer) {
      Sound.play('kill', 0.8); game.kills++; hudDirty = true;
      notify((head ? 'Headshot! ' : '') + 'Go to him and hold E to loot');
    }
    knockOut(victim, 'You got knocked out');
  }
}
function knockOut(victim, why) {
  victim.hp = 0; victim.dead = 0; victim.reload = -1; victim.crouch = false; victim.tilt = 0;
  if (victim.isPlayer) { game.deaths++; hudDirty = true; abortLoot(); notify(why); startSend(victim, 1.2); aimDeathCam(); }
}
function fire(f, origin, dir, spread, minT) {
  const g = GUNS[f.weapon], am = f.ammo[f.weapon];
  am.clip--; f.cool = 60 / g.rate;
  const d = jitter(dir, spread);
  const hit = trace(origin, d, f, minT);
  const muzzle = muzzleFx(f);
  tracers.push({ a: muzzle, b: hit.p, life: 0.09, max: 0.09 });
  if (hit.kind === 'fighter') {
    const head = hit.mult > 2;
    puff(hit.p, 7, [0.55, 0.04, 0.03, 0.9], 1.1, 0.032, 0.45, 6);
    damage(hit.f, (f.isPlayer ? g.damage : 5) * hit.mult, f, head);
    if (f.isPlayer) { Sound.play('hit', 0.8); game.marker = 0.18; ui.marker.classList.toggle('head', head || hit.f.dead >= 0); }
  } else if (hit.kind === 'ground') { puff(hit.p, 6, [0.45, 0.43, 0.40, 0.7], 0.9, 0.045, 0.5, 3); marks.push(hit.p); if (marks.length > 90) marks.shift(); }
  else if (hit.kind === 'water') puff(hit.p, 8, [0.85, 0.93, 0.97, 0.8], 1.2, 0.04, 0.45, 5);
  else if (hit.kind === 'solid') puff(hit.p, 6, [0.50, 0.38, 0.24, 0.9], 1.2, 0.03, 0.45, 6);
  else if (hit.kind === 'chest') puff(hit.p, 6, [0.55, 0.36, 0.17, 0.9], 1.2, 0.025, 0.45, 6);
  // recoil on the gun itself
  f.kickV += g.kickBack * 22; f.riseV += g.climb * 16 * (1 - 0.35 * f.ads); f.roll += rand(-0.05, 0.05); f.bolt = 1;
  f.bloom = Math.min(g.maxBloom, f.bloom + g.bloom);
  if (g.boltAction) f.cycle = 0;
  f.inspect = -1;
  const dist = f.isPlayer ? 0 : V.len(V.sub(f.pos, player.pos));
  Sound.play(g.sound, f.isPlayer ? 0.9 : 0.8 / (1 + dist * 0.12));
  Sound.play('shell', 0.6);
  if (f.isPlayer) hudDirty = true;
}
function startReload(f) {
  if (!f.weapon || f.reload >= 0 || f.equip < 1 || f.cycle >= 0) return;
  const g = GUNS[f.weapon], am = f.ammo[f.weapon];
  if (am.clip >= g.mag || am.spare <= 0) return;
  f.reload = 0; f.inspect = -1;
}

// ======================================================================= input
const cam = { yaw: 0, pitch: 0.12, dist: 2.25, side: 0.92, fov: 0.95, height: 1.70, recoil: 0, shake: 0 };
const keys = new Set();
const mouse = { fire: false, pressed: false, aim: false, drag: null };
const game = { running: false, locked: false, lockWorked: false, aimToggle: false, enemiesShoot: true, godMode: false, kills: 0, deaths: 0, marker: 0, hurtFade: 0, note: 0, time: 0 };
const ui = {};
for (const id of ['scope', 'ring', 'prompttext', 'pops', 'menu', 'hud', 'ammo', 'weapon', 'hp', 'hpfill', 'slots', 'prompt', 'note', 'cross', 'marker', 'vignette', 'hurtDir', 'score', 'bars', 'play', 'shootback', 'msg', 'reloadbar']) ui[id] = document.getElementById(id);
let hudDirty = true;
function notify(text) { ui.note.textContent = text; ui.note.style.opacity = 1; game.note = 2.4; }

function setRunning(on) {
  game.running = on;
  ui.menu.hidden = on; ui.hud.hidden = !on;
  if (!on) { keys.clear(); mouse.fire = mouse.pressed = mouse.aim = false; askMap(false); }
  hudDirty = true;
}
function lockMouse() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag to look instead */ }
}
ui.play.addEventListener('click', () => { Sound.init(); game.enemiesShoot = ui.shootback.checked; setRunning(true); ui.play.textContent = 'Resume'; ui.play.blur(); lockMouse(); canvas.focus(); });
document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === canvas;
  if (game.locked) game.lockWorked = true; else if (game.running) setRunning(false);
});
document.addEventListener('mousemove', e => {
  if (!game.running) return;
  if (looting) return;
  const k = 0.0023 * (1 - 0.45 * player.ads) * (1 - 0.72 * scopeAmount());
  if (game.locked) look(e.movementX * k, e.movementY * k);
  else if (mouse.drag) { look((e.clientX - mouse.drag[0]) * 0.006, (e.clientY - mouse.drag[1]) * 0.005); mouse.drag = [e.clientX, e.clientY]; }
});
function look(dx, dy) { cam.yaw -= dx; cam.pitch = clamp(cam.pitch + dy, -0.75, 1.05); }
canvas.addEventListener('mousedown', e => {
  if (!game.running) return;
  Sound.init();
  if (!game.locked) { mouse.drag = [e.clientX, e.clientY]; if (!game.lockWorked) { /* stays in drag mode if refused */ } lockMouse(); }
  if (e.button === 0) { mouse.fire = true; mouse.pressed = true; }
  if (e.button === 2) mouse.aim = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.fire = false; if (e.button === 2) mouse.aim = false; mouse.drag = null; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { keys.clear(); mouse.fire = mouse.aim = false; });
addEventListener('wheel', e => {
  if (!game.running || !player.inv.length) return;
  e.preventDefault();
  if (looting) return;
  const i = player.inv.indexOf(player.weapon);
  equip(player, player.inv[(i + (e.deltaY > 0 ? 1 : player.inv.length - 1)) % player.inv.length]);
}, { passive: false });
function fullscreen() {
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  if (p && p.then) p.then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['KeyW', 'ControlLeft', 'ControlRight']).catch(() => {}); lockMouse(); }).catch(() => {});
}
addEventListener('keydown', e => {
  if (!game.running) { if (e.code === 'Escape' && !game.lockWorked && ui.play.textContent === 'Resume') setRunning(true); return; }
  if (e.metaKey || e.altKey) return;
  if (e.key === 'Control') { if (!e.repeat) player.crouch = !player.crouch; return; }
  e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (looting && !['Escape', 'KeyF', 'KeyP', 'KeyM'].includes(e.code)) return;
  if (e.code === 'Escape') setRunning(false);
  else if (e.code === 'Space') startJump(player);
  else if (e.code === 'KeyR') startReload(player);
  else if (world.asking && ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'].includes(e.code)) setMap('island', e.code.endsWith('2'));
  else if (e.code === 'Digit1') equip(player, 'ak');
  else if (e.code === 'Digit2') equip(player, 'glock');
  else if (e.code === 'Digit3') equip(player, 'awp');
  else if (e.code === 'Digit4' || e.code === 'KeyH') equip(player, null);
  else if (e.code === 'KeyV') { if (player.weapon && player.reload < 0 && player.cycle < 0 && player.equip >= 1 && player.inspect < 0) player.inspect = 0; }
  else if (e.code === 'KeyT') { if (world.map === 'island') setMap('plate'); else askMap(!world.asking); }   // temporary, while the map is being made
  else if (e.code === 'KeyQ') game.aimToggle = !game.aimToggle;
  else if (e.code === 'KeyF') fullscreen();
  else if (e.code === 'KeyP') { game.enemiesShoot = !game.enemiesShoot; ui.shootback.checked = game.enemiesShoot; notify(game.enemiesShoot ? 'Enemies shoot back' : 'Enemies hold fire'); }
  else if (e.code === 'KeyM') notify(Sound.toggle() ? 'Sound off' : 'Sound on');
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('beforeunload', e => { if (game.running) { e.preventDefault(); e.returnValue = ''; } });

//LOOT//

// ======================================================================= simulation
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// move: x right, y forward, relative to the way the fighter faces
function locomotion(f, mx, my, sprint, dt) {
  const want = Math.hypot(mx, my) > 0.1 && f.dead < 0;
  const aiming = f.ads > 0.5;
  let target = 0;
  if (want) target = f.crouch ? 0.8 : aiming ? 1.25 : sprint && my > 0.1 ? 3.8 : my < -0.1 ? 1.7 : 2.5;
  if (!f.isPlayer) target = Math.min(target, 1.7);
  if (want) f.moveRel = Math.atan2(-mx, my);
  f.speed += (target - f.speed) * Math.min(1, dt * 10);
  if (f.speed < 0.04) f.speed = 0;
  const clip = f.crouch ? (f.speed > 0.1 ? 'CrouchWalk' : 'Crouch') : f.speed > 1.6 ? 'Run' : f.speed > 0.1 ? 'Walk' : 'Idle';
  let sum = 0;
  for (const n of CLIP_NAMES) { f.weights[n] = n === clip ? Math.min(1, f.weights[n] + dt / 0.18) : Math.max(0, f.weights[n] - dt / 0.18); sum += f.weights[n]; }
  for (const n of CLIP_NAMES) f.weights[n] /= sum;
  const off = Math.abs(f.moveRel);
  if (f.speed === 0) f.back = false;
  if (off > 1.75) f.back = true; else if (off < 1.39) f.back = false;
  const legs = want && f.jump < 0 ? (f.back ? f.moveRel - Math.sign(f.moveRel) * Math.PI : f.moveRel) : 0;
  f.legYaw += (legs - f.legYaw) * Math.min(1, dt * 12);
  if (Math.abs(f.legYaw) < 0.001) f.legYaw = 0;
  // play each gait at the rate that matches the ground speed, so feet do not skate
  let gw = 0, cycles = 0;
  for (const n of ['Walk', 'Run', 'CrouchWalk']) { const c = Rig.clips[n]; gw += f.weights[n]; cycles += f.weights[n] * clamp(f.speed / c.speed, 0.6, 1.75) / c.T; }
  if (gw > 0.001) f.phase = (f.phase + (f.back ? -1 : 1) * dt * cycles / gw + 1) % 1;
  f.time += dt;
  jumpStep(f, dt);
  if (f.dead >= 0) f.legYaw = 0;
  const dir = f.yaw + f.moveRel;
  const pace = f.speed * (inSea(f.pos) ? 0.65 : 1);           // wading is slow
  const x0 = f.pos[0], z0 = f.pos[2];
  f.pos[0] += Math.sin(dir) * pace * dt;
  f.pos[2] += Math.cos(dir) * pace * dt;
  confine(f);
  cliffs(f, x0, z0);
  if (f.dead < 0) f.pos[1] = groundAt(f.pos[0], f.pos[2]);
  if (f.isPlayer && looting) return;
  for (const c of chests) push(f, c.pos, 0.72);
  for (const o of fighters) if (o !== f && o.dead < 0) push(f, o.pos, 0.55);
}
function push(f, p, r) {
  const dx = f.pos[0] - p[0], dz = f.pos[2] - p[2], d = Math.hypot(dx, dz);
  if (d < r && d > 1e-4) { f.pos[0] += dx / d * (r - d); f.pos[2] += dz / d * (r - d); }
}
function weaponStep(f, dt) {
  f.cool = Math.max(0, f.cool - dt);
  f.equip = Math.min(1, f.equip + dt / (f.weapon && GUNS[f.weapon].draw || 0.38));
  if (f.inspect >= 0) { f.inspect += dt; if (f.inspect > 2.6) f.inspect = -1; }
  if (f.cycle >= 0) {
    const g = GUNS[f.weapon], u0 = f.cycle / g.cycle;
    f.cycle += dt;
    const u = f.cycle / g.cycle, cue = (at, s) => { if (u0 < at && u >= at) Sound.play(s, f.isPlayer ? 0.9 : 0.2); };
    cue(0.27, 'boltup'); cue(0.41, 'boltback'); cue(0.58, 'boltfwd');
    if (u0 < 0.5 && u >= 0.5) { eject(f); Sound.play('shell', 0.8); }
    if (u >= 1) f.cycle = -1;
  }
  f.aimW += ((f.weapon ? 1 : 0) - f.aimW) * Math.min(1, dt * 9);
  // damped springs bring the gun back after each shot
  f.kickV += (-f.kick * 420 - f.kickV * 28) * dt; f.kick = clamp(f.kick + f.kickV * dt, -0.03, 0.11);
  f.riseV += (-f.rise * 300 - f.riseV * 24) * dt; f.rise = clamp(f.rise + f.riseV * dt, -0.08, 0.42);
  f.roll *= Math.exp(-dt * 14);
  f.bolt = Math.max(0, f.bolt - dt * 14);
  f.bloom *= Math.exp(-dt * 7);
  f.hurt = Math.max(0, f.hurt - dt);
  if (f.punch >= 0) { f.punch += dt; if (f.punch > 0.4) f.punch = -1; }
  if (f.reload >= 0) {
    const g = GUNS[f.weapon], t0 = f.reload / g.reload;
    f.reload += dt;
    const t = f.reload / g.reload, cue = (at, s) => { if (t0 < at && t >= at) Sound.play(s, f.isPlayer ? 0.9 : 0.2); };
    cue(0.2, 'magout'); cue(0.66, 'magin');
    if (g.boltAction) { cue(0.76, 'boltup'); cue(0.82, 'boltback'); cue(0.87, 'boltfwd'); } else cue(0.8, 'rack');
    if (t >= 1) {
      const am = f.ammo[f.weapon], n = Math.min(g.mag - am.clip, am.spare);
      am.clip += n; am.spare -= n; f.reload = -1;
      if (f.isPlayer) hudDirty = true;
    }
  }
}
function camVectors() {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const fwd = [-Math.sin(cam.yaw) * cp, -sp, -Math.cos(cam.yaw) * cp];
  const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
  return { fwd, right };
}
function cameraEye() {
  const { fwd, right } = camVectors();
  const at = [player.pos[0] + right[0] * cam.side, player.pos[1] + cam.height + (player.dead < 0 ? player.air * 0.45 : 0), player.pos[2] + right[2] * cam.side];
  if (world.map === 'island') at[1] = Math.max(at[1], floorAt(at[0], at[2]) + 0.4);     // beside a steep bank
  let dist = cam.dist;
  if (fwd[1] > 0) dist = Math.min(dist, (at[1] - 0.18) / fwd[1]);
  if (world.map === 'island') dist = cameraRoom(at, fwd, cam.dist);
  return { eye: V.mad(at, fwd, -dist), at, fwd, dist };
}
function respawnPlayer() {
  abortLoot();
  const f = player;
  f.dead = -1; f.hp = 100; f.pos = [0, groundAt(0, 0), 0]; f.air = 0; f.jump = -1; f.equip = 0;
  deathCam = 0; deathShot = null; hudDirty = true;
  bots.forEach(spawnBot); notify('Back on your feet');
}
function playerStep(dt) {
  const f = player;
  if (f.dead >= 0) {
    // the send-off decides when you get back up
    const before = f.dead; f.dead += dt; deathCues(f, before);
    locomotion(f, 0, 0, false, dt); weaponStep(f, dt); return;
  }
  if (lootStep(dt)) { mouse.pressed = false; return; }
  const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const my = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const g = f.weapon ? GUNS[f.weapon] : null;
  // a bolt-action drops out of the scope to work the bolt, then comes back up
  const working = !!g && !!g.boltAction && f.cycle > 0.28 && f.cycle < g.cycle * 0.9;
  const aiming = !!g && (mouse.aim || game.aimToggle) && f.reload < 0 && !working && f.equip > 0.85;
  if (aiming) f.inspect = -1;
  if (aiming && g.scoped && f.ads < 0.1) Sound.play('scope', 0.9);
  const firing = mouse.fire || mouse.pressed;
  const sprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !aiming && !firing && f.reload < 0 && !f.crouch;
  f.ads += ((aiming ? 1 : 0) - f.ads) * Math.min(1, dt * (g && g.scoped ? 9 : 12));
  const sprinting = sprint && my > 0 && f.speed > 2.7;
  f.sprintW += ((sprinting && g ? 1 : 0) - f.sprintW) * Math.min(1, dt * 9);
  f.yaw += wrap(cam.yaw + Math.PI - f.yaw) * Math.min(1, dt * 18);
  locomotion(f, mx, my, sprint, dt);
  weaponStep(f, dt);
  seaStep(f, dt);
  if (f.dead >= 0) return;

  const c = camVectors(), view = cameraEye();
  const near = Math.max(0.2, V.dot(V.sub(V.add(f.pos, [0, 1.3, 0]), view.eye), c.fwd) + 0.3);
  const aimHit = trace(view.eye, c.fwd, f, near);
  f.target = aimHit.p;

  if (g) {
    const am = f.ammo[f.weapon];
    const trigger = g.auto ? firing : mouse.pressed;
    if (trigger && f.cool <= 0 && f.equip >= 1 && f.reload < 0 && f.sprintW < 0.25 && f.gun) {
      if (am.clip > 0) {
        const moving = f.speed / 3.8, base = g.scoped ? (scopeAmount() > 0.85 ? 0.0004 : g.spread) : (g.spread + f.bloom) * (1 - 0.65 * f.ads);
        const spread = base + moving * 0.018 + (f.jump >= 0 ? 0.05 : 0) - (f.crouch ? 0.002 : 0);
        fire(f, view.eye, c.fwd, Math.max(0.001, spread), near);
        // camera recoil: climbs with every round, only part of it settles back
        const k = g.kickUp * (1 - 0.3 * f.ads) * (f.crouch ? 0.7 : 1);
        cam.pitch = clamp(cam.pitch - k, -0.75, 1.05); cam.recoil += k * 0.6; cam.yaw += rand(-1, 1) * g.kickSide; cam.shake = Math.min(1, cam.shake + 0.45);
        mouse.pressed = false;
      } else if (mouse.pressed) { Sound.play('click', 0.9); startReload(f); mouse.pressed = false; }
      else startReload(f);
    }
    if (am.clip === 0 && am.spare > 0 && f.reload < 0 && f.cool <= 0 && !firing) startReload(f);
  } else if (mouse.pressed && f.punch < 0) {
    f.punch = 0;
    const d = [Math.sin(f.yaw), 0, Math.cos(f.yaw)];
    const hit = trace(V.add(f.pos, [0, 1.15, 0]), d, f, 0);
    if (hit.kind === 'fighter' && hit.t < 1.2) { damage(hit.f, 20, f); Sound.play('punch', 0.9); game.marker = 0.18; puff(hit.p, 4, [0.8, 0.8, 0.75, 0.7], 0.6, 0.04, 0.3, 2); }
  }
  if (!g || f.equip >= 1) mouse.pressed = false;
}
function botStep(b, i, dt) {
  if (b.dead >= 0) {
    const before = b.dead; b.dead += dt; deathCues(b, before);
    locomotion(b, 0, 0, false, dt); weaponStep(b, dt);
    // a body waits a while to be looted; once it has been, he turns up at once
    if (!b.send && !b.beingLooted && b.dead >= (b.looted ? 1.6 : LOOT_WINDOW)) startSend(b, 0, !b.looted);
    return;
  }
  const to = V.sub(player.pos, b.pos), dist = Math.hypot(to[0], to[2]);
  // they leave you alone until you arm yourself or hit them
  const hostile = game.enemiesShoot && player.dead < 0 && (player.weapon !== null || b.ai.seen);
  let mx = 0, my = 0;
  if (hostile) {
    b.yaw += wrap(Math.atan2(to[0], to[2]) - b.yaw) * Math.min(1, dt * 6);
    b.ai.strafeT -= dt;
    if (b.ai.strafeT <= 0) { b.ai.strafeT = rand(0.8, 2.4); b.ai.strafe = [-1, 0, 1][Math.floor(rand(0, 3))]; b.crouch = Math.random() < 0.18; }
    if (dist > 11) my = 1; else if (dist < 5) my = -1;
    mx = b.ai.strafe;
    b.target = V.add(player.pos, [0, player.crouch ? 0.85 : 1.1, 0]);
    b.ai.wait -= dt;
    if (b.ai.wait <= 0 && b.reload < 0 && b.gun && dist < 28) {
      if (b.ai.burst <= 0) b.ai.burst = b.weapon === 'ak' ? Math.floor(rand(2, 5)) : Math.floor(rand(1, 3));
      if (b.cool <= 0) {
        if (b.ammo[b.weapon].clip <= 0) startReload(b);
        else {
          const muzzle = V.add(b.gun.p, M3.vec(b.gun.S, b.gun.g.muzzle));
          fire(b, muzzle, V.norm(V.sub(b.target, muzzle)), 0.05 + player.speed * 0.016, 0);
          b.cool = Math.max(b.cool, b.weapon === 'ak' ? 0.13 : 0.3);
          if (--b.ai.burst <= 0) b.ai.wait = rand(1.2, 2.6);
        }
      }
    }
  } else {
    b.ai.wait = Math.max(b.ai.wait, 0.8); b.crouch = false;
    b.target = V.add(b.pos, [Math.sin(b.yaw) * 6, 0.6, Math.cos(b.yaw) * 6]);
  }
  b.ads = 0;
  locomotion(b, mx, my, false, dt);
  weaponStep(b, dt);
}
function effectsStep(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.v[1] -= p.grav * dt; p.p = V.mad(p.p, p.v, dt); const low = floorAt(p.p[0], p.p[2]) + 0.01; if (p.p[1] < low) { p.p[1] = low; p.v = [0, 0, 0]; }
    if (p.grow) { p.size += p.grow * dt; p.v = V.mul(p.v, Math.exp(-dt * 3)); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].life -= dt) <= 0) tracers.splice(i, 1);
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i]; s.life -= dt;
    if (s.life <= 0) { shells.splice(i, 1); continue; }
    if (s.rest) continue;
    s.v[1] -= 9.8 * dt; s.p = V.mad(s.p, s.v, dt); s.a += dt * 14;
    const low = floorAt(s.p[0], s.p[2]) + 0.008;
    if (s.p[1] < low) { s.p[1] = low; if (Math.abs(s.v[1]) < 0.7) { s.rest = true; } s.v = [s.v[0] * 0.5, -s.v[1] * 0.35, s.v[2] * 0.5]; }
  }
}
function update(dt) {
  game.time += dt;
  playerStep(dt);
  bots.forEach((b, i) => botStep(b, i, dt));
  sendsStep(dt);
  deathCamStep(dt);
  for (const c of chests) {
    if (c.t >= 0) { c.t += dt; if (c.t > 25) c.t = -1; }
    // the lid is on a spring, so it bounces when it is knocked open
    const to = c.t >= 0 || c.forced ? 1 : 0;
    c.openV += ((to - c.open) * 140 - c.openV * (to ? 11 : 20)) * dt; c.open += c.openV * dt;
    if (c.open < 0) { c.open = 0; c.openV = 0; }
    c.wobble *= Math.exp(-dt * 6);
  }
  effectsStep(dt);
  const k = 1 - Math.exp(-dt * 11), a = player.ads;
  propsStep(dt);
  cam.dist += ((2.25 - 0.45 * a) - cam.dist) * k;
  const still = player.weapon && GUNS[player.weapon].scoped ? 0 : a;
  cam.side += ((0.92 - 0.10 * still) - cam.side) * k;
  cam.fov += ((0.95 - 0.34 * a + (player.speed > 3 ? 0.07 : 0)) - cam.fov) * k;
  cam.height += ((player.crouch ? 1.34 : 1.70 - 0.05 * still) - cam.height) * k;
  const back = cam.recoil * Math.min(1, dt * 7); cam.recoil -= back; cam.pitch += back;
  cam.shake = Math.max(0, cam.shake - dt * 6);
}

// ======================================================================= drawing
const SUN = V.norm([-0.45, 0.82, 0.52]);
const flashPos = [0, -10, 0], flashCol = [0, 0, 0];
function globals(prog, vp, light, eye) {
  gl.useProgram(prog.p);
  gl.uniformMatrix4fv(prog.u.uViewProj, false, vp);
  if (prog.u.uLight) gl.uniformMatrix4fv(prog.u.uLight, false, light);
  if (prog.u.uShadow) gl.uniform1i(prog.u.uShadow, 3);
  if (prog.u.uSun) gl.uniform3fv(prog.u.uSun, SUN);
  if (prog.u.uEye) gl.uniform3fv(prog.u.uEye, eye);
  if (prog.u.uFlashPos) { gl.uniform3fv(prog.u.uFlashPos, flashPos); gl.uniform3fv(prog.u.uFlashCol, flashCol); }
}
function drawFighters(prog, textured, hideSelf) {
  for (const f of fighters.concat(helpers)) {
    if (f.gone || (hideSelf && f.isPlayer)) continue;
    gl.uniformMatrix4fv(prog.u.uBones, false, f.bones);
    gl.uniformMatrix4fv(prog.u.uModel, false, f.model);
    if (textured) gl.uniform1f(prog.u.uHurt, f.hurt * 1.4);
    for (const p of Rig.prims) {
      if (textured) {
        gl.uniform1i(prog.u.uHasTex, p.tex ? 1 : 0); gl.uniform1i(prog.u.uHasNormal, p.normal ? 1 : 0);
        gl.uniform3fv(prog.u.uColor, p.color); gl.uniform1f(prog.u.uRough, p.rough);
        gl.uniform3fv(prog.u.uTint, p.name === 'cloth' || p.name === 'skin' ? (p.name === 'skin' ? f.tint.map(t => 1 + (t - 1) * 0.35) : f.tint) : [1, 1, 1]);
        if (p.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex); }
        if (p.normal) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, p.normal); }
      }
      gl.bindVertexArray(p.vao);
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
    }
  }
}
const modelM = new Float32Array(16);
function drawMesh(prog, mesh, R, p) {
  gl.uniformMatrix4fv(prog.u.uModel, false, m4(R, p, modelM));
  gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
}
function flat(prog, color, rough, metal) {
  if (!prog.u.uColor) return;
  gl.uniform1i(prog.u.uHasTex, 0); gl.uniform3fv(prog.u.uColor, color); gl.uniform1f(prog.u.uRough, rough); gl.uniform1f(prog.u.uMetal, metal);
}
function drawGun(prog, textured, g, R, p, o) {
  if (textured) {
    gl.uniform1i(prog.u.uHasTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.orm);
  }
  drawMesh(prog, g.parts.body, R, p);
  if (!o.noMag) drawMesh(prog, g.parts.mag, R, o.magOff ? V.add(p, M3.vec(R, o.magOff)) : p);
  drawMesh(prog, g.parts.trigger, R, p);
  if (o.bolt) {                                           // lift about the bore, then draw back
    const turn = M3.rz(-1.15 * o.bolt.lift);
    drawMesh(prog, g.parts.bolt, M3.mul(R, turn), V.add(p, M3.vec(R, boltMove(g, [0, 0, 0], o.bolt))));
  } else drawMesh(prog, g.parts.bolt, R, V.add(p, M3.vec(R, [0, 0, -g.boltTravel * (o.slide || 0)])));
  if (g.parts.lens) { flat(prog, [0.02, 0.05, 0.09], 0.12, 0.85); drawMesh(prog, g.parts.lens, R, p); }
}
function drawStatics(prog, textured, hideSelf) {
  for (const f of fighters) {
    if (!f.gun || (hideSelf && f.isPlayer)) continue;
    const { g, S: R, p, held } = f.gun, o = {};
    if (!held) {
      const t = f.reload >= 0 ? f.reload / g.reload : -1;
      // magazine drops out and a fresh one comes up with the support hand
      if (t >= 0) {
        const out = smooth(0.18, 0.34, t) * (1 - smooth(0.5, 0.66, t));
        o.magOff = [0.07 * out, -0.30 * out, -0.08 * out]; o.noMag = t > 0.36 && t < 0.48;
      }
      if (g.boltAction) o.bolt = boltState(f, g);
      else {
        let slide = f.bolt > 0 ? Math.sin(Math.PI * Math.min(1, f.bolt)) : 0;
        if (t >= 0.8) slide = Math.max(slide, smooth(0.8, 0.87, t) * (1 - smooth(0.88, 0.92, t)));
        if (f.ammo[f.weapon] && f.ammo[f.weapon].clip === 0 && f.weapon === 'glock' && (t < 0.87)) slide = 1;
        o.slide = slide;
      }
    }
    drawGun(prog, textured, g, R, p, o);
  }
  for (const c of chests) {
    const tip = M3.rz(Math.sin(game.time * 38) * c.wobble * 0.09), hinge = V.add(c.pos, M3.vec(tip, [0, 0.44, -0.30])), lid = M3.mul(tip, M3.rx(-1.9 * c.open));
    flat(prog, [0.19, 0.095, 0.035], 0.75, 0.0); drawMesh(prog, meshes.chest, tip, c.pos); drawMesh(prog, meshes.lid, lid, hinge);
    flat(prog, c.gun === 'ak' ? [0.75, 0.45, 0.08] : c.gun === 'awp' ? [0.10, 0.28, 0.08] : [0.30, 0.32, 0.35], 0.38, 0.9);
    for (const x of [-0.3, 0.3]) {
      for (const z of [0.272, -0.272]) drawMesh(prog, meshes.strap, tip, V.add(c.pos, M3.vec(tip, [x, 0, z])));
      drawMesh(prog, meshes.lidband, lid, V.add(hinge, M3.vec(tip, [x, 0, 0])));
    }
    drawMesh(prog, meshes.lock, tip, c.pos);
  }
  drawProps(prog, textured);
  drawSends(prog);
  flat(prog, [0.72, 0.50, 0.16], 0.28, 1.0);
  for (const s of shells) {
    const R = M3.mul(s.rest ? M3.ry(s.a) : M3.mul(M3.axis(s.spin, s.a), s.R), [s.size[0], 0, 0, 0, s.size[1], 0, 0, 0, s.size[2]]);
    drawMesh(prog, meshes.shell, R, s.p);
  }
}
const fxData = [];
function quad(c, ax, ay, col) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (const [u, v] of corners) fxData.push(c[0] + ax[0] * u + ay[0] * v, c[1] + ax[1] * u + ay[1] * v, c[2] + ax[2] * u + ay[2] * v, u, v, col[0], col[1], col[2], col[3]);
}
function flushFx(additive) {
  if (!fxData.length) return;
  gl.blendFunc(gl.ONE, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(fxVao); gl.bindBuffer(gl.ARRAY_BUFFER, fxBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fxData), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, fxData.length / 9);
  fxData.length = 0;
}
function drawEffects(vp, eye, fwd) {
  gl.useProgram(fxProg.p); gl.uniformMatrix4fv(fxProg.u.uViewProj, false, vp);
  gl.enable(gl.BLEND); gl.depthMask(false);
  const right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd);
  for (const m of marks) quad([m[0], m[1] + 0.012, m[2]], [0.045, 0, 0], [0, 0, 0.045], [0.08, 0.07, 0.06, 0.75]);
  for (const p of particles) if (!p.add) { const a = Math.min(1, p.life / p.max * 1.6); quad(p.p, V.mul(right, p.size), V.mul(up, p.size), [p.color[0], p.color[1], p.color[2], p.color[3] * a]); }
  flushFx(false);
  for (const t of tracers) {
    const d = V.sub(t.b, t.a), len = V.len(d);
    if (len < 0.3) continue;
    const n = V.mul(d, 1 / len), prog = 1 - t.life / t.max, head = Math.min(len, 1.5 + prog * len), tail = Math.max(0, head - 3.5);
    const mid = V.mad(t.a, n, (head + tail) / 2), side = V.norm(V.cross(n, V.sub(mid, eye)));
    quad(mid, V.mul(n, (head - tail) / 2), V.mul(side, 0.012), [1.0, 0.78, 0.35, 0.95]);
  }
  for (const f of flashes) {
    if (f.f.isPlayer && lastView.hideSelf) continue;
    const s = f.size, fwdDir = f.fwd, base = V.mad(f.p, fwdDir, 0.05 * s);
    quad(base, V.mul(right, 0.09 * s), V.mul(up, 0.09 * s), [1.0, 0.85, 0.5, 1]);
    quad(base, V.mul(right, 0.2 * s), V.mul(up, 0.2 * s), [1.0, 0.45, 0.08, 0.6]);
    for (let i = 0; i < 3; i++) {
      const a = f.spin + i * Math.PI / 3, ax = V.add(V.mul(right, Math.cos(a)), V.mul(up, Math.sin(a))), ay = V.add(V.mul(right, -Math.sin(a)), V.mul(up, Math.cos(a)));
      quad(base, V.mul(ax, 0.22 * s), V.mul(ay, 0.022 * s), [1.0, 0.7, 0.25, 0.9]);
    }
    const side = V.norm(V.cross(fwdDir, V.sub(base, eye)));
    quad(V.mad(f.p, fwdDir, 0.14 * s), V.mul(fwdDir, 0.17 * s), V.mul(side, 0.05 * s), [1.0, 0.65, 0.2, 0.9]);
  }
  for (const p of particles) if (p.add) { const a = Math.min(1, p.life / p.max * 1.4); quad(p.p, V.mul(right, p.size), V.mul(up, p.size), [p.color[0] * a, p.color[1] * a, p.color[2] * a, p.color[3] * a]); }
  flushFx(true);
  gl.depthMask(true); gl.disable(gl.BLEND);
}
let lastView = null, quality = 1, frameAvg = 0.016, qualityWait = 3;
function render() {
  const slim = world.map === 'island' && world.low;           // the optimized map also draws fewer pixels
  const dpr = Math.min(window.devicePixelRatio || 1, slim ? 1 : 1.5) * quality * (slim ? 0.9 : 1);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  for (const f of fighters.concat(helpers)) poseFighter(f);
  const sc = scopeAmount();
  const view = deathCamera(lootCamera(scopedView(cameraEye(), sc)));
  const hideSelf = sc > 0.55;
  const sh = cam.shake * cam.shake * 0.012;
  const eye = V.add(view.eye, [rand(-sh, sh), rand(-sh, sh), rand(-sh, sh)]);
  if (world.map === 'island') eye[1] = Math.max(eye[1], floorAt(eye[0], eye[2]) + 0.18);   // never inside a hill
  const fov = cam.fov + (0.17 - cam.fov) * smooth(0.45, 1, sc);
  const proj = perspective(fov, w / Math.max(1, h), 0.08, world.map !== 'island' ? 160 : world.low ? 300 : 600);
  const vp = mul4(proj, lookAt(eye, V.add(eye, view.fwd)));
  lastView = { vp, w: canvas.clientWidth, h: canvas.clientHeight };

  const centre = V.add(player.pos, [view.fwd[0] * 5, 0.5, view.fwd[2] * 5]);
  const light = mul4(ortho(9, 9, 1, 30), lookAt(V.mad(centre, SUN, 14), centre));

  flashCol[0] = flashCol[1] = flashCol[2] = 0;
  const fl = flashes.find(f => f.f.isPlayer) || flashes[0];
  lastView.hideSelf = hideSelf;
  if (fl) { flashPos[0] = fl.p[0]; flashPos[1] = fl.p[1]; flashPos[2] = fl.p[2]; flashCol[0] = 2.2; flashCol[1] = 1.35; flashCol[2] = 0.5; }

  if (blast && game.time - blast.t < 1.0) { const k = Math.pow(1 - (game.time - blast.t), 2); flashPos[0] = blast.p[0]; flashPos[1] = blast.p[1] + 1; flashPos[2] = blast.p[2]; flashCol[0] = 12 * k; flashCol[1] = 6 * k; flashCol[2] = 1.6 * k; }

  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo); gl.viewport(0, 0, SHADOW, SHADOW); gl.clear(gl.DEPTH_BUFFER_BIT);
  globals(skinDepth, light, light, eye); drawFighters(skinDepth, false);
  globals(staticDepth, light, light, eye); drawStatics(staticDepth, false);
  if (world.map === 'island') drawFloraShadow(light, eye);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  gl.viewport(0, 0, w, h); gl.clearColor(...SKY[world.map], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  if (world.map === 'island') drawLand(vp, light, eye);
  else { globals(plateProg, vp, light, eye); gl.bindVertexArray(plate); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  globals(skinProg, vp, light, eye); gl.uniform1i(skinProg.u.uTex, 0); gl.uniform1i(skinProg.u.uNormalMap, 1); drawFighters(skinProg, true, hideSelf);
  globals(pbrProg, vp, light, eye); gl.uniform1i(pbrProg.u.uTex, 0); gl.uniform1i(pbrProg.u.uNormalMap, 1); gl.uniform1i(pbrProg.u.uOrm, 2); drawStatics(pbrProg, true, hideSelf);
  if (world.map === 'island') drawSea(vp, light, eye);
  drawEffects(vp, eye, view.fwd);
}

// ======================================================================= interface
const barEls = bots.map(() => { const d = document.createElement('div'); d.className = 'bar'; d.innerHTML = '<i></i>'; ui.bars.appendChild(d); return d; });
function project(p) {
  const m = lastView.vp, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return w > 0.1 ? [(x / w * 0.5 + 0.5) * lastView.w, (0.5 - y / w * 0.5) * lastView.h] : null;
}
function hud(dt) {
  if (hudDirty) {
    hudDirty = false;
    const g = player.weapon ? GUNS[player.weapon] : null, am = g && player.ammo[player.weapon];
    ui.weapon.textContent = g ? g.name : 'Fists';
    ui.ammo.innerHTML = g ? `<b class="${am.clip <= g.mag * 0.2 ? 'low' : ''}">${am.clip}</b> / ${am.spare}` : '';
    ui.hp.textContent = Math.ceil(player.hp); ui.hpfill.style.width = player.hp + '%';
    ui.slots.innerHTML = [['1', 'ak'], ['2', 'glock'], ['3', 'awp']].map(([k, id]) => `<span class="${player.weapon === id ? 'on' : player.inv.includes(id) ? '' : 'none'}">${k} ${player.inv.includes(id) ? GUNS[id].name : '---'}</span>`).join('') + `<span class="${player.weapon ? '' : 'on'}">4 Fists</span>`;
    ui.score.textContent = `Knockouts ${game.kills} · Deaths ${game.deaths}`;
  }
  const g = player.weapon ? GUNS[player.weapon] : null;
  if (lastView) {
    const spread = g ? (g.spread + player.bloom) * (1 - 0.65 * player.ads) + player.speed / 3.8 * 0.018 : 0.004;
    ui.cross.style.setProperty('--gap', (4 + spread / Math.tan(cam.fov / 2) * lastView.h / 2) + 'px');
    ui.cross.classList.toggle('dot', !g);
  }
  ui.cross.style.opacity = player.sprintW > 0.5 || player.dead >= 0 ? 0 : 1;
  game.marker = Math.max(0, game.marker - dt); ui.marker.style.opacity = game.marker > 0 ? 1 : 0;
  game.hurtFade = Math.max(0, game.hurtFade - dt);
  ui.vignette.style.opacity = player.dead >= 0 ? 1 - 0.85 * smooth(0.8, 1.8, player.dead) : Math.max(game.hurtFade, (40 - player.hp) / 70);
  ui.hurtDir.style.opacity = game.hurtFade;
  game.note = Math.max(0, game.note - dt); if (!game.note) ui.note.style.opacity = 0;
  hudLoot(dt);
  const sc = scopeAmount();
  ui.scope.style.opacity = smooth(0.5, 0.9, sc);
  if (sc > 0.4 || looting) ui.cross.style.opacity = 0;
  ui.reloadbar.style.display = player.reload >= 0 ? 'block' : 'none';
  if (player.reload >= 0) ui.reloadbar.firstElementChild.style.width = (player.reload / g.reload * 100) + '%';
  bots.forEach((b, i) => {
    // health bar over the living, an arrow over bodies that still have loot
    const body = b.dead >= 1.2 && !b.looted && !looting && !b.send, alive = b.dead < 0;
    const at = alive ? V.add(b.pos, [0, b.crouch ? 1.6 : 1.92, 0]) : [b.pos[0] - Math.sin(b.yaw) * 0.8, b.pos[1] + 0.75 + Math.sin(game.time * 5) * 0.08, b.pos[2] - Math.cos(b.yaw) * 0.8];
    const el = barEls[i], p = (alive || body) && lastView && scopeAmount() < 0.5 && !behindHill(cameraEye().eye, at) ? project(at) : null;
    el.style.display = p ? 'block' : 'none';
    el.classList.toggle('loot', body);
    el.classList.toggle('soon', body && b.dead > LOOT_WINDOW - 3);
    if (p) { el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; el.firstElementChild.style.width = b.hp + '%'; }
  });
}

cam.yaw = player.yaw - Math.PI;
let last = performance.now(), manual = false;
function frame(now) {
  const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw); last = now;
  if (!manual) {
    if (game.running && raw < 0.5) {
      frameAvg += (raw - frameAvg) * 0.05; qualityWait -= raw;
      if (qualityWait <= 0) {
        qualityWait = 1.5;
        if (frameAvg > 0.026 && quality > 0.5) quality = Math.max(0.5, quality - 0.12);
        else if (frameAvg < 0.018 && quality < 1) quality = Math.min(1, quality + 0.08);
      }
    }
    if (game.running) update(dt); else effectsStep(dt);
    render(); hud(dt);
  }
  requestAnimationFrame(frame);
}
ui.msg.textContent = '';
ui.play.disabled = false;
player.target = [0, 1.2, -10];
for (const f of fighters) poseFighter(f);
update(0.016); render();
requestAnimationFrame(frame);

// hooks used by the automated checks
window.__game = {
  ready: true, player, bots, chests, cam, game, mouse, keys, GUNS, world, setMap, groundAt, solids,
  step(seconds) { manual = true; for (let t = 0; t < seconds - 1e-6; t += 1 / 60) { update(1 / 60); render(); hud(1 / 60); } },
  draw() { manual = true; render(); hud(0); },
  resume() { manual = false; }, give, equip, startReload,
  get looting() { return looting; },
  get sendCount() { return sends.length + helpers.length; },
  gunInfo() { const f = player; if (!f.gun) return null; const g = f.gun.g, hr = bonePos(f, 'hand_R'), hl = bonePos(f, 'hand_L'); const at = q => V.add(f.gun.p, M3.vec(f.gun.S, q)); return { rightErr: V.len(V.sub(hr, at(g.right.at))), leftErr: V.len(V.sub(hl, at(g.left.at))), muzzle: at(g.muzzle), forward: M3.vec(f.gun.R, [0, 0, 1]), target: f.target }; },
  error() { return gl.getError(); }
};
})().catch(err => { console.error(err); document.getElementById('msg').textContent = 'The game could not start: ' + String(err.message).slice(0, 300); });
