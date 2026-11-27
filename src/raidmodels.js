// ======================================================================= the things you build and carry on the island
// Log walls and a door, the stone hammer, the black duffel bag, the work table, the stash, shiny rocks and the gun
// parts. All made here in code, like the chest: real curved and bevelled shapes, with one painted sheet for the bark,
// cut wood, planks, stone, leather, rope, nylon and metal, so a camp full of walls stays cheap.
const raidArt = (() => {
  const N = 1024;
  // where each material sits on the sheet: x, y, wide, tall
  const R = {
    bark: [0, 0, 512, 512], plank: [512, 0, 512, 256], end: [512, 256, 256, 256], stone: [768, 256, 256, 256],
    leather: [0, 512, 256, 256], rope: [256, 512, 256, 128], cut: [256, 640, 256, 128], nylon: [512, 512, 256, 256], web: [768, 512, 256, 256],
    metal: [0, 768, 256, 256], bone: [256, 768, 256, 256], fur: [512, 768, 256, 256], dark: [768, 768, 256, 256]
  };
  let seed = 19;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const sheet = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const [colour, col] = sheet(), [high, hi] = sheet(), [surface, orm] = sheet();
  hi.fillStyle = 'rgb(128,128,128)'; hi.fillRect(0, 0, N, N);
  const inside = (r, draw) => { for (const g of [col, hi]) { g.save(); g.beginPath(); g.rect(...r); g.clip(); } draw(r[0], r[1], r[2], r[3]); col.restore(); hi.restore(); };
  const fill = (g, r, s) => { g.fillStyle = s; g.fillRect(...r); };
  const line = (g, pts, style, wide) => { g.strokeStyle = style; g.lineWidth = wide; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  const speck = (r, n, a, b, size) => { for (let i = 0; i < n; i++) { col.fillStyle = rnd(0, 1) < 0.5 ? a : b; col.fillRect(r[0] + rnd(0, r[2]), r[1] + rnd(0, r[3]), rnd(1, size), rnd(1, size)); } };

  inside(R.bark, (x, y, w, h) => {                            // ridged bark, running up the log (up the sheet)
    fill(col, R.bark, '#5a3a22');
    for (let i = 0; i < 260; i++) {
      let px = x + rnd(0, w), py = y + rnd(-60, h);
      const pts = [[px, py]], len = rnd(30, 140), wide = rnd(2, 8);
      for (let d = 0; d < len; d += 12) { px += rnd(-5, 5); py += 12; pts.push([px, py]); }
      line(col, pts, `rgba(24,13,6,${rnd(0.45, 0.85)})`, wide);
      line(hi, pts, 'rgba(20,20,20,0.75)', wide);
      const lit = pts.map(p => [p[0] + wide * 0.9, p[1]]);
      line(col, lit, `rgba(160,112,68,${rnd(0.25, 0.55)})`, wide * 0.6);
      line(hi, lit, 'rgba(235,235,235,0.55)', wide * 0.8);
    }
    speck(R.bark, 2600, 'rgba(20,12,6,0.4)', 'rgba(170,128,84,0.3)', 4);
    for (let i = 0; i < 40; i++) { col.fillStyle = `rgba(96,112,48,${rnd(0.12, 0.3)})`; col.beginPath(); col.ellipse(x + rnd(0, w), y + rnd(0, h), rnd(4, 18), rnd(3, 10), rnd(0, 3), 0, 7); col.fill(); }
  });
  const grain = (r, base, dark, light, lines) => inside(r, (x, y, w, h) => {
    fill(col, r, base);
    for (let i = 0; i < 24; i++) { col.fillStyle = rnd(0, 1) < 0.5 ? dark.replace('A', rnd(0.08, 0.2)) : light.replace('A', rnd(0.08, 0.2)); col.fillRect(x, y + rnd(0, h), w, rnd(3, 20)); }
    for (let i = 0; i < lines; i++) {
      const at = y + rnd(0, h), a = rnd(1, 5), f = rnd(0.008, 0.025), p = rnd(0, 6), pts = [];
      for (let px = 0; px <= w; px += 8) pts.push([x + px, at + Math.sin(px * f + p) * a]);
      const k = rnd(0.2, 0.55), wide = rnd(0.7, 2.4);
      line(col, pts, dark.replace('A', k), wide); line(hi, pts, `rgba(40,40,40,${k})`, wide);
    }
    speck(r, 500, dark.replace('A', 0.35), light.replace('A', 0.2), 3);
  });
  grain(R.plank, '#8a5a2c', 'rgba(50,26,8,A)', 'rgba(200,146,84,A)', 90);
  grain(R.cut, '#c79a5e', 'rgba(116,72,30,A)', 'rgba(240,206,146,A)', 30);
  inside(R.end, (x, y, w, h) => {                             // the sawn end of a log: rings and splits
    const cx = x + w / 2, cy = y + h / 2;
    fill(col, R.end, '#4d3320');
    col.fillStyle = '#c0925a'; col.beginPath(); col.arc(cx, cy, w * 0.43, 0, 7); col.fill();
    for (let r = 6; r < w * 0.43; r += rnd(5, 11)) {
      const pts = [];
      for (let a = 0; a <= 6.4; a += 0.2) pts.push([cx + Math.cos(a) * (r + rnd(-1.5, 1.5)), cy + Math.sin(a) * (r + rnd(-1.5, 1.5))]);
      line(col, pts, `rgba(104,64,28,${rnd(0.4, 0.75)})`, rnd(1.2, 3)); line(hi, pts, 'rgba(60,60,60,0.5)', 1.6);
    }
    for (let i = 0; i < 6; i++) { const a = rnd(0, 6.3), r0 = rnd(4, 20), r1 = rnd(50, 105), pts = [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a + 0.08) * r1, cy + Math.sin(a + 0.08) * r1]]; line(col, pts, 'rgba(48,26,12,0.8)', rnd(1.5, 3.5)); line(hi, pts, 'rgba(10,10,10,0.8)', 3); }
    speck(R.end, 700, 'rgba(70,40,16,0.3)', 'rgba(232,196,140,0.3)', 3);
  });
  inside(R.stone, (x, y, w, h) => {
    fill(col, R.stone, '#6f6e69');
    for (let i = 0; i < 700; i++) {
      const px = x + rnd(0, w), py = y + rnd(0, h), s = rnd(3, 22), up = rnd(0, 1) < 0.5;
      col.fillStyle = up ? `rgba(170,168,158,${rnd(0.08, 0.3)})` : `rgba(38,38,36,${rnd(0.08, 0.3)})`;
      col.beginPath(); col.ellipse(px, py, s, s * rnd(0.4, 1), rnd(0, 3), 0, 7); col.fill();
      const g = hi.createRadialGradient(px, py, 0, px, py, s); g.addColorStop(0, up ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(128,128,128,0)'); hi.fillStyle = g; hi.fillRect(px - s, py - s, s * 2, s * 2);
    }
    speck(R.stone, 2200, 'rgba(24,24,22,0.5)', 'rgba(214,210,196,0.4)', 3);
  });
  inside(R.leather, (x, y, w, h) => {
    fill(col, R.leather, '#6b3d1e');
    for (let i = 0; i < 1400; i++) { const px = x + rnd(0, w), py = y + rnd(0, h); line(col, [[px, py], [px + rnd(-9, 9), py + rnd(-9, 9)]], rnd(0, 1) < 0.5 ? 'rgba(34,16,6,0.4)' : 'rgba(170,112,64,0.3)', rnd(0.6, 2)); }
    for (let i = 0; i < 900; i++) { hi.fillStyle = `rgba(30,30,30,${rnd(0.15, 0.4)})`; hi.beginPath(); hi.arc(x + rnd(0, w), y + rnd(0, h), rnd(1, 3), 0, 7); hi.fill(); }
  });
  inside(R.rope, (x, y, w, h) => {                            // twisted cord
    fill(col, R.rope, '#a58652');
    for (let px = -h; px < w + h; px += 15) {
      line(col, [[x + px, y], [x + px + h * 0.7, y + h]], 'rgba(70,48,22,0.75)', 5); line(hi, [[x + px, y], [x + px + h * 0.7, y + h]], 'rgba(0,0,0,0.8)', 5);
      line(col, [[x + px + 7, y], [x + px + 7 + h * 0.7, y + h]], 'rgba(226,196,134,0.6)', 4); line(hi, [[x + px + 7, y], [x + px + 7 + h * 0.7, y + h]], 'rgba(255,255,255,0.7)', 4);
    }
    speck(R.rope, 900, 'rgba(60,40,16,0.4)', 'rgba(240,214,150,0.35)', 2);
  });
  const weave = (r, base, a, b, step) => inside(r, (x, y, w, h) => {     // woven nylon
    fill(col, r, base);
    for (let py = 0; py < h; py += step) for (let px = 0; px < w; px += step) {
      const over = ((px + py) / step) % 2 === 0;
      col.fillStyle = over ? a : b; col.fillRect(x + px, y + py, step - 1, step - 1);
      hi.fillStyle = over ? 'rgb(168,168,168)' : 'rgb(96,96,96)'; hi.fillRect(x + px, y + py, step - 1, step - 1);
    }
    speck(r, 400, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.25)', 3);
  });
  weave(R.nylon, '#17181b', '#1d1f23', '#141518', 2);
  weave(R.web, '#101012', '#1c1d20', '#0a0a0c', 5);
  inside(R.metal, (x, y, w, h) => {
    fill(col, R.metal, '#2c2f34');
    for (let i = 0; i < 700; i++) { const px = x + rnd(-20, w), py = y + rnd(0, h); line(col, [[px, py], [px + rnd(6, 50), py + rnd(-1, 1)]], rnd(0, 1) < 0.5 ? 'rgba(180,188,200,0.16)' : 'rgba(6,7,9,0.28)', rnd(0.5, 1.3)); }
    speck(R.metal, 300, 'rgba(200,205,215,0.2)', 'rgba(0,0,0,0.3)', 2);
  });
  inside(R.bone, (x, y, w, h) => {
    fill(col, R.bone, '#ded1ae');
    for (let i = 0; i < 90; i++) { const px = x + rnd(0, w), py = y + rnd(0, h); line(col, [[px, py], [px + rnd(-6, 6), py + rnd(6, 34)]], 'rgba(122,98,58,0.35)', rnd(0.5, 1.6)); }
    speck(R.bone, 1100, 'rgba(120,96,60,0.25)', 'rgba(255,250,230,0.35)', 3);
  });
  inside(R.fur, (x, y, w, h) => {
    fill(col, R.fur, '#8d6a43');
    for (let i = 0; i < 14; i++) { col.fillStyle = `rgba(54,32,14,${rnd(0.35, 0.7)})`; col.beginPath(); col.ellipse(x + rnd(0, w), y + rnd(0, h), rnd(12, 34), rnd(8, 24), rnd(0, 3), 0, 7); col.fill(); }
    for (let i = 0; i < 4200; i++) { const px = x + rnd(0, w), py = y + rnd(0, h); line(col, [[px, py], [px + rnd(-3, 3), py + rnd(4, 11)]], rnd(0, 1) < 0.5 ? 'rgba(46,28,12,0.4)' : 'rgba(216,180,126,0.32)', 1); line(hi, [[px, py], [px, py + 6]], rnd(0, 1) < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)', 1); }
  });
  fill(col, R.dark, '#0a0807');
  // red: how open to the sky; green: roughness; blue: metal
  const ORM = { bark: [255, 225, 0], plank: [255, 165, 0], end: [255, 190, 0], stone: [255, 200, 0], leather: [255, 150, 0], rope: [255, 215, 0], cut: [255, 175, 0], nylon: [255, 135, 0], web: [235, 190, 0], metal: [255, 90, 220], bone: [255, 120, 0], fur: [235, 235, 0], dark: [90, 255, 0] };
  for (const k in R) fill(orm, R[k], `rgb(${ORM[k].join(',')})`);
  const h = hi.getImageData(0, 0, N, N).data, bumps = hi.createImageData(N, N), out = bumps.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const at = (i, j) => h[(((j + N) % N) * N + ((i + N) % N)) * 4] / 255;
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.4, dy = (at(x, y + 1) - at(x, y - 1)) * 2.4, l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
    out[k] = (-dx / l * 0.5 + 0.5) * 255; out[k + 1] = (dy / l * 0.5 + 0.5) * 255; out[k + 2] = (1 / l * 0.5 + 0.5) * 255; out[k + 3] = 255;
  }
  hi.putImageData(bumps, 0, 0);
  const upload = (art, srgb) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  };
  return { R, N, tex: upload(colour, true), normal: upload(high, false), orm: upload(surface, false) };
})();

// ---------------------------------------------------------------- shaping
// a model is built into one list of points, with every point knowing where on the sheet it is
function Shape() {
  const v = [], idx = [];
  let seed = 5;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };
  const uvAt = (mat, u, t) => { const r = raidArt.R[mat]; return [(r[0] + 5 + clamp(u, 0, 1) * (r[2] - 10)) / raidArt.N, (r[1] + 5 + clamp(t, 0, 1) * (r[3] - 10)) / raidArt.N]; };
  const vert = (p, n, uv) => { v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]); return v.length / 8 - 1; };
  const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
  const S = {
    rnd,
    // a skin over a stack of rings (each the same number of points), facing outwards from the middle of each ring
    loft(rings, mat, o) {
      o = o || {};
      const n = rings[0].length, base = v.length / 8, mids = rings.map(r => V.mul(r.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / r.length));
      const us = o.us || 1, uo = o.uo === undefined ? rnd(0, 1 - us) : o.uo, ts = o.ts || 1, to = o.to === undefined ? rnd(0, 1 - ts) : o.to;
      rings.forEach((r, j) => {
        for (let i = 0; i <= n; i++) {
          const p = r[i % n], a = r[(i + 1) % n], b = r[(i + n - 1) % n], up = rings[Math.min(rings.length - 1, j + 1)][i % n], down = rings[Math.max(0, j - 1)][i % n];
          let nr = V.cross(V.sub(a, b), V.sub(up, down));
          const out = V.sub(p, mids[j]);
          if (V.len(nr) < 1e-9) nr = out;
          if (V.dot(nr, out) < 0) nr = V.mul(nr, -1);
          if (o.inward) nr = V.mul(nr, -1);
          vert(p, V.norm(nr), uvAt(mat, uo + us * i / n, to + ts * j / Math.max(1, rings.length - 1)));
        }
      });
      for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) { const a = base + j * (n + 1) + i; quad(a, a + 1, a + n + 2, a + n + 1); }
    },
    // a flat lid over a ring, facing along nr
    cap(ring, nr, mat) {
      const n = ring.length, mid = V.mul(ring.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / n), side = V.norm(V.sub(ring[0], mid)), up = V.cross(nr, side);
      const R = Math.max(...ring.map(p => V.len(V.sub(p, mid)))) || 1;
      const uv = p => { const d = V.sub(p, mid); return uvAt(mat, 0.5 + V.dot(d, side) / R * 0.43, 0.5 + V.dot(d, up) / R * 0.43); };
      const c = vert(mid, nr, uv(mid)), first = v.length / 8;
      for (const p of ring) vert(p, nr, uv(p));
      for (let i = 0; i < n; i++) idx.push(c, first + i, first + (i + 1) % n);
    },
    // a ring of points round `axis` at c; r may be a function of the angle
    ring(c, axis, r, n, squash) {
      const a = V.norm(axis), x = V.norm(V.orth(Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1], a)), y = V.cross(a, x);
      return Array.from({ length: n }, (_, i) => { const w = i / n * Math.PI * 2, k = typeof r === 'function' ? r(w, i) : r; return V.add(c, V.add(V.mul(x, Math.cos(w) * k), V.mul(y, Math.sin(w) * k * (squash || 1)))); });
    },
    // a round bar along a path of points, radius possibly changing (0..1 along it)
    tube(path, r, mat, o) {
      o = o || {};
      const n = o.sides || 8;
      let side = null;
      const rings = path.map((p, j) => {
        const dir = V.norm(V.sub(path[Math.min(path.length - 1, j + 1)], path[Math.max(0, j - 1)]));
        // for a strap, o.wide says which way its width goes; squash then makes it thin the other way
        side = o.wide ? V.norm(V.orth(o.wide, dir)) : side ? V.norm(V.orth(side, dir)) : V.norm(V.orth(Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], dir));
        const up = V.cross(dir, side), k = typeof r === 'function' ? r(j / (path.length - 1)) : r;
        return Array.from({ length: n }, (_, i) => { const w = i / n * Math.PI * 2; return V.add(p, V.add(V.mul(side, Math.cos(w) * k), V.mul(up, Math.sin(w) * k * (o.squash || 1)))); });
      });
      S.loft(rings, mat, o);
      if (o.caps !== false) { S.cap(rings[0], V.norm(V.sub(path[0], path[1])), o.capMat || mat); S.cap(rings[rings.length - 1], V.norm(V.sub(path[path.length - 1], path[path.length - 2])), o.capMat || mat); }
    },
    // a log from a to b: bumpy bark, sawn ends, and a hewn point on the far end if asked
    log(a, b, r, o) {
      o = o || {};
      const dir = V.norm(V.sub(b, a)), len = V.len(V.sub(b, a)), n = o.sides || 11, J = Math.max(4, Math.round(len / 0.2));
      const knot = Array.from({ length: n }, () => rnd(0.93, 1.08));
      const rings = Array.from({ length: J + 1 }, (_, j) => { const u = j / J, wob = [rnd(-1, 1) * r * 0.05, rnd(-1, 1) * r * 0.05]; return S.ring(V.add(V.mad(a, dir, len * u), [wob[0] * (Math.abs(dir[0]) < 0.5 ? 1 : 0), 0, wob[1] * (Math.abs(dir[2]) < 0.5 ? 1 : 0)]), dir, (w, i) => r * knot[i] * (1.04 - 0.08 * u) * rnd(0.97, 1.03), n); });
      S.loft(rings, o.mat || 'bark', { us: 0.55, ts: clamp(len / 2.4, 0.15, 1) });
      S.cap(rings[0], V.mul(dir, -1), 'end');
      if (!o.point) { S.cap(rings[J], dir, 'end'); return; }
      const tip = V.mad(b, dir, o.point), mid = rings[J].map((p, i) => V.add(V.lerp(p, tip, 0.5), V.mul(V.sub(p, b), rnd(-0.06, 0.12))));
      for (let i = 0; i < n; i++) {                           // hewn with a stone axe: flat facets, pale wood
        const k = (i + 1) % n;
        for (const [p, q, s, t] of [[rings[J][i], rings[J][k], mid[k], mid[i]], [mid[i], mid[k], tip, tip]]) {
          const nr = V.norm(V.cross(V.sub(q, p), V.sub(t, p))), face = V.dot(nr, V.sub(V.lerp(p, s, 0.5), V.mad(a, dir, len))) < 0 ? V.mul(nr, -1) : nr, x = i / n * 0.8;
          quad(vert(p, face, uvAt('cut', x, 0)), vert(q, face, uvAt('cut', x + 0.15, 0)), vert(s, face, uvAt('cut', x + 0.15, 0.9)), vert(t, face, uvAt('cut', x, 0.9)));
        }
      }
    },
    // a box with its edges taken off, so they catch the light. centre c, full size s, turned by M
    slab(c, s, mat, bevel, M) {
      const half = s.map(k => k / 2), b = Math.min(bevel === undefined ? 0.008 : bevel, ...half.map(k => k * 0.8)), at = {};
      const T = M || M3.id(), put = (p, n, uv) => vert(V.add(c, M3.vec(T, p)), M3.vec(T, n), uv);
      for (let a = 0; a < 3; a++) for (const sa of [-1, 1]) {
        const rest = [0, 1, 2].filter(i => i !== a), [u, w] = s[rest[0]] >= s[rest[1]] ? rest : [rest[1], rest[0]];
        const n = [0, 0, 0]; n[a] = sa;
        const su0 = Math.min(1, s[u] / 1.0), sv0 = Math.min(1, s[w] / 0.5), ou = rnd(0, 1 - su0), ov = rnd(0, 1 - sv0);
        for (const su of [-1, 1]) for (const sv of [-1, 1]) {
          const p = [0, 0, 0]; p[a] = sa * half[a]; p[u] = su * (half[u] - b); p[w] = sv * (half[w] - b);
          const key = [0, 0, 0]; key[a] = sa; key[u] = su; key[w] = sv;
          at[a + ':' + key] = put(p, n, uvAt(mat, ou + su0 * (su + 1) / 2, ov + sv0 * (sv + 1) / 2));
        }
      }
      const V3 = (a, key) => at[a + ':' + key];
      for (let a = 0; a < 3; a++) for (const sa of [-1, 1]) {
        const [u, w] = [0, 1, 2].filter(i => i !== a), key = (su, sv) => { const k = [0, 0, 0]; k[a] = sa; k[u] = su; k[w] = sv; return V3(a, k); };
        quad(key(-1, -1), key(1, -1), key(1, 1), key(-1, 1));
      }
      for (let a = 0; a < 3; a++) for (let o = a + 1; o < 3; o++) {
        const t = 3 - a - o;
        for (const sa of [-1, 1]) for (const so of [-1, 1]) {
          const k = st => { const q = [0, 0, 0]; q[a] = sa; q[o] = so; q[t] = st; return q; };
          quad(V3(a, k(-1)), V3(a, k(1)), V3(o, k(1)), V3(o, k(-1)));
        }
      }
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) idx.push(V3(0, [x, y, z]), V3(1, [x, y, z]), V3(2, [x, y, z]));
    },
    // a lumpy stone (or anything round): a ball pushed about
    stone(c, rx, ry, rz, mat, rough, nu, nv) {
      nu = nu || 12; nv = nv || 8;
      const bumps = Array.from({ length: (nv + 1) * nu }, () => 1 + rnd(-rough, rough));
      const rings = [];
      for (let j = 0; j <= nv; j++) {
        const b = (j / nv - 0.5) * Math.PI * 0.985;
        rings.push(Array.from({ length: nu }, (_, i) => { const a = i / nu * Math.PI * 2, k = bumps[j * nu + i]; return V.add(c, [Math.cos(a) * Math.cos(b) * rx * k, Math.sin(b) * ry * k, Math.sin(a) * Math.cos(b) * rz * k]); }));
      }
      S.loft(rings, mat);
    },
    // a crystal: six flat sides and a point
    crystal(c, axis, r, len, mat) {
      const a = V.norm(axis), low = S.ring(c, a, r * 0.82, 6), top = S.ring(V.mad(c, a, len * 0.68), a, r, 6), tip = V.mad(c, a, len);
      const face = (pts) => {
        const nr = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0]))), mid = V.mul(pts.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / pts.length);
        const out = V.dot(nr, V.sub(mid, V.mad(c, a, len * 0.45))) < 0 ? V.mul(nr, -1) : nr;
        const ids = pts.map(p => vert(p, out, uvAt(mat || 'stone', 0.5, 0.5)));
        for (let i = 1; i < ids.length - 1; i++) idx.push(ids[0], ids[i], ids[i + 1]);
      };
      for (let i = 0; i < 6; i++) { const k = (i + 1) % 6; face([low[i], low[k], top[k], top[i]]); face([top[i], top[k], tip]); }
    },
    done() { return v.length ? staticMesh(new Float32Array(v), new Uint32Array(idx)) : null; }
  };
  return S;
}
const arcPts = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
// a model: one mesh painted from the sheet, and any plain-coloured parts (lenses, gems, brass)
const flatPart = (shape, color, rough, metal) => ({ mesh: shape.done(), color, rough, metal });
function drawModel(prog, textured, m, R, p) {
  if (m.mesh) {
    if (textured) {
      gl.uniform1i(prog.u.uHasTex, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, raidArt.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, raidArt.normal);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, raidArt.orm);
    }
    drawMesh(prog, m.mesh, R, p);
  }
  if (m.flats) for (const f of m.flats) { flat(prog, f.color, f.rough, f.metal); drawMesh(prog, f.mesh, R, p); }
}

// ---------------------------------------------------------------- the walls
// 2.4 m of sharpened logs, lashed with rope to two rails behind. x along the wall, +z the outside face, y up from the ground
const WALL = { w: 2.4, h: 2.35, t: 0.34 };
function lashing(S, x, y, r) {
  for (let k = 0; k < 3; k++) S.tube(arcPts(14, u => { const a = u * Math.PI * 2; return [x + Math.cos(a) * (r + 0.012), y + k * 0.034 + Math.sin(a * 2 + k) * 0.007, Math.sin(a) * (r + 0.012)]; }), 0.016, 'rope', { sides: 6, caps: false, us: 1, ts: 0.9 });
}
const wallModel = (() => {
  const S = Shape();
  const xs = [-1.05, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1.05], tall = [2.02, 2.12, 1.98, 2.08, 2.14, 2.0, 2.1, 2.03];
  xs.forEach((x, i) => {
    const r = i % 2 ? 0.150 : 0.158;
    S.log([x, -0.25, 0], [x + S.rnd(-0.012, 0.012), tall[i], 0], r, { point: 0.27 });
    lashing(S, x, 0.46, r); lashing(S, x, 1.56, r);
    if (i % 3 === 1) {                                        // a knot where a branch came off
      const y = S.rnd(0.8, 1.35), z = r * 0.93;
      S.tube([[x, y, z - 0.03], [x + 0.008, y + 0.006, z + 0.024]], u => 0.045 - 0.016 * u, 'bark', { sides: 7, capMat: 'end' });
    }
  });
  for (const y of [0.51, 1.61]) {
    S.log([-1.2, y, -0.19], [1.2, y, -0.19], 0.075);
    for (const x of [-1.05, -0.45, 0.15, 0.75]) S.tube([[x, y - 0.09, -0.10], [x + 0.06, y + 0.01, -0.275], [x + 0.11, y + 0.09, -0.10]], 0.014, 'rope', { sides: 6 });
  }
  S.log([-1.02, 0.62, -0.17], [1.02, 1.5, -0.17], 0.055);       // the cross brace
  for (const [x, y] of [[-1.02, 0.62], [1.02, 1.5]]) S.stone([x, y, -0.23], 0.03, 0.03, 0.022, 'bone', 0.1, 7, 5);
  for (let i = 0; i < 14; i++) {                                // stones packed round the foot
    const x = -1.12 + i * 0.172 + S.rnd(-0.04, 0.04), z = (i % 2 ? 1 : -1) * S.rnd(0.14, 0.2);
    S.stone([x, 0.03, z], S.rnd(0.07, 0.12), S.rnd(0.045, 0.09), S.rnd(0.06, 0.1), 'stone', 0.18, 9, 6);
  }
  return { mesh: S.done() };
})();
// the doorway: two thick posts and a beam; and the door itself, hung from the left post (its own origin at the hinge)
const DOOR = { half: 0.62, h: 1.95 };
const doorFrameModel = (() => {
  const S = Shape();
  for (const s of [-1, 1]) {
    S.log([s * 1.04, -0.25, 0], [s * 1.04, 2.08, 0], 0.165, { point: 0.28 });
    S.log([s * 0.76, -0.25, 0], [s * 0.76, 2.22, 0], 0.14, { point: 0.22 });
    for (const y of [0.4, 1.5]) { lashing(S, s * 1.04, y, 0.165); lashing(S, s * 0.76, y, 0.14); S.log([s * 1.2, y + 0.05, -0.18], [s * 0.64, y + 0.05, -0.18], 0.07); }
    for (let i = 0; i < 4; i++) S.stone([s * (0.7 + i * 0.15), 0.03, (i % 2 ? 1 : -1) * 0.17], 0.1, 0.07, 0.085, 'stone', 0.18, 9, 6);
  }
  S.log([-1.06, 2.04, 0.02], [1.06, 2.04, 0.02], 0.115);
  for (const x of [-0.76, 0.76]) for (let k = 0; k < 3; k++) S.tube(arcPts(12, u => { const a = u * Math.PI * 2; return [x - 0.03 + k * 0.03, 2.04 + Math.sin(a) * 0.132, 0.02 + Math.cos(a) * 0.132]; }), 0.014, 'rope', { sides: 6, caps: false });
  // a skull over the door
  S.stone([0, 2.2, 0.1], 0.105, 0.095, 0.09, 'bone', 0.05, 12, 9);
  S.stone([0, 2.125, 0.115], 0.06, 0.04, 0.06, 'bone', 0.05, 9, 6);
  for (const s of [-1, 1]) {
    S.stone([s * 0.04, 2.205, 0.183], 0.027, 0.03, 0.016, 'dark', 0.02, 8, 6);
    S.tube(arcPts(8, u => [s * (0.08 + 0.2 * u), 2.23 + 0.12 * u * u, 0.1 - 0.02 * u]), u => 0.032 * (1 - 0.85 * u), 'bone', { sides: 7 });
  }
  return { mesh: S.done() };
})();
const doorModel = (() => {
  const S = Shape(), W = DOOR.half * 2;
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * W / 6, top = DOOR.h - 0.05 - S.rnd(0, 0.07);
    S.slab([x, (top + 0.04) / 2, 0], [W / 6 - 0.008, top - 0.04, 0.075], 'plank', 0.014);
  }
  for (const y of [0.38, 1.45]) {
    S.slab([DOOR.half, y, -0.06], [W - 0.06, 0.13, 0.045], 'plank', 0.012);
    S.slab([DOOR.half, y, 0.046], [W - 0.04, 0.085, 0.018], 'leather', 0.006);
    for (let i = 0; i < 6; i++) S.stone([(i + 0.5) * W / 6, y, 0.062], 0.019, 0.019, 0.013, 'bone', 0.08, 7, 5);
  }
  S.slab([DOOR.half, 0.915, -0.062], [1.5, 0.11, 0.04], 'plank', 0.012, M3.rz(0.74));
  // a patch of hide and a bone for a handle
  S.slab([DOOR.half - 0.05, 1.05, 0.045], [0.5, 0.42, 0.012], 'fur', 0.005, M3.rz(0.08));
  for (const [x, y] of [[-0.23, 0.18], [0.23, 0.18], [-0.23, -0.18], [0.23, -0.18]]) S.stone([DOOR.half - 0.05 + x, 1.05 + y, 0.058], 0.017, 0.017, 0.011, 'bone', 0.08, 7, 5);
  S.tube([[W - 0.17, 0.86, 0.1], [W - 0.17, 1.14, 0.1]], 0.026, 'bone', { sides: 8 });
  for (const y of [0.86, 1.14]) { S.stone([W - 0.17, y, 0.1], 0.042, 0.035, 0.035, 'bone', 0.08, 8, 6); S.tube([[W - 0.17, y + (y < 1 ? 0.03 : -0.03), 0.035], [W - 0.17, y + (y < 1 ? 0.03 : -0.03), 0.1]], 0.014, 'leather', { sides: 6 }); }
  return { mesh: S.done() };
})();

// ---------------------------------------------------------------- the hammer
// a river stone lashed to a stout handle. the origin is where the fist goes, +y towards the head, the striking faces along z
const hammerModel = (() => {
  const S = Shape();
  S.tube(arcPts(8, u => [0.006 * Math.sin(u * 5), -0.12 + 0.46 * u, 0.004 * Math.sin(u * 7)]), u => 0.022 + 0.004 * Math.sin(u * 9) + (u < 0.06 ? 0.007 : 0), 'plank', { sides: 9, capMat: 'end' });
  for (let k = 0; k < 11; k++) S.tube(arcPts(10, u => { const a = u * Math.PI * 2; return [Math.cos(a) * 0.026, -0.09 + k * 0.0145 + u * 0.0145, Math.sin(a) * 0.026]; }), 0.0072, 'leather', { sides: 5, caps: false });
  S.tube([[0.02, -0.095, 0.01], [0.045, -0.15, 0.018], [0.038, -0.2, 0.03]], 0.0055, 'leather', { sides: 5 });
  // the stone: a squared-off cobble with both faces ground flat
  const face = (z, r) => S.ring([0, 0.325, z], [0, 0, 1], (w) => r * (1 + 0.09 * Math.sin(w * 3 + z * 20) + 0.05 * Math.sin(w * 7)), 14, 0.92);
  const rings = [face(-0.115, 0.045), face(-0.105, 0.06), face(-0.065, 0.07), face(0, 0.064), face(0.065, 0.071), face(0.108, 0.058), face(0.118, 0.043)];
  S.loft(rings, 'stone', { us: 1, ts: 1 });
  S.cap(rings[0], [0, 0, -1], 'stone'); S.cap(rings[rings.length - 1], [0, 0, 1], 'stone');
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {        // crossed lashings round head and handle
    S.tube(arcPts(18, u => { const a = u * Math.PI * 2; return [Math.cos(a) * 0.072, 0.325 + Math.sin(a) * 0.068, s * (0.017 + k * 0.009) * Math.sin(a + s)]; }), 0.0062, 'leather', { sides: 5, caps: false });
  }
  for (let k = 0; k < 4; k++) S.tube(arcPts(10, u => { const a = u * Math.PI * 2; return [Math.cos(a) * 0.027, 0.222 + k * 0.012 + u * 0.012, Math.sin(a) * 0.027]; }), 0.0066, 'leather', { sides: 5, caps: false });
  S.stone([0, 0.405, 0], 0.017, 0.012, 0.017, 'end', 0.08, 8, 5);
  return { mesh: S.done() };
})();

// ---------------------------------------------------------------- the duffel bag
// black ballistic nylon with a zip, two grab handles, a padded shoulder strap, end pockets and steel rings.
// x along the bag, y up, resting on its flat bottom (y = 0), 0.66 long
const BAG = { len: 0.66, h: 0.30 }, BAG_FLOOR = 0.012;
const makeBag = slack => {
  const S = Shape(), brass = Shape(), HL = BAG.len / 2;
  const section = (x, ry, rz, drop) => Array.from({ length: 22 }, (_, i) => {
    const a = i / 22 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const y = Math.sign(s) * Math.pow(Math.abs(s), 0.78) * ry, z = Math.sign(c) * Math.pow(Math.abs(c), 0.78) * rz;
    const crease = 1 + 0.025 * Math.sin(x * 47 + a * 3) + 0.018 * Math.sin(x * 23 - a * 5);
    return [x, Math.max(0.006, 0.145 - (drop || 0) + y * crease), z * crease];
  });
  const profile = [[-HL, 0.085, 0.09], [-HL + 0.02, 0.118, 0.122], [-HL + 0.07, 0.138, 0.143], [-0.2, 0.146, 0.150], [-0.08, 0.132, 0.147], [0.03, 0.128, 0.150], [0.13, 0.137, 0.146], [0.23, 0.145, 0.148], [HL - 0.07, 0.137, 0.142], [HL - 0.02, 0.116, 0.122], [HL, 0.085, 0.09]];
  const rings = profile.map(([x, ry, rz]) => section(x, ry, rz, (0.146 - ry) * 0.2));
  S.loft(rings, 'nylon', { us: 1, ts: 1, uo: 0, to: 0 });
  S.cap(rings[0], [-1, 0, 0], 'nylon'); S.cap(rings[rings.length - 1], [1, 0, 0], 'nylon');
  const topAt = x => { let k = 0; while (k < profile.length - 2 && profile[k + 1][0] < x) k++; const a = profile[k], b = profile[k + 1], u = clamp((x - a[0]) / (b[0] - a[0]), 0, 1), ry = a[1] + (b[1] - a[1]) * u; return 0.145 - (0.146 - ry) * 0.2 + ry; };
  for (const s of [-1, 1]) {                                    // piping round each end, and the end pockets
    const e = s * (HL - 0.045);
    S.tube(section(e, 0.1385, 0.1435).concat([section(e, 0.1385, 0.1435)[0]]), 0.0085, 'web', { sides: 6, caps: false });
    const flap = k => Array.from({ length: 18 }, (_, i) => { const a = i / 18 * Math.PI * 2, c = Math.cos(a), t = Math.sin(a); return [s * (HL - 0.004 + k.d), 0.13 + Math.sign(t) * Math.pow(Math.abs(t), 0.6) * k.y, Math.sign(c) * Math.pow(Math.abs(c), 0.6) * k.z]; });
    const outer = [flap({ d: 0, y: 0.075, z: 0.085 }), flap({ d: 0.024, y: 0.07, z: 0.08 }), flap({ d: 0.032, y: 0.055, z: 0.064 })];
    S.loft(outer, 'nylon'); S.cap(outer[2], [s, 0, 0], 'nylon');
    S.tube([[s * (HL + 0.031), 0.172, -0.058], [s * (HL + 0.031), 0.172, 0.058]], 0.0045, 'metal', { sides: 6 });
    S.tube([[s * (HL + 0.033), 0.172, 0.03], [s * (HL + 0.036), 0.14, 0.032]], 0.004, 'web', { sides: 5 });
    // D rings for the shoulder strap
    S.slab([s * (HL - 0.05), 0.292, 0], [0.05, 0.012, 0.06], 'web', 0.004);
    S.tube(arcPts(12, u => { const a = u * Math.PI * 2; return [s * (HL - 0.05) + Math.cos(a) * 0.004, 0.31 + Math.sin(a) * 0.022, Math.cos(a) * 0.027]; }), 0.0048, 'metal', { sides: 6, caps: false });
  }
  // the zip along the top: tape, two rows of teeth and the pull
  const zipX = arcPts(30, u => -HL + 0.075 + u * (BAG.len - 0.15));
  for (const z of [-0.016, 0.016]) S.tube(zipX.map(x => [x, topAt(x) - 0.003, z]), 0.0075, 'web', { sides: 6, squash: 0.6, wide: [0, 0, 1] });
  for (let x = -HL + 0.085; x < HL - 0.085; x += 0.0095) for (const z of [-0.0048, 0.0048]) brass.slab([x + (z > 0 ? 0.0047 : 0), topAt(x) + 0.001, z], [0.0052, 0.0048, 0.0072], 'metal', 0.0012);
  brass.slab([HL - 0.105, topAt(HL - 0.105) + 0.007, 0], [0.028, 0.012, 0.02], 'metal', 0.004);
  brass.tube([[HL - 0.092, topAt(HL - 0.092) + 0.01, 0], [HL - 0.05, topAt(HL - 0.05) + 0.014, 0.012]], 0.0035, 'metal', { sides: 6 });
  S.tube([[HL - 0.055, topAt(HL - 0.055) + 0.014, 0.011], [HL - 0.01, topAt(HL - 0.02) - 0.012, 0.028]], 0.0065, 'web', { sides: 6, squash: 0.45, wide: [0, 0, 1] });
  // two grab handles: webbing sewn right down the sides and arching up over the top
  for (const z of [-1, 1]) {
    for (const x of [-0.105, 0.105]) {
      S.tube(arcPts(10, u => { const a = -0.55 + u * 1.9; return [x, 0.145 + Math.sin(a) * 0.150, z * (Math.cos(a) * 0.155 + 0.002)]; }), 0.017, 'web', { sides: 8, squash: 0.28, wide: [1, 0, 0] });
      S.slab([x, 0.17, z * 0.157], [0.044, 0.05, 0.006], 'web', 0.002);
      for (const dy of [-0.016, 0.016]) brass.stone([x, 0.17 + dy, z * 0.162], 0.0038, 0.0038, 0.0025, 'metal', 0, 6, 4);
    }
    S.tube(arcPts(14, u => [-0.105 + u * 0.21, 0.282 + Math.sin(u * Math.PI) * 0.075, z * (0.06 - 0.035 * Math.sin(u * Math.PI))]), u => (u > 0.28 && u < 0.72 ? 0.0165 : 0.0125), 'web', { sides: 8, squash: 0.55, wide: [0, 0, 1] });
  }
  for (const x of [-0.105, 0.105]) for (const z of [-1, 1]) S.tube([[x, 0.262, z * 0.105], [x, 0.285, z * 0.06]], 0.015, 'web', { sides: 8, squash: 0.3, wide: [1, 0, 0] });
  // a flat side pocket with its own zip and a patch
  const pocket = [S.ring([0, 0.13, 0.140], [0, 0, 1], w => 0.1 / Math.pow(Math.pow(Math.abs(Math.cos(w)), 4) + Math.pow(Math.abs(Math.sin(w)) * 1.55, 4), 0.25), 28), S.ring([0, 0.13, 0.168], [0, 0, 1], w => 0.092 / Math.pow(Math.pow(Math.abs(Math.cos(w)), 4) + Math.pow(Math.abs(Math.sin(w)) * 1.6, 4), 0.25), 28)];
  S.loft(pocket, 'nylon'); S.cap(pocket[1], [0, 0, 1], 'nylon');
  S.tube([[-0.07, 0.165, 0.171], [0.07, 0.165, 0.171]], 0.0045, 'metal', { sides: 6 });
  S.slab([0, 0.115, 0.171], [0.07, 0.045, 0.006], 'leather', 0.002);
  brass.tube([[-0.018, 0.115, 0.176], [0.018, 0.115, 0.176]], 0.0046, 'bone', { sides: 7 });
  for (const x of [-0.019, 0.019]) for (const y of [-0.005, 0.005]) brass.stone([x, 0.115 + y, 0.176], 0.006, 0.006, 0.004, 'bone', 0, 7, 5);
  // the shoulder strap, slack down the back side, with its pad
  if (slack) {
    const strap = arcPts(26, u => [-HL + 0.05 + u * (BAG.len - 0.1), 0.31 - Math.sin(u * Math.PI) * 0.255, -Math.sin(u * Math.PI) * 0.2 - Math.sin(u * Math.PI * 2) * 0.012]);
    S.tube(strap, 0.019, 'web', { sides: 8, squash: 0.25, wide: [0, 1, 0] });
    S.tube(strap.slice(9, 18), u => 0.03 * (0.75 + 0.25 * Math.sin(u * Math.PI)), 'nylon', { sides: 10, squash: 0.34, wide: [0, 1, 0] });
    for (const k of [6, 21]) S.slab(strap[k], [0.05, 0.022, 0.034], 'metal', 0.006);
  }
  return { mesh: S.done(), flats: [flatPart(brass, [0.36, 0.37, 0.40], 0.28, 0.95)] };
};
const bagModel = makeBag(true), bagBodyModel = makeBag(false);

// ---------------------------------------------------------------- the bag on his back
// it hangs slantwise from one broad strap that goes over his left shoulder, across his chest and round under his right
// arm. the strap is fitted to his own body: a slice is cut through his trunk along that slant and the strap follows it
const worn = (() => {
  const d = V.norm([0.62, 0.78, 0]), n = V.norm(V.cross([0, 0, 1], d)), mid = V.add(Rig.rest[IDX.chest], [0, -0.03, 0]);
  const trunk = ['hips', 'spine', 'chest', 'clavicle_L', 'clavicle_R'], pts = [];
  for (const prim of Rig.prims) {
    const { pos, j, w } = prim.cpu;
    for (let i = 0; i < pos.length / 3; i++) {
      let on = 0;
      for (let k = 0; k < 4; k++) if (trunk.includes(Rig.names[j[i * 4 + k]])) on += w[i * 4 + k];
      if (on < 0.55) continue;
      const q = V.sub([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], mid);
      if (Math.abs(V.dot(q, n)) < 0.045) pts.push([V.dot(q, d), q[2]]);
    }
  }
  // the outline round that slice (u along the strap's slant, z front to back)
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = list => { const out = []; for (const p of list) { while (out.length > 1) { const a = out[out.length - 2], b = out[out.length - 1]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0) break; out.pop(); } out.push(p); } out.pop(); return out; };
  const hull = half(pts).concat(half(pts.slice().reverse()));
  // how far out his body goes in a direction (u, z) from the middle
  const reachTo = a => {
    const dx = Math.cos(a), dz = Math.sin(a);
    let best = 0;
    for (let k = 0; k < hull.length; k++) {
      const p = hull[k], q = hull[(k + 1) % hull.length], ex = q[0] - p[0], ez = q[1] - p[1], det = ex * dz - ez * dx;
      if (Math.abs(det) < 1e-9) continue;
      const t = (ex * p[1] - ez * p[0]) / det, s = (dx * p[1] - dz * p[0]) / det;
      if (t > 0 && s >= -0.001 && s <= 1.001) best = Math.max(best, t);
    }
    return best;
  };
  const at = (a, out) => { const r = reachTo(a) + out; return V.add(mid, V.add(V.mul(d, Math.cos(a) * r), [0, 0, Math.sin(a) * r])); };
  // the bag, flat against his back
  const back = Math.min(...hull.filter(p => Math.abs(p[0]) < 0.2).map(p => p[1])), size = 0.86;
  const R = M3.cols(d, [0, 0, -1], V.cross(d, [0, 0, -1])).map(v => v * size);
  const p = V.add(mid, [0, 0, back + 0.05]);                       // the side that lies against him, pressed in a little
  const lift = -BAG_FLOOR * size;
  const bagAt = V.add(p, [0, 0, -lift]);
  // the strap: from the top end of the bag, over the shoulder, across the chest, round the side, to the bottom end
  const end = s => V.add(bagAt, M3.vec(R, [s * (BAG.len / 2 - 0.01), 0.17, 0]));
  const A0 = -0.8, A1 = Math.PI + 0.8, path = [end(1)];           // angles: 0 towards the shoulder, 90° the front
  for (let i = 0; i <= 44; i++) path.push(at(A0 + (A1 - A0) * i / 44, 0.016));
  path.push(end(-1));
  for (let k = 0; k < 2; k++) for (let i = 1; i < path.length - 1; i++) path[i] = V.mul(V.add(V.add(path[i - 1], path[i]), V.add(path[i], path[i + 1])), 0.25);
  const S = Shape(), steel = Shape();
  S.tube(path, 0.03, 'web', { sides: 10, squash: 0.2, wide: n, ts: 1, us: 1 });
  for (const off of [-0.02, 0.02]) S.tube(path.map(q => V.add(V.mad(q, n, off), V.mul(V.norm(V.sub(q, mid)), 0.0062))), 0.0018, 'rope', { sides: 5, caps: false });
  // the padded part on the shoulder, and the buckle on the chest
  const pad = []; for (let i = 0; i <= 12; i++) pad.push(at(-0.05 + i / 12 * 1.0, 0.025));
  S.tube(pad, u => 0.043 * (0.75 + 0.25 * Math.sin(u * Math.PI)), 'nylon', { sides: 12, squash: 0.3, wide: n });
  const frame = (a, wide, long) => {
    const c = at(a, 0.027), along = V.norm(V.sub(at(a + 0.05, 0.027), at(a - 0.05, 0.027))), out = V.norm(V.cross(along, n));
    const face = V.dot(out, V.sub(c, mid)) < 0 ? V.mul(out, -1) : out, M = M3.cols(along, n, face);
    for (const s of [-1, 1]) { steel.slab(V.mad(c, n, s * wide / 2), [long, 0.01, 0.012], 'metal', 0.003, M); steel.slab(V.mad(c, along, s * long / 2), [0.009, wide + 0.01, 0.012], 'metal', 0.003, M); }
    steel.slab(c, [0.008, wide, 0.008], 'metal', 0.002, M);
  };
  frame(1.55, 0.066, 0.052);
  frame(1.0, 0.062, 0.022);
  for (const s of [-1, 1]) { const e = end(s), q = path[s > 0 ? 3 : path.length - 4], along = V.norm(V.sub(q, e)); steel.slab(V.mad(e, along, 0.035), [0.05, 0.07, 0.016], 'metal', 0.005, M3.cols(along, n, V.cross(along, n))); }
  return { R, at: bagAt, strap: { mesh: S.done(), flats: [flatPart(steel, [0.30, 0.31, 0.34], 0.3, 0.95)] } };
})();

// ---------------------------------------------------------------- the work table
// split-plank top on log legs, with a stone anvil, a bone vice, tools on a back board. +z is the side you stand at
const BENCH = { w: 1.5, d: 0.74, h: 0.9 };
const benchModel = (() => {
  const S = Shape(), brass = Shape(), dark = Shape();
  for (let i = 0; i < 4; i++) { const z = -0.27 + i * 0.18; S.slab([S.rnd(-0.008, 0.008), 0.865, z], [1.5 + S.rnd(-0.03, 0.02), 0.07, 0.172], 'plank', 0.016); }
  for (const x of [-0.66, 0.66]) {
    for (const z of [-0.29, 0.29]) S.log([x * 1.02, -0.04, z * 1.06], [x, 0.84, z], 0.062);
    S.log([x, 0.3, -0.35], [x, 0.3, 0.35], 0.037);
    S.log([x, 0.8, -0.34], [x, 0.8, 0.34], 0.042);
    for (const z of [-0.29, 0.29]) for (let k = 0; k < 2; k++) S.tube(arcPts(10, u => { const a = u * Math.PI * 2; return [x + Math.cos(a) * 0.072, 0.79 + k * 0.026, z + Math.sin(a) * 0.072]; }), 0.012, 'rope', { sides: 5, caps: false });
  }
  S.log([-0.7, 0.3, -0.28], [0.7, 0.3, -0.28], 0.034);
  for (let i = 0; i < 3; i++) S.slab([0, 0.345, -0.16 + i * 0.16], [1.28, 0.03, 0.14], 'plank', 0.01);
  // under it: a rolled hide, a basket of stones, a spare log
  S.tube([[-0.5, 0.43, -0.06], [-0.12, 0.43, -0.04]], 0.07, 'fur', { sides: 12, capMat: 'leather' });
  for (const x of [-0.42, -0.2]) S.tube(arcPts(12, u => { const a = u * Math.PI * 2; return [x, 0.43 + Math.sin(a) * 0.073, -0.05 + Math.cos(a) * 0.073]; }), 0.008, 'rope', { sides: 5, caps: false });
  S.tube([[0.34, 0.36, 0], [0.34, 0.48, 0]], u => 0.11 + 0.025 * u, 'leather', { sides: 14, caps: false });
  for (let i = 0; i < 7; i++) S.stone([0.34 + S.rnd(-0.07, 0.07), 0.45 + S.rnd(-0.01, 0.04), S.rnd(-0.07, 0.07)], 0.045, 0.035, 0.04, 'stone', 0.2, 8, 6);
  // the back board with pegs and tools
  for (const x of [-0.7, 0.7]) S.log([x, 0.86, -0.36], [x, 1.62, -0.37], 0.036, { point: 0.07 });
  for (let i = 0; i < 3; i++) S.slab([0, 1.18 + i * 0.145, -0.38], [1.46, 0.13, 0.035], 'plank', 0.01);
  const peg = (x, y) => S.tube([[x, y, -0.365], [x, y + 0.01, -0.315]], 0.011, 'bone', { sides: 6 });
  // a bone saw
  peg(-0.52, 1.47); peg(-0.24, 1.47);
  S.slab([-0.35, 1.42, -0.345], [0.36, 0.055, 0.012], 'bone', 0.003);
  for (let i = 0; i < 17; i++) S.crystal([-0.52 + i * 0.021, 1.395, -0.345], [0, -1, 0], 0.007, 0.022, 'bone');
  S.tube([[-0.17, 1.43, -0.345], [-0.09, 1.40, -0.345]], 0.022, 'leather', { sides: 8 });
  // a stone axe and a little hammer hanging
  for (const [x, len] of [[0.12, 0.34], [0.34, 0.27]]) {
    peg(x - 0.035, 1.5); peg(x + 0.035, 1.5);
    S.tube([[x, 1.52, -0.335], [x + 0.01, 1.52 - len, -0.335]], 0.018, 'plank', { sides: 8, capMat: 'end' });
    S.stone([x + 0.01, 1.525, -0.33], 0.085, 0.045, 0.038, 'stone', 0.12, 10, 7);
    for (const k of [-1, 1]) S.tube([[x - 0.025, 1.5, -0.3], [x + 0.03, 1.55, -0.3 + k * 0.004]], 0.006, 'leather', { sides: 5 });
  }
  // a coil of rope
  peg(0.57, 1.45);
  for (let k = 0; k < 5; k++) S.tube(arcPts(18, u => { const a = u * Math.PI * 2; return [0.57 + Math.sin(a) * (0.082 - k * 0.003), 1.36 + Math.cos(a) * (0.088 - k * 0.004), -0.345 + k * 0.006]; }), 0.009, 'rope', { sides: 5, caps: false });
  // on top: a hide mat, the stone anvil, a vice, a knife, loose shells and gun springs
  S.slab([-0.1, 0.906, 0.07], [0.52, 0.012, 0.36], 'leather', 0.004, M3.ry(0.06));
  S.stone([0.52, 0.955, -0.07], 0.14, 0.065, 0.11, 'stone', 0.09, 14, 8);
  for (const x of [-0.69, -0.58]) S.slab([x, 0.975, 0.24], [0.045, 0.15, 0.13], 'plank', 0.014);
  S.tube([[-0.76, 0.97, 0.24], [-0.5, 0.97, 0.24]], 0.016, 'bone', { sides: 8 });
  S.tube([[-0.76, 1.03, 0.24], [-0.76, 0.91, 0.24]], 0.011, 'bone', { sides: 6 });
  S.crystal([0.13, 0.922, 0.17], [1, 0, 0.35], 0.017, 0.17, 'stone');
  S.tube([[0.03, 0.92, 0.135], [0.135, 0.92, 0.172]], 0.019, 'leather', { sides: 8 });
  for (let i = 0; i < 11; i++) {
    const x = 0.28 + S.rnd(-0.12, 0.16), z = 0.2 + S.rnd(-0.08, 0.06), a = S.rnd(0, 6.3), d = [Math.cos(a) * 0.027, 0, Math.sin(a) * 0.027];
    brass.tube([[x - d[0], 0.912, z - d[2]], [x + d[0], 0.912, z + d[2]]], 0.0085, 'metal', { sides: 8 });
  }
  // a gun barrel being worked on
  dark.tube([[-0.34, 0.934, 0.02], [0.14, 0.934, -0.02]], 0.018, 'metal', { sides: 10, capMat: 'dark' });
  for (const u of [0.2, 0.75]) dark.tube([[-0.34 + 0.48 * u - 0.022, 0.934, 0.02 - 0.04 * u + 0.002], [-0.34 + 0.48 * u + 0.022, 0.934, 0.02 - 0.04 * u - 0.002]], 0.025, 'metal', { sides: 10 });
  return { mesh: S.done(), flats: [flatPart(brass, [0.80, 0.56, 0.18], 0.28, 1), flatPart(dark, [0.10, 0.11, 0.13], 0.35, 0.9)] };
})();

// ---------------------------------------------------------------- the stash
// a crate of split logs with corner posts, rope and a hide-covered lid on leather hinges. +z is the front
const STASH = { w: 0.96, h: 0.55, d: 0.62 };
const stashModel = (() => {
  const S = Shape();
  for (let k = 0; k < 4; k++) {
    const y = 0.075 + k * 0.118;
    for (const z of [-0.27, 0.27]) S.log([-0.47, y, z], [0.47, y, z], 0.062);
    for (const x of [-0.43, 0.43]) S.log([x, y + 0.04, -0.3], [x, y + 0.04, 0.3], 0.055);
  }
  for (const x of [-0.45, 0.45]) for (const z of [-0.285, 0.285]) {
    S.log([x, -0.03, z], [x, 0.52, z], 0.058, { point: 0.07 });
    for (const y of [0.1, 0.36]) lashing2(S, x, y, z, 0.062);
  }
  S.slab([0, 0.045, 0], [0.86, 0.03, 0.52], 'plank', 0.008);
  for (const z of [-0.215, 0.215]) S.slab([0, 0.26, z], [0.82, 0.42, 0.01], 'dark', 0.002);
  for (const x of [-0.385, 0.385]) S.slab([x, 0.26, 0], [0.01, 0.42, 0.44], 'dark', 0.002);
  // stones round the foot, so it looks half dug in
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; S.stone([Math.cos(a) * 0.55 + S.rnd(-0.03, 0.03), 0.02, Math.sin(a) * 0.38 + S.rnd(-0.03, 0.03)], S.rnd(0.07, 0.11), S.rnd(0.04, 0.07), S.rnd(0.06, 0.09), 'stone', 0.2, 9, 6); }
  return { mesh: S.done() };
})();
function lashing2(S, x, y, z, r) {
  for (let k = 0; k < 3; k++) S.tube(arcPts(10, u => { const a = u * Math.PI * 2; return [x + Math.cos(a) * (r + 0.008), y + k * 0.022, z + Math.sin(a) * (r + 0.008)]; }), 0.011, 'rope', { sides: 5, caps: false });
}
// its lid, in its own space: hinged at the back (z = 0), reaching forward
const stashLidModel = (() => {
  const S = Shape();
  for (let i = 0; i < 5; i++) { const z = 0.07 + i * 0.128; S.log([-0.5, 0.012 + 0.045 * Math.sin((i + 0.5) / 5 * Math.PI), z], [0.5, 0.012 + 0.045 * Math.sin((i + 0.5) / 5 * Math.PI), z], 0.062); }
  const over = x => arcPts(14, u => { const z = 0.005 + u * 0.66, i = clamp(z / 0.128 - 0.55, 0, 4); return [x, 0.082 + 0.045 * Math.sin((i + 0.5) / 5 * Math.PI), z]; });
  S.tube(over(0), 0.17, 'fur', { sides: 10, squash: 0.08, wide: [1, 0, 0] });
  for (const x of [-0.31, 0.31]) {
    S.tube(over(x), 0.028, 'leather', { sides: 8, squash: 0.45, wide: [1, 0, 0] });
    for (const k of [2, 7, 12]) S.stone([x, over(x)[k][1] + 0.016, over(x)[k][2]], 0.017, 0.012, 0.017, 'bone', 0.06, 7, 5);
    S.tube([[x, 0.05, -0.02], [x, 0.01, 0.06]], 0.03, 'leather', { sides: 8, squash: 0.4, wide: [1, 0, 0] });
  }
  S.tube([[0, 0.085, 0.63], [0, -0.04, 0.685]], 0.019, 'leather', { sides: 8, squash: 0.5, wide: [1, 0, 0] });
  S.tube([[-0.07, -0.045, 0.695], [0.07, -0.045, 0.695]], 0.018, 'bone', { sides: 9 });
  return { mesh: S.done() };
})();

// ---------------------------------------------------------------- shiny rocks
const GEMS = [[0.05, 0.75, 0.9], [0.55, 0.12, 0.95], [0.95, 0.6, 0.06], [0.08, 0.85, 0.32]];
const rockModel = (() => {
  const base = Shape(), sets = GEMS.map(() => Shape()), S = base;
  for (let i = 0; i < 9; i++) { const a = i * 2.4; S.stone([Math.cos(a) * 0.075 * (i / 9 + 0.2), 0.022, Math.sin(a) * 0.07 * (i / 9 + 0.2)], 0.055, 0.03, 0.05, 'stone', 0.22, 9, 6); }
  const spots = [[0, 0.03, 0, 0, 0, 0.044, 0.19, 0], [0.055, 0.025, 0.02, 0.5, 0.2, 0.03, 0.13, 1], [-0.058, 0.025, 0.012, -0.55, 0.1, 0.028, 0.12, 2], [0.012, 0.022, -0.055, 0.1, -0.6, 0.027, 0.11, 3], [-0.015, 0.025, 0.058, -0.15, 0.7, 0.025, 0.1, 0],
    [0.085, 0.02, -0.04, 0.9, -0.4, 0.02, 0.075, 2], [-0.07, 0.02, -0.052, -0.8, -0.6, 0.022, 0.08, 1], [0.045, 0.02, 0.07, 0.5, 0.9, 0.018, 0.065, 3], [-0.095, 0.015, 0.045, -1, 0.5, 0.016, 0.055, 0]];
  for (const [x, y, z, tx, tz, r, len, c] of spots) sets[c].crystal([x, y, z], [tx, 1, tz], r, len);
  return { mesh: base.done(), flats: sets.map((s, c) => flatPart(s, GEMS[c], 0.12, 0.82)) };
})();

// ---------------------------------------------------------------- gun parts, in the gun's own space (+z muzzle)
// each is built round its mounting point
// a turned part along z: rings of [z, radius] about a line at height y
function turned(S, profile, mat, o) {
  o = o || {};
  const rings = profile.map(([z, r]) => S.ring([0, o.y || 0, z], [0, 0, 1], r, o.sides || 32));
  S.loft(rings, mat || 'metal', { us: 1, ts: 1, uo: 0, to: 0, inward: o.inward });
  return rings;
}
// a plain matte can: knurled collar at the back, one long smooth tube, two thin bands and a recessed muzzle end
const silencerModel = (() => {
  const tube = Shape(), steel = Shape(), bore = Shape();
  // mount: the narrow part that screws on to the barrel
  const m = turned(tube, [[-0.016, 0.0095], [-0.015, 0.0115], [0.001, 0.0115]]);
  tube.cap(m[0], [0, 0, -1], 'metal');
  turned(tube, [[0, 0.0115], [0.001, 0.0172], [0.003, 0.0186], [0.006, 0.0186]]);
  turned(steel, [[0.006, 0.0182], [0.027, 0.0182]]);
  for (let i = 0; i < 40; i++) { const w = i / 40 * Math.PI * 2; steel.slab([Math.cos(w) * 0.0185, Math.sin(w) * 0.0185, 0.0165], [0.0018, 0.0015, 0.019], 'metal', 0.0004, M3.rz(w + Math.PI / 2)); }
  turned(tube, [[0.027, 0.0186], [0.03, 0.0186], [0.032, 0.0172], [0.034, 0.0172], [0.036, 0.019], [0.184, 0.019], [0.1865, 0.0183], [0.188, 0.0168]]);
  for (const z of [0.045, 0.171]) turned(steel, [[z, 0.0189], [z + 0.0006, 0.0194], [z + 0.0026, 0.0194], [z + 0.0032, 0.0189]]);
  // the muzzle end: a flat ring, a step in, and the black of the hole
  const face = [steel.ring([0, 0, 0.188], [0, 0, 1], 0.0168, 32), steel.ring([0, 0, 0.1886], [0, 0, 1], 0.0105, 32)];
  steel.loft(face, 'metal');
  turned(tube, [[0.1886, 0.0105], [0.18, 0.0068]], 'metal', { inward: true });
  bore.cap(bore.ring([0, 0, 0.1801], [0, 0, 1], 0.0069, 24), [0, 0, 1], 'dark');
  return { flats: [flatPart(tube, [0.026, 0.027, 0.030], 0.58, 0.55), flatPart(steel, [0.085, 0.088, 0.095], 0.42, 0.8), flatPart(bore, [0.001, 0.001, 0.001], 1, 0)], len: 0.188 };
})();
// a small closed tube sight on a riser: y = 0 is the rail, +z the muzzle end
const dotModel = (() => {
  const body = Shape(), steel = Shape(), black = Shape(), glass = Shape(), red = Shape(), Y = 0.037, O = { y: Y };
  const inside = { y: Y, inward: true };
  // the hollow tube, with a thicker lip at each end
  turned(body, [[-0.034, 0.0172], [-0.033, 0.0196], [-0.023, 0.0196], [-0.021, 0.018], [0.021, 0.018], [0.023, 0.0202], [0.035, 0.0202], [0.036, 0.0178]], 'metal', O);
  for (const [z, r0, r1] of [[-0.034, 0.0172, 0.0142], [0.036, 0.0178, 0.0148]]) body.loft([body.ring([0, Y, z], [0, 0, 1], r0, 32), body.ring([0, Y, z], [0, 0, 1], r1, 32)], 'metal');
  turned(black, [[-0.034, 0.0142], [-0.029, 0.0140]], 'metal', inside);
  turned(black, [[0.036, 0.0148], [0.022, 0.0146]], 'metal', inside);
  for (const z of [-0.0225, 0.0225]) turned(steel, [[z - 0.001, 0.018], [z - 0.0006, 0.0206], [z + 0.0006, 0.0206], [z + 0.001, 0.018]], 'metal', O);
  // the glass: coated, with the dot on the side you look through
  glass.cap(glass.ring([0, Y, -0.029], [0, 0, 1], 0.0141, 32), [0, 0, -1], 'dark');
  glass.cap(glass.ring([0, Y, 0.022], [0, 0, 1], 0.0147, 32), [0, 0, 1], 'dark');
  red.cap(red.ring([0, Y, -0.0296], [0, 0, 1], 0.0027, 16), [0, 0, -1], 'dark');
  // two adjuster caps, on top and on the right
  for (const d of [[0, 1, 0], [-1, 0, 0]]) {
    const at = k => [d[0] * k, Y + d[1] * k, -0.002];
    body.tube([at(0.016), at(0.023)], 0.0088, 'metal', { sides: 20 });
    steel.tube([at(0.023), at(0.0285)], 0.0074, 'metal', { sides: 20 });
    black.tube([at(0.0285), at(0.0292)], 0.0045, 'metal', { sides: 14 });
  }
  // the brightness knob on the left
  steel.tube([[0.016, Y, -0.002], [0.03, Y, -0.002]], 0.0095, 'metal', { sides: 20 });
  for (let i = 0; i < 18; i++) { const w = i / 18 * Math.PI * 2; black.slab([0.026, Y + Math.cos(w) * 0.0096, -0.002 + Math.sin(w) * 0.0096], [0.007, 0.0018, 0.0018], 'metal', 0.0004, M3.rx(w)); }
  // the riser and the clamp on to the rail
  body.slab([0, 0.016, 0], [0.018, 0.014, 0.04], 'metal', 0.004);
  body.slab([0, 0.0075, 0], [0.03, 0.007, 0.05], 'metal', 0.002);
  for (const x of [-0.0125, 0.0125]) body.slab([x, 0.0015, 0], [0.007, 0.009, 0.05], 'metal', 0.0015);
  for (const z of [-0.013, 0.013]) { steel.tube([[0.015, 0.003, z], [0.0195, 0.003, z]], 0.0048, 'metal', { sides: 6 }); black.tube([[0.0195, 0.003, z], [0.0198, 0.003, z]], 0.0022, 'metal', { sides: 6 }); }
  return { flats: [flatPart(body, [0.028, 0.029, 0.033], 0.52, 0.6), flatPart(steel, [0.075, 0.078, 0.086], 0.4, 0.82), flatPart(black, [0.008, 0.008, 0.009], 0.75, 0.2),
    flatPart(glass, [0.10, 0.045, 0.035], 0.08, 0.9), flatPart(red, [6, 0.12, 0.06], 0.5, 0)], eye: Y };
})();
const scopeModel = (() => {
  const S = Shape(), black = Shape(), lens = Shape(), gold = Shape();
  const turned = (shape, profile, y, mat) => { const rings = profile.map(([z, r]) => shape.ring([0, y, z], [0, 0, 1], r, 20)); shape.loft(rings, mat, { us: 1, ts: 1 }); return rings; };
  const Y = 0.04;
  const body = turned(black, [[-0.115, 0.0165], [-0.108, 0.019], [-0.078, 0.019], [-0.062, 0.0128], [0.055, 0.0128], [0.083, 0.0225], [0.122, 0.0235], [0.128, 0.0215]], Y, 'metal');
  lens.cap(body[0], [0, 0, -1], 'dark'); lens.cap(body[body.length - 1], [0, 0, 1], 'dark');
  for (const z of [-0.113, -0.083, 0.088, 0.119]) turned(S, [[z, 0.0185], [z + 0.002, z > 0 ? 0.0248 : 0.0207], [z + 0.006, z > 0 ? 0.0248 : 0.0207], [z + 0.008, 0.0185]], Y, 'metal');
  S.slab([0, Y, 0], [0.032, 0.03, 0.036], 'metal', 0.006);
  for (const d of [[0, 1, 0], [1, 0, 0]]) {                      // the turrets
    const at = k => [d[0] * k, Y + d[1] * k, 0];
    S.tube([at(0.012), at(0.028)], 0.0098, 'metal', { sides: 14 });
    S.tube([at(0.028), at(0.036)], 0.0112, 'metal', { sides: 14, capMat: 'dark' });
    gold.tube([at(0.0362), at(0.0368)], 0.004, 'metal', { sides: 10 });
  }
  for (const z of [-0.042, 0.038]) {                             // rings and feet
    turned(S, [[z - 0.007, 0.0145], [z - 0.007, 0.0165], [z + 0.007, 0.0165], [z + 0.007, 0.0145]], Y, 'metal');
    S.slab([0, 0.015, z], [0.016, 0.022, 0.014], 'metal', 0.003);
    S.tube([[0.008, 0.01, z], [0.017, 0.01, z]], 0.0042, 'metal', { sides: 8 });
  }
  S.slab([0, 0.004, 0], [0.024, 0.008, 0.115], 'metal', 0.002);
  return { mesh: S.done(), flats: [flatPart(black, [0.03, 0.032, 0.038], 0.32, 0.85), flatPart(gold, [0.85, 0.6, 0.15], 0.3, 1), flatPart(lens, [0.07, 0.16, 0.34], 0.12, 0.95)], eye: Y };
})();
// rounded-rectangle rings (x half-width, z half-depth) used by the grip and the magazine. centre c, lying across `dir`
function oval(c, dir, hx, hz, n, round) {
  const a = V.norm(dir), x = [1, 0, 0], z = V.norm(V.cross(x, a));
  return Array.from({ length: n }, (_, i) => {
    const w = i / n * Math.PI * 2, cs = Math.cos(w), sn = Math.sin(w), p = round || 0.5;
    const px = Math.sign(cs) * Math.pow(Math.abs(cs), p) * hx, pz = Math.sign(sn) * Math.pow(Math.abs(sn), p) * (typeof hz === 'function' ? hz(sn) : hz);
    return V.add(c, V.add(V.mul(x, px), V.mul(z, pz)));
  });
}
// a polymer foregrip, hanging under the fore-end: y = 0 is the rail, +z the muzzle end. grooves for the fingers down
// the front, a straight back, stippled panels on the sides and a flared cap
const gripModel = (() => {
  const body = Shape(), panel = Shape(), steel = Shape(), S = Shape();
  // [how far down, half width, back edge, front edge]
  const profile = [[0.010, 0.0128, -0.021, 0.021], [0.017, 0.0136, -0.0185, 0.0185], [0.023, 0.0126, -0.0165, 0.0155], [0.029, 0.0132, -0.0167, 0.0176],
    [0.036, 0.0134, -0.0170, 0.0146], [0.043, 0.0136, -0.0174, 0.0180], [0.050, 0.0136, -0.0178, 0.0148], [0.057, 0.0138, -0.0182, 0.0182], [0.064, 0.0138, -0.0188, 0.0152],
    [0.072, 0.0140, -0.0196, 0.0186], [0.080, 0.0150, -0.0212, 0.0215], [0.086, 0.0156, -0.0222, 0.0238], [0.090, 0.0148, -0.0214, 0.0228]];
  const rings = profile.map(([y, hx, back, front]) => oval([0, -y, (back + front) / 2 - y * 0.10], [0, -1, 0], hx, (front - back) / 2, 28, 0.62));
  body.loft(rings, 'metal', { us: 1, ts: 1, uo: 0, to: 0 });
  body.cap(rings[0], [0, 1, 0], 'metal'); body.cap(rings[rings.length - 1], [0, -1, 0], 'metal');
  const lip = oval([0, -0.0815, -0.0081], [0, -1, 0], 0.0157, 0.0222, 28, 0.62);
  steel.tube(lip.concat([lip[0]]), 0.0009, 'metal', { sides: 5, caps: false });
  for (const side of [-1, 1]) {                                // the panels, and rows of little pyramids on them
    panel.slab([side * 0.0132, -0.048, -0.0052], [0.002, 0.05, 0.022], 'metal', 0.0008);
    for (let j = 0; j < 9; j++) for (let i = 0; i < 4; i++) panel.slab([side * 0.0143, -0.0275 - j * 0.0051, -0.0128 + i * 0.0051 - j * 0.0004], [0.0014, 0.0031, 0.0031], 'metal', 0.0006, M3.rx(Math.PI / 4));
  }
  // the mount: a clamp that takes the rail between two jaws, with a cross bolt
  body.slab([0, -0.0055, 0], [0.027, 0.011, 0.054], 'metal', 0.003);
  for (const x of [-0.0118, 0.0118]) body.slab([x, 0.0022, 0], [0.0062, 0.0085, 0.054], 'metal', 0.0015);
  steel.tube([[0.0132, -0.003, 0.008], [0.0178, -0.003, 0.008]], 0.0062, 'metal', { sides: 20 });
  S.slab([0.0181, -0.003, 0.008], [0.0006, 0.0018, 0.0095], 'dark', 0.0002);
  steel.tube([[-0.0132, -0.003, 0.008], [-0.0158, -0.003, 0.008]], 0.0042, 'metal', { sides: 6 });
  for (const z of [-0.016, -0.004]) steel.tube([[0.0132, -0.004, z], [0.0142, -0.004, z]], 0.0022, 'metal', { sides: 10 });
  return { mesh: S.done(), flats: [flatPart(body, [0.024, 0.025, 0.028], 0.64, 0.25), flatPart(panel, [0.015, 0.016, 0.018], 0.8, 0.15), flatPart(steel, [0.085, 0.088, 0.096], 0.4, 0.82)] };
})();
// a long curved magazine (this is what you see at the work table; on a gun it is the gun's own magazine drawn longer)
const magModel = (() => {
  const body = Shape(), rib = Shape(), brass = Shape(), copper = Shape(), steel = Shape();
  const R = 0.34, A = 0.72;                                    // it curves forward like an AK's
  const at = u => { const a = u * A; return [0, -Math.sin(a) * R, (1 - Math.cos(a)) * R]; };
  const along = u => { const a = u * A; return [0, -Math.cos(a), Math.sin(a)]; };
  const front = u => { const a = u * A; return [0, Math.sin(a), Math.cos(a)]; };
  const ring = (u, hx, hz) => oval(at(u), along(u), hx, hz, 28, 0.38);
  const rings = [ring(0, 0.0128, 0.030)];
  for (let i = 1; i <= 20; i++) rings.push(ring(i / 20 * 0.985, 0.0132, 0.0315));
  body.loft(rings, 'metal', { us: 1, ts: 1, uo: 0, to: 0 });
  body.cap(rings[0], V.mul(along(0), -1), 'metal'); body.cap(rings[rings.length - 1], along(0.985), 'metal');
  for (const x of [-0.0134, 0.0134]) for (const z of [-0.016, 0.0, 0.016]) {      // pressed ribs down each side
    rib.tube(arcPts(18, v => { const u = 0.13 + v * 0.76; return V.add(V.add(at(u), V.mul(front(u), z)), [x, 0, 0]); }), 0.0024, 'metal', { sides: 8, squash: 0.7 });
  }
  for (const z of [-0.0318, 0.0318]) rib.tube(arcPts(18, v => { const u = 0.07 + v * 0.86; return V.add(at(u), V.mul(front(u), z)); }), 0.0022, 'metal', { sides: 8 });
  // the floor plate
  const foot = [ring(0.965, 0.0152, 0.0345), ring(0.985, 0.0166, 0.036), ring(1.035, 0.0166, 0.036), ring(1.048, 0.0148, 0.034)];
  steel.loft(foot, 'metal'); steel.cap(foot[0], V.mul(along(0.97), -1), 'metal'); steel.cap(foot[3], along(1.05), 'metal');
  // the lips and locking tabs at the top
  for (const x of [-0.0105, 0.0105]) steel.slab([x, 0.004, -0.001], [0.0035, 0.009, 0.044], 'metal', 0.0012);
  steel.slab([0, -0.006, 0.0335], [0.012, 0.01, 0.006], 'metal', 0.002);
  steel.slab([0, -0.012, -0.0335], [0.012, 0.014, 0.006], 'metal', 0.002);
  // two rounds showing
  for (const [x, y] of [[0.0045, 0.0085], [-0.0045, 0.0035]]) {
    brass.tube([[x, y, -0.027], [x, y, 0.013]], 0.0056, 'metal', { sides: 16 });
    brass.tube([[x, y, -0.030], [x, y, -0.027]], 0.0061, 'metal', { sides: 16 });
    brass.tube([[x, y, 0.013], [x, y, 0.019]], u => 0.0056 - 0.0014 * u, 'metal', { sides: 16 });
    copper.tube(arcPts(7, u => [x, y, 0.019 + u * 0.019]), u => 0.0042 * Math.sqrt(Math.max(0.03, 1 - u * u)), 'metal', { sides: 14 });
  }
  return { flats: [flatPart(body, [0.032, 0.034, 0.039], 0.5, 0.7), flatPart(rib, [0.055, 0.058, 0.066], 0.38, 0.82), flatPart(steel, [0.020, 0.021, 0.024], 0.55, 0.6),
    flatPart(brass, [0.80, 0.55, 0.14], 0.26, 1), flatPart(copper, [0.55, 0.22, 0.09], 0.3, 1)] };
})();

// ---------------------------------------------------------------- how each is photographed for the pockets and menus
const RAID_PICS = {
  wall: { parts: [[wallModel]], mid: [0, 1.1, 0], from: [0.35, 0.25, 1] },
  door: { parts: [[doorFrameModel], [doorModel, [-DOOR.half, 0, 0]]], mid: [0, 1.15, 0], from: [0.35, 0.25, 1] },
  hammer: { parts: [[hammerModel, [0, -0.1, 0], M3.rx(0.0)]], mid: [0, 0, 0], from: [1, 0.25, 0.45] },
  bag: { parts: [[bagModel]], mid: [0, 0.17, 0], from: [0.45, 0.5, 1] },
  bench: { parts: [[benchModel]], mid: [0, 0.75, 0], from: [0.45, 0.4, 1] },
  stash: { parts: [[stashModel], [stashLidModel, [0, 0.5, -0.31]]], mid: [0, 0.3, 0], from: [0.5, 0.45, 1] },
  rocks: { parts: [[rockModel]], mid: [0, 0.08, 0], from: [0.3, 0.5, 1] },
  sil: { parts: [[silencerModel, [0, 0, -0.086]]], mid: [0, 0, 0], from: [0.85, 0.3, 0.6] },
  dot: { parts: [[dotModel]], mid: [0, 0.026, 0], from: [0.55, 0.32, -0.85] },
  scope: { parts: [[scopeModel]], mid: [0, 0.03, 0], from: [1, 0.3, 0.4] },
  grip: { parts: [[gripModel]], mid: [0, -0.045, 0], from: [1, 0.22, 0.45] },
  mag: { parts: [[magModel]], mid: [0, -0.1, 0.04], from: [1, 0.3, -0.45] }
};
