import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

function prepareModel(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      material.needsUpdate = true;
    });
  });

  return model;
}

function centerAndGroundModel(model) {
  model.updateMatrixWorld(true);
  const centersX = [];
  const centersZ = [];
  const groundSamples = [];
  const meshBounds = new THREE.Box3();
  const meshCenter = new THREE.Vector3();

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;

    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;

    meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    meshBounds.getCenter(meshCenter);
    centersX.push(meshCenter.x);
    centersZ.push(meshCenter.z);
    groundSamples.push(meshBounds.min.y);
  });

  if (!centersX.length) return new THREE.Box3();

  centersX.sort((a, b) => a - b);
  centersZ.sort((a, b) => a - b);
  groundSamples.sort((a, b) => a - b);

  const middle = Math.floor(centersX.length / 2);
  const groundIndex = Math.floor(groundSamples.length * 0.05);
  model.position.x -= centersX[middle];
  model.position.y -= groundSamples[groundIndex];
  model.position.z -= centersZ[middle];
  model.updateMatrixWorld(true);

  return new THREE.Box3().setFromObject(model);
}

function loadUrl(loader, url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf),
      (event) => {
        if (!event.total) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100), url);
      },
      reject,
    );
  });
}

function addLoadedModel(scene, gltf, centerAndGround) {
  const model = prepareModel(gltf.scene);
  const bounds = centerAndGround
    ? centerAndGroundModel(model)
    : new THREE.Box3().setFromObject(model);
  scene.add(model);

  return { model, animations: gltf.animations, bounds };
}

export async function loadModel({
  scene,
  optimizedUrl,
  fallbackUrl,
  centerAndGround = true,
  onProgress,
  onFallback,
}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  let gltf;
  let source = optimizedUrl;

  try {
    gltf = await loadUrl(loader, optimizedUrl, onProgress);
  } catch (optimizedError) {
    console.info('Optimized model unavailable; loading the original GLB.', optimizedError);
    onFallback?.();
    source = fallbackUrl;
    gltf = await loadUrl(loader, fallbackUrl, onProgress);
  }

  return {
    ...addLoadedModel(scene, gltf, centerAndGround),
    source,
  };
}

export async function loadModelFile({
  scene,
  file,
  centerAndGround = true,
  onProgress,
}) {
  if (!file?.name.toLowerCase().endsWith('.glb')) {
    throw new Error('Choose a self-contained .glb file.');
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const objectUrl = URL.createObjectURL(file);

  try {
    const gltf = await loadUrl(loader, objectUrl, (percent) => {
      onProgress?.(percent, file.name);
    });
    return {
      ...addLoadedModel(scene, gltf, centerAndGround),
      source: file.name,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function disposeModel(model) {
  if (!model) return;

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) textures.add(value);
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  model.removeFromParent();
}
