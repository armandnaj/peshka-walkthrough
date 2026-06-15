import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerController {
  constructor({ camera, canvas, config, mobile, touchControls, fallbackFloor }) {
    this.camera = camera;
    this.canvas = canvas;
    this.config = config;
    this.mobile = mobile;
    this.keys = new Set();
    this.direction = new THREE.Vector3();
    this.touchMove = new THREE.Vector2();
    this.targetHeight = config.height;
    this.collisionMeshes = fallbackFloor ? [fallbackFloor] : [];
    this.fallbackFloor = fallbackFloor;
    this.raycaster = new THREE.Raycaster();
    this.rayOrigin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
    this.worldNormal = new THREE.Vector3();
    this.normalMatrix = new THREE.Matrix3();
    this.previousPosition = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.groundProbeTimer = 0;
    this.cachedGroundY = null;
    this.defaultFov = camera.fov;
    this.zoomed = false;
    this.controls = new PointerLockControls(camera, document.body);

    this.onKeyDown = (event) => {
      const controlledKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyE',
        'KeyQ',
      ];
      if (controlledKeys.includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (mobile) {
      this.setupTouchControls(touchControls);
    } else {
      this.setupDesktopLook();
    }
  }

  setCollisionModel(model) {
    this.collisionMeshes = this.fallbackFloor ? [this.fallbackFloor] : [];
    this.groundProbeTimer = 0;
    this.cachedGroundY = null;

    model?.traverse((object) => {
      if (object.isMesh && object.geometry) this.collisionMeshes.push(object);
    });
  }

  findGround(position) {
    const collision = this.config.collision;
    if (!collision.enabled || !this.collisionMeshes.length) return null;

    this.rayOrigin.set(
      position.x,
      position.y + collision.stepHeight,
      position.z,
    );
    this.raycaster.set(this.rayOrigin, this.down);
    this.raycaster.near = 0;
    this.raycaster.far =
      this.targetHeight + collision.stepHeight + collision.maxDrop;

    const intersections = this.raycaster.intersectObjects(this.collisionMeshes, false);
    for (const hit of intersections) {
      if (!hit.face) continue;

      this.normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      this.worldNormal.copy(hit.face.normal).applyMatrix3(this.normalMatrix).normalize();
      if (this.worldNormal.y >= collision.minGroundNormalY) return hit.point.y;
    }

    return null;
  }

  resolveGround(delta, movedHorizontally) {
    const collision = this.config.collision;
    if (!collision.enabled) {
      this.camera.position.y += (this.targetHeight - this.camera.position.y) * 0.16;
      return;
    }

    this.groundProbeTimer -= delta;
    if (this.groundProbeTimer <= 0 || this.cachedGroundY === null) {
      this.cachedGroundY = this.findGround(this.camera.position);
      this.groundProbeTimer = collision.probeInterval;
    }

    let groundY = this.cachedGroundY;
    let desiredY = groundY === null ? null : groundY + this.targetHeight;

    if (
      movedHorizontally &&
      desiredY !== null &&
      desiredY - this.camera.position.y > collision.stepHeight
    ) {
      this.camera.position.x = this.previousPosition.x;
      this.camera.position.z = this.previousPosition.z;
      groundY = this.findGround(this.camera.position);
      this.cachedGroundY = groundY;
      desiredY = groundY === null ? null : groundY + this.targetHeight;
    }

    if (desiredY === null) {
      this.verticalVelocity -= collision.gravity * delta;
      this.camera.position.y += this.verticalVelocity * delta;
      return;
    }

    if (this.camera.position.y <= desiredY) {
      const blend = 1 - Math.exp(-collision.groundSnapSpeed * delta);
      this.camera.position.y = THREE.MathUtils.lerp(
        this.camera.position.y,
        desiredY,
        blend,
      );
      if (Math.abs(this.camera.position.y - desiredY) < 0.005) {
        this.camera.position.y = desiredY;
      }
      this.verticalVelocity = 0;
      return;
    }

    this.verticalVelocity -= collision.gravity * delta;
    this.camera.position.y = Math.max(
      desiredY,
      this.camera.position.y + this.verticalVelocity * delta,
    );
    if (this.camera.position.y === desiredY) this.verticalVelocity = 0;
  }

  rotateCamera(deltaX, deltaY) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y -= deltaX * this.config.lookSpeed;
    this.camera.rotation.x -= deltaY * this.config.lookSpeed;
    this.camera.rotation.x = THREE.MathUtils.clamp(
      this.camera.rotation.x,
      -Math.PI / 2.05,
      Math.PI / 2.05,
    );
  }

  setupDesktopLook() {
    let lookPointer = null;
    let lastLook = { x: 0, y: 0 };
    const stopZoom = () => {
      this.zoomed = false;
      this.canvas.classList.remove('is-zooming');
    };

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 2) {
        event.preventDefault();
        this.zoomed = true;
        this.canvas.classList.add('is-zooming');
        return;
      }
      if (event.button !== 0) return;
      lookPointer = event.pointerId;
      lastLook = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add('is-looking');
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lastLook.x;
      const dy = event.clientY - lastLook.y;
      lastLook = { x: event.clientX, y: event.clientY };
      this.rotateCamera(dx, dy);
    });
    const stopLook = (event) => {
      if (event.pointerId !== lookPointer) return;
      lookPointer = null;
      this.canvas.classList.remove('is-looking');
    };
    this.canvas.addEventListener('pointerup', stopLook);
    this.canvas.addEventListener('pointercancel', (event) => {
      stopLook(event);
      stopZoom();
    });
    window.addEventListener('pointerup', (event) => {
      if (event.button !== 2) return;
      stopZoom();
    });
    window.addEventListener('blur', stopZoom);
  }

  setupTouchControls({ joystick, knob, lookZone }) {
    let joystickPointer = null;
    let joystickOrigin = { x: 0, y: 0 };
    let lookPointer = null;
    let lastLook = { x: 0, y: 0 };

    const updateJoystick = (event) => {
      const radius = joystick.clientWidth * 0.34;
      const dx = event.clientX - joystickOrigin.x;
      const dy = event.clientY - joystickOrigin.y;
      const length = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, radius / length);
      const x = dx * scale;
      const y = dy * scale;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.touchMove.set(x / radius, y / radius);
    };

    joystick.addEventListener('pointerdown', (event) => {
      joystickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      const bounds = joystick.getBoundingClientRect();
      joystickOrigin = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      updateJoystick(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId === joystickPointer) updateJoystick(event);
    });
    const stopJoystick = (event) => {
      if (event.pointerId !== joystickPointer) return;
      joystickPointer = null;
      this.touchMove.set(0, 0);
      knob.style.transform = 'translate(0, 0)';
    };
    joystick.addEventListener('pointerup', stopJoystick);
    joystick.addEventListener('pointercancel', stopJoystick);

    lookZone.addEventListener('pointerdown', (event) => {
      lookPointer = event.pointerId;
      lookZone.setPointerCapture(event.pointerId);
      lastLook = { x: event.clientX, y: event.clientY };
    });
    lookZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lastLook.x;
      const dy = event.clientY - lastLook.y;
      lastLook = { x: event.clientX, y: event.clientY };
      this.rotateCamera(dx, dy);
    });
    const stopLook = (event) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    lookZone.addEventListener('pointerup', stopLook);
    lookZone.addEventListener('pointercancel', stopLook);
  }

  update(delta) {
    const targetFov = this.zoomed ? this.config.zoomFov : this.defaultFov;
    const fovBlend = 1 - Math.exp(-this.config.zoomSpeed * delta);
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, fovBlend);
    if (Math.abs(nextFov - this.camera.fov) > 0.001) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? this.config.runSpeed : this.config.walkSpeed;
    this.direction.set(0, 0, 0);

    if (this.keys.has('KeyW')) this.direction.z -= 1;
    if (this.keys.has('KeyS')) this.direction.z += 1;
    if (this.keys.has('KeyA')) this.direction.x -= 1;
    if (this.keys.has('KeyD')) this.direction.x += 1;

    if (this.mobile) {
      this.direction.x += this.touchMove.x;
      this.direction.z += this.touchMove.y;
    }

    if (this.direction.lengthSq() > 1) this.direction.normalize();

    this.previousPosition.copy(this.camera.position);
    this.controls.moveRight(this.direction.x * speed * delta);
    this.controls.moveForward(-this.direction.z * speed * delta);
    const movedHorizontally =
      this.previousPosition.x !== this.camera.position.x ||
      this.previousPosition.z !== this.camera.position.z;

    if (!this.mobile) {
      const keyboardLook = this.config.keyboardLookSpeed * delta;
      if (this.keys.has('ArrowLeft')) this.camera.rotation.y += keyboardLook;
      if (this.keys.has('ArrowRight')) this.camera.rotation.y -= keyboardLook;
      if (this.keys.has('ArrowUp')) this.camera.rotation.x += keyboardLook;
      if (this.keys.has('ArrowDown')) this.camera.rotation.x -= keyboardLook;
      this.camera.rotation.x = THREE.MathUtils.clamp(
        this.camera.rotation.x,
        -Math.PI / 2.05,
        Math.PI / 2.05,
      );

      if (this.keys.has('KeyE')) this.targetHeight += this.config.verticalSpeed * delta;
      if (this.keys.has('KeyQ')) this.targetHeight -= this.config.verticalSpeed * delta;
      this.targetHeight = THREE.MathUtils.clamp(
        this.targetHeight,
        this.config.minHeight,
        this.config.maxHeight,
      );
    }

    this.resolveGround(delta, movedHorizontally);
  }

  reset() {
    this.targetHeight = this.config.height;
    this.verticalVelocity = 0;
    this.groundProbeTimer = 0;
    this.cachedGroundY = null;
    this.camera.position.copy(this.config.startPosition);
    this.camera.rotation.set(0, 0, 0);
  }
}
