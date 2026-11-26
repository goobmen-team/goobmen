# goobmen

A third-person caveman fighting game with real guns. Loot chests, fight other cavemen, and loot them when they go down, before the balloon man gets there.

**To play:** download `index.html` and open it in Chrome. The whole game is in that one file.

## Controls

| Key | Does |
| --- | --- |
| Mouse | look around |
| Left click | shoot (punch with fists) |
| Right click or Q | aim / scope |
| WASD / Shift | move / sprint |
| Space / Ctrl | jump / crouch |
| Hold E | loot a chest or a knocked-out caveman |
| G / E | drop what you hold / pick it up |
| Hold X | drag a knocked-out caveman (bodies are ragdolls: shove, shoot or blow them around) |
| 5, then click | hold C4, plant it (5 s fuse; on a knocked-out caveman too) |
| R / V | reload / show off your gun |
| 1, 2, 3, 4 or wheel | AK-74, Glock 17, AWP, fists |
| 6, 7, 8, 9 | MP5, P90, shotgun, grenade launcher |
| F | fullscreen |
| N | flight mode for testing: WASD flies where you look, Space up, C down, wheel changes speed |
| T | go to the island, then press 1 for the normal map or 2 for the optimized one; T again to go back (temporary) |
| P / M / Esc | enemy fire / sound / pause |

## Files

- `index.html`: the built game
- `src/`: the code
- `assets/`: the caveman model and gun data (`guns2.json` is made by `tools/make_guns.py`)
- `assets/c4.json`: the bomb, made from a Sketchfab model by `tools/make_c4.py`
- `build.py`: rebuilds `index.html` after you change something (`python3 build.py`)

Chests can also hold a bulletproof vest, which soaks up body hits until it breaks (not headshots). For now there is also a chest of every item by the "something cool here" sign, for testing.

The map is being made in phases. So far: a big island with two mountains, a mesa, a gorge, a crater, a stone circle, an old camp, a giant skeleton, an enormous tree, a boulder field, a pine wood and a palm bay, in an ocean that hurts if you wade into it. Two rivers cross it, with arched wooden bridges. Further out are a volcano, table rocks, stone arches, a mammoth graveyard, a fishing camp, a grove of giant trees, great stone heads, a log fort, a second canyon and a lookout tower. Small torch-lit stone caves, dug into the sides of the hills and mountains, slope down to a chamber with chests. 130 chests are scattered at random on each visit and enemies turn up anywhere. Press T to go there.

## Contributors

- kalakaritzu
- Down1oads
- smackabooble
- Slikzy

## Credits and sharing

- AWP model by Rifeor (sketchfab.com/Rifeor), licence CC BY 4.0, adapted for this game.
- MP5 model by dani-zzz (sketchfab.com/dani-zzz) and Milkor MGL by Valo (sketchfab.com/Valo__), licence CC BY 4.0, adapted.
- Shotgun by Jonathan Steylaerts (sketchfab.com/JonathanSteylaerts) and P90 by charles.cla (sketchfab.com/charles.cla), licence CC BY-NC 4.0 (no commercial use), adapted.
- The caveman, AK-74 and Glock 17 are third-party models. Their licences have not been checked, so do not reuse them from here.
