import * as THREE from 'three';

export function isMobileDevice() {
  const touchDevice =
    navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  return touchDevice || window.innerWidth < 760;
}

export function createRenderer(canvas, config) {
  const mobile = isMobileDevice();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      mobile ? config.mobilePixelRatio : config.desktopPixelRatio,
    ),
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  return { renderer, mobile };
}
