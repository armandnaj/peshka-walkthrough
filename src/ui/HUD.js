export class HUD {
  constructor({ mobile }) {
    this.mobile = mobile;
    this.status = document.querySelector('#status');
    this.progress = document.querySelector('#loading-progress');
    this.progressBar = document.querySelector('#loading-progress span');
    this.settings = document.querySelector('#settings');
    this.modelInput = document.querySelector('#model-input');
    this.dropOverlay = document.querySelector('#model-drop-overlay');

    document.body.classList.toggle('is-mobile', mobile);
  }

  bind(actions) {
    document.querySelector('#camera-button').addEventListener('click', actions.toggleCameraMode);
    document.querySelector('#fullscreen-button').addEventListener('click', actions.fullscreen);
    document.querySelector('#mobile-camera-button').addEventListener('click', actions.toggleCameraMode);
    document.querySelector('#mobile-fullscreen-button').addEventListener('click', actions.fullscreen);
    document.querySelector('#mobile-jump-button').addEventListener('click', actions.jump);
    document.querySelector('#model-button').addEventListener('click', () => {
      this.modelInput.value = '';
      this.modelInput.click();
    });
    this.modelInput.addEventListener('change', () => {
      const [file] = this.modelInput.files;
      if (file) actions.replaceModel(file);
    });
    const toggleSettings = () => {
      this.settings.toggleAttribute('hidden');
    };
    document.querySelector('#settings-button').addEventListener('click', toggleSettings);
    document.querySelector('#mobile-settings-button').addEventListener('click', toggleSettings);
    document.querySelector('#settings-close').addEventListener('click', () => {
      this.settings.hidden = true;
    });

    this.bindRange('exposure-control', actions.setExposure, (value) => value.toFixed(2));
    this.bindRange('ambient-control', actions.setAmbient, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('sun-control', actions.setSun, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('practical-control', actions.setPractical, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('temperature-control', actions.setTemperature, (value) => `${Math.round(value)} K`);
    this.bindRange('fog-control', actions.setFog, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('bloom-control', actions.setBloom, (value) => value.toFixed(2));
    this.bindRange('bloom-threshold-control', actions.setBloomThreshold, (value) => value.toFixed(2));
    this.bindRange('model-color-control', actions.setModelColorBrightness, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('ssao-radius-control', actions.setSSAORadius, (value) => Math.round(value));

    document.querySelector('#ssao-control').addEventListener('change', (event) => actions.setSSAO(event.target.checked));
    document.querySelector('#shadows-control').addEventListener('change', (event) => actions.setShadows(event.target.checked));
    document.querySelector('#invert-look-x-control').addEventListener('change', (event) => actions.setLookInvertX(event.target.checked));
    document.querySelector('#invert-look-y-control').addEventListener('change', (event) => actions.setLookInvertY(event.target.checked));
    document.querySelector('#quality-control').addEventListener('change', (event) => actions.setQuality(event.target.value));
    document.querySelector('#reset-visuals').addEventListener('click', actions.resetVisuals);
    this.bindModelDrop(actions.replaceModel);
  }

  bindRange(id, action, format) {
    const input = document.querySelector(`#${id}`);
    const output = document.querySelector(`output[for="${id}"]`);
    input.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      output.textContent = format(value);
      action(value);
    });
  }

  bindModelDrop(replaceModel) {
    let dragDepth = 0;
    window.addEventListener('dragenter', (event) => {
      event.preventDefault();
      dragDepth += 1;
      this.dropOverlay.hidden = false;
    });
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('dragleave', (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) this.dropOverlay.hidden = true;
    });
    window.addEventListener('drop', (event) => {
      event.preventDefault();
      dragDepth = 0;
      this.dropOverlay.hidden = true;
      const [file] = event.dataTransfer.files;
      if (file) replaceModel(file);
    });
  }

  getTouchControls() {
    return {
      joystick: document.querySelector('#joystick'),
      knob: document.querySelector('#joystick-knob'),
      lookZone: document.querySelector('#look-zone'),
    };
  }

  setStatus(message) {
    this.status.textContent = message;
  }

  setLoading(percent, label = 'Loading model') {
    this.progress.hidden = false;
    this.progressBar.style.width = `${percent}%`;
    this.setStatus(`${label} ${percent}%`);
  }

  finishLoading(message) {
    this.progress.hidden = true;
    this.setStatus(message);
  }

  setCameraMode(mode) {
    const thirdPerson = mode === 'third';
    const button = document.querySelector('#camera-button');
    const mobileButton = document.querySelector('#mobile-camera-button');
    button.classList.toggle('is-active', thirdPerson);
    button.setAttribute('aria-pressed', String(thirdPerson));
    document.querySelector('#camera-label').textContent = thirdPerson ? 'Third' : 'First';
    mobileButton.classList.toggle('is-active', thirdPerson);
    mobileButton.setAttribute('aria-pressed', String(thirdPerson));
    document.querySelector('#mobile-camera-label').textContent = thirdPerson ? 'Third' : 'First';
  }

  setLookInversion({ x, y }) {
    document.querySelector('#invert-look-x-control').checked = Boolean(x);
    document.querySelector('#invert-look-y-control').checked = Boolean(y);
  }

  setVisualSettings(values) {
    const ranges = {
      'exposure-control': [values.exposure, (value) => value.toFixed(2)],
      'ambient-control': [values.ambient, (value) => `${Math.round(value * 100)}%`],
      'sun-control': [values.sun, (value) => `${Math.round(value * 100)}%`],
      'practical-control': [values.practical, (value) => `${Math.round(value * 100)}%`],
      'temperature-control': [values.temperature, (value) => `${Math.round(value)} K`],
      'fog-control': [values.fog, (value) => `${Math.round(value * 100)}%`],
      'bloom-control': [values.bloom, (value) => value.toFixed(2)],
      'bloom-threshold-control': [values.bloomThreshold, (value) => value.toFixed(2)],
      'model-color-control': [values.modelColorBrightness, (value) => `${Math.round(value * 100)}%`],
      'ssao-radius-control': [values.ssaoRadius, (value) => Math.round(value)],
    };
    Object.entries(ranges).forEach(([id, [value, format]]) => {
      const input = document.querySelector(`#${id}`);
      input.value = value;
      document.querySelector(`output[for="${id}"]`).textContent = format(Number(value));
    });
    document.querySelector('#ssao-control').checked = values.ssao;
    document.querySelector('#shadows-control').checked = values.shadows;
    document.querySelector('#quality-control').value = String(values.quality);
  }
}
