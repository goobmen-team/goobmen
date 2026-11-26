'use strict';
// ======================================================================= maths
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  mad: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  orth: (v, axis) => V.norm(V.mad(v, axis, -V.dot(v, axis)))
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
// 3x3 rotations, column major
const M3 = {
  id: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  cols: (x, y, z) => [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]],
  mul: (a, b) => { const o = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; },
  vec: (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]],
  tr: m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]],
  axis: (n, a) => { const [x, y, z] = V.norm(n), c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, t * x * y - s * z, t * y * y + c, t * y * z + s * x, t * x * z + s * y, t * y * z - s * x, t * z * z + c]; },
  toQuat: m => {
    const t = m[0] + m[4] + m[8]; let x, y, z, w;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[5] - m[7]) / s; y = (m[6] - m[2]) / s; z = (m[1] - m[3]) / s; }
    else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[5] - m[7]) / s; x = s / 4; y = (m[3] + m[1]) / s; z = (m[6] + m[2]) / s; }
    else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[6] - m[2]) / s; x = (m[3] + m[1]) / s; y = s / 4; z = (m[7] + m[5]) / s; }
    else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[1] - m[3]) / s; x = (m[6] + m[2]) / s; y = (m[7] + m[5]) / s; z = s / 4; }
    return [x, y, z, w];
  },
  mix: (a, b, t) => {
    const p = M3.toQuat(a), q = M3.toQuat(b), k = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3]) < 0 ? -t : t;
    const r = p.map((v, i) => v * (1 - t) + q[i] * k), l = Math.hypot(...r) || 1;
    return M3.quat(r[0] / l, r[1] / l, r[2] / l, r[3] / l);
  },
  rx: a => M3.axis([1, 0, 0], a), ry: a => M3.axis([0, 1, 0], a), rz: a => M3.axis([0, 0, 1], a),
  quat: (x, y, z, w) => [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
  // rotation taking direction a (with side b) onto direction c (with side d)
  frame: (a, b, c, d) => {
    const A = V.norm(a), B = V.orth(b, A), C = V.norm(c), D = V.orth(d, C);
    return M3.mul(M3.cols(C, D, V.cross(C, D)), M3.tr(M3.cols(A, B, V.cross(A, B))));
  }
};
function m4(R, p, out) {
  out = out || new Float32Array(16);
  out.set([R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, p[0], p[1], p[2], 1]);
  return out;
}
function mul4(a, b, out) {
  out = out || new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}
function perspective(fovy, aspect, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
}
function ortho(r, t, n, f) { return new Float32Array([1 / r, 0, 0, 0, 0, 1 / t, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]); }
function lookAt(eye, at) {
  const z = V.norm(V.sub(eye, at)), x = V.norm(V.cross([0, 1, 0], z)), y = V.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
}
const b64bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ======================================================================= GL
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
if (!gl) { document.getElementById('msg').textContent = 'This game needs WebGL 2, which this browser has off or does not support.'; throw new Error('no webgl2'); }
function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, '#version 300 es\nprecision highp float;\n' + src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + src);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[n] = gl.getUniformLocation(p, n); }
  return { p, u };
}
const COMMON = `
uniform highp sampler2DShadow uShadow; uniform mat4 uLight; uniform vec3 uSun, uEye, uFlashPos, uFlashCol;
float shadowAt(vec3 w) {
  vec4 q = uLight * vec4(w, 1.0); vec3 p = q.xyz / q.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0; vec2 t = 1.0 / vec2(textureSize(uShadow, 0));
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uShadow, vec3(p.xy + vec2(x, y) * t * 1.4, p.z - 0.0012));
  return s / 9.0;
}
vec3 flashLight(vec3 w, vec3 N) {
  vec3 d = uFlashPos - w; float r2 = dot(d, d);
  return uFlashCol * (0.35 + 0.65 * max(dot(N, d * inversesqrt(r2 + 1e-5)), 0.0)) / (1.0 + r2 * 5.0);
}
vec3 normalMap(sampler2D map, vec3 N, vec3 w, vec2 uv) {
  vec3 dp1 = dFdx(w), dp2 = dFdy(w); vec2 du1 = dFdx(uv), du2 = dFdy(uv);
  vec3 p2 = cross(dp2, N), p1 = cross(N, dp1);
  vec3 T = p2 * du1.x + p1 * du2.x, B = p2 * du1.y + p1 * du2.y;
  float k = max(dot(T, T), dot(B, B));
  if (k <= 0.0) return N;
  float inv = inversesqrt(k); vec3 m = texture(map, uv).xyz * 2.0 - 1.0;
  return normalize(T * inv * m.x - B * inv * m.y + N * m.z);
}`;
const SKINVS = `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv;
layout(location=3) in uvec4 aJ; layout(location=4) in vec4 aW;
uniform mat4 uBones[40]; uniform mat4 uModel;
mat4 skin() { return uModel * (uBones[aJ.x]*aW.x + uBones[aJ.y]*aW.y + uBones[aJ.z]*aW.z + uBones[aJ.w]*aW.w); }`;
const skinProg = program(`${SKINVS}
uniform mat4 uViewProj; out vec3 vW; out vec3 vN; out vec2 vUv;
void main() { mat4 m = skin(); vec4 w = m * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(m) * aNrm; vUv = aUv; gl_Position = uViewProj * w; }`, `
in vec3 vW; in vec3 vN; in vec2 vUv; out vec4 o;
uniform sampler2D uTex, uNormalMap; uniform int uHasTex, uHasNormal; uniform vec3 uColor, uTint; uniform float uRough, uHurt;
${COMMON}
void main() {
  vec3 V = normalize(uEye - vW), N = normalize(vN);
  if (dot(N, V) < -0.15 && !gl_FrontFacing) N = -N;
  if (uHasNormal == 1) N = normalMap(uNormalMap, N, vW, vUv);
  vec3 base = (uHasTex == 1 ? texture(uTex, vUv).rgb : uColor) * uTint;
  float sh = shadowAt(vW + N * 0.012), ndl = max(dot(N, uSun), 0.0);
  vec3 hemi = mix(vec3(0.28, 0.25, 0.23), vec3(0.60, 0.62, 0.66), N.y * 0.5 + 0.5);
  vec3 light = hemi + vec3(1.22, 1.17, 1.10) * ndl * sh + vec3(0.40, 0.39, 0.38) * max(dot(N, V), 0.0) * (1.0 - 0.8 * ndl * sh) + flashLight(vW, N);
  float spec = pow(max(dot(N, normalize(uSun + V)), 0.0), mix(180.0, 8.0, uRough)) * (1.0 - uRough) * 0.3 * sh * step(0.0, ndl) * clamp(dot(base, vec3(0.3, 0.6, 0.1)) * 5.0 - 0.1, 0.05, 1.0);
  vec3 col = base * light + vec3(spec) + vec3(0.8, 0.05, 0.02) * uHurt;
  o = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`);
const skinDepth = program(`${SKINVS}\nuniform mat4 uViewProj; void main() { gl_Position = uViewProj * skin() * vec4(aPos, 1.0); }`, 'void main() {}');
const STATICVS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; uniform mat4 uModel, uViewProj;`;
const pbrProg = program(`${STATICVS} out vec3 vW; out vec3 vN; out vec2 vUv;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aNrm; vUv = aUv; gl_Position = uViewProj * w; }`, `
in vec3 vW; in vec3 vN; in vec2 vUv; out vec4 o;
uniform sampler2D uTex, uNormalMap, uOrm; uniform int uHasTex; uniform vec3 uColor; uniform float uRough, uMetal;
${COMMON}
vec3 env(vec3 r, float rough) {
  float y = r.y;
  vec3 sky = mix(vec3(0.75, 0.77, 0.80), vec3(0.35, 0.48, 0.72), clamp(y * 1.4, 0.0, 1.0));
  vec3 c = mix(vec3(0.16, 0.14, 0.12), sky, smoothstep(-0.12 - rough * 0.5, 0.12 + rough * 0.5, y));
  float strip = pow(max(dot(r, normalize(vec3(0.7, 0.45, -0.4))), 0.0), mix(60.0, 4.0, rough));
  return c + vec3(1.1, 1.05, 0.95) * strip * (1.0 - rough * 0.7);
}
void main() {
  vec3 V = normalize(uEye - vW), N = normalize(vN);
  vec3 base = uColor; float rough = uRough, metal = uMetal, ao = 1.0;
  if (uHasTex == 1) {
    vec3 orm = texture(uOrm, vUv).rgb; ao = orm.r; rough = orm.g; metal = orm.b;
    base = texture(uTex, vUv).rgb; N = normalMap(uNormalMap, N, vW, vUv);
  }
  rough = clamp(rough, 0.12, 1.0);
  float ndv = max(dot(N, V), 0.001), ndl = max(dot(N, uSun), 0.0), sh = shadowAt(vW + N * 0.01);
  vec3 H = normalize(uSun + V); float ndh = max(dot(N, H), 0.0), vdh = max(dot(V, H), 0.0);
  float a2 = pow(rough, 4.0), d = ndh * ndh * (a2 - 1.0) + 1.0, D = a2 / (3.14159 * d * d);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0, G = ndv / (ndv * (1.0 - k) + k) * ndl / (ndl * (1.0 - k) + k + 1e-4);
  vec3 F0 = mix(vec3(0.04), base * 1.25 + 0.03, metal), F = F0 + (1.0 - F0) * pow(1.0 - vdh, 5.0);
  vec3 kd = base * (1.0 - metal * 0.85);
  vec3 col = kd * (mix(vec3(0.30, 0.27, 0.25), vec3(0.62, 0.65, 0.70), N.y * 0.5 + 0.5) * ao + vec3(2.3, 2.2, 2.05) * ndl * sh + flashLight(vW, N) * 0.8);
  col += F * D * G / (4.0 * ndv + 1e-4) * 3.0 * sh;
  vec3 Fv = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - ndv, 5.0);
  col += env(reflect(-V, N), rough) * Fv * ao * 1.35 + flashLight(vW, N) * F0 * 0.5;
  col += vec3(0.07, 0.08, 0.10) * pow(1.0 - ndv, 3.0);
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  o = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`);
const staticDepth = program(`${STATICVS} void main() { gl_Position = uViewProj * uModel * vec4(aPos, 1.0); }`, 'void main() {}');
const plateProg = program(`layout(location=0) in vec3 aPos; uniform mat4 uViewProj; out vec3 vW;
void main() { vW = aPos; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec3 vW; out vec4 o;
${COMMON}
float grid(vec2 p, float cell, float width) {
  vec2 q = p / cell, d = max(fwidth(q), vec2(1e-4)), g = abs(fract(q - 0.5) - 0.5);
  vec2 l = 1.0 - smoothstep(vec2(width / cell * 0.5), vec2(width / cell * 0.5) + d, g);
  return max(l.x, l.y);
}
void main() {
  vec3 col = vec3(0.586, 0.594, 0.608) * (1.0 - 0.13 * grid(vW.xz, 1.0, 0.016) - 0.07 * grid(vW.xz, 4.0, 0.045));
  col *= mix(0.56, 1.0, shadowAt(vW));
  col += flashLight(vW, vec3(0.0, 1.0, 0.0)) * 0.35;
  col = mix(col, vec3(219.0 / 255.0), smoothstep(16.0, 55.0, length(vW - uEye)));
  o = vec4(col, 1.0);
}`);
const fxProg = program(`layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
uniform mat4 uViewProj; out vec2 vUv; out vec4 vCol; void main() { vUv = aUv; vCol = aCol; gl_Position = uViewProj * vec4(aPos, 1.0); }`, `
in vec2 vUv; in vec4 vCol; out vec4 o;
void main() { float a = vCol.a * smoothstep(1.0, 0.15, length(vUv)); o = vec4(vCol.rgb * a, a); }`);

function buffer(target, data) { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; }
function attrib(loc, data, size, type, integer, stride, offset) {
  if (data) buffer(gl.ARRAY_BUFFER, data);
  gl.enableVertexAttribArray(loc);
  if (integer) gl.vertexAttribIPointer(loc, size, type, stride || 0, offset || 0); else gl.vertexAttribPointer(loc, size, type, false, stride || 0, offset || 0);
}
function staticMesh(verts, idx) {          // interleaved pos, normal, uv
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  buffer(gl.ARRAY_BUFFER, verts);
  attrib(0, null, 3, gl.FLOAT, false, 32, 0); attrib(1, null, 3, gl.FLOAT, false, 32, 12); attrib(2, null, 2, gl.FLOAT, false, 32, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, idx);
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
}
function boxData(sx, sy, sz, ox, oy, oz) {
  const v = [], i = [];
  const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  const h = [sx / 2, sy / 2, sz / 2], o = [ox || 0, oy || 0, oz || 0];
  for (const [n, a, b] of faces) {
    const base = v.length / 8;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) v.push(o[k] + (n[k] + a[k] * s + b[k] * t) * h[k]);
      v.push(...n, 0, 0);
    }
    i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { v, i };
}
function mergeMesh(list) {
  const v = [], i = [];
  for (const m of list) { const base = v.length / 8; v.push(...m.v); for (const k of m.i) i.push(base + k); }
  return staticMesh(new Float32Array(v), new Uint32Array(i));
}
const boxMesh = (...a) => mergeMesh([boxData(...a)]);
async function loadTexture(blob, srgb) {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const an = gl.getExtension('EXT_texture_filter_anisotropic');
  if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}
const dataBlob = url => { const [head, body] = url.split(','); return new Blob([b64bytes(body)], { type: head.slice(5, head.indexOf(';')) }); };

// ======================================================================= the caveman
const Rig = {};
async function loadCaveman(glb64) {
  const bytes = b64bytes(glb64), dv = new DataView(bytes.buffer);
  const jlen = dv.getUint32(12, true);
  const g = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen)));
  const bin = 20 + jlen + 8;
  const TYPE = { 5121: Uint8Array, 5123: Uint16Array, 5126: Float32Array }, SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const view = i => { const v = g.bufferViews[i]; return bytes.subarray(bin + v.byteOffset, bin + v.byteOffset + v.byteLength); };
  const acc = i => { const a = g.accessors[i], r = view(a.bufferView); return new TYPE[a.componentType](r.buffer, r.byteOffset, a.count * SIZE[a.type]); };
  const joints = g.skins[0].joints, NB = joints.length;
  Rig.NB = NB; Rig.idx = {}; Rig.names = joints.map(j => g.nodes[j].name);
  Rig.names.forEach((n, i) => { Rig.idx[n] = i; });
  Rig.parent = new Array(NB).fill(-1);
  joints.forEach(j => (g.nodes[j].children || []).forEach(k => { Rig.parent[k] = j; }));
  Rig.offset = joints.map(j => g.nodes[j].translation.slice());
  Rig.rest = [];
  for (let i = 0; i < NB; i++) Rig.rest[i] = Rig.parent[i] < 0 ? Rig.offset[i] : V.add(Rig.rest[Rig.parent[i]], Rig.offset[i]);
  Rig.clips = {};
  for (const a of g.animations) {
    const rot = new Array(NB).fill(null); let hips = null, times = null;
    for (const ch of a.channels) {
      const s = a.samplers[ch.sampler]; times = acc(s.input);
      if (ch.target.path === 'rotation') rot[ch.target.node] = acc(s.output); else hips = acc(s.output);
    }
    Rig.clips[a.name] = { rot, hips, times, T: times[times.length - 1], speed: a.extras.groundSpeed, loop: a.extras.loop };
  }
  const tex = async (i, srgb) => { const im = g.images[g.textures[i].source]; return loadTexture(new Blob([view(im.bufferView)], { type: im.mimeType }), srgb); };
  Rig.prims = [];
  for (const p of g.meshes[0].primitives) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    attrib(0, acc(p.attributes.POSITION), 3, gl.FLOAT); attrib(1, acc(p.attributes.NORMAL), 3, gl.FLOAT); attrib(2, acc(p.attributes.TEXCOORD_0), 2, gl.FLOAT);
    attrib(3, acc(p.attributes.JOINTS_0), 4, gl.UNSIGNED_BYTE, true); attrib(4, acc(p.attributes.WEIGHTS_0), 4, gl.FLOAT);
    const idx = acc(p.indices); buffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    const m = g.materials[p.material], pbr = m.pbrMetallicRoughness;
    gl.bindVertexArray(null);
    Rig.prims.push({ vao, count: idx.length, name: m.name, rough: pbr.roughnessFactor, color: (pbr.baseColorFactor || [1, 1, 1]).slice(0, 3),
      tex: pbr.baseColorTexture ? await tex(pbr.baseColorTexture.index, true) : null, normal: m.normalTexture ? await tex(m.normalTexture.index, false) : null });
  }
}

// ---------------------------------------------------------------- clip blending
const CLIP_NAMES = ['Idle', 'Walk', 'Run', 'Crouch', 'CrouchWalk'];
function newPose() { return { q: new Float32Array(Rig.NB * 4), hips: [0, 0, 0], w: 0 }; }
function poseReset(p) { p.q.fill(0); p.hips = [0, 0, 0]; p.w = 0; }
function poseAdd(p, name, time, w) {
  if (w <= 0.0001) return;
  p.w += w;
  const c = Rig.clips[name], n = c.times.length - 1;
  const t = c.loop ? ((time % c.T) + c.T) % c.T : clamp(time, 0, c.T);
  const f = t / c.T * n, i0 = Math.min(Math.floor(f), n - 1), a = f - i0, q = p.q;
  for (let i = 0; i < Rig.NB; i++) {
    const r = c.rot[i]; let x = 0, y = 0, z = 0, s = 1;
    if (r) {
      const o = i0 * 4, e = o + 4, b = (r[o] * r[e] + r[o + 1] * r[e + 1] + r[o + 2] * r[e + 2] + r[o + 3] * r[e + 3]) < 0 ? -a : a;
      x = r[o] * (1 - a) + r[e] * b; y = r[o + 1] * (1 - a) + r[e + 1] * b; z = r[o + 2] * (1 - a) + r[e + 2] * b; s = r[o + 3] * (1 - a) + r[e + 3] * b;
    }
    const j = i * 4, k = (q[j] * x + q[j + 1] * y + q[j + 2] * z + q[j + 3] * s) < 0 ? -w : w;
    q[j] += x * k; q[j + 1] += y * k; q[j + 2] += z * k; q[j + 3] += s * k;
  }
  for (let k = 0; k < 3; k++) p.hips[k] += (c.hips[i0 * 3 + k] * (1 - a) + c.hips[i0 * 3 + 3 + k] * a) * w;
}
function localRot(p, i) {
  const q = p.q, j = i * 4, l = Math.hypot(q[j], q[j + 1], q[j + 2], q[j + 3]) || 1;
  return M3.quat(q[j] / l, q[j + 1] / l, q[j + 2] / l, q[j + 3] / l);
}

// ======================================================================= guns
async function loadGun(def, data) {
  const parts = {};
  for (const k of ['body', 'mag', 'trigger', 'bolt', 'lens']) if (data[k]) parts[k] = staticMesh(new Float32Array(b64bytes(data[k].v).buffer), new Uint32Array(b64bytes(data[k].i).buffer));
  def.parts = parts;
  def.tex = await loadTexture(dataBlob(data.tex.base), true);
  def.normal = await loadTexture(dataBlob(data.tex.normal), false);
  def.orm = await loadTexture(dataBlob(data.tex.orm), false);
}

// ======================================================================= sound (synthesised, no files)
const Sound = (() => {
  let ac = null, master = null, noise = null, brown = null, muffle = null, clear = null, verb = null, grit = null, muted = false;
  function init() {
    if (ac) { ac.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    ac = new A(); master = ac.createDynamicsCompressor(); const g = ac.createGain(); g.gain.value = 0.55;
    // everything goes through a lowpass that a close blast slams shut (you go half deaf for a few seconds);
    // the ear ringing goes around it, through `clear`
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000;
    master.connect(muffle); muffle.connect(g); g.connect(ac.destination);
    clear = ac.createGain(); clear.gain.value = 0.55; clear.connect(ac.destination);
    const sr = ac.sampleRate;
    noise = ac.createBuffer(1, sr * 4, sr);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    brown = ac.createBuffer(1, sr * 4, sr);                         // deep, rumbly noise
    const bd = brown.getChannelData(0); let last = 0;
    for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    // a big outdoor echo: 3.5 s of decaying stereo noise, with a few hard slaps off far hills
    verb = ac.createConvolver();
    const ir = ac.createBuffer(2, sr * 3.5, sr);
    for (let c = 0; c < 2; c++) {
      const x = ir.getChannelData(c);
      for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] = (Math.random() * 2 - 1) * Math.exp(-t * 1.7) * Math.min(1, t * 40) * 0.5; }
      for (const [at, k] of [[0.29, 0.5], [0.61, 0.35], [1.05, 0.22], [1.6, 0.12]]) for (let i = 0; i < sr * 0.08; i++) x[Math.floor((at + c * 0.03) * sr) + i] += (Math.random() * 2 - 1) * k * Math.exp(-i / sr * 40);
    }
    verb.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.9; verb.connect(wet); wet.connect(master);
    grit = ac.createWaveShaper();                                    // overdrive, for the blast's crunch
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 4); }
    grit.curve = curve; grit.connect(master); grit.connect(verb);
  }
  // `to` picks where the sound goes: the dry mix (default), dry plus the echo, or through the overdrive
  function burst(dur, freq, vol, type, at, q, to, buf) {
    const t = ac.currentTime + (at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf || noise; s.loop = true; f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t); if (q) f.Q.value = q;
    if (!type) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.08), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); route(g, to); s.start(t, Math.random() * 3); s.stop(t + dur + 0.02);
  }
  function tone(from, to, dur, vol, at, type, out) {
    const t = ac.currentTime + (at || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); route(g, out); o.start(t); o.stop(t + dur + 0.02);
  }
  let pan = 0;                                       // left/right for the sound being played now
  function route(g, to) {
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); g = p; }
    if (to === 'verb') { g.connect(master); g.connect(verb); }
    else if (to === 'room') { g.connect(master); const s = ac.createGain(); s.gain.value = 0.18; g.connect(s); s.connect(verb); }
    else if (to === 'grit') g.connect(grit); else if (to === 'clear') g.connect(clear); else g.connect(master);
  }
  // a clean electronic bip: a pure tone with a soft 3 ms start (no click), a faint octave for shine,
  // a quick natural fade, and a little room around it. f2 slides the pitch.
  function chirp(f, dur, vol, at, f2) {
    const t = ac.currentTime + (at || 0), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 6500;
    for (const [mul, k] of [[1, 1], [2, 0.12]]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f * mul, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2 * mul, t + dur);
      og.gain.value = k; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.setValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.connect(lp); route(lp, 'room');
  }
  // a swell: noise that fades in, holds, then fades out (the roar of the fireball, the fire after)
  function swell(rise, dur, freq, vol, at, buf, to) {
    const t = ac.currentTime + (at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf || noise; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.35), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + rise); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); route(g, to); s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
  }
  const play = {
    ak: v => { burst(0.05, 5200, 0.9 * v, 'highpass'); burst(0.32, 3800, 1.1 * v); tone(150, 38, 0.18, 1.0 * v); burst(0.6, 600, 0.22 * v, null, 0.05); },
    glock: v => { burst(0.04, 6000, 0.8 * v, 'highpass'); burst(0.2, 5200, 0.85 * v); tone(230, 60, 0.1, 0.7 * v); burst(0.4, 900, 0.14 * v, null, 0.04); },
    click: v => { burst(0.03, 3200, 0.5 * v, 'bandpass', 0, 3); },
    magout: v => { burst(0.06, 1800, 0.5 * v, 'bandpass', 0, 4); burst(0.05, 900, 0.35 * v, 'bandpass', 0.07, 4); },
    magin: v => { burst(0.05, 1200, 0.6 * v, 'bandpass', 0, 5); burst(0.04, 2600, 0.5 * v, 'bandpass', 0.08, 5); },
    rack: v => { burst(0.07, 2200, 0.55 * v, 'bandpass', 0, 3); burst(0.06, 3400, 0.65 * v, 'bandpass', 0.11, 3); },
    hit: v => { tone(1900, 1400, 0.05, 0.28 * v, 0, 'square'); },
    kill: v => { tone(900, 900, 0.08, 0.3 * v, 0, 'square'); tone(1350, 1350, 0.16, 0.3 * v, 0.08, 'square'); },
    hurt: v => { tone(180, 70, 0.22, 0.7 * v, 0, 'sawtooth'); burst(0.1, 700, 0.5 * v); },
    chest: v => { tone(110, 260, 0.35, 0.25 * v, 0, 'sawtooth'); tone(660, 660, 0.1, 0.2 * v, 0.3, 'triangle'); tone(990, 990, 0.2, 0.2 * v, 0.4, 'triangle'); },
    punch: v => { burst(0.1, 500, 0.8 * v); tone(120, 50, 0.1, 0.7 * v); },
    shell: v => { tone(4200, 3600, 0.04, 0.07 * v, 0, 'triangle'); },
    awp: v => { burst(0.07, 4800, 1.2 * v, 'highpass'); burst(0.7, 3000, 1.4 * v); tone(110, 26, 0.45, 1.3 * v); burst(1.4, 500, 0.35 * v, null, 0.12); tone(70, 30, 0.7, 0.4 * v, 0.1); },
    boltup: v => { burst(0.04, 2600, 0.5 * v, 'bandpass', 0, 5); },
    boltback: v => { burst(0.09, 1700, 0.6 * v, 'bandpass', 0, 3); tone(900, 500, 0.05, 0.12 * v, 0.06, 'square'); },
    boltfwd: v => { burst(0.07, 2100, 0.65 * v, 'bandpass', 0, 3); burst(0.03, 3600, 0.5 * v, 'bandpass', 0.08, 5); },
    scope: v => { burst(0.03, 4200, 0.25 * v, 'bandpass', 0, 6); },
    bonk: v => { tone(620, 190, 0.13, 0.8 * v, 0, 'triangle'); tone(1240, 500, 0.05, 0.25 * v, 0, 'square'); burst(0.04, 900, 0.5 * v); },
    thud: v => { tone(95, 40, 0.2, 0.9 * v); burst(0.18, 420, 0.6 * v); },
    boing: v => { tone(160, 640, 0.18, 0.35 * v, 0, 'sawtooth'); tone(640, 300, 0.25, 0.3 * v, 0.17, 'sine'); tone(300, 480, 0.2, 0.2 * v, 0.4, 'sine'); },
    chomp: v => { burst(0.05, 1500, 0.8 * v, 'bandpass', 0, 2); tone(2400, 1700, 0.09, 0.18 * v, 0.02, 'square'); },
    huh: v => { tone(150, 120, 0.14, 0.3 * v, 0, 'sawtooth'); tone(130, 270, 0.22, 0.3 * v, 0.16, 'sawtooth'); },
    ooga: v => { tone(190, 130, 0.22, 0.4 * v, 0, 'sawtooth'); tone(150, 260, 0.14, 0.4 * v, 0.26, 'sawtooth'); tone(260, 190, 0.34, 0.4 * v, 0.4, 'sawtooth'); },
    tada: v => { tone(523, 523, 0.12, 0.25 * v, 0, 'triangle'); tone(659, 659, 0.12, 0.25 * v, 0.1, 'triangle'); tone(784, 784, 0.12, 0.25 * v, 0.2, 'triangle'); tone(1046, 1046, 0.45, 0.3 * v, 0.3, 'triangle'); },
    whoosh: v => { burst(0.3, 900, 0.35 * v, 'bandpass', 0, 1.2); },
    pop: v => { tone(300, 900, 0.07, 0.25 * v); },
    hup: v => { tone(170, 260, 0.11, 0.25 * v, 0, 'sawtooth'); burst(0.14, 900, 0.18 * v, 'bandpass', 0, 1.5); },
    land: v => { tone(110, 45, 0.14, 0.55 * v); burst(0.12, 500, 0.4 * v); },
    ugh: v => { tone(210, 80, 0.42, 0.35 * v, 0, 'sawtooth'); },
    zoom: v => { tone(140, 1500, 0.55, 0.22 * v, 0, 'sawtooth'); burst(0.7, 1600, 0.5 * v, 'bandpass', 0, 0.8); },
    screech: v => { tone(1500, 900, 0.24, 0.2 * v, 0, 'square'); burst(0.25, 2800, 0.45 * v, 'bandpass', 0, 4); },
    pump: (v, k) => { const f = 260 + 120 * (k || 0); burst(0.2, 1200 + 300 * (k || 0), 0.45 * v, 'bandpass', 0, 2); tone(f, f * 1.7, 0.17, 0.2 * v, 0.02, 'triangle'); },
    slideup: v => { tone(300, 1700, 1.9, 0.22 * v, 0, 'sine'); tone(305, 1730, 1.9, 0.1 * v, 0, 'triangle'); },
    // the bomb: k is how close to going off it is (0 to 1), so the beep gets a little higher and shorter
    // the bomb: k is how close to going off it is (0 to 1): the bip gets a touch higher and shorter
    beep: (v, k) => { k = k || 0; chirp(1870 * (1 + 0.07 * k), 0.085 - 0.03 * k, 0.32 * v); },
    key: (v, k) => { chirp([1175, 1397, 1047, 1568][(k || 0) % 4], 0.05, 0.16 * v); burst(0.008, 2600, 0.06 * v, 'bandpass', 0, 3); },
    tape: v => {                                      // duct tape peeling off the roll: a fast, ragged crackle that sweeps up
      for (let i = 0; i < 22; i++) burst(0.012 + Math.random() * 0.012, 1400 + i * 110 + Math.random() * 900, (0.16 + Math.random() * 0.12) * v * (1 - i / 30), 'bandpass', i * 0.019 + Math.random() * 0.006, 2.5);
      burst(0.45, 2200, 0.08 * v, 'bandpass', 0, 0.8);
    },
    set: v => { tone(140, 70, 0.12, 0.35 * v); burst(0.05, 900, 0.25 * v, 'bandpass', 0, 2); },
    armed: v => { chirp(1397, 0.07, 0.26 * v); chirp(1870, 0.16, 0.3 * v, 0.09); },
    final: v => { chirp(1990, 0.42, 0.34 * v, 0, 2350); },
    // the C4. d is how far away you are: sound arrives late (343 m/s), far ones lose their top end,
    // close ones leave you half deaf with ringing ears
    explode: (v, d) => {
      d = d || 0;
      const at = d / 343, far = Math.min(1, d / 60), top = 1 - 0.75 * far;   // top: how much high end survives the distance
      // 1. the crack: a sharp overdriven snap
      burst(0.03, 9000 * top + 800, 2.2 * v * top, 'highpass', at, 0, 'grit');
      tone(1400, 120, 0.06, 1.2 * v * top, at, 'square', 'grit');
      // 2. the blast: a wall of overdriven noise that slams down, into the echo
      burst(0.9, 5200 * top + 600, 2.4 * v, null, at, 0, 'grit');
      burst(2.4, 2600 * top + 300, 1.5 * v, null, at + 0.01, 0, 'verb');
      // 3. the punch in your chest: a sub thump that drops in pitch, and a second, deeper one
      tone(120, 28, 0.5, 2.6 * v, at, 'sine'); tone(70, 20, 2.8, 2.0 * v, at + 0.02, 'sine', 'verb');
      tone(45, 18, 3.5, 1.4 * v, at + 0.05, 'triangle');
      // 4. the fireball roaring up, then a long rolling rumble that fades over the hills
      swell(0.12, 2.2, 900 * top + 200, 0.9 * v, at + 0.05, brown, 'verb');
      swell(0.4, 6.0, 260, 1.6 * v, at + 0.1, brown, 'verb');
      burst(4.5, 520, 0.6 * v, null, at + 0.2, 0, 'verb', brown);
      // 5. thunder-like echoes rolling back
      for (const [t, k, f] of [[0.45, 0.55, 900], [0.95, 0.4, 650], [1.6, 0.3, 450], [2.4, 0.18, 320]]) { burst(1.2, f * (0.5 + top * 0.5), k * v, null, at + t, 0, 'verb', brown); tone(60, 30, 0.9, k * 0.8 * v, at + t); }
      // 6. junk raining down: little clatters and thuds
      for (let i = 0; i < 26; i++) {
        const t = at + 0.7 + Math.random() * 2.3, k = v * (0.6 - i / 60) * top;
        if (i % 3) burst(0.03 + Math.random() * 0.05, 1200 + Math.random() * 3800, 0.22 * k, 'bandpass', t, 3);
        else { tone(160 + Math.random() * 120, 50, 0.12, 0.45 * k, t); burst(0.08, 600, 0.3 * k, null, t); }
      }
      // 7. the fire left behind, crackling
      swell(0.6, 5.0, 1400, 0.25 * v * top, at + 0.6);
      for (let i = 0; i < 40; i++) burst(0.012 + Math.random() * 0.02, 2500 + Math.random() * 4500, (0.05 + Math.random() * 0.12) * v * top, 'bandpass', at + 0.6 + Math.random() * 4.8, 6);
      // 8. too close: the world goes muffled for a few seconds, and your ears ring
      const deaf = clamp(1 - d / 16, 0, 1);
      if (deaf > 0) {
        const t = ac.currentTime + at + 0.06, f = muffle.frequency;
        f.cancelScheduledValues(t); f.setValueAtTime(20000, t); f.exponentialRampToValueAtTime(20000 - 19650 * deaf, t + 0.08);
        f.setValueAtTime(20000 - 19650 * deaf, t + 0.6 + deaf * 1.2); f.exponentialRampToValueAtTime(20000, t + 3 + deaf * 3);
        tone(3400, 3300, 3 + deaf * 3, 0.07 * deaf, at + 0.08, 'sine', 'clear');
        tone(5100, 5000, 2 + deaf * 2, 0.025 * deaf, at + 0.08, 'sine', 'clear');
      }
    },
    ring: v => { tone(3300, 3300, 3.2, 0.045 * v, 0.25, 'sine', 'clear'); },
    ting: v => { tone(2100, 2100, 0.5, 0.25 * v, 0, 'sine'); tone(3150, 3150, 0.35, 0.14 * v, 0.04, 'sine'); }
  };
  return {
    init,
    // p: left/right, -1 to 1 (optional)
    play(name, vol, k, p) { if (ac && !muted && ac.state === 'running') { pan = p || 0; try { play[name](vol === undefined ? 1 : vol, k); } finally { pan = 0; } } },
    toggle() { muted = !muted; return muted; }
  };
})();
