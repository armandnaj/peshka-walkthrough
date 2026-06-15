import * as THREE from 'three';

export class DoorInteraction {
  constructor(config) {
    this.config = config;
    this.object = null;
    this.isOpen = false;
    this.closedRotationY = 0;
    this.targetRotation = 0;
    this.worldPosition = new THREE.Vector3();
  }

  bindToModel(model) {
    this.object = null;
    this.isOpen = false;

    if (!this.config.nodeName) return false;

    const node = model.getObjectByName(this.config.nodeName);
    if (!node) {
      console.warn(`Door node "${this.config.nodeName}" was not found.`);
      return false;
    }

    this.object = node;
    this.closedRotationY = node.rotation.y;
    this.targetRotation = node.rotation.y;
    return true;
  }

  canInteract(position) {
    if (!this.object) return false;
    this.object.getWorldPosition(this.worldPosition);
    return this.worldPosition.distanceTo(position) <= this.config.interactionDistance;
  }

  interact(position) {
    if (!this.canInteract(position)) return false;
    this.isOpen = !this.isOpen;
    this.targetRotation =
      this.closedRotationY + (this.isOpen ? this.config.openAngle : 0);
    return true;
  }

  update() {
    if (!this.object) return;
    this.object.rotation.y += (this.targetRotation - this.object.rotation.y) * 0.12;
  }
}
