# Peshka Walkthrough

Lightweight Three.js/Vite architectural walkthrough for the Peshka bar, cafe, and chess club.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local Vite URL. Production output is created with:

```bash
npm run build
npm run preview
```

## Controls

- `WASD`: walk
- Drag with the left mouse button: look around
- Arrow keys: rotate the camera
- `E` / `Q`: raise or lower the camera, Unreal-style
- `Shift`: move faster
- `F`: interact with a configured door
- `R`: reset position
- `L`: toggle day/evening lighting
- `H`: hide or restore presentation UI
- Phone/tablet: left joystick walks; drag the right side to look

The top-right controls also switch lighting, save a screenshot, enter fullscreen, tune effects, and hide the UI.

## Ground collision and stairs

The camera probes the loaded model below the player and follows walkable surfaces. It can step onto surfaces up to `CONFIG.player.collision.stepHeight`, follows stairs downward with gravity, and rejects surfaces that are too steep.

This first collision layer handles floors, landings, and stairs. It does not yet block walls or furniture from the side. Reliable wall collision should use a simplified collision mesh or a capsule/BVH pass rather than testing every detailed decorative object.

## Load an updated model without rebuilding

Export the changed SketchUp model as one self-contained `.glb` file. While the walkthrough is open:

1. Click `Model` in the presentation controls and choose the new GLB, or drag the GLB onto the walkthrough.
2. Wait for the loading bar to finish.
3. The old model is removed only after the replacement loads successfully. The camera resets to the configured start position.

This browser upload is temporary and private to the current tab. Refreshing the page restores the deployed model from `public/models`. To make the update permanent for everyone, replace `public/models/peshka.glb`, run the optimizer if needed, rebuild, and redeploy.

Use GLB rather than separate `.gltf` + texture files so all textures arrive in one upload.

### Permanent main model

Replace this exact file:

```text
public/models/peshka.glb
```

Keep the filename unchanged. Code edits and rebuilds do not overwrite it, so you only replace it when the SketchUp model itself changes. Then refresh the browser. If `public/models/peshka.optimized.glb` exists, regenerate or remove it after changing the original, otherwise the deployed app may continue loading the older optimized copy.

## Material naming

The runtime already recognizes common names such as `Glass`, `Wood`, `Metal`, `Marble`, `Fabric`, and `Emissive`. For predictable results across future exports, use these prefixes in SketchUp:

```text
MAT_WOOD_Oak_Dark
MAT_METAL_Black_Steel
MAT_GLASS_Clear
MAT_STONE_Travertine
MAT_FABRIC_Green_Velvet
MAT_LIGHT_Warm_2700K
MAT_SCREEN_Projector
```

The suffix can be any descriptive name. These profiles set sensible metalness, roughness, transparency, reflections, and emissive response automatically. Materials with generic names such as `Material #25` cannot be classified reliably.

## Project structure

```text
src/config.js                              visual and interaction tuning
src/core/createRenderer.js                 WebGL renderer and device quality
src/core/createScene.js                    scene, camera, and fallback floor
src/core/loadModel.js                      optimized/original GLB loading
src/features/player/PlayerController.js    desktop and touch navigation
src/features/interactions/DoorInteraction.js
src/features/lighting/LightingRig.js
src/features/postprocessing/PostFX.js
src/ui/HUD.js
```

## SketchUp to optimized GLB

1. Clean the SketchUp model: remove unused components/materials, fix reversed faces, and keep texture sizes sensible.
2. Export glTF 2.0/GLB with meters as the working scale. Prefer embedded textures for a single portable file.
3. Place the export at `public/models/peshka.glb`.
4. Install dependencies and optimize:

```bash
npm install
npm run optimize:model
```

This creates `public/models/peshka.optimized.glb` with WebP textures, a 1024 px texture cap, and high-precision Meshopt geometry compression. Positions and normals use 16-bit quantization to avoid visible jitter on thin or overlapping architectural surfaces. The app automatically tries the optimized model first and falls back to the original GLB if it is absent or cannot load.

Keep the original GLB locally as the source asset and runtime fallback. It is excluded from Git because it exceeds GitHub's regular file-size limit; the deployable optimized GLB remains versioned. Missing HDR files do not break the app because the presentation lighting is generated in Three.js.

The current SketchUp export is far from its file origin, so `CONFIG.models.centerAndGround` recenters its visible geometry at runtime and places its lowest point on the fallback floor. Disable that option only after re-exporting the model around a deliberate project origin.

## Adding the real interactive door

There is no placeholder door in the scene. The cleanest workflow is to keep the real door inside the main SketchUp model:

1. Make the door leaf a separate component, not merged with the wall or frame.
2. Place the component axes/origin exactly on the hinge line.
3. Give it a stable unique name, for example `Peshka_Main_Door`.
4. Export the complete model as GLB.
5. Set `CONFIG.door.nodeName` in `src/config.js` to that exact exported node name.

The walkthrough then finds that node automatically and rotates it with `F` when the camera is within the configured interaction distance. If the node is absent, no door geometry, button, or interaction prompt is shown.

An isolated door GLB can also be supported, but it needs a reliable position, rotation, and scale relative to the main building. Keeping the door as a separate named component inside the main GLB is less fragile and is the recommended option.

## Deployment

All asset URLs use Vite's `BASE_URL`, so they work from a root domain or a GitHub Pages subdirectory.

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`

### Vercel

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages

Set `base` in `vite.config.js` to the repository path, for example `/peshka-walkthrough/`, or build with `vite build --base=/peshka-walkthrough/`. Publish the generated `dist` directory with a Pages workflow.

Large GLB files can exceed Git hosting limits. If that happens, use Git LFS or reduce the optimized model before deployment. No paid service is required.

## Performance notes

- Mobile pixel ratio is capped and SSAO is disabled by default on coarse-pointer devices.
- Desktop SSAO, restrained bloom, and vignette can be adjusted from the presentation panel.
- Only the directional light casts dynamic shadows; practical lights remain inexpensive.
- For further optimization, reduce texture dimensions, merge repeated materials, and use instancing for repeated furniture.
