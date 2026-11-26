// ======================================================================= the treasure chest
// An oak chest with a rounded lid, iron straps, brass rivets and a brass lock. It is built from real bevelled planks
// and plates, with one painted sheet for the wood, metals and lining. Two meshes, the box and the lid, so a hundred of
// them are cheap. The box: x across, y up, +z its front, 0.9 x 0.44 x 0.56. The lid turns about its back edge.
const chestArt = (() => {
  const N = 1024;
  // where each material sits on the sheet: x, y, wide, tall
  const WOOD = [0, 0, 1024, 512], IRON = [0, 512, 512, 256], BRASS = [512, 512, 512, 256], VELVET = [0, 768, 512, 256], DARK = [512, 768, 512, 256];
  let seed = 7;
  const rnd = (a, b) => { seed = seed * 16807 % 2147483647; return a + (b - a) * seed / 2147483647; };

  // ---- the sheet: colour, height (for the bumps) and how rough and how metal each part is
  const sheet = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const [colour, col] = sheet(), [high, hi] = sheet(), [surface, orm] = sheet();
  const fill = (g, r, style) => { g.fillStyle = style; g.fillRect(...r); };
  const inside = (r, draw) => { for (const g of [col, hi]) { g.save(); g.beginPath(); g.rect(...r); g.clip(); } draw(); col.restore(); hi.restore(); };
  fill(hi, [0, 0, N, N], 'rgb(128,128,128)');

  inside(WOOD, () => {
    fill(col, WOOD, '#915526');
    for (let i = 0; i < 70; i++) {                            // broad bands of lighter and darker wood
      col.fillStyle = rnd(0, 1) < 0.5 ? `rgba(80,42,14,${rnd(0.08, 0.2)})` : `rgba(196,132,66,${rnd(0.08, 0.2)})`;
      col.fillRect(0, rnd(0, 512), 1024, rnd(4, 26));
    }
    const knots = Array.from({ length: 9 }, () => [rnd(60, 960), rnd(30, 480), rnd(7, 15)]);
    for (let i = 0; i < 200; i++) {                           // the grain, bending round the knots
      const y = rnd(-6, 518), a = rnd(1, 4), f = rnd(0.006, 0.018), p = rnd(0, 6), wide = rnd(0.8, 2.4), dark = rnd(0.14, 0.46);
      for (const [g, style] of [[col, `rgba(58,28,8,${dark})`], [hi, `rgba(40,40,40,${dark})`]]) {
        g.strokeStyle = style; g.lineWidth = wide; g.beginPath();
        for (let x = 0; x <= 1024; x += 8) {
          let yy = y + Math.sin(x * f + p) * a;
          for (const [kx, ky, kr] of knots) { const dx = (x - kx) / (kr * 4), d = yy - ky; if (Math.abs(dx) < 1 && Math.abs(d) < kr * 3) yy += (d < 0 ? -1 : 1) * kr * (1 - dx * dx) * (1 - Math.abs(d) / (kr * 3)); }
          if (x) g.lineTo(x, yy); else g.moveTo(x, yy);
        }
        g.stroke();
      }
    }
    for (const [kx, ky, kr] of knots) for (let k = 3; k > 0; k--) {
      col.fillStyle = `rgba(52,24,7,${0.75 - k * 0.17})`; col.beginPath(); col.ellipse(kx, ky, kr * k * 0.7, kr * k * 0.34, 0, 0, 7); col.fill();
    }
    for (let i = 0; i < 2600; i++) { col.fillStyle = `rgba(45,22,6,${rnd(0.1, 0.35)})`; col.fillRect(rnd(0, 1024), rnd(0, 512), rnd(2, 9), 1); }   // pores
  });
  const metal = (r, base, light, dark) => inside(r, () => {
    fill(col, r, base);
    for (let i = 0; i < 900; i++) {                           // a brushed, slightly knocked-about face
      const x = r[0] + rnd(-30, r[2]), y = r[1] + rnd(0, r[3]), w = rnd(6, 60);
      col.strokeStyle = rnd(0, 1) < 0.5 ? light : dark; col.lineWidth = rnd(0.5, 1.4); col.beginPath(); col.moveTo(x, y); col.lineTo(x + w, y + rnd(-3, 3)); col.stroke();
    }
    for (let i = 0; i < 260; i++) {                           // hammer marks
      const x = r[0] + rnd(0, r[2]), y = r[1] + rnd(0, r[3]), s = rnd(4, 14), up = rnd(0, 1) < 0.5 ? 255 : 0;
      const g = hi.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, `rgba(${up},${up},${up},0.22)`); g.addColorStop(1, `rgba(${up},${up},${up},0)`);
      hi.fillStyle = g; hi.fillRect(x - s, y - s, s * 2, s * 2);
    }
  });
  metal(IRON, '#484b52', 'rgba(170,176,188,0.20)', 'rgba(10,11,14,0.28)');
  metal(BRASS, '#e0ab3e', 'rgba(255,236,160,0.28)', 'rgba(120,72,8,0.22)');
  inside(VELVET, () => {
    fill(col, VELVET, '#4c1015');
    for (let i = 0; i < 9000; i++) { col.fillStyle = rnd(0, 1) < 0.5 ? 'rgba(120,34,40,0.25)' : 'rgba(30,4,8,0.3)'; col.fillRect(rnd(0, 512), rnd(768, 1024), 2, 2); }
  });
  fill(col, DARK, '#120b06');
  // red: how open to the sky; green: roughness; blue: metal
  fill(orm, WOOD, 'rgb(255,158,0)'); fill(orm, IRON, 'rgb(255,112,215)'); fill(orm, BRASS, 'rgb(255,74,255)'); fill(orm, VELVET, 'rgb(190,245,0)'); fill(orm, DARK, 'rgb(90,255,0)');

  // bumps from the height
  const h = hi.getImageData(0, 0, N, N).data, bumps = hi.createImageData(N, N), out = bumps.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const at = (i, j) => h[(((j + N) % N) * N + ((i + N) % N)) * 4] / 255;
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
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
  const tex = upload(colour, true), normal = upload(high, false), ormTex = upload(surface, false);

  // ---- the shapes
  let verts = [], idx = [];
  const vert = (p, n, uv) => { verts.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0] / N, uv[1] / N); return verts.length / 8 - 1; };
  const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
  const take = () => { const m = staticMesh(new Float32Array(verts), new Uint32Array(idx)); verts = []; idx = []; return m; };
  // a random patch of a material big enough for w by h metres, and how many pixels a metre gets there
  const patch = (r, w, h) => {
    const k = Math.min(1000, (r[2] - 32) / Math.max(w, 1e-3), (r[3] - 32) / Math.max(h, 1e-3));
    return { x: r[0] + 16 + rnd(0, r[2] - 32 - w * k), y: r[1] + 16 + rnd(0, r[3] - 32 - h * k), k };
  };
  // a box with its edges taken off, so they catch the light. centre c, full size s
  function slab(c, s, mat, bevel) {
    const half = s.map(v => v / 2), b = Math.min(bevel === undefined ? 0.006 : bevel, ...half.map(v => v * 0.8)), at = {};
    for (let a = 0; a < 3; a++) for (const sa of [-1, 1]) {
      const rest = [0, 1, 2].filter(i => i !== a), [u, v] = s[rest[0]] >= s[rest[1]] ? rest : [rest[1], rest[0]];    // grain along the long way
      const P = patch(mat, s[u], s[v]), n = [0, 0, 0]; n[a] = sa;
      for (const su of [-1, 1]) for (const sv of [-1, 1]) {
        const p = c.slice(); p[a] += sa * half[a]; p[u] += su * (half[u] - b); p[v] += sv * (half[v] - b);
        const key = [0, 0, 0]; key[a] = sa; key[u] = su; key[v] = sv;
        at[a + ':' + key] = vert(p, n, [P.x + (p[u] - c[u] + half[u]) * P.k, P.y + (p[v] - c[v] + half[v]) * P.k]);
      }
    }
    const V3 = (a, key) => at[a + ':' + key];
    for (let a = 0; a < 3; a++) for (const sa of [-1, 1]) {                                          // faces
      const [u, v] = [0, 1, 2].filter(i => i !== a), key = (su, sv) => { const k = [0, 0, 0]; k[a] = sa; k[u] = su; k[v] = sv; return V3(a, k); };
      quad(key(-1, -1), key(1, -1), key(1, 1), key(-1, 1));
    }
    for (let a = 0; a < 3; a++) for (let o = a + 1; o < 3; o++) {                                    // edges
      const t = 3 - a - o;
      for (const sa of [-1, 1]) for (const so of [-1, 1]) {
        const k = st => { const q = [0, 0, 0]; q[a] = sa; q[o] = so; q[t] = st; return q; };
        quad(V3(a, k(-1)), V3(a, k(1)), V3(o, k(1)), V3(o, k(-1)));
      }
    }
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) idx.push(V3(0, [x, y, z]), V3(1, [x, y, z]), V3(2, [x, y, z]));   // corners
  }
  // a domed rivet head at c, facing along n
  function rivet(c, n, r, mat) {
    const side = V.norm(V.orth(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n)), up = V.cross(n, side), P = patch(mat || BRASS, r * 2, r * 2);
    const rings = [[1, 0], [0.78, 0.55], [0.42, 0.82]], seg = 9, base = verts.length / 8;
    for (const [w, h] of rings) for (let i = 0; i < seg; i++) {
      const a = i / seg * Math.PI * 2, d = V.add(V.mul(side, Math.cos(a) * w), V.mul(up, Math.sin(a) * w));
      vert(V.add(c, V.add(V.mul(d, r), V.mul(n, h * r * 0.75))), V.norm(V.add(d, V.mul(n, h * 1.3 + 0.15))), [P.x + (Math.cos(a) * w + 1) * r * P.k, P.y + (Math.sin(a) * w + 1) * r * P.k]);
    }
    const top = vert(V.mad(c, n, r * 0.7), n, [P.x + r * P.k, P.y + r * P.k]);
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) { const a = base + j * seg, k = (i + 1) % seg; quad(a + i, a + k, a + seg + k, a + seg + i); }
    for (let i = 0; i < seg; i++) idx.push(base + (rings.length - 1) * seg + i, base + (rings.length - 1) * seg + (i + 1) % seg, top);
  }
  // a round bar bent along a path of points
  function bar(path, r, mat) {
    const seg = 7, P = patch(mat, 0.2, 0.05), base = verts.length / 8;
    path.forEach((p, j) => {
      const dir = V.norm(V.sub(path[Math.min(path.length - 1, j + 1)], path[Math.max(0, j - 1)]));
      const side = V.norm(V.orth(Math.abs(dir[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], dir)), up = V.cross(dir, side);
      for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, n = V.add(V.mul(side, Math.cos(a)), V.mul(up, Math.sin(a))); vert(V.mad(p, n, r), n, [P.x + j / path.length * 0.2 * P.k, P.y + i / seg * 0.05 * P.k]); }
    });
    for (let j = 0; j < path.length - 1; j++) for (let i = 0; i < seg; i++) { const a = base + j * seg, k = (i + 1) % seg; quad(a + i, a + k, a + seg + k, a + seg + i); }
  }

  // ---- the box
  for (const x of [-0.39, 0.39]) for (const z of [-0.225, 0.225]) slab([x, 0.02, z], [0.13, 0.04, 0.12], IRON, 0.012);       // feet
  slab([0, 0.052, 0], [0.84, 0.03, 0.50], DARK);
  for (let k = 0; k < 3; k++) {                                // three planks a side
    const y = 0.065 + 0.12 * k + 0.0585;
    for (const z of [-0.2525, 0.2525]) slab([0, y, z], [0.87, 0.117, 0.045], WOOD, 0.008);
    for (const x of [-0.4125, 0.4125]) slab([x, y, 0], [0.045, 0.117, 0.461], WOOD, 0.008);
  }
  for (const z of [-0.229, 0.229]) slab([0, 0.245, z], [0.80, 0.36, 0.002], DARK, 0);       // nothing shows through the gaps
  for (const x of [-0.389, 0.389]) slab([x, 0.245, 0], [0.002, 0.36, 0.45], DARK, 0);
  for (const z of [-0.226, 0.226]) slab([0, 0.245, z], [0.776, 0.355, 0.003], VELVET, 0);   // lined inside
  for (const x of [-0.386, 0.386]) slab([x, 0.245, 0], [0.003, 0.355, 0.45], VELVET, 0);
  slab([0, 0.07, 0], [0.775, 0.006, 0.45], VELVET, 0);
  // iron round the top and bottom
  for (const [y, tall] of [[0.058, 0.040], [0.424, 0.034]]) {
    for (const z of [-0.279, 0.279]) slab([0, y, z], [0.908, tall, 0.012], IRON, 0.004);
    for (const x of [-0.439, 0.439]) slab([x, y, 0], [0.012, tall, 0.558], IRON, 0.004);
  }
  // corner irons
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    slab([x * 0.411, 0.241, z * 0.281], [0.066, 0.37, 0.012], IRON, 0.004);
    slab([x * 0.441, 0.241, z * 0.25], [0.012, 0.37, 0.074], IRON, 0.004);
    for (const y of [0.11, 0.241, 0.37]) { rivet([x * 0.405, y, z * 0.287], [0, 0, z], 0.012); rivet([x * 0.447, y, z * 0.248], [x, 0, 0], 0.012); }
  }
  // two straps, front and back
  for (const x of [-0.25, 0.25]) for (const z of [-1, 1]) {
    slab([x, 0.241, z * 0.2815], [0.064, 0.40, 0.013], IRON, 0.004);
    for (const y of [0.075, 0.16, 0.322, 0.41]) rivet([x, y, z * 0.288], [0, 0, z], 0.0105);
  }
  // the lock: a brass plate with a keyhole
  slab([0, 0.335, 0.283], [0.142, 0.15, 0.018], IRON, 0.007);
  slab([0, 0.335, 0.291], [0.118, 0.126, 0.014], BRASS, 0.006);
  rivet([0, 0.336, 0.297], [0, 0, 1], 0.016, DARK); slab([0, 0.309, 0.2985], [0.012, 0.040, 0.002], DARK, 0);
  for (const x of [-0.044, 0.044]) for (const y of [0.288, 0.382]) rivet([x, y, 0.298], [0, 0, 1], 0.008);
  // a carrying ring on each end
  for (const x of [-1, 1]) {
    slab([x * 0.444, 0.30, 0], [0.012, 0.075, 0.17], IRON, 0.004);
    for (const z of [-0.063, 0.063]) { rivet([x * 0.45, 0.30, z], [x, 0, 0], 0.011); slab([x * 0.458, 0.30, z * 0.9], [0.022, 0.028, 0.022], IRON, 0.006); }
    bar(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * Math.PI; return [x * (0.462 + 0.014 * Math.sin(a)), 0.30 - 0.085 * Math.sin(a), -0.058 * Math.cos(a)]; }), 0.011, IRON);
  }
  const box = take();

  // ---- the lid, in its own space: z from the hinge (0) to the front (0.6), y up from the rim
  const MID = 0.30, DEEP = 0.285, RIM = 0.034, RISE = 0.175;
  const arc = (a, grow) => [RIM + (RISE + grow) * Math.sin(a), MID - (DEEP + grow) * Math.cos(a)];       // [y, z], a from 0 (back) to pi (front)
  const normalAt = a => V.norm([0, Math.sin(a) * DEEP, -Math.cos(a) * RISE]);
  // a curved plank or strap: from angle a0 to a1, between x0 and x1, standing out from the curve by out and `thick` deep
  function curve(a0, a1, x0, x1, out, thick, mat, along) {
    const steps = Math.max(2, Math.ceil((a1 - a0) / 0.17)), len = (a1 - a0) * 0.235, wide = x1 - x0;
    const P = along ? patch(mat, wide, len) : patch(mat, len, wide), uv = (u, t) => along ? [P.x + u * wide * P.k, P.y + t * len * P.k] : [P.x + t * len * P.k, P.y + u * wide * P.k];
    const rows = (grow, flip) => {
      const base = verts.length / 8;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * i / steps, [y, z] = arc(a, grow), n = normalAt(a), side = [-0.35, 0.35];
        vert([x0, y, z], V.norm(V.add(flip ? V.mul(n, -1) : n, [side[0], 0, 0])), uv(0, i / steps));
        vert([x0 + 0.007, y, z], flip ? V.mul(n, -1) : n, uv(0.02, i / steps));
        vert([x1 - 0.007, y, z], flip ? V.mul(n, -1) : n, uv(0.98, i / steps));
        vert([x1, y, z], V.norm(V.add(flip ? V.mul(n, -1) : n, [side[1], 0, 0])), uv(1, i / steps));
      }
      for (let i = 0; i < steps; i++) for (let c = 0; c < 3; c++) quad(base + i * 4 + c, base + i * 4 + c + 1, base + i * 4 + 4 + c + 1, base + i * 4 + 4 + c);
      return base;
    };
    const top = rows(out, false), under = rows(out - thick, true);
    for (let i = 0; i < steps; i++) for (const c of [0, 3]) quad(top + i * 4 + c, top + i * 4 + 4 + c, under + i * 4 + 4 + c, under + i * 4 + c);
    for (const i of [0, steps]) quad(top + i * 4, top + i * 4 + 3, under + i * 4 + 3, under + i * 4);
  }
  for (let k = 0; k < 6; k++) curve(k * Math.PI / 6 + 0.008, (k + 1) * Math.PI / 6 - 0.008, -0.43, 0.43, 0, 0.03, WOOD, true);
  curve(0.02, Math.PI - 0.02, -0.425, 0.425, -0.03, 0.003, VELVET, true);
  curve(0, Math.PI, -0.41, 0.41, -0.021, 0.002, DARK, true);                 // behind the gaps
  for (const x of [-0.25, 0.25]) {                              // the straps carry on over the top
    curve(0, Math.PI, x - 0.032, x + 0.032, 0.011, 0.012, IRON, false);
    for (const a of [0.28, 0.85, 1.571, 2.29, 2.86]) { const [y, z] = arc(a, 0.011); rivet([x, y, z], normalAt(a), 0.0105); }
  }
  for (const s of [-1, 1]) {                                    // the ends: half rounds of wood with an iron edge
    const x = s * 0.422, P = patch(WOOD, 0.57, 0.22), seg = 20, base = verts.length / 8, uv = (y, z) => [P.x + (z - 0.015) * P.k, P.y + y * P.k];
    for (let i = 0; i <= seg; i++) { const [y, z] = arc(i / seg * Math.PI, -0.004); vert([x, y, z], [s, 0, 0], uv(y, z)); vert([x, 0.004, z], [s, 0, 0], uv(0.004, z)); }
    for (let i = 0; i < seg; i++) quad(base + i * 2, base + i * 2 + 2, base + i * 2 + 3, base + i * 2 + 1);
    curve(0, Math.PI, s < 0 ? -0.456 : 0.40, s < 0 ? -0.40 : 0.456, 0.012, 0.016, IRON, false);
    for (const a of [0.2, 0.9, 1.571, 2.24, 2.94]) { const [y, z] = arc(a, 0.012); rivet([s * 0.428, y, z], normalAt(a), 0.01); }
    slab([x + s * 0.012, 0.085, MID], [0.012, 0.022, 0.40], IRON, 0.004);
    for (const z of [0.15, 0.30, 0.45]) rivet([x + s * 0.019, 0.085, z], [s, 0, 0], 0.009);
  }
  for (const x of [-0.439, 0.439]) slab([x, 0.014, MID], [0.018, 0.030, 0.57], IRON, 0.005);     // and along the ends
  for (const [z, face] of [[0.018, -1], [0.582, 1]]) {          // the rim, front and back
    slab([0, 0.02, z], [0.908, 0.040, 0.020], IRON, 0.006);
    for (const x of [-0.41, -0.25, 0.25, 0.41]) rivet([x, 0.02, z + face * 0.01], [0, 0, face], 0.0105);
  }
  slab([0, 0.012, 0.592], [0.078, 0.060, 0.014], BRASS, 0.005);               // the hasp, down over the lock
  slab([0, -0.026, 0.592], [0.050, 0.030, 0.012], BRASS, 0.005);
  for (const x of [-0.022, 0.022]) rivet([x, 0.026, 0.599], [0, 0, 1], 0.008, IRON);
  for (const x of [-0.30, 0.30]) bar([[x - 0.06, 0, 0.008], [x + 0.06, 0, 0.008]], 0.016, IRON);              // hinges
  const lid = take();
  return { box, lid, tex, normal, orm: ormTex };
})();
function drawChest(prog, textured, tip, pos, lidR, hinge) {
  if (textured) {
    gl.uniform1i(prog.u.uHasTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, chestArt.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, chestArt.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, chestArt.orm);
  }
  drawMesh(prog, chestArt.box, tip, pos);
  drawMesh(prog, chestArt.lid, lidR, hinge);
}
