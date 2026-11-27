// ======================================================================= rob run: the other cavemen
// Ninety-nine of them. Tribes hole up in the caves behind a door, with a stash at the back; others build little forts
// out in the open; the rest wander. They search chests, fight, break into each other's stashes and yours (with C4 if
// there is a wall in the way), carry what they took home, and build. A few are friendly and will join you.
//
// The ones near you are played out in full. The ones far away move and fight in a cheaper way, so a hundred of them
// still runs.
const BR = { others: 99, near: 65, far: 80, sight: 34, bodies: 10, watch: 55, bikes: 30, forts: 16, friends: 12, grace: 75 };
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
    lastHit: null, hitByYou: -99, yours: false, shotAt: -99, food: { fish: 0, meat: 0 }, plates: 0, legYaw: 0, tilt: 0, drop: 0, posedT: -1, rocks: 0, c4: 0, hasBag: false });
  for (const n of CLIP_NAMES) b.weights[n] = n === 'Idle' ? 1 : 0;
}
function brain(extra) {
  const skill = rand(0.25, 1);
  return Object.assign({ squad: 0, cave: null, state: 'idle', skill, think: rand(0, 0.6), goal: null, path: null, wp: 0, wants: false, target: null, seen: -99, lastSeen: null, react: 0, burst: 0, wait: 0,
    strafe: 0, strafeT: 0, chest: null, loot: null, bike: null, dest: null, busy: 0, stuckT: 0, stuck: 0, side: 0, sideT: 0, from: [0, 0], rest: 0, bikeAt: rand(0, 60), acc: 0, heard: null, far: true,
    home: null, friendly: false, crew: false, guard: false, post: null, grudge: null, grudgeT: 0, raid: null, raidAt: rand(70, 420), plan: null, greet: 0, respawnAt: null }, extra || {});
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
function landSpot(avoid, taken, least) {
  const cells = reachMap().cells;
  let x = 0, z = 0;
  for (let k = 0; k < 300; k++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    x = c[0]; z = c[1];
    if (Math.hypot(x - avoid[0], z - avoid[2]) < (least || 80) || pastCoast(x, z) > -8 || riverDistance(x, z) < RIVER.bank + 2 || caveAt(x, z, 2) || nearHouse(x, z, 7)) continue;
    if (k < 200 && taken && taken.some(q => Math.abs(q[0] - x) < 22 && Math.abs(q[1] - z) < 22)) continue;
    break;
  }
  return [x, z];
}

// ---------------------------------------------------------------- what they start with, and what is in their stashes
function botGear(b, rich) {
  if (Math.random() < (rich ? 0.95 : 0.5)) {
    const id = rich ? rollGun() : Math.random() < 0.65 ? 'glock' : 'mp5', r = Math.random() < (rich ? 0.35 : 0.15) ? 1 + (Math.random() < 0.3) : 0;
    botTake(b, gunItem(id, r, GUNS[id].mag, GUNS[id].mag * 3, randomAtt(id, r, rich ? 0.2 : 0.05)), true);
  }
  if (Math.random() < (rich ? 0.35 : 0.12)) botTake(b, { t: 'vest' }, true);
  if (Math.random() < 0.4) botTake(b, { t: 'meat' }, true);
  b.rocks = Math.floor(rand(0, rich ? 60 : 35));
  b.c4 = Math.random() < 0.08 ? 1 : 0;
}
function stashFill(s, rich) {
  const guns = (rich ? 2 : 1) + (Math.random() < 0.45 ? 1 : 0);
  for (let i = 0; i < guns; i++) {
    const id = rollGun(), r = Math.max(rollRarity(), rich ? rollRarity() : 0);
    s.items.push(gunItem(id, r, GUNS[id].mag, GUNS[id].mag * 3, randomAtt(id, r, rich ? 0.4 : 0.2)));
  }
  if (Math.random() < 0.6) s.items.push({ t: 'meat', n: 1 + (Math.random() < 0.5) });
  if (Math.random() < 0.4) s.items.push({ t: 'plate', n: 1 + (Math.random() < 0.3) });
  if (Math.random() < 0.3) s.items.push({ t: 'c4' });
  if (Math.random() < (rich ? 0.2 : 0.07)) s.items.push({ t: 'bag' });
  if (Math.random() < 0.12) s.items.push({ t: 'hammer' });
  s.rocks = Math.floor(rich ? rand(150, 550) : rand(40, 200));
}
// a tribe's cave: a door across the passage, a stash at the back, sometimes a work table
function tribeHome(c, owner) {
  const at = (s, t) => ({ x: c.x + caveShift(c, s) + (t || 0), z: c.z - s, y: caveFloorAt(s, c) });
  const d = at(11.5), door = newPiece('door', d.x, d.y, d.z, 0, owner, (caveWide(11.5) * 2 + 0.25) / 2.4);
  const k = at(18.3), stash = newPiece('stash', k.x, k.y, k.z, 0, owner);
  addPiece(door); addPiece(stash); stashFill(stash, true);
  if (Math.random() < 0.4) { const w = at(15.4, 3.2); addPiece(newPiece('bench', w.x, w.y, w.z, -Math.PI / 2, owner)); }
  return { stash, door, cave: c };
}
// the pieces of a little fort: three walls and a door round a stash. a: which way the door faces
function fortPlan(x, z, a, owner, level) {
  const f = [Math.sin(a), Math.cos(a)], r = [Math.cos(a), -Math.sin(a)];
  const piece = (kind, ahead, aside, yaw) => { const p = newPiece(kind, x + f[0] * ahead + r[0] * aside, 0, z + f[1] * ahead + r[1] * aside, yaw, owner); p.floor = level; return p; };
  const list = [piece('wall', -1.2, 0, a + Math.PI), piece('wall', 0, 1.2, a + Math.PI / 2), piece('wall', 0, -1.2, a - Math.PI / 2), piece('door', 1.2, 0, a), piece('stash', -0.55, 0, a)];
  if (list.some(p => placeBlock(p))) return null;
  if (Math.max(...list.map(p => p.y)) - Math.min(...list.map(p => p.y)) > 0.6) return null;
  return { x, z, a, list, door: list[3], stash: list[4], inside: [x + f[0] * 0.55, z + f[1] * 0.55], outside: [x + f[0] * 2.2, z + f[1] * 2.2] };
}
function fortNear(px, pz, spread, owner) {
  for (let k = 0; k < 40; k++) {
    const x = px + rand(-spread, spread), z = pz + rand(-spread, spread);
    if (!reachMap().has(x, z) || pastCoast(x, z) > -10 || caveAt(x, z, 4) || nearHouse(x, z, 8)) continue;
    if (raid.builds.some(q => Math.abs(q.x - x) < 7 && Math.abs(q.z - z) < 7)) continue;
    const plan = fortPlan(x, z, rand(-3.14, 3.14), owner, undefined);
    if (plan) return plan;
  }
  return null;
}

function newMatch() {
  setRoster(BR.others);
  floorLoot.length = 0;
  clearBuilds();
  match = { t: 0, over: null, shown: false, bodies: [], paths: [], bird: 3, gunAt: 0, tidy: 0, foe: null, foeT: -99 };
  game.kills = 0; game.chestLearned = false;
  ui.results.hidden = true;
  for (const b of bots) b.br = null;
  let i = 0;
  // tribes in the caves
  const caves = CAVES.slice().sort(() => Math.random() - 0.5).slice(0, 8);
  caves.forEach((c, k) => {
    const size = 3 + (Math.random() < 0.5 ? 1 : 0);
    let home = null;
    for (let m = 0; m < size && i < bots.length; m++) {
      const s = CAVE.length + CAVE.room - 1.4 + rand(-1.6, 1.6), x = c.x + caveShift(c, s) + (m - (size - 1) / 2) * 1.2 + rand(-0.3, 0.3);
      const b = bots[i++];
      putBot(b, x, c.z - s, caveFloorAt(s, c), { squad: k + 1, cave: c, state: 'camp' });
      b.yaw = rand(-0.9, 0.9);                                // mostly watching the way in
      if (!home) home = tribeHome(c, b);
      b.br.home = home;
      botGear(b, true);
    }
  });
  // forts out in the open, one or two to each
  const taken = [];
  let squad = 100;
  for (let n = 0; n < BR.forts && i < bots.length; n++) {
    const b = bots[i++], spot = landSpot(START, taken, 90); taken.push(spot);
    putBot(b, spot[0], spot[1], undefined, { squad: ++squad, state: 'roam' });
    const plan = fortNear(spot[0], spot[1], 12, b);
    if (plan) {
      for (const p of plan.list) addPiece(p);
      stashFill(plan.stash, false);
      b.br.home = plan;
      b.pos = [plan.inside[0], walkHeight(plan.inside[0], plan.inside[1]), plan.inside[1]];
    }
    botGear(b, false);
    if (Math.random() < 0.5 && i < bots.length) {
      const m = bots[i++];
      putBot(m, plan ? plan.outside[0] : spot[0] + 1.5, plan ? plan.outside[1] : spot[1], undefined, { squad: b.br.squad, state: 'roam' });
      m.br.home = b.br.home; m.br.buddy = b; botGear(m, false);
    }
  }
  // everyone else, a few of them the friendly sort
  let friends = 0;
  while (i < bots.length) {
    const b = bots[i++], spot = landSpot(START, taken); taken.push(spot);
    putBot(b, spot[0], spot[1], undefined, { state: 'roam' });
    botGear(b, false);
    if (friends < BR.friends) { b.br.friendly = true; friends++; }
  }
  // one friendly face not far from the beach
  const near = bots[bots.length - 1], hello = landSpot(START, null, 35);
  for (let k = 0; k < 200; k++) { const s = landSpot(START, null, 35); if (Math.hypot(s[0] - START[0], s[1] - START[2]) < 75) { hello[0] = s[0]; hello[1] = s[1]; break; } }
  near.pos = [hello[0], walkHeight(hello[0], hello[1]), hello[1]];
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
// you have just waded ashore: nobody who means you harm is waiting on the beach
function matchBegin() {
  if (!match) return;
  const taken = [];
  for (const b of bots) {
    if (Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]) > 70 || b.br.home || b.br.friendly) continue;
    const spot = landSpot(player.pos, taken); taken.push(spot);
    b.pos = [spot[0], walkHeight(spot[0], spot[1]), spot[1]]; b.br.buddy = null; b.br.goal = b.br.path = null;
  }
  match.t = 0;
}
// ---------------------------------------------------------------- knocked out: that is the game
function royaleLost() {
  if (!match || match.over) return;
  const stashed = raid.builds.reduce((n, p) => n + (p.kind === 'stash' && p.owner === player ? p.rocks : 0), 0);
  match.over = { at: game.time + 4.5, lasted: match.t, rocks: (player.rocks || 0) + stashed };     // counted before they scatter
}
function matchStep() {
  if (!royaleOn() || !match || !match.over || match.shown || game.time < match.over.at) return;
  match.shown = true;
  const o = match.over, m = Math.floor(o.lasted / 60), s = Math.floor(o.lasted % 60);
  ui.restitle.textContent = 'YOU LOST';
  ui.resplace.textContent = 'You lasted ' + (m ? m + ' min ' : '') + s + ' s';
  ui.reskills.textContent = 'Knockouts: ' + game.kills + ' · Shiny rocks: ' + o.rocks.toLocaleString('en-US');
  ui.results.hidden = false;
  Sound.play('lose', 0.8);
}
// Enter on that screen: a new island
function matchKey(e) {
  if (!royaleOn() || !match || !match.shown || !['Enter', 'NumpadEnter'].includes(e.code)) return false;
  e.preventDefault();
  setMap('island', world.low); menuTiles();
  return true;
}

// ---------------------------------------------------------------- their pockets: two guns (three with a bag), food, plates
function botTake(b, it, quiet) {
  if (it.t === 'vest') { b.vest = VEST; b.hasVest = true; return; }
  if (it.t === 'plate') { b.plates = Math.min(STACK, b.plates + (it.n || 1)); return; }
  if (it.t === 'rocks') { b.rocks = addRocks(b.rocks, it.n || 1); return; }
  if (it.t === 'c4') { b.c4 = Math.min(C4_MAX, b.c4 + (it.n || 1)); return; }
  if (it.t === 'bag') { b.hasBag = true; return; }
  if (it.t === 'hammer') return;
  if (FOOD[it.t]) { b.food[it.t] = Math.min(STACK, b.food[it.t] + (it.n || 1)); return; }
  if (it.t === 'ammo') { for (const id of b.inv) b.ammo[id].spare += GUNS[id].mag * 2; return; }
  const id = it.id;
  if (!b.inv.includes(id) && b.inv.length >= (b.hasBag ? 3 : 2)) {
    const worst = b.inv.slice().sort((p, q) => rarityOf(b, p) - rarityOf(b, q))[0];
    if (rarityOf(b, worst) >= it.rarity) { if (!quiet) dropLoot(it, b.pos, 0.5); return; }
    const am = b.ammo[worst];
    if (!quiet) dropLoot(gunItem(worst, am.rarity, am.clip, am.spare, am.att), b.pos, 0.5);
    b.inv.splice(b.inv.indexOf(worst), 1); delete b.ammo[worst]; if (b.weapon === worst) b.weapon = null;
  }
  const had = b.ammo[id] && b.ammo[id].att;
  give(b, id, Math.max(it.spare, GUNS[id].mag * 3), it.rarity);
  if (it.att || had) b.ammo[id].att = Object.assign({}, it.att, had);
  if (quiet || !b.weapon || rarityOf(b, b.weapon) <= it.rarity) { equip(b, id); if (quiet) b.equip = 1; }
}
// everything he had falls out round him
function spillPockets(v) {
  for (const id of v.inv) { const am = v.ammo[id]; if (am) dropLoot(gunItem(id, am.rarity, am.clip, Math.min(am.spare, GUNS[id].reserve), am.att), v.pos, 0.9); }
  v.inv = []; v.weapon = null; v.gun = null;
  if (v.food) for (const k of ['fish', 'meat']) { if (v.food[k]) dropLoot({ t: k, n: v.food[k] }, v.pos, 0.9); v.food[k] = 0; }
  if (v.plates) { dropLoot({ t: 'plate', n: v.plates }, v.pos, 0.9); v.plates = 0; }
  if (v.hasVest && v.vest > 0) { dropLoot({ t: 'vest' }, v.pos, 0.9); v.vest = 0; v.hasVest = false; }
  if (v.rocks) { dropLoot({ t: 'rocks', n: v.rocks }, v.pos, 0.7); v.rocks = 0; }
  if (v.c4) { dropLoot({ t: 'c4', n: v.c4 }, v.pos, 0.8); v.c4 = 0; }
  if (v.hasBag) { dropLoot({ t: 'bag' }, v.pos, 0.8); v.hasBag = false; }
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
    const lead = [], inside = (x, z, y) => { const c = caveAt(x, z, 0); return c && c.hollow && c.s > 0.5 && (y === undefined || y < c.c.base + 1) ? c : null; };
    const c = inside(ax, az, b.pos[1]), g = inside(br.goal[0], br.goal[1]);
    if (c && g && g.c === c.c) { br.path = [br.goal.slice()]; br.wp = 0; continue; }
    if (c) {                                                    // first out of the cave, along the middle of the passage
      for (let s = Math.min(c.s - 2, CAVE.length - 1); s > 0; s -= 3.5) lead.push([c.c.x + caveShift(c.c, s), c.c.z - s]);
      lead.push([c.c.x, c.c.z + 3.5]);
      ax = c.c.x; az = c.c.z + 3.5;
    }
    const fort = br.home && br.home.outside && br.home, within = (x, z) => fort && Math.abs(x - fort.x) < 1.3 && Math.abs(z - fort.z) < 1.3;
    let to = br.goal, tail = [];
    if (g) {                                                    // into a cave: to its mouth, then along the passage
      for (let s = 0.5; s < Math.min(g.s - 1, CAVE.length); s += 3.5) tail.push([g.c.x + caveShift(g.c, s), g.c.z - s]);
      tail.push(to.slice()); to = [g.c.x, g.c.z + 3.5];
    }
    if (fort && within(ax, az) !== within(to[0], to[1])) {       // through his own door
      if (within(ax, az)) { lead.push(fort.inside, fort.outside); ax = fort.outside[0]; az = fort.outside[1]; }
      else { tail = [fort.inside, to.slice()]; to = fort.outside; }
    }
    br.path = lead.concat(findPath(ax, az, to[0], to[1]), tail); br.wp = 0;
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
const allies = (a, b) => {
  if (a.isPlayer || b.isPlayer) { const q = a.isPlayer ? b : a; return !!(q.br && (q.br.crew || q.br.friendly)); }
  if (!a.br || !b.br) return false;
  if (a.br.crew && b.br.crew) return true;
  if (a.br.squad && a.br.squad === b.br.squad) return true;
  return !!(a.br.friendly && b.br.friendly);
};
function canSee(a, b, d) {
  const from = V.add(a.pos, [0, a.crouch ? 1.1 : 1.55, 0]), to = V.add(b.pos, [0, b.crouch ? 0.9 : 1.25, 0]);
  const way = V.sub(to, from), len = V.len(way) || 1, dir = V.mul(way, 1 / len);
  if (world.map !== 'island') return true;
  if (len > 90) return false;
  const s = surfaceHit(from, dir);
  return !(s && s.t < len - 0.5);
}
const armed = f => f.inv.some(id => f.ammo[id] && (f.ammo[id].clip > 0 || f.ammo[id].spare > 0));
function spotEnemy(b) {
  const br = b.br, hurt = game.time - br.seen < 2, camping = br.state === 'camp';
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), home = br.home && br.home.stash;
  let best = null, bestScore = Infinity;
  const look = f => {
    if (f === b || f.dead >= 0 || f.gone) return;
    const grudge = br.grudge === f;
    if (!grudge && allies(b, f)) return;
    if (f.isPlayer && (!game.enemiesShoot || FLY.on)) return;
    const dx = f.pos[0] - b.pos[0], dz = f.pos[2] - b.pos[2];
    if (Math.abs(dx) > 60 || Math.abs(dz) > 60) return;
    const d = Math.hypot(dx, dz), nosy = home && !home.gone && Math.hypot(f.pos[0] - home.x, f.pos[2] - home.z) < 9;
    // your crew only fights whoever is fighting you; friendly ones keep to themselves
    if (br.crew && !(f === match.foe && game.time - match.foeT < 12) && !(f.br && (f.br.target === player || (f.br.target && f.br.target.br && f.br.target.br.crew)))) return;
    if (br.friendly && !br.crew && !grudge && br.target !== f) return;
    // in your first minute nobody picks on you unless you give them a reason
    if (f.isPlayer && !grudge && !nosy && match.t < BR.grace && !hurt && b.hitByYou < 0) return;
    let reachOut = (br.crew || grudge ? 48 : camping ? 20 : br.raid ? 16 : f.isPlayer ? BR.sight : 24) + (game.time - (f.shotAt || -99) < 1.5 ? 16 : 0) - (f.crouch ? 9 : 0);
    if (nosy) reachOut = Math.max(reachOut, 16);
    if (d > reachOut || Math.abs(f.pos[1] - b.pos[1]) > 14) return;
    if (br.target !== f && !hurt && !br.crew && d > 9 && (dx * fx + dz * fz) / d < -0.1) return;    // behind his back
    const score = d - (br.target === f ? 8 : 0) - (grudge ? 12 : 0);
    if (score >= bestScore) return;
    if (!canSee(b, f, d)) return;
    best = f; bestScore = score;
  };
  look(player);
  for (const f of bots) look(f);
  return best;
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
const wantsLoot = (b, it) => it.t === 'rocks' ? b.rocks < ROCK_MAX : it.t === 'bag' ? !b.hasBag : it.t === 'c4' ? b.c4 < C4_MAX : it.t === 'gun' ? !b.inv.includes(it.id) && (b.inv.length < (b.hasBag ? 3 : 2) || b.inv.some(id => rarityOf(b, id) < it.rarity)) : it.t === 'vest' ? !(b.vest > 50) : it.t === 'plate' ? b.plates < 2 : FOOD[it.t] ? b.food[it.t] < 2 : it.t === 'ammo' && b.inv.length > 0;

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
  if (br.state === 'raid' || br.state === 'build') handsFree(b);
  br.state = state; br.goal = br.path = null; b.crouch = false;
}
// put down whatever he was doing with a hammer or a stash
function handsFree(b) { if (!b.use) { b.carry = null; b.thing = null; } b.crouch = false; }
const homeOf = b => { const h = b.br.home; return h && h.stash && !h.stash.gone ? h : null; };
function think(b) {
  const br = b.br;
  if (b.use) return;
  if (br.grudge && (br.grudge.dead >= 0 || game.time > br.grudgeT)) br.grudge = null;
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
      // shout to the others
      for (const f of bots) if (f !== b && f.br && ((br.squad && f.br.squad === br.squad) || (br.crew && f.br.crew)) && f.dead < 0 && !f.br.target && Math.hypot(f.pos[0] - b.pos[0], f.pos[2] - b.pos[2]) < (silenced(enemy) ? 12 : 25)) { f.br.target = enemy; f.br.seen = game.time - 1; f.br.lastSeen = br.lastSeen.slice(); }
      return;
    }
  }
  if (br.state === 'fight' || br.state === 'brawl' || br.state === 'flee') {
    if (br.target && br.target.dead < 0 && game.time - br.seen < 6 && br.state !== 'flee') {       // lost sight of him: go and look
      if (br.lastSeen && !br.goal) goTo(b, br.lastSeen[0], br.lastSeen[1]);
      return;
    }
    br.target = null; setState(b, br.raid ? 'raid' : br.cave ? 'camp' : 'roam');
  }
  // time to look after himself
  if (b.hp < 70 && (b.food.fish || b.food.meat) && !b.onBike) { leaveLoot(b); handsFree(b); const t = b.food.meat && b.hp < 50 ? 'meat' : b.food.fish ? 'fish' : 'meat'; b.food[t]--; b.use = { t, time: 0 }; br.goal = br.path = null; return; }
  if (b.hasVest && b.vest < 55 && b.plates && !b.onBike) { leaveLoot(b); handsFree(b); b.plates--; b.use = { t: 'plate', time: 0 }; br.goal = br.path = null; return; }
  if (br.state === 'loot' || br.state === 'bike' || br.state === 'build') return;
  if (br.raid) { setState(b, 'raid'); return; }
  // something on the floor worth bending down for
  if (!br.crew || br.guard) for (const o of floorLoot) {
    if (Math.abs(o.p[0] - b.pos[0]) > 12 || Math.abs(o.p[2] - b.pos[2]) > 12 || Math.abs(o.p[1] - b.pos[1]) > 2.5 || !wantsLoot(b, o.item)) continue;
    setState(b, 'loot'); br.loot = o; goTo(b, o.p[0], o.p[2]); return;
  }
  if (br.crew) { crewThink(b); return; }
  if (br.friendly && greetThink(b)) return;
  const home = homeOf(b), poor = !armed(b);
  // pockets full of rocks: take them home
  if (home && b.rocks > 90 && br.state !== 'home') { setState(b, 'home'); goTo(b, home.stash.x, home.stash.z); return; }
  if (br.state === 'home') { if (home && !br.goal && !br.wants) goTo(b, home.stash.x, home.stash.z); else if (!home) setState(b, 'roam'); return; }
  // off to rob somebody
  if (match.t > br.raidAt && !poor && !br.friendly) { br.raidAt = match.t + rand(150, 380); if (pickRaid(b)) { setState(b, 'raid'); return; } }
  const c = nearChest(b, br.cave ? 11 : poor ? 90 : 32);
  if (c && (poor || Math.random() < 0.5)) { setState(b, 'loot'); br.chest = c; br.busy = 0; goTo(b, c.pos[0], c.pos[2] + 0.8); return; }
  if (br.cave) {
    setState(b, 'camp');
    if (!br.goal && (br.rest -= 0.5) <= 0) {                  // shuffle about at the back of the cave, now and then
      br.rest = rand(3, 12);
      const k = br.cave, s = CAVE.length + CAVE.room - 1.4 + rand(-2.4, 1.8);
      b.crouch = Math.random() < 0.4;
      if (Math.random() < 0.6) goTo(b, k.x + caveShift(k, s) + rand(-2.2, 2.2), k.z - s);
    }
    return;
  }
  setState(b, 'roam');
  // no home yet, and enough rocks for one: build it
  if (!br.home && !br.friendly && b.rocks >= 50 && Math.random() < 0.06) {
    const plan = fortNear(b.pos[0], b.pos[2], 14, b);
    if (plan) { br.plan = { fort: plan, next: 0, t: 0 }; setState(b, 'build'); goTo(b, plan.x, plan.z); return; }
  }
  // stay with the other half of the pair
  const mate = br.buddy;
  if (mate && mate.dead < 0 && Math.hypot(mate.pos[0] - b.pos[0], mate.pos[2] - b.pos[2]) > 7) { goTo(b, mate.pos[0] + rand(-2, 2), mate.pos[2] + rand(-2, 2)); return; }
  if (br.goal) return;
  if (br.heard && Math.random() < 0.3 + br.skill * 0.3 && !poor && !br.friendly) { goTo(b, br.heard[0] + rand(-6, 6), br.heard[1] + rand(-6, 6)); br.heard = null; return; }
  br.heard = null;
  // those with a home do not stray far from it for long
  const far = home && Math.hypot(home.stash.x - b.pos[0], home.stash.z - b.pos[2]) > 70;
  const to = far && Math.random() < 0.6 ? [home.stash.x + rand(-6, 6), home.stash.z + rand(-6, 6)] : somewhere(b, 25, 110);
  if (match.t > br.bikeAt && Math.hypot(to[0] - b.pos[0], to[1] - b.pos[2]) > 35) {
    let ride = null, rideD = 45;
    for (const k of bikes) { const d = Math.hypot(k.p[0] - b.pos[0], k.p[2] - b.pos[2]); if (!k.rider && d < rideD && !(player.ride && player.ride.b === k)) { rideD = d; ride = k; } }
    if (ride) { setState(b, 'bike'); br.bike = ride; br.dest = to; goTo(b, ride.p[0], ride.p[2]); br.bikeAt = match.t + rand(40, 100); return; }
  }
  goTo(b, to[0], to[1]);
}
// a friendly one who sees you comes over to say hello
function greetThink(b) {
  const br = b.br, dx = player.pos[0] - b.pos[0], dz = player.pos[2] - b.pos[2], d = Math.hypot(dx, dz);
  if (player.dead >= 0 || d > 22 || br.greet > 30 || crewSize() >= CREW_MAX || !canSee(b, player, d)) { if (d > 60) br.greet = 0; return false; }
  setState(b, 'roam'); br.greet += 0.4;
  if (d > 3) { if (!br.goal || Math.hypot(br.goal[0] - player.pos[0], br.goal[1] - player.pos[2]) > 3) goTo(b, player.pos[0] - dx / d * 2.2, player.pos[2] - dz / d * 2.2); }
  else { br.goal = br.path = null; b.yaw = Math.atan2(dx, dz); if (Math.random() < 0.04) playAt('huh', b.pos, 0.8, 20); }
  return true;
}
// one of yours: at your side, or holding the spot you left him on
function crewThink(b) {
  const br = b.br;
  setState(b, 'roam');
  if (br.guard) { if (br.post && !br.goal && Math.hypot(br.post[0] - b.pos[0], br.post[2] - b.pos[2]) > 1.5) goTo(b, br.post[0], br.post[2]); return; }
  const dx = player.pos[0] - b.pos[0], dz = player.pos[2] - b.pos[2], d = Math.hypot(dx, dz);
  if (d > 70 && b.away > 50 && !FLY.on && !inSea(player.pos)) {      // lost him: he catches you up, round the back
    const x = player.pos[0] - Math.sin(cam.yaw + Math.PI) * 14, z = player.pos[2] - Math.cos(cam.yaw + Math.PI) * 14;
    if (reachMap().has(x, z)) { b.pos = [x, walkHeight(x, z), z]; br.goal = br.path = null; return; }
  }
  if (d > 4.5) { const side = bots.indexOf(b) % 2 ? 1 : -1; if (!br.goal || Math.hypot(br.goal[0] - player.pos[0], br.goal[1] - player.pos[2]) > 4) goTo(b, player.pos[0] + side * 1.8, player.pos[2] + 1.2); }
  else br.goal = br.path = null;
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
  if (raid.builds.length && buildRay(V.add(b.pos, [0, 1.5, 0]), V.norm(V.sub(e.pos, b.pos)), d - 0.5).piece) { br.wait = 1; br.seen = -99; br.target = null; br.state = 'roam'; return; }
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

// ---------------------------------------------------------------- robbing a stash
const raidsOn = () => bots.reduce((n, b) => n + (b.br && b.br.raid && b.dead < 0 ? 1 : 0), 0);
const worthRobbing = s => !s.gone && (s.rocks > 0 || s.items.length > 0);
function startRaid(b, stash) {
  b.br.raid = { stash, phase: 'go', t: 0, p: 0, wall: null };
  b.br.goal = b.br.path = null;
  if (!b.c4 && Math.random() < 0.8) b.c4 = 1;
}
function pickRaid(b) {
  if (raidsOn() >= 5) return false;
  let best = null, bestD = 150;
  for (const s of raid.builds) {
    if (s.kind !== 'stash' || !worthRobbing(s) || !s.owner || sameSide(b, s.owner) || (s.owner.isPlayer && (!game.enemiesShoot || match.t < BR.grace * 2))) continue;
    const d = Math.hypot(s.x - b.pos[0], s.z - b.pos[2]) * rand(0.6, 1.5);
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best) return false;
  startRaid(b, best);
  const mate = b.br.buddy || bots.find(f => f !== b && f.br && b.br.squad && f.br.squad === b.br.squad && f.dead < 0 && !f.br.raid && Math.hypot(f.pos[0] - b.pos[0], f.pos[2] - b.pos[2]) < 15);
  if (mate && mate.dead < 0 && mate.br && !mate.br.raid && Math.random() < 0.7) { startRaid(mate, best); setState(mate, 'raid'); }
  return true;
}
function endRaid(b, got) {
  const br = b.br, home = homeOf(b);
  br.raid = null; handsFree(b); br.goal = br.path = null;
  if (got && home) { br.state = 'home'; goTo(b, home.stash.x, home.stash.z); }
  else br.state = br.cave ? 'camp' : 'roam';
  if (b.inv.length) equip(b, b.inv[0]);
}
// walk straight to a spot close by
function stepTo(b, x, z) { const br = b.br; if (!br.goal || Math.hypot(br.goal[0] - x, br.goal[1] - z) > 0.3) { br.goal = [x, z]; br.path = [[x, z]]; br.wp = 0; br.stuck = 0; br.stuckT = 0; br.from = [b.pos[0], b.pos[2]]; } }
const turnTo = (b, x, z, dt) => { b.yaw += wrap(Math.atan2(x - b.pos[0], z - b.pos[2]) - b.yaw) * Math.min(1, dt * 10); };
function raidMove(b, dt) {
  const br = b.br, R = br.raid, still = { x: 0, y: 0, sprint: false };
  if (!R) { br.state = 'roam'; return still; }
  const s = R.stash;
  R.t += dt;
  if (s.gone || R.t > 150 || !worthRobbing(s)) { endRaid(b, false); return still; }
  const d = Math.hypot(s.x - b.pos[0], s.z - b.pos[2]);
  if (R.phase === 'go') {
    if (d < 7 && Math.abs(s.y - b.pos[1]) < 2.5) {
      const from = V.add(b.pos, [0, 1, 0]), way = V.sub([s.x, s.y + 0.4, s.z], from), len = V.len(way) || 1, hit = buildRay(from, V.mul(way, 1 / len), len);
      if (hit.piece && (hit.piece.kind === 'wall' || hit.piece.kind === 'door') && !canPass(b, hit.piece)) { R.wall = hit.piece; R.phase = 'breach'; br.goal = br.path = null; return still; }
      if (d < 1.35) { R.phase = 'pry'; R.p = 0; br.goal = br.path = null; equip(b, null); return still; }
      stepTo(b, s.x, s.z);
      return walkTo(b, dt, false, 0.9);
    }
    if (!br.goal && !br.wants) goTo(b, s.x, s.z);
    return walkTo(b, dt, true, 1);
  }
  if (R.phase === 'breach') {
    const w = R.wall;
    if (!w || w.gone) { R.phase = 'go'; return still; }
    const side = buildLocal(w, b.pos[0], b.pos[2])[1] >= 0 ? 1 : -1, at = buildWorld(w, 0, 0, side * 0.72);
    if (Math.hypot(at[0] - b.pos[0], at[2] - b.pos[2]) < 0.45) {
      if (!b.c4) { endRaid(b, false); return still; }
      R.phase = 'plant'; R.p = 0; R.side = side; br.goal = br.path = null; equip(b, null);
      return still;
    }
    stepTo(b, at[0], at[2]);
    return walkTo(b, dt, true, 0.35);
  }
  if (R.phase === 'plant') {
    const w = R.wall;
    if (!w || w.gone) { R.phase = 'go'; return still; }
    turnTo(b, w.x, w.z, dt); b.crouch = true;
    if (Math.floor(R.p * 3) !== Math.floor((R.p += dt) * 3)) playAt('key', b.pos, 0.7, 18);
    if (R.p > 1.7) {
      const face = w.yaw + (R.side > 0 ? Math.PI : 0), p = buildWorld(w, 0, 0.8, R.side * 0.2);
      planted.push({ p, R: M3.mul(M3.ry(face), M3.rx(-Math.PI / 2)), t: 0, owner: b, armed: true });
      b.c4--; b.crouch = false; playAt('armed', b.pos, 0.9, 30); raidAlarm(w, b);
      R.phase = 'back'; R.p = 0; R.spot = [b.pos[0] - Math.sin(b.yaw) * 9, b.pos[2] - Math.cos(b.yaw) * 9];
      br.goal = br.path = null;
    }
    return still;
  }
  if (R.phase === 'back') {                                    // get well clear, and wait for the bang
    R.p += dt;
    if (R.p > C4_FUSE + 0.8) { R.phase = 'go'; br.goal = br.path = null; return still; }
    stepTo(b, R.spot[0], R.spot[1]);
    const move = walkTo(b, dt, true, 0.8);
    if (!br.goal) { br.goal = R.spot.slice(); br.path = null; turnTo(b, s.x, s.z, dt); }
    return move;
  }
  // prying it open
  if (d > 1.8) { R.phase = 'go'; return still; }
  turnTo(b, s.x, s.z, dt); b.crouch = true;
  const before = R.p; R.p += dt;
  if (Math.floor(before / 0.55) !== Math.floor(R.p / 0.55)) { playAt('knock', b.pos, 0.8, 24); raidAlarm(s, b); }
  if (R.p > 3.2) {
    s.broken = true; playAt('chestopen', b.pos, 0.8, 25);
    b.rocks = addRocks(b.rocks, s.rocks); s.rocks = 0;
    for (let k = s.items.length - 1; k >= 0; k--) {
      const it = s.items[k];
      if (it.t !== 'hammer' && wantsLoot(b, it)) { s.items.splice(k, 1); botTake(b, it, true); }
    }
    if (s.owner && !s.owner.isPlayer && s.owner.br) { s.owner.br.grudge = b; s.owner.br.grudgeT = game.time + 120; }
    endRaid(b, true);
  }
  return still;
}
// home with the takings
function homeMove(b, dt) {
  const br = b.br, home = homeOf(b), still = { x: 0, y: 0, sprint: false };
  if (!home) { br.state = 'roam'; br.goal = br.path = null; return still; }
  const s = home.stash;
  if (Math.hypot(s.x - b.pos[0], s.z - b.pos[2]) < 1.5) {
    s.rocks = addRocks(s.rocks, b.rocks); b.rocks = 0; s.broken = false;
    if (b.inv.length > 1 && s.items.length < STASH_SLOTS) { const id = b.inv.pop(), am = b.ammo[id]; s.items.push(gunItem(id, am.rarity, am.clip, am.spare, am.att)); delete b.ammo[id]; if (b.weapon === id) b.weapon = null; }
    br.state = br.cave ? 'camp' : 'roam'; br.goal = br.path = null;
    return still;
  }
  if (!br.goal && !br.wants) goTo(b, s.x, s.z);
  return walkTo(b, dt, true, 1.1);
}
// putting a fort up, one piece at a time
function buildMove(b, dt) {
  const br = b.br, P = br.plan, still = { x: 0, y: 0, sprint: false };
  const stop = () => { br.plan = null; handsFree(b); br.state = 'roam'; br.goal = br.path = null; if (b.inv.length) equip(b, b.inv[0]); return still; };
  if (!P) return stop();
  const fort = P.fort, d = Math.hypot(fort.x - b.pos[0], fort.z - b.pos[2]);
  if (P.next === 0 && d > 0.9) { if (!br.goal && !br.wants) goTo(b, fort.x, fort.z); if (br.stuck > 3) return stop(); return walkTo(b, dt, true, 0.7); }
  const piece = fort.list[P.next];
  if (b.weapon) equip(b, null);
  turnTo(b, piece.x, piece.z, dt);
  const k = (P.t % 1.5) / 1.5, before = P.t; P.t += dt;
  const up = flow([[0, 0], [0.35, -0.8], [0.6, 1], [1, 0]], k), p = [-0.25, 1.02 + 0.1 * Math.max(0, -up), 0.3 + 0.12 * Math.max(0, up)];
  b.carry = foodGoal(p); b.thing = { kind: 'hammer', p, R: M3.mul(M3.rx(0.35 + up), M3.ry(0.15)) };
  if (Math.floor((before + 0.6) / 1.5) !== Math.floor((P.t + 0.6) / 1.5)) {
    if (placeBlock(piece) === 'Somebody is standing there' && P.t < 25) return still;
    piece.born = game.time; addPiece(piece); buildSound(piece); puffAt([piece.x, piece.y, piece.z], 8);
    b.rocks = Math.max(0, b.rocks - PIECES[piece.kind].cost);
    if (++P.next >= fort.list.length) {
      br.home = fort; br.squad = br.squad || 200 + bots.indexOf(b);
      if (br.buddy && br.buddy.br) { br.buddy.br.home = fort; br.buddy.br.squad = br.squad; }
      fort.stash.rocks = b.rocks; b.rocks = 0;
      return stop();
    }
  }
  return still;
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
  } else if (br.state === 'raid') move = raidMove(b, dt);
  else if (br.state === 'home') move = homeMove(b, dt);
  else if (br.state === 'build') move = buildMove(b, dt);
  else if (br.state === 'bike') {
    const k = br.bike;
    if (!k || (k.rider && k.rider !== b) || (player.ride && player.ride.b === k)) { br.bike = null; br.state = 'roam'; br.goal = br.path = null; }
    else if (Math.hypot(k.p[0] - b.pos[0], k.p[2] - b.pos[2]) < 1.3) { mount(b, k); goTo(b, br.dest[0], br.dest[1]); }
    else { move = walkTo(b, dt, true, 1); if (!br.goal && !br.wants) goTo(b, k.p[0], k.p[2]); if (br.stuck > 3) { br.bike = null; br.state = 'roam'; br.goal = br.path = null; } }
  } else move = walkTo(b, dt, br.crew ? Math.hypot(player.pos[0] - b.pos[0], player.pos[2] - b.pos[2]) > 8 : br.state === 'roam' && br.skill > 0.45);
  // guns away when walking about is nothing to worry about; out when something is
  if (!b.use && !b.onBike && br.state !== 'brawl' && br.state !== 'build' && !(br.raid && (br.raid.phase === 'plant' || br.raid.phase === 'pry')) && br.busy <= 0 && !b.weapon && b.inv.length) equip(b, b.inv[0]);
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
      const way = V.norm([p[0] - b.pos[0], 0, p[1] - b.pos[2]]), hit = raid.builds.length && br.path && buildRay(V.add(b.pos, [0, 1, 0]), way, 1.6).piece;
      if (hit) {                                                // a wall in the way: round the end of it
        const side = buildLocal(hit, b.pos[0], b.pos[2])[1] >= 0 ? 1 : -1, hw = PIECES[hit.kind].hw * hit.sx + 0.8;
        const ends = [-1, 1].map(e => buildWorld(hit, e * hw, 0, side * 0.8)).sort((m, n) => Math.hypot(m[0] - p[0], m[2] - p[1]) - Math.hypot(n[0] - p[0], n[2] - p[1]));
        const e = ends[br.stuck > 2 ? 1 : 0];
        br.path.splice(br.wp, 0, [e[0], e[2]]);
      }
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
  pathsStep();
  for (const b of bots) {
    const br = b.br;
    if (!br) continue;
    if (b.dead >= 0) {
      if (b.gone) {                                            // some time later he turns up again
        if (br.respawnAt === null) br.respawnAt = match.t + rand(45, 110);
        else if (match.t > br.respawnAt && !b.send) comeBack(b);
        continue;
      }
      const before = b.dead; b.dead += dt; deathCues(b, before);
      if (b.send) locomotion(b, 0, 0, false, dt);
      // same as ever: once looted the balloon man comes for him; left lying, the bomb man does
      else if (!b.beingLooted && b.dead >= (b.looted ? 1.6 : LOOT_WINDOW)) {
        spillPockets(b);
        if (b.yours || Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]) < BR.watch) startSend(b, 0, !b.looted);
        else b.gone = true;                                    // nobody there to see it
      }
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
  raidersStep(dt);
  if ((match.tidy -= dt) <= 0) { match.tidy = 20; tidyStep(); }
}
function comeBack(b) {
  const br = b.br, home = br.home && br.home.stash && !br.home.stash.gone ? br.home : null;
  let x, z, y;
  if (home && Math.hypot(home.stash.x - player.pos[0], home.stash.z - player.pos[2]) > 50) {
    if (home.cave) { const s = CAVE.length + CAVE.room - 1.4 + rand(-1.4, 1.2); x = home.cave.x + caveShift(home.cave, s) + rand(-2, 2); z = home.cave.z - s; y = caveFloorAt(s, home.cave); }
    else { x = home.inside[0]; z = home.inside[1]; }
  } else if (home) { br.respawnAt = match.t + 20; return; }
  else { const s = landSpot(player.pos, null, 100); x = s[0]; z = s[1]; }
  const keep = { squad: br.squad, cave: home ? br.cave : null, home, friendly: br.friendly, state: br.cave && home ? 'camp' : 'roam' };
  putBot(b, x, z, y, keep);
  botGear(b, !!keep.cave);
}
// somebody is sent after what you have stashed away
function raidersStep(dt) {
  const mine = raid.builds.filter(s => s.kind === 'stash' && s.owner === player && worthRobbing(s));
  if (!mine.length || !game.enemiesShoot || player.dead >= 0) { raid.nextRaid = Math.max(raid.nextRaid, 60); return; }
  if ((raid.nextRaid -= dt) > 0) return;
  const s = mine[Math.floor(Math.random() * mine.length)];
  const free = b => b.dead < 0 && b.br && !b.br.friendly && !b.br.crew && !b.br.raid && !b.br.cave && !b.br.target && !b.onBike;
  const near = bots.filter(free).map(b => ({ b, d: Math.hypot(b.pos[0] - s.x, b.pos[2] - s.z) })).sort((m, n) => m.d - n.d);
  const party = near.filter(q => q.d > 40).slice(0, Math.random() < 0.4 ? 2 : 1);
  for (const { b, d } of party) {
    if (d > 110) {                                             // too far to walk: he is already on his way
      for (let k = 0; k < 30; k++) {
        const a = rand(0, 6.28), x = s.x + Math.sin(a) * rand(55, 80), z = s.z + Math.cos(a) * rand(55, 80);
        if (!reachMap().has(x, z) || pastCoast(x, z) > -8 || Math.hypot(x - player.pos[0], z - player.pos[2]) < 45) continue;
        b.pos = [x, walkHeight(x, z), z]; break;
      }
    }
    if (!armed(b)) botTake(b, gunItem(Math.random() < 0.5 ? 'glock' : 'mp5', Math.random() < 0.3 ? 1 : 0, 30, 90), true);
    startRaid(b, s); b.c4 = Math.max(b.c4, 1); setState(b, 'raid');
  }
  raid.nextRaid = rand(110, 240);
}
// out of your sight, they mend what was broken and their stashes slowly fill again
function tidyStep() {
  const away = (x, z) => Math.hypot(x - player.pos[0], z - player.pos[2]) > 75;
  const done = new Set();
  for (const b of bots) {
    const br = b.br, home = br && b.dead < 0 && br.home;
    if (!home || done.has(home)) continue;
    done.add(home);
    const s = home.stash;
    if (!away(s.x, s.z)) continue;
    if (s.gone) { br.home = null; continue; }
    s.broken = false;
    s.rocks = Math.min(900, s.rocks + Math.floor(rand(2, 14)));
    if (s.items.length < 2 && Math.random() < 0.1) { const id = rollGun(), r = rollRarity(); s.items.push(gunItem(id, r, GUNS[id].mag, GUNS[id].mag * 3, randomAtt(id, r, 0.25))); }
    const hole = (home.cave ? [home.door] : home.list).find(p => p.gone && p.kind !== 'stash');
    if (hole && Math.random() < 0.35) { hole.gone = false; hole.open = 0; hole.openV = 0; addPiece(hole); }
  }
}

// ---------------------------------------------------------------- being hurt and going out
function royaleHurt(b, from) {
  const br = b.br;
  if (!br) return;
  if (from.isPlayer) {
    b.hitByYou = game.time; match.foe = b; match.foeT = game.time;
    if (br.friendly || br.crew) { br.friendly = false; br.crew = false; br.squad = 0; hudDirty = true; }       // so much for that
    br.grudge = player; br.grudgeT = game.time + 90;
  }
  if (b.onBike) { dismount(b, true); br.state = 'roam'; br.goal = br.path = null; }
  if (br.state === 'loot') { leaveLoot(b); br.state = 'roam'; br.goal = br.path = null; }
  if (br.state === 'raid' || br.state === 'build' || br.state === 'home') handsFree(b);
  const who = from.br ? bots.find(f => f.br === from.br) || null : from.isPlayer && game.enemiesShoot ? player : null;
  if (who && who !== b && !allies(b, who)) {
    if (br.target !== who) br.react = 0.25 + (1 - br.skill) * 0.5;
    br.target = who; br.seen = game.time; br.lastSeen = [who.pos[0], who.pos[2]]; br.think = Math.min(br.think, 0.1);
    if (br.state !== 'fight') { br.goal = br.path = null; b.use = null; b.carry = null; b.thing = null; b.headTilt = null; br.state = armed(b) ? 'fight' : 'flee'; }
  }
}
// somebody hit you: your crew goes for him
function playerHurt(from) {
  if (match && from && from.br) { match.foe = from; match.foeT = game.time; }
}
function royaleDeath(b) {
  const br = b.br;
  dismount(b, true); leaveLoot(b);
  b.use = null; b.carry = null; b.thing = null; b.headTilt = null; b.script = null; b.scriptW = 0;
  br.raid = null; br.plan = null; br.crew = false; br.respawnAt = null; br.target = null;
  const d = Math.hypot(b.pos[0] - player.pos[0], b.pos[2] - player.pos[2]);
  b.yours = game.time - b.hitByYou < 4;                        // your knockouts stay, however far off
  if (d > BR.watch && !b.yours) { b.gone = true; spillPockets(b); }   // too far to see: just his things on the ground
  else {
    match.bodies = match.bodies.filter(f => !f.gone && f.dead >= 0 && bots.includes(f));
    match.bodies.push(b);
    while (match.bodies.length > BR.bodies) {                  // too many lying about: somebody else's goes first
      const k = Math.max(0, match.bodies.findIndex(f => !f.yours));
      const old = match.bodies.splice(k, 1)[0];
      if (!old.beingLooted && !old.send) { old.gone = true; spillPockets(old); }
    }
    if (!b.inv.length && !b.rocks) spillPockets(b);
  }
  hudDirty = true;
}

// ---------------------------------------------------------------- hearing and seeing them
// a shot: those within earshot turn their heads. a silencer keeps it to a few strides
function hearShot(f) {
  const reachOut = silenced(f) ? 12 : 55;
  for (const b of bots) if (b !== f && b.dead < 0 && b.br && !b.br.target && !b.br.cave && !b.br.crew && Math.abs(b.pos[0] - f.pos[0]) < reachOut && Math.abs(b.pos[2] - f.pos[2]) < reachOut) b.br.heard = [f.pos[0], f.pos[2]];
}
// somebody else's gun: loud close by, a dull thud a long way off
function gunHeard(f, g) {
  const hush = royaleOn() && silenced(f), quiet = game.time - (f.shotAt || -99) < 0.5;
  if (!hush) f.shotAt = game.time;
  const d = Math.hypot(f.pos[0] - player.pos[0], f.pos[2] - player.pos[2]);
  if (!royaleOn()) { playAt(g.sound, f.pos, 1, 90); return; }
  if (hush) { playAt('silenced', f.pos, 0.8, 30); hearShot(f); return; }
  if (d < 200 && (d < 35 || game.time - match.gunAt > 0.07)) {
    match.gunAt = game.time;
    playAt(g.sound, f.pos, d < 60 ? 1 : 0.8, 220);
  }
  if (!quiet) hearShot(f);
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
    // flying off: he is nowhere near where he fell, so always pose and draw him
    if (b.send) { b.away = 0; b.vis = true; poseFighter(b); continue; }
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
