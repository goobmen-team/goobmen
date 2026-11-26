"""Turns the Sketchfab C4 .glb into assets/c4.json (a small static mesh + jpeg textures, same format as guns.json).
Run: python tools/make_c4.py path/to/bomb__c4_explosive_model_cs2.glb
Needs Pillow. The source .glb is ~38 MB, so it is not kept in the repo.
"""
import base64, io, json, math, struct, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1])
b = src.read_bytes()
jl = struct.unpack('<I', b[12:16])[0]
g = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
T = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}; N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def view(i):
    v = g['bufferViews'][i]; o = bin0 + v.get('byteOffset', 0)
    return b[o:o + v['byteLength']]


def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; n = N[a['type']]; c = T[a['componentType']]; sz = struct.calcsize(c)
    st = v.get('byteStride', sz * n); o = bin0 + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<%d%s' % (n, c), b, o + k * st) for k in range(a['count'])]


# ---- 4x4 matrices, column-major like glTF
def mul(a, c):
    return [sum(a[r + 4 * k] * c[k + 4 * col] for k in range(4)) for col in range(4) for r in range(4)]


def local(n):
    if 'matrix' in n: return list(n['matrix'])
    x, y, z, w = n.get('rotation', [0, 0, 0, 1]); t = n.get('translation', [0, 0, 0]); s = n.get('scale', [1, 1, 1])
    R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]
    return [R[0] * s[0], R[1] * s[0], R[2] * s[0], 0, R[3] * s[1], R[4] * s[1], R[5] * s[1], 0, R[6] * s[2], R[7] * s[2], R[8] * s[2], 0, t[0], t[1], t[2], 1]


parent = {}
for i, n in enumerate(g['nodes']):
    for k in n.get('children', []): parent[k] = i
world = {}


def W(i):
    if i not in world: world[i] = mul(W(parent[i]), local(g['nodes'][i])) if i in parent else local(g['nodes'][i])
    return world[i]


skin = g['skins'][0]
ibm = acc(skin['inverseBindMatrices'])
joint = [mul(W(j), list(m)) for j, m in zip(skin['joints'], ibm)]


def xf(m, p, w):
    return [m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * w for r in range(3)]


def bake(prim):
    a = prim['attributes']
    P, Nn, U, J, Wt = acc(a['POSITION']), acc(a['NORMAL']), acc(a['TEXCOORD_0']), acc(a['JOINTS_0']), acc(a['WEIGHTS_0'])
    pos, nrm = [], []
    for p, n, j, w in zip(P, Nn, J, Wt):
        sp, sn = [0, 0, 0], [0, 0, 0]
        for k in range(4):
            if w[k] <= 0: continue
            q, r = xf(joint[j[k]], p, 1), xf(joint[j[k]], n, 0)
            for c in range(3): sp[c] += q[c] * w[k]; sn[c] += r[c] * w[k]
        l = math.sqrt(sum(c * c for c in sn)) or 1
        pos.append(sp); nrm.append([c / l for c in sn])
    return pos, nrm, U, [i[0] for i in acc(prim['indices'])]


body = bake(g['meshes'][0]['primitives'][0])
panel = bake(g['meshes'][1]['primitives'][0])

# centre the brick on its bottom face, longest side along z, thickness along y; real C4 is ~30 cm long
allp = body[0]
lo = [min(p[c] for p in allp) for c in range(3)]; hi = [max(p[c] for p in allp) for c in range(3)]
size = [hi[c] - lo[c] for c in range(3)]
order = sorted(range(3), key=lambda c: size[c])        # thinnest, middle, longest
print('raw size', size, 'axes thin/mid/long', order)
thin, mid, long_ = order
# the panel sits on the top face; flip so it faces +y
top_sign = 1 if sum(p[thin] for p in panel[0]) / len(panel[0]) > (lo[thin] + hi[thin]) / 2 else -1
scale = 0.30 / size[long_]
centre = [(lo[c] + hi[c]) / 2 for c in range(3)]


def remap(v, is_pos):
    d = [v[c] - centre[c] for c in range(3)] if is_pos else v
    x, y, z = d[mid], d[thin] * top_sign, d[long_]
    # keep it right-handed: flipping y needs one more flip
    if top_sign < 0: x = -x
    if is_pos: return [x * scale, y * scale + size[thin] * scale / 2, z * scale]
    return [x, y, z]


# axis swaps can mirror the mesh; if so flip x and the winding
perm_sign = {(0, 1, 2): 1, (1, 2, 0): 1, (2, 0, 1): 1}.get((mid, thin, long_), -1)


def pack(m):
    pos, nrm, uv, idx = m
    v = []
    for p, n, t in zip(pos, nrm, uv):
        p, n = remap(p, True), remap(n, False)
        if perm_sign < 0: p[0] = -p[0]; n[0] = -n[0]
        v += p + n + list(t)
    if perm_sign < 0:
        for k in range(0, len(idx), 3): idx[k + 1], idx[k + 2] = idx[k + 2], idx[k + 1]
    return {'v': base64.b64encode(struct.pack('<%df' % len(v), *v)).decode(), 'i': base64.b64encode(struct.pack('<%dI' % len(idx), *idx)).decode(), 'n': len(idx)}


out = {'body': pack(body), 'panel': pack(panel)}
pp = [remap(p, True) for p in panel[0]]
out['panelAt'] = [sum(p[c] for p in pp) / len(pp) for c in range(3)]


def jpeg(i, px, q):
    im = Image.open(io.BytesIO(view(g['images'][i]['bufferView']))).convert('RGB').resize((px, px), Image.LANCZOS)
    f = io.BytesIO(); im.save(f, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(f.getvalue()).decode()


mat = g['materials'][0]
out['tex'] = {'base': jpeg(g['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source'], 1024, 86),
              'normal': jpeg(g['textures'][mat['normalTexture']['index']]['source'], 1024, 90),
              'orm': jpeg(g['textures'][mat['occlusionTexture']['index']]['source'], 512, 88)}
(root / 'assets/c4.json').write_text(json.dumps(out), encoding='utf-8')
print('wrote assets/c4.json', sum(len(json.dumps(v)) for v in out.values()) // 1024, 'KB; panel at', out['panelAt'])
