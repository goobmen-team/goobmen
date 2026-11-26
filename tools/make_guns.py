"""Turns the Sketchfab MP5, shotgun, P90 and Milkor MGL .glb files into assets/guns2.json (same format as guns.json).
Run: python3 -I tools/make_guns.py mp5.glb shotgun.glb p90.glb mgl.glb
Needs numpy, scipy and Pillow. The source .glb files are large, so they are not kept in the repo.

Gun space: origin at the pistol grip, +Z towards the muzzle, +Y up, +X the shooter's left, metres.
Credits (see README): MP5 by dani-zzz (CC BY 4.0), shotgun by Jonathan Steylaerts (CC BY-NC 4.0),
P90 by charles.cla (CC BY-NC 4.0), Milkor MGL by Valo (CC BY 4.0).
"""
import base64, io, json, struct, sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

Image.MAX_IMAGE_PIXELS = 80_000_000


# ---------------------------------------------------------------- reading a .glb (the file is only ever read as data)
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


def components(P, F):
    """which connected piece each triangle belongs to"""
    scale = np.ptp(P, axis=0).max()
    _, w = np.unique(np.round(P / scale, 4), axis=0, return_inverse=True)
    w = w.reshape(-1)
    f = w[F]
    n = w.max() + 1
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]]])
    _, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), (n, n)), directed=False)
    return lab[f[:, 0]]


# ---------------------------------------------------------------- standing each gun up straight
def norm(v):
    return v / np.linalg.norm(v)


def bore(parts, hint):
    """the direction most surfaces run along, which on a gun is the barrel"""
    M = np.zeros((3, 3))
    for p in parts:
        P, F = p['P'], p['F']
        n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
        a = np.linalg.norm(n, axis=1)
        n = n / (a[:, None] + 1e-12)
        side = np.abs(n @ hint) < 0.4
        M += (n[side] * a[side, None]).T @ n[side]
    f = np.linalg.eigh(M)[1][:, 0]
    return f if f @ hint > 0 else -f


def rotation(name, parts):
    if name == 'mp5':
        return np.array([[-1, 0, 0], [0, 1, 0], [0, 0, -1.0]])
    if name == 'p90':
        return np.eye(3)
    if name == 'shotgun':
        barrel = parts[12]['P']
        far = barrel[barrel[:, 0] > barrel[:, 0].max() - 0.05].mean(0)
        near = barrel[barrel[:, 0] < barrel[:, 0].min() + 0.05].mean(0)
        f = bore([parts[12], parts[2]], norm(far - near))
        up = parts[6]['P'].mean(0) - parts[8]['P'].mean(0)           # upper and lower ejector sit one above the other
        up = norm(up - f * (up @ f))
        return np.stack([np.cross(up, f), up, f])
    A = np.concatenate([p['P'] for p in parts])                      # the launcher: find the barrel, then the mirror plane
    f = np.linalg.eigh(np.cov(A.T))[1][:, 2]
    if f[2] > 0:
        f = -f
    for _ in range(4):
        f = bore(parts, f)
    e1 = norm(np.array([0, 1, 0.0]) - f * f[1])
    e2 = np.cross(f, e1)
    centred = A - A.mean(0)
    tree, sample = cKDTree(centred), centred[::7]
    best = None
    for ang in np.linspace(-1.2, 1.2, 481):
        side = np.cos(ang) * e2 + np.sin(ang) * e1
        for off in (np.median(sample @ side), np.median(centred @ side)):
            mirrored = sample - 2 * np.outer(sample @ side - off, side)
            d = np.mean(np.minimum(tree.query(mirrored)[0], 0.12))
            if best is None or d < best[0]:
                best = (d, side)
    up = norm(np.cross(f, best[1]))
    if up[1] < 0:
        up = -up
    return np.stack([np.cross(up, f), up, f])


LENGTH = {'mp5': 0.70, 'shotgun': 1.0, 'p90': 0.52, 'mgl': 0.78}
GRIP = {'mp5': (0, 0.0, -0.078), 'p90': (0, -0.04, 0.055), 'shotgun': (0.011, 0.025, -0.20), 'mgl': (0, 0.005, -0.19)}
SIZES = {'mp5': (2048, 1024), 'shotgun': (1024, 1024), 'p90': (1024, 1024), 'mgl': (64, 64)}   # colour texture atlas


def oriented(name, path):
    parts, mats, image = load(path)
    R = rotation(name, parts)
    for p in parts:
        p['P'] = p['P'] @ R.T
        p['N'] = p['N'] @ R.T
    s = LENGTH[name] / np.ptp(np.concatenate([p['P'][:, 2] for p in parts]))
    A = np.concatenate([p['P'] for p in parts])
    mid = (A.max(0) + A.min(0)) / 2
    for p in parts:
        p['P'] = (p['P'] - mid) * s - np.array(GRIP[name])
    return parts, mats, image


# ---------------------------------------------------------------- which pieces move on their own
def split(name, parts):
    """per part, the group name of every triangle ('body' unless it moves separately)"""
    groups = [np.array(['body'] * len(p['F']), dtype=object) for p in parts]

    def piece(i, ranks, group):
        lab = components(parts[i]['P'], parts[i]['F'])
        ids, cnt = np.unique(lab, return_counts=True)
        order = ids[np.argsort(-cnt, kind='stable')]
        groups[i][np.isin(lab, order[list(ranks)])] = group

    if name == 'mp5':
        piece(2, (2, 8), 'mag')
        piece(2, (9, 10), 'bolt')                                    # the cocking handle
    elif name == 'shotgun':
        groups[3][:] = 'pump'
        groups[4][:] = 'pump'
        groups[9][:] = 'trigger'
    elif name == 'p90':
        piece(3, (0,), 'mag')                                        # the see-through magazine on top, and its rounds
        P, F = parts[0]['P'], parts[0]['F']
        lab = components(P, F)
        for c in np.unique(lab):
            v = P[F[lab == c]].reshape(-1, 3)
            lo, hi = v.min(0), v.max(0)
            if lo[1] > 0.055 and hi[1] < 0.082 and lo[0] > -0.017 and hi[0] < 0.017 and lo[2] > -0.165 and hi[2] < 0.125:
                groups[0][lab == c] = 'mag'
    elif name == 'mgl':
        piece(1, (1,), 'drum')                                       # back plate
        piece(2, (2, 5), 'drum')                                     # cylinder and front flange
    return groups


# ---------------------------------------------------------------- packing
def b64(raw):
    return base64.b64encode(raw).decode()


def mesh(chunks):
    V = np.concatenate([np.concatenate([P[F], N[F], UV[F]], axis=2).reshape(-1, 8) for P, N, UV, F in chunks]).astype('<f4')
    uniq, inv = np.unique(V.round(5), axis=0, return_inverse=True)
    return {'v': b64(uniq.astype('<f4').tobytes()), 'i': b64(inv.ravel().astype('<u4').tobytes()), 'n': int(inv.size)}


def url(im, fmt='JPEG', q=86):
    f = io.BytesIO()
    im.save(f, fmt, **({'quality': q, 'optimize': True} if fmt == 'JPEG' else {}))
    return 'data:image/%s;base64,%s' % (fmt.lower(), b64(f.getvalue()))


def srgb(v):
    return int(round(255 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)))


def convert(name, path):
    parts, mats, image = oriented(name, path)
    n = len(mats)
    cols = int(np.ceil(np.sqrt(n * SIZES[name][0] / SIZES[name][1])))
    rows = int(np.ceil(n / cols))
    W, H = SIZES[name]
    cw, ch = W // cols, H // rows
    base = Image.new('RGB', (W, H))
    nrm = Image.new('RGB', (W, H), (128, 128, 255))
    orm = Image.new('RGB', (W, H), (255, 200, 0))
    for k, m in enumerate(mats):
        at = ((k % cols) * cw, (k // cols) * ch)

        def tile(i):
            return image(i).convert('RGB').resize((cw, ch), Image.LANCZOS)
        if m['base'] is not None:
            base.paste(tile(m['base']), at)
        else:                                                        # flat-coloured materials (the launcher)
            base.paste(Image.new('RGB', (cw, ch), tuple(min(255, int(srgb(c) * 1.15) + 6) for c in m['color'][:3])), at)
        if m['normal'] is not None:
            nrm.paste(tile(m['normal']), at)
        if m['orm'] is not None:
            _, g, b = tile(m['orm']).split()
            r = tile(m['ao']).split()[0] if m['ao'] == m['orm'] else Image.new('L', (cw, ch), 255)
            orm.paste(Image.merge('RGB', (r, g, b)), at)
        else:
            rough = max(0.3, m['rough'] if m['base'] is None else 0.6)
            orm.paste(Image.new('RGB', (cw, ch), (255, int(rough * 255), int(min(0.7, m['metal']) * 255))), at)

    groups = split(name, parts)
    out = {}
    for key in ('body', 'mag', 'trigger', 'bolt', 'drum', 'pump'):
        chunks = []
        for p, g in zip(parts, groups):
            sel = g == key
            if not sel.any():
                continue
            k = p['m']
            if mats[k]['base'] is None:
                UV = np.zeros_like(p['UV']) + 0.5
            else:
                UV = np.clip(p['UV'], 0.002, 0.998)
            UV = (UV + [k % cols, k // cols]) / [cols, rows]
            chunks.append((p['P'], p['N'], UV, p['F'][sel]))
        if chunks:
            out[key] = mesh(chunks)
            v = np.concatenate([P[F].reshape(-1, 3) for P, _, _, F in chunks])
            print('%-8s %-8s tris %6d  min %s  max %s' % (name, key, out[key]['n'] // 3, v.min(0).round(3), v.max(0).round(3)))
    flat = name == 'mgl'
    small = (max(4, W // 2), max(4, H // 2))
    out['tex'] = {'base': url(base, q=88),
                  'normal': url(Image.new('RGB', (4, 4), (128, 128, 255)), 'PNG') if flat else url(nrm.resize(small, Image.LANCZOS), q=88),
                  'orm': url(orm if flat else orm.resize(small, Image.LANCZOS), 'PNG' if flat else 'JPEG')}
    print(name, 'size %d KB' % (len(json.dumps(out)) // 1024))
    return out


if __name__ == '__main__':
    data = {name: convert(name, path) for name, path in zip(('mp5', 'shotgun', 'p90', 'mgl'), sys.argv[1:5])}
    dest = Path(__file__).resolve().parent.parent / 'assets' / 'guns2.json'
    dest.write_text(json.dumps(data, separators=(',', ':')))
    print('wrote', dest, dest.stat().st_size // 1024, 'KB')
