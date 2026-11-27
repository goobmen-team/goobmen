// ======================================================================= the tiny bike
// a BMX far too small for him (model from tools/make_scenery.py). E to climb on and off.
// bike space: origin on the ground between the wheels, +Z forward, +X the rider's left. while riding,
// the rider is posed in that same space, so he leans, wheelies and hops with it
const bikes = [];
const BIKE_CHANCE = 0.55;                                    // that there is one at any particular house
const ARMBOX = boxMesh(0.018, 1, 0.024, 0, 0.5, 0), AXLEBOX = boxMesh(1, 0.016, 0.016, 0.5, 0, 0);
function newBike(x, z, yaw) {
  return { p: [x, floorAt(x, z), z], yaw, lean: 0.16, leanV: 0, rest: 0.16, pitch: 0, steer: 0.25, spin: 0, crank: 0.9, sq: 0, sqV: 0 };
}
// called when the map changes, once the new one is in place
function setBikes(name) {
  endRide(true);
  bikes.length = 0;
  if (name !== 'island') return;
  // TEMPORARY, for testing: one waiting by the "something cool here" sign
  bikes.push(newBike(-2.7, 5.3, 2.3));
  for (const q of HOUSES) {
    if (Math.random() > BIKE_CHANCE) continue;
    // in the room by the door, in the big room, or dumped out front
    const r = Math.random(), [lx, lz, turn] = r < 0.4 ? [2.0, 2.2, 1.45] : r < 0.65 ? [-2.2, 1.6, 0.4] : [5.9, -1.2, 0.2];
    const [x, z] = houseWorld(q, lx, lz);
    const b = newBike(x, z, q.yaw + turn);
    if (r >= 0.65) { b.rest = b.lean = 1.2; }                // outside ones lie where they were dropped
    bikes.push(b);
  }
}
function bikeNear(p) {
  let best = null, bestD = 1.2;
  for (const b of bikes) {
    const d = Math.hypot(b.p[0] - p[0], b.p[2] - p[2]);
    if (!b.rider && d < bestD && Math.abs(b.p[1] - p[1]) < 1.2) { bestD = d; best = b; }
  }
  return best;
}

// ---------------------------------------------------------------- where the bike is and how it is turned
// wheelies swing round the back wheel's contact, stoppies round the front's
function bikeFrame(b) {
  const tip = M3.rx(b.pitch), pivot = [0, 0, b.pitch < 0 ? BIKE.at.rear[2] : BIKE.at.front[2]];
  const yawR = M3.ry(b.yaw);
  const R = M3.mul(yawR, M3.mul(tip, M3.rz(b.lean)));
  const p = V.add(b.p, M3.vec(yawR, V.sub(pivot, M3.vec(tip, pivot))));
  return { R, p };
}
const steerTurn = b => M3.axis(BIKE.at.steerAxis, b.steer);
const steered = (b, q) => V.add(BIKE.at.steer, M3.vec(steerTurn(b), V.sub(q, BIKE.at.steer)));
const pedalAt = (b, s) => {
  const at = BIKE.at, a = b.crank + (s > 0 ? 0 : Math.PI);
  return [s * at.pedalX, at.crank[1] + at.arm * Math.cos(a), at.crank[2] + at.arm * Math.sin(a)];
};

function drawBikes(prog, textured) {
  const at = BIKE.at;
  for (const b of bikes) {
    if (Math.hypot(b.p[0] - player.pos[0], b.p[2] - player.pos[2]) > (textured ? 90 : 18)) continue;
    if (textured) {
      gl.uniform1i(prog.u.uHasTex, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, BIKE.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, BIKE.normal);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, BIKE.orm);
    }
    const F = bikeFrame(b);
    const R = M3.mul(F.R, [1 + b.sq * 0.4, 0, 0, 0, 1 - b.sq, 0, 0, 0, 1 + b.sq * 0.25]);   // it squashes when he plops on it
    // a part turned by L, where `move` is where its own origin ends up (all in bike space)
    const part = (mesh, L, move) => drawMesh(prog, mesh, M3.mul(R, L), V.add(F.p, M3.vec(R, move)));
    const about = (L, c) => V.sub(c, M3.vec(L, c));
    const S = steerTurn(b), spin = M3.rx(b.spin), crank = M3.rx(b.crank);
    part(BIKE.parts.frame, M3.id(), [0, 0, 0]);
    part(BIKE.parts.steer, S, about(S, at.steer));
    part(BIKE.parts.fwheel, M3.mul(S, spin), steered(b, about(spin, at.front)));
    part(BIKE.parts.rwheel, spin, about(spin, at.rear));
    part(BIKE.parts.crank, crank, about(crank, at.crank));
    for (const s of [1, -1]) part(BIKE.parts.pedal, M3.id(), pedalAt(b, s));
    flat(prog, [0.05, 0.05, 0.055], 0.45, 0.7);
    for (const s of [1, -1]) {
      const arm = M3.rx(b.crank + (s > 0 ? 0 : Math.PI)), end = pedalAt(b, s);
      part(ARMBOX, M3.mul(arm, [1, 0, 0, 0, at.arm, 0, 0, 0, 1]), [s * 0.045, at.crank[1], at.crank[2]]);
      part(AXLEBOX, [at.pedalX - 0.045, 0, 0, 0, 1, 0, 0, 0, 1], [s > 0 ? 0.045 : -at.pedalX, end[1], end[2]]);
    }
  }
}

// ---------------------------------------------------------------- how he sits on it
// every way of riding is a set of numbers, so they can be blended from one to the next
const RIDE_SIT = () => [0, BIKE.at.seat[1] + 0.1, BIKE.at.seat[2] - 0.01];
function onPedals(b, s) {
  const p = pedalAt(b, s), a = b.crank + (s > 0 ? 0 : Math.PI);
  return { ankle: V.add(p, [s * 0.025, 0.095, -0.085]), knee: [s * 0.8, 0.3, 1], foot: 0.15 + 0.3 * Math.sin(a) };
}
function onBars(b, s) {
  const grip = steered(b, s > 0 ? BIKE.at.gripL : BIKE.at.gripR);
  return { wrist: V.add(grip, [s * 0.01, 0.045, -0.075]), dir: [-s * 0.2, -0.35, 1], palm: [0, -1, -0.2], elbow: [s, 0.1, -0.35], curl: 1.35 };
}
const legsOut = (s, t) => ({ ankle: [s * 0.52, 0.45 + 0.05 * Math.sin(t * 23 + s), 0.1 + 0.04 * Math.cos(t * 19 + s)], knee: [s * 0.2, 1, 0.4], foot: -0.5 });
const waving = (s, t, hips) => ({ wrist: [s * (0.42 + 0.12 * Math.sin(t * 13 + s)), hips[1] + 0.98, hips[2] + 0.12], dir: [s * 0.3 * Math.sin(t * 13), 1, 0], palm: [0, 0, 1], elbow: [s, -0.2, -0.3], curl: 0.2 });
const STYLES = {
  idle(b, t) {                                               // both feet on the floor, knees everywhere, looking about
    const w = Math.sin(t * 2.3), look = Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    const feet = s => ({ ankle: [s * 0.3, 0.095, -0.1], knee: [s * 0.9, 0, 1], foot: 0 });
    return { hips: RIDE_SIT(), bend: 0.42 + 0.03 * w, tilt: 0.05 * w, head: [-0.32, 0.9 * look, 0.1 * w], L: feet(1), R: feet(-1), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  pedal(b, t) {                                              // bobbing along, head nodding with every stroke
    const a = b.crank, hips = V.add(RIDE_SIT(), [0.02 * Math.sin(a), 0.03 * Math.abs(Math.sin(a)), 0]);
    return { hips, bend: 0.55 + 0.07 * Math.sin(2 * a), tilt: 0.16 * Math.sin(a), head: [-0.45 + 0.16 * Math.sin(2 * a), 0.12 * Math.sin(a), -0.12 * Math.sin(a)], L: onPedals(b, 1), R: onPedals(b, -1), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  sprint(b, t) {                                             // up off the seat, bum swinging, going for it
    const a = b.crank;
    return { hips: [0.07 * Math.sin(a), 0.75 + 0.03 * Math.abs(Math.cos(a)), -0.15], bend: 0.95, tilt: 0.24 * Math.sin(a), head: [-0.95 + 0.1 * Math.sin(2 * a), 0, -0.15 * Math.sin(a)], L: onPedals(b, 1), R: onPedals(b, -1), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  wheee(b, t) {                                              // downhill: feet off, legs out, loving it
    return { hips: V.add(RIDE_SIT(), [0, 0.015 * Math.sin(t * 27), 0]), bend: 0.12, tilt: 0.06 * Math.sin(t * 7), head: [-0.15 + 0.08 * Math.sin(t * 15), 0.15 * Math.sin(t * 5), 0.2 * Math.sin(t * 9)], L: legsOut(1, t), R: legsOut(-1, t), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  brake(b, t) {                                              // heels ploughing the ground, leaning right back
    const heel = s => ({ ankle: [s * 0.3, 0.1, 0.24], knee: [s * 0.6, 0.5, 1], foot: -0.5 });
    return { hips: V.add(RIDE_SIT(), [0, 0.02, -0.07]), bend: 0.05 + 0.04 * Math.sin(t * 40), tilt: 0.03 * Math.sin(t * 31), head: [0.1, 0.1 * Math.sin(t * 33), 0], L: heel(1), R: heel(-1), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  hop(b, t) {                                                // knees up
    return { hips: V.add(RIDE_SIT(), [0, 0.12, 0]), bend: 0.7, tilt: 0, head: [-0.6, 0, 0], L: onPedals(b, 1), R: onPedals(b, -1), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  superman(b, t) {
    return { hips: V.add(RIDE_SIT(), [0, 0.15, -0.08]), bend: 0.85, tilt: 0.1 * Math.sin(t * 11), head: [-0.9, 0, 0], L: legsOut(1, t), R: legsOut(-1, t), armL: onBars(b, 1), armR: onBars(b, -1) };
  },
  yahoo(b, t) {                                              // one arm round and round over his head
    const hips = V.add(RIDE_SIT(), [0, 0.1, 0]);
    return { hips, bend: 0.3, tilt: 0.18, head: [-0.25, -0.3, 0.2], L: onPedals(b, 1), R: onPedals(b, -1), armL: onBars(b, 1), armR: waving(-1, t, hips) };
  },
  nohands(b, t) {
    const hips = V.add(RIDE_SIT(), [0, 0.08, 0]);
    return { hips, bend: 0.1, tilt: 0.08 * Math.sin(t * 9), head: [-0.1, 0.25 * Math.sin(t * 8), 0], L: legsOut(1, t), R: legsOut(-1, t), armL: waving(1, t, hips), armR: waving(-1, t, hips) };
  }
};
const TRICKS = [['superman', 'WHEEE!'], ['yahoo', 'YAHOO!'], ['nohands', 'NO HANDS!'], ['hop', 'hup!']];
// mix the ways of riding by their weights
function mixRide(list) {
  const total = list.reduce((s, [, w]) => s + w, 0) || 1;
  const sum = get => list.reduce((out, [pose, w]) => { const v = get(pose); return typeof v === 'number' ? (out || 0) + v * w / total : v.map((x, i) => (out ? out[i] : 0) + x * w / total); }, 0);
  const leg = k => ({ ankle: sum(p => p[k].ankle), knee: sum(p => p[k].knee), foot: sum(p => p[k].foot) });
  const arm = k => ({ wrist: sum(p => p[k].wrist), dir: sum(p => p[k].dir), palm: sum(p => p[k].palm), elbow: sum(p => p[k].elbow), curl: sum(p => p[k].curl) });
  return { hips: sum(p => p.hips), bend: sum(p => p.bend), tilt: sum(p => p.tilt), head: sum(p => p.head), L: leg('L'), R: leg('R'), armL: arm('armL'), armR: arm('armR') };
}
// those numbers as the script the posing code understands
function rideScript(P) {
  const arm = a => ({ wrist: a.wrist, dir: V.norm(a.dir), palm: V.norm(a.palm), pole: a.elbow, curl: [a.curl, a.curl] });
  const leg = l => ({ ankle: l.ankle, pole: l.knee, footR: M3.rx(l.foot) });
  return { hips: P.hips, bend: P.bend, tilt: P.tilt, head: M3.mul(M3.mul(M3.ry(P.head[1]), M3.rx(P.head[0])), M3.rz(P.head[2])), arms: { L: arm(P.armL), R: arm(P.armR) }, legs: { L: leg(P.L), R: leg(P.R) } };
}
// standing on his own two feet beside it (x: how far to the side)
const standing = x => ({
  hips: [x, 0.7, -0.17], bend: 0.05, tilt: 0, head: [0, 0, 0],
  L: { ankle: [x + 0.19, 0.095, -0.15], knee: [0, 0, 1], foot: 0 }, R: { ankle: [x - 0.19, 0.095, -0.15], knee: [0, 0, 1], foot: 0 },
  armL: { wrist: [x + 0.42, 0.72, -0.12], dir: [0, -1, 0.1], palm: [-1, 0, 0], elbow: [1, 0, -1], curl: 0.4 },
  armR: { wrist: [x - 0.42, 0.72, -0.12], dir: [0, -1, 0.1], palm: [1, 0, 0], elbow: [-1, 0, -1], curl: 0.4 }
});

// ---------------------------------------------------------------- climbing on and off
const MOUNT = 0.9, OFF = 0.55;
function startRide(b) {
  const f = player;
  if (f.dead >= 0 || f.ride || looting || b.rider) return;
  const held = f.weapon;
  f.hand = null; f.use = null; f.thing = null; f.headTilt = null;
  equip(f, null);
  f.holdC4 = false; f.plantT = -1; f.carry = null; f.reload = -1; f.cycle = -1; f.inspect = -1; f.jump = -1; f.air = 0; f.punch = -1; f.ads = 0; f.sprintW = 0; f.crouch = false; f.legYaw = 0; f.speed = 0;
  game.aimToggle = false; mouse.fire = mouse.aim = mouse.pressed = false;
  f.ride = { b, mode: 'mount', t: 0, v: 0, vy: 0, vg: 0, air: false, trick: 3, rate: 0, idle: 0, held, eHeld: true, w: { idle: 1 }, bell: 3, said: 0, wheelie: 0 };
  b.rest = 0;
  f.ride.from = f.pos.slice(); f.ride.camFrom = cam.yaw;        // he walks over to the bike and the view turns round behind it while he gets on, instead of both snapping
  Sound.play('hup', 0.7); notify('E off · Space hop · Shift faster · click for the bell');
  hudDirty = true;
}
// let go of it. quiet: no animation, no fuss (map change, death)
function endRide(quiet) {
  const f = player, r = f.ride;
  if (!r) return;
  const b = r.b;
  b.rest = 1.2 * (b.lean < -0.02 ? -1 : 1); b.pitch = 0; b.steer = 0.3;
  b.p[1] = floorAt(b.p[0], b.p[2], b.p[1] + 0.5);
  f.ride = null; f.script = null; f.scriptW = 0; f.air = 0; stars.length = 0;
  lootHeld = true;                                           // the E that got him off does not put him back on
  if (!quiet && r.held && f.inv.includes(r.held)) equip(f, r.held);
  hudDirty = true;
}
// step to the side of the bike (or wherever there is room) and stand there
function stepOff(f, b) {
  const left = [Math.cos(b.yaw), 0, -Math.sin(b.yaw)], spot = { pos: V.mad(b.p, left, 0.55), isPlayer: true };
  confine(spot);
  f.pos = [spot.pos[0], groundAt(spot.pos[0], spot.pos[2], b.p[1] + 0.5), spot.pos[2]];
  f.yaw = b.yaw;
}

// ---------------------------------------------------------------- coming off the hard way
function crash(back, word) {
  const f = player, r = f.ride, b = r.b;
  if (r.mode === 'crash') return;
  const fwd = [Math.sin(b.yaw), 0, Math.cos(b.yaw)], far = clamp(Math.abs(r.v) * 0.22, 0.8, 1.9) * (back ? -1 : 1);
  const land = { pos: V.mad(b.p, fwd, far), isPlayer: true };
  confine(land);
  land.pos[1] = floorAt(land.pos[0], land.pos[2], b.p[1] + 0.5);
  Object.assign(r, { mode: 'crash', t: 0, back, from: b.p.slice(), yaw: b.yaw, to: land.pos.slice(), landed: false });
  b.rest = 1.2 * (Math.random() < 0.5 ? -1 : 1); b.leanV = Math.sign(b.rest) * 3; b.sqV += 3; b.pitch = 0;
  popWord(V.add(b.p, [0, 1.5, 0]), word || 'BONK!', 0.9);
  Sound.play('bonk', 0.9); Sound.play('whoosh', 0.6);
  cam.shake = Math.max(cam.shake, 0.8);
}
// he got shot, or something blew up
function bikeHurt(f, amount) {
  if (!f.ride) return;
  if (f.hp <= 0) endRide(true);
  else if (amount >= 25) crash(true, 'OOF!');
}
const CRASH = { fly: 0.75, lie: 1.0, up: 0.65 };
function crashStep(f, r, dt) {
  const t = r.t, fly = clamp(t / CRASH.fly, 0, 1), up = smooth(CRASH.fly + CRASH.lie, CRASH.fly + CRASH.lie + CRASH.up, t);
  // over he goes: once round and a bit, landing flat on his back
  const turn = (r.back ? -2.5 * Math.PI : 1.5 * Math.PI) * smooth(0, 1, fly);
  const lying = -Math.PI / 2;
  const pitch = fly < 1 ? turn : lying * (1 - up);
  const yawR = M3.ry(r.yaw), R = M3.mul(yawR, M3.rx(pitch));
  const middle = V.lerp(r.from, r.to, fly);
  const high = fly < 1 ? 0.75 + (0.17 - 0.75) * fly + 1.0 * Math.sin(Math.PI * fly) : 0.17 + (0.75 - 0.17) * up;
  const centre = [middle[0], middle[1] + high, middle[2]];
  const root = V.sub(centre, M3.vec(R, [0, 0.75, 0]));
  const flail = fly < 1 ? 1 : 0, w = t * 24, still = 1 - flail;
  const P = {
    hips: [0, 0.7, -0.015], bend: flail * 0.3 * Math.sin(w * 0.5), tilt: 0, head: [still * 0.1 * Math.sin(t * 6), still * 0.35 * Math.sin(t * 4), 0],
    L: { ankle: [0.38, 0.22 + flail * 0.22 * (1 + Math.sin(w)), 0.1 + flail * 0.25 * Math.cos(w)], knee: [0.3, 0, 1], foot: 0 },
    R: { ankle: [-0.38, 0.22 + flail * 0.22 * (1 - Math.sin(w)), 0.1 - flail * 0.25 * Math.cos(w)], knee: [-0.3, 0, 1], foot: 0 },
    armL: { wrist: [0.86, 1.25 + flail * 0.45 * Math.sin(w), -0.02], dir: [1, 0, 0], palm: [0, 0, 1], elbow: [0, -1, 0], curl: 0.2 },
    armR: { wrist: [-0.86, 1.25 - flail * 0.45 * Math.sin(w), -0.02], dir: [-1, 0, 0], palm: [0, 0, 1], elbow: [0, -1, 0], curl: 0.2 }
  };
  let Q = P;
  if (up > 0) {                                              // back up, rubbing his sore head
    const stand = standing(0);
    stand.hips = [0, 0.7, -0.015];
    for (const [k, s] of [['L', 1], ['R', -1]]) stand[k].ankle = [s * 0.19, 0.095, 0.03];
    stand.armR = { wrist: [-0.16 + 0.05 * Math.sin(t * 17), 1.62, 0.1], dir: [1, 0.3, 0], palm: [0, -1, 0], elbow: [-1, 0, 0.2], curl: 0.5 };
    stand.head = [0.15, 0.12 * Math.sin(t * 9), 0.15];
    Q = mixRide([[P, 1 - up], [stand, up]]);
  }
  f.script = rideScript(Q); f.script.root = { R, p: root }; f.scriptW = 1;
  f.pos = middle.slice(); f.pos[1] = middle[1];
  if (!r.landed && fly >= 1) {
    r.landed = true; Sound.play('thud', 0.9); Sound.play('ugh', 0.8); cam.shake = Math.max(cam.shake, 0.6);
    puff([r.to[0], r.to[1] + 0.1, r.to[2]], 18, [0.55, 0.50, 0.40, 0.65], 1.4, 0.08, 0.7, 1);
    popWord([r.to[0], r.to[1] + 0.8, r.to[2]], 'owww...', 1.1);
  }
  stars.length = 0;
  const see = smooth(CRASH.fly, CRASH.fly + 0.1, t) * (1 - smooth(CRASH.fly + CRASH.lie + 0.3, CRASH.fly + CRASH.lie + CRASH.up, t));
  if (see > 0) stars.push({ f, w: see });
  if (t >= CRASH.fly + CRASH.lie + CRASH.up) {
    const held = r.held, yaw = r.yaw, at = r.to.slice();
    endRide(true);
    f.pos = at; f.yaw = yaw;
    if (held && f.inv.includes(held)) equip(f, held);
  }
}

// ---------------------------------------------------------------- riding
// is the leading wheel about to go into something solid?
function wheelBlocked(p, yaw, way) {
  const q = [p[0] + Math.sin(yaw) * 0.46 * way, p[2] + Math.cos(yaw) * 0.46 * way];
  if (world.map !== 'island') return false;
  return solidsNear(q[0], q[1]).some(o => !(p[1] > o.y + o.h - 0.2 || p[1] < o.y - 2.5 || (o.thin && p[1] < o.y - 0.6)) && edgeOf(o, q[0], q[1]).d < 0.06 && edgeOf(o, q[0], q[1]).d < edgeOf(o, p[0], p[2]).d);
}
// runs in place of walking while he has the bike. true: it has the player this frame
function rideStep(dt) {
  const f = player, r = f.ride;
  if (!r) return false;
  const b = r.b;
  r.t += dt; f.time += dt; f.speed = 0; f.legYaw = 0; f.jump = -1; f.air = 0;
  for (const n of CLIP_NAMES) f.weights[n] = n === 'Idle' ? 1 : 0;
  const e = keys.has('KeyE'), eDown = e && !r.eHeld; r.eHeld = e;
  f.target = V.add(f.pos, [Math.sin(b.yaw) * 8, 1, Math.cos(b.yaw) * 8]);
  if (r.mode === 'crash') { crashStep(f, r, dt); return true; }

  if (r.mode === 'mount') {                                  // a leg thrown high over, then plop
    const u = clamp(r.t / MOUNT, 0, 1), sit = STYLES.idle(b, f.time), side = standing(0.5);
    const over = smooth(0.12, 0.66, u), seat = smooth(0.28, 0.74, u);
    const P = mixRide([[side, 1 - seat], [sit, seat]]);
    P.hips = V.add(P.hips, [0, 0.2 * Math.sin(Math.PI * over), 0]);
    P.R.ankle = V.add(V.lerp(side.R.ankle, sit.R.ankle, over), [0, 0.78 * Math.sin(Math.PI * over), -0.25 * Math.sin(Math.PI * over)]);
    P.R.knee = [-0.5, 1, 0.2];
    P.armL = mixRide([[side, 1 - smooth(0, 0.25, u)], [sit, smooth(0, 0.25, u)]]).armL;
    P.armR = mixRide([[side, 1 - smooth(0, 0.25, u)], [sit, smooth(0, 0.25, u)]]).armR;
    if (r.t >= MOUNT * 0.74 && !r.plopped) {
      r.plopped = true; b.sqV += 3.6; Sound.play('squeak', 0.9); popWord(V.add(b.p, [0, 1.6, 0]), 'hehe!', 0.7);
      puff([b.p[0], b.p[1] + 0.05, b.p[2]], 10, [0.55, 0.50, 0.40, 0.6], 1.0, 0.05, 0.5, 1);
    }
    const arrive = smooth(0, 0.22, r.t);
    f.pos = V.lerp(r.from, b.p, arrive); cam.yaw = r.camFrom + wrap(b.yaw + Math.PI - r.camFrom) * smooth(0, 0.4, r.t);
    f.script = rideScript(P); const F = bikeFrame(b); f.script.root = { R: F.R, p: V.add(F.p, [0, -b.sq * 0.4 * smooth(0.7, 0.8, u), 0]) }; f.scriptW = arrive;
    if (u >= 1) { f.pos = b.p.slice(); r.mode = 'ride'; r.t = 0; r.eHeld = e; mouse.pressed = false; }
    return true;
  }
  if (r.mode === 'off') {
    const u = clamp(r.t / OFF, 0, 1), side = standing(0.5), over = smooth(0, 0.8, u);
    const P = mixRide([[r.last, 1 - smooth(0.1, 0.75, u)], [side, smooth(0.1, 0.75, u)]]);
    P.hips = V.add(P.hips, [0, 0.18 * Math.sin(Math.PI * over), 0]);
    P.R.ankle = V.add(V.lerp(r.last.R.ankle, side.R.ankle, over), [0, 0.7 * Math.sin(Math.PI * over), -0.2 * Math.sin(Math.PI * over)]);
    f.script = rideScript(P); const F = bikeFrame(b); f.script.root = { R: F.R, p: F.p }; f.scriptW = 1;
    if (u >= 1) {
      const held = r.held;
      endRide(true); stepOff(f, b);
      b.leanV = Math.sign(b.rest) * 0.5;
      if (held && f.inv.includes(held)) equip(f, held);
    }
    return true;
  }

  // ---- on it and going
  const held = (...codes) => codes.some(c => keys.has(c)) ? 1 : 0;
  const gas = held('KeyW', 'ArrowUp'), back = held('KeyS', 'ArrowDown'), turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight');
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'), top = sprint ? 9.5 : 6.2;
  if (eDown && !r.air) { r.mode = 'off'; r.t = 0; r.last = r.shown || STYLES.idle(b, f.time); r.v = 0; b.pitch = 0; return true; }
  if (mouse.pressed) { mouse.pressed = false; Sound.play('ding', 0.9); popWord(V.add(b.p, [0, 1.7, 0]), 'ding ding!', 0.7); }

  // steering: the bike chases where you look, and A and D swing the view round
  cam.yaw += turn * 2.4 * dt;
  const moving = Math.abs(r.v) > 0.25 || turn;
  const want = moving ? clamp(wrap(cam.yaw + Math.PI - b.yaw) * 6, -1, 1) * (Math.abs(r.v) > 1 ? 3.2 : 1.9) * clamp(Math.abs(wrap(cam.yaw + Math.PI - b.yaw)) * 3, 0, 1) : 0;
  r.rate += (want - r.rate) * Math.min(1, dt * 10);
  b.yaw += r.rate * dt;

  // pedalling, braking, and the hills
  const wasStill = Math.abs(r.v) < 0.6;
  if (gas && r.v < top) r.v += (r.v < 0 ? 9 : 4.6) * dt;
  else if (back) r.v = r.v > 0.15 ? r.v - 10 * dt : Math.max(r.v - 3 * dt, -1.6);
  else r.v -= Math.sign(r.v) * Math.min(Math.abs(r.v), 1.1 * dt);
  if (r.v > top) r.v -= (r.v - top) * Math.min(1, 0.7 * dt);
  const fwd = [Math.sin(b.yaw), 0, Math.cos(b.yaw)];
  const under = z => floorAt(f.pos[0] + fwd[0] * z, f.pos[2] + fwd[2] * z, f.pos[1] + 0.5);
  const grade = clamp((under(0.36) - under(-0.36)) / 0.72, -1.2, 1.2);
  if (!r.air && (gas || back || Math.abs(r.v) > 0.5)) r.v -= 7.4 * grade / Math.hypot(1, grade) * dt;
  r.v = clamp(r.v, -2, 14);
  if (gas && sprint && wasStill && !r.air && r.wheelie <= 0 && r.idle > 0.4) { r.wheelie = 0.9; popWord(V.add(b.p, [0, 1.6, 0]), 'WHOA!', 0.7); Sound.play('squeak', 0.7); }

  // move, and see whether something was in the way
  const x0 = f.pos[0], z0 = f.pos[2], y0 = f.pos[1], step = r.v * dt, way = Math.sign(r.v) || 1;
  f.pos[0] += fwd[0] * step; f.pos[2] += fwd[2] * step;
  let stuck = false;
  if (step && wheelBlocked([x0 + fwd[0] * step, y0, z0 + fwd[2] * step], b.yaw, way)) { f.pos[0] = x0; f.pos[2] = z0; stuck = true; }
  confine(f); cliffs(f, x0, z0);
  for (const c of chests) if (Math.abs(c.pos[1] - f.pos[1]) < 1.4) push(f, c.pos, 0.66);
  const made = ((f.pos[0] - x0) * fwd[0] + (f.pos[2] - z0) * fwd[2]);
  if (Math.abs(r.v) > 0.5 && (stuck || made * way < Math.abs(step) * 0.45)) {
    if (Math.abs(r.v) > 4.5) { b.p = [f.pos[0], y0, f.pos[2]]; crash(true); return true; }
    if (Math.abs(r.v) > 1.2) { Sound.play('thud', 0.4); b.sqV += 1.5; }
    r.v *= -0.15;
  }
  // running people over
  for (const o of bots) {
    if (o.dead >= 0 || Math.abs(r.v) < 3.5 || Math.hypot(o.pos[0] - f.pos[0] - fwd[0] * 0.4, o.pos[2] - f.pos[2] - fwd[2] * 0.4) > 0.65 || Math.abs(o.pos[1] - f.pos[1]) > 1) continue;
    if (game.time - (o.bumped || 0) < 1) continue;
    o.bumped = game.time; popWord(V.add(o.pos, [0, 1.9, 0]), 'BONK!', 0.8); Sound.play('bonk', 0.9);
    damage(o, 35, f); r.v *= 0.45; b.sqV += 2; cam.shake = Math.max(cam.shake, 0.5);
  }

  // up and down: hops, ramps and drops
  const ground = floorAt(f.pos[0], f.pos[2], y0 + 0.5);
  if (!r.air) {
    const vg = (ground - y0) / dt;
    // the ground falling away faster than he can: he sails off it
    if (Math.abs(r.v) > 3 && ground < y0 + r.vg * dt - 6 * dt * dt - 0.012) { r.air = true; r.vy = clamp(r.vg, -2, 6); r.trick = Math.floor(rand(0, 3)); popWord(V.add(b.p, [0, 1.7, 0]), TRICKS[r.trick][1], 0.8); f.pos[1] = y0; }
    else { f.pos[1] = ground; r.vg += (vg - r.vg) * Math.min(1, dt * 12); }
  }
  if (keys.has('Space') && !r.spaceHeld && !r.air) {
    r.air = true; r.vy = 3.9; r.trick = Math.floor(rand(0, TRICKS.length));
    popWord(V.add(b.p, [0, 1.7, 0]), TRICKS[r.trick][1], 0.8); Sound.play('boing', 0.5); Sound.play('hup', 0.6);
    b.sqV += 2.5;
  }
  r.spaceHeld = keys.has('Space');
  if (r.air) {
    r.vy -= 11 * dt; f.pos[1] += r.vy * dt;
    if (f.pos[1] <= ground && r.vy <= 0) {
      const hard = -r.vy;
      f.pos[1] = ground; r.air = false; r.vy = 0; r.vg = 0;
      if (hard > 9) { b.p = f.pos.slice(); crash(false, 'CRUNCH!'); return true; }
      b.sqV += Math.min(5, hard * 0.8); cam.shake = Math.max(cam.shake, Math.min(0.5, hard * 0.07));
      Sound.play('squeak', 0.8); Sound.play('land', 0.6);
      puff([f.pos[0], f.pos[1] + 0.05, f.pos[2]], 12, [0.55, 0.50, 0.40, 0.65], 1.2, 0.06, 0.5, 1);
    }
  }
  b.p = f.pos.slice();
  if (world.map === 'island' && inSea(f.pos) && !r.air) {      // into the water
    popWord(V.add(b.p, [0, 1.5, 0]), 'SPLOOSH!', 0.9);
    puff([f.pos[0], SEA.level + 0.1, f.pos[2]], 40, [0.85, 0.93, 0.97, 0.85], 2.4, 0.08, 0.8, 6);
    Sound.play('land', 0.9);
    const keep = r.held; endRide(true);
    if (keep && f.inv.includes(keep)) equip(f, keep);
    return true;
  }

  // which way of riding this is
  const speed = Math.abs(r.v);
  const downhill = !r.air && speed > 5.5 && (grade < -0.13 || speed > 10);
  r.idle = speed < 0.35 && !r.air ? r.idle + dt : 0;
  const braking = back && r.v > 1.5 && !r.air;
  const style = r.air ? TRICKS[r.trick][0] : braking ? 'brake' : downhill ? 'wheee' : speed < 0.35 ? 'idle' : sprint && gas && speed > 5 ? 'sprint' : 'pedal';
  r.w[style] = r.w[style] || 0;
  for (const k of Object.keys(r.w)) {
    r.w[k] += ((k === style ? 1 : 0) - r.w[k]) * Math.min(1, dt * (r.air ? 14 : 8));
    if (k !== style && r.w[k] < 0.005) delete r.w[k];
  }
  // the moving parts
  b.spin += r.v * dt / BIKE.at.wheel;
  const turnBefore = b.crank;
  if (style === 'wheee') b.crank += r.v * dt * 3.4;
  else if (gas || (r.v < -0.1)) b.crank += (r.v >= 0 ? Math.max(r.v, 1.2) : r.v * 1.6) * dt * 2.0;
  if (Math.floor(b.crank / (Math.PI * 2)) !== Math.floor(turnBefore / (Math.PI * 2)) && speed > 1) Sound.play('squeak', style === 'sprint' ? 0.35 : 0.18);   // it badly needs oil
  if (!gas && speed > 1.5 && !r.air && Math.floor(b.spin) !== Math.floor(b.spin - r.v * dt / BIKE.at.wheel)) Sound.play('tick', 0.25);
  const low = smooth(0.4, 1.2, speed) * (1 - smooth(2.5, 5, speed));
  let lean = clamp(-r.rate * speed * 0.045, -0.45, 0.45);
  lean += 0.11 * Math.sin(b.crank) * low;                    // wobbly when slow
  if (style === 'sprint') lean -= 0.24 * Math.sin(b.crank);
  if (style === 'idle') lean += 0.07 * Math.sin(f.time * 2.3);
  b.lean += (lean - b.lean) * Math.min(1, dt * 9);
  b.steer += (clamp(r.rate * 0.22, -0.55, 0.55) + 0.2 * Math.sin(f.time * 8) * low - b.steer) * Math.min(1, dt * 12);
  r.wheelie = Math.max(0, r.wheelie - dt);
  const pitch = r.air ? clamp(-0.1 - r.vy * 0.09, -0.5, 0.28) : r.wheelie > 0 ? -0.62 * Math.sin(Math.PI * Math.min(1, r.wheelie / 0.9)) : -Math.atan(grade) + (braking ? 0.1 : 0);
  b.pitch += (pitch - b.pitch) * Math.min(1, dt * 10);

  if (braking) {
    if (!r.skid) { r.skid = true; Sound.play('skid', 0.7); popWord(V.add(b.p, [0, 1.6, 0]), 'EEEK!', 0.6); }
    for (const s of [1, -1]) puff(V.add(b.p, M3.vec(M3.ry(b.yaw), [s * 0.3, 0.04, 0.3])), 1, [0.58, 0.52, 0.42, 0.55], 0.5, 0.06, 0.45, 1);
  } else r.skid = false;
  r.said -= dt;
  if (downhill && r.said <= 0) { popWord(V.add(b.p, [0, 1.7, 0]), 'WHEEEEE!', 0.9); Sound.play('ooga', 0.5); r.said = 2.6; }
  if (style === 'sprint' && r.said <= 0) { popWord(V.add(b.p, [0, 1.7, 0]), 'HNNNG!', 0.7); r.said = 2.2; }
  if (r.idle > r.bell) { r.bell += rand(4, 7); Sound.play('ding', 0.6); popWord(V.add(b.p, [0, 1.6, 0]), 'ding?', 0.7); }
  if (!r.idle) r.bell = 3;

  const P = mixRide(Object.entries(r.w).map(([k, w]) => [STYLES[k](b, f.time), w]));
  r.shown = P;
  const F = bikeFrame(b);
  f.script = rideScript(P); f.script.root = { R: F.R, p: V.add(F.p, [0, -b.sq * 0.4, 0]) }; f.scriptW = 1;
  return true;
}
// springs: the squash, and parked bikes tipping onto their sides
function bikesStep(dt) {
  for (const b of bikes) {
    if (b.rider) continue;                                     // someone else is on it
    b.sqV += (-b.sq * 260 - b.sqV * 13) * dt; b.sq = clamp(b.sq + b.sqV * dt, -0.2, 0.3);
    const ridden = player.ride && player.ride.b === b;
    if (ridden && player.ride.mode === 'ride') continue;
    const before = b.lean;
    if (Math.abs(b.rest) > 0.5) b.leanV += Math.sign(b.rest) * 9 * dt;                       // falling over
    else b.leanV += ((b.rest - b.lean) * 90 - b.leanV * 11) * dt;
    b.lean += b.leanV * dt;
    if (Math.abs(b.rest) > 0.5 && b.lean * Math.sign(b.rest) >= Math.abs(b.rest)) {            // it hits the floor and bounces
      b.lean = b.rest;
      if (Math.abs(b.leanV) > 1.2) { Sound.play('thud', 0.35); Sound.play('ding', 0.25); b.leanV *= -0.25; } else b.leanV = 0;
    }
    if (!ridden && b.pitch) b.pitch *= Math.exp(-dt * 8);
    if (before !== b.lean && !ridden) b.spin += dt * 0.6;
  }
}
