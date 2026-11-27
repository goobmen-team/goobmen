"""Turns the Sketchfab fish, meat, ESAPI plate and tactical vest .glb files into assets/loot.json (same format as c4.json / guns.json).
Run: python3 -I tools/make_loot.py fish.glb meat.glb plate.glb vest.glb
Needs numpy and Pillow. The source .glb files are large, so they are not kept in the repo.

Every model comes out lying on the ground the way it rests: y up, its lowest point at y = 0, centred in x and z, in metres.
Credits are in the README.
"""
import base64, io, json, sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_read import load

ASSETS = Path(__file__).resolve().parent.parent / 'assets'


def b64(raw):
    return base64.b64encode(raw).decode()


def mesh(P, N, UV, F):
    V = np.concatenate([P[F], N[F], UV[F]], axis=2).reshape(-1, 8).astype('<f4')
    uniq, inv = np.unique(V.round(5), axis=0, return_inverse=True)
    return {'v': b64(uniq.astype('<f4').tobytes()), 'i': b64(inv.ravel().astype('<u4').tobytes()), 'n': int(inv.size)}


def url(im, px=None, q=88):
    im = im.convert('RGB')
    if px and max(im.size) > px:
        k = px / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    f = io.BytesIO()
    im.save(f, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + b64(f.getvalue())


def flat(rgb):
    return url(Image.new('RGB', (4, 4), rgb), q=95)


# how each model is turned to lie on the ground, and how big it really is (the longest side, in metres)
ROT = {
    'fish': np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0.0]]),        # (y, z, x): head along +z, lying on its side
    'meat': np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0.0]]),
    'plate': np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.0]]),      # its thin side up, the curve bulging up
    'vest': np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0.0]]),       # lying on its back, front up
}
SIZE = {'fish': 0.42, 'meat': 0.27, 'plate': 0.30, 'vest': 0.56}
TEX = {'fish': 1024, 'meat': 256, 'plate': 512, 'vest': 1024}


def convert(name, path):
    parts, mats, image = load(path)
    p = parts[0]
    m = mats[p['m']]
    R = ROT[name]
    P = p['P'] @ R.T
    N = p['N'] @ R.T
    F = p['F']
    if np.linalg.det(R) < 0:
        F = F[:, ::-1]
    k = SIZE[name] / np.ptp(P, axis=0).max()
    P = P * k
    lo, hi = P.min(0), P.max(0)
    P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    size = (hi - lo).tolist()
    rough = float(m['rough']) if m['orm'] is None else 1.0
    metal = float(m['metal']) if m['orm'] is None else 1.0
    tex = {
        'base': url(image(m['base']), TEX[name]),
        'normal': url(image(m['normal']), TEX[name]) if m['normal'] is not None else flat((128, 128, 255)),
        'orm': url(image(m['orm']), TEX[name]) if m['orm'] is not None else flat((255, int(255 * min(1, rough)), int(255 * min(1, metal)))),
    }
    out = {'body': mesh(P, N, p['UV'], F), 'tex': tex, 'size': size}
    print(name, 'size', [round(x, 3) for x in size], 'verts', len(P), 'tris', len(F))
    return out


if __name__ == '__main__':
    names = ['fish', 'meat', 'plate', 'vest']
    out = {n: convert(n, a) for n, a in zip(names, sys.argv[1:5])}
    (ASSETS / 'loot.json').write_text(json.dumps(out, separators=(',', ':')))
    print('wrote', ASSETS / 'loot.json', (ASSETS / 'loot.json').stat().st_size // 1024, 'KB')
