import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class PostFX {
  constructor(renderer, scene, camera, config, mobile) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    this.ssao.kernelRadius = config.ssao.kernelRadius;
    this.ssao.minDistance = config.ssao.minDistance;
    this.ssao.maxDistance = config.ssao.maxDistance;
    this.ssao.enabled = config.ssao.enabled && (!mobile || config.ssao.mobileEnabled);
    this.composer.addPass(this.ssao);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold,
    );
    this.bloom.enabled = config.bloom.enabled;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  render() {
    this.composer.render();
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.ssao.setSize(width, height);
  }

  setBloomStrength(value) {
    this.bloom.strength = Number(value);
  }

  setBloomThreshold(value) {
    this.bloom.threshold = Number(value);
  }

  setBloomRadius(value) {
    this.bloom.radius = Number(value);
  }

  setSSAOEnabled(enabled) {
    this.ssao.enabled = enabled;
  }

  setSSAORadius(value) {
    this.ssao.kernelRadius = Number(value);
  }

  setSSAODistance(value) {
    this.ssao.maxDistance = Number(value);
  }

  getSettings() {
    return {
      bloom: this.bloom.strength,
      bloomThreshold: this.bloom.threshold,
      bloomRadius: this.bloom.radius,
      ssao: this.ssao.enabled,
      ssaoRadius: this.ssao.kernelRadius,
      ssaoMaxDistance: this.ssao.maxDistance,
    };
  }
}
