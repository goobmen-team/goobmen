// ======================================================================= bridges over the rivers
// arched wooden bridges. the deck is something you stand on (deckAt), the rails keep you from stepping off
const DECK = { half: 2.1, rise: 2.2, plank: 0.42 };

// which river (0 or 1) and how far along it, from one end to the other
const CROSSINGS = [[0, 0.20], [0, 0.33], [0, 0.46], [0, 0.59], [0, 0.72], [1, 0.22], [1, 0.35], [1, 0.47], [1, 0.61], [1, 0.74]];
for (const [river, along] of CROSSINGS) {
  const path = RIVERS[river], k = Math.round(along * (path.length - 1));
  const [x, z] = path[k], [ax, az] = path[Math.max(0, k - 2)], [bx, bz] = path[Math.min(path.length - 1, k + 2)];
  const len = Math.hypot(bx - ax, bz - az) || 1, dx = -(bz - az) / len, dz = (bx - ax) / len;     // straight across the water
  // walk out each way until the bank is properly dry
  const reach = way => { let d = RIVER.wet + 2; while (d < 24 && groundHeight(x + dx * way * d, z + dz * way * d) < 0.75) d += 0.5; return d + 1.0; };
  const back = reach(-1), front = reach(1);
  const from = [x - dx * back, z - dz * back], span = back + front;
  bridges.push({ from, dir: [dx, dz], span, y0: groundHeight(from[0], from[1]), y1: groundHeight(x + dx * front, z + dz * front) });
}
const deckHeight = (b, u) => b.y0 + (b.y1 - b.y0) * u + DECK.rise * Math.sin(Math.PI * u);
// the height of the planks under a point, or -Infinity where there is no bridge
function deckAt(x, z) {
  for (const b of bridges) {
    const rx = x - b.from[0], rz = z - b.from[1], along = rx * b.dir[0] + rz * b.dir[1], side = rz * b.dir[0] - rx * b.dir[1];
    if (along >= 0 && along <= b.span && Math.abs(side) <= DECK.half) return deckHeight(b, along / b.span);
  }
  return -Infinity;
}
const walkHeight = (x, z) => Math.max(groundHeight(x, z), deckAt(x, z));
const nearBridge = (x, z, pad) => bridges.some(b => {
  const rx = x - b.from[0], rz = z - b.from[1], along = rx * b.dir[0] + rz * b.dir[1], side = rz * b.dir[0] - rx * b.dir[1];
  return along > -pad && along < b.span + pad && Math.abs(side) < DECK.half + pad;
});

// the rails, as thin walls that only matter to someone standing on the deck
function addRails() {
  for (const b of bridges) {
    const [dx, dz] = b.dir, pieces = Math.ceil(b.span / 2.5);
    for (let k = 0; k < pieces; k++) for (const side of [-1, 1]) {
      const at = (u, off) => [b.from[0] + dx * b.span * u - dz * side * off, b.from[1] + dz * b.span * u + dx * side * off];
      const u0 = k / pieces, u1 = (k + 1) / pieces, corners = [at(u0, DECK.half), at(u1, DECK.half), at(u1, DECK.half + 0.2), at(u0, DECK.half + 0.2)];
      const y = Math.min(deckHeight(b, u0), deckHeight(b, u1)), hull = outline(corners);
      const mid = at((u0 + u1) / 2, DECK.half + 0.1);
      solids.push({ x: mid[0], z: mid[1], y, r: b.span / pieces / 2 + 0.3, h: Math.abs(deckHeight(b, u1) - deckHeight(b, u0)) + 1.1, hull, thin: true });
    }
  }
}

// ---------------------------------------------------------------- the woodwork
let woodwork = null;
function makeBridges() {
  const art = document.createElement('canvas'); art.width = art.height = 512;
  const g = art.getContext('2d');
  let seed = 7;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  g.fillStyle = '#7d5532'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {                             // grain running along the length
    g.fillStyle = i % 3 ? `rgba(48,27,10,${rnd(0.12, 0.45)})` : `rgba(196,150,96,${rnd(0.1, 0.35)})`;
    g.fillRect(rnd(-80, 512), rnd(0, 512), rnd(30, 190), rnd(1, 3.5));
  }
  for (let i = 0; i < 16; i++) {                              // knots
    const x = rnd(20, 490), y = rnd(20, 490);
    for (let r = 4; r > 0; r--) { g.strokeStyle = `rgba(40,20,6,${0.18 * r})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r * 5, r * 2.4, 0, 0, 7); g.stroke(); }
  }
  const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, art);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  const v = [], idx = [];
  // a beam from a to b: `side` and `thick` are its half sizes
  const beam = (a, b, side, thick) => {
    const along = V.sub(b, a), len = V.len(along), f = V.mul(along, 1 / (len || 1)), r = V.norm(V.cross(f, Math.abs(f[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0])), up = V.cross(r, f);    // posts point straight up
    const mid = V.lerp(a, b, 0.5), u0 = rnd(0, 1), v0 = rnd(0, 1);
    const at = (i, j, k) => V.add(mid, V.add(V.mul(f, i * len / 2), V.add(V.mul(r, j * side), V.mul(up, k * thick))));
    const face = (pts, n, wide, high) => {
      const base = v.length / 8, uv = [[0, 0], [wide, 0], [wide, high], [0, high]];
      pts.forEach((p, k) => v.push(...p, ...n, u0 + uv[k][0], v0 + uv[k][1]));
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const L = len / 2.2, S = side * 0.9, T = thick * 0.9;
    face([at(-1, -1, 1), at(1, -1, 1), at(1, 1, 1), at(-1, 1, 1)], up, L, S);
    face([at(-1, -1, -1), at(1, -1, -1), at(1, 1, -1), at(-1, 1, -1)], V.mul(up, -1), L, S);
    face([at(-1, 1, -1), at(1, 1, -1), at(1, 1, 1), at(-1, 1, 1)], r, L, T);
    face([at(-1, -1, -1), at(1, -1, -1), at(1, -1, 1), at(-1, -1, 1)], V.mul(r, -1), L, T);
    face([at(1, -1, -1), at(1, 1, -1), at(1, 1, 1), at(1, -1, 1)], f, S, T);
    face([at(-1, -1, -1), at(-1, 1, -1), at(-1, 1, 1), at(-1, -1, 1)], V.mul(f, -1), S, T);
  };
  for (const b of bridges) {
    const [dx, dz] = b.dir;
    const at = (u, side, lift) => [b.from[0] + dx * b.span * u - dz * side, deckHeight(b, u) + lift, b.from[1] + dz * b.span * u + dx * side];
    // planks across, each a touch different
    const planks = Math.round(b.span / DECK.plank);
    for (let k = 0; k < planks; k++) {
      const u = (k + 0.5) / planks, wide = DECK.half + rnd(0.02, 0.14), slope = (deckHeight(b, u + 0.01) - deckHeight(b, u - 0.01)) / (0.02 * b.span);
      const a = at(u, -wide, -0.06), c = at(u, wide, -0.06);
      // a plank is a beam lying across: its width runs along the bridge, tipped with the arch
      const half = b.span / planks / 2 - 0.02, base = v.length / 8;
      beam(a, c, half, 0.055);
      for (let n = base; n < v.length / 8; n++) {
        const along = (v[n * 8] - a[0]) * dx + (v[n * 8 + 2] - a[2]) * dz;
        v[n * 8 + 1] += along * slope;
      }
    }
    const steps = Math.ceil(b.span / 1.9);
    for (const side of [-1, 1]) {
      for (let k = 0; k < steps; k++) {
        const u0 = k / steps, u1 = (k + 1) / steps;
        beam(at(u0, side * (DECK.half - 0.25), -0.3), at(u1, side * (DECK.half - 0.25), -0.3), 0.14, 0.19);   // the arched beam under the deck
        beam(at(u0, side * (DECK.half + 0.06), 1.02), at(u1, side * (DECK.half + 0.06), 1.02), 0.09, 0.065);  // handrail
        beam(at(u0, side * (DECK.half + 0.06), 0.56), at(u1, side * (DECK.half + 0.06), 0.56), 0.04, 0.045);  // lower rail
      }
      for (let k = 0; k <= steps; k++) {
        const p = at(k / steps, side * (DECK.half + 0.06), 0);
        beam([p[0], p[1] - 0.25, p[2]], [p[0], p[1] + (k === 0 || k === steps ? 1.4 : 1.1), p[2]], k === 0 || k === steps ? 0.15 : 0.08, k === 0 || k === steps ? 0.15 : 0.08);
      }
      // legs standing in the river
      for (const u of [0.3, 0.7]) {
        const p = at(u, side * (DECK.half - 0.25), -0.3);
        beam([p[0], SEA.floor - 0.2, p[2]], p, 0.17, 0.17);
      }
    }
    for (const u of [0.3, 0.7]) beam(at(u, -(DECK.half - 0.25), -0.75), at(u, DECK.half - 0.25, -0.75), 0.1, 0.12);
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  buffer(gl.ARRAY_BUFFER, new Float32Array(v));
  attrib(0, null, 3, gl.FLOAT, false, 32, 0); attrib(1, null, 3, gl.FLOAT, false, 32, 12); attrib(2, null, 2, gl.FLOAT, false, 32, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx));
  gl.bindVertexArray(null);
  return { vao, count: idx.length, tex };
}
function loadBridges() { return woodwork || (woodwork = makeBridges()); }
// for either shadow map
function drawBridgeShadow() {
  const w = loadBridges();
  gl.bindVertexArray(w.vao); gl.drawElements(gl.TRIANGLES, w.count, gl.UNSIGNED_INT, 0);
}
function drawBridges(vp, light, eye) {
  const w = loadBridges();
  globals(signProg, vp, light, eye); gl.uniform1i(signProg.u.uTex, 0);
  gl.uniform3fv(signProg.u.uSky, SKY.island); gl.uniform2fv(signProg.u.uFog, fogRange());
  gl.uniformMatrix4fv(signProg.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, w.tex);
  gl.bindVertexArray(w.vao); gl.drawElements(gl.TRIANGLES, w.count, gl.UNSIGNED_INT, 0);
}

// ======================================================================= flying (for testing the map)
// N turns it on and off. WASD flies where you look, Space up, C down, the wheel sets the speed
const FLY = { on: false, speed: 20, min: 3, max: 160 };
function setFly(on) {
  if (on === FLY.on || (on && (player.dead >= 0 || looting))) return;
  FLY.on = on; player.drop = 0; player.air = 0; player.jump = -1; player.crouch = false; player.wet = 0;
  notify(on ? 'Flying. Space up, C down, wheel for speed, N to land' : 'Flying off');
}
function flySpeed(way) {
  FLY.speed = clamp(FLY.speed * (way > 0 ? 1.25 : 0.8), FLY.min, FLY.max);
  notify('Flying speed ' + Math.round(FLY.speed) + ' m/s');
}
function flyStep(f, dt) {
  const { fwd, right } = camVectors();
  const held = (...codes) => codes.some(c => keys.has(c)) ? 1 : 0;
  const ahead = held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'), side = held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'), up = held('Space') - held('KeyC');
  let move = V.add(V.mul(fwd, ahead), V.add(V.mul(right, side), [0, up, 0]));
  if (V.len(move) > 1) move = V.norm(move);
  f.pos = V.mad(f.pos, move, FLY.speed * dt);
  const most = GRID.half - 5;
  f.pos[0] = clamp(f.pos[0], -most, most); f.pos[2] = clamp(f.pos[2], -most, most);
  f.pos[1] = clamp(f.pos[1], floorAt(f.pos[0], f.pos[2]), 250);
  f.yaw += wrap(cam.yaw + Math.PI - f.yaw) * Math.min(1, dt * 18);
  f.speed = 0; f.legYaw = 0; f.ads = 0; f.sprintW = 0; f.time += dt;
  for (const n of CLIP_NAMES) f.weights[n] = n === 'Idle' ? 1 : 0;
  f.target = V.mad(cameraEye().eye, fwd, 40);
}
