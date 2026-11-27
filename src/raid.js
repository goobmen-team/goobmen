// ======================================================================= rob run: what you build, keep and take
// On the island you wall in a stash, keep your shiny rocks and good guns in it, and rob everybody else's. Walls stop
// feet, bullets and eyes; C4 takes them down. A hammer builds, a work table fits parts to your guns.
const ROCK_MAX = 25000;                                      // the most shiny rocks one pocket or one stash will hold
const BAG_SLOTS = 7, STASH_SLOTS = 10;
const PIECES = {
  wall: { name: 'Log wall', cost: 8, hw: 1.2, hd: 0.23, h: 2.3 },
  door: { name: 'Door wall', cost: 12, hw: 1.2, hd: 0.23, h: 2.3 },
  stash: { name: 'Stash', cost: 15, hw: 0.52, hd: 0.36, h: 0.6 },
  bench: { name: 'Work table', cost: 30, hw: 0.78, hd: 0.42, h: 0.95 }
};
const PIECE_ORDER = ['wall', 'door', 'stash', 'bench'];
const raid = { builds: [], cells: new Map(), kind: 0, turn: 0, ghost: null, swing: 0, rightWas: false, use: null, alarm: null, nextRaid: 150 };
const raidOn = () => world.map === 'island';
const addRocks = (n, more) => Math.min(ROCK_MAX, n + more);

// ---------------------------------------------------------------- where the pieces are
// x runs along a piece and +z is its outside face, turned the same way as everything else (yaw)
const buildLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
const buildWorld = (b, lx, ly, lz) => [b.x + lx * b.c + lz * b.s, b.y + ly, b.z - lx * b.s + lz * b.c];
const CELL = 6;
const cellKey = (i, j) => i * 4096 + j;
function cellsOf(b, fn) {
  const r = PIECES[b.kind].hw * b.sx + 0.6;
  for (let i = Math.floor((b.x - r) / CELL); i <= Math.floor((b.x + r) / CELL); i++)
    for (let j = Math.floor((b.z - r) / CELL); j <= Math.floor((b.z + r) / CELL); j++) fn(cellKey(i, j));
}
const buildsNear = (x, z) => raid.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
function newPiece(kind, x, y, z, yaw, owner, sx) {
  return { kind, x, y, z, yaw, c: Math.cos(yaw), s: Math.sin(yaw), sx: sx || 1, owner, open: 0, openV: 0, items: kind === 'stash' ? [] : null, rocks: 0, broken: false, gone: false, born: game.time };
}
function addPiece(b) {
  raid.builds.push(b);
  cellsOf(b, k => { if (!raid.cells.has(k)) raid.cells.set(k, []); raid.cells.get(k).push(b); });
  while (raid.builds.length > 600) removePiece(raid.builds.find(q => q.kind === 'wall') || raid.builds[0]);
  return b;
}
function removePiece(b) {
  const i = raid.builds.indexOf(b);
  if (i < 0) return;
  raid.builds.splice(i, 1); b.gone = true;
  cellsOf(b, k => { const list = raid.cells.get(k); if (list) { const j = list.indexOf(b); if (j >= 0) list.splice(j, 1); } });
}
function clearBuilds() { for (const b of raid.builds) b.gone = true; raid.builds.length = 0; raid.cells.clear(); raid.use = null; raid.alarm = null; raid.nextRaid = 150; }

// ---------------------------------------------------------------- who may go through a door, and what is solid
const sameSide = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.isPlayer) return !!(b.br && (b.br.crew || yourTeam(b)));
  if (b.isPlayer) return !!(a.br && (a.br.crew || yourTeam(a)));
  return !!(a.br && b.br && ((a.br.crew && b.br.crew) || (a.br.squad && a.br.squad === b.br.squad)));
};
const canPass = (f, b) => !!f && sameSide(f, b.owner);
// the boxes of a piece as [x0, x1, y1] in its own space (all are PIECES[kind].hd deep, either side of z = 0)
function pieceBoxes(b, shut) {
  const P = PIECES[b.kind], hw = P.hw * b.sx;
  if (b.kind !== 'door') return [[-hw, hw, P.h]];
  const gap = DOOR.half * b.sx, list = [[-hw, -gap, P.h], [gap, hw, P.h]];
  if (shut) list.push([-gap, gap, DOOR.h]);
  return list;
}
// push somebody out of any wall he is walking into
function buildPush(f, pad) {
  if (!raid.builds.length || !raidOn()) return;
  const p = f.pos;
  for (const b of buildsNear(p[0], p[2])) {
    if (p[1] > b.y + PIECES[b.kind].h - 0.2 || p[1] < b.y - 1.8) continue;
    const hd = PIECES[b.kind].hd;
    let [lx, lz] = buildLocal(b, p[0], p[2]), moved = false;
    for (const [x0, x1] of pieceBoxes(b, b.kind === 'door' && b.open < 0.55 && !canPass(f.br || f.slots ? f : null, b))) {
      const cx = clamp(lx, x0, x1), cz = clamp(lz, -hd, hd), dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d >= pad) continue;
      if (d > 1e-5) { lx = cx + dx / d * pad; lz = cz + dz / d * pad; }
      else {                                                  // right inside it: out of the nearest face
        const out = [[lx - x0, x0 - pad, null], [x1 - lx, x1 + pad, null], [lz + hd, null, -hd - pad], [hd - lz, null, hd + pad]].sort((m, n) => m[0] - n[0])[0];
        if (out[1] !== null) lx = out[1]; else lz = out[2];
      }
      moved = true;
    }
    if (moved) { const w = buildWorld(b, lx, 0, lz); p[0] = w[0]; p[2] = w[2]; }
  }
}
// distance along a ray to the first piece, and which
function buildRay(o, d, most) {
  let best = most || 95, hit = null;
  if (raidOn()) for (const b of raid.builds) {
    const rx = b.x - o[0], rz = b.z - o[2], flatLen = Math.hypot(d[0], d[2]) || 1e-6, along = (rx * d[0] + rz * d[2]) / flatLen, R = PIECES[b.kind].hw * b.sx + 0.4;
    if (along < -R || along > best * flatLen + R || Math.abs(rx * d[2] - rz * d[0]) / flatLen > R) continue;
    const [ox, oz] = buildLocal(b, o[0], o[2]), oy = o[1] - b.y, dx = d[0] * b.c - d[2] * b.s, dz = d[0] * b.s + d[2] * b.c, hd = PIECES[b.kind].hd * 0.8;
    for (const [x0, x1, y1] of pieceBoxes(b, b.open < 0.55)) {
      let t0 = 0, t1 = best;
      for (const [at, dir, lo, hi] of [[ox, dx, x0, x1], [oy, d[1], -0.3, y1], [oz, dz, -hd, hd]]) {
        if (Math.abs(dir) < 1e-8) { if (at < lo || at > hi) { t1 = -1; break; } continue; }
        const a = (lo - at) / dir, c = (hi - at) / dir;
        t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < best && t0 > 0.02) { best = t0; hit = b; }
    }
  }
  return { t: hit ? best : Infinity, piece: hit };
}
// is this point inside one (for the camera)
function buildBlocks(p) {
  if (!raidOn() || !raid.builds.length) return false;
  for (const b of buildsNear(p[0], p[2])) {
    if (b.kind === 'stash' || b.kind === 'bench' || p[1] > b.y + PIECES[b.kind].h + 0.05 || p[1] < b.y - 0.3) continue;
    const [lx, lz] = buildLocal(b, p[0], p[2]);
    for (const [x0, x1] of pieceBoxes(b, b.open < 0.55)) if (lx > x0 - 0.12 && lx < x1 + 0.12 && Math.abs(lz) < PIECES[b.kind].hd + 0.12) return true;
  }
  return false;
}

// ---------------------------------------------------------------- putting one up
// the points along a piece used to see that nothing is in its way
const samples = (b) => {
  const hw = PIECES[b.kind].hw * b.sx, reach = Math.max(0, hw - 0.42);
  return [-reach, -reach / 2, 0, reach / 2, reach].map(x => buildWorld(b, x, 0, 0));
};
function insidePiece(q, p, grow) {
  const [lx, lz] = buildLocal(q, p[0], p[2]);
  return Math.abs(lx) < PIECES[q.kind].hw * q.sx + grow - 0.3 && Math.abs(lz) < PIECES[q.kind].hd + grow && Math.abs(p[1] - q.y) < 1.4;
}
// why it cannot go here, or null if it can. sets b.y so it stands on the ground
function placeBlock(b, loose) {
  const P = PIECES[b.kind], hw = P.hw * b.sx, level = b.floor === undefined ? undefined : b.floor + 1;
  const ys = [[-hw * 0.9, 0], [0, 0], [hw * 0.9, 0]].map(([x, z]) => { const w = buildWorld(b, x, 0, z); return groundAt(w[0], w[2], level); });
  const lo = Math.min(...ys), hi = Math.max(...ys);
  b.y = (b.kind === 'wall' || b.kind === 'door') ? Math.min(lo + 0.08, ys[1]) : ys[1];
  if (!loose && hi - lo > (b.kind === 'wall' || b.kind === 'door' ? 0.75 : 0.35)) return 'The ground is too steep';
  const cave = caveAt(b.x, b.z, 0), dry = cave && cave.hollow && b.floor !== undefined && b.floor < cave.c.base + 1;     // down in a cave the sea and river do not count
  if (!dry && lo < SEA.level + 0.15) return 'Too wet here';
  if (loose) return null;
  if (!dry && riverDistance(b.x, b.z) < RIVER.wet / 2 + 1.5) return 'Too close to the river';
  if (houseAt(b.x, b.z, 0.6)) return 'Not in a house';
  const pts = samples(b);
  for (const p of pts) {
    for (const q of buildsNear(p[0], p[2])) if (insidePiece(q, p, 0.02)) return 'Something is already there';
    for (const o of solidsNear(p[0], p[2])) if (!o.wall && !o.thin && o.h > 0.6 && p[1] > o.y - 1 && p[1] < o.y + o.h && edgeOf(o, p[0], p[2]).d < 0.05) return 'Something is in the way';
  }
  for (const q of buildsNear(b.x, b.z)) if (samples(q).some(p => insidePiece(b, p, 0.02))) return 'Something is already there';
  for (const c of chests) if (insidePiece(b, c.pos, 0.4)) return 'There is a chest there';
  for (const f of fighters) if (f.dead < 0 && !f.gone && insidePiece(b, f.pos, 0.25)) return 'Somebody is standing there';
  return null;
}
function puffAt(p, n) { for (let i = 0; i < n; i++) puff([p[0] + rand(-0.9, 0.9), p[1] + rand(0, 0.25), p[2] + rand(-0.5, 0.5)], 1, [0.55, 0.45, 0.3, 0.55], 0.8, 0.12, 0.7, 0.6); }
function buildSound(b) { playAt('hammer', [b.x, b.y, b.z], 0.9, 40); }
// where the thing in your hand would go
function buildAim(f) {
  const kind = PIECE_ORDER[raid.kind % PIECE_ORDER.length], reach = kind === 'wall' || kind === 'door' ? 2.0 : 1.5;
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), want = [f.pos[0] + fx * reach, f.pos[2] + fz * reach];
  const wantYaw = f.yaw + raid.turn * Math.PI / 2 + (kind === 'stash' || kind === 'bench' ? Math.PI : 0);
  const b = newPiece(kind, want[0], 0, want[1], wantYaw, f);
  b.floor = f.pos[1];
  // facing along a cave passage, a wall or door stretches to fill it from side to side
  const cave = caveAt(want[0], want[1], 0), across = (kind === 'wall' || kind === 'door') && cave && cave.hollow && f.pos[1] < cave.c.base + 1 && cave.s > 0.8 && caveWide(cave.s) < 2.8 && Math.abs(Math.cos(wantYaw)) > 0.7;
  if (across) { b.x = cave.c.x + caveShift(cave.c, cave.s); b.yaw = 0; b.c = 1; b.s = 0; b.sx = (caveWide(cave.s) * 2 + 0.25) / 2.4; }
  else if (kind === 'wall' || kind === 'door') {                // walls click on to the ends of your other walls
    let best = 1.15;
    for (const q of buildsNear(want[0], want[1])) {
      if ((q.kind !== 'wall' && q.kind !== 'door') || !sameSide(f, q.owner) || Math.abs(q.y - f.pos[1]) > 1.6) continue;
      for (const end of [-1, 1]) {
        const e = buildWorld(q, end * q.sx * 1.2, 0, 0);
        for (let k = 0; k < 4; k++) {
          const yaw = q.yaw + k * Math.PI / 2, turned = Math.abs(wrap(yaw - wantYaw));
          for (const s of [-1, 1]) {
            const x = e[0] + s * Math.cos(yaw) * 1.2, z = e[2] - s * Math.sin(yaw) * 1.2, score = Math.hypot(x - want[0], z - want[1]) + turned * 0.45;
            if (score < best && Math.hypot(x - q.x, z - q.z) > 0.9) { best = score; b.x = x; b.z = z; b.yaw = yaw; b.c = Math.cos(yaw); b.s = Math.sin(yaw); }
          }
        }
      }
    }
  }
  b.why = placeBlock(b) || (f.rocks < PIECES[kind].cost ? 'Not enough shiny rocks' : null);
  return b;
}
function buildStep(f, dt) {
  raid.swing = Math.max(0, raid.swing - dt);
  raid.ghost = buildAim(f);
  if (mouse.pressed && raid.swing <= 0.05) {
    mouse.pressed = false;
    const b = raid.ghost;
    if (b.why) Sound.play('nope', 0.6);
    else {
      f.rocks -= PIECES[b.kind].cost; b.born = game.time;
      addPiece(b); buildSound(b); puffAt([b.x, b.y, b.z], 14);
      raid.swing = 0.4; raid.ghost = null; hudDirty = true;
    }
  }
  // right click: knock down one of your own that you are facing, and get half back
  const right = mouse.aim;
  if (right && !raid.rightWas) {
    const from = V.add(f.pos, [0, 0.5, 0]), hit = buildRay(from, [Math.sin(f.yaw), 0, Math.cos(f.yaw)], 3);
    let q = hit.piece;
    if (!q) q = buildsNear(f.pos[0], f.pos[2]).find(p => (p.kind === 'stash' || p.kind === 'bench') && Math.hypot(p.x - f.pos[0], p.z - f.pos[2]) < 1.8);
    if (q && sameSide(f, q.owner)) {
      if (q.kind === 'stash') spillStash(q);
      removePiece(q); f.rocks = addRocks(f.rocks, Math.floor(PIECES[q.kind].cost / 2));
      playAt('logbreak', [q.x, q.y, q.z], 0.8, 40); debris(q, 0.4); raid.swing = 0.4; hudDirty = true;
    } else Sound.play('nope', 0.6);
  }
  raid.rightWas = right;
}
// the hammer in your fist, and the swing when you put something up
function hammerPose(f) {
  const k = raid.swing > 0 ? 1 - raid.swing / 0.4 : 1;
  const up = flow([[0, 0], [0.35, -0.8], [0.6, 1], [1, 0]], k);
  const p = [-0.25, 1.02 + 0.1 * Math.max(0, -up) - 0.05 * Math.max(0, up), 0.30 + 0.12 * Math.max(0, up)];
  f.carry = foodGoal(p); f.thing = { kind: 'hammer', p, R: M3.mul(M3.rx(0.35 + 1.0 * up), M3.ry(0.15)) };
}

// ---------------------------------------------------------------- taking them down
function debris(b, much) {
  const mid = [b.x, b.y + PIECES[b.kind].h * 0.45, b.z];
  for (let i = 0; i < 40 * much; i++) {
    const a = rand(0, 6.3), sp = rand(1, 7);
    particles.push({ p: buildWorld(b, rand(-1, 1) * PIECES[b.kind].hw * b.sx, rand(0.2, PIECES[b.kind].h), 0), v: [Math.cos(a) * sp, rand(1, 6), Math.sin(a) * sp], life: rand(0.6, 1.5), max: 1.5, size: rand(0.03, 0.09), color: [0.34, 0.2, 0.09, 1], grav: 9.8 });
  }
  puff(mid, 20 * much, [0.5, 0.4, 0.28, 0.6], 2.2, 0.25, 1.1, 0.4);
}
// everything in a stash falls out
function spillStash(b) {
  const at = [b.x, b.y, b.z];
  for (const it of b.items) dropLoot(it, at, 0.7);
  if (b.rocks) dropLoot({ t: 'rocks', n: b.rocks }, at, 0.5);
  b.items = []; b.rocks = 0;
}
// a bomb: walls, doors and tables come down, a stash is cracked open
function raidBlast(c, owner) {
  if (!raidOn()) return;
  for (const b of raid.builds.slice()) {
    const [lx, lz] = buildLocal(b, c[0], c[2]), P = PIECES[b.kind], hw = P.hw * b.sx;
    const d = Math.hypot(lx - clamp(lx, -hw, hw), lz - clamp(lz, -P.hd, P.hd), c[1] - clamp(c[1], b.y, b.y + P.h));
    if (d > 1.7) continue;
    raidAlarm(b, owner);
    if (b.kind === 'stash') { b.broken = true; continue; }
    removePiece(b); debris(b, 1); playAt('logbreak', [b.x, b.y, b.z], 1, 80);
  }
}
// somebody is at it: whoever it belongs to (and his lot) comes for him
function raidAlarm(b, culprit) {
  const owner = b.owner;
  if (owner && culprit && culprit.isPlayer && !owner.isPlayer && yourTeam(owner) && (b.kind !== 'bench')) betray(owner.br.squad);   // your own team's things
  if (!owner || !culprit || sameSide(owner, culprit)) return;
  if (owner.isPlayer) {
    if (!raid.alarm || game.time - raid.alarm.t > 8) Sound.play('horn', 0.8);
    raid.alarm = { t: game.time, x: b.x, z: b.z };
  }
  for (const f of bots) {
    if (f.dead >= 0 || f === culprit || !f.br || !sameSide(owner, f) || Math.hypot(f.pos[0] - b.x, f.pos[2] - b.z) > 70) continue;
    if (!owner.isPlayer) f.br.grudge = culprit;
    f.br.target = culprit; f.br.seen = game.time - 1.5; f.br.lastSeen = [b.x, b.z]; f.br.think = Math.min(f.br.think, 0.2);
  }
}
// doors swing for their own people, and lids and shine move
function buildsStep(dt) {
  if (!raidOn()) return;
  for (const b of raid.builds) {
    if (b.kind === 'door') {
      let want = 0;
      if (Math.abs(player.pos[0] - b.x) < 3 && canPass(player, b) && player.dead < 0 && Math.hypot(player.pos[0] - b.x, player.pos[2] - b.z) < 1.9) want = 1;
      else for (const f of bots) {
        if (Math.abs(f.pos[0] - b.x) > 2 || Math.abs(f.pos[2] - b.z) > 2 || f.dead >= 0 || !canPass(f, b)) continue;
        want = 1; break;
      }
      if (want && b.open < 0.05 && b.openV <= 0) playAt('creak', [b.x, b.y, b.z], 0.6, 24);
      b.openV += ((want - b.open) * 60 - b.openV * 11) * dt; b.open = clamp(b.open + b.openV * dt, 0, 1.05);
    } else if (b.kind === 'stash') {
      const want = b.broken || game.stash === b || (raid.use && raid.use.piece === b && raid.use.t > 1.4) ? 1 : 0;
      b.openV += ((want - b.open) * 90 - b.openV * 12) * dt; b.open += b.openV * dt;
      if (b.open < 0) { b.open = 0; b.openV = 0; }
    }
  }
  if (raid.alarm && game.time - raid.alarm.t > 6) raid.alarm = null;
}

// ---------------------------------------------------------------- drawing them
// from a long way off, a wall is just its logs
const farWall = (() => {
  const make = (xs, door) => {
    const S = Shape();
    for (const x of xs) S.log([x, -0.25, 0], [x, 2.05, 0], door ? 0.15 : 0.155, { sides: 6, point: 0.27 });
    for (const y of [0.52, 1.6]) if (!door) S.slab([0, y, -0.17], [2.4, 0.13, 0.1], 'bark', 0.02);
    if (door) S.slab([0, 2.04, 0], [2.2, 0.2, 0.2], 'bark', 0.02);
    return { mesh: S.done() };
  };
  const leaf = Shape();
  leaf.slab([DOOR.half, DOOR.h / 2, 0], [DOOR.half * 2, DOOR.h - 0.05, 0.08], 'plank', 0.01);
  return { wall: make([-1.05, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1.05]), frame: make([-1.04, -0.76, 0.76, 1.04], true), leaf: { mesh: leaf.done() } };
})();
// one piece (or its ghost). B is the turn and stretch, at the middle of its foot
function drawPiece(prog, textured, b, far) {
  const R = M3.ry(b.yaw), B = b.sx === 1 ? R : M3.mul(R, [b.sx, 0, 0, 0, 1, 0, 0, 0, 1]), p = [b.x, b.y, b.z];
  if (b.kind === 'wall') drawModel(prog, textured, far ? farWall.wall : wallModel, B, p);
  else if (b.kind === 'door') {
    drawModel(prog, textured, far ? farWall.frame : doorFrameModel, B, p);
    const swing = M3.mul(R, M3.ry(Math.min(b.open, 1) * 1.65));
    drawModel(prog, textured, far ? farWall.leaf : doorModel, b.sx === 1 ? swing : M3.mul(swing, [b.sx, 0, 0, 0, 1, 0, 0, 0, 1]), buildWorld(b, -DOOR.half * b.sx, 0, 0));
  } else if (b.kind === 'stash') {
    drawModel(prog, textured, stashModel, B, p);
    drawModel(prog, textured, stashLidModel, M3.mul(R, M3.rx(-1.85 * b.open)), buildWorld(b, 0, 0.5, -0.31));
    if (b.open > 0.4 && b.rocks > 0) drawModel(prog, textured, rockModel, M3.mul(R, [1.9, 0, 0, 0, 1.6, 0, 0, 0, 1.9]), buildWorld(b, 0, 0.2, 0));
  } else drawModel(prog, textured, benchModel, B, p);
}
function drawBuilds(prog, textured) {
  if (!raidOn()) return;
  const lod = world.low ? 14 : 30, range = Math.min(viewRange(), world.low ? 100 : 180), p = player.pos;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  for (const b of raid.builds) {
    const dx = b.x - p[0], dz = b.z - p[2], d = Math.hypot(dx, dz);
    if (d > (textured ? range : 18)) continue;
    if (textured && !testView && d > 14 && (dx * fx + dz * fz) / d < -0.25) continue;      // behind you
    drawPiece(prog, textured, b, d > lod);
  }
  const g = raid.ghost;
  if (textured && g && player.hand === 'hammer' && player.dead < 0) {
    const pulse = 0.85 + 0.15 * Math.sin(game.time * 7);
    flat(prog, (g.why ? [1.0, 0.08, 0.05] : [0.1, 0.9, 0.35]).map(v => v * pulse), 0.9, 0);
    const R = M3.ry(g.yaw), at = [g.x, g.y, g.z], ms = g.kind === 'wall' ? [[farWall.wall]] : g.kind === 'door' ? [[farWall.frame], [farWall.leaf, [-DOOR.half, 0, 0]]] : g.kind === 'stash' ? [[stashModel], [stashLidModel, [0, 0.5, -0.31]]] : [[benchModel]];
    for (const [m, off] of ms) drawMesh(prog, m.mesh, R, off ? V.add(at, M3.vec(R, off)) : at);
  }
}

// ---------------------------------------------------------------- the hammer, the bag and the rocks as things
const RAID_THINGS = { hammer: { m: hammerModel, mid: [0, 0.1, 0], lie: M3.rx(Math.PI / 2), up: 0.07 }, bag: { m: bagModel, mid: [0, 0.18, 0], lie: M3.id(), up: 0 }, rocks: { m: rockModel, mid: [0, 0.08, 0], lie: M3.id(), up: 0 } };
// held, or tumbling: turned about its middle (the hammer by its grip, which is where the fist is)
function drawRaidThing(prog, kind, R, p) {
  const t = RAID_THINGS[kind];
  drawModel(prog, !!prog.u.uHasTex, t.m, R, kind === 'hammer' ? p : V.sub(p, M3.vec(R, t.mid)));
}
function drawRaidLoot(prog, textured, o, R) {
  const t = RAID_THINGS[o.item.t], lie = M3.mul(R, t.lie);
  drawModel(prog, textured, t.m, lie, V.add(o.p, [0, t.up, 0]));
}
// the bag on your back, hung from its strap (both made to fit him as he stands, and carried round by his chest)
function drawBags(prog, textured, hideSelf) {
  for (const f of fighters) {
    if (!f.hasBag || (hideSelf && f.isPlayer) || f.gone || !f.vis || f.away > (textured ? 40 : 14) || !f.wp[IDX.chest]) continue;
    const H = M3.mul(f.R || M3.ry(f.yaw), f.wr[IDX.chest]), from = V.sub(bonePos(f, 'chest'), M3.vec(H, Rig.rest[IDX.chest]));
    drawModel(prog, textured, worn.strap, H, from);
    drawModel(prog, textured, bagBodyModel, M3.mul(H, worn.R), V.add(from, M3.vec(H, worn.at)));
  }
}

// ---------------------------------------------------------------- parts on guns
// where each part goes, in the gun's own space. a part left out cannot be fitted to that gun
const ATT_AT = {
  ak: { sil: true, dot: [0, 0.125, 0.09], scope: [0, 0.125, 0.11], grip: [0, 0.064, 0.35], mag: 1.38 },
  glock: { sil: true, dot: [0, 0.087, 0.025], mag: 1.4 },
  mp5: { sil: true, dot: [0, 0.115, 0.11], scope: [0, 0.115, 0.11], grip: [0, 0.062, 0.34], mag: 1.36 },
  p90: { sil: true, dot: [0, 0.14, 0.07] },
  shotgun: { dot: [0, 0.064, 0.10], scope: [0, 0.064, 0.12], grip: [0, 0.0, 0.42] },
  awp: { sil: true, mag: 1.7 },
  mgl: {}
};
const ATTS = {
  sil: { name: 'Silencer', cost: 80, info: 'Quiet. Only cavemen close by hear it' },
  dot: { name: 'Red dot', cost: 40, info: 'Tighter when you aim' },
  scope: { name: 'Scope', cost: 100, info: 'Zooms in when you aim' },
  grip: { name: 'Grip', cost: 50, info: 'Much less kick' },
  mag: { name: 'Big magazine', cost: 60, info: 'Half as many bullets again' }
};
const canFit = (id, rarity, part) => !!ATT_AT[id][part] && !(part === 'sil' && rarity === EXOTIC);
const attOf = (f, id) => (f.ammo[id] && f.ammo[id].att) || null;
const magSize = (f, id) => { const a = attOf(f, id); return a && a.mag ? Math.ceil(GUNS[id].mag * 1.5) : GUNS[id].mag; };
const silenced = f => { const a = f.weapon && attOf(f, f.weapon); return !!(a && a.sil); };
const hasScope = f => { if (!f.weapon) return false; const a = attOf(f, f.weapon); return !!(GUNS[f.weapon].scoped || (a && a.scope)); };
function randomAtt(id, rarity, chance) {
  const a = {};
  for (const part in ATTS) if (canFit(id, rarity, part) && Math.random() < chance && !(part === 'scope' && a.dot)) a[part] = true;
  return Object.keys(a).length ? a : undefined;
}
const mountMat = { dot: dotModel, scope: scopeModel, grip: gripModel };
// where the gun's magazine goes in, so a long one can be drawn from there down
const MAG_TOP = { ak: 0.058, glock: 0.064, mp5: 0.059, awp: 0.058 };
// the turn and place to draw the magazine with: the gun's own, or stretched
function magFrame(g, R, p, att) {
  const k = att && att.mag && ATT_AT[g.id] && ATT_AT[g.id].mag;
  return k ? [M3.mul(R, [1, 0, 0, 0, k, 0, 0, 0, 1]), V.add(p, M3.vec(R, [0, MAG_TOP[g.id] * (1 - k), 0]))] : [R, p];
}
function drawAttachments(prog, textured, g, R, p, att) {
  if (!att) return;
  const at = ATT_AT[g.id];
  if (!at) return;
  for (const part in att) {
    if (!at[part] || part === 'mag') continue;
    if (part === 'sil') drawModel(prog, textured, silencerModel, R, V.add(p, M3.vec(R, g.muzzle)));
    else drawModel(prog, textured, mountMat[part], R, V.add(p, M3.vec(R, at[part])));
  }
}
const attWords = att => att ? Object.keys(att).map(k => ATTS[k].name.toLowerCase()).join(', ') : '';

// ---------------------------------------------------------------- pockets: the bag, and moving things to a stash
function putOnBag(f) {
  if (f.hasBag) return false;
  f.hasBag = true;
  if (f.slots) while (f.slots.length < BAG_SLOTS) f.slots.push(null);
  hudDirty = true;
  return true;
}
// one thing into a stash: like piles on like
function stashPut(b, it) {
  if (it.t === 'rocks') { const n = Math.min(it.n, ROCK_MAX - b.rocks); b.rocks += n; return n === it.n; }
  if (FOOD[it.t] || it.t === 'plate') { const q = b.items.find(i => i.t === it.t && (i.n || 1) + (it.n || 1) <= STACK); if (q) { q.n = (q.n || 1) + (it.n || 1); return true; } }
  if (b.items.length >= STASH_SLOTS) return false;
  b.items.push(it);
  return true;
}
function stashDeposit(k) {
  const b = game.stash, f = player;
  if (!b || !f.slots[k]) return;
  if (b.items.length >= STASH_SLOTS) { Sound.play('nope', 0.6); return; }
  const held = heldSlot(f) === k, it = emptySlot(f, k);
  if (held) { f.gun = null; f.carry = null; f.thing = null; f.headTilt = null; }
  stashPut(b, it); Sound.play('grab', 0.7); hudDirty = true;
}
function stashTake(i) {
  const b = game.stash, f = player;
  if (!b || !b.items[i]) return;
  const it = b.items[i];
  if (!fits(f, it)) { Sound.play('nope', 0.6); return; }
  b.items.splice(i, 1);
  takeItem(f, it, false); Sound.play('grab', 0.7); hudDirty = true;
  if (b.owner && !sameSide(f, b.owner)) raidAlarm(b, f);
}
function stashRocks(take) {
  const b = game.stash, f = player;
  if (!b) return;
  const n = take ? Math.min(b.rocks, ROCK_MAX - f.rocks) : Math.min(f.rocks, ROCK_MAX - b.rocks);
  if (!n) return;
  if (take) { b.rocks -= n; f.rocks += n; if (b.owner && !sameSide(f, b.owner)) raidAlarm(b, f); } else { f.rocks -= n; b.rocks += n; }
  Sound.play('rocks', 0.8); hudDirty = true;
}

// ---------------------------------------------------------------- the work table
const GOODS = [
  { id: 'c4', name: 'C4', cost: 90, info: 'Blows a hole in somebody\'s wall', give: f => fits(f, { t: 'c4' }) && takeItem(f, { t: 'c4' }, false) },
  { id: 'plate', name: 'Vest plate', cost: 25, info: 'Puts your vest back together', give: f => fits(f, { t: 'plate' }) && takeItem(f, { t: 'plate' }, false) },
  { id: 'vest', name: 'Bulletproof vest', cost: 70, info: 'Takes most of every hit', give: f => !(f.vest >= VEST) && takeItem(f, { t: 'vest' }, false) },
  { id: 'hammer', name: 'Hammer', cost: 20, info: 'For building', give: f => fits(f, { t: 'hammer' }) && takeItem(f, { t: 'hammer' }, false) },
  { id: 'bag', name: 'Duffel bag', cost: 150, info: 'Carry seven things in place of four', give: f => putOnBag(f) }
];
function benchBuy(what) {
  const f = player;
  if (ATTS[what]) {
    const id = f.weapon || bestGun(f);
    if (!id) { Sound.play('nope', 0.6); return; }
    const am = f.ammo[id], att = am.att || {};
    if (att[what] || !canFit(id, am.rarity, what) || f.rocks < ATTS[what].cost) { Sound.play('nope', 0.6); return; }
    f.rocks -= ATTS[what].cost;
    if (what === 'dot') delete att.scope;
    if (what === 'scope') delete att.dot;
    att[what] = true; am.att = att;
    if (what === 'mag') am.clip = Math.min(magSize(f, id), am.clip + am.spare);
    Sound.play('rack', 0.8); Sound.play('hammer', 0.5);
  } else {
    const g = GOODS.find(q => q.id === what);
    if (f.rocks < g.cost || !g.give(f)) { Sound.play('nope', 0.6); return; }
    f.rocks -= g.cost; Sound.play('hammer', 0.7); Sound.play('grab', 0.7);
  }
  hudDirty = true;
}

// ---------------------------------------------------------------- the E key by a stash, a table or a friend
const PRY = 2.2;
function raidTarget() {
  const f = player;
  if (!raidOn() || f.dead >= 0 || f.ride || looting) return null;
  const p = f.pos;
  let best = null, bestD = 1.35;
  for (const b of raid.builds) {
    if (b.kind !== 'stash' && b.kind !== 'bench') continue;
    if (Math.abs(b.x - p[0]) > 2.5 || Math.abs(b.z - p[2]) > 2.5 || Math.abs(b.y - p[1]) > 1.4) continue;
    const [lx, lz] = buildLocal(b, p[0], p[2]), P = PIECES[b.kind];
    const d = Math.hypot(lx - clamp(lx, -P.hw, P.hw), lz - clamp(lz, -P.hd, P.hd));
    if (d >= bestD) continue;
    const from = V.add(p, [0, 1.2, 0]), way = V.sub([b.x, b.y + 0.4, b.z], from), len = V.len(way), hit = buildRay(from, V.mul(way, 1 / len), len);
    if (hit.piece && hit.piece !== b && (hit.piece.kind === 'wall' || hit.piece.kind === 'door')) continue;       // not through a wall
    bestD = d; best = { kind: b.kind, piece: b };
  }
  if (best) return best;                                       // a stash or a table comes first
  let near = 3.2;
  for (const q of bots) {
    if (q.dead >= 0 || q.gone || !q.br || !(q.br.friendly || q.br.crew || yourTeam(q)) || q.br.state === 'fight' || Math.abs(q.pos[1] - p[1]) > 1.2) continue;
    const d = Math.hypot(q.pos[0] - p[0], q.pos[2] - p[2]);
    if (d < near) { near = d; best = { kind: 'friend', bot: q }; }
  }
  return best;
}
const crewSize = () => bots.filter(b => b.br && b.br.crew).length;
const CREW_MAX = 3;
// true while it has the E key to itself
function raidKey(dt, holding, pressed) {
  if (!raidOn()) return false;
  const t = raidTarget();
  if (!t || !holding) { raid.use = null; return false; }
  if (t.kind === 'friend') {
    if (!pressed) return false;
    const br = t.bot.br, was = br.crew, joined = !match.myTeam;
    if (askTeam(t.bot)) {
      Sound.play(was ? 'huh' : 'oogaq', 0.9);
      raid.say = was ? null : { until: game.time + 3, words: joined ? 'He says yes. You are on his team now' : 'He comes with you' };
    } else {
      Sound.play('nope', 0.6);
      raid.say = { until: game.time + 3, words: match.myTeam && br.squad !== match.myTeam ? 'He says no: you are on another team' : 'Three are already with you' };
    }
    hudDirty = true;
    return true;
  }
  const b = t.piece, mine = !b.owner || b.owner.isPlayer || b.broken;
  if (t.kind === 'bench') { if (pressed) { openInventory({ bench: b }); return true; } return false; }
  if (mine) { if (pressed) { openInventory({ stash: b }); Sound.play('creak', 0.7); return true; } return false; }
  // somebody else's: it takes a while to force
  if (!raid.use || raid.use.piece !== b) { if (!pressed) return false; raid.use = { piece: b, t: 0, at: player.pos.slice() }; Sound.play('creak', 0.8); }
  const u = raid.use, before = u.t;
  u.t += dt; player.crouch = true;
  if (Math.floor(before / 0.55) !== Math.floor(u.t / 0.55)) { Sound.play('knock', 0.6); raidAlarm(b, player); }
  if (Math.hypot(player.pos[0] - u.at[0], player.pos[2] - u.at[2]) > 1) { raid.use = null; return false; }
  if (u.t >= PRY) { b.broken = true; raid.use = null; player.crouch = false; Sound.play('chestopen', 0.9); openInventory({ stash: b }); }
  return true;
}
// the words at the bottom of the screen; false if there is nothing of ours to say
function raidPrompt() {
  const t = raidTarget();
  const said = raid.say && game.time < raid.say.until;
  if ((!t && !said) || game.stash || game.bench) return false;
  let words, p = 100;
  if (said) words = raid.say.words;
  else if (t.kind === 'friend') {
    const br = t.bot.br;
    words = br.crew ? (br.guard ? 'Press E: follow me' : 'Press E: stay and guard here') : !match.myTeam ? 'Press E to ask to team up' : br.squad !== match.myTeam ? 'Press E to ask to team up' : crewSize() < CREW_MAX ? 'Press E: come with me' : 'Three are already with you';
  } else if (t.kind === 'bench') words = 'Press E to use the work table';
  else if (!t.piece.owner || t.piece.owner.isPlayer || t.piece.broken) words = 'Press E to open the stash';
  else { words = raid.use ? 'Keep holding… prying it open' : yourTeam(t.piece.owner) ? 'Hold E to steal from your own team' : 'Hold E to break into the stash'; p = raid.use ? raid.use.t / PRY * 100 : 0; }
  ui.prompt.style.display = 'flex'; ui.prompt.classList.toggle('holding', !!raid.use);
  ui.prompttext.textContent = words; ui.prompttext.style.color = ''; ui.ring.style.display = ''; ui.ring.style.setProperty('--p', p + '%');
  return true;
}

// ---------------------------------------------------------------- dying: what you had on you stays where you fell
function dropEverything(f) {
  if (!raidOn()) return;
  const at = f.pos;
  if (f.slots) for (let k = 0; k < f.slots.length; k++) { const it = emptySlot(f, k); if (it) dropLoot(it, at, 0.9); }
  if (f.rocks) dropLoot({ t: 'rocks', n: f.rocks }, at, 0.6);
  if (f.hasBag) dropLoot({ t: 'bag' }, at, 0.6);
  if (f.vest > 0) dropLoot({ t: 'vest' }, at, 0.8);
  f.rocks = 0; f.hasBag = false; f.vest = 0; f.hasVest = false;
}

// ---------------------------------------------------------------- the build bar
function buildBar() {
  const on = raidOn() && player.hand === 'hammer' && player.dead < 0 && !game.inv && !looting;
  if (!on) raid.ghost = null;
  const words = on && raid.ghost ? PIECE_ORDER.map((k, i) => `<b class="${i === raid.kind % PIECE_ORDER.length ? 'on' : ''}">${PIECES[k].name} <i>${PIECES[k].cost}</i></b>`).join('')
    + `<span>${raid.ghost.why || 'Click: build'} · R: next · Q: turn · Right click: knock down</span>` : '';
  if (ui.buildbar.dataset.words !== words) { ui.buildbar.dataset.words = words; ui.buildbar.innerHTML = words; ui.buildbar.hidden = !words; }
}
