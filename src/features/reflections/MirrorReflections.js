import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

const bounds = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();
const localNormal = new THREE.Vector3();
const worldNormal = new THREE.Vector3();
const basisX = new THREE.Vector3();
const basisY = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, 1);

function isMirrorMaterial(material) {
  return material?.userData?.materialProfile === 'mirror';
}

function mirrorArea(object) {
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  bounds.copy(object.geometry.boundingBox);
  bounds.getSize(size);

  const dimensions = [size.x, size.y, size.z].sort((a, b) => b - a);
  return dimensions[0] * dimensions[1];
}

function averageWorldNormal(object) {
  worldNormal.set(0, 0, 0);
  const normals = object.geometry.attributes.normal;
  if (!normals) return worldNormal.set(0, 0, 1);

  normalMatrix.getNormalMatrix(object.matrixWorld);
  const stride = Math.max(1, Math.floor(normals.count / 128));
  for (let index = 0; index < normals.count; index += stride) {
    localNormal.fromBufferAttribute(normals, index);
    worldNormal.add(localNormal.applyMatrix3(normalMatrix).normalize());
  }

  if (worldNormal.lengthSq() < 0.001) worldNormal.set(0, 0, 1);
  return worldNormal.normalize();
}

function createMirrorPlane(object) {
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  bounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
  bounds.getCenter(center);
  bounds.getSize(size);

  const normal = averageWorldNormal(object).clone();
  basisX.crossVectors(up, normal);
  if (basisX.lengthSq() < 0.001) basisX.crossVectors(forward, normal);
  basisX.normalize();
  basisY.crossVectors(normal, basisX).normalize();

  const corners = [
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ];
  const projectedX = corners.map((corner) => corner.clone().sub(center).dot(basisX));
  const projectedY = corners.map((corner) => corner.clone().sub(center).dot(basisY));
  const width = Math.max(0.05, Math.max(...projectedX) - Math.min(...projectedX));
  const height = Math.max(0.05, Math.max(...projectedY) - Math.min(...projectedY));
  const geometry = new THREE.PlaneGeometry(width, height);
  const matrix = new THREE.Matrix4().makeBasis(basisX, basisY, normal);
  matrix.setPosition(center.addScaledVector(normal, 0.006));

  return { geometry, matrix };
}

function protectAgainstRecursiveReflections(reflector, allReflectors) {
  const originalOnBeforeRender = reflector.onBeforeRender;
  reflector.onBeforeRender = (...args) => {
    const previousVisibility = allReflectors.map((item) => item.visible);
    allReflectors.forEach((item) => {
      if (item !== reflector) item.visible = false;
    });

    try {
      originalOnBeforeRender.apply(reflector, args);
    } finally {
      allReflectors.forEach((item, index) => {
        item.visible = previousVisibility[index];
      });
    }
  };
}

export class MirrorReflections {
  constructor(scene, config = {}, mobile = false) {
    this.scene = scene;
    this.config = config;
    this.mobile = mobile;
    this.reflectors = [];
  }

  clear() {
    this.reflectors.forEach((reflector) => {
      reflector.dispose?.();
      reflector.geometry?.dispose();
      reflector.removeFromParent();
    });
    this.reflectors = [];
  }

  bindToModel(model) {
    this.clear();
    if (!model || !this.config.enabled || this.mobile) return 0;

    const candidates = [];
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (!materials.length || !materials.every(isMirrorMaterial)) return;

      const area = mirrorArea(object);
      if (area < (this.config.minArea ?? 0.3)) return;
      candidates.push({ object, area });
    });

    candidates.sort((a, b) => b.area - a.area);
    const selected = candidates.slice(0, this.config.maxMirrors ?? 4);

    this.reflectors = selected.flatMap(({ object }, index) => {
      let plane;
      try {
        plane = createMirrorPlane(object);
      } catch (error) {
        console.warn('Mirror reflector skipped.', error);
        return [];
      }

      const reflector = new Reflector(plane.geometry, {
        clipBias: this.config.clipBias ?? 0.006,
        color: this.config.color ?? 0x9a8a78,
        textureWidth: this.config.textureSize ?? 1024,
        textureHeight: this.config.textureSize ?? 1024,
      });
      reflector.name = `PlanarMirror_${index + 1}`;
      reflector.matrixAutoUpdate = false;
      reflector.matrix.copy(plane.matrix);
      reflector.renderOrder = 8;
      reflector.frustumCulled = true;
      reflector.material.depthWrite = true;
      reflector.material.polygonOffset = true;
      reflector.material.polygonOffsetFactor = -1;
      reflector.material.polygonOffsetUnits = -1;
      reflector.userData.sourceMirror = object.name || object.uuid;

      this.scene.add(reflector);
      return [reflector];
    });
    this.reflectors.forEach((reflector) => {
      protectAgainstRecursiveReflections(reflector, this.reflectors);
    });

    console.info(`Bound ${this.reflectors.length} planar mirrors`);
    return this.reflectors.length;
  }
}
