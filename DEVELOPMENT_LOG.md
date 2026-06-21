# Peshka Walkthrough - Development Log

**Last updated:** 2026-06-21  
**Repository:** `armandnaj/peshka-walkthrough`  
**Status:** deployed architectural walkthrough; current default is the **French Bar** preset.

## 1. Project Intent

Peshka is a browser-based 3D walkthrough for a French wine bar, cafe, and chess club. It is not intended to chase photorealistic Enscape-like rendering. The visual direction is a welcoming illustrated French travel poster / architectural collage:

- warm cream, terracotta, deep blue, and muted green;
- clear, readable interiors rather than dark cinematic mood;
- evening wine-bar atmosphere, summer terrace, social chess-club feeling;
- restrained bloom and contact shading, no heavy grain or horror-film darkness.

## 2. Current Technical Stack

- **Runtime:** Three.js `0.180.0`
- **Tooling:** Vite `7.3.5`, plain JavaScript modules, no React
- **Model format:** self-contained GLB exported from SketchUp
- **Deployment:** Vercel from the `main` branch
- **Main source model:** `public/models/peshka.glb`
- **Runtime-preferred optimized model:** `public/models/peshka.optimized.glb`

The app loads the optimized GLB first and falls back to the original GLB if necessary. The model is centered and grounded at runtime because SketchUp exports can have an inconsistent world origin.

## 3. Current Experience

### Desktop

- First-person and third-person camera modes.
- `WASD` movement, `Shift` run, `Space` jump.
- Drag to look; right mouse button zooms in.
- `E` moves the camera up and `Q` moves it down.
- `V` switches first/third person.
- Ground, stairs, falling, ceiling collision, and lightweight capsule-based side collision work. The side layer uses simple static boxes, not detailed triangle raycasts.

### Mobile / Touch

- Left virtual joystick walks.
- Drag on the right side of the screen to look.
- On-screen buttons: `Jump`, `Camera`, `Adjust`, and `Full`.
- The mobile header is intentionally compact to preserve scene area.
- The `Camera` button switches first/third person and displays the active mode.

### Camera Behavior

- First-person look is normal by default.
- Third-person look is inverted by default.
- Both axes can be changed independently in the settings panel for the active camera mode.
- The third-person camera raycasts against the loaded model to avoid passing through nearby geometry where possible.

## 4. Visual / Lighting State

The default `French Bar` presentation preset is applied on startup.

Current adjustable controls:

- exposure;
- ambient light;
- sun brightness;
- artificial-light intensity;
- color temperature;
- atmospheric fog;
- bloom and bloom threshold;
- model color brightness;
- contact shading (SSAO) and its radius;
- dynamic shadows and render quality;
- look inversion per camera mode.

`Light_01` is treated as a practical-light material name. Runtime spotlights are generated from matching surfaces, but their placement is inherently approximate because it is inferred from the exported geometry.

## 5. Player Representation

The third-person player is deliberately a simple rectangular block / proxy. This was chosen after earlier stylized humanoid experiments were visually awkward and distracted from the architectural walkthrough. Replacing it with a clean low-poly mannequin is a possible later task, but it is not a current priority.

## 6. Important Design Decisions

1. **Keep the product lightweight.** A major clean-core rebuild removed experiments that complicated the walkthrough without improving the core visit.
2. **Use the supplied building model as the source of truth.** New model exports replace the current GLB rather than accumulating model versions in the runtime.
3. **Favor an illustrated mood over fake realism.** The current renderer uses normal physically based materials plus simple lighting and restrained post-processing; it does not use a custom comic/poster shader.
4. **Protect mobile performance.** Mobile caps pixel ratio and disables SSAO by default.
5. **Do not add a placeholder entrance door.** The real entrance door should first be identified as a distinct, named component in the GLB. Door work is intentionally postponed.

## 7. Recent Milestones

- Model loading and in-browser temporary GLB replacement.
- French Bar lighting and image controls.
- Floor/stair/ceiling collision, jumping, and third-person camera collision.
- Separate camera inversion defaults for first and third person.
- Clean rebuild removing obsolete door, mirror, audit, shader, and extra-mode systems.
- Mobile controls and compact mobile header.

## 8. Known Limitations

- Auto-generated side blockers are approximate. For exact future control, export simplified `COLLISION_*` meshes in the GLB; those take priority over inferred boxes.
- The player proxy is a box, not a finished character.
- Third-person camera collision tests detailed model geometry, so dense models can make it less stable or more expensive.
- No true planar mirror reflections. The earlier reflection experiment was removed during the cleanup.
- `Light_01` source geometry may contain more surface area than intended; runtime light inference cannot completely correct an incorrectly assigned material in the GLB.
- The current `README.md` documents some retired features (for example door interaction and day/evening switching). This file is the authoritative description of the current build until the README is refreshed.

## 9. Suggested Roadmap for Review

Ask reviewers to prioritize these in order:

1. **Mobile playability:** test joystick, right-side look, button placement, and landscape orientation on a real phone.
2. **Navigation reliability:** add a simplified collision mesh or BVH/capsule collision for walls and furniture.
3. **Model pipeline:** define a repeatable SketchUp-to-GLB export and optimization checklist; validate material names and `Light_01` surfaces.
4. **Visual language:** make material colors closer to the collage references without reintroducing dark grain, aggressive posterization, or a heavy custom shader.
5. **Entrance door:** after the actual entrance door is supplied as a separately named pivoted component, implement a focused open/close interaction.
6. **Presentation:** add a small set of curated starting camera views or guided stops, only if they do not clutter the basic walkthrough.

## 10. High-Value Files

| File | Purpose |
| --- | --- |
| `src/main.js` | application composition, default preset, model replacement |
| `src/config.js` | player, collision, lighting, and French Bar preset values |
| `src/features/player/PlayerController.js` | desktop/touch movement, collision, cameras, third-person proxy |
| `src/features/lighting/LightingRig.js` | ambient, sun, practical, and model-derived lights |
| `src/features/materials/MaterialProfiles.js` | material classification and brightness tuning |
| `src/features/postprocessing/PostFX.js` | bloom, SSAO, output pipeline |
| `src/ui/HUD.js` | settings and mobile/desktop control bindings |
| `src/styles.css` | HUD, settings panel, responsive mobile controls |

## 11. Recommended Review Package

Give an external reviewer:

1. the GitHub repository link;
2. this file (`DEVELOPMENT_LOG.md`);
3. one desktop screenshot and one phone screenshot of the current build;
4. the three collage reference images that define the target palette;
5. a short question such as: *"Create a practical phased roadmap for this existing Three.js walkthrough. Keep it lightweight, mobile-friendly, illustrated rather than photorealistic, and preserve the current French Bar preset."*

Do not ask the reviewer to redesign from zero. Ask for a roadmap that respects the stack and the decisions above.
