// ======================================================================= battle royale (the island)
// A hundred cavemen, you and ninety-nine others, last one standing. Some hide in caves in little tribes and look
// out for each other; the rest wander alone or in pairs. They search chests, pick things up, eat, put plates in
// their vests, ride bikes, and fight whoever they run into.
//
// The ones near you are played out in full. The ones far away move and fight in a cheaper way, so a hundred of them
// still runs.
const BR = { others: 99, near: 65, far: 80, sight: 48, bodies: 10, bodyTime: 40, bikes: 30 };
let match = null;
const royaleOn = () => world.map === 'island';
const TINTS = [[0.78, 0.95, 0.72], [1.0, 0.72, 0.66], [0.72, 0.82, 1.05], [1.12, 0.97, 0.55], [0.95, 0.72, 1.08], [0.66, 1.02, 1.02], [1.15, 1.02, 0.86], [0.68, 0.68, 0.72], [1.12, 0.80, 0.54], [0.86, 1.10, 0.56]];

function setRoster(n) {
  while (bots.length > n) { const b = bots.pop(); endSend(b); if (b.onBike) { b.onBike.rider = null; b.onBike = null; } b.br = null; }
  while (bots.length < n) bots.push(makeFighter(false, TINTS[bots.length % TINTS.length].map(t => t * rand(0.9, 1.06))));
  fighters.length = 0; fighters.push(player, ...bots);
}
function resetBot(b) {
  endSend(b);
  Object.assign(b, { hp: 100, dead: -1, hurt: 0, vest: 0, hasVest: false, air: 0, jump: -1, gone: false, rag: null, looted: false, beingLooted: false, script: null, scriptW: 0,
    cycle: -1, reload: -1, cool: 0, punch: -1, equip: 1, inv: [], ammo: {}, weapon: null, crouch: false, use: null, carry: null, thing: null, headTilt: null, onBike: null, speed: 0,
    lastHit: null, hitByYou: -99, shotAt: -99, food: { fish: 0, meat: 0 }, plates: 0, legYaw: 0, tilt: 0, drop: 0, posedT: -1 });
  for (const n of CLIP_NAMES) b.weights[n] = n === 'Idle' ? 1 : 0;
}
function brain(extra) {
  const skill = rand(0.25, 1);
  return Object.assign({ squad: 0, cave: null, state: 'idle', skill, think: rand(0, 0.6), goal: null, path: null, wp: 0, wants: false, target: null, seen: -99, lastSeen: null, react: 0, burst: 0, wait: 0,
    strafe: 0, strafeT: 0, chest: null, loot: null, bike: null, dest: null, busy: 0, stuckT: 0, stuck: 0, side: 0, sideT: 0, from: [0, 0], leaveAt: rand(120, 320), rest: 0, bikeAt: rand(0, 60), acc: 0, heard: null, far: true }, extra || {});
}
function putBot(b, x, z, y, extra) {
  resetBot(b);
  b.br = brain(extra);
  b.runCap = 3.1 + b.br.skill * 0.6;
  b.pos = [x, y === undefined ? walkHeight(x, z) : y, z];
  b.yaw = rand(-Math.PI, Math.PI);
  b.target = V.add(b.pos, [Math.sin(b.yaw) * 6, 1.1, Math.cos(b.yaw) * 6]);
}
// somewhere sensible to turn up: dry, in the open, away from `avoid` and from the others
function landSpot(avoid, taken) {
  const cells = reachMap().cells;
  let x = 0, z = 0;
  for (let k = 0; k < 300; k++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    x = c[0]; z = c[1];
    if (Math.hypot(x - avoid[0], z - avoid[2]) < 80 || pastCoast(x, z) > -8 || riverDistance(x, z) < RIVER.bank + 2 || caveAt(x, z, 2) || nearHouse(x, z, 7)) continue;
    if (k < 200 && taken && taken.some(q => Math.abs(q[0] - x) < 22 && Math.abs(q[1] - z) < 22)) continue;
    break;
  }
  return [x, z];
}
function newMatch() {
  setRoster(BR.others);
  floorLoot.length = 0;
  match = { t: 0, over: null, shown: false, bodies: [], paths: [], bird: 3, gunAt: 0, victoryT: 0 };
  game.kills = 0; game.chestLearned = false;
  ui.results.hidden = true;
  let i = 0;
  // tribes hiding at the back of the caves
  const caves = CAVES.slice().sort(() => Math.random() - 0.5).slice(0, 8);
  caves.forEach((c, k) => {
    const size = 3 + (Math.random() < 0.5 ? 1 : 0);
    for (let m = 0; m < size && i < bots.length; m++) {
      const s = CAVE.length + CAVE.room - 1.4 + rand(-1.6, 1.6), x = c.x + caveShift(c, s) + (m - (size - 1) / 2) * 1.2 + rand(-0.3, 0.3);
      const b = bots[i++];
      putBot(b, x, c.z - s, caveFloorAt(s, c), { squad: k + 1, cave: c, state: 'camp' });
      b.yaw = rand(-0.9, 0.9);                                // mostly watching the way in
      if (Math.random() < 0.75) botTake(b, gunItem(Math.random() < 0.55 ? 'glock' : Math.random() < 0.5 ? 'mp5' : 'ak', Math.random() < 0.25 ? 1 : 0), true);
      if (Math.random() < 0.35) botTake(b, { t: 'vest' }, true);
      if (Math.random() < 0.5) botTake(b, { t: 'meat' }, true);
    }
  });
  // everyone else
  const taken = [];
  let buddy = null, squad = 100;
  while (i < bots.length) {
    const b = bots[i++];
    if (buddy) { putBot(b, buddy.pos[0] + rand(-1.5, 1.5), buddy.pos[2] + rand(-1.5, 1.5), undefined, { squad, state: 'roam' }); b.br.buddy = buddy; buddy = null; }
    else {
      const spot = landSpot(START, taken); taken.push(spot);
      const pair = Math.random() < 0.18 && i < bots.length;
      putBot(b, spot[0], spot[1], undefined, { squad: pair ? ++squad : 0, state: 'roam' });
      if (pair) buddy = b;
    }
    if (Math.random() < 0.3) botTake(b, gunItem(Math.random() < 0.7 ? 'glock' : 'mp5', Math.random() < 0.2 ? 1 : 0), true);
  }
  addBikes();
  hudDirty = true;
}
// more bikes about the place, so there are some to ride
function addBikes() {
  const cells = reachMap().cells;
  for (let k = 0, added = 0; k < 4000 && added < BR.bikes; k++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    if (pastCoast(c[0], c[1]) > -8 || riverDistance(c[0], c[1]) < RIVER.bank + 3 || caveAt(c[0], c[1], 3) || nearHouse(c[0], c[1], 9) || Math.hypot(c[0], c[1]) < 25) continue;
    if (solidsNear(c[0], c[1]).some(o => edgeOf(o, c[0], c[1]).d < 1.0) || bikes.some(b => Math.hypot(b.p[0] - c[0], b.p[2] - c[1]) < 40)) continue;
    const b = newBike(c[0], c[1], rand(-3.1, 3.1));
    if (Math.random() < 0.5) b.rest = b.lean = Math.random() < 0.5 ? 1.2 : -1.2;
    bikes.push(b); added++;
  }
}
// you have just waded ashore: nobody is allowed to be waiting on the beach
function matchBegin() {
  if (!match) return;
  const taken = [];
  for (const b of bots) {
    if (Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]) > 75 || b.br.cave) continue;
    const spot = landSpot(player.pos, taken); taken.push(spot);
    b.pos = [spot[0], walkHeight(spot[0], spot[1]), spot[1]]; b.br.buddy = null; b.br.goal = b.br.path = null;
  }
  match.t = 0;
}
const playersLeft = () => (player.dead < 0 ? 1 : 0) + bots.reduce((n, b) => n + (b.dead < 0 ? 1 : 0), 0);

// ---------------------------------------------------------------- their pockets: two guns, food, plates
function botTake(b, it, quiet) {
  if (it.t === 'vest') { b.vest = VEST; b.hasVest = true; return; }
  if (it.t === 'plate') { b.plates = Math.min(STACK, b.plates + (it.n || 1)); return; }
  if (it.t === 'c4') return;
  if (FOOD[it.t]) { b.food[it.t] = Math.min(STACK, b.food[it.t] + (it.n || 1)); return; }
  if (it.t === 'ammo') { for (const id of b.inv) b.ammo[id].spare += GUNS[id].mag * 2; return; }
  const id = it.id;
  if (!b.inv.includes(id) && b.inv.length >= 2) {
    const worst = b.inv.slice().sort((p, q) => rarityOf(b, p) - rarityOf(b, q))[0];
    if (rarityOf(b, worst) >= it.rarity) { if (!quiet) dropLoot(it, b.pos, 0.5); return; }
    const am = b.ammo[worst];
    if (!quiet) dropLoot(gunItem(worst, am.rarity, am.clip, am.spare), b.pos, 0.5);
    b.inv.splice(b.inv.indexOf(worst), 1); delete b.ammo[worst]; if (b.weapon === worst) b.weapon = null;
  }
  give(b, id, Math.max(it.spare, GUNS[id].mag * 3), it.rarity);
  if (quiet || !b.weapon || rarityOf(b, b.weapon) <= it.rarity) { equip(b, id); if (quiet) b.equip = 1; }
}
// everything he had falls out round him
function spillPockets(v) {
  for (const id of v.inv) { const am = v.ammo[id]; if (am) dropLoot(gunItem(id, am.rarity, am.clip, Math.min(am.spare, GUNS[id].reserve)), v.pos, 0.9); }
  v.inv = []; v.weapon = null; v.gun = null;
  if (v.food) for (const k of ['fish', 'meat']) { if (v.food[k]) dropLoot({ t: k, n: v.food[k] }, v.pos, 0.9); v.food[k] = 0; }
  if (v.plates) { dropLoot({ t: 'plate', n: v.plates }, v.pos, 0.9); v.plates = 0; }
  if (v.hasVest && v.vest > 0) { dropLoot({ t: 'vest' }, v.pos, 0.9); v.vest = 0; v.hasVest = false; }
}

// ---------------------------------------------------------------- finding the way
const NAV = { g: null, from: null, stamp: null, run: 0, heights: null };
const navN = () => Math.floor(GRID.half * 2 / WALK.cell);
const navAt = i => (i + 0.5) * WALK.cell - GRID.half;
const navCell = v => clamp(Math.floor((v + GRID.half) / WALK.cell), 0, navN() - 1);
// can he walk straight there?
function clearWalk(ax, az, bx, bz) {
  const R = reachMap(), d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 1.6);
  if (d > 90) return false;
  let y = walkHeight(ax, az);
  for (let k = 1; k <= n; k++) {
    const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
    if (!R.has(x, z)) return false;
    const h = walkHeight(x, z);
    if (Math.abs(h - y) > STEEP * d / n + 0.05) return false;
    y = h;
  }
  return true;
}
// A* over the same 2.5 m squares the chests are scattered on. gives up part way rather than take too long
function findPath(ax, az, bx, bz) {
  if (clearWalk(ax, az, bx, bz)) return [[bx, bz]];
  const R = reachMap(), n = navN(), size = n * n;
  if (!NAV.g) { NAV.g = new Float32Array(size); NAV.from = new Int32Array(size); NAV.stamp = new Int32Array(size); }
  const run = ++NAV.run, open = [], start = navCell(az) * n + navCell(ax), gi = navCell(bx), gj = navCell(bz);
  const guess = k => { const i = k % n, j = (k - i) / n, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
  const push = (k, f) => { let c = open.length; open.push([f, k]); while (c > 0) { const p = (c - 1) >> 1; if (open[p][0] <= f) break; open[c] = open[p]; c = p; } open[c] = [f, k]; };
  const pop = () => {
    const top = open[0], last = open.pop();
    if (open.length) {
      let c = 0;
      for (;;) { let m = 2 * c + 1; if (m >= open.length) break; if (m + 1 < open.length && open[m + 1][0] < open[m][0]) m++; if (open[m][0] >= last[0]) break; open[c] = open[m]; c = m; }
      open[c] = last;
    }
    return top[1];
  };
  NAV.g[start] = 0; NAV.from[start] = -1; NAV.stamp[start] = run;
  push(start, guess(start));
  let best = start, bestH = guess(start);
  const ok = (i, j) => i >= 0 && j >= 0 && i < n && j < n && R.has(navAt(i), navAt(j));
  for (let it = 0; it < 6000 && open.length; it++) {
    const k = pop(), i = k % n, j = (k - i) / n, h = guess(k);
    if (h < bestH) { bestH = h; best = k; }
    if (i === gi && j === gj) break;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (!ok(a, b) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
      const next = b * n + a, g = NAV.g[k] + (di && dj ? 1.414 : 1);
      if (NAV.stamp[next] === run && NAV.g[next] <= g) continue;
      NAV.stamp[next] = run; NAV.g[next] = g; NAV.from[next] = k;
      push(next, g + guess(next) * 1.15);
    }
  }
  const cells = [];
  for (let k = best; k !== -1 && cells.length < 600; k = NAV.from[k]) cells.push([navAt(k % n), navAt((k - k % n) / n)]);
  cells.reverse();
  if (bestH < 1) cells.push([bx, bz]);
  // cut the corners it can
  const out = [];
  let at = [ax, az], k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = Math.min(cells.length - 1, k + 14); m > k; m -= 2) if (clearWalk(at[0], at[1], cells[m][0], cells[m][1])) { far = m; break; }
    out.push(cells[far]); at = cells[far]; k = far + 1;
  }
  return out;
}
// head for somewhere. the path is worked out a little later, a couple of them a frame
function goTo(b, x, z) {
  const br = b.br;
  br.goal = [x, z]; br.path = null; br.stuck = 0; br.stuckT = 0; br.from = [b.pos[0], b.pos[2]];
  if (!br.wants) { br.wants = true; match.paths.push(b); }
}
function pathsStep() {
  for (let k = 0; k < 2 && match.paths.length; k++) {
    const b = match.paths.shift(), br = b.br;
    if (!br) continue;
    br.wants = false;
    if (b.dead >= 0 || !br.goal) continue;
    let ax = b.pos[0], az = b.pos[2];
    const lead = [], c = caveAt(ax, az, 0);
    if (c && c.hollow && c.s > 0.5) {                          // first out of the cave, along the middle of the passage
      for (let s = Math.min(c.s - 2, CAVE.length - 1); s > 0; s -= 3.5) lead.push([c.c.x + caveShift(c.c, s), c.c.z - s]);
      lead.push([c.c.x, c.c.z + 3.5]);
      ax = c.c.x; az = c.c.z + 3.5;
      const g = caveAt(br.goal[0], br.goal[1], 0);
      if (g && g.hollow && g.c === c.c) { br.path = [br.goal.slice()]; br.wp = 0; continue; }
    }
    br.path = lead.concat(findPath(ax, az, br.goal[0], br.goal[1])); br.wp = 0;
  }
}
const goalDist = b => b.br.goal ? Math.hypot(b.br.goal[0] - b.pos[0], b.br.goal[1] - b.pos[2]) : Infinity;
// the next point on the way, or null if there is nowhere to go
function waypoint(b, close) {
  const br = b.br;
  if (!br.path) return null;
  while (br.wp < br.path.length) {
    const p = br.path[br.wp];
    if (Math.hypot(p[0] - b.pos[0], p[1] - b.pos[2]) > (br.wp === br.path.length - 1 ? close || 0.6 : 1.3)) return p;
    br.wp++;
  }
  br.path = null; br.goal = null;
  return null;
}

// ---------------------------------------------------------------- who he can see
const allies = (a, b) => !!(a.br && b.br && a.br.squad && a.br.squad === b.br.squad) && !match.noTruce;
function canSee(a, b, d) {
  const from = V.add(a.pos, [0, a.crouch ? 1.1 : 1.55, 0]), to = V.add(b.pos, [0, b.crouch ? 0.9 : 1.25, 0]);
  const way = V.sub(to, from), len = V.len(way) || 1, dir = V.mul(way, 1 / len);
  if (world.map !== 'island') return true;
  const s = surfaceHit(from, dir);
  return !(s && s.t < len - 0.5);
}
const armed = f => f.inv.some(id => f.ammo[id] && (f.ammo[id].clip > 0 || f.ammo[id].spare > 0));
function spotEnemy(b) {
  const br = b.br, hurt = game.time - br.seen < 2, camping = br.state === 'camp';
  // shorter sighted for the first half minute: everyone is busy looting
  const sight = camping ? 22 : match.t < 30 ? 24 : BR.sight, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  let best = null, bestScore = Infinity;
  const look = f => {
    if (f === b || f.dead >= 0 || f.gone || allies(b, f)) return;
    if (f.isPlayer && (!game.enemiesShoot || FLY.on)) return;
    const dx = f.pos[0] - b.pos[0], dz = f.pos[2] - b.pos[2];
    const reachOut = sight + (game.time - (f.shotAt || -99) < 1.5 ? 18 : 0) - (f.crouch ? 10 : 0);
    if (Math.abs(dx) > reachOut || Math.abs(dz) > reachOut) return;
    const d = Math.hypot(dx, dz);
    if (d > reachOut || Math.abs(f.pos[1] - b.pos[1]) > 14) return;
    if (br.target !== f && !hurt && d > 9 && (dx * fx + dz * fz) / d < -0.1) return;    // behind his back
    const score = d - (br.target === f ? 8 : 0);
    if (score >= bestScore) return;
    if (!br.far && !canSee(b, f, d)) return;
    best = f; bestScore = score;
  };
  look(player);
  for (const f of bots) look(f);
  return best;
}
// somebody to go looking for
function huntSpot(b) {
  let best = null, bestD = 400;
  for (const f of fighters) {
    if (f === b || f.dead >= 0 || f.gone || allies(b, f) || (f.isPlayer && (!game.enemiesShoot || playersLeft() > 7))) continue;
    const d = Math.hypot(f.pos[0] - b.pos[0], f.pos[2] - b.pos[2]) * rand(0.8, 1.4);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best ? [best.pos[0] + rand(-8, 8), best.pos[2] + rand(-8, 8)] : null;
}
function somewhere(b, lo, hi) {
  const R = reachMap();
  for (let k = 0; k < 25; k++) {
    const a = rand(0, 6.28), d = rand(lo, hi), x = b.pos[0] + Math.sin(a) * d, z = b.pos[2] + Math.cos(a) * d;
    if (R.has(x, z) && pastCoast(x, z) < -6 && riverDistance(x, z) > RIVER.bank + 1 && !caveAt(x, z, 1)) return [x, z];
  }
  return [b.pos[0] * 0.9, b.pos[2] * 0.9];                     // back towards the middle
}
function nearChest(b, most) {
  let best = null, bestD = most;
  for (const c of chests) {
    if (c.t >= 0 || (c.claimed && c.claimed !== b) || c === b.br.skip) continue;
    const dx = c.pos[0] - b.pos[0], dz = c.pos[2] - b.pos[2];
    if (Math.abs(dx) > bestD || Math.abs(dz) > bestD || Math.abs(c.pos[1] - b.pos[1]) > 12) continue;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
const wantsLoot = (b, it) => it.t === 'gun' ? !b.inv.includes(it.id) && (b.inv.length < 2 || b.inv.some(id => rarityOf(b, id) < it.rarity)) : it.t === 'vest' ? !(b.vest > 50) : it.t === 'plate' ? b.plates < 2 : FOOD[it.t] ? b.food[it.t] < 2 : it.t === 'ammo' && b.inv.length > 0;

// ---------------------------------------------------------------- making up his mind (a couple of times a second)
function leaveLoot(b) {
  const br = b.br;
  if (br.chest && br.chest.claimed === b) { br.chest.claimed = null; br.chest.forced = false; }
  br.chest = null; br.loot = null; br.busy = 0;
  if (!b.onBike) { b.script = null; b.scriptW = 0; }
}
function setState(b, state) {
  const br = b.br;
  if (br.state === state) return;
  if (br.state === 'loot') leaveLoot(b);
  if (br.state === 'bike') dismount(b, false);
  br.state = state; br.goal = br.path = null; b.crouch = false;
}
function think(b) {
  const br = b.br;
  if (b.use) return;
  const enemy = spotEnemy(b);
  if (enemy) {
    const d = Math.hypot(enemy.pos[0] - b.pos[0], enemy.pos[2] - b.pos[2]);
    if (br.target !== enemy || game.time - br.seen > 3) br.react = 0.35 + (1 - br.skill) * 0.85;
    br.target = enemy; br.seen = game.time; br.lastSeen = [enemy.pos[0], enemy.pos[2]];
    const food = b.food.fish + b.food.meat;
    if (armed(b)) setState(b, b.hp < 32 && food && d > 14 ? 'flee' : 'fight');
    else if (d < 7 && !enemy.weapon) setState(b, 'brawl');
    else if (d < 30) setState(b, 'flee');
    if (br.state === 'fight' || br.state === 'brawl' || br.state === 'flee') {
      // shout to the tribe
      if (br.squad) for (const f of bots) if (f !== b && f.br && f.br.squad === br.squad && f.dead < 0 && !f.br.target && Math.hypot(f.pos[0] - b.pos[0], f.pos[2] - b.pos[2]) < 25) { f.br.target = enemy; f.br.seen = game.time - 1; f.br.lastSeen = br.lastSeen.slice(); }
      return;
    }
  }
  if (br.state === 'fight' || br.state === 'brawl' || br.state === 'flee') {
    if (br.target && br.target.dead < 0 && game.time - br.seen < 6 && br.state !== 'flee') {       // lost sight of him: go and look
      if (br.lastSeen && !br.goal) goTo(b, br.lastSeen[0], br.lastSeen[1]);
      return;
    }
    br.target = null; setState(b, br.cave && match.t < br.leaveAt ? 'camp' : 'roam');
  }
  // time to look after himself
  if (b.hp < 70 && (b.food.fish || b.food.meat) && !b.onBike) { leaveLoot(b); const t = b.food.meat && b.hp < 50 ? 'meat' : b.food.fish ? 'fish' : 'meat'; b.food[t]--; b.use = { t, time: 0 }; br.goal = br.path = null; return; }
  if (b.hasVest && b.vest < 55 && b.plates && !b.onBike) { leaveLoot(b); b.plates--; b.use = { t: 'plate', time: 0 }; br.goal = br.path = null; return; }
  if (br.state === 'loot' || br.state === 'bike') return;
  const poor = !armed(b);
  // something on the floor worth bending down for
  for (const o of floorLoot) {
    if (Math.abs(o.p[0] - b.pos[0]) > 12 || Math.abs(o.p[2] - b.pos[2]) > 12 || Math.abs(o.p[1] - b.pos[1]) > 2.5 || !wantsLoot(b, o.item)) continue;
    setState(b, 'loot'); br.loot = o; goTo(b, o.p[0], o.p[2]); return;
  }
  const camping = br.cave && match.t < br.leaveAt && playersLeft() > 40;
  const c = nearChest(b, camping ? 11 : poor ? 90 : 32);
  if (c && (poor || Math.random() < 0.5)) { setState(b, 'loot'); br.chest = c; br.busy = 0; goTo(b, c.pos[0], c.pos[2] + 0.8); return; }
  if (camping) {
    setState(b, 'camp');
    if (!br.goal && (br.rest -= 0.5) <= 0) {                  // shuffle about at the back of the cave, now and then
      br.rest = rand(3, 12);
      const k = br.cave, s = CAVE.length + CAVE.room - 1.4 + rand(-2.4, 1.8);
      b.crouch = Math.random() < 0.4;
      if (Math.random() < 0.6) goTo(b, k.x + caveShift(k, s) + rand(-2.2, 2.2), k.z - s);
    }
    return;
  }
  br.cave = null;
  setState(b, 'roam');
  // stay with the other half of the pair
  const mate = br.buddy;
  if (mate && mate.dead < 0 && !match.noTruce && Math.hypot(mate.pos[0] - b.pos[0], mate.pos[2] - b.pos[2]) > 7) { goTo(b, mate.pos[0] + rand(-2, 2), mate.pos[2] + rand(-2, 2)); return; }
  if (br.goal) return;
  if (br.heard && Math.random() < 0.4 + br.skill * 0.3 && armed(b)) { goTo(b, br.heard[0] + rand(-6, 6), br.heard[1] + rand(-6, 6)); br.heard = null; return; }
  br.heard = null;
  const hunting = armed(b) && (playersLeft() < 20 || Math.random() < clamp((match.t - 120) / 360, 0, 0.7));
  const to = (hunting && huntSpot(b)) || somewhere(b, 25, 110);
  if (match.t > br.bikeAt && Math.hypot(to[0] - b.pos[0], to[1] - b.pos[2]) > 35) {
    let ride = null, rideD = 45;
    for (const k of bikes) { const d = Math.hypot(k.p[0] - b.pos[0], k.p[2] - b.pos[2]); if (!k.rider && d < rideD && !(player.ride && player.ride.b === k)) { rideD = d; ride = k; } }
    if (ride) { setState(b, 'bike'); br.bike = ride; br.dest = to; goTo(b, ride.p[0], ride.p[2]); br.bikeAt = match.t + rand(40, 100); return; }
  }
  goTo(b, to[0], to[1]);
}

// ---------------------------------------------------------------- bikes
function mount(b, bike) {
  bike.rider = b; b.onBike = bike; equip(b, null);
  bike.rest = 0; b.crouch = false;
  b.pos = bike.p.slice(); b.yaw = bike.yaw;
  playAt('squeak', b.pos, 0.8, 30);
}
function dismount(b, crashed) {
  const bike = b.onBike;
  if (!bike) return;
  bike.rider = null; b.onBike = null; b.script = null; b.scriptW = 0;
  bike.rest = crashed ? (Math.random() < 0.5 ? 1.2 : -1.2) : 0.16; bike.leanV = 0; bike.pitch = 0;
  const spot = { pos: V.add(b.pos, [Math.cos(bike.yaw) * 0.6, 0, -Math.sin(bike.yaw) * 0.6]), isPlayer: true };
  confine(spot);
  b.pos = [spot.pos[0], floorAt(spot.pos[0], spot.pos[2], b.pos[1] + 0.5), spot.pos[2]];
  if (b.inv.length && b.dead < 0) equip(b, b.inv[0]);
  if (crashed) playAt('thud', b.pos, 0.9, 30);
}
function rideAlong(b, dt) {
  const br = b.br, bike = b.onBike, p = waypoint(b, 2);
  if (!p) { if (!br.wants) { dismount(b, false); br.state = 'roam'; br.bike = null; } return; }
  const turn = wrap(Math.atan2(p[0] - b.pos[0], p[1] - b.pos[2]) - b.yaw), v = Math.abs(turn) > 1.2 ? 2.5 : 6.2;
  b.yaw += clamp(turn, -3 * dt, 3 * dt);
  const x0 = b.pos[0], z0 = b.pos[2];
  b.pos[0] += Math.sin(b.yaw) * v * dt; b.pos[2] += Math.cos(b.yaw) * v * dt;
  if (!br.far) { confine(b); cliffs(b, x0, z0); }
  b.pos[1] = floorAt(b.pos[0], b.pos[2], b.pos[1] + 0.6);
  if (inSea(b.pos)) { b.pos[0] = x0; b.pos[2] = z0; dismount(b, true); br.state = 'roam'; br.goal = br.path = null; return; }
  bike.p = b.pos.slice(); bike.yaw = b.yaw; bike.spin += v * dt / BIKE.at.wheel; bike.crank += v * dt * 2;
  bike.lean += (clamp(-turn * 0.4, -0.35, 0.35) + 0.05 * Math.sin(bike.crank) - bike.lean) * Math.min(1, dt * 8);
  bike.steer += (clamp(turn, -0.5, 0.5) - bike.steer) * Math.min(1, dt * 10);
  b.time += dt; b.speed = 0; b.jump = -1; b.air = 0;
  for (const n of CLIP_NAMES) b.weights[n] = n === 'Idle' ? 1 : 0;
  br.stuckT += dt;
  if (br.stuckT > 2.5) { if (Math.hypot(b.pos[0] - br.from[0], b.pos[2] - br.from[1]) < 2) { dismount(b, true); br.state = 'roam'; br.goal = br.path = null; return; } br.stuckT = 0; br.from = [b.pos[0], b.pos[2]]; }
  if (Math.floor(bike.crank / 6.283) !== Math.floor((bike.crank - v * dt * 2) / 6.283) && !br.far) playAt('squeak', b.pos, 0.3, 18);
  if (b.away < 90) {
    const P = STYLES[b.br.skill > 0.8 ? 'sprint' : 'pedal'](bike, b.time);
    const F = bikeFrame(bike);
    b.script = rideScript(P); b.script.root = { R: F.R, p: F.p }; b.scriptW = 1;
  }
}

// ---------------------------------------------------------------- going through a chest
function chestPose(b, u) {
  const dig = Math.sin(u * 17) * 0.06 * smooth(1.1, 1.4, u), hips = restAt('hips');
  const crouch = smooth(0, 0.45, u) * (1 - smooth(2.2, 2.6, u)), open = smooth(0.7, 1.0, u);
  const S = { hips: V.add(hips, [0, -0.34 * crouch, -0.1 * crouch]), bend: 0.75 * crouch, head: M3.rx(0.3 * crouch), arms: {}, legs: {} };
  for (const [s, x] of [['R', -1], ['L', 1]]) {
    S.legs[s] = { ankle: V.add(restAt('foot_' + s), [x * 0.07 * crouch, 0, -0.04 * crouch]), pole: [x * 0.45, 0, 1] };
    S.arms[s] = reach([x * (0.24 - 0.12 * open), 0.62 - 0.24 * open + dig * x, 0.55 + 0.18 * open + dig], [0, -0.5, 1], [-x, 0, 0], [x, -0.6, -0.3], 0.9);
  }
  b.script = S; b.scriptW = smooth(0, 0.35, u) * (1 - smooth(2.35, 2.7, u));
}
function chestVisit(b, dt) {
  const br = b.br, c = br.chest;
  const t0 = br.busy, t = br.busy += dt;
  b.yaw += wrap(Math.PI - b.yaw) * Math.min(1, dt * 12);
  c.claimed = b;
  chestPose(b, t);
  if (t0 < 0.8 && t >= 0.8) { c.forced = true; c.openV = 3; playAt('creak', c.pos, 0.9, 28); playAt('chestopen', c.pos, 0.7, 28); }
  if (t0 < 2.1 && t >= 2.1) {
    botTake(b, c.loot || rollLoot(), false);
    c.loot = null; c.t = 0; c.forced = false;
    playAt('grab', c.pos, 0.8, 22);
  }
  if (t >= 2.7) { c.claimed = null; br.chest = null; br.busy = 0; b.script = null; b.scriptW = 0; br.state = 'roam'; br.goal = br.path = null; }
}

// ---------------------------------------------------------------- fighting
const PREF = { shotgun: 6, p90: 12, mp5: 14, glock: 15, ak: 22, awp: 38, mgl: 22 };
function chooseGun(b, d) {
  let best = null, bestS = -1e9;
  for (const id of b.inv) {
    const am = b.ammo[id];
    if (!am || (am.clip <= 0 && am.spare <= 0)) continue;
    const s = -Math.abs(d - PREF[id]) + rarityOf(b, id) * 6 + (am.clip > 0 ? 8 : 0) + (b.weapon === id ? 6 : 0);
    if (s > bestS) { bestS = s; best = id; }
  }
  return best;
}
// the full thing: turn, strafe, keep a distance that suits the gun, take a moment, then shoot in bursts
function fightMove(b, dt) {
  const br = b.br, e = br.target, move = { x: 0, y: 0, sprint: false };
  if (!e || e.dead >= 0 || e.gone) { br.target = null; br.think = 0; return move; }
  const dx = e.pos[0] - b.pos[0], dz = e.pos[2] - b.pos[2], d = Math.hypot(dx, dz), seen = game.time - br.seen < 0.9;
  if (!seen) {                                                 // out of sight: walk to where he was last
    const p = waypoint(b, 1.5);
    if (p) { b.yaw += wrap(Math.atan2(p[0] - b.pos[0], p[1] - b.pos[2]) - b.yaw) * Math.min(1, dt * 7); move.y = 1; move.sprint = true; }
    else if (br.lastSeen && !br.wants) { br.lastSeen = null; }
    return move;
  }
  br.goal = br.path = null;
  b.yaw += wrap(Math.atan2(dx, dz) - b.yaw) * Math.min(1, dt * 7);
  const id = chooseGun(b, d);
  if (!id) { br.state = 'flee'; return move; }
  if (b.weapon !== id) equip(b, id);
  const g = GUNS[id], pref = PREF[id];
  if ((br.strafeT -= dt) <= 0) {
    br.strafeT = rand(0.5, 1.7); br.strafe = [-1, -1, 0, 1, 1][Math.floor(rand(0, 5))];
    b.crouch = Math.random() < (d > 18 ? 0.35 : 0.1);
    if (Math.random() < 0.07 * br.skill && d < 16) startJump(b);
  }
  move.x = br.strafe; move.y = d > pref + 5 ? 1 : d < pref - 5 ? -1 : 0;
  b.target = [e.pos[0], e.pos[1] + (e.crouch ? 0.8 : 1.1), e.pos[2]];
  b.ads = 0;
  br.wait -= dt;
  if ((br.react -= dt) > 0 || br.wait > 0 || b.reload >= 0 || b.cool > 0 || b.equip < 1 || b.cycle >= 0 || d > (id === 'shotgun' ? 22 : 75)) return move;
  const am = b.ammo[id];
  if (am.clip <= 0) { startReload(b); return move; }
  if (br.burst <= 0) br.burst = g.auto ? Math.floor(rand(3, 8)) : 1;
  ensurePosed(b);
  if (!b.gun) return move;
  const muzzle = V.add(b.gun.p, M3.vec(b.gun.S, b.gun.g.muzzle));
  const wobble = (id === 'awp' ? 0.008 : 0.022) + (1 - br.skill) * 0.045 + (e.speed || 0) * 0.011;
  fire(b, muzzle, V.norm(V.sub(b.target, muzzle)), wobble, 0);
  b.cool = Math.max(b.cool, g.auto ? 90 / g.rate : id === 'awp' ? 2.2 : id === 'glock' ? rand(0.22, 0.5) : rand(0.9, 1.4));
  if (--br.burst <= 0) br.wait = rand(0.4, 1.3) * (1.5 - br.skill);
  return move;
}
// a long way off: no bullets, just a roll of the dice now and then
const FAR_HIT = { ak: 30, glock: 22, awp: 130, mp5: 24, p90: 22, shotgun: 40, mgl: 55 };
function farFight(b, dt) {
  const br = b.br, e = br.target;
  if (!e || e.dead >= 0 || e.gone) { br.target = null; br.state = 'roam'; return; }
  const d = Math.hypot(e.pos[0] - b.pos[0], e.pos[2] - b.pos[2]);
  b.yaw = Math.atan2(e.pos[0] - b.pos[0], e.pos[2] - b.pos[2]);
  if (d > BR.sight + 12) { br.target = null; br.state = 'roam'; return; }
  if ((br.wait -= dt) > 0) return;
  if (br.state === 'brawl') {
    br.wait = 0.8;
    if (d < 2.2) damage(e, 14, b); else { b.pos[0] += (e.pos[0] - b.pos[0]) / d * 2.4; b.pos[2] += (e.pos[2] - b.pos[2]) / d * 2.4; b.pos[1] = floorAt(b.pos[0], b.pos[2], b.pos[1] + 1); }
    return;
  }
  const id = chooseGun(b, d);
  if (!id) { br.state = 'flee'; return; }
  b.weapon = id;
  br.wait = rand(1.3, 2.8) * (id === 'awp' ? 1.8 : 1);
  const am = b.ammo[id];
  if (am.clip <= 0) { const n = Math.min(GUNS[id].mag, am.spare); am.clip = n; am.spare -= n; return; }
  am.clip = Math.max(0, am.clip - (GUNS[id].auto ? 5 : 1));
  gunHeard(b, GUNS[id]);
  if (Math.random() < (0.16 + 0.3 * br.skill) * clamp(1.15 - d / 70, 0.15, 1) * (d > 15 && id === 'shotgun' ? 0.2 : 1))
    damage(e, FAR_HIT[id] * RARITY[rarityOf(b, id)].mult * rand(0.7, 1.3), b, false, rarityOf(b, id) === EXOTIC);
}

// ---------------------------------------------------------------- one frame of one caveman
function liveStep(b, dt) {
  const br = b.br;
  if ((br.think -= dt) <= 0) { br.think = br.far ? rand(0.7, 1.1) : rand(0.3, 0.5); think(b); }
  if (b.dead >= 0) return;
  let move = { x: 0, y: 0, sprint: false };
  if (b.onBike) { rideAlong(b, dt); if (b.onBike) { weaponStep(b, dt); return; } }
  if (b.use) {
    b.crouch = br.skill > 0.5 && b.use.t !== 'plate';
    if (useStep(b, dt)) { b.use = null; b.carry = null; b.thing = null; b.headTilt = null; b.crouch = false; }
  } else if (br.state === 'fight') {
    if (br.far) farFight(b, dt); else move = fightMove(b, dt);
  } else if (br.state === 'brawl') {
    const e = br.target;
    if (br.far) farFight(b, dt);
    else if (e && e.dead < 0) {
      const dx = e.pos[0] - b.pos[0], dz = e.pos[2] - b.pos[2], d = Math.hypot(dx, dz);
      if (b.weapon) equip(b, null);
      b.yaw += wrap(Math.atan2(dx, dz) - b.yaw) * Math.min(1, dt * 8);
      move.y = d > 0.95 ? 1 : 0; move.sprint = d > 3;
      if (d < 1.25 && (br.wait -= dt) <= 0 && Math.abs(e.pos[1] - b.pos[1]) < 1.5) { br.wait = rand(0.6, 1.1); b.punch = 0; damage(e, 13, b); playAt('punch', b.pos, 0.9, 22); }
    } else br.think = 0;
  } else if (br.state === 'flee') {
    const e = br.target;
    if (!br.goal && e) { const away = Math.atan2(b.pos[0] - e.pos[0], b.pos[2] - e.pos[2]) + rand(-0.6, 0.6); const x = b.pos[0] + Math.sin(away) * 28, z = b.pos[2] + Math.cos(away) * 28; if (reachMap().has(x, z)) goTo(b, x, z); else { const s = somewhere(b, 15, 35); goTo(b, s[0], s[1]); } }
    if (game.time - br.seen > 3.5 || !e) { br.target = null; br.state = 'roam'; br.goal = br.path = null; }
    move = walkTo(b, dt, true);
  } else if (br.state === 'loot') {
    if (br.chest) {
      const c = br.chest;
      if (br.busy > 0) chestVisit(b, dt);
      else if (c.t >= 0 || (c.claimed && c.claimed !== b)) { br.chest = null; br.state = 'roam'; br.goal = br.path = null; }
      else if (Math.hypot(c.pos[0] - b.pos[0], c.pos[2] + 0.8 - b.pos[2]) < 0.75 && Math.abs(c.pos[1] - b.pos[1]) < 1.5) { br.goal = br.path = null; equip(b, null); br.busy = 0.001; }
      else { move = walkTo(b, dt, true, 0.5); if (!br.goal && !br.wants) goTo(b, c.pos[0], c.pos[2] + 0.8); if (br.stuck > 3) { br.skip = c; br.chest = null; br.state = 'roam'; br.goal = br.path = null; } }
    } else if (br.loot) {
      const o = br.loot;
      if (!floorLoot.includes(o)) { br.loot = null; br.state = 'roam'; br.goal = br.path = null; }
      else if (Math.hypot(o.p[0] - b.pos[0], o.p[2] - b.pos[2]) < 0.9) { floorLoot.splice(floorLoot.indexOf(o), 1); botTake(b, o.item, false); playAt('grab', b.pos, 0.7, 18); br.loot = null; br.state = 'roam'; br.goal = br.path = null; }
      else { move = walkTo(b, dt, false, 0.5); if (!br.goal && !br.wants) goTo(b, o.p[0], o.p[2]); if (br.stuck > 2) { br.loot = null; br.state = 'roam'; br.goal = br.path = null; } }
    } else br.state = 'roam';
  } else if (br.state === 'bike') {
    const k = br.bike;
    if (!k || (k.rider && k.rider !== b) || (player.ride && player.ride.b === k)) { br.bike = null; br.state = 'roam'; br.goal = br.path = null; }
    else if (Math.hypot(k.p[0] - b.pos[0], k.p[2] - b.pos[2]) < 1.3) { mount(b, k); goTo(b, br.dest[0], br.dest[1]); }
    else { move = walkTo(b, dt, true, 1); if (!br.goal && !br.wants) goTo(b, k.p[0], k.p[2]); if (br.stuck > 3) { br.bike = null; br.state = 'roam'; br.goal = br.path = null; } }
  } else move = walkTo(b, dt, br.state === 'roam' && br.skill > 0.45);
  // guns away when walking about is nothing to worry about; out when something is
  if (!b.use && !b.onBike && br.state !== 'brawl' && br.busy <= 0 && !b.weapon && b.inv.length) equip(b, b.inv[0]);
  if (br.state !== 'fight') b.target = [b.pos[0] + Math.sin(b.yaw) * 6, b.pos[1] + 1.0, b.pos[2] + Math.cos(b.yaw) * 6];

  if (br.far) {                                                // cheap: slide along the path
    const speed = move.y || move.x ? (move.sprint ? 3.2 : 1.7) : 0;
    if (speed) { b.pos[0] += Math.sin(b.yaw) * speed * dt; b.pos[2] += Math.cos(b.yaw) * speed * dt; b.pos[1] = floorAt(b.pos[0], b.pos[2], b.pos[1] + 0.7); }
    b.speed = speed; b.time += dt;
    const clip = speed > 1.8 ? 'Run' : speed > 0 ? 'Walk' : 'Idle';
    for (const n of CLIP_NAMES) b.weights[n] = n === clip ? 1 : 0;
    if (speed) b.phase = (b.phase + dt / Rig.clips[clip].T) % 1;
    b.equip = 1; b.jump = -1; b.air = 0;
    if (b.reload >= 0 || b.cycle >= 0 || b.punch >= 0) weaponStep(b, dt);
    return;
  }
  b.runCap = br.state === 'camp' ? 1.7 : 3.1 + br.skill * 0.6;
  if (br.busy > 0) { b.speed = 0; for (const n of CLIP_NAMES) b.weights[n] = n === 'Idle' ? 1 : 0; b.time += dt; }
  else locomotion(b, move.x, move.y, move.sprint, dt);
  weaponStep(b, dt);
}
// follow the path; when stuck, hop, step sideways, and in the end think again
function walkTo(b, dt, sprint, close) {
  const br = b.br, move = { x: 0, y: 0, sprint }, p = waypoint(b, close);
  if (!p) { br.stuckT = 0; return move; }
  const turn = wrap(Math.atan2(p[0] - b.pos[0], p[1] - b.pos[2]) - b.yaw);
  b.yaw += br.far ? turn : turn * Math.min(1, dt * 7);
  if (Math.abs(turn) < 1.4) move.y = 1;
  if (br.far) return move;
  if (br.sideT > 0) { br.sideT -= dt; move.x = br.side; }
  if ((br.stuckT += dt) > 1.2) {
    if (Math.hypot(b.pos[0] - br.from[0], b.pos[2] - br.from[1]) < 0.7) {
      br.stuck++;
      br.side = Math.random() < 0.5 ? 1 : -1; br.sideT = 0.7; startJump(b);
      if (br.stuck === 3 && br.goal && !br.wants) { br.path = null; br.wants = true; match.paths.push(b); }
      if (br.stuck > 5) br.goal = br.path = null;
    } else br.stuck = 0;
    br.stuckT = 0; br.from = [b.pos[0], b.pos[2]];
  }
  return move;
}
function royaleStep(dt) {
  if (!match) return;
  match.t += dt;
  const left = playersLeft();
  // when hardly anyone is left, or only one tribe, it is every man for himself
  if (!match.noTruce && (left <= 8 || (player.dead >= 0 && new Set(bots.filter(b => b.dead < 0).map(b => b.br.squad || b)).size <= 1))) match.noTruce = true;
  pathsStep();
  for (const b of bots) {
    const br = b.br;
    if (!br) continue;
    if (b.dead >= 0) {
      if (b.gone) continue;
      const before = b.dead; b.dead += dt; deathCues(b, before);
      if (!b.beingLooted && !b.send && (b.dead > BR.bodyTime || (b.looted && b.dead > 2.5))) { b.gone = true; spillPockets(b); }
      continue;
    }
    const d = Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]);
    br.far = br.far ? d > BR.near : d > BR.far;
    if (br.far && !b.vis) {                                    // out of sight: a few times a second is plenty
      br.acc += dt;
      if (br.acc < 0.25) continue;
      const step = br.acc; br.acc = 0; liveStep(b, step);
    } else { br.acc = 0; liveStep(b, dt); }
  }
  hudDirty = hudDirty || left !== match.left;
  match.left = left;
}

// ---------------------------------------------------------------- being hurt and going out
function royaleHurt(b, from) {
  const br = b.br;
  if (!br) return;
  if (from.isPlayer) b.hitByYou = game.time;
  if (b.onBike) { dismount(b, true); br.state = 'roam'; br.goal = br.path = null; }
  if (br.state === 'loot') { leaveLoot(b); br.state = 'roam'; br.goal = br.path = null; }
  const who = from.br ? from : from.isPlayer && game.enemiesShoot ? player : null;
  if (who && who !== b && !allies(b, who)) {
    if (br.target !== who) br.react = 0.25 + (1 - br.skill) * 0.5;
    br.target = who; br.seen = game.time; br.lastSeen = [who.pos[0], who.pos[2]]; br.think = Math.min(br.think, 0.1);
    if (br.state !== 'fight') { br.goal = br.path = null; b.use = null; b.carry = null; b.thing = null; b.headTilt = null; br.state = armed(b) ? 'fight' : 'flee'; }
  }
}
function royaleDeath(b) {
  const br = b.br;
  dismount(b, true); leaveLoot(b);
  b.use = null; b.carry = null; b.thing = null; b.headTilt = null; b.script = null; b.scriptW = 0;
  const d = Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]);
  if (d > 55) { b.gone = true; spillPockets(b); }              // too far to see: just his things on the ground
  else {
    match.bodies = match.bodies.filter(f => !f.gone && f.dead >= 0 && bots.includes(f));
    match.bodies.push(b);
    while (match.bodies.length > BR.bodies) { const old = match.bodies.shift(); if (!old.beingLooted && !old.send) { old.gone = true; spillPockets(old); } }
    if (!b.inv.length) spillPockets(b);
  }
  hudDirty = true;
}
function royaleLost() {
  if (!match || match.over) return;
  match.over = { win: false, place: playersLeft() + 1, at: game.time + 4.5 };
}
function matchStep(dt) {
  if (!royaleOn() || !match) return;
  if (!match.over && player.dead < 0 && bots.every(b => b.dead >= 0)) { match.over = { win: true, place: 1, at: game.time + 1.6 }; Sound.play('victory', 0.9); }
  const o = match.over;
  if (!o) return;
  if (o.win && (match.victoryT -= dt) <= 0) {                  // confetti
    match.victoryT = 0.12;
    for (let i = 0; i < 14; i++) particles.push({ p: V.add(player.pos, [rand(-2, 2), rand(2.4, 3.4), rand(-2, 2)]), v: [rand(-0.5, 0.5), rand(-0.2, 0.8), rand(-0.5, 0.5)], life: 2.5, max: 2.5, size: 0.035, color: [Math.random(), Math.random() * 0.8, Math.random(), 1], grav: 1.2 });
  }
  if (!match.shown && game.time >= o.at) {
    match.shown = true;
    ui.restitle.textContent = o.win ? 'VICTORY!' : 'KNOCKED OUT';
    ui.resplace.textContent = o.win ? 'Last caveman standing' : 'You placed #' + o.place + ' of ' + (BR.others + 1);
    ui.reskills.textContent = 'Knockouts: ' + game.kills;
    ui.results.hidden = false;
    if (!o.win) Sound.play('lose', 0.8);
  }
}
// Enter on the results screen: straight into another one
function matchKey(e) {
  if (!royaleOn() || !match || !match.shown || !['Enter', 'NumpadEnter'].includes(e.code)) return false;
  e.preventDefault();
  setMap('island', world.low); menuTiles();
  return true;
}

// ---------------------------------------------------------------- hearing and seeing them
// somebody else's gun: loud close by, a dull thud a long way off. others hear it too
function gunHeard(f, g) {
  const quiet = game.time - (f.shotAt || -99) < 0.5;
  f.shotAt = game.time;
  const d = Math.hypot(f.pos[0] - player.pos[0], f.pos[2] - player.pos[2]);
  if (!royaleOn()) { playAt(g.sound, f.pos, 1, 90); return; }
  if (d < 200 && (d < 35 || game.time - match.gunAt > 0.07)) {
    match.gunAt = game.time;
    playAt(g.sound, f.pos, d < 60 ? 1 : 0.8, 220);
  }
  if (quiet) return;
  for (const b of bots) if (b !== f && b.dead < 0 && b.br && !b.br.target && !b.br.cave && Math.abs(b.pos[0] - f.pos[0]) < 55 && Math.abs(b.pos[2] - f.pos[2]) < 55) b.br.heard = [f.pos[0], f.pos[2]];
}
// birds, gulls, the wind up high, drips underground
function ambience(dt) {
  if (!royaleOn() || !match) { Sound.loop('wind', 0); return; }
  const p = player.pos, under = inCave(p);
  Sound.loop('wind', under ? 0.01 : 0.05 + clamp((p[1] - 8) / 40, 0, 0.16));
  if ((match.bird -= dt) > 0) return;
  const side = rand(-0.8, 0.8);
  if (under) { match.bird = rand(0.7, 2.6); Sound.play('drip', rand(0.25, 0.6), rand(0, 1), side); return; }
  match.bird = rand(1.5, 6);
  Sound.play(pastCoast(p[0], p[2]) > -35 ? 'gull' : 'bird', rand(0.12, 0.35), rand(0, 1), side);
}

// only the ones in front of the camera and near enough are posed and drawn; the further, the less often
let frameNo = 0;
function ensurePosed(f) { if (!f.isPlayer && f.posedT !== game.time) poseFighter(f); }
function poseOthers(vp, eye) {
  frameNo++;
  const range = royaleOn() ? Math.min(viewRange(), world.low ? 110 : 160) : Infinity;
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    if (b.gone) { b.vis = false; continue; }
    const x = b.pos[0], y = b.pos[1] + 1, z = b.pos[2], d = Math.hypot(x - eye[0], z - eye[2]);
    b.away = d;
    let vis = d < range;
    if (vis && d > 5) {
      const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      vis = w > -1.5 && Math.abs(vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) < w + 3 && Math.abs(vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) < w + 3;
    }
    const was = b.vis;
    b.vis = vis;
    if (!vis) continue;
    const every = d < 22 ? 1 : d < 50 ? 2 : 4;
    if (!was || b.posedT < 0 || (frameNo + i) % every === 0) poseFighter(b);
    else {                                                     // not this frame: just carry the last pose along
      const mx = b.pos[0] - b.posedAt[0], my = b.pos[1] - b.posedAt[1], mz = b.pos[2] - b.posedAt[2];
      if (mx || my || mz) {
        if (b.dead < 0 || !b.rag) { b.model[12] += mx; b.model[13] += my; b.model[14] += mz; if (b.gun) b.gun.p = [b.gun.p[0] + mx, b.gun.p[1] + my, b.gun.p[2] + mz]; }
        b.posedAt[0] = b.pos[0]; b.posedAt[1] = b.pos[1]; b.posedAt[2] = b.pos[2];
      }
    }
  }
}
