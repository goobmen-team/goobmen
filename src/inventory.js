// ======================================================================= the inventory (Tab)
// Your four pockets, big. Drag one onto another to swap them round, drag it off the panel to throw it on the
// floor. The world does not stop while you are looking.
const invEl = { box: document.getElementById('inv'), panel: document.getElementById('invpanel'), slots: document.getElementById('invslots'), info: document.getElementById('invinfo'), title: document.querySelector('#invpanel h2'),
  stash: document.getElementById('invstash'), stashSlots: document.getElementById('stashslots'), stashWords: document.getElementById('stashwords'), stashIn: document.getElementById('stashin'), stashOut: document.getElementById('stashout'),
  bench: document.getElementById('invbench'), benchGun: document.getElementById('benchgun'), benchList: document.getElementById('benchlist') };
let invToggled = -1e9;         // when it last opened or shut
let invHover = -1;
let invDrag = null;            // { k, thing, x, y, moved, ghost }

// ---------------------------------------------------------------- pictures of the things, taken from the real models
const ICON_W = 320, ICON_H = 220, icons = {};
let iconFbo = null;
const NO_SHADOW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 10, 0, 1]);   // everything lands outside the shadow map
function iconShot(kind, from, half, mid) {
  const proj = ortho(half * ICON_W / ICON_H, half, 0.1, 12);
  proj[12] = -mid[0] / (half * ICON_W / ICON_H); proj[13] = -mid[1] / half;
  const eye = V.mul(V.norm(from), 4), vp = mul4(proj, lookAt(eye, [0, 0, 0]));
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  globals(pbrProg, vp, NO_SHADOW, eye);
  gl.uniform1i(pbrProg.u.uTex, 0); gl.uniform1i(pbrProg.u.uNormalMap, 1); gl.uniform1i(pbrProg.u.uOrm, 2);
  const one = M3.ry(0);
  if (RAID_PICS[kind]) { const q = RAID_PICS[kind]; for (const [m, at, R] of q.parts) drawModel(pbrProg, true, m, R || one, V.sub(at || [0, 0, 0], q.mid)); }
  else if (kind.startsWith('gun:')) { const [, id, parts] = kind.split(':'), g = GUNS[id], att = parts ? Object.fromEntries(parts.split(',').map(k => [k, true])) : null; drawGun(pbrProg, true, g, one.map(x => x * g.scale), [0, 0, 0], { att }); }
  else drawThing(pbrProg, kind, one, [0, 0, 0]);
  const px = new Uint8Array(ICON_W * ICON_H * 4);
  gl.readPixels(0, 0, ICON_W, ICON_H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}
function itemIcon(kind) {
  if (icons[kind]) return icons[kind];
  if (!iconFbo) {
    iconFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, iconFbo);
    const colour = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, colour); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, ICON_W, ICON_H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colour);
    const depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, ICON_W, ICON_H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, iconFbo); gl.viewport(0, 0, ICON_W, ICON_H);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  flashCol[0] = flashCol[1] = flashCol[2] = 0;
  const from = RAID_PICS[kind] ? RAID_PICS[kind].from : kind === 'plate' || kind === 'vest' ? [0.3, 0.12, 1] : kind === 'c4' ? [0.45, 0.75, 0.6] : [-1, 0.16, 0.12];
  // once from well back to find it, once more filling the picture
  const wide = 1.6, first = iconShot(kind, from, wide, [0, 0]);
  let x0 = ICON_W, y0 = ICON_H, x1 = -1, y1 = -1;
  for (let y = 0; y < ICON_H; y++) for (let x = 0; x < ICON_W; x++) if (first[(y * ICON_W + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let px = first;
  if (x1 >= 0) {
    const metre = ICON_H / (2 * wide);                        // pixels
    const mid = [((x0 + x1 + 1) / 2 - ICON_W / 2) / metre, ((y0 + y1 + 1) / 2 - ICON_H / 2) / metre];
    const half = Math.max((x1 - x0 + 2) / ICON_W * ICON_H, y1 - y0 + 2) / metre / 2 * 1.06;
    px = iconShot(kind, from, half, mid);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const c = document.createElement('canvas'); c.width = ICON_W; c.height = ICON_H;
  const ctx = c.getContext('2d'), image = ctx.createImageData(ICON_W, ICON_H);
  for (let y = 0; y < ICON_H; y++) image.data.set(px.subarray((ICON_H - 1 - y) * ICON_W * 4, (ICON_H - y) * ICON_W * 4), y * ICON_W * 4);
  ctx.putImageData(image, 0, 0);
  return (icons[kind] = c.toDataURL());
}

// ---------------------------------------------------------------- what is on the tiles
const slotKind = s => { if (s.t !== 'gun') return s.t; const att = attOf(player, s.id); return 'gun:' + s.id + (att ? ':' + Object.keys(att).sort().join(',') : ''); };
function slotWords(s) {
  if (s.t === 'gun') { const am = player.ammo[s.id], r = RARITY[am.rarity || 0]; return { name: GUNS[s.id].name, count: am.clip + ' / ' + am.spare, css: r.css, info: r.name + ' ' + GUNS[s.id].name + (am.rarity === EXOTIC ? ' · one shot, vest or not' : ' · ' + am.clip + ' loaded, ' + am.spare + ' spare') + (am.att ? ' · ' + attWords(am.att) : '') }; }
  if (s.t === 'hammer') return { name: 'Hammer', count: '', css: '', info: 'Stone hammer · take it out to build' };
  if (s.t === 'c4') return { name: 'C4', count: '×' + player.c4, css: '', info: 'C4 · pick it, then click to plant' };
  if (s.t === 'plate') return { name: 'Vest plate', count: '×' + s.n, css: '', info: 'Vest plate · mends your vest' };
  return { name: FOOD[s.t].name, count: '×' + s.n, css: '', info: FOOD[s.t].name + ' · heals ' + FOOD[s.t].heal };
}
const invTiles = Array.from({ length: 7 }, (_, k) => {                // seven, for those with a duffel bag
  const d = document.createElement('div');
  d.className = 'invslot';
  d.dataset.k = k;
  d.innerHTML = `<i>${k + 1}</i><img alt="" draggable="false"><b></b><span></span>`;
  invEl.slots.appendChild(d);
  d.addEventListener('pointerenter', () => { invHover = k; invWords(); });
  d.addEventListener('pointerleave', () => { if (invHover === k) { invHover = -1; invWords(); } });
  d.addEventListener('pointerdown', e => invGrab(e, k));
  return d;
});
function invWords() {
  const k = invHover >= 0 && player.slots[invHover] ? invHover : heldSlot(player), s = k >= 0 && player.slots[k];
  invEl.info.textContent = s ? slotWords(s).info : ' ';
}
// ---------------------------------------------------------------- the other half of the panel: a stash, or the work table
const stashTiles = Array.from({ length: 10 }, (_, i) => {
  const d = document.createElement('div');
  d.className = 'invslot stash';
  d.innerHTML = '<img alt="" draggable="false" hidden><b></b><span></span>';
  invEl.stashSlots.appendChild(d);
  d.addEventListener('pointerdown', e => { e.preventDefault(); stashTake(i); invRender(); });
  return d;
});
invEl.stashIn.addEventListener('click', () => { stashRocks(false); invRender(); });
invEl.stashOut.addEventListener('click', () => { stashRocks(true); invRender(); });
function itemWords(it) {
  if (it.t === 'gun') return { kind: 'gun:' + it.id + (it.att ? ':' + Object.keys(it.att).sort().join(',') : ''), name: GUNS[it.id].name, count: it.att ? '+' + Object.keys(it.att).length : '', css: RARITY[it.rarity].css };
  return { kind: it.t, name: it.t === 'c4' ? 'C4' : it.t === 'plate' ? 'Vest plate' : it.t === 'hammer' ? 'Hammer' : it.t === 'bag' ? 'Duffel bag' : it.t === 'vest' ? 'Vest' : FOOD[it.t] ? FOOD[it.t].name : it.t, count: it.n > 1 ? '×' + it.n : '', css: '' };
}
function stashRender() {
  const b = game.stash;
  invEl.stash.hidden = !b;
  if (!b) return;
  stashTiles.forEach((d, i) => {
    const it = b.items[i], w = it && itemWords(it), img = d.children[0];
    d.className = 'invslot stash' + (it ? '' : ' empty') + (w && w.css ? ' rare' : '');
    d.style.setProperty('--r', w && w.css ? w.css : '#8b929b');
    img.hidden = !it;
    if (it) { const src = itemIcon(w.kind); if (img.getAttribute('src') !== src) img.src = src; }
    d.children[1].textContent = w ? w.name : '';
    d.children[2].textContent = w ? w.count : '';
  });
  invEl.stashWords.textContent = 'Shiny rocks in here: ' + b.rocks.toLocaleString('en-US') + ' · on you: ' + (player.rocks || 0).toLocaleString('en-US');
  invEl.stashIn.disabled = !player.rocks; invEl.stashOut.disabled = !b.rocks;
}
let benchButtons = null;
function benchRender() {
  invEl.bench.hidden = !game.bench;
  if (!game.bench) return;
  if (!benchButtons) {
    benchButtons = [...Object.entries(ATTS).map(([id, a]) => ({ id, part: true, name: a.name, cost: a.cost, info: a.info })), ...GOODS.map(g => ({ id: g.id, name: g.name, cost: g.cost, info: g.info }))];
    for (const q of benchButtons) {
      q.el = document.createElement('button'); q.el.type = 'button';
      q.el.innerHTML = '<img alt="" draggable="false"><b></b><span></span>';
      q.el.addEventListener('click', () => { benchBuy(q.id); invRender(); });
      invEl.benchList.appendChild(q.el);
    }
  }
  const f = player, id = f.weapon || bestGun(f), am = id && f.ammo[id];
  invEl.benchGun.textContent = (id ? 'Fitting parts to your ' + RARITY[am.rarity || 0].name + ' ' + GUNS[id].name + (am.att ? ' (has ' + attWords(am.att) + ')' : '') : 'You have no gun to fit parts to') + ' · shiny rocks: ' + (f.rocks || 0).toLocaleString('en-US');
  for (const q of benchButtons) {
    const have = q.part && am && am.att && am.att[q.id], wrong = q.part && (!id || !canFit(id, am.rarity, q.id));
    const img = q.el.children[0], src = itemIcon(q.id);
    if (img.getAttribute('src') !== src) img.src = src;
    q.el.children[1].textContent = q.name;
    q.el.children[2].textContent = have ? 'fitted' : wrong ? (id ? 'does not fit' : 'needs a gun') : q.cost + ' rocks';
    q.el.disabled = !!(have || wrong || (f.rocks || 0) < q.cost);
    q.el.title = q.info;
  }
}
function invRender() {
  const held = heldSlot(player);
  invEl.slots.classList.toggle('seven', player.slots.length > 4);
  stashRender(); benchRender();
  invTiles.forEach((d, k) => {
    d.hidden = k >= player.slots.length;
    const s = player.slots[k], w = s && slotWords(s), img = d.children[1];
    d.className = 'invslot' + (s ? '' : ' empty') + (held === k ? ' on' : '') + (w && w.css ? ' rare' : '') + (invDrag && invDrag.moved && invDrag.k === k ? ' lifted' : '');
    d.style.setProperty('--r', w && w.css ? w.css : '#8b929b');
    img.hidden = !s;
    if (s) { const src = itemIcon(slotKind(s)); if (img.getAttribute('src') !== src) img.src = src; }
    d.children[2].textContent = w ? w.name : '';
    d.children[3].textContent = w ? w.count : '';
  });
  invWords();
}

// ---------------------------------------------------------------- open and shut
function canOpenInventory() {
  return game.running && !cine.on && player.dead < 0 && !looting && !player.ride && !(player.plantT >= 0) && !world.asking;
}
// what: { stash } or { bench } to have that open beside your pockets
function openInventory(what) {
  if (game.inv || !canOpenInventory()) return;
  game.stash = (what && what.stash) || null; game.bench = (what && what.bench) || null;
  invEl.title.textContent = game.stash ? 'Stash' : game.bench ? 'Work table' : 'Inventory';
  invEl.panel.classList.toggle('wide', !!what);
  game.inv = true; invToggled = performance.now(); game.aimToggle = false; mouse.fire = mouse.aim = mouse.pressed = false; mouse.drag = null;
  invHover = -1;
  invEl.box.hidden = false;
  invRender();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  Sound.play('rustle', 0.8);
}
// grabMouse: go back to looking round (only works straight after a key or a click)
function closeInventory(grabMouse) {
  if (!game.inv) return;
  invLetGo();
  game.inv = false; game.stash = null; game.bench = null; invToggled = performance.now();
  invEl.box.hidden = true;
  if (grabMouse && game.running && game.lockWorked) lockMouse();
}
function toggleInventory() { if (game.inv) { closeInventory(true); Sound.play('rustle', 0.5); } else openInventory(); }
// something happened that you need to see to
function invCheck() {
  const b = game.stash || game.bench;
  if (!canOpenInventory() || (b && (b.gone || Math.hypot(b.x - player.pos[0], b.z - player.pos[2]) > 2.8))) closeInventory(game.running && !cine.on);
}

// ---------------------------------------------------------------- moving and throwing away
function moveSlot(f, from, to) {
  if (from === to) return;
  const a = f.slots[from], b = f.slots[to];
  if (a && b && a.t === b.t && (FOOD[a.t] || a.t === 'plate') && b.n < STACK) {   // two bunches of the same: put them together
    const n = Math.min(STACK - b.n, a.n);
    b.n += n; a.n -= n;
    if (!a.n) f.slots[from] = null;
  } else { f.slots[from] = b; f.slots[to] = a; }
  syncInv(f);
  hudDirty = true;
}
function throwSlot(f, k) {
  if (!f.slots[k]) return;
  const held = heldSlot(f) === k;
  dropSlot(f, k);
  if (held) { f.gun = null; f.carry = null; f.thing = null; f.headTilt = null; }
  Sound.play('whoosh', 0.5);
}
const overPanel = e => { const r = invEl.panel.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
function invGrab(e, k) {
  e.preventDefault();
  if (!player.slots[k]) return;
  if (e.button === 2) { throwSlot(player, k); invRender(); return; }        // right click: straight on the floor
  if (e.button !== 0) return;
  invLetGo();
  invDrag = { k, thing: player.slots[k], x: e.clientX, y: e.clientY, moved: false, ghost: null };
}
function invLetGo() {
  if (invDrag && invDrag.ghost) invDrag.ghost.remove();
  invDrag = null;
}
addEventListener('pointermove', e => {
  const d = invDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.moved = true;
    d.ghost = document.createElement('div');
    d.ghost.id = 'invghost';
    d.ghost.innerHTML = `<img alt="" src="${itemIcon(slotKind(d.thing))}"><b>Drop</b>`;
    d.ghost.style.setProperty('--r', slotWords(d.thing).css || '#8b929b');
    invEl.box.appendChild(d.ghost);
    Sound.play('uihover', 0.8);
    invRender();
  }
  d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
  const outside = !overPanel(e);
  d.ghost.classList.toggle('drop', outside);
  const under = document.elementFromPoint(e.clientX, e.clientY), tile = under && under.closest('.invslot');
  invTiles.forEach((t, k) => t.classList.toggle('into', t === tile && k !== d.k));
});
addEventListener('pointerup', e => {
  const d = invDrag;
  if (!d || e.button !== 0) return;
  invLetGo();
  if (player.slots[d.k] !== d.thing) { invRender(); return; }               // it went somewhere else meanwhile
  if (!d.moved && game.stash) stashDeposit(d.k);                            // a plain click with a stash open: into it
  else if (!d.moved) { selectSlot(player, d.k); Sound.play('uiclick', 0.7); }   // a plain click: take it in your hand
  else if (!overPanel(e)) throwSlot(player, d.k);
  else {
    const under = document.elementFromPoint(e.clientX, e.clientY), tile = under && under.closest('.invslot');
    if (tile) { moveSlot(player, d.k, +tile.dataset.k); Sound.play('grab', 0.6); }
  }
  invRender();
});
addEventListener('pointercancel', () => { invLetGo(); if (game.inv) invRender(); });
