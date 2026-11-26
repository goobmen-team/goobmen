"""Builds index.html (the whole game in one file) from src/ and assets/. Run: python3 build.py"""
import base64
from pathlib import Path

root = Path(__file__).resolve().parent


def read(name):
    return (root / name).read_text(encoding='utf-8')


model = base64.b64encode((root / 'assets/caveman.glb').read_bytes()).decode()
parts = ['<script>window.MODEL_B64="%s";</script>' % model,
         '<script>window.GUN_DATA=%s;</script>' % read('assets/guns.json'),
         '<script>Object.assign(window.GUN_DATA,%s);</script>' % read('assets/guns2.json'),
         '<script>window.C4_DATA=%s;</script>' % read('assets/c4.json'),
         '<script>window.TAPE_DATA=%s;</script>' % read('assets/tape.json'),
         '<script>window.HOUSE_DATA=%s;</script>' % read('assets/house.json'),
         '<script>window.BIKE_DATA=%s;</script>' % read('assets/bike.json')]

for name in ('engine.js', 'game.js'):
    code = read('src/' + name)
    if name == 'game.js':
        # looting, the jump/death animations, ragdolls and the reload/grenade/vest code live in their own files
        code = code.replace('//MAP//', read('src/island.js') + read('src/places.js') + read('src/bridges.js') + read('src/caves.js') + read('src/houses.js'))
        code = code.replace('//LOOT//', read('src/loot.js') + read('src/moves.js') + read('src/ragdoll.js') + read('src/weapons.js') + read('src/bike.js') + read('src/minimap.js') + read('src/models.js') + read('src/cutscene.js'))
    assert '</script' not in code
    parts.append('<script>\n%s</script>' % code)

html = read('src/page.html').replace('<!--SCRIPTS-->', '\n'.join(parts))
(root / 'index.html').write_text(html, encoding='utf-8')
print('wrote index.html')
