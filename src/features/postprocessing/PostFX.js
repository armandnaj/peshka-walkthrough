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
    strength: { value: 0.7 },
    levels: { value: 5 },
    grain: { value: 0.06 },
    edgeStrength: { value: 0.35 },
    paperWarmth: { value: 0.15 },
    colorSimplify: { value: 0.12 },
    toonStrength: { value: 0.18 },
    shadowLift: { value: 0.12 },
    saturation: { value: 1 },
    inkColor: { value: new THREE.Color(0x1c1715) },
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
    uniform float levels;
    uniform float grain;
    uniform float edgeStrength;
    uniform float paperWarmth;
    uniform float colorSimplify;
    uniform float toonStrength;
    uniform float shadowLift;
    uniform float saturation;
    uniform vec3 inkColor;
    varying vec2 vUv;

    float posterLuminance(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    float hash(vec2 point) {
      return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 texel = 1.0 / resolution;
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;

      vec3 simplified = floor(color * levels + 0.5) / levels;
      vec3 poster = mix(color, simplified, colorSimplify);

      float sourceTone = posterLuminance(poster);
      float toonTone = floor(sourceTone * 4.0 + 0.5) / 4.0;
      float safeTone = max(sourceTone, 0.025);
      poster *= mix(1.0, toonTone / safeTone, toonStrength);
      poster = clamp(poster, 0.0, 1.0);

      poster = mix(poster, poster * vec3(1.045, 1.0, 0.91), paperWarmth);
      float posterTone = posterLuminance(poster);
      poster = mix(
        poster,
        max(poster, vec3(0.12, 0.105, 0.085)),
        shadowLift * (1.0 - smoothstep(0.12, 0.58, posterTone))
      );
      float saturatedTone = posterLuminance(poster);
      poster = mix(vec3(saturatedTone), poster, saturation);

      float center = posterLuminance(color);
      float right = posterLuminance(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
      float left = posterLuminance(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
      float top = posterLuminance(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
      float bottom = posterLuminance(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);
      float edge = abs(center - right) + abs(center - left) + abs(center - top) + abs(center - bottom);
      edge = smoothstep(0.08, 0.22, edge) * edgeStrength;

      float paper = hash(floor(vUv * resolution * 0.55));
      float fine = hash(vUv * resolution + paper);
      poster += (paper - 0.5) * grain;
      poster += (fine - 0.5) * grain * 0.35;

      vec3 illustrated = mix(poster, inkColor, edge);
      gl_FragColor = vec4(mix(color, illustrated, strength), source.a);
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
    this.illustration.uniforms.strength.value = config.illustration?.strength ?? 0.7;
    this.illustration.uniforms.levels.value = config.illustration?.levels ?? 5;
    this.illustration.uniforms.grain.value = config.illustration?.grain ?? 0.06;
    this.illustration.uniforms.edgeStrength.value = config.illustration?.edgeStrength ?? 0.35;
    this.illustration.uniforms.paperWarmth.value = config.illustration?.paperWarmth ?? 0.15;
    this.illustration.uniforms.inkColor.value.set(config.illustration?.inkColor ?? 0x1c1715);
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

  setIllustrationSettings(settings = {}) {
    if ('levels' in settings) this.illustration.uniforms.levels.value = Number(settings.levels);
    if ('grain' in settings) this.illustration.uniforms.grain.value = Number(settings.grain);
    if ('edgeStrength' in settings) {
      this.illustration.uniforms.edgeStrength.value = Number(settings.edgeStrength);
    }
    if ('paperWarmth' in settings) {
      this.illustration.uniforms.paperWarmth.value = Number(settings.paperWarmth);
    }
    if ('colorSimplify' in settings) {
      this.illustration.uniforms.colorSimplify.value = Number(settings.colorSimplify);
    }
    if ('toonStrength' in settings) {
      this.illustration.uniforms.toonStrength.value = Number(settings.toonStrength);
    }
    if ('shadowLift' in settings) {
      this.illustration.uniforms.shadowLift.value = Number(settings.shadowLift);
    }
    if ('saturation' in settings) {
      this.illustration.uniforms.saturation.value = Number(settings.saturation);
    }
    if ('inkColor' in settings) this.illustration.uniforms.inkColor.value.set(settings.inkColor);
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
    };
  }
}
