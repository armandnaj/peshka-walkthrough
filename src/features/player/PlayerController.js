import * as THREE from 'three';
import { SimpleCollisionLayer } from './SimpleCollisionLayer.js';

export class PlayerController {
  constructor({ camera, canvas, config, mobile, touchControls, fallbackFloor, scene }) {
    this.camera = camera;
    this.canvas = canvas;
    this.config = config;
    this.mobile = mobile;
    this.scene = scene;
    this.keys = new Set();
    this.direction = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.desiredCameraPosition = new THREE.Vector3();
    this.cameraCollisionOrigin = new THREE.Vector3();
    this.cameraCollisionDirection = new THREE.Vector3();
    this.playerPosition = camera.position.clone();
    this.touchMove = new THREE.Vector2();
    this.targetHeight = config.height;
    this.cameraMode = 'first';
    this.lookInversion = {
      first: { ...config.firstPersonInversion },
      third: { ...(config.thirdPerson?.inversion ?? { x: true, y: false }) },
    };
    this.yaw = camera.rotation.y;
    this.pitch = camera.rotation.x;
    this.collisionMeshes = fallbackFloor ? [fallbackFloor] : [];
    this.horizontalCollision = new SimpleCollisionLayer(config.collision.horizontal);
    this.fallbackFloor = fallbackFloor;
    this.raycaster = new THREE.Raycaster();
    this.cameraRaycaster = new THREE.Raycaster();
    this.rayOrigin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.worldNormal = new THREE.Vector3();
    this.normalMatrix = new THREE.Matrix3();
    this.previousPosition = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.grounded = false;
    this.jumpQueued = false;
    this.groundProbeTimer = 0;
    this.cachedGroundY = null;
    this.defaultFov = camera.fov;
    this.zoomed = false;
    this.avatarTime = 0;
    this.avatarMoving = false;
    this.avatarParts = {};
    this.avatar = this.createThirdPersonAvatar();
    this.applyCameraTransform();

    this.onKeyDown = (event) => {
      const controlledKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyE',
        'KeyQ',
        'Space',
      ];
      if (controlledKeys.includes(event.code)) event.preventDefault();
      if (event.code === 'Space' && !event.repeat) this.requestJump();
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
    const blockers = this.horizontalCollision.rebuild(model);
    console.info(`Built simplified horizontal collision layer with ${blockers} blockers.`);
  }

  createThirdPersonAvatar() {
    if (!this.scene) return null;

    const group = new THREE.Group();
    group.name = 'ThirdPersonHumanoid';

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0c28f,
      roughness: 0.72,
      metalness: 0,
    });
    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: 0xd1893e,
      roughness: 0.82,
      metalness: 0,
    });
    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: 0x172247,
      roughness: 0.84,
      metalness: 0,
    });
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x191612,
      roughness: 0.78,
      metalness: 0,
    });
    const faceMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2018,
      roughness: 0.6,
      metalness: 0,
    });

    const addMesh = (mesh, parent = group) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const torso = addMesh(new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.48, 5, 10),
      shirtMaterial,
    ));
    torso.name = 'AvatarTorso';
    torso.position.y = 1.08;
    torso.scale.set(0.95, 1, 0.72);

    const neck = addMesh(new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10),
      skinMaterial,
    ));
    neck.position.y = 1.42;

    const head = addMesh(new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      skinMaterial,
    ));
    head.name = 'AvatarHead';
    head.position.y = 1.62;
    head.scale.set(0.92, 1.04, 0.92);

    const nose = addMesh(new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.06, 8),
      skinMaterial,
    ));
    nose.position.set(0, 1.61, -0.17);
    nose.rotation.x = -Math.PI / 2;

    [-0.055, 0.055].forEach((x) => {
      const eye = addMesh(new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        faceMaterial,
      ));
      eye.position.set(x, 1.66, -0.158);
    });

    const makeLimb = ({ name, x, y, length, radius, material, side, isArm }) => {
      const pivot = new THREE.Group();
      pivot.name = `${name}Pivot`;
      pivot.position.set(x, y, 0);
      group.add(pivot);

      const limb = addMesh(new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, length, 4, 8),
        material,
      ), pivot);
      limb.name = name;
      limb.position.y = -length * 0.5;
      limb.rotation.z = isArm ? side * 0.1 : 0;

      if (isArm) {
        const hand = addMesh(new THREE.Mesh(
          new THREE.SphereGeometry(0.052, 10, 8),
          skinMaterial,
        ), pivot);
        hand.name = `${name}Hand`;
        hand.position.y = -length - 0.03;
      } else {
        const foot = addMesh(new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.07, 0.23),
          shoeMaterial,
        ), pivot);
        foot.name = `${name}Foot`;
        foot.position.set(0, -length - 0.025, -0.045);
      }

      return pivot;
    };

    const leftArm = makeLimb({
      name: 'AvatarLeftArm',
      x: -0.25,
      y: 1.32,
      length: 0.5,
      radius: 0.045,
      material: shirtMaterial,
      side: -1,
      isArm: true,
    });
    const rightArm = makeLimb({
      name: 'AvatarRightArm',
      x: 0.25,
      y: 1.32,
      length: 0.5,
      radius: 0.045,
      material: shirtMaterial,
      side: 1,
      isArm: true,
    });
    const leftLeg = makeLimb({
      name: 'AvatarLeftLeg',
      x: -0.09,
      y: 0.82,
      length: 0.62,
      radius: 0.055,
      material: pantsMaterial,
      side: -1,
      isArm: false,
    });
    const rightLeg = makeLimb({
      name: 'AvatarRightLeg',
      x: 0.09,
      y: 0.82,
      length: 0.62,
      radius: 0.055,
      material: pantsMaterial,
      side: 1,
      isArm: false,
    });

    this.avatarParts = {
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
    };

    group.visible = false;
    this.scene.add(group);
    return group;
  }

  updateAvatar(delta = 0) {
    if (!this.avatar) return;

    this.avatar.visible = this.cameraMode === 'third';
    const movingBlend = this.avatarMoving ? 1 : 0;
    this.avatarTime += delta * (this.avatarMoving ? 7.2 : 2.6);
    const walk = Math.sin(this.avatarTime);
    const counterWalk = Math.sin(this.avatarTime + Math.PI);
    const sway = Math.sin(this.avatarTime * 0.5) * 0.025;
    const bob = Math.abs(walk) * 0.025 * movingBlend;

    this.avatar.position.set(
      this.playerPosition.x,
      this.playerPosition.y - this.targetHeight + bob,
      this.playerPosition.z,
    );
    this.avatar.rotation.set(0, this.yaw + sway * movingBlend, 0, 'YXZ');

    const { torso, head, leftArm, rightArm, leftLeg, rightLeg } = this.avatarParts;
    if (torso) torso.rotation.z = sway * 0.75 * movingBlend;
    if (head) head.rotation.z = -sway * 0.7 * movingBlend;
    if (leftArm) leftArm.rotation.x = counterWalk * 0.45 * movingBlend;
    if (rightArm) rightArm.rotation.x = walk * 0.45 * movingBlend;
    if (leftLeg) leftLeg.rotation.x = walk * 0.38 * movingBlend;
    if (rightLeg) rightLeg.rotation.x = counterWalk * 0.38 * movingBlend;
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    this.zoomed = false;
    this.canvas.classList.toggle('is-third-person', this.cameraMode === 'third');
    this.applyCameraTransform();
    return this.cameraMode;
  }

  toggleCameraMode() {
    return this.setCameraMode(this.cameraMode === 'third' ? 'first' : 'third');
  }

  getCameraMode() {
    return this.cameraMode;
  }

  getInteractionPosition() {
    return this.playerPosition;
  }

  requestJump() {
    this.jumpQueued = true;
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

  findCeiling(position) {
    const collision = this.config.collision;
    if (!collision.enabled || !this.collisionMeshes.length) return null;

    this.rayOrigin.set(position.x, position.y + 0.02, position.z);
    this.raycaster.set(this.rayOrigin, this.up);
    this.raycaster.near = 0;
    this.raycaster.far = collision.ceilingProbeDistance;

    const intersections = this.raycaster.intersectObjects(this.collisionMeshes, false);
    for (const hit of intersections) {
      if (!hit.face || hit.object === this.fallbackFloor) continue;

      this.normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      this.worldNormal.copy(hit.face.normal).applyMatrix3(this.normalMatrix).normalize();
      if (this.worldNormal.y <= -collision.minCeilingNormalY) return hit.point.y;
    }

    return null;
  }

  resolveCeiling() {
    const collision = this.config.collision;
    if (!collision.enabled) return;

    const ceilingY = this.findCeiling(this.playerPosition);
    if (ceilingY === null) return;

    const maxY = ceilingY - collision.headClearance;
    if (this.playerPosition.y > maxY) {
      this.playerPosition.y = maxY;
      this.targetHeight = Math.min(this.targetHeight, Math.max(this.config.minHeight, maxY));
      if (this.verticalVelocity > 0) this.verticalVelocity = 0;
    }
  }

  resolveGround(delta, movedHorizontally) {
    const collision = this.config.collision;
    if (!collision.enabled) {
      this.playerPosition.y += (this.targetHeight - this.playerPosition.y) * 0.16;
      return;
    }

    this.groundProbeTimer -= delta;
    if (this.groundProbeTimer <= 0 || this.cachedGroundY === null) {
      this.cachedGroundY = this.findGround(this.playerPosition);
      this.groundProbeTimer = collision.probeInterval;
    }

    let groundY = this.cachedGroundY;
    let desiredY = groundY === null ? null : groundY + this.targetHeight;

    if (
      movedHorizontally &&
      desiredY !== null &&
      desiredY - this.playerPosition.y > collision.stepHeight
    ) {
      this.playerPosition.x = this.previousPosition.x;
      this.playerPosition.z = this.previousPosition.z;
      groundY = this.findGround(this.playerPosition);
      this.cachedGroundY = groundY;
      desiredY = groundY === null ? null : groundY + this.targetHeight;
    }

    if (desiredY === null) {
      this.verticalVelocity -= collision.gravity * delta;
      this.playerPosition.y += this.verticalVelocity * delta;
      this.grounded = false;
      return;
    }

    if (this.playerPosition.y <= desiredY) {
      const blend = 1 - Math.exp(-collision.groundSnapSpeed * delta);
      this.playerPosition.y = THREE.MathUtils.lerp(
        this.playerPosition.y,
        desiredY,
        blend,
      );
      if (Math.abs(this.playerPosition.y - desiredY) < 0.005) {
        this.playerPosition.y = desiredY;
      }
      this.verticalVelocity = 0;
      this.grounded = true;
      return;
    }

    this.verticalVelocity -= collision.gravity * delta;
    this.playerPosition.y = Math.max(
      desiredY,
      this.playerPosition.y + this.verticalVelocity * delta,
    );
    if (this.playerPosition.y === desiredY) this.verticalVelocity = 0;
    this.grounded = this.playerPosition.y === desiredY;
  }

  moveHorizontally(deltaX, deltaZ) {
    const distance = Math.hypot(deltaX, deltaZ);
    if (!distance) return;

    const maxMoveStep = this.config.collision.horizontal?.maxMoveStep ?? 0.16;
    const steps = Math.max(1, Math.ceil(distance / maxMoveStep));
    const stepX = deltaX / steps;
    const stepZ = deltaZ / steps;
    const footY = this.playerPosition.y - this.targetHeight;
    const capsuleHeight = this.config.collision.horizontal?.capsuleHeight ?? 1.45;
    const capsuleRadius = this.config.collision.horizontal?.capsuleRadius ?? 0.18;

    for (let step = 0; step < steps; step += 1) {
      this.playerPosition.x += stepX;
      this.playerPosition.z += stepZ;
      if (!this.config.collision.enabled || !this.config.collision.horizontal?.enabled) {
        continue;
      }
      this.horizontalCollision.resolveCapsule(
        this.playerPosition,
        footY,
        capsuleHeight,
        capsuleRadius,
      );
    }
  }

  setLookInversion(axis, enabled) {
    if (axis !== 'x' && axis !== 'y') return;
    this.lookInversion[this.cameraMode][axis] = Boolean(enabled);
  }

  getLookInversion() {
    return { ...this.lookInversion[this.cameraMode] };
  }

  applyLookInput(deltaX, deltaY) {
    const inversion = this.getLookInversion();
    const horizontalDirection = inversion.x ? 1 : -1;
    const verticalDirection = inversion.y ? 1 : -1;
    const sensitivity = this.config.lookSpeed;

    this.yaw = THREE.MathUtils.euclideanModulo(
      this.yaw + deltaX * sensitivity * horizontalDirection + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + deltaY * sensitivity * verticalDirection,
      -1.48,
      1.48,
    );
    this.applyCameraTransform();
  }

  applyCameraTransform() {
    this.camera.rotation.order = 'YXZ';
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    if (this.cameraMode === 'third') {
      const third = this.config.thirdPerson ?? {};
      const distance = third.distance ?? 3.2;
      const height = third.height ?? 0.62;
      const targetHeight = third.targetOffset ?? -0.12;
      const minDistance = third.minDistance ?? 0.78;
      const collisionOffset = third.collisionOffset ?? 0.12;
      const nearClipPadding = third.nearClipPadding ?? 0.18;
      const orbitPitch = THREE.MathUtils.clamp(this.pitch, -0.65, 0.72);
      const horizontalDistance = Math.max(1.15, Math.cos(orbitPitch) * distance);
      const verticalOffset = height + Math.sin(orbitPitch) * distance;

      this.lookTarget.copy(this.playerPosition);
      this.lookTarget.y += targetHeight;
      this.desiredCameraPosition.copy(this.playerPosition);
      this.desiredCameraPosition.addScaledVector(this.forward, -horizontalDistance);
      this.desiredCameraPosition.y += verticalOffset;

      this.cameraCollisionOrigin.copy(this.lookTarget);
      this.cameraCollisionDirection
        .copy(this.desiredCameraPosition)
        .sub(this.cameraCollisionOrigin);

      const desiredDistance = this.cameraCollisionDirection.length();
      this.camera.position.copy(this.desiredCameraPosition);
      if (desiredDistance > minDistance && this.collisionMeshes.length) {
        this.cameraCollisionDirection.normalize();
        this.cameraRaycaster.set(this.cameraCollisionOrigin, this.cameraCollisionDirection);
        this.cameraRaycaster.near = nearClipPadding;
        this.cameraRaycaster.far = desiredDistance;

        const hits = this.cameraRaycaster.intersectObjects(this.collisionMeshes, false);
        const hit = hits.find((intersection) => (
          intersection.object !== this.fallbackFloor &&
          intersection.distance > minDistance
        ));

        if (hit) {
          const safeDistance = Math.max(minDistance, hit.distance - collisionOffset);
          this.camera.position
            .copy(this.cameraCollisionOrigin)
            .addScaledVector(this.cameraCollisionDirection, safeDistance);
        }
      }

      this.camera.lookAt(this.lookTarget);
    } else {
      this.camera.position.copy(this.playerPosition);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    this.updateAvatar();
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
      this.applyLookInput(dx, dy);
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
      this.applyLookInput(dx, dy);
    });
    const stopLook = (event) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    lookZone.addEventListener('pointerup', stopLook);
    lookZone.addEventListener('pointercancel', stopLook);
  }

  update(delta) {
    const thirdPersonFov = this.config.thirdPerson?.fov ?? this.defaultFov;
    const targetFov = this.zoomed
      ? this.config.zoomFov
      : this.cameraMode === 'third'
        ? thirdPersonFov
        : this.defaultFov;
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
    this.previousPosition.copy(this.playerPosition);
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.moveHorizontally(
      this.right.x * this.direction.x * speed * delta
        + this.forward.x * -this.direction.z * speed * delta,
      this.right.z * this.direction.x * speed * delta
        + this.forward.z * -this.direction.z * speed * delta,
    );
    const movedHorizontally =
      this.previousPosition.x !== this.playerPosition.x ||
      this.previousPosition.z !== this.playerPosition.z;
    this.avatarMoving = movedHorizontally && this.direction.lengthSq() > 0.0001;

    if (!this.mobile) {
      const keyboardLook = this.config.keyboardLookSpeed * delta;
      const inversion = this.getLookInversion();
      const keyboardHorizontal = inversion.x ? -keyboardLook : keyboardLook;
      const keyboardVertical = inversion.y ? -keyboardLook : keyboardLook;
      if (this.keys.has('ArrowLeft')) this.yaw += keyboardHorizontal;
      if (this.keys.has('ArrowRight')) this.yaw -= keyboardHorizontal;
      if (this.keys.has('ArrowUp')) this.pitch += keyboardVertical;
      if (this.keys.has('ArrowDown')) this.pitch -= keyboardVertical;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch,
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

    if (this.jumpQueued && this.grounded) {
      this.verticalVelocity = this.config.jumpSpeed;
      this.grounded = false;
      this.cachedGroundY = null;
      this.playerPosition.y += 0.02;
    }
    this.jumpQueued = false;

    this.resolveGround(delta, movedHorizontally);
    this.resolveCeiling();
    this.applyCameraTransform();
    this.updateAvatar(delta);
  }

  reset() {
    this.targetHeight = this.config.height;
    this.verticalVelocity = 0;
    this.grounded = false;
    this.jumpQueued = false;
    this.groundProbeTimer = 0;
    this.cachedGroundY = null;
    this.playerPosition.copy(this.config.startPosition);
    this.yaw = 0;
    this.pitch = 0;
    this.applyCameraTransform();
  }
}
