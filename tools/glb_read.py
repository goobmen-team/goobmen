"""A small .glb reader shared by the make_*.py tools: baked node transforms, plain numpy arrays (the file is only ever read as data)."""
import io, json, struct
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = 120_000_000


def load(path):
    b = open(path, 'rb').read()
    n = struct.unpack_from('<I', b, 12)[0]
    g = json.loads(b[20:20 + n])
    bin0 = 28 + n
    types = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def acc(i):
        a = g['accessors'][i]
        v = g['bufferViews'][a['bufferView']]
        k = sizes[a['type']]
        t = types[a['componentType']]
        sz = k * np.dtype(t).itemsize
        off = bin0 + v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride') or sz
        raw = np.frombuffer(b, np.uint8, stride * (a['count'] - 1) + sz, off)
        idx = (np.arange(a['count'])[:, None] * stride + np.arange(sz)).reshape(-1)
        return np.frombuffer(raw[idx].tobytes(), t).reshape(a['count'], k)

    def image(i):
        v = g['bufferViews'][g['images'][i]['bufferView']]
        start = bin0 + v.get('byteOffset', 0)
        return Image.open(io.BytesIO(b[start:start + v['byteLength']]))

    def local(nd):
        if 'matrix' in nd:
            return np.array(nd['matrix'], float).reshape(4, 4).T
        x, y, z, w = nd.get('rotation', [0, 0, 0, 1])
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M = np.eye(4)
        M[:3, :3] = R * np.array(nd.get('scale', [1, 1, 1]))[None, :]
        M[:3, 3] = nd.get('translation', [0, 0, 0])
        return M

    parts = []

    def walk(i, M):
        nd = g['nodes'][i]
        M = M @ local(nd)
        if 'mesh' in nd:
            for p in g['meshes'][nd['mesh']]['primitives']:
                at = p['attributes']
                P = acc(at['POSITION']).astype(float)
                N = acc(at['NORMAL']).astype(float)
                UV = acc(at['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in at else np.zeros((len(P), 2))
                P = P @ M[:3, :3].T + M[:3, 3]
                N = N @ np.linalg.inv(M[:3, :3])
                N /= np.linalg.norm(N, axis=1)[:, None] + 1e-12
                F = acc(p['indices']).reshape(-1, 3).astype(np.int64)
                if np.linalg.det(M[:3, :3]) < 0:
                    F = F[:, ::-1]
                parts.append(dict(P=P, N=N, UV=UV, F=F, m=p.get('material', 0)))
        for c in nd.get('children', []):
            walk(c, M)

    for r in g['scenes'][g.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    mats = []
    for m in g.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})

        def tex(t):
            return None if t is None else g['textures'][t['index']]['source']
        mats.append(dict(color=pbr.get('baseColorFactor', [1, 1, 1, 1]), metal=pbr.get('metallicFactor', 1),
                         rough=pbr.get('roughnessFactor', 1), base=tex(pbr.get('baseColorTexture')),
                         orm=tex(pbr.get('metallicRoughnessTexture')), normal=tex(m.get('normalTexture')),
                         ao=tex(m.get('occlusionTexture'))))
    return parts, mats, image
