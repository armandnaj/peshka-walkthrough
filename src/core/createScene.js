import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createScene(config, playerConfig, renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.background);
  scene.fog = new THREE.FogExp2(config.background, config.fogDensity);

  if (config.reflections && renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  const camera = new THREE.PerspectiveCamera(
    config.cameraFov,
    window.innerWidth / window.innerHeight,
    config.cameraNear,
    config.cameraFar,
  );
  camera.position.copy(playerConfig.startPosition);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: 0x2c2925,
      roughness: 0.88,
      metalness: 0,
    }),
  );
  floor.name = 'FallbackFloor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  return { scene, camera, floor };
}
