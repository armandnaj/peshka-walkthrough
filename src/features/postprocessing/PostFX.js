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

const IllustrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    strength: { value: 1 },
    grain: { value: 0.006 },
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
    uniform vec2 resolution;
    uniform float strength;
    uniform float grain;
    varying vec2 vUv;

    float hash(vec2 point) {
      return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      float noise = hash(floor(vUv * resolution));
      vec3 grained = clamp(source.rgb + (noise - 0.5) * grain, 0.0, 1.0);
      gl_FragColor = vec4(mix(source.rgb, grained, strength), source.a);
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

    this.illustration = new ShaderPass(IllustrationShader);
    this.illustration.enabled = config.illustration?.enabled ?? false;
    this.illustration.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    this.illustration.uniforms.strength.value = config.illustration?.strength ?? 1;
    this.illustration.uniforms.grain.value = config.illustration?.grain ?? 0.006;
    this.composer.addPass(this.illustration);

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
    this.illustration.uniforms.resolution.value.set(width, height);
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

  setIllustrationStrength(value) {
    this.illustration.uniforms.strength.value = Number(value);
    this.illustration.enabled = Number(value) > 0;
  }

  setGrain(value) {
    this.illustration.uniforms.grain.value = Number(value);
  }

  setIllustrationSettings(settings = {}) {
    if ('grain' in settings) this.setGrain(settings.grain);
    if ('strength' in settings) this.setIllustrationStrength(settings.strength);
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
      illustration: this.illustration.uniforms.strength.value,
      grain: this.illustration.uniforms.grain.value,
    };
  }
}
