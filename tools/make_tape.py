"""Turns the Sketchfab duct tape .glb into assets/tape.json (static mesh + jpeg textures, same format as guns.json).
Run: python tools/make_tape.py path/to/duct_tape.glb
The roll is kept in its own space: its axis is y, it is centred on the origin, and the loose flap points along +x.
"""
import base64, io, json, struct, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
b = Path(sys.argv[1]).read_bytes()
jl = struct.unpack('<I', b[12:16])[0]
g = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
T = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}; N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def view(i):
    v = g['bufferViews'][i]; o = bin0 + v.get('byteOffset', 0)
    return b[o:o + v['byteLength']]


def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; n = N[a['type']]; c = T[a['componentType']]; sz = struct.calcsize(c)
    st = v.get('byteStride', sz * n); o = bin0 + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<%d%s' % (n, c), b, o + k * st) for k in range(a['count'])]


prim = g['meshes'][0]['primitives'][0]
P, Nn, U = acc(prim['attributes']['POSITION']), acc(prim['attributes']['NORMAL']), acc(prim['attributes']['TEXCOORD_0'])
idx = [i[0] for i in acc(prim['indices'])]
v = []
for p, n, t in zip(P, Nn, U): v += list(p) + list(n) + list(t)
out = {'body': {'v': base64.b64encode(struct.pack('<%df' % len(v), *v)).decode(), 'i': base64.b64encode(struct.pack('<%dI' % len(idx), *idx)).decode(), 'n': len(idx)}}


def jpeg(i, px, q):
    im = Image.open(io.BytesIO(view(g['images'][g['textures'][i]['source']]['bufferView']))).convert('RGB').resize((px, px), Image.LANCZOS)
    f = io.BytesIO(); im.save(f, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(f.getvalue()).decode()


m = g['materials'][0]
out['tex'] = {'base': jpeg(m['pbrMetallicRoughness']['baseColorTexture']['index'], 512, 86),
              'normal': jpeg(m['normalTexture']['index'], 512, 90),
              'orm': jpeg(m['occlusionTexture']['index'], 256, 88)}
(root / 'assets/tape.json').write_text(json.dumps(out), encoding='utf-8')
print('wrote assets/tape.json', len(json.dumps(out)) // 1024, 'KB')
