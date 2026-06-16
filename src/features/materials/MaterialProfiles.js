import * as THREE from 'three';

const PROFILES = [
  {
    type: 'light',
    pattern: /(^mat_light_)|(^light[_ .-]*0*1$)|emissive|lamp|light source|leuchte|светиль|ламп/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.5;
      material.emissive = new THREE.Color(0xffb66f);
      material.emissiveIntensity = 0.46;
      material.emissiveMap = null;
    },
  },
  {
    type: 'mirror',
    pattern: /(^mat_mirror_)|mirror|зеркал/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 1;
      if ('roughness' in material) material.roughness = 0.035;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.side = THREE.FrontSide;
    },
  },
  {
    type: 'glass',
    pattern: /(^mat_glass_)|glass|стекл/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.12;
      material.transparent = true;
      material.opacity = Math.min(material.opacity, 0.52);
      material.depthWrite = false;
      material.side = THREE.DoubleSide;
    },
  },
  {
    type: 'metal',
    pattern: /(^mat_metal_)|metal|alumin|steel|iron|copper|brass|bronze|chrome|мед|латун|сталь|металл/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0.82;
      if ('roughness' in material) {
        material.roughness = Math.max(0.2, Math.min(material.roughness, 0.42));
      }
    },
  },
  {
    type: 'wood',
    pattern: /(^mat_wood_)|wood|veneer|bamboo|madeira|дерев|дуб|орех|walnut|oak/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.64;
      if (material.color) material.color.lerp(new THREE.Color(0x7a4930), 0.12);
    },
  },
  {
    type: 'stone',
    pattern: /(^mat_stone_)|stone|granite|marble|travert|concrete|tile|плит|кам|мрам|гранит|бетон/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.72;
      if (material.color) material.color.lerp(new THREE.Color(0x9a8068), 0.08);
    },
  },
  {
    type: 'fabric',
    pattern: /(^mat_fabric_)|fabric|linen|cloth|velvet|leather|ткан|лён|лен|кожа/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.9;
      if (material.color) material.color.lerp(new THREE.Color(0x6d2f2a), 0.08);
    },
  },
  {
    type: 'screen',
    pattern: /(^mat_screen_)|screen|display|экран/i,
    apply(material) {
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.28;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = 0.55;
      if (material.map) material.emissiveMap = material.map;
    },
  },
];

export function applyMaterialProfiles(model, config = {}) {
  const materials = new Set();
  const counts = { default: 0 };

  model.traverse((object) => {
    if (!object.isMesh) return;
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  materials.forEach((material) => {
    const name = material.name || '';
    const profile = PROFILES.find((candidate) => candidate.pattern.test(name));

    if (profile) {
      material.userData.materialProfile = profile.type;
      profile.apply(material);
      counts[profile.type] = (counts[profile.type] || 0) + 1;
    } else {
      material.userData.materialProfile = 'default';
      // SketchUp exports many non-metals with a neutral 0.5 metallic value.
      if ('metalness' in material) {
        material.metalness = Math.min(
          material.metalness,
          config.defaultMetalness ?? 0.08,
        );
      }
      if ('roughness' in material) {
        material.roughness = THREE.MathUtils.clamp(
          material.roughness,
          config.minRoughness ?? 0.32,
          config.maxRoughness ?? 0.9,
        );
      }
      counts.default += 1;
    }

    tuneMaterialForVisualPreset(material, config.envMapIntensity ?? 0.72);
    material.needsUpdate = true;
  });

  console.info('Material profiles applied', counts);
  return counts;
}

export function tuneMaterialForVisualPreset(material, envMapIntensity = 0.72) {
  if (!material || !('envMapIntensity' in material)) return;

  const profile = material.userData.materialProfile;
  const multiplier = profile === 'mirror' ? 1.85 : profile === 'metal' ? 1.18 : 1;
  material.envMapIntensity = envMapIntensity * multiplier;
  material.needsUpdate = true;
}

export function tuneModelMaterialsForVisualPreset(model, envMapIntensity = 0.72) {
  if (!model) return;

  const materials = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });

  materials.forEach((material) => tuneMaterialForVisualPreset(material, envMapIntensity));
}
