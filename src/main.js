import './styles.css';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer } from './core/createRenderer.js';
import { createScene } from './core/createScene.js';
import { disposeModel, loadModel, loadModelFile } from './core/loadModel.js';
import { LightingRig } from './features/lighting/LightingRig.js';
import { applyMaterialProfiles, tuneModelMaterialsForVisualPreset } from './features/materials/MaterialProfiles.js';
import { PlayerController } from './features/player/PlayerController.js';
import { PostFX } from './features/postprocessing/PostFX.js';
import { HUD } from './ui/HUD.js';

const canvas = document.querySelector('#app');
const { renderer, mobile } = createRenderer(canvas, CONFIG.renderer);
const { scene, camera, floor } = createScene(CONFIG.scene, CONFIG.player, renderer);
const postFX = new PostFX(renderer, scene, camera, CONFIG.postFX, mobile);
const lighting = new LightingRig(scene, renderer, CONFIG.lighting, postFX);
const hud = new HUD({ mobile });
const player = new PlayerController({
  scene,
  camera,
  canvas,
  config: CONFIG.player,
  mobile,
  touchControls: hud.getTouchControls(),
  fallbackFloor: floor,
});

let currentModel = null;
let replacingModel = false;
let renderQuality = 1;
let modelColorBrightness = CONFIG.visualPresets.balanced.modelColorBrightness;

function visualSettings() {
  return {
    ...lighting.getSettings(),
    ...postFX.getSettings(),
    modelColorBrightness,
    quality: renderQuality,
  };
}

function syncVisualSettings() {
  hud.setVisualSettings(visualSettings());
}

function setRenderQuality(value) {
  renderQuality = Number(value);
  const basePixelRatio = mobile
    ? CONFIG.renderer.mobilePixelRatio
    : CONFIG.renderer.desktopPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, basePixelRatio * renderQuality));
  renderer.setSize(window.innerWidth, window.innerHeight);
  postFX.resize(window.innerWidth, window.innerHeight);
}

function applyModelMaterials() {
  if (!currentModel) return;
  const preset = CONFIG.visualPresets.balanced;
  applyMaterialProfiles(currentModel, {
    ...CONFIG.materials,
    colorBrightness: modelColorBrightness,
    illustrated: { enabled: false },
  });
  tuneModelMaterialsForVisualPreset(currentModel, preset.envMapIntensity);
}

function applyFrenchBarPreset() {
  const preset = CONFIG.visualPresets.balanced;
  renderer.toneMappingExposure = preset.exposure;
  lighting.setAmbient(preset.ambient);
  lighting.setSun(preset.sun);
  lighting.setPractical(preset.practical);
  lighting.setTemperature(preset.temperature);
  lighting.setFog(preset.fog);
  lighting.setShadows(preset.shadows);
  lighting.setShadowQuality({
    mapSize: preset.shadowMapSize,
    modelShadowLights: preset.modelShadowLights,
  });
  postFX.setBloomStrength(preset.bloom);
  postFX.setBloomThreshold(preset.bloomThreshold);
  postFX.setBloomRadius(preset.bloomRadius);
  postFX.setSSAOEnabled(preset.ssao && (!mobile || CONFIG.postFX.ssao.mobileEnabled));
  postFX.setSSAORadius(preset.ssaoRadius);
  postFX.setSSAODistance(preset.ssaoMaxDistance);
  modelColorBrightness = preset.modelColorBrightness;
  setRenderQuality(preset.quality);
  applyModelMaterials();
  syncVisualSettings();
}

function readyMessage(modelName) {
  return mobile
    ? `${modelName} ready · left control walks · drag right side to look`
    : `${modelName} ready · drag to look · WASD to walk · V changes camera`;
}

async function replaceModel(file) {
  if (replacingModel) return;
  replacingModel = true;
  hud.setLoading(0, `Opening ${file.name}`);

  try {
    const result = await loadModelFile({
      scene,
      file,
      centerAndGround: CONFIG.models.centerAndGround,
      onProgress: (percent) => hud.setLoading(percent, `Loading ${file.name}`),
    });
    const previousModel = currentModel;
    currentModel = result.model;
    floor.visible = false;
    applyModelMaterials();
    lighting.bindToModel(currentModel);
    player.setCollisionModel(currentModel);
    player.reset();
    disposeModel(previousModel);
    hud.finishLoading(readyMessage(file.name));
  } catch (error) {
    console.error('Replacement model failed to load.', error);
    hud.finishLoading(`Could not load ${file.name}. Choose a valid self-contained GLB.`);
  } finally {
    replacingModel = false;
  }
}

function toggleCameraMode() {
  const mode = player.toggleCameraMode();
  hud.setCameraMode(mode);
  hud.setLookInversion(player.getLookInversion());
  hud.setStatus(mode === 'third' ? 'Third-person camera' : 'First-person camera');
}

hud.setCameraMode(player.getCameraMode());
hud.setLookInversion(player.getLookInversion());
hud.bind({
  toggleCameraMode,
  jump: () => player.requestJump(),
  replaceModel,
  fullscreen: async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  },
  setExposure: (value) => { renderer.toneMappingExposure = Number(value); },
  setAmbient: (value) => lighting.setAmbient(value),
  setSun: (value) => lighting.setSun(value),
  setPractical: (value) => lighting.setPractical(value),
  setTemperature: (value) => lighting.setTemperature(value),
  setFog: (value) => lighting.setFog(value),
  setBloom: (value) => postFX.setBloomStrength(value),
  setBloomThreshold: (value) => postFX.setBloomThreshold(value),
  setSSAO: (enabled) => postFX.setSSAOEnabled(enabled),
  setSSAORadius: (value) => postFX.setSSAORadius(value),
  setShadows: (enabled) => lighting.setShadows(enabled),
  setLookInvertX: (enabled) => player.setLookInversion('x', enabled),
  setLookInvertY: (enabled) => player.setLookInversion('y', enabled),
  setModelColorBrightness: (value) => {
    modelColorBrightness = Number(value);
    applyModelMaterials();
  },
  setQuality: setRenderQuality,
  resetVisuals: applyFrenchBarPreset,
});
applyFrenchBarPreset();

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') player.reset();
  if (event.code === 'KeyV') toggleCameraMode();
});

loadModel({
  scene,
  optimizedUrl: CONFIG.models.optimized,
  fallbackUrl: CONFIG.models.fallback,
  centerAndGround: CONFIG.models.centerAndGround,
  onProgress: (percent, url) => {
    hud.setLoading(percent, url === CONFIG.models.optimized ? 'Loading optimized model' : 'Loading model');
  },
  onFallback: () => hud.setStatus('Optimized model not found; loading original GLB'),
})
  .then(({ model, source }) => {
    currentModel = model;
    floor.visible = false;
    applyModelMaterials();
    lighting.bindToModel(currentModel);
    player.setCollisionModel(currentModel);
    const name = source === CONFIG.models.optimized ? 'optimized model' : 'original model';
    hud.finishLoading(readyMessage(name));
  })
  .catch((error) => {
    console.error('Model failed to load.', error);
    hud.finishLoading('Model failed to load. Check public/models/peshka.glb');
  });

const clock = new THREE.Clock();
function animate() {
  player.update(Math.min(clock.getDelta(), 0.033));
  postFX.render();
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postFX.resize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  hud.setStatus('Graphics context paused. Reload the page to continue.');
});
