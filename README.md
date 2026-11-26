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
| 5, then click | hold C4, plant it (5 s fuse; on a knocked-out caveman too) |
| R / V | reload / show off your gun |
| 1, 2, 3, 4 or wheel | AK-74, Glock 17, AWP, fists |
| F | fullscreen |
| N | flight mode for testing: WASD flies where you look, Space up, C down, wheel changes speed |
| T | go to the island, then press 1 for the normal map or 2 for the optimized one; T again to go back (temporary) |
| P / M / Esc | enemy fire / sound / pause |

## Files

- `index.html`: the built game
- `src/`: the code
- `assets/`: the caveman model and gun data
- `assets/c4.json`: the bomb, made from a Sketchfab model by `tools/make_c4.py`
- `build.py`: rebuilds `index.html` after you change something (`python3 build.py`)

The map is being made in phases. So far: a big island with two mountains, a mesa, a gorge, a crater, a stone circle, an old camp, a giant skeleton, an enormous tree, a boulder field, a pine wood and a palm bay, in an ocean that hurts if you wade into it. Two rivers cross it, with arched wooden bridges. 130 chests are scattered at random on each visit and enemies turn up anywhere. Press T to go there. No caves yet.

## Contributors

- kalakaritzu
- Down1oads
- smackabooble
- Slikzy

## Credits and sharing

- AWP model by Rifeor (sketchfab.com/Rifeor), licence CC BY 4.0, adapted for this game.
- The caveman, AK-74 and Glock 17 are third-party models. Their licences have not been checked, so do not reuse them from here.
