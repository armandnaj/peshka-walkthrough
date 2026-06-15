# Codex task: make Peshka Walkthrough feel like an Enscape-style realtime presentation

You are working on a Three.js/Vite interactive architectural walkthrough for a bar/cafe + chess club called Peshka.

## Current state

The app loads `public/models/peshka.glb`, supports WASD/mouse walkthrough, has a temporary interactive door, ACES tone mapping, SSAO, subtle bloom, and day/evening lighting presets.

## Main goal

Turn this into a clean, stable, deployable realtime walkthrough that feels close to an Enscape presentation while remaining lightweight enough for browser sharing.

## Important visual direction

Atmosphere: warm evening French wine bar + chess club. Not a sterile technical viewer.

Target feeling:
- warm interior light, cooler street/veranda light;
- subtle cinematic contrast;
- contact shadows / ambient occlusion;
- elegant bloom only on practical light sources;
- realistic materials without overdoing game-like effects;
- day/evening toggle;
- stable FPS on laptop and acceptable performance on phone.

## Required tasks

1. Refactor source code into modules:
   - `src/core/createRenderer.js`
   - `src/core/createScene.js`
   - `src/core/loadModel.js`
   - `src/features/player/PlayerController.js`
   - `src/features/interactions/DoorInteraction.js`
   - `src/features/lighting/LightingRig.js`
   - `src/features/postprocessing/PostFX.js`
   - `src/ui/HUD.js`

2. Improve lighting:
   - keep ACES Filmic tone mapping;
   - create named day/evening lighting presets;
   - add warm interior practical light groups;
   - add cool exterior/veranda light;
   - expose preset values in a config object.

3. Improve post-processing:
   - SSAO with reasonable defaults;
   - subtle bloom;
   - optional vignette if easy;
   - preserve color accuracy and avoid extreme effects.

4. Model optimization workflow:
   - add documentation for SketchUp → GLB → gltf-transform optimize;
   - make the app prefer `peshka.optimized.glb` if present, fallback to `peshka.glb`;
   - avoid breaking if textures or HDR are missing.

5. Door interaction:
   - keep temporary door panel;
   - add a config section with door position/rotation/size;
   - make it easy to replace the temporary door with an actual GLB node later.

6. Deployment:
   - make `npm run build` work;
   - add deployment notes for Netlify/Vercel/GitHub Pages;
   - keep model paths compatible with static hosting.

7. Mobile:
   - add basic touch joystick or at least mobile look/walk controls;
   - make UI readable on phone;
   - reduce pixel ratio on mobile.

## Constraints

- Keep Three.js + Vite, do not switch to Unity/Unreal.
- Do not remove the existing GLB model.
- Do not require paid services.
- Do not hardcode local absolute paths.
- Keep it understandable for an architect/designer who is not a full-time web developer.

## Nice-to-have

- Add a small GUI panel or keyboard shortcuts for exposure, bloom, and SSAO.
- Add screenshot button.
- Add fullscreen button.
- Add loading progress bar.
- Add a small “Share-ready mode” that hides debug UI.
