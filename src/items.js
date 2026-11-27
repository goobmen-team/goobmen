// ======================================================================= items: rarity, the four slots, food and plates
// You carry four things (fists are free). Guns come in rarities, the better the colour the harder they hit, and one
// in two hundred is exotic: one hit and he is out, vest or no vest. Chests can also hold food (that is how you
// heal), ammo, vest plates or a vest.
const SLOT_COUNT = 4, STACK = 3;
const EXOTIC = 5;
const RARITY = [
  { name: 'Common', css: '#aeb4bb', col: [0.45, 0.47, 0.50], mult: 1.0, share: 0.40 },
  { name: 'Uncommon', css: '#46cf52', col: [0.06, 0.75, 0.10], mult: 1.12, share: 0.28 },
  { name: 'Rare', css: '#3d9bff', col: [0.05, 0.35, 1.0], mult: 1.25, share: 0.18 },
  { name: 'Epic', css: '#b45cff', col: [0.52, 0.10, 1.0], mult: 1.38, share: 0.095 },
  { name: 'Legendary', css: '#ffb81f', col: [1.0, 0.62, 0.02], mult: 1.55, share: 0.04 },
  { name: 'Exotic', css: '#2ff5e4', col: [0.05, 1.0, 0.85], mult: 1.55, share: 0.005 }   // 0.5%: one shot
];
function rollRarity() {
  let r = Math.random();
  if ((r -= RARITY[EXOTIC].share) < 0) return EXOTIC;
  for (let k = 0; k < EXOTIC; k++) if ((r -= RARITY[k].share) < 0) return k;
  return 0;
}
const FOOD = { fish: { name: 'Fish', heal: 35 }, meat: { name: 'Meat stick', heal: 60 } };
const GUN_ODDS = [['glock', 0.25], ['mp5', 0.18], ['ak', 0.19], ['shotgun', 0.13], ['p90', 0.12], ['awp', 0.09], ['mgl', 0.04]];
function rollGun() { let r = Math.random(); for (const [id, share] of GUN_ODDS) if ((r -= share) < 0) return id; return 'glock'; }
const gunItem = (id, rarity, clip, spare, att) => ({ t: 'gun', id, rarity: rarity || 0, clip: clip === undefined ? GUNS[id].mag : clip, spare: spare === undefined ? GUNS[id].mag * 2 : spare, att });
// what is in one chest: a gun is likely, never certain
function rollLoot() {
  if (royaleOn()) {                                            // on the island there is also something to build with and to carry it in
    const k = Math.random();
    if (k < 0.07) return { t: 'hammer' };
    if (k < 0.11) return { t: 'bag' };
    if (k < 0.18) return { t: 'c4' };
    if (k < 0.30) return { t: 'rocks', n: 10 + Math.floor(Math.random() * 50) };
  }
  const r = Math.random();
  if (r < 0.46) return gunItem(rollGun(), rollRarity());
  if (r < 0.575) return { t: 'fish' };
  if (r < 0.68) return { t: 'meat' };
  if (r < 0.80) return { t: 'ammo' };
  if (r < 0.91) return { t: 'plate' };
  return { t: 'vest' };
}
function lootName(it) {
  if (it.t === 'gun') return RARITY[it.rarity].name + ' ' + GUNS[it.id].name;
  const n = it.n > 1 ? ' ×' + it.n : '';
  if (it.t === 'rocks') return it.n + ' shiny rocks';
  return (it.t === 'vest' ? 'bulletproof vest' : it.t === 'ammo' ? 'ammo box' : it.t === 'plate' ? 'vest plate' : it.t === 'c4' ? 'C4' : it.t === 'hammer' ? 'stone hammer' : it.t === 'bag' ? 'black duffel bag' : FOOD[it.t].name.toLowerCase()) + n;
}
const rarityOf = (f, id) => (f.ammo[id] && f.ammo[id].rarity) || 0;

// ---------------------------------------------------------------- the four slots (yours; the others keep it simpler)
const emptySlots = () => new Array(SLOT_COUNT).fill(null);
const findSlot = (f, t, id) => f.slots.findIndex(s => s && s.t === t && (id === undefined || s.id === id));
function syncInv(f) { f.inv = f.slots.filter(s => s && s.t === 'gun').map(s => s.id); }
function heldSlot(f) {
  if (f.weapon) return findSlot(f, 'gun', f.weapon);
  if (f.holdC4) return findSlot(f, 'c4');
  return f.hand ? findSlot(f, f.hand) : -1;
}
function addAmmo(f, id, n) { f.ammo[id].spare = Math.min(GUNS[id].reserve * 3, f.ammo[id].spare + n); }
// the C4 slot comes and goes with how many you have
function syncC4(f) {
  const k = findSlot(f, 'c4');
  if (f.c4 > 0 && k < 0) { const free = f.slots.indexOf(null); if (free >= 0) f.slots[free] = { t: 'c4' }; else f.c4 = 0; }
  if (!(f.c4 > 0) && k >= 0) { f.slots[k] = null; f.holdC4 = false; }
  hudDirty = true;
}
// put something in a pocket. swap: with no room, what is in your hand goes on the floor. false if it would not fit
function takeItem(f, it, swap) {
  hudDirty = true;
  if (it.t === 'rocks') {                                      // shiny rocks go in their own pouch, up to ROCK_MAX
    const room = ROCK_MAX - (f.rocks || 0);
    if (room <= 0) return false;
    f.rocks = addRocks(f.rocks || 0, it.n || 1);
    if ((it.n || 1) > room) dropLoot({ t: 'rocks', n: it.n - room }, f.pos, 0.5);
    return true;
  }
  if (it.t === 'bag') return putOnBag(f);
  if (it.t === 'hammer' && findSlot(f, 'hammer') >= 0) return false;
  if (it.t === 'vest') { f.vest = VEST; f.hasVest = true; if (f.isPlayer) f.wearing = { t: 0, started: false }; return true; }
  if (it.t === 'ammo') {
    if (!f.inv.length) f.bank = (f.bank || 0) + 1;             // saved for the next gun you get
    else for (const id of f.inv) addAmmo(f, id, GUNS[id].mag * 2);
    return true;
  }
  if (it.t === 'gun' && findSlot(f, 'gun', it.id) >= 0) {      // one of each: keep the better colour, pocket the bullets
    const am = f.ammo[it.id];
    if (it.rarity > (am.rarity || 0)) am.rarity = it.rarity;
    if (it.att) am.att = Object.assign({}, it.att, am.att);
    addAmmo(f, it.id, it.clip + it.spare);
    return true;
  }
  if (it.t === 'c4' && findSlot(f, 'c4') >= 0) {
    if (f.c4 >= C4_MAX) return false;
    f.c4 = Math.min(C4_MAX, f.c4 + (it.n || 1)); return true;
  }
  if (FOOD[it.t] || it.t === 'plate') {
    const s = f.slots.find(q => q && q.t === it.t && q.n < STACK);
    if (s) { const n = Math.min(STACK - s.n, it.n || 1); s.n += n; if ((it.n || 1) > n) dropLoot(Object.assign({}, it, { n: it.n - n }), f.pos, 0.6); return true; }
  }
  let k = f.slots.indexOf(null);
  if (k < 0) {
    if (!swap) return false;
    k = heldSlot(f);
    if (k < 0) return false;
    dropSlot(f, k);
  }
  if (it.t === 'gun') {
    f.slots[k] = { t: 'gun', id: it.id };
    f.ammo[it.id] = { clip: it.clip, spare: it.spare, rarity: it.rarity, att: it.att };
    syncInv(f);
    if (f.bank) { addAmmo(f, it.id, GUNS[it.id].mag * 2 * f.bank); f.bank = 0; }
  } else if (it.t === 'c4') { f.slots[k] = { t: 'c4' }; f.c4 = Math.min(C4_MAX, it.n || 1); }
  else f.slots[k] = { t: it.t, n: Math.min(STACK, it.n || 1) };
  return true;
}
// what is in slot k, as a thing that can lie on the floor; the slot is emptied
function emptySlot(f, k) {
  const s = f.slots[k];
  if (!s) return null;
  let it;
  if (s.t === 'gun') { const am = f.ammo[s.id]; it = gunItem(s.id, am.rarity, am.clip, am.spare, am.att); }
  else if (s.t === 'c4') it = { t: 'c4', n: f.c4 };
  else it = { t: s.t, n: s.n };
  const held = heldSlot(f) === k;
  f.slots[k] = null;
  if (s.t === 'gun') { delete f.ammo[s.id]; syncInv(f); }
  if (s.t === 'c4') f.c4 = 0;
  if (held) { f.weapon = null; f.reload = -1; f.cycle = -1; f.inspect = -1; f.holdC4 = false; f.hand = null; f.use = null; f.equip = 1; }
  hudDirty = true;
  return it;
}
function dropSlot(f, k) {
  const it = emptySlot(f, k);
  if (it) dropLoot(it, V.add(f.pos, [Math.sin(f.yaw) * 0.9, 0, Math.cos(f.yaw) * 0.9]), 0.25);
}
function fists(f) { equip(f, null); f.holdC4 = false; f.hand = null; f.use = null; hudDirty = true; }
function selectSlot(f, k) {
  const s = f.slots[k];
  if (!s) { fists(f); return; }
  if (s.t === 'gun') { f.hand = null; f.use = null; f.holdC4 = false; equip(f, s.id); }
  else if (s.t === 'c4') { f.hand = null; f.use = null; holdC4(f); }
  else if (f.hand !== s.t) { fists(f); f.hand = s.t; Sound.play(s.t === 'plate' ? 'plateout' : 'rustle', 0.6); }
  hudDirty = true;
}
// what you set out with: nothing
function freshPockets(f) {
  f.slots = emptySlots(); f.inv = []; f.ammo = {}; f.weapon = null; f.hand = null; f.use = null; f.holdC4 = false; f.bank = 0; f.c4 = 0; f.vest = 0; f.hasVest = false; f.hasBag = false; f.rocks = 0;
  hudDirty = true;
}

// ---------------------------------------------------------------- what the things look like
const plateShape = (() => {
  const body = [boxData(0.24, 0.26, 0.032, 0, -0.025, 0), boxData(0.17, 0.05, 0.032, 0, 0.13, 0)];
  const rim = [boxData(0.014, 0.27, 0.046, -0.12, -0.025, 0), boxData(0.014, 0.27, 0.046, 0.12, -0.025, 0), boxData(0.25, 0.014, 0.046, 0, -0.16, 0), boxData(0.18, 0.014, 0.046, 0, 0.157, 0)];
  for (const s of [-1, 1]) rim.push(boxData(0.052, 0.014, 0.046, s * 0.104, 0.108, 0));
  const strap = [boxData(0.252, 0.034, 0.04, 0, -0.085, 0), boxData(0.252, 0.012, 0.04, 0, -0.035, 0)];
  // a bone stamped on the front
  const mark = [boxData(0.10, 0.022, 0.01, 0, 0.05, 0.019)];
  for (const x of [-0.052, 0.052]) for (const y of [0.037, 0.063]) mark.push(boxData(0.024, 0.024, 0.01, x, y, 0.019));
  return [
    { mesh: mergeMesh(body), color: [0.055, 0.085, 0.07], rough: 0.45, metal: 0.55 },
    { mesh: mergeMesh(rim), color: [0.20, 0.22, 0.22], rough: 0.32, metal: 0.8 },
    { mesh: mergeMesh(strap), color: [0.012, 0.012, 0.012], rough: 0.8, metal: 0 },
    { mesh: mergeMesh(mark), color: [0.80, 0.72, 0.50], rough: 0.5, metal: 0.1 }];
})();
const ammoShape = (() => {
  const brass = [], tips = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = -0.066 + i * 0.044, z = -0.025 + j * 0.05;
    brass.push(boxData(0.024, 0.07, 0.024, x, 0.095, z));
    tips.push(boxData(0.016, 0.028, 0.016, x, 0.143, z));
  }
  return [
    { mesh: mergeMesh([boxData(0.22, 0.12, 0.13, 0, 0, 0)]), color: [0.08, 0.12, 0.035], rough: 0.55, metal: 0.35 },
    { mesh: mergeMesh([boxData(0.232, 0.022, 0.142, 0, 0.058, 0), boxData(0.232, 0.016, 0.142, 0, -0.058, 0), boxData(0.04, 0.05, 0.01, 0, 0.025, 0.069)]), color: [0.03, 0.045, 0.015], rough: 0.45, metal: 0.6 },
    { mesh: mergeMesh([boxData(0.15, 0.028, 0.006, 0, -0.012, 0.066), boxData(0.15, 0.028, 0.006, 0, -0.012, -0.066)]), color: [0.95, 0.70, 0.03], rough: 0.5, metal: 0.1 },
    { mesh: mergeMesh(brass), color: [0.78, 0.55, 0.14], rough: 0.25, metal: 1 },
    { mesh: mergeMesh(tips), color: [0.55, 0.24, 0.10], rough: 0.3, metal: 1 }];
})();
// the model of a fish, meat, plate or vest. mode 0: lying on the ground, its origin at the middle of its underside.
// mode 1: lying, but turned about its own middle (for tumbling). mode 2: held, the way up it is carried, turned about its own middle
function drawLoot(prog, kind, R, p, mode) {
  const m = LOOT[kind];
  if (!m) return;
  if (prog.u.uHasTex) {
    gl.uniform1i(prog.u.uHasTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, m.orm);
  }
  if (mode === 2) R = M3.mul(R, LOOT_PRE[kind]);
  if (mode) p = V.sub(p, M3.vec(R, [0, m.size[1] / 2, 0]));
  drawMesh(prog, m.parts.body, R, p);
}
// kind: fish, meat, plate, ammo, vest, c4. R may already be scaled; held things turn about their middle
function drawThing(prog, kind, R, p) {
  if (RAID_THINGS[kind]) drawRaidThing(prog, kind, R, p);
  else if (kind === 'ammo') { for (const part of ammoShape) { flat(prog, part.color, part.rough, part.metal); drawMesh(prog, part.mesh, R, p); } }
  else if (kind === 'c4') drawC4(prog, p, R, false, 0);
  else drawLoot(prog, kind, R, p, 2);
}

// ---------------------------------------------------------------- things lying about for the taking
const floorLoot = [];
const pickFlyers = [];                                         // things on their way from the floor to him
function dropLoot(item, at, spread, still) {
  const s = spread === undefined ? 0.5 : spread;
  let x = at[0] + rand(-s, s), z = at[2] + rand(-s, s);
  if (world.map === 'island') { const q = { pos: [x, at[1], z], isPlayer: true }; confine(q); x = q.pos[0]; z = q.pos[2]; }
  const o = { item, p: [x, floorAt(x, z, at[1] + 0.6), z], a: rand(0, 6.3), rest: true };
  if (!still) {                                                // it is dropped from about his hands and falls, bounces and settles
    const a = rand(0, 6.3), sp = rand(0.4, 1.6);
    Object.assign(o, { rest: false, p: [x, Math.max(o.p[1] + 0.4, at[1] + 0.9), z], v: [Math.cos(a) * sp, rand(1.2, 2.6), Math.sin(a) * sp], axis: V.norm([rand(-1, 1), rand(-1, 1), rand(-1, 1)]), spin: rand(5, 11), R: M3.ry(rand(0, 6.3)) });
  }
  if (overSea(x, z)) {                                         // dropped in the sea: it floats or sinks
    if (still) { if (FLOATS[item.t]) Object.assign(o, { rest: false, water: 'float', v: [0, 0, 0], R: lootRestR(o), spin: 0, axis: [0, 1, 0], p: [x, SEA.level + 0.02, z] }); else o.p = [x, groundAt(x, z), z]; }
  }
  floorLoot.push(o);
  while (floorLoot.length > 320) floorLoot.shift();
}
// the way each thing lies when it has come to rest
const lootRestR = o => o.item.t === 'gun' ? M3.mul(M3.ry(o.a), M3.rz(Math.PI / 2)) : M3.ry(o.a);
// what floats in the sea and what sinks (wood, food, cloth float; metal and stone go to the bottom)
const FLOATS = { fish: 1, meat: 1, hammer: 1, bag: 1, vest: 1 };
const overSea = (x, z) => world.map === 'island' && groundAt(x, z) < SEA.level;
function enterWater(o, vy, d) {
  o.water = FLOATS[o.item.t] ? 'float' : 'sink';
  o.v = [o.v[0] * 0.35, o.v[1] * 0.2, o.v[2] * 0.35];
  puff([o.p[0], SEA.level + 0.04, o.p[2]], Math.round(clamp(vy * 1.5, 3, 9)), [0.9, 0.96, 1, 0.75], 0.8 + vy * 0.15, 0.04, 0.45, 5);
  if (d < 28) Sound.play('splash', clamp(vy / 7, 0.12, 0.5) * (1 - d / 28));
}
function waterLoot(o, dt) {
  const k = Math.min(1, dt * 3);
  o.spin *= Math.max(0, 1 - 2.5 * dt);
  o.R = M3.mul(M3.axis(o.axis, o.spin * dt), o.R);
  o.v[0] *= 1 - Math.min(1, 3 * dt); o.v[2] *= 1 - Math.min(1, 3 * dt);
  if (o.water === 'float') {                                   // bobs on the top
    const top = SEA.level + 0.02 + 0.012 * Math.sin(game.time * 2.2 + o.a);
    o.v[1] += ((top - o.p[1]) * 70 - o.v[1] * 7) * dt;
    o.p = V.mad(o.p, o.v, dt);
    o.R = M3.mix(o.R, lootRestR(o), k * 0.7);
  } else {                                                     // sinks slowly, turning flat, and settles on the bottom
    o.v[1] = Math.max(o.v[1] - 3.2 * dt, -0.85);
    o.p = V.mad(o.p, o.v, dt);
    o.R = M3.mix(o.R, lootRestR(o), k * 0.5);
    const bed = groundAt(o.p[0], o.p[2]);
    if (o.p[1] <= bed) { o.p[1] = bed; o.v = [0, 0, 0]; o.water = null; o.settle = 0; }
  }
}
function lootPhysics(dt) {
  for (const o of floorLoot) {
    if (o.water && !overSea(o.p[0], o.p[2])) { o.water = null; o.v = [o.v[0], 0, o.v[2]]; }       // drifted onto the beach
    if (o.water) { waterLoot(o, dt); continue; }
    if (o.rest) continue;
    if (o.settle !== undefined) {                              // lands, then eases onto the side it rests on
      o.settle += dt;
      o.R = M3.mix(o.R, lootRestR(o), Math.min(1, dt * 16));
      if (o.settle > 0.3) { o.rest = true; o.settle = undefined; }
      continue;
    }
    o.v[1] -= 9.8 * dt; o.p = V.mad(o.p, o.v, dt);
    o.R = M3.mul(M3.axis(o.axis, o.spin * dt), o.R);
    if (o.p[1] <= SEA.level && o.v[1] < 0 && overSea(o.p[0], o.p[2])) { enterWater(o, -o.v[1], Math.hypot(o.p[0] - player.pos[0], o.p[2] - player.pos[2])); continue; }
    const ground = floorAt(o.p[0], o.p[2], o.p[1] + 0.4);
    if (o.p[1] <= ground && o.v[1] < 0) {
      o.p[1] = ground;
      const vy = -o.v[1], d = Math.hypot(o.p[0] - player.pos[0], o.p[2] - player.pos[2]);
      if (vy > 1.3) { o.v = [o.v[0] * 0.5, vy * 0.3, o.v[2] * 0.5]; o.spin *= 0.55; if (d < 25) Sound.play('click', 0.35 * (1 - d / 25)); }
      else { o.v = [0, 0, 0]; o.settle = 0; if (d < 25) Sound.play('thud', 0.12 * (1 - d / 25)); }
    }
  }
}
function lootNear(p, reachOut) {
  let best = null, bestD = reachOut || 1.4;
  for (const o of floorLoot) {
    if (Math.abs(o.p[1] - p[1]) > 1.6) continue;
    const d = Math.hypot(o.p[0] - p[0], o.p[2] - p[2]);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}
const LOOT_SEEN = 45;                                          // metres
const lootSeen = o => Math.abs(o.p[0] - player.pos[0]) < LOOT_SEEN && Math.abs(o.p[2] - player.pos[2]) < LOOT_SEEN;
function drawFloorLoot(prog, textured) {
  for (const f of fighters) {                                  // food, plates and vests he is about to pick up still lie where they were
    const q = f.pickIt || f.pickNext;
    if (q && q.kind && !(f.pickIt && f.pickIt.t >= PICKIT.grab)) {
      const R = M3.mul(M3.ry(q.a), M3.rz(0.1 * Math.sin((q.t || 0) * 30) * (f.pickIt && q.t > PICKIT.reach && q.t < PICKIT.poke ? 1 : 0)));
      if (q.kind === 'ammo') drawThing(prog, 'ammo', R, V.add(q.floorP, [0, 0.06, 0]));
      else if (q.kind === 'c4') drawC4(prog, V.add(q.floorP, [0, 0.02, 0]), R, false, 0);
      else drawLoot(prog, q.kind, R, q.floorP, 0);
    }
  }
  for (const f of fighters) if (f.pickNext && !f.pickNext.kind) {                  // the gun he is about to pick up still lies where it was
    const st = f.pickNext, g = GUNS[st.id], spin = M3.ry(st.a), lift = 0.04 * Math.sin(game.time * 2.2);
    drawGun(prog, textured, g, spin.map(x => x * g.scale), V.add(st.floorP, V.add([0, 0.30 + lift, 0], M3.vec(spin, [0, 0, -0.18 * g.scale]))), { att: st.att });
  }
  for (let i = pickFlyers.length - 1; i >= 0; i--) {
    const q = pickFlyers[i], u = clamp((game.time - q.t0) / 0.30, 0, 2);
    if (u >= 1) { pickFlyers.splice(i, 1); continue; }
    const e = smooth(0, 1, u), to = q.hand && player.wp[IDX.hand_R] ? bonePos(player, 'hand_R') : toWorld(player, [-0.28, 0.95, 0.12]), sc = 1 - (q.hand ? 0 : 0.75) * e;
    const at = V.add(V.lerp(q.from, to, e), [0, 0.35 * Math.sin(Math.PI * e), 0]), spin = q.hand ? M3.mix(M3.ry(q.a), M3.ry(player.yaw), e) : M3.ry(q.a + game.time * 0.9);     // keeps the slow turn it had on the floor, then settles pointing the way he faces
    if (q.item.t === 'gun') { const g = GUNS[q.item.id]; drawGun(prog, textured, g, spin.map(x => x * g.scale * sc), V.add(at, M3.vec(spin, [0, 0, -0.18 * g.scale * sc])), { att: q.item.att }); }
    else drawThing(prog, q.item.t, spin.map(x => x * 1.15 * sc), at);
  }
  for (const o of floorLoot) {
    if (!lootSeen(o)) continue;
    const it = o.item, R = o.rest || o.settle !== undefined ? lootRestR(o) : o.R, loose = !o.rest && o.settle === undefined;
    // lying on the ground, not floating: a gun on its side, everything else on its underside
    if (it.t === 'gun') { const g = GUNS[it.id], S = (o.rest ? R : o.R).map(x => x * g.scale); drawGun(prog, textured, g, S, V.add(o.p, M3.vec(S, [0, -0.04, -0.1])), { att: it.att }); continue; }
    if (RAID_THINGS[it.t]) { drawRaidLoot(prog, textured, o, R); continue; }
    if (it.t === 'c4') { drawC4(prog, V.add(o.p, [0, 0.02, 0]), R, false, 0); continue; }
    if (it.t === 'ammo') { drawThing(prog, 'ammo', R, V.add(o.p, [0, 0.06, 0])); continue; }
    drawLoot(prog, it.t, loose ? o.R : R, o.p, loose ? 1 : 0);
  }
}
// the coloured glow that says how good it is
function drawLootGlow(quad, right) {
  for (const o of floorLoot) {
    if (!lootSeen(o) || (o.item.t !== 'gun' && o.item.t !== 'rocks')) continue;
    const it = o.item, c = it.t === 'gun' ? RARITY[it.rarity].col : it.t === 'rocks' ? [0.2, 0.8, 0.9] : FOOD[it.t] ? [0.9, 0.35, 0.2] : it.t === 'plate' || it.t === 'vest' ? [0.25, 0.55, 0.75] : [0.6, 0.55, 0.2];
    const k = it.t === 'gun' ? 0.55 + 0.1 * it.rarity : 0.4;
    quad([o.p[0], o.p[1] + 0.03, o.p[2]], [0.42, 0, 0], [0, 0, 0.42], [c[0] * k, c[1] * k, c[2] * k, k]);
    if (it.t === 'gun' && it.rarity >= 2) {
      const h = 0.35 + 0.22 * it.rarity;
      quad([o.p[0], o.p[1] + h, o.p[2]], V.mul(right, 0.07 + 0.012 * it.rarity), [0, h, 0], [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 0.7]);
    }
  }
}

// ---------------------------------------------------------------- eating, and putting a plate in
const USE_TIME = { fish: 1.5, meat: 1.7, plate: 2.6 };
// why he cannot use it right now, or null if he can
function useBlock(f, t) {
  if (t === 'plate') return !f.hasVest ? 'You need a vest first' : f.vest >= VEST ? 'Your vest is already full' : null;
  return f.hp >= 100 ? 'You are not hurt' : null;
}
const loudFor = f => f.isPlayer ? 0.9 : clamp(1 - V.len(V.sub(f.pos, player.pos)) / 28, 0, 1) * 0.6;
// two hands on the sides of the plate, or the food in his right fist
function plateGoals(p) {
  return {
    R: hand(V.add(p, [-0.135, -0.05, -0.01]), [0.25, 0.75, 0.6], [1, 0, -0.2], [-1, -0.5, -0.3], 1.0),
    L: hand(V.add(p, [0.135, -0.05, -0.01]), [-0.25, 0.75, 0.6], [-1, 0, -0.2], [1, -0.5, -0.3], 1.0)
  };
}
const foodGoal = p => ({ R: hand(V.add(p, [-0.05, -0.03, -0.02]), [0.55, 0.35, 0.75], [0.3, 0.8, -0.5], [-1, -0.7, -0.2], 1.15) });
const HOLD_PLATE = [0, 1.14, 0.36], HOLD_FOOD = [-0.2, 1.12, 0.36];
function holdThingPose(f, t) {
  if (t === 'hammer') { hammerPose(f); return; }
  if (t === 'plate') { f.carry = plateGoals(HOLD_PLATE); f.thing = { kind: t, p: HOLD_PLATE, R: M3.rx(-0.3) }; }
  else { f.carry = foodGoal(HOLD_FOOD); f.thing = { kind: t, p: HOLD_FOOD, R: M3.ry(1.2) }; }
}
// one frame of f.use; true once it is finished. works for you and for the others alike
function useStep(f, dt) {
  const u = f.use, t0 = u.time, t = u.time += dt, crossed = at => t0 < at && t >= at, v = loudFor(f);
  const head = f.wp[IDX.head] || Rig.rest[IDX.head];           // where his head was last frame, in his own space
  const play = (s, k) => { if (v > 0.03) Sound.play(s, v * (k || 1)); };
  if (u.t === 'plate') {
    // lift it, BONK it into his own forehead, wobble, "ooga?", look at it, then into the vest where it belongs
    const brow = V.add(head, [0, 0.16, 0.17]), rest = HOLD_PLATE;
    const out = V.add(head, [0, 0.12, 0.50]), dazed = V.add(head, [0, -0.05, 0.40]), look = V.add(head, [0, -0.02, 0.36]), chest = [0, 1.24, 0.23];
    const p = flow([[0, rest], [0.34, out], [0.5, V.add(out, [0, 0.03, 0.05])], [0.62, brow], [0.78, dazed], [1.2, dazed], [1.45, look], [1.75, look], [2.1, V.add(chest, [0, 0.04, 0.12])], [2.25, chest], [2.6, chest]], t);
    const dizzy = smooth(0.62, 0.7, t) * (1 - smooth(1.05, 1.25, t));
    const nod = flow([[0, 0], [0.34, -0.1], [0.5, -0.22], [0.62, 0.34], [0.72, -0.55], [0.9, -0.2], [1.2, 0], [1.45, 0.22], [1.75, 0.2], [2.1, 0.38], [2.4, 0.15], [2.6, 0]], t);
    const tip = Math.sin(t * 15) * 0.3 * dizzy + 0.38 * smooth(1.2, 1.4, t) * (1 - smooth(1.75, 1.95, t));
    f.headTilt = M3.mul(M3.rx(nod), M3.rz(tip));
    const flip = flow([[0, -0.3], [0.5, -0.1], [1.2, -0.15], [1.45, -0.5], [1.75, -0.4], [2.1, 0], [2.6, 0]], t);
    const turn = Math.PI * 2 * smooth(1.45, 1.75, t);         // turns it over to see which way it goes
    f.thing = t < 2.25 ? { kind: 'plate', p, R: M3.mul(M3.rx(flip), M3.ry(turn)) } : null;
    const pat = t > 2.25 ? 0.07 * Math.max(0, Math.sin((t - 2.25) / 0.14 * Math.PI)) : 0;
    f.carry = plateGoals(V.add(p, [0, 0, pat]));
    if (dizzy > 0.3 && stars.length < 12) stars.push({ f, w: dizzy });
    if (crossed(0.4)) play('whoosh', 0.5);
    if (crossed(0.62)) { play('bonk'); play('clank', 0.8); f.kickHead = 1; if (f.isPlayer) cam.shake = Math.max(cam.shake, 0.7); }
    if (crossed(1.25)) play('oogaq');
    if (crossed(2.05)) play('velcro');
    if (crossed(2.25)) { play('platein'); f.vest = VEST; if (f.isPlayer) hudDirty = true; }
    if (crossed(2.3) || crossed(2.45)) play('thud', 0.35);
  } else {
    const food = FOOD[u.t], mouth = V.add(head, [-0.03, 0.04, 0.2]), end = USE_TIME[u.t];
    const bite = t > 0.38 && t < end - 0.35 ? Math.max(0, Math.sin((t - 0.38) / 0.3 * Math.PI)) : 0;
    const p = V.add(flow([[0, HOLD_FOOD], [0.35, mouth], [end - 0.35, mouth], [end, HOLD_FOOD]], t), [0, 0, 0.07 * bite]);
    f.headTilt = M3.mul(M3.rx(0.1 + 0.16 * (1 - bite) * smooth(0.2, 0.4, t) * (1 - smooth(end - 0.3, end, t))), M3.rz(0.1 * Math.sin(t * 10)));
    f.carry = foodGoal(p);
    f.thing = { kind: u.t, p, R: M3.mul(M3.ry(1.35), M3.rx(0.25 * bite)) };
    for (let at = 0.4; at < end - 0.4; at += 0.3) if (crossed(at)) {
      play('chomp');
      if (v > 0.03) puff(toWorld(f, mouth), 4, u.t === 'meat' ? [0.4, 0.14, 0.07, 0.9] : [0.3, 0.45, 0.6, 0.9], 0.7, 0.018, 0.5, 6);
    }
    if (crossed(end - 0.3)) { play('gulp', 0.8); f.hp = Math.min(100, f.hp + food.heal); play('heal', 0.7); if (f.isPlayer) hudDirty = true; }
  }
  return t >= USE_TIME[u.t];
}
// food and plates come up out of the pocket on his hip into his hands, and go back the same way
const POCKET = [-0.30, 0.78, 0.10];
function holdBlend(f, h) {
  const e = smooth(0, 1, h.w);
  if (e >= 1 || !f.carry) return;
  const c = f.carry;
  f.carry = {};
  if (c.R) f.carry.R = mixGoal(idleArm(-1), c.R, e);
  if (c.L) f.carry.L = mixGoal(idleArm(1), c.L, e);
  if (f.thing) f.thing = Object.assign({}, f.thing, { p: V.lerp(POCKET, f.thing.p, e) });
}
// ---------------------------------------------------------------- picking things up off the floor, caveman style
// leans over it, sniffs it, pokes it, jumps back (huh?), grabs it, and: food gets a bite and goes in the pocket, a plate gets a knock and
// goes in the pocket, a vest is held up for the putting on
const PICKIT = { reach: 0.34, poke: 0.70, grab: 1.00, dur: 2.00 };
function startItemPick(f, st) {
  return { kind: st.kind, t: 0, a: st.a, floorP: st.floorP, item: toLocalPos(f, V.add(st.floorP, [0, 0.04, 0])) };
}
function pickItStep(f, dt) {
  const q = f.pickIt;
  if (!q) { if (f.bendX) f.bendX = 0; return; }
  if (f.dead >= 0 || looting || f.ride) { f.pickIt = null; f.bendX = 0; return; }
  const before = q.t, t = (q.t += dt), crossed = at => before < at && t >= at, food = q.kind === 'fish' || q.kind === 'meat';
  const loud = 0.8, snd = (n, v) => Sound.play(n, loud * (v || 1));
  if (crossed(0.45)) snd(food ? 'huh' : 'clank', 0.6);
  if (crossed(0.58) && !food) snd('bonk', 0.5);
  if (crossed(PICKIT.poke)) snd('huh', 0.8);
  if (crossed(PICKIT.grab)) snd('grab');
  if (food && crossed(1.45)) snd('chomp');
  if (food && crossed(1.65)) snd('huh', 0.6);
  if (crossed(1.78)) snd('rustle', 0.7);
  const head = f.wp[IDX.head] || Rig.rest[IDX.head], mouth = V.add(head, [-0.03, 0.04, 0.2]), pocket = POCKET;
  const poking = smooth(PICKIT.reach, PICKIT.reach + 0.04, t) * (1 - smooth(PICKIT.poke - 0.04, PICKIT.poke, t));
  const tap = 0.06 * Math.abs(Math.sin((t - PICKIT.reach) * 13)) * poking;
  let p;
  if (t < PICKIT.grab) p = V.add(q.item, [0, tap, 0]);
  else if (q.kind === 'vest') p = flow([[PICKIT.grab, q.item], [1.35, [0, 1.0, 0.42]], [PICKIT.dur, [0, 1.0, 0.42]]], t);
  else p = flow(food ? [[PICKIT.grab, q.item], [1.33, [-0.12, 1.02, 0.5]], [1.5, mouth], [1.65, mouth], [1.78, pocket], [PICKIT.dur, pocket]]
                      : [[PICKIT.grab, q.item], [1.34, [0, 1.05, 0.48]], [1.56, [0, 1.1, 0.4]], [1.78, pocket], [PICKIT.dur, pocket]], t);
  if (food) p = V.add(p, [0, 0, 0.05 * Math.max(0, Math.sin((t - 1.45) / 0.2 * Math.PI)) * (t > 1.45 && t < 1.65 ? 1 : 0)]);
  const shrink = 1 - 0.85 * smooth(1.7, 1.92, t);                            // into the pocket
  f.carry = food || q.kind === 'ammo' ? foodGoal(p) : plateGoals(p);                  // the ammo box goes in one fist, the rest in two hands
  f.thing = t >= PICKIT.grab && t < PICKIT.dur - 0.06 ? { kind: q.kind, p, R: M3.mul(M3.ry(food ? 1.35 : 0), M3.rx(food ? 0.1 : -0.25)).map(x => x * shrink * (0.5 + 0.5 * smooth(PICKIT.grab, PICKIT.grab + 0.1, t))) } : null;
  f.bendX = 1.15 * smooth(0, PICKIT.reach, t) * (1 - smooth(PICKIT.grab + 0.05, 1.45, t));
  const sniff = smooth(0.32, 0.5, t) * (1 - smooth(0.64, 0.7, t)), puzzled = smooth(PICKIT.poke - 0.04, PICKIT.poke + 0.1, t) * (1 - smooth(0.9, PICKIT.grab + 0.04, t));
  f.headTilt = M3.mul(M3.rx(0.3 * sniff), M3.rz(0.4 * puzzled));
  if (t >= PICKIT.dur) { f.pickIt = null; f.bendX = 0; f.headTilt = null; f.thing = null; f.carry = null; hudDirty = true; }
}
// putting the vest on: he holds it up, looks at it, pulls it down over his head, gets stuck, wriggles, and pops out wearing it
const WEAR = { put: 1.45, dur: 2.0 };
function wearStep(f, dt) {
  const w = f.wearing;
  if (!w) return;
  if (f.dead >= 0) { f.wearing = null; return; }
  if (!w.started) {                                            // wait until his hands are free
    if (looting || f.ride || f.pickIt || f.pickNext || f.hol) return;
    if (f.weapon) { equip(f, null); return; }
    if (f.hand || f.holdC4) fists(f);
    w.started = true;
  }
  const before = w.t, t = (w.t += dt), crossed = at => before < at && t >= at;
  if (crossed(0.1)) Sound.play('velcro', 0.6);
  if (crossed(0.85)) Sound.play('whoosh', 0.5);
  if (crossed(1.0)) Sound.play('oogaq', 0.6);
  if (crossed(WEAR.put)) { Sound.play('velcro', 0.9); Sound.play('thud', 0.4); }
  const head = f.wp[IDX.head] || Rig.rest[IDX.head];
  const p = flow([[0, [0, 1.0, 0.42]], [0.35, [0, 1.08, 0.38]], [0.8, [0, 1.85, 0.12]], [1.0, V.add(head, [0, 0.05, 0.02])], [1.3, V.add(head, [0, 0.02, 0.02])], [WEAR.put, [0, 1.0, 0]]], t);
  const stuck = smooth(0.95, 1.05, t) * (1 - smooth(1.28, 1.4, t));
  const wriggle = Math.sin(t * 26) * stuck;
  f.carry = plateGoals(V.add(p, [0.012 * wriggle, 0, 0]));
  f.thing = t < WEAR.put ? { kind: 'vest', p: V.add(p, [0.01 * wriggle, 0, 0]), R: M3.mul(M3.rz(0.12 * wriggle), M3.rx(-0.1)).map(x => x * (1 - 0.25 * smooth(1.0, 1.4, t))) } : null;
  f.headTilt = M3.mul(M3.rz(0.3 * wriggle), M3.rx(-0.2 * stuck));
  f.bendX = 0.2 * stuck;
  if (t >= WEAR.dur) { f.wearing = null; f.headTilt = null; f.thing = null; f.carry = null; f.bendX = 0; hudDirty = true; }
}
// yours: runs inside playerStep, after the C4 code has had its say about your arms
function itemStep(f, dt) {
  f.headTilt = null; f.thing = null; f.carry = null;
  const h = f.hold || (f.hold = { kind: null, w: 0 });
  if (f.hand && findSlot(f, f.hand) < 0) { f.hand = null; f.use = null; }
  const free = f.dead < 0 && !looting && !f.ride && !f.hol && !f.weapon;      // hands not busy with a gun
  if (f.hand !== 'hammer' || !free) { raid.ghost = null; raid.hit = null; raid.swing = 0; raid.rightWas = mouse.aim; }
  if (!f.hand || !free) {
    f.use = null;
    if (!free) h.w = 0; else h.w = Math.max(0, h.w - dt / 0.22);
    if (h.w > 0 && h.kind) { holdThingPose(f, h.kind); holdBlend(f, h); }     // putting it away
    return;
  }
  if (h.kind !== f.hand) { h.kind = f.hand; h.w = 0; }
  if (f.hand === 'hammer') {                                   // building
    h.w = Math.min(1, h.w + dt / 0.30);
    if (raidOn()) buildStep(f, dt);
    hammerPose(f); holdBlend(f, h); return;
  }
  if (!f.use) h.w = Math.min(1, h.w + dt / 0.30);
  if (!f.use && h.w >= 0.9 && mouse.pressed && !useBlock(f, f.hand)) { f.use = { t: f.hand, time: 0 }; mouse.pressed = false; }
  if (!f.use) { holdThingPose(f, f.hand); holdBlend(f, h); return; }
  h.w = 1;
  if (!useStep(f, dt)) return;
  const k = findSlot(f, f.use.t), s = f.slots[k];
  f.use = null; f.headTilt = null;
  if (s && --s.n <= 0) { f.slots[k] = null; f.hand = null; f.thing = null; f.carry = null; }
  hudDirty = true;
}
