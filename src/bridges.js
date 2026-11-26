// ======================================================================= bridges over the rivers
// arched wooden bridges. the deck is something you stand on (deckAt), the rails keep you from stepping off
const DECK = { half: 2.1, rise: 2.2, plank: 0.42 };

// which river (0 or 1) and how far along it, from one end to the other
const CROSSINGS = [[0, 0.20], [0, 0.46], [0, 0.72], [1, 0.22], [1, 0.47], [1, 0.74]];
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
// round logs, split planks, rope and rough stone: something a caveman could have built
let woodwork = null;
function paint(draw) {
  const art = document.createElement('canvas'); art.width = art.height = 512;
  let seed = 7;
  draw(art.getContext('2d'), (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; });
  const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, art);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  return tex;
}
// grain running along u, with cracks and knots
const grain = (base, knots) => (g, rnd) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = i % 3 ? `rgba(46,26,10,${rnd(0.1, 0.4)})` : `rgba(214,170,112,${rnd(0.08, 0.32)})`;
    const x = rnd(-80, 512), y = rnd(0, 512), w = rnd(30, 200), h = rnd(1, 3.5);
    g.fillRect(x, y, w, h); g.fillRect(x - 512, y, w, h); g.fillRect(x + 512, y, w, h);
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(30,15,5,${rnd(0.35, 0.65)})`; g.fillRect(rnd(0, 440), rnd(0, 512), rnd(25, 120), rnd(1, 2.5)); }
  for (let i = 0; i < knots; i++) {
    const x = rnd(30, 480), y = rnd(20, 490);
    for (let r = 4; r > 0; r--) { g.strokeStyle = `rgba(40,20,6,${0.2 * r})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r * 5.5, r * 2.4, 0, 0, 7); g.stroke(); }
  }
};
const twist = (g, rnd) => {                                    // rope: slanting strands
  g.fillStyle = '#b08d57'; g.fillRect(0, 0, 512, 512);
  for (let x = -512; x < 1024; x += 64) {
    g.strokeStyle = 'rgba(60,40,15,0.65)'; g.lineWidth = 16; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 192, 512); g.stroke();
    g.strokeStyle = 'rgba(240,214,160,0.5)'; g.lineWidth = 12; g.beginPath(); g.moveTo(x + 28, 0); g.lineTo(x + 220, 512); g.stroke();
  }
};
const rubble = (g, rnd) => {
  g.fillStyle = '#7c776d'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { const v = Math.floor(rnd(60, 170)); g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.55)`; g.beginPath(); g.arc(rnd(0, 512), rnd(0, 512), rnd(2, 15), 0, 7); g.fill(); }
};

function makeBridges() {
  let seed = 11;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const mesh = () => ({ v: [], i: [] });
  const planksM = mesh(), logsM = mesh(), ropeM = mesh(), stoneM = mesh();
  const put = (m, p, n, u, v) => m.v.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v);
  const frame = f => { const r = V.norm(V.cross(f, Math.abs(f[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0])); return [r, V.cross(r, f)]; };

  // a round log or rope through a list of points, `radius` may differ at each; ends are capped
  const log = (m, points, radius, sides, along) => {
    const base = m.v.length / 8, u0 = rnd(0, 1), v0 = rnd(0, 1);
    let run = 0;
    points.forEach((p, k) => {
      const a = points[Math.max(0, k - 1)], b = points[Math.min(points.length - 1, k + 1)], [r, up] = frame(V.norm(V.sub(b, a)));
      if (k) run += V.len(V.sub(p, points[k - 1]));
      const size = Array.isArray(radius) ? radius[k] : radius;
      for (let s = 0; s <= sides; s++) {
        const t = s / sides * Math.PI * 2, n = V.add(V.mul(r, Math.cos(t)), V.mul(up, Math.sin(t)));
        put(m, V.mad(p, n, size), n, u0 + run / (along || 2.2), v0 + s / sides);
      }
    });
    const ring = sides + 1;
    for (let k = 0; k + 1 < points.length; k++) for (let s = 0; s < sides; s++) {
      const q = base + k * ring + s;
      m.i.push(q, q + ring, q + 1, q + 1, q + ring, q + ring + 1);
    }
    for (const [end, other] of [[0, 1], [points.length - 1, points.length - 2]]) {
      const n = V.norm(V.sub(points[end], points[other])), [r, up] = frame(n), size = Array.isArray(radius) ? radius[end] : radius, c = m.v.length / 8;
      put(m, points[end], n, 0.5, 0.5);
      for (let s = 0; s <= sides; s++) {
        const t = s / sides * Math.PI * 2;
        put(m, V.add(points[end], V.add(V.mul(r, Math.cos(t) * size), V.mul(up, Math.sin(t) * size))), n, 0.5 + Math.cos(t) * 0.08, 0.5 + Math.sin(t) * 0.08);
      }
      for (let s = 0; s < sides; s++) m.i.push(c, c + 1 + s, c + 2 + s);
    }
  };
  // a split plank from corner points: across the bridge, with its own width, tilt and shade of grain
  const slab = (c) => {                                        // 8 corners: bottom 4 then top 4
    const m = planksM, u0 = rnd(0, 1), v0 = rnd(0, 1);
    const face = (a, b, cc, d, wide, high) => {
      const n = V.norm(V.cross(V.sub(b, a), V.sub(d, a))), base = m.v.length / 8;
      [[a, 0, 0], [b, wide, 0], [cc, wide, high], [d, 0, high]].forEach(([p, u, v]) => put(m, p, n, u0 + u, v0 + v));
      m.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const [a, b, cc, d, e, f, g, h] = c;
    face(e, f, g, h, 2, 0.16); face(a, d, cc, b, 0.16, 2);
    face(a, b, f, e, 2, 0.05); face(d, h, g, cc, 0.05, 2);
    face(b, cc, g, f, 0.16, 0.05); face(a, e, h, d, 0.05, 0.16);
  };
  const boulder = (at, size) => {
    const t = (1 + Math.sqrt(5)) / 2;
    const pts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(p => V.mad(at, V.norm(p), size * rnd(0.7, 1.25)));
    for (const f of [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]) {
      const [a, b, c] = f.map(k => pts[k]);
      let n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
      if (V.dot(n, V.sub(a, at)) < 0) n = V.mul(n, -1);
      const base = stoneM.v.length / 8, u = rnd(0, 1), v = rnd(0, 1);
      put(stoneM, a, n, u, v); put(stoneM, b, n, u + 0.3, v); put(stoneM, c, n, u + 0.15, v + 0.3);
      stoneM.i.push(base, base + 1, base + 2);
    }
  };

  for (const b of bridges) {
    const [dx, dz] = b.dir;
    const at = (u, side, lift) => [b.from[0] + dx * b.span * u - dz * side, deckHeight(b, u) + lift, b.from[1] + dz * b.span * u + dx * side];
    const curve = (u0, u1, steps, side, lift) => Array.from({ length: steps + 1 }, (_, k) => at(u0 + (u1 - u0) * k / steps, side, typeof lift === 'function' ? lift(k / steps) : lift));

    // deck: thick split planks, none quite like the next
    let u = 0;
    while (u < 0.999) {
      const wide = rnd(0.34, 0.52) / b.span, next = u + wide > 0.985 ? 1 : u + wide, gap = 0.018 / b.span;
      const left = -(DECK.half + rnd(0.0, 0.22)), right = DECK.half + rnd(0.0, 0.22), dip = [rnd(-0.018, 0.018), rnd(-0.018, 0.018)];
      const corner = (uu, side, lift) => at(uu, side, lift + (side < 0 ? dip[0] : dip[1]));
      slab([-0.13, 0].flatMap(y => [corner(u + gap, left, y), corner(next - gap, left, y), corner(next - gap, right, y), corner(u + gap, right, y)]));
      u = next;
    }

    for (const side of [-1, 1]) {
      const edge = side * (DECK.half - 0.12), rail = side * (DECK.half + 0.17);
      // the heavy log that carries the planks
      log(logsM, curve(0, 1, 20, edge, -0.34), 0.22, 9);
      // an arched rib from bank to bank, with struts up to the deck and braces between them
      const rib = k => { const uu = 0.07 + 0.86 * k, low = (b.y0 + (b.y1 - b.y0) * uu) - 1.35; const p = at(uu, edge, 0); p[1] = low + (deckHeight(b, uu) - 0.72 - low) * Math.sin(Math.PI * k) ** 0.8; return p; };
      log(logsM, Array.from({ length: 19 }, (_, k) => rib(k / 18)), 0.19, 9);
      const struts = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92];
      struts.forEach((k, n) => {
        const foot = rib(k), head = at(0.07 + 0.86 * k, edge, -0.4);
        if (head[1] - foot[1] > 0.22) log(logsM, [foot, head], 0.11, 7);
        if (n + 1 < struts.length && head[1] - foot[1] > 0.3) log(logsM, [foot, at(0.07 + 0.86 * struts[n + 1], edge, -0.4)], 0.065, 6);
      });
      // posts, the log handrail along their tops, and two sagging ropes
      const bays = Math.max(5, Math.round(b.span / 2.5));
      for (let k = 0; k <= bays; k++) {
        const uu = k / bays, end = k === 0 || k === bays, high = end ? 1.75 : 1.08, thick = end ? 0.2 : 0.105;
        const lean = [rnd(-0.02, 0.02), 0, rnd(-0.02, 0.02)];
        const foot = at(uu, rail, -0.55), top = V.add(at(uu, rail, high), lean);
        log(logsM, [foot, top], [thick * 1.12, thick], 9);
        if (end) {                                             // a pointed top and rope wound round it
          log(logsM, [top, V.add(top, [0, 0.3, 0])], [thick * 0.95, 0.02], 9);
          for (let w = 0; w < 4; w++) log(ropeM, [V.add(top, [0, -0.34 + w * 0.07, 0]), V.add(top, [0, -0.27 + w * 0.07, 0])], thick + 0.03, 10, 0.3);
          if (rnd(0, 1) < 1) for (let w = 0; w < 3; w++) log(ropeM, [V.add(foot, [0, 0.75 + w * 0.07, 0]), V.add(foot, [0, 0.82 + w * 0.07, 0])], thick + 0.035, 10, 0.3);
        } else {                                               // lashing where the rail rests
          log(ropeM, [V.add(top, [0, -0.17, 0]), V.add(top, [0, -0.03, 0])], thick + 0.028, 9, 0.25);
        }
        if (k < bays) {
          const nu = (k + 1) / bays;
          for (const [lift, sag] of [[0.68, 0.14], [0.34, 0.1]]) log(ropeM, curve(uu, nu, 8, rail, t => lift - sag * Math.sin(Math.PI * t)), 0.032, 6, 0.35);
        }
      }
      log(logsM, curve(-0.012, 1.012, 24, rail, t => 1.06 + 0.012 * Math.sin(t * 37)), 0.1, 9);
    }
    // beams tying the two sides together under the deck
    for (const uu of [0.2, 0.4, 0.6, 0.8]) log(logsM, [at(uu, -(DECK.half + 0.12), -0.62), at(uu, DECK.half + 0.12, -0.62)], 0.11, 8);
    // a stout log at each end, and stones heaped where the bridge meets the bank
    for (const [uu, way] of [[0, -1], [1, 1]]) {
      log(logsM, [at(uu, -(DECK.half + 0.2), -0.13), at(uu, DECK.half + 0.2, -0.13)], 0.16, 9);
      for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
        const out = DECK.half + rnd(0.2, 0.95), along = rnd(-0.6, 1.9) * -way, p = at(uu, side * out, 0);
        p[0] += dx * along; p[2] += dz * along;
        const size = rnd(0.2, 0.46);
        p[1] = groundHeight(p[0], p[2]) + size * 0.25;
        boulder(p, size);
      }
    }
  }

  const upload = (m, tex) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    buffer(gl.ARRAY_BUFFER, new Float32Array(m.v));
    attrib(0, null, 3, gl.FLOAT, false, 32, 0); attrib(1, null, 3, gl.FLOAT, false, 32, 12); attrib(2, null, 2, gl.FLOAT, false, 32, 24);
    buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.i));
    gl.bindVertexArray(null);
    return { vao, count: m.i.length, tex };
  };
  return [
    upload(planksM, paint(grain('#b4854f', 18))),             // pale, freshly split
    upload(logsM, paint(grain('#6a4527', 10))),               // darker, with the bark off
    upload(ropeM, paint(twist)),
    upload(stoneM, paint(rubble))
  ];
}
function loadBridges() { return woodwork || (woodwork = makeBridges()); }
// for either shadow map
function drawBridgeShadow() {
  for (const part of loadBridges()) { gl.bindVertexArray(part.vao); gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0); }
}
function drawBridges(vp, light, eye) {
  const parts = loadBridges();
  globals(signProg, vp, light, eye); gl.uniform1i(signProg.u.uTex, 0);
  gl.uniform3fv(signProg.u.uSky, SKY.island); gl.uniform2fv(signProg.u.uFog, fogRange());
  gl.uniformMatrix4fv(signProg.u.uModel, false, m4(M3.id(), [0, 0, 0]));
  gl.activeTexture(gl.TEXTURE0);
  for (const part of parts) {
    gl.bindTexture(gl.TEXTURE_2D, part.tex);
    gl.bindVertexArray(part.vao); gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
  }
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
