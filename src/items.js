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
const gunItem = (id, rarity, clip, spare) => ({ t: 'gun', id, rarity: rarity || 0, clip: clip === undefined ? GUNS[id].mag : clip, spare: spare === undefined ? GUNS[id].mag * 2 : spare });
// what is in one chest: a gun is likely, never certain
function rollLoot() {
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
  return (it.t === 'vest' ? 'bulletproof vest' : it.t === 'ammo' ? 'ammo box' : it.t === 'plate' ? 'vest plate' : it.t === 'c4' ? 'C4' : FOOD[it.t].name.toLowerCase()) + n;
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
  if (it.t === 'vest') { f.vest = VEST; f.hasVest = true; return true; }
  if (it.t === 'ammo') {
    if (!f.inv.length) f.bank = (f.bank || 0) + 1;             // saved for the next gun you get
    else for (const id of f.inv) addAmmo(f, id, GUNS[id].mag * 2);
    return true;
  }
  if (it.t === 'gun' && findSlot(f, 'gun', it.id) >= 0) {      // one of each: keep the better colour, pocket the bullets
    const am = f.ammo[it.id];
    if (it.rarity > (am.rarity || 0)) am.rarity = it.rarity;
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
    f.ammo[it.id] = { clip: it.clip, spare: it.spare, rarity: it.rarity };
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
  if (s.t === 'gun') { const am = f.ammo[s.id]; it = gunItem(s.id, am.rarity, am.clip, am.spare); }
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
// what you set out with: nothing on the island, the old C4 on the baseplate
function freshPockets(f, name) {
  f.slots = emptySlots(); f.inv = []; f.ammo = {}; f.weapon = null; f.hand = null; f.use = null; f.holdC4 = false; f.bank = 0; f.c4 = 0; f.vest = 0; f.hasVest = false;
  if (name !== 'island') { f.c4 = 1; f.slots[SLOT_COUNT - 1] = { t: 'c4' }; }
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
// kind: fish, meat, plate, ammo, vest, c4. R may already be scaled
function drawThing(prog, kind, R, p) {
  if (kind === 'plate' || kind === 'ammo') { for (const part of kind === 'plate' ? plateShape : ammoShape) { flat(prog, part.color, part.rough, part.metal); drawMesh(prog, part.mesh, R, p); } }
  else if (kind === 'vest') drawHeldVest(prog, R, p);
  else if (kind === 'c4') drawC4(prog, p, R, false, 0);
  else for (const part of JUNK[kind]) { flat(prog, part.color, part.rough, 0.08); drawMesh(prog, part.mesh, R.map(x => x * 1.35), p); }
}

// ---------------------------------------------------------------- things lying about for the taking
const floorLoot = [];
function dropLoot(item, at, spread) {
  const s = spread === undefined ? 0.5 : spread;
  let x = at[0] + rand(-s, s), z = at[2] + rand(-s, s);
  if (world.map === 'island') { const q = { pos: [x, at[1], z], isPlayer: true }; confine(q); x = q.pos[0]; z = q.pos[2]; }
  floorLoot.push({ item, p: [x, floorAt(x, z, at[1] + 0.6), z], a: rand(0, 6.3) });
  while (floorLoot.length > 320) floorLoot.shift();
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
  for (const o of floorLoot) {
    if (!lootSeen(o)) continue;
    const it = o.item, spin = M3.ry(o.a + game.time * 0.9), lift = 0.04 * Math.sin(game.time * 2.2 + o.a);
    if (it.t === 'gun') { const g = GUNS[it.id]; drawGun(prog, textured, g, spin.map(x => x * g.scale), V.add(o.p, V.add([0, 0.30 + lift, 0], M3.vec(spin, [0, 0, -0.18 * g.scale]))), {}); continue; }
    const up = it.t === 'c4' ? 0.12 : it.t === 'vest' ? 0.36 : 0.28;
    drawThing(prog, it.t, it.t === 'c4' || it.t === 'vest' ? spin : spin.map(x => x * 1.15), V.add(o.p, [0, up + lift, 0]));
  }
}
// the coloured glow that says how good it is
function drawLootGlow(quad, right) {
  for (const o of floorLoot) {
    if (!lootSeen(o)) continue;
    const it = o.item, c = it.t === 'gun' ? RARITY[it.rarity].col : FOOD[it.t] ? [0.9, 0.35, 0.2] : it.t === 'plate' || it.t === 'vest' ? [0.25, 0.55, 0.75] : [0.6, 0.55, 0.2];
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
// yours: runs inside playerStep, after the C4 code has had its say about your arms
function itemStep(f, dt) {
  f.headTilt = null; f.thing = null;
  if (f.hand && findSlot(f, f.hand) < 0) { f.hand = null; f.use = null; }
  if (!f.hand || f.dead >= 0 || looting || f.ride) { f.use = null; return; }
  if (!f.use && mouse.pressed && !useBlock(f, f.hand)) { f.use = { t: f.hand, time: 0 }; mouse.pressed = false; }
  if (!f.use) { holdThingPose(f, f.hand); return; }
  if (!useStep(f, dt)) return;
  const k = findSlot(f, f.use.t), s = f.slots[k];
  f.use = null; f.headTilt = null;
  if (s && --s.n <= 0) { f.slots[k] = null; f.hand = null; f.thing = null; f.carry = null; }
  hudDirty = true;
}
