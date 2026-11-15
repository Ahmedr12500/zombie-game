# Dead Night — zombie survival shooter

A browser zombie shooter: four waves, a gun shop, a watchtower, kill streaks, and a top-down **and** first-person view. One self-contained HTML file, no build step.

**Play:** https://ahmedr12500.github.io/zombie-game/

- WASD move · Shift sprint · mouse aim/look · click fire
- G grenade · V vaporize · E tower / mart counter · C switch view · F fullscreen
- First-person mode renders in real 3D (three.js) with an animated rigged zombie model; falls back to the built-in raycaster if WebGL/modules are unavailable.
- Built with HTML5 canvas + WebAudio + three.js.
- Textures: brick & grass from the [three.js](https://github.com/mrdoob/three.js) examples (MIT); asphalt generated procedurally.
