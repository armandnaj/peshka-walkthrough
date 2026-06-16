import * as THREE from 'three';

const BYTES_IN_MIB = 1024 * 1024;

function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function estimateTextureBytes(texture) {
  const image = texture?.image;
  const width = image?.width || image?.videoWidth || 0;
  const height = image?.height || image?.videoHeight || 0;
  if (!width || !height) return 0;

  const bytesPerPixel = 4;
  const mipMultiplier = texture.generateMipmaps === false ? 1 : 1.33;
  return width * height * bytesPerPixel * mipMultiplier;
}

function collectMaterialTextures(material, textures) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) textures.add(value);
  });
}

function geometryTriangleCount(geometry) {
  if (!geometry) return 0;
  if (geometry.index) return geometry.index.count / 3;
  const position = geometry.attributes?.position;
  return position ? position.count / 3 : 0;
}

function drawCallEstimate(object) {
  const materialCount = Array.isArray(object.material) ? object.material.length : 1;
  const groups = object.geometry?.groups?.length || 0;
  return Math.max(1, groups || materialCount);
}

function pushSuggestion(suggestions, label, detail) {
  suggestions.push({ label, detail });
}

export function prepareModelForRuntimeCulling(model) {
  if (!model) return 0;

  let enabled = 0;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.frustumCulled = true;
    enabled += 1;
  });
  return enabled;
}

export function createPerformanceAudit({ model, renderer }) {
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  const meshByMaterial = new Map();
  const textureDetails = [];
  let meshCount = 0;
  let triangleCount = 0;
  let estimatedDrawCalls = 0;
  let culledMeshes = 0;

  model?.traverse((object) => {
    if (!object.isMesh) return;

    meshCount += 1;
    if (object.frustumCulled) culledMeshes += 1;
    geometries.add(object.geometry);
    triangleCount += geometryTriangleCount(object.geometry);
    estimatedDrawCalls += drawCallEstimate(object);

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      collectMaterialTextures(material, textures);

      const key = material.name || material.uuid || 'unnamed material';
      const group = meshByMaterial.get(key) || {
        material: key,
        meshes: 0,
        triangles: 0,
      };
      group.meshes += 1;
      group.triangles += geometryTriangleCount(object.geometry);
      meshByMaterial.set(key, group);
    });
  });

  let textureMemoryBytes = 0;
  textures.forEach((texture) => {
    const bytes = estimateTextureBytes(texture);
    textureMemoryBytes += bytes;
    textureDetails.push({
      name: texture.name || texture.uuid,
      width: texture.image?.width || texture.image?.videoWidth || 0,
      height: texture.image?.height || texture.image?.videoHeight || 0,
      memoryMiB: bytes / BYTES_IN_MIB,
    });
  });

  textureDetails.sort((a, b) => b.memoryMiB - a.memoryMiB);

  const mergeTargets = [...meshByMaterial.values()]
    .filter((group) => group.meshes > 3)
    .sort((a, b) => b.meshes - a.meshes)
    .slice(0, 5);

  const suggestions = [];
  if (estimatedDrawCalls > 180) {
    pushSuggestion(
      suggestions,
      'Reduce draw calls',
      `Estimated model draw calls are ${formatNumber(estimatedDrawCalls)}. Merge repeated static meshes that share one material.`,
    );
  }
  if (mergeTargets.length) {
    pushSuggestion(
      suggestions,
      'Merge static meshes where possible',
      mergeTargets
        .map((group) => `${group.material}: ${formatNumber(group.meshes)} meshes`)
        .join(' · '),
    );
  }
  if (triangleCount > 1_200_000) {
    pushSuggestion(
      suggestions,
      'Reduce triangle count',
      `Current model has about ${formatNumber(triangleCount)} triangles. Simplify invisible backs, tiny bevels, and dense imported fixtures first.`,
    );
  }
  if (textureMemoryBytes > 256 * BYTES_IN_MIB) {
    pushSuggestion(
      suggestions,
      'Compress textures',
      `Estimated decoded texture memory is ${(textureMemoryBytes / BYTES_IN_MIB).toFixed(1)} MiB. Keep WebP/KTX2 textures and cap most maps at 1024 px.`,
    );
  }
  if (culledMeshes < meshCount) {
    pushSuggestion(
      suggestions,
      'Enable frustum culling',
      `${formatNumber(meshCount - culledMeshes)} meshes still need frustum culling enabled.`,
    );
  } else {
    pushSuggestion(
      suggestions,
      'Frustum culling enabled',
      `All ${formatNumber(meshCount)} meshes are marked for camera frustum culling.`,
    );
  }
  if (!suggestions.length) {
    pushSuggestion(
      suggestions,
      'Model is in a healthy range',
      'Keep using the optimized GLB pipeline and watch draw calls when adding furniture or lights.',
    );
  }

  return {
    drawCalls: estimatedDrawCalls,
    frameDrawCalls: renderer.info.render.calls,
    estimatedModelDrawCalls: estimatedDrawCalls,
    triangles: Math.round(triangleCount),
    textureMemoryMiB: textureMemoryBytes / BYTES_IN_MIB,
    textures: textures.size,
    materials: materials.size,
    meshes: meshCount,
    geometries: geometries.size,
    culledMeshes,
    topTextures: textureDetails.slice(0, 5),
    mergeTargets,
    suggestions,
  };
}
