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
    if name == 'vest':                                          # upright, front towards +z, centred: the lying model turned back up
        U = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.0]])       # (x, z, -y)
        Pu, Nu = P @ U.T, N @ U.T
        Pu = Pu - (Pu.max(0) + Pu.min(0)) / 2
        out['worn'] = worn_vest(Pu, Nu, p['UV'], F, str(ASSETS / 'caveman.glb'))
    print(name, 'size', [round(x, 3) for x in size], 'verts', len(P), 'tris', len(F))
    return out


def smooth(a, k=3):
    """a moving average that keeps the ends"""
    pad = np.pad(a, k, mode='edge')
    return np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode='valid')


def profile(P, ys, hw_limit):
    """per height: the front and back of the middle of the body, and how wide it is"""
    zf, zb, hw = [], [], []
    for y in ys:
        s = P[np.abs(P[:, 1] - y) < 0.022]
        c = s[np.abs(s[:, 0]) < 0.10]
        zf.append(c[:, 2].max() if len(c) else np.nan)
        zb.append(c[:, 2].min() if len(c) else np.nan)
        m = s[np.abs(s[:, 0]) < hw_limit]
        hw.append(np.percentile(np.abs(m[:, 0]), 98) if len(m) else np.nan)
    out = []
    for a in (zf, zb, hw):
        a = np.array(a, float)
        good = ~np.isnan(a)
        a = np.interp(ys, ys[good], a[good])
        out.append(smooth(a))
    return out


CHEST = np.array([0, 1.03, -0.062])          # where his chest bone sits (Rig.rest); the worn vest is built around it


def worn_vest(vest_P, vest_N, vest_UV, vest_F, caveman_path):
    """The vest reshaped to hug the caveman's torso, slice by slice, in the space of his chest bone.
    vest_P is upright (front towards +z), y up, centred."""
    parts, _, _ = load(caveman_path)
    B = np.concatenate([q['P'] for q in parts])
    ys_b = np.arange(0.70, 1.38, 0.01)
    zf_b, zb_b, hw_b = profile(B, ys_b, 0.34)
    ylo, yhi = vest_P[:, 1].min(), vest_P[:, 1].max()
    BODY_LO, BODY_HI = 0.74, 1.36
    t = (vest_P[:, 1] - ylo) / (yhi - ylo)
    yb = BODY_LO + t * (BODY_HI - BODY_LO)
    fb = lambda a: np.interp(yb, ys_b, a)
    # the vest is roughly a box; the body is wider and deeper in some places than others, so each slice is stretched to the body there
    hw_v = np.abs(vest_P[:, 0]).max()
    zc_v, hd_v = (vest_P[:, 2].max() + vest_P[:, 2].min()) / 2, (vest_P[:, 2].max() - vest_P[:, 2].min()) / 2
    zc_b = fb((zf_b + zb_b) / 2)
    hd_b = np.clip(fb((zf_b - zb_b) / 2), 0.12, 0.26)
    sx = np.clip((fb(hw_b) + 0.012) / hw_v, 0.95, 1.5)
    sz = np.clip((hd_b + 0.012) / hd_v, 0.75, 1.6)
    sy = (BODY_HI - BODY_LO) / (yhi - ylo)
    P = np.stack([vest_P[:, 0] * sx, yb, zc_b + (vest_P[:, 2] - zc_v) * sz], axis=1)
    N = vest_N / np.stack([sx, np.full_like(sx, sy), sz], axis=1)
    N /= np.linalg.norm(N, axis=1)[:, None] + 1e-12
    print('worn vest: vest half width %.2f half depth %.2f; scales x %.2f-%.2f z %.2f-%.2f y %.2f' % (hw_v, hd_v, sx.min(), sx.max(), sz.min(), sz.max(), sy))
    return mesh(P - CHEST, N, vest_UV, vest_F)


if __name__ == '__main__':
    names = ['fish', 'meat', 'plate', 'vest']
    out = {n: convert(n, a) for n, a in zip(names, sys.argv[1:5])}
    out['vestWorn'] = out['vest'].pop('worn')
    (ASSETS / 'loot.json').write_text(json.dumps(out, separators=(',', ':')))
    print('wrote', ASSETS / 'loot.json', (ASSETS / 'loot.json').stat().st_size // 1024, 'KB')
