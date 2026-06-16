import * as THREE from 'three';

function kelvinToColor(kelvin, target = new THREE.Color()) {
  const temperature = THREE.MathUtils.clamp(kelvin, 1000, 40000) / 100;
  let red;
  let green;
  let blue;

  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue = temperature <= 19
      ? 0
      : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (temperature - 60) ** -0.1332047592;
    green = 288.1221695283 * (temperature - 60) ** -0.0755148492;
    blue = 255;
  }

  return target.setRGB(
    THREE.MathUtils.clamp(red, 0, 255) / 255,
    THREE.MathUtils.clamp(green, 0, 255) / 255,
    THREE.MathUtils.clamp(blue, 0, 255) / 255,
    THREE.SRGBColorSpace,
  );
}

export class LightingRig {
  constructor(scene, renderer, config, postFX) {
    this.scene = scene;
    this.renderer = renderer;
    this.config = config;
    this.postFX = postFX;
    this.currentPreset = config.defaultPreset;
    this.modelPracticals = [];
    this.modelPracticalTargets = [];
    this.adjustments = {
      ambient: 1,
      sun: 1,
      practical: 1,
      temperature: 3000,
      fog: 1,
      shadows: true,
    };
    this.practicalColor = new THREE.Color();
    this.modelShadowLights = 0;
    this.shadowMapSize = 2048;

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
    this.modelPracticalTargets.forEach((target) => target.removeFromParent());
    this.modelPracticals = [];
    this.modelPracticalTargets = [];
  }

  bindToModel(model) {
    this.clearModelPracticals();
    if (!model || !this.config.modelPracticals) return 0;

    const definition = this.config.modelPracticals;
    const candidates = [];
    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();
    const localNormal = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();

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

      worldNormal.set(0, 0, 0);
      const normals = object.geometry.attributes.normal;
      if (normals) {
        normalMatrix.getNormalMatrix(object.matrixWorld);
        const stride = Math.max(1, Math.floor(normals.count / 512));
        for (let index = 0; index < normals.count; index += stride) {
          localNormal.fromBufferAttribute(normals, index);
          worldNormal.add(localNormal.applyMatrix3(normalMatrix).normalize());
        }
      }
      if (worldNormal.lengthSq() < 0.01) worldNormal.set(0, -1, 0);
      worldNormal.normalize();

      candidates.push({
        position: center.clone(),
        direction: worldNormal.clone(),
      });
    });

    candidates.sort((a, b) => b.position.y - a.position.y);
    const selected = [];
    for (const candidate of candidates) {
      const separated = selected.every(
        (item) =>
          item.position.distanceToSquared(candidate.position) >= definition.minSpacing ** 2,
      );
      if (!separated) continue;
      selected.push(candidate);
      if (selected.length >= definition.maxLights) break;
    }

    this.modelPracticals = selected.map(({ position, direction }, index) => {
      const light = new THREE.SpotLight(
        definition.color,
        definition.intensity,
        definition.distance,
        definition.angle,
        definition.penumbra,
        definition.decay,
      );
      light.name = `ModelPractical_${index + 1}`;
      light.position.copy(position).addScaledVector(direction, definition.surfaceOffset);
      light.userData.baseIntensity = definition.intensity;
      light.castShadow = false;
      light.shadow.mapSize.set(512, 512);

      const target = new THREE.Object3D();
      target.name = `${light.name}_Target`;
      target.position.copy(position).addScaledVector(direction, definition.targetDistance);
      light.target = target;
      this.scene.add(light);
      this.scene.add(target);
      this.modelPracticalTargets.push(target);
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
        : light.userData.baseIntensity *
          preset.practicalIntensity *
          this.adjustments.practical;
      light.color.copy(this.practicalColor);
    });
    this.modelPracticals.forEach((light) => {
      light.intensity =
        light.userData.baseIntensity *
        preset.practicalIntensity *
        this.adjustments.practical;
      light.color.copy(this.practicalColor);
    });
  }

  applyAdjustments() {
    const preset = this.config.presets[this.currentPreset];
    if (!preset) return;

    kelvinToColor(this.adjustments.temperature, this.practicalColor);
    this.scene.fog.density = preset.fogDensity * this.adjustments.fog;
    this.scene.environmentIntensity =
      (preset.environmentIntensity ?? 1) * this.adjustments.ambient;
    this.hemisphere.intensity =
      preset.hemisphere.intensity * this.adjustments.ambient;
    this.sun.intensity = preset.sun.intensity * this.adjustments.sun;
    this.sun.castShadow = this.adjustments.shadows;
    this.sun.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
    this.modelPracticals.forEach((light, index) => {
      light.castShadow = this.adjustments.shadows && index < this.modelShadowLights;
    });
    this.applyPracticalIntensity();
  }

  applyPreset(name) {
    const preset = this.config.presets[name];
    if (!preset) return;

    this.currentPreset = name;
    this.scene.background.set(preset.background);
    this.scene.fog.color.set(preset.background);
    this.hemisphere.color.set(preset.hemisphere.sky);
    this.hemisphere.groundColor.set(preset.hemisphere.ground);
    this.sun.color.set(preset.sun.color);
    this.exterior.intensity = this.config.exterior.intensity * preset.exteriorIntensity;
    this.renderer.toneMappingExposure = preset.exposure;
    this.postFX.setBloomStrength(preset.bloom);
    this.applyAdjustments();
  }

  setAmbient(value) {
    this.adjustments.ambient = Number(value);
    this.applyAdjustments();
  }

  setSun(value) {
    this.adjustments.sun = Number(value);
    this.applyAdjustments();
  }

  setPractical(value) {
    this.adjustments.practical = Number(value);
    this.applyAdjustments();
  }

  setTemperature(value) {
    this.adjustments.temperature = Number(value);
    this.applyAdjustments();
  }

  setFog(value) {
    this.adjustments.fog = Number(value);
    this.applyAdjustments();
  }

  setShadows(enabled) {
    this.adjustments.shadows = enabled;
    this.applyAdjustments();
  }

  setShadowQuality({ mapSize = 2048, modelShadowLights = 0 } = {}) {
    this.shadowMapSize = mapSize;
    this.modelShadowLights = modelShadowLights;
    this.applyAdjustments();
  }

  resetAdjustments() {
    Object.assign(this.adjustments, {
      ambient: 1,
      sun: 1,
      practical: 1,
      temperature: 3000,
      fog: 1,
      shadows: true,
    });
    this.applyPreset(this.currentPreset);
  }

  getSettings() {
    return {
      exposure: this.renderer.toneMappingExposure,
      ...this.adjustments,
    };
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
