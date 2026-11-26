// ======================================================================= hand-built models
// the shades, the captain's hat, the boat, the boombox, the beer and the rocks: all made here out of
// curves, so the game needs no extra files. each model is a list of parts, one material each
const MB = {
  // a surface from fn(u, v), u and v from 0 to 1
  grid(fn, nu, nv) {
    const v = [], i = [];
    for (let b = 0; b <= nv; b++) for (let a = 0; a <= nu; a++) { const p = fn(a / nu, b / nv); v.push(p[0], p[1], p[2], 0, 0, 0, a / nu, b / nv); }
    for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) { const k = b * (nu + 1) + a; i.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1); }
    return MB.smooth({ v, i });
  },
  smooth(m) {                                            // normals from the faces round each point
    const v = m.v;
    for (let k = 0; k < m.i.length; k += 3) {
      const [a, b, c] = [m.i[k] * 8, m.i[k + 1] * 8, m.i[k + 2] * 8];
      const n = V.cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]]);
      for (const q of [a, b, c]) { v[q + 3] += n[0]; v[q + 4] += n[1]; v[q + 5] += n[2]; }
    }
    // points that sit in the same place on both sides of a seam share their normal
    for (let q = 0; q < v.length; q += 8) { const l = Math.hypot(v[q + 3], v[q + 4], v[q + 5]) || 1; v[q + 3] /= l; v[q + 4] /= l; v[q + 5] /= l; }
    return m;
  },
  lathe(profile, seg) {                                  // [radius, height] points spun round the y axis
    return MB.grid((u, v) => { const [r, y] = profile[Math.round(v * (profile.length - 1))], a = u * Math.PI * 2; return [Math.sin(a) * r, y, Math.cos(a) * r]; }, seg, profile.length - 1);
  },
  tube(pts, radius, sides, closed) {
    const n = pts.length, P = closed ? pts.concat([pts[0]]) : pts, frames = [];
    let side = null;
    for (let k = 0; k < P.length; k++) {
      const prev = P[k > 0 ? k - 1 : closed ? n - 1 : 0], next = P[k < P.length - 1 ? k + 1 : closed ? 1 : k];
      const t = V.norm(V.sub(next, prev));
      side = side ? V.orth(side, t) : V.orth(Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], t);
      frames.push([side, V.cross(t, side)]);
    }
    return MB.grid((u, v) => {
      const k = Math.round(v * (P.length - 1)), [a, b] = frames[k], w = u * Math.PI * 2, r = typeof radius === 'function' ? radius(k / (P.length - 1)) : radius;
      return V.mad(V.mad(P[k], a, Math.cos(w) * r), b, Math.sin(w) * r);
    }, sides, P.length - 1);
  },
  ring(R, r, seg, sides) { return MB.tube(Array.from({ length: seg }, (_, k) => [Math.cos(k / seg * 2 * Math.PI) * R, Math.sin(k / seg * 2 * Math.PI) * R, 0]), r, sides || 8, true); },
  // a box with rounded edges, centred on `at`
  box(sx, sy, sz, r, at) {
    const h = [sx / 2, sy / 2, sz / 2]; r = Math.min(r, ...h);
    const ticks = k => { const e = h[k]; return [-e, -e + r * 0.3, -e + r, 0, e - r, e - r * 0.3, e]; };
    const faces = [];
    for (let axis = 0; axis < 3; axis++) for (const s of [-1, 1]) {
      const a = (axis + 1) % 3, b = (axis + 2) % 3, A = ticks(a), B = ticks(b);
      faces.push(MB.grid((u, v) => {
        const p = [0, 0, 0]; p[axis] = s * h[axis]; p[a] = A[Math.round(u * 6)]; p[b] = B[Math.round(v * 6)];
        const inner = p.map((x, k) => clamp(x, -(h[k] - r), h[k] - r)), d = V.norm(V.sub(p, inner));
        return V.add(V.mad(inner, d, r), at || [0, 0, 0]);
      }, 6, 6));
    }
    return MB.merge(faces);
  },
  ball(rx, ry, rz, at, nu, nv) {
    return MB.grid((u, v) => { const a = u * 2 * Math.PI, b = (v - 0.5) * Math.PI; return V.add([Math.sin(a) * Math.cos(b) * rx, Math.sin(b) * ry, Math.cos(a) * Math.cos(b) * rz], at || [0, 0, 0]); }, nu || 20, nv || 12);
  },
  move(m, p, R) {
    const v = m.v.slice(), M = R || M3.id();
    for (let q = 0; q < v.length; q += 8) {
      const a = V.add(M3.vec(M, [v[q], v[q + 1], v[q + 2]]), p), n = V.norm(M3.vec(M, [v[q + 3], v[q + 4], v[q + 5]]));
      v[q] = a[0]; v[q + 1] = a[1]; v[q + 2] = a[2]; v[q + 3] = n[0]; v[q + 4] = n[1]; v[q + 5] = n[2];
    }
    return { v, i: m.i.slice() };
  },
  merge(list) {
    const v = [], i = [];
    for (const m of list) { const base = v.length / 8; for (const x of m.v) v.push(x); for (const k of m.i) i.push(base + k); }
    return { v, i };
  }
};
// a curve through the points
function curve(pts, per, closed) {
  const out = [], n = pts.length, at = k => pts[closed ? (k + n) % n : clamp(k, 0, n - 1)];
  for (let s = 0; s < (closed ? n : n - 1); s++) for (let j = 0; j < per; j++) {
    const t = j / per, [p0, p1, p2, p3] = [at(s - 1), at(s), at(s + 1), at(s + 2)];
    out.push([0, 1, 2].map(i => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t * t * t)));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
// material: { c: colour (linear), r: roughness, m: metal, kind, c2, tex, glow }
function part(mat, ...meshes) {
  const m = MB.merge(meshes);
  return Object.assign({ mesh: staticMesh(new Float32Array(m.v), new Uint32Array(m.i)), r: 0.5, m: 0, kind: 0, c: [0.5, 0.5, 0.5], glow: 0 }, mat);
}
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const an = gl.getExtension('EXT_texture_filter_anisotropic');
  if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}

// ---------------------------------------------------------------- the shader they are drawn with
const propProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv;
uniform mat4 uModel, uViewProj; uniform highp int uKind; uniform float uTime;
out vec3 vW; out vec3 vN; out vec3 vP; out vec2 vUv;
void main() {
  vec3 p = aPos;
  if (uKind == 6) p.z += sin(aUv.x * 7.0 - uTime * 11.0) * 0.07 * aUv.x;           // the flag, flapping
  vec4 w = uModel * vec4(p, 1.0); vW = w.xyz; vN = mat3(uModel) * aNrm; vP = aPos; vUv = aUv; gl_Position = uViewProj * w;
}`, `
in vec3 vW; in vec3 vN; in vec3 vP; in vec2 vUv; out vec4 o;
uniform vec3 uColor, uColor2; uniform float uRough, uMetal, uGlow; uniform highp int uKind; uniform sampler2D uTex;
${COMMON}
float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 env(vec3 r, float rough) {
  float y = r.y;
  vec3 sky = mix(vec3(0.85, 0.72, 0.62), vec3(0.16, 0.36, 0.78), clamp(y * 1.5, 0.0, 1.0));
  vec3 c = mix(vec3(0.05, 0.11, 0.12), sky, smoothstep(-0.08 - rough * 0.5, 0.08 + rough * 0.5, y));
  c += vec3(2.6, 2.2, 1.6) * pow(max(dot(r, uSun), 0.0), mix(400.0, 8.0, rough)) * (1.0 - rough * 0.6);
  c += vec3(0.9, 0.9, 0.95) * pow(max(dot(r, normalize(vec3(0.75, 0.35, -0.55))), 0.0), mix(40.0, 4.0, rough)) * (1.0 - rough);
  return c;
}
void main() {
  vec3 V = normalize(uEye - vW), N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  vec3 base = uColor; float rough = uRough, metal = uMetal, alpha = 1.0;
  if (uKind == 1 || uKind == 2) {                      // varnished planks: 1 deck (seams across x), 2 hull side (across y)
    float across = uKind == 1 ? vP.x : vP.y;
    float k = across / 0.105, plank = floor(k);
    float seam = smoothstep(0.0, 0.05, fract(k)) * smoothstep(1.0, 0.95, fract(k));
    float grain = noise(vec3(vP.x * 38.0, vP.y * 38.0, vP.z * 2.2)) * 0.6 + noise(vec3(vP.x * 9.0 + plank * 7.3, vP.y * 9.0, vP.z * 0.8)) * 0.8;
    base *= 0.55 + grain * 0.65 + 0.22 * hash(vec3(plank, 2.0, 5.0));
    base *= 0.35 + 0.65 * seam;
    if (uKind == 2) {
      if (vP.y < 0.02) base = vec3(0.30, 0.012, 0.008) * (0.85 + 0.3 * noise(vP * 11.0));        // red bottom
      else if (vP.y < 0.085) base = vec3(0.80, 0.78, 0.72);                                      // white boot stripe
    }
  } else if (uKind == 3 || uKind == 6) { vec4 t = texture(uTex, vUv); base = t.rgb * uColor; alpha = t.a; if (alpha < 0.35) discard; }
  else if (uKind == 4) {                               // rock: mottled, wet and dark at the waterline, weed
    float n = noise(vP * 2.3) * 0.55 + noise(vP * 7.0) * 0.3 + noise(vP * 22.0) * 0.15;
    base *= 0.45 + n * 1.15;
    float wet = 1.0 - smoothstep(0.1, 0.55, vW.y);
    base = mix(base, base * vec3(0.28, 0.34, 0.26), wet); rough = mix(rough, 0.18, wet);
    base = mix(base, vec3(0.05, 0.09, 0.02), smoothstep(0.55, 0.75, noise(vP * 4.0)) * (1.0 - smoothstep(0.15, 0.7, vW.y)));
  } else if (uKind == 5) {                             // mirrored lenses, one colour fading into another
    base = mix(uColor2, uColor, smoothstep(1.518, 1.578, vP.y));
  } else if (uKind == 7) {                             // the life ring's white bands
    float a = atan(vP.y, vP.x);
    if (abs(fract(a / 6.28318 * 4.0) - 0.5) < 0.11) base = uColor2;
  } else if (uKind == 9) {                             // burnt wood: charred patches and glowing cracks
    float n = noise(vP * 5.0) * 0.6 + noise(vP * 17.0) * 0.4;
    float char1 = smoothstep(0.36, 0.62, noise(vP * 1.7) + 0.35 * (vP.y));
    base = mix(base * (0.5 + n), vec3(0.008, 0.006, 0.005) * (0.5 + n), char1); rough = mix(rough, 0.9, char1);
  }
  rough = clamp(rough, 0.08, 1.0);
  float ndv = max(dot(N, V), 0.001), ndl = max(dot(N, uSun), 0.0), sh = shadowAt(vW + N * 0.012);
  vec3 H = normalize(uSun + V); float ndh = max(dot(N, H), 0.0), vdh = max(dot(V, H), 0.0);
  float a2 = pow(rough, 4.0), d = ndh * ndh * (a2 - 1.0) + 1.0, D = a2 / (3.14159 * d * d);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0, G = ndv / (ndv * (1.0 - k) + k) * ndl / (ndl * (1.0 - k) + k + 1e-4);
  vec3 F0 = mix(vec3(0.04), base * 1.15 + 0.02, metal), F = F0 + (1.0 - F0) * pow(1.0 - vdh, 5.0);
  vec3 kd = base * (1.0 - metal * 0.88);
  vec3 col = kd * (mix(vec3(0.30, 0.27, 0.25), vec3(0.58, 0.66, 0.78), N.y * 0.5 + 0.5) + vec3(2.3, 2.15, 1.9) * ndl * sh + flashLight(vW, N));
  col += min(F * D * G / (4.0 * ndv + 1e-4) * 3.0, vec3(6.0)) * sh;
  vec3 Fv = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - ndv, 5.0);
  col += env(reflect(-V, N), rough) * Fv * 1.1 + flashLight(vW, N) * F0 * 0.5;
  if (uKind == 9) { float ember = smoothstep(0.66, 0.8, noise(vP * 9.0 + 3.0)) * smoothstep(0.35, 0.7, noise(vP * 1.7) + 0.35 * vP.y); col += vec3(2.4, 0.5, 0.04) * ember * uGlow; }
  else col += uColor * uGlow;
  if (uKind == 8) { alpha = 0.12 + 0.75 * pow(1.0 - ndv, 3.0); col += env(reflect(-V, N), 0.08) * 0.5; }
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  o = uKind == 8 ? vec4(col, alpha) : vec4(col, 1.0);
}`);
const propModel = new Float32Array(16);
// draw parts with the 4x4 transform M, with either the prop shader or a shadow one
function drawParts(prog, parts, M) {
  gl.uniformMatrix4fv(prog.u.uModel, false, M);
  for (const p of parts) {
    if (prog === propProg) {
      gl.uniform1i(prog.u.uKind, p.kind); gl.uniform3fv(prog.u.uColor, p.c); gl.uniform1f(prog.u.uRough, p.r); gl.uniform1f(prog.u.uMetal, p.m);
      gl.uniform3fv(prog.u.uColor2, p.c2 || p.c); gl.uniform1f(prog.u.uGlow, p.glow);
      if (p.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex); }
    } else if (p.kind === 8) continue;
    gl.bindVertexArray(p.mesh.vao); gl.drawElements(gl.TRIANGLES, p.mesh.count, gl.UNSIGNED_INT, 0);
  }
}
const placed = (R, p, out) => m4(R, p, out || propModel);

const GOLD = [1.0, 0.57, 0.13], CHROME = [0.78, 0.80, 0.84], INK = [0.012, 0.012, 0.015], WHITE = [0.78, 0.76, 0.70], MAHOGANY = [0.20, 0.052, 0.020], TEAK = [0.50, 0.25, 0.085], LEATHER = [0.40, 0.014, 0.010];

// ---------------------------------------------------------------- the shades
// built where they sit on his face (the model's own resting coordinates) and carried by the head bone
const SHADES = (() => {
  const wrap = (x, y) => 0.1885 - 3.5 * x * x - 0.06 * Math.max(0, y - 1.57);
  const outline = [[0.014, 1.562], [0.022, 1.579], [0.052, 1.5855], [0.092, 1.5835], [0.116, 1.575], [0.1225, 1.557], [0.115, 1.534], [0.097, 1.518], [0.072, 1.5115], [0.048, 1.514], [0.031, 1.525], [0.021, 1.541], [0.0145, 1.552]];
  const lenses = [], rims = [], gold = [], tips = [];
  for (const s of [-1, 1]) {
    const edge = curve(outline.map(([x, y]) => [s * x, y, wrap(x, y)]), 5, true);
    const mid = [s * 0.068, 1.549, 0];
    lenses.push(MB.grid((u, v) => {
      const e = edge[Math.round(u * edge.length) % edge.length], x = mid[0] + (e[0] - mid[0]) * v, y = mid[1] + (e[1] - mid[1]) * v;
      return [x, y, wrap(x, y) + 0.0035 * (1 - v * v)];
    }, edge.length, 6));
    rims.push(MB.tube(edge, 0.0039, 8, true));
    // the arm: out from the corner, back along the side of the head, over the ear and down
    const arm = curve([[s * 0.117, 1.571, 0.141], [s * 0.1315, 1.572, 0.102], [s * 0.1405, 1.572, 0.045], [s * 0.1435, 1.571, -0.01], [s * 0.1465, 1.570, -0.048], [s * 0.157, 1.567, -0.072]], 6);
    gold.push(MB.tube(arm, t => 0.0046 - 0.0010 * t, 8));
    tips.push(MB.tube(curve([[s * 0.157, 1.567, -0.072], [s * 0.1575, 1.557, -0.088], [s * 0.152, 1.535, -0.101], [s * 0.147, 1.515, -0.104]], 6), 0.0047, 8), MB.ball(0.0047, 0.0047, 0.0047, [s * 0.147, 1.515, -0.104], 8, 6));
    gold.push(MB.box(0.012, 0.012, 0.016, 0.003, [s * 0.1175, 1.571, 0.1385]));
    gold.push(MB.ball(0.0032, 0.0032, 0.0022, [s * 0.111, 1.574, wrap(0.111, 1.574) + 0.0055], 8, 6));   // a little diamond stud
  }
  const bar = (pts, r) => MB.tube(curve(pts.map(([x, y, lift]) => [x, y, wrap(x, y) + (lift || 0)]), 8), r, 8);
  gold.push(bar([[-0.056, 1.5885], [-0.025, 1.592, 0.001], [0, 1.593, 0.001], [0.025, 1.592, 0.001], [0.056, 1.5885]], 0.0034));
  gold.push(bar([[-0.0165, 1.560], [-0.007, 1.5665, 0.002], [0.007, 1.5665, 0.002], [0.0165, 1.560]], 0.0033));
  return [
    part({ kind: 5, c: [0.045, 0.02, 0.16], c2: [0.95, 0.36, 0.05], r: 0.09, m: 1 }, ...lenses),
    part({ c: GOLD, r: 0.2, m: 1 }, ...rims, ...gold),
    part({ c: INK, r: 0.25 }, ...tips)
  ];
})();
// head-bone matrix of a posed caveman, for things he wears (they are built in resting coordinates)
function headMatrix(f, out) { return mul4(f.model, f.bones.subarray(IDX.head * 16, IDX.head * 16 + 16), out); }
const wornM = new Float32Array(16), crookM = new Float32Array(16), wornOut = new Float32Array(16);
function drawShadesOn(prog, f) {
  let M = headMatrix(f, wornM);
  if (f.crooked) {                                          // knocked sideways and slid down his nose
    const pivot = [0, 1.555, 0.16], R = M3.rz(0.42 * f.crooked), move = V.add(V.sub(pivot, M3.vec(R, pivot)), [0.006 * f.crooked, -0.034 * f.crooked, 0.016 * f.crooked]);
    M = mul4(M, m4(R, move, crookM), wornOut);
  }
  drawParts(prog, SHADES, M);
}

// ---------------------------------------------------------------- the captain's hat
const HAT = (() => {
  const ring = (u, rx, rz, y) => { const a = u * 2 * Math.PI; return [Math.sin(a) * rx, y, 0.004 + Math.cos(a) * rz]; };
  const shape = rows => MB.grid((u, v) => { const [rx, rz, y] = rows[Math.round(v * (rows.length - 1))]; return ring(u, rx, rz, y); }, 32, rows.length - 1);
  const crown = shape([[0.124, 0.15, 1.664], [0.134, 0.163, 1.69], [0.152, 0.182, 1.714], [0.146, 0.176, 1.728], [0.10, 0.12, 1.737], [0.0, 0.0, 1.74]]);
  const band = shape([[0.121, 0.147, 1.632], [0.126, 0.153, 1.650], [0.125, 0.152, 1.666]]);
  const brim = MB.grid((u, v) => { const a = (u - 0.5) * 2.1; const r = 1 + v * 0.5; return [Math.sin(a) * 0.121 * (1 + v * 0.18), 1.637 - 0.028 * v * Math.cos(a), 0.004 + Math.cos(a) * 0.147 * (1 + v * 0.42 * Math.cos(a))]; }, 16, 4);
  const cord = MB.tube(Array.from({ length: 17 }, (_, k) => { const a = (k / 16 - 0.5) * 2.0; return [Math.sin(a) * 0.1275, 1.642, 0.004 + Math.cos(a) * 0.155]; }), 0.004, 6);
  return [
    part({ c: WHITE, r: 0.65 }, crown), part({ c: [0.006, 0.012, 0.05], r: 0.55 }, band), part({ c: INK, r: 0.16 }, brim),
    part({ c: GOLD, r: 0.28, m: 1 }, cord, MB.ball(0.022, 0.026, 0.006, [0, 1.672, 0.168], 16, 10), MB.move(MB.ring(0.028, 0.0035, 20, 6), [0, 1.672, 0.168]))
  ];
})();

// ---------------------------------------------------------------- the beer
const canLabel = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#f3e2b5'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b31d12'; g.fillRect(0, 0, w, 40); g.fillRect(0, h - 40, w, 40);
  g.fillStyle = '#e8a21c'; g.fillRect(0, 40, w, 10); g.fillRect(0, h - 50, w, 10);
  for (const x of [128, 384]) {                                       // the same face on both sides
    g.save(); g.translate(x, 0);
    g.fillStyle = '#4a2413';                                           // a woolly mammoth
    g.beginPath(); g.ellipse(6, 100, 46, 32, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(-34, 90, 24, 26, 0, 0, 7); g.fill();
    for (const lx of [-20, 2, 22, 38]) g.fillRect(lx, 112, 12, 28);
    g.lineCap = 'round'; g.strokeStyle = '#4a2413'; g.lineWidth = 12; g.beginPath(); g.moveTo(-52, 92); g.quadraticCurveTo(-72, 120, -60, 138); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = 7; g.beginPath(); g.moveTo(-44, 108); g.quadraticCurveTo(-66, 134, -86, 112); g.stroke();
    g.fillStyle = '#f3e2b5'; g.beginPath(); g.arc(-40, 84, 3.5, 0, 7); g.fill();
    g.fillStyle = '#7d130b'; g.textAlign = 'center'; g.font = '900 38px Impact, "Arial Black", sans-serif'; g.fillText('CAVE BREW', 0, 174);
    g.fillStyle = '#3a2410'; g.font = 'bold 17px Georgia, serif'; g.fillText('★ ICE AGE LAGER ★', 0, 198);
    g.fillStyle = '#fff3d0'; g.font = 'bold 22px Georgia, serif'; g.fillText('SINCE 10,000 BC', 0, 28);
    g.restore();
  }
});
const CAN = (() => {
  const side = MB.lathe([[0.036, 0.010], [0.036, 0.040], [0.036, 0.080], [0.036, 0.114]], 32);
  for (let q = 7; q < side.v.length; q += 8) side.v[q] = 1 - side.v[q];                       // the label the right way up
  const bottom = MB.lathe([[0, 0.009], [0.018, 0.006], [0.027, 0.0], [0.030, 0.0], [0.036, 0.010]], 32);
  const top = MB.lathe([[0.036, 0.114], [0.0315, 0.126], [0.0318, 0.131], [0.0295, 0.131], [0.0288, 0.1245], [0.012, 0.124], [0.0, 0.125]], 32);
  const tab = MB.move(MB.ring(0.0075, 0.0019, 16, 6), [0, 0.1262, 0.006], M3.rx(Math.PI / 2));
  return [
    part({ kind: 3, c: [1, 1, 1], tex: canLabel, r: 0.3, m: 0.35 }, side),
    part({ c: CHROME, r: 0.26, m: 1 }, bottom, top, tab, MB.ball(0.003, 0.0015, 0.003, [0, 0.126, 0], 8, 4))
  ];
})();
// held: lying along his thumb, just under the palm. in resting coordinates, one for each hand
const CAN_IN_HAND = { R: m4(M3.rx(Math.PI / 2), [-1.036, 1.268, -0.14], new Float32Array(16)), L: m4(M3.rx(Math.PI / 2), [1.036, 1.268, -0.14], new Float32Array(16)) };
const handM = new Float32Array(16), handOut = new Float32Array(16);
function drawHeldCan(prog, f, s) {
  const k = IDX['hand_' + s];
  drawParts(prog, CAN, mul4(mul4(f.model, f.bones.subarray(k * 16, k * 16 + 16), handM), CAN_IN_HAND[s], handOut));
}

// ---------------------------------------------------------------- the boombox
// origin: middle of its base. front faces +z
const dialTex = canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = '#10100c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4c45a'; g.font = 'bold 20px monospace'; g.textAlign = 'center';
  [88, 92, 96, 100, 104, 108].forEach((n, i) => { const x = 40 + i * 86; g.fillText(n, x, 24); for (let k = -2; k <= 2; k++) g.fillRect(x + k * 17, k ? 40 : 34, 2, k ? 10 : 16); });
  g.fillStyle = '#ff3b18'; g.fillRect(262, 4, 5, h - 8);
});
const badgeTex = canvasTex(512, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 900 40px Impact, "Arial Black", sans-serif'; g.fillStyle = '#ffffff'; g.fillText('GOOB·BLASTER 3000', w / 2, h / 2 + 2);
});
// a flat label, w by h, facing +z
const label = (w, h, at) => MB.grid((u, v) => [at[0] + (u - 0.5) * w, at[1] + (0.5 - v) * h, at[2]], 1, 1);
const BOOMBOX = (() => {
  const turn = M3.rx(Math.PI / 2);                                  // lathes point up; these point forward
  const body = MB.box(0.68, 0.32, 0.17, 0.045, [0, 0.16, 0]);
  const face = MB.box(0.64, 0.28, 0.012, 0.006, [0, 0.16, 0.085]);
  const chrome = [], black = [], rubber = [];
  const cone = [], cap = [];
  for (const s of [-1, 1]) {
    const c = [s * 0.205, 0.152, 0.093];
    chrome.push(MB.move(MB.ring(0.103, 0.011, 40, 10), c), MB.move(MB.ring(0.116, 0.003, 40, 6), c));
    rubber.push(MB.move(MB.ring(0.087, 0.009, 36, 8), V.add(c, [0, 0, -0.001])));
    cone.push(MB.move(MB.lathe([[0.086, 0.004], [0.062, -0.006], [0.045, -0.012], [0.028, -0.016]], 32), c, turn));
    cap.push(MB.ball(0.032, 0.032, 0.016, V.add(c, [0, 0, -0.014]), 20, 12));
    chrome.push(MB.move(MB.ring(0.034, 0.003, 28, 6), V.add(c, [0, 0, -0.010])));
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chrome.push(MB.ball(0.006, 0.006, 0.004, [c[0] + dx * 0.092, c[1] + dy * 0.092, 0.094], 8, 6));
  }
  // the tape deck and its two reels
  black.push(MB.box(0.15, 0.10, 0.012, 0.006, [0, 0.135, 0.092]));
  chrome.push(MB.box(0.162, 0.008, 0.014, 0.003, [0, 0.19, 0.092]), MB.box(0.162, 0.008, 0.014, 0.003, [0, 0.08, 0.092]));
  const reel = MB.merge([MB.ring(0.017, 0.0036, 18, 6), MB.box(0.034, 0.005, 0.004, 0.001), MB.box(0.005, 0.034, 0.004, 0.001)]);
  // keys along the top, two fat knobs
  for (let k = 0; k < 6; k++) chrome.push(MB.box(0.036, 0.018, 0.05, 0.004, [-0.105 + k * 0.042, 0.325, 0.03]));
  for (const s of [-1, 1]) {
    chrome.push(MB.move(MB.lathe([[0, 0.032], [0.027, 0.03], [0.03, 0.022], [0.031, 0.0]], 24), [s * 0.245, 0.318, 0.01]));
    black.push(MB.box(0.004, 0.003, 0.022, 0.001, [s * 0.245, 0.351, 0.022]));
  }
  // the handle and the aerial
  black.push(MB.tube(curve([[-0.29, 0.31, -0.03], [-0.285, 0.40, -0.03], [-0.22, 0.425, -0.03], [0.22, 0.425, -0.03], [0.285, 0.40, -0.03], [0.29, 0.31, -0.03]], 8), 0.015, 10));
  rubber.push(MB.tube([[-0.13, 0.426, -0.03], [0.13, 0.426, -0.03]], 0.023, 12));
  chrome.push(MB.tube([[0.30, 0.30, -0.055], [0.43, 0.62, -0.065]], 0.006, 8), MB.tube([[0.43, 0.62, -0.065], [0.52, 0.84, -0.072]], 0.0038, 8), MB.ball(0.011, 0.011, 0.011, [0.52, 0.84, -0.072], 8, 6));
  const leds = [];
  for (let k = 0; k < 10; k++) leds.push(part({ c: k < 6 ? [0.05, 0.9, 0.12] : k < 8 ? [1.0, 0.65, 0.02] : [1.0, 0.05, 0.02], r: 0.3 }, MB.box(0.009, 0.014, 0.008, 0.002, [-0.0585 + k * 0.013, 0.231, 0.094])));
  return {
    still: [
      part({ c: [0.50, 0.52, 0.56], r: 0.34, m: 0.9 }, body), part({ c: [0.018, 0.019, 0.023], r: 0.4, m: 0.3 }, face),
      part({ c: CHROME, r: 0.16, m: 1 }, ...chrome), part({ c: INK, r: 0.22, m: 0.2 }, ...black), part({ c: [0.012, 0.012, 0.013], r: 0.85 }, ...rubber),
      part({ kind: 3, c: [1, 1, 1], tex: dialTex, r: 0.15, glow: 0.35 }, label(0.20, 0.028, [0, 0.263, 0.0925])),
      part({ kind: 3, c: [1, 1, 1], tex: badgeTex, r: 0.25, m: 0.8 }, label(0.19, 0.024, [0, 0.045, 0.0925]))
    ],
    cones: [part({ c: [0.030, 0.030, 0.036], r: 0.55, m: 0.2 }, ...cone), part({ c: [0.09, 0.09, 0.10], r: 0.18, m: 0.7 }, ...cap)],
    reel: [part({ c: WHITE, r: 0.4 }, reel)],
    leds
  };
})();
const boomM = new Float32Array(16), boomPart = new Float32Array(16);
// R, p: where it stands. beat: 0..1 thump; level: how loud (the lights); spin: the tape reels
function drawBoombox(prog, R, p, thump, level, spin, S) {
  const s = S || 1, Rs = M3.mul(R, [s * (1 + 0.03 * thump), 0, 0, 0, s * (1 - 0.025 * thump), 0, 0, 0, s]);
  const M = m4(Rs, p, boomM);
  drawParts(prog, BOOMBOX.still, M);
  drawParts(prog, BOOMBOX.cones, mul4(M, m4(M3.id(), [0, 0, 0.016 * thump], boomPart)));
  for (const s2 of [-1, 1]) drawParts(prog, BOOMBOX.reel, mul4(M, m4(M3.rz(spin), [s2 * 0.037, 0.138, 0.101], boomPart)));
  BOOMBOX.leds.forEach((led, k) => { led.glow = k < level * 10 ? 2.2 : 0.02; drawParts(prog, [led], M); });
}

// ---------------------------------------------------------------- the boat
// boat space: +z the bow, +x the left side, y = 0 the waterline. he stands on the floor at FLOOR
const FLOOR = 0.12;
const HULL = {
  z: u => -2.4 + 5.0 * u,
  beam: u => u < 0.55 ? 0.92 + 0.14 * smooth(0, 0.55, u) : 1.06 * Math.sqrt(Math.max(0, 1 - ((u - 0.55) / 0.45) ** 2.1)),
  keel: u => -0.30 + 0.92 * smooth(0.64, 1.0, u) ** 2,
  sheer: u => 0.55 + 0.27 * u * u * u,
  // a point of the skin: s runs from the keel (0) to the top edge (1)
  at(u, s, side) {
    const w = HULL.beam(u), keel = HULL.keel(u), top = HULL.sheer(u), chine = keel + 0.20 * (1 - 0.5 * smooth(0.7, 1, u));
    if (s < 0.4) { const t = s / 0.4; return [side * w * 0.90 * Math.sin(t * Math.PI / 2 * 0.92) / Math.sin(Math.PI / 2 * 0.92), keel + (chine - keel) * t ** 1.5, HULL.z(u)]; }
    const t = (s - 0.4) / 0.6;
    return [side * w * (0.90 + 0.11 * Math.sin(t * Math.PI * 0.62)), chine + (top - chine) * t, HULL.z(u)];
  }
};
// how wide it is at z, for keeping the sea out of it
const hullHalf = z => HULL.beam(clamp((z + 2.4) / 5.0, 0, 1));
const nameTex = canvasTex(512, 96, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic bold 70px Georgia, "Times New Roman", serif';
  g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#1b0b02'; g.strokeText('Goob Seas', w / 2, h / 2); g.fillStyle = '#ffd36a'; g.fillText('Goob Seas', w / 2, h / 2);
});
const flagTex = canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = '#111216'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4ecd8'; g.lineWidth = 17; g.lineCap = 'round';
  g.beginPath(); g.moveTo(80, 50); g.lineTo(176, 112); g.moveTo(176, 50); g.lineTo(80, 112); g.stroke();
  g.fillStyle = '#f4ecd8';
  for (const [x, y, dx, dy] of [[80, 50, -1, -1], [176, 50, 1, -1], [80, 112, -1, 1], [176, 112, 1, 1]]) for (const [a, b] of [[dx * 12, 0], [0, dy * 12]]) { g.beginPath(); g.arc(x + a, y + b, 12, 0, 7); g.fill(); }
});
// the boat is made in two halves, with a jagged line between them, so that it can break
const BREAK = 0.44;
const jag = s => { const k = s * 7, i = Math.floor(k), f = k - i; const n = j => (bump(j, 91) - 0.5) * 2; return n(i) + (n(i + 1) - n(i)) * f; };
function makeBoatHalf(bow, burnt) {
  const lo = bow ? BREAK : 0, hi = bow ? 1 : BREAK;
  const split = s => BREAK + 0.045 * jag(s);
  const span = (v, s) => bow ? split(s) + (1 - split(s)) * v : split(s) * v;
  const skin = [], inner = [], cap = [], rail = [], floor = [], chrome = [], wood = [], leather = [], white = [], black = [], gold = [], glass = [];
  const nu = bow ? 34 : 24;
  for (const side of [-1, 1]) {
    skin.push(MB.grid((v, s) => HULL.at(span(v, s), s, side), nu, 14));
    inner.push(MB.grid((v, s) => {                                  // the inside face of the planking, down to the floor
      const u = span(v, 0.5 + s * 0.5), top = HULL.sheer(u), y = Math.min(top - 0.01, Math.max(FLOOR, HULL.keel(u) + 0.05) + (top - Math.max(FLOOR, HULL.keel(u) + 0.05)) * s);
      return [side * Math.max(0, HULL.beam(u) * (0.90 + 0.06 * s) - 0.035), y, HULL.z(u)];
    }, nu, 4));
    cap.push(MB.grid((v, w) => { const u = lo + (hi - lo) * v, b = HULL.beam(u); return [side * Math.max(0, b * 1.01 - 0.135 * w), HULL.sheer(u) + 0.004 + 0.026 * Math.sin(Math.PI * w), HULL.z(u)]; }, nu, 5));
    rail.push(MB.tube(Array.from({ length: nu + 1 }, (_, k) => { const u = lo + (hi - lo) * k / nu, p = HULL.at(u, 1, side); return [p[0] * 1.012, p[1] + 0.008, p[2]]; }), 0.019, 8));
    rail.push(MB.tube(Array.from({ length: nu + 1 }, (_, k) => { const u = lo + (hi - lo) * k / nu * (bow ? 0.985 : 1), p = HULL.at(u, 0.74, side); return [p[0] * 1.008, p[1], p[2]]; }), 0.010, 6));
  }
  floor.push(MB.grid((v, w) => { const u = lo + (Math.min(hi, 0.86) - lo) * v; return [(w - 0.5) * 2 * Math.max(0, HULL.beam(u) * 0.90 - 0.03), Math.max(FLOOR, HULL.keel(u) + 0.05), HULL.z(u)]; }, nu, 8));
  const deck = (u0, u1) => MB.grid((v, w) => { const u = u0 + (u1 - u0) * v, b = Math.max(0, HULL.beam(u) - 0.10), x = (w - 0.5) * 2; return [x * b, HULL.sheer(u) + 0.012 + 0.07 * (1 - x * x) * Math.min(1, b * 2), HULL.z(u)]; }, 20, 12);
  const out = [];
  if (!bow) {
    // the back board, the little deck behind the bench, the bench and the motor
    wood.push(MB.grid((v, s) => { const l = HULL.at(0, s, 1); return [(v - 0.5) * 2 * l[0], l[1], l[2]]; }, 8, 14));
    cap.push(deck(0.0, 0.085));
    rail.push(MB.tube([HULL.at(0, 1, -1), HULL.at(0, 1, 1)].map(p => [p[0], p[1] + 0.012, p[2] - 0.004]), 0.019, 8));
    wood.push(MB.box(1.62, 0.20, 0.46, 0.02, [0, FLOOR + 0.10, -1.55]));
    for (const x of [-0.535, 0, 0.535]) {
      leather.push(MB.box(0.52, 0.12, 0.47, 0.05, [x, FLOOR + 0.255, -1.55]), MB.move(MB.box(0.52, 0.42, 0.10, 0.045), [x, FLOOR + 0.52, -1.84], M3.rx(-0.17)));
      white.push(MB.move(MB.tube(curve([[-0.20, -0.14, 0.052], [-0.20, 0.17, 0.052], [0.20, 0.17, 0.052], [0.20, -0.14, 0.052]], 4), 0.006, 6), [x, FLOOR + 0.52, -1.84], M3.rx(-0.17)));
    }
    // the outboard motor
    black.push(MB.box(0.36, 0.34, 0.44, 0.13, [0, 0.80, -2.64]), MB.box(0.13, 0.62, 0.13, 0.04, [0, 0.34, -2.57]), MB.box(0.16, 0.12, 0.3, 0.05, [0, -0.27, -2.62]));
    chrome.push(MB.box(0.37, 0.035, 0.45, 0.015, [0, 0.755, -2.64]), MB.box(0.2, 0.14, 0.08, 0.02, [0, 0.55, -2.45]), MB.tube([[0, 0.62, -2.5], [0, 0.66, -2.38]], 0.025, 8));
    leather.push(MB.box(0.365, 0.06, 0.445, 0.025, [0, 0.845, -2.64]));
    // flag pole
    chrome.push(MB.tube([[-0.72, 0.56, -2.2], [-0.74, 1.62, -2.3]], 0.014, 8), MB.ball(0.028, 0.028, 0.028, [-0.74, 1.63, -2.3], 10, 8));
    // bow-half-side cooler
    out.push(part({ c: [0.012, 0.16, 0.42], r: 0.28 }, MB.box(0.46, 0.27, 0.30, 0.05, [0.48, FLOOR + 0.135, -0.72])));
    white.push(MB.box(0.48, 0.06, 0.32, 0.028, [0.48, FLOOR + 0.295, -0.72]), MB.tube(curve([[0.36, FLOOR + 0.33, -0.72], [0.39, FLOOR + 0.355, -0.72], [0.57, FLOOR + 0.355, -0.72], [0.60, FLOOR + 0.33, -0.72]], 4), 0.011, 6));
  } else {
    cap.push(deck(0.69, 1.0));
    chrome.push(MB.tube(curve([[0, HULL.sheer(0.97) + 0.03, HULL.z(0.97)], [0, HULL.sheer(0.98) + 0.16, HULL.z(0.975)], [0, HULL.sheer(0.9) + 0.17, HULL.z(0.9)], [0, HULL.sheer(0.86) + 0.09, HULL.z(0.86)]], 6), 0.017, 8));
    chrome.push(MB.ball(0.055, 0.04, 0.09, [0, HULL.sheer(0.80) + 0.10, HULL.z(0.80)], 14, 10));
    // dashboard with dials, under a curved windscreen
    const zd = 1.02;
    wood.push(MB.box(1.62, 0.40, 0.16, 0.05, [0, 0.43, zd + 0.06]));
    for (const [x, r] of [[0.38, 0.065], [0.56, 0.045], [-0.4, 0.045]]) { chrome.push(MB.move(MB.ring(r, 0.009, 24, 8), [x, 0.50, zd - 0.028])); white.push(MB.ball(r * 0.9, r * 0.9, 0.006, [x, 0.50, zd - 0.022], 16, 8)); black.push(MB.move(MB.box(0.007, r * 0.8, 0.004, 0.001, [0, r * 0.32, 0]), [x, 0.50, zd - 0.030], M3.rz(0.7))); }
    const shield = (v, h) => { const x = (v - 0.5) * 2, zz = 1.16 - 0.30 * x * x * x * x; return [x * (0.88 - 0.10 * h), HULL.sheer(0.71) + 0.05 + 0.34 * h * (1 - 0.35 * x * x * x * x), zz - 0.19 * h]; };
    glass.push(MB.grid(shield, 24, 4));
    chrome.push(MB.tube(Array.from({ length: 25 }, (_, k) => shield(k / 24, 1)), 0.014, 8), MB.tube(Array.from({ length: 25 }, (_, k) => shield(k / 24, 0)), 0.012, 8));
    for (const v of [0, 0.5, 1]) chrome.push(MB.tube([shield(v, 0), shield(v, 1)], 0.011, 8));
    // the driver's stool
    leather.push(MB.box(0.50, 0.12, 0.40, 0.055, [0, FLOOR + 0.28, 0.30]));
    white.push(MB.move(MB.tube(Array.from({ length: 24 }, (_, k) => { const a = k / 24 * 2 * Math.PI; return [Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.3 * 0.235, Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.3 * 0.185, 0]; }), 0.006, 6, true), [0, FLOOR + 0.335, 0.30], M3.rx(Math.PI / 2)));
    chrome.push(MB.move(MB.lathe([[0.16, 0], [0.15, 0.02], [0.05, 0.05], [0.045, 0.2], [0.09, 0.23]], 24), [0, FLOOR, 0.30]));
    chrome.push(MB.tube([[0, 0.55, 1.02], [0, 0.74, 0.86]], 0.025, 8));
  }
  // life ring on the inside of one wall
  if (!bow) out.push(part({ kind: 7, c: [0.85, 0.16, 0.01], c2: WHITE, r: 0.45 }, MB.ring(0.17, 0.052, 36, 12)));
  const ringPart = !bow ? out.pop() : null;
  // the name, on both sides near the back
  if (!bow) for (const side of [-1, 1]) {
    const name = MB.grid((v, h) => { const u = 0.07 + 0.27 * (side > 0 ? 1 - v : v), p = HULL.at(u, 0.915 - h * 0.15, side); return [p[0] * 1.006 + side * 0.004, p[1], p[2]]; }, 12, 2);
    out.push(part({ kind: 3, c: [1, 1, 1], tex: nameTex, r: 0.3, m: 0.5 }, name));
  }
  const W = burnt ? 9 : 2, D = burnt ? 9 : 1;
  out.push(part({ kind: W, c: MAHOGANY, r: 0.16, glow: burnt ? 1 : 0 }, ...skin));
  out.push(part({ kind: D, c: [0.42, 0.19, 0.06], r: 0.4, glow: burnt ? 0.8 : 0 }, ...inner, ...floor));
  out.push(part({ kind: D, c: TEAK, r: 0.2, glow: burnt ? 0.6 : 0 }, ...cap));
  if (wood.length) out.push(part({ kind: W, c: MAHOGANY, r: 0.2, glow: burnt ? 1 : 0 }, ...wood));
  out.push(part({ c: burnt ? [0.18, 0.17, 0.16] : CHROME, r: burnt ? 0.55 : 0.13, m: 1 }, ...rail, ...chrome));
  if (leather.length) out.push(part(burnt ? { kind: 9, c: [0.18, 0.02, 0.012], r: 0.8, glow: 0.6 } : { c: LEATHER, r: 0.36 }, ...leather));
  if (white.length) out.push(part({ c: burnt ? [0.2, 0.18, 0.15] : WHITE, r: 0.35 }, ...white));
  if (black.length) out.push(part({ c: INK, r: burnt ? 0.7 : 0.14, m: 0.4 }, ...black));
  const glassPart = glass.length && !burnt ? part({ kind: 8, c: [0.35, 0.55, 0.6], r: 0.06 }, ...glass) : null;
  return { parts: out, glass: glassPart, ring: ringPart };
}
const BOAT = { stern: makeBoatHalf(false, false), bow: makeBoatHalf(true, false), sternBurnt: makeBoatHalf(false, true), bowBurnt: makeBoatHalf(true, true) };
BOAT.wheel = [
  part({ c: MAHOGANY, r: 0.18 }, MB.ring(0.17, 0.022, 36, 10)),
  part({ c: CHROME, r: 0.14, m: 1 }, ...[0, 1, 2].map(k => MB.tube([[0, 0, 0], [Math.cos(k * 2.094 + 1.57) * 0.165, Math.sin(k * 2.094 + 1.57) * 0.165, 0]], 0.011, 8)), MB.ball(0.04, 0.04, 0.028, [0, 0, 0], 14, 10))
];
BOAT.prop = [part({ c: [0.75, 0.52, 0.20], r: 0.25, m: 1 }, MB.ball(0.035, 0.035, 0.07, [0, 0, 0], 10, 8), ...[0, 1, 2].map(k => MB.move(MB.ball(0.05, 0.12, 0.012, [0, 0.11, 0], 14, 8), [0, 0, 0], M3.mul(M3.rz(k * 2.094), M3.ry(0.5)))))];
BOAT.flag = [part({ kind: 6, c: [1, 1, 1], tex: flagTex, r: 0.8 }, MB.grid((u, v) => [u * 0.55, -v * 0.34, 0], 20, 4))];
const WHEEL_AT = [0, 0.78, 0.83];
const boatM = new Float32Array(16), boatSub = new Float32Array(16), boatOut = new Float32Array(16);
// one half of the boat, with everything that is fixed to it. o: { wheel, prop, t, burnt }
function drawBoatHalf(prog, bow, M, o) {
  const half = BOAT[(bow ? 'bow' : 'stern') + (o.burnt ? 'Burnt' : '')];
  drawParts(prog, half.parts, M);
  const sub = (parts, R, p) => drawParts(prog, parts, mul4(M, m4(R, p, boatSub), boatOut));
  if (bow) { sub(BOAT.wheel, M3.mul(M3.rx(0.55), M3.rz(o.wheel || 0)), WHEEL_AT); return; }
  sub([half.ring], M3.mul(M3.ry(Math.PI / 2), M3.rz(0.4)), [-0.87, 0.38, -0.75]);
  sub(BOAT.prop, M3.rz(o.prop || 0), [0, -0.27, -2.82]);
  if (!o.burnt) {
    sub(BOAT.flag, M3.ry(Math.PI / 2), [-0.74, 1.60, -2.30]);
    sub(CAN, M3.id(), [0.40, FLOOR + 0.325, -0.77]); sub(CAN, M3.ry(1.7), [0.55, FLOOR + 0.325, -0.66]);
  }
}

// ---------------------------------------------------------------- rocks
function rockMesh(seed, sx, sy, sz) {
  const n = (x, y, z) => { const h = (i, j, k) => bump(i * 7 + k * 13 + seed, j * 11 + k); const [i, j, k] = [x, y, z].map(Math.floor), [a, b, c] = [x - i, y - j, z - k].map(t => t * t * (3 - 2 * t));
    const mix = (p, q, t) => p + (q - p) * t;
    return mix(mix(mix(h(i, j, k), h(i + 1, j, k), a), mix(h(i, j + 1, k), h(i + 1, j + 1, k), a), b), mix(mix(h(i, j, k + 1), h(i + 1, j, k + 1), a), mix(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), a), b), c); };
  const nu = 40, nv = 24;
  const m = MB.grid((u, v) => {
    const a = (u % 1) * 2 * Math.PI, b = (v - 0.5) * Math.PI, d = [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)];
    const r = 0.62 + 0.75 * n(d[0] * 1.7 + 5, d[1] * 1.7 + 5, d[2] * 1.7 + 5) + 0.28 * n(d[0] * 4.5, d[1] * 4.5 + 9, d[2] * 4.5) - 0.12;
    return [d[0] * r * sx, d[1] * r * sy, d[2] * r * sz];
  }, nu, nv);
  return m;
}
const ROCKS = [part({ kind: 4, c: [0.20, 0.17, 0.14], r: 0.75 }, rockMesh(1, 1.5, 2.2, 1.4), MB.move(rockMesh(2, 0.9, 1.0, 1.0), [1.7, -0.2, 0.7]), MB.move(rockMesh(3, 0.8, 0.75, 0.9), [-1.8, -0.15, 0.3]), MB.move(rockMesh(4, 0.5, 0.55, 0.6), [-0.9, -0.1, -1.6]))];
// bits of boat
const PLANK = [part({ kind: 1, c: MAHOGANY, r: 0.3 }, MB.box(0.13, 0.035, 0.7, 0.008))];
const CHARRED = [part({ kind: 9, c: MAHOGANY, r: 0.6, glow: 1 }, MB.box(0.13, 0.035, 0.7, 0.008))];
