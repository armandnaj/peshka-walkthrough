import './styles.css';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer } from './core/createRenderer.js';
import { createScene } from './core/createScene.js';
import { disposeModel, loadModel, loadModelFile } from './core/loadModel.js';
import { DoorInteraction } from './features/interactions/DoorInteraction.js';
import {
  createPerformanceAudit,
  prepareModelForRuntimeCulling,
} from './features/diagnostics/PerformanceAudit.js';
import { LightingRig } from './features/lighting/LightingRig.js';
import {
  applyMaterialProfiles,
  tuneModelMaterialsForVisualPreset,
} from './features/materials/MaterialProfiles.js';
import { PlayerController } from './features/player/PlayerController.js';
import { PostFX } from './features/postprocessing/PostFX.js';
import { HUD } from './ui/HUD.js';

const canvas = document.querySelector('#app');
const { renderer, mobile } = createRenderer(canvas, CONFIG.renderer);
const { scene, camera, floor } = createScene(CONFIG.scene, CONFIG.player, renderer);
const postFX = new PostFX(renderer, scene, camera, CONFIG.postFX, mobile);
const lighting = new LightingRig(scene, renderer, CONFIG.lighting, postFX);
const door = new DoorInteraction(CONFIG.door);
const hud = new HUD({ mobile });
const player = new PlayerController({
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
let activeVisualPreset = 'balanced';

function visualSettings() {
  return {
    ...lighting.getSettings(),
    ...postFX.getSettings(),
    quality: renderQuality,
    visualPreset: activeVisualPreset,
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
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, basePixelRatio * renderQuality),
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  postFX.resize(window.innerWidth, window.innerHeight);
}

function setMaterialReflectionQuality(envMapIntensity) {
  tuneModelMaterialsForVisualPreset(currentModel, envMapIntensity);
}

function applyVisualPreset(name) {
  const preset = CONFIG.visualPresets[name];
  if (!preset) return;

  activeVisualPreset = name;
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
  setRenderQuality(preset.quality);
  setMaterialReflectionQuality(preset.envMapIntensity);
  syncVisualSettings();
  hud.setStatus(preset.status);
}

function refreshPerformanceAudit() {
  if (!currentModel) {
    hud.setStatus('Load a model before running performance audit');
    return;
  }

  postFX.render();
  hud.setPerformanceAudit(createPerformanceAudit({ model: currentModel, renderer }));
  hud.setStatus('Performance audit refreshed');
}

function readyMessage(modelName) {
  return mobile
    ? `${modelName} ready · left control walks · drag right side to look`
    : `${modelName} ready · drag to look · WASD to walk`;
}

async function replaceModel(file) {
  if (replacingModel) return;

  replacingModel = true;
  document.exitPointerLock?.();
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
    prepareModelForRuntimeCulling(currentModel);
    applyMaterialProfiles(currentModel, CONFIG.materials);
    setMaterialReflectionQuality(CONFIG.visualPresets[activeVisualPreset].envMapIntensity);
    lighting.bindToModel(currentModel);
    door.bindToModel(currentModel);
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

hud.setMode(lighting.getLabel());
hud.bind({
  toggleMode: () => {
    lighting.togglePreset();
    hud.setMode(lighting.getLabel());
    hud.setStatus(`${lighting.getLabel()} lighting`);
    syncVisualSettings();
  },
  interact: () => door.interact(camera.position),
  fullscreen: async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  },
  screenshot: () => {
    postFX.render();
    renderer.domElement.toBlob((blob) => {
      if (!blob) {
        hud.setStatus('Screenshot is not supported by this browser');
        return;
      }
      const link = document.createElement('a');
      link.download = `peshka-${lighting.currentPreset}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      hud.setStatus('Screenshot saved');
    }, 'image/png');
  },
  setExposure: (value) => {
    renderer.toneMappingExposure = Number(value);
  },
  setAmbient: (value) => lighting.setAmbient(value),
  setSun: (value) => lighting.setSun(value),
  setPractical: (value) => lighting.setPractical(value),
  setTemperature: (value) => lighting.setTemperature(value),
  setFog: (value) => lighting.setFog(value),
  setBloom: (value) => {
    postFX.setBloomStrength(value);
  },
  setBloomThreshold: (value) => postFX.setBloomThreshold(value),
  setVignette: (value) => postFX.setVignetteDarkness(value),
  setSSAO: (enabled) => {
    postFX.setSSAOEnabled(enabled);
  },
  setSSAORadius: (value) => postFX.setSSAORadius(value),
  setShadows: (enabled) => lighting.setShadows(enabled),
  setQuality: setRenderQuality,
  applyVisualPreset,
  resetVisuals: () => {
    applyVisualPreset(activeVisualPreset);
  },
  refreshAudit: refreshPerformanceAudit,
  replaceModel,
});
syncVisualSettings();
applyVisualPreset(activeVisualPreset);

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') player.reset();
  if (event.code === 'KeyL') {
    lighting.togglePreset();
    hud.setMode(lighting.getLabel());
    syncVisualSettings();
  }
  if (event.code === 'KeyF') door.interact(camera.position);
  if (event.code === 'KeyH') hud.setShareReady(!hud.shareReady);
});

loadModel({
  scene,
  optimizedUrl: CONFIG.models.optimized,
  fallbackUrl: CONFIG.models.fallback,
  centerAndGround: CONFIG.models.centerAndGround,
  onProgress: (percent, url) => {
    const optimized = url === CONFIG.models.optimized;
    hud.setLoading(percent, optimized ? 'Loading optimized model' : 'Loading model');
  },
  onFallback: () => hud.setStatus('Optimized model not found; loading original GLB'),
})
  .then(({ model, source }) => {
    currentModel = model;
    prepareModelForRuntimeCulling(currentModel);
    applyMaterialProfiles(currentModel, CONFIG.materials);
    setMaterialReflectionQuality(CONFIG.visualPresets[activeVisualPreset].envMapIntensity);
    lighting.bindToModel(currentModel);
    door.bindToModel(currentModel);
    player.setCollisionModel(currentModel);
    const modelName = source === CONFIG.models.optimized ? 'optimized model' : 'original model';
    hud.finishLoading(readyMessage(modelName));
  })
  .catch((error) => {
    console.error('Model failed to load.', error);
    hud.finishLoading('Model failed to load. Check public/models/peshka.glb');
  });

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  player.update(delta);
  door.update();
  hud.showInteraction(door.canInteract(camera.position), door.isOpen);
  postFX.render();
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  postFX.resize(width, height);
});

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  hud.setStatus('Graphics context paused. Reload the page to continue.');
});
