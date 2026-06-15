import * as THREE from 'three';

export class LightingRig {
  constructor(scene, renderer, config, postFX) {
    this.scene = scene;
    this.renderer = renderer;
    this.config = config;
    this.postFX = postFX;
    this.currentPreset = config.defaultPreset;
    this.modelPracticals = [];

    this.hemisphere = new THREE.HemisphereLight();
    scene.add(this.hemisphere);

    this.sun = new THREE.DirectionalLight();
    this.sun.name = 'PresentationSun';
    this.sun.position.set(-4, 8, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -18;
    this.sun.shadow.camera.right = 18;
    this.sun.shadow.camera.top = 18;
    this.sun.shadow.camera.bottom = -18;
    scene.add(this.sun);

    this.practicals = config.practicals.map((definition, index) => {
      const light = new THREE.PointLight(
        0xffb56b,
        definition.intensity,
        definition.distance,
        2,
      );
      light.name = `WarmPractical_${index + 1}`;
      light.position.fromArray(definition.position);
      light.userData.baseIntensity = definition.intensity;
      scene.add(light);
      return light;
    });

    this.exterior = new THREE.PointLight(
      config.exterior.color,
      config.exterior.intensity,
      config.exterior.distance,
      2,
    );
    this.exterior.name = 'CoolVerandaLight';
    this.exterior.position.fromArray(config.exterior.position);
    scene.add(this.exterior);

    this.applyPreset(this.currentPreset);
  }

  clearModelPracticals() {
    this.modelPracticals.forEach((light) => light.removeFromParent());
    this.modelPracticals = [];
  }

  bindToModel(model) {
    this.clearModelPracticals();
    if (!model || !this.config.modelPracticals) return 0;

    const definition = this.config.modelPracticals;
    const candidates = [];
    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();

    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (!materials.some((material) => definition.materialName.test(material?.name || ''))) {
        return;
      }

      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (!object.geometry.boundingBox) return;
      bounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      bounds.getCenter(center);
      candidates.push(center.clone());
    });

    candidates.sort((a, b) => b.y - a.y);
    const positions = [];
    for (const candidate of candidates) {
      const separated = positions.every(
        (position) => position.distanceToSquared(candidate) >= definition.minSpacing ** 2,
      );
      if (!separated) continue;
      positions.push(candidate);
      if (positions.length >= definition.maxLights) break;
    }

    this.modelPracticals = positions.map((position, index) => {
      const light = new THREE.PointLight(
        definition.color,
        definition.intensity,
        definition.distance,
        definition.decay,
      );
      light.name = `ModelPractical_${index + 1}`;
      light.position.copy(position);
      light.userData.baseIntensity = definition.intensity;
      light.castShadow = false;
      this.scene.add(light);
      return light;
    });

    this.applyPracticalIntensity();
    console.info(`Bound ${this.modelPracticals.length} lights to ${definition.materialName}`);
    return this.modelPracticals.length;
  }

  applyPracticalIntensity() {
    const preset = this.config.presets[this.currentPreset];
    if (!preset) return;

    const hasModelPracticals = this.modelPracticals.length > 0;
    this.practicals.forEach((light) => {
      light.intensity = hasModelPracticals
        ? 0
        : light.userData.baseIntensity * preset.practicalIntensity;
    });
    this.modelPracticals.forEach((light) => {
      light.intensity = light.userData.baseIntensity * preset.practicalIntensity;
    });
  }

  applyPreset(name) {
    const preset = this.config.presets[name];
    if (!preset) return;

    this.currentPreset = name;
    this.scene.background.set(preset.background);
    this.scene.fog.color.set(preset.background);
    this.scene.fog.density = preset.fogDensity;
    this.scene.environmentIntensity = preset.environmentIntensity ?? 1;
    this.hemisphere.color.set(preset.hemisphere.sky);
    this.hemisphere.groundColor.set(preset.hemisphere.ground);
    this.hemisphere.intensity = preset.hemisphere.intensity;
    this.sun.color.set(preset.sun.color);
    this.sun.intensity = preset.sun.intensity;
    this.applyPracticalIntensity();
    this.exterior.intensity = this.config.exterior.intensity * preset.exteriorIntensity;
    this.renderer.toneMappingExposure = preset.exposure;
    this.postFX.setBloomStrength(preset.bloom);
  }

  togglePreset() {
    const next = this.currentPreset === 'evening' ? 'day' : 'evening';
    this.applyPreset(next);
    return next;
  }

  getLabel() {
    return this.config.presets[this.currentPreset].label;
  }
}
