# goobmen

A third-person caveman fighting game with real guns. Loot chests, fight other cavemen, and loot them when they go down, before the balloon man gets there.

**To play:** download `index.html` and open it in Chrome. The whole game is in that one file.

On the menu pick **Baseplate** or **Island**. The island starts with a boat trip: you in your gold shades, your mate at the wheel, a boombox and a few cans, and then a rock. You wake up on the beach with the boat still burning, get up, and throw the shades in the sand. Space skips it, and there is a box on the menu to skip it every time.

The boombox plays the game's own tune. "Use my MP3" on the menu plays a song from your own computer instead; it stays in your browser and is never part of the game.

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
| E by a bike | ride the tiny bike: W/S pedal and brake, A/D or mouse steer, Shift faster, Space hop, click for the bell, E to get off |
| 5, then click | hold C4, plant it (5 s fuse; on a knocked-out caveman too) |
| R / V | reload / show off your gun |
| 1, 2, 3, 4 or wheel | AK-74, Glock 17, AWP, fists |
| 6, 7, 8, 9 | MP5, P90, shotgun, grenade launcher |
| F | fullscreen |
| N | flight mode for testing: WASD flies where you look, Space up, C down, wheel changes speed |
| T | go to the island, then press 1 for the normal map or 2 for the optimized one; T again to go back (temporary) |
| Space / Enter | skip the boat trip |
| P / M / Esc | enemy fire / sound / pause |

## Files

- `index.html`: the built game
- `src/`: the code
- `assets/`: the caveman model and gun data (`guns2.json` is made by `tools/make_guns.py`)
- `assets/c4.json`: the bomb, made from a Sketchfab model by `tools/make_c4.py`
- `assets/house.json`, `assets/bike.json`: the abandoned house and the BMX bike, made by `tools/make_scenery.py`
- `src/houses.js`, `src/bike.js`: house walls and drawing; riding, tricks and crashes
- `src/cutscene.js`: the boat trip, the sea and the wreck on the beach
- `src/models.js`: the sunglasses, captain's hat, boat, boombox, cans and rocks, all made in code
- `build.py`: rebuilds `index.html` after you change something (`python3 build.py`)

Chests can also hold a bulletproof vest, which soaks up body hits until it breaks (not headshots). For now there is also a chest of every item by the "something cool here" sign, for testing.

The map is being made in phases. So far: a big island with two mountains, a mesa, a gorge, a crater, a stone circle, an old camp, a giant skeleton, an enormous tree, a boulder field, a pine wood and a palm bay, in an ocean that hurts if you wade into it. Two rivers cross it, with arched wooden bridges. Further out are a volcano, table rocks, stone arches, a mammoth graveyard, a fishing camp, a grove of giant trees, great stone heads, a log fort, a second canyon and a lookout tower. Small torch-lit stone caves, dug into the sides of the hills and mountains, slope down to a chamber with chests, a campfire and paintings on the walls. 130 chests are scattered at random on each visit and enemies turn up anywhere. Abandoned houses are dotted about, with walls and a door you can walk through, and some of them have a tiny BMX bike (a different lot each visit; for now one also waits by the sign, for testing). Pick Island on the menu to go there (or press T).

## Contributors

- kalakaritzu
- Down1oads
- smackabooble
- Slikzy

## Credits and sharing

- AWP model by Rifeor (sketchfab.com/Rifeor), licence CC BY 4.0, adapted for this game.
- MP5 model by dani-zzz (sketchfab.com/dani-zzz) and Milkor MGL by Valo (sketchfab.com/Valo__), licence CC BY 4.0, adapted.
- Abandoned House by Sengchor (sketchfab.com/Sengchor) and BMX Bike by Erdem Dağdelen (sketchfab.com/erdemdagdelen), licence CC BY 4.0, adapted.
- Shotgun by Jonathan Steylaerts (sketchfab.com/JonathanSteylaerts) and P90 by charles.cla (sketchfab.com/charles.cla), licence CC BY-NC 4.0 (no commercial use), adapted.
- The caveman, AK-74 and Glock 17 are third-party models. Their licences have not been checked, so do not reuse them from here.
