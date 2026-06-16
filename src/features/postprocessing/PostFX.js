import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1 },
    darkness: { value: 1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      color.rgb = mix(color.rgb, color.rgb * (1.0 - dot(uv, uv)), darkness);
      gl_FragColor = color;
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, config, mobile) {
    this.config = config;
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

    this.vignette = new ShaderPass(VignetteShader);
    this.vignette.enabled = config.vignette.enabled;
    this.vignette.uniforms.darkness.value = config.vignette.darkness;
    this.vignette.uniforms.offset.value = config.vignette.offset;
    this.composer.addPass(this.vignette);
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

  setVignetteDarkness(value) {
    this.vignette.uniforms.darkness.value = Number(value);
    this.vignette.enabled = Number(value) > 0;
  }

  resetImageSettings({ bloom }) {
    this.setBloomStrength(bloom);
    this.setBloomThreshold(this.config.bloom.threshold);
    this.setSSAORadius(this.config.ssao.kernelRadius);
    this.setVignetteDarkness(this.config.vignette.darkness);
  }

  getSettings() {
    return {
      bloom: this.bloom.strength,
      bloomThreshold: this.bloom.threshold,
      bloomRadius: this.bloom.radius,
      ssao: this.ssao.enabled,
      ssaoRadius: this.ssao.kernelRadius,
      ssaoMaxDistance: this.ssao.maxDistance,
      vignette: this.vignette.uniforms.darkness.value,
    };
  }
}
