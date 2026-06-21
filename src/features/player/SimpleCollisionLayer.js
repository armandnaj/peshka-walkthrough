import * as THREE from 'three';

const EXPLICIT_COLLIDER = /(?:^|[_\s.-])(collision|collider)(?:$|[_\s.-])/i;
const NON_BLOCKING_SURFACE = /floor|ceiling|stair|step|tile|light|lamp|glass|mirror|curtain|rug/i;

function cellKey(x, z) {
  return `${x}:${z}`;
}

function labelFor(object) {
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  return [object.name, ...materials.map((material) => material?.name)]
    .filter(Boolean)
    .join(' ');
}

/**
 * Static, low-cost blockers for capsule movement. A model may provide explicit
 * COLLISION_* meshes; otherwise a bounded set of vertical mesh boxes is used.
 */
export class SimpleCollisionLayer {
  constructor(config = {}) {
    this.config = config;
    this.colliders = [];
    this.cells = new Map();
    this.bounds = new THREE.Box3();
    this.size = new THREE.Vector3();
  }

  clear() {
    this.colliders = [];
    this.cells.clear();
  }

  rebuild(model) {
    this.clear();
    if (!this.config.enabled || !model) return 0;

    const candidates = [];
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (!object.geometry.boundingBox) return;

      this.bounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      this.size.copy(this.bounds.getSize(this.size));
      const label = labelFor(object);
      const explicit = EXPLICIT_COLLIDER.test(label);
      if (!explicit && !this.isAutoBlocker(this.size, label)) return;

      candidates.push({
        box: this.bounds.clone(),
        explicit,
        score: this.collisionPriority(this.size, explicit),
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const maxColliders = this.config.maxColliders ?? 120;
    candidates.slice(0, maxColliders).forEach((candidate) => this.add(candidate.box));
    return this.colliders.length;
  }

  isAutoBlocker(size, label) {
    if (NON_BLOCKING_SURFACE.test(label)) return false;

    const minHeight = this.config.minHeight ?? 0.55;
    if (size.y < minHeight) return false;

    const footprint = size.x * size.z;
    const minFootprint = this.config.minFootprint ?? 0.01;
    if (footprint < minFootprint) return false;

    const maxFootprint = this.config.maxFootprint ?? 36;
    const maxSpan = this.config.maxSpan ?? 18;
    const thinWall = Math.min(size.x, size.z) <= (this.config.thinWallThickness ?? 0.35);
    return thinWall || (footprint <= maxFootprint && Math.max(size.x, size.z) <= maxSpan);
  }

  collisionPriority(size, explicit) {
    if (explicit) return Number.MAX_SAFE_INTEGER;
    const thinWall = Math.min(size.x, size.z) <= (this.config.thinWallThickness ?? 0.35);
    return size.y * (thinWall ? 3 : 1) + Math.min(size.x * size.z, 8);
  }

  add(box) {
    const collider = { box };
    const index = this.colliders.push(collider) - 1;
    const cellSize = this.config.cellSize ?? 3;
    const minX = Math.floor(box.min.x / cellSize);
    const maxX = Math.floor(box.max.x / cellSize);
    const minZ = Math.floor(box.min.z / cellSize);
    const maxZ = Math.floor(box.max.z / cellSize);

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const key = cellKey(x, z);
        const cell = this.cells.get(key) ?? [];
        cell.push(index);
        this.cells.set(key, cell);
      }
    }
  }

  nearby(position, radius) {
    const cellSize = this.config.cellSize ?? 3;
    const minX = Math.floor((position.x - radius) / cellSize);
    const maxX = Math.floor((position.x + radius) / cellSize);
    const minZ = Math.floor((position.z - radius) / cellSize);
    const maxZ = Math.floor((position.z + radius) / cellSize);
    const seen = new Set();
    const colliders = [];

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const cell = this.cells.get(cellKey(x, z));
        if (!cell) continue;
        cell.forEach((index) => {
          if (seen.has(index)) return;
          seen.add(index);
          colliders.push(this.colliders[index]);
        });
      }
    }
    return colliders;
  }

  resolveCapsule(position, footY, height, radius) {
    if (!this.colliders.length) return false;

    const skin = this.config.skin ?? 0.015;
    const topY = footY + height;
    let resolved = false;
    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      const candidates = this.nearby(position, radius + skin);
      for (const { box } of candidates) {
        if (box.max.y <= footY + skin || box.min.y >= topY - skin) continue;

        const closestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
        const closestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        const distanceSquared = dx * dx + dz * dz;
        const targetDistance = radius + skin;
        if (distanceSquared >= targetDistance * targetDistance) continue;

        let normalX;
        let normalZ;
        let distance = Math.sqrt(distanceSquared);
        if (distance > 0.00001) {
          normalX = dx / distance;
          normalZ = dz / distance;
        } else {
          const left = Math.abs(position.x - box.min.x);
          const right = Math.abs(box.max.x - position.x);
          const back = Math.abs(position.z - box.min.z);
          const front = Math.abs(box.max.z - position.z);
          const nearest = Math.min(left, right, back, front);
          normalX = nearest === left ? -1 : nearest === right ? 1 : 0;
          normalZ = normalX ? 0 : nearest === back ? -1 : 1;
          distance = 0;
        }

        const push = targetDistance - distance;
        position.x += normalX * push;
        position.z += normalZ * push;
        changed = true;
        resolved = true;
      }
      if (!changed) break;
    }
    return resolved;
  }
}
