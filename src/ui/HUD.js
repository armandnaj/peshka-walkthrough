export class HUD {
  constructor({ mobile }) {
    this.mobile = mobile;
    this.root = document.querySelector('#hud');
    this.status = document.querySelector('#status');
    this.progress = document.querySelector('#loading-progress');
    this.progressBar = document.querySelector('#loading-progress span');
    this.prompt = document.querySelector('#interaction-prompt');
    this.settings = document.querySelector('#settings');
    this.modelInput = document.querySelector('#model-input');
    this.dropOverlay = document.querySelector('#model-drop-overlay');
    this.shareReady = false;

    document.body.classList.toggle('is-mobile', mobile);
    document.querySelector('#ssao-control').checked = !mobile;
  }

  bind(actions) {
    document.querySelector('#mode-button').addEventListener('click', actions.toggleMode);
    document.querySelector('#screenshot-button').addEventListener('click', actions.screenshot);
    document.querySelector('#fullscreen-button').addEventListener('click', actions.fullscreen);
    document.querySelector('#model-button').addEventListener('click', () => {
      document.exitPointerLock?.();
      this.modelInput.value = '';
      this.modelInput.click();
    });
    this.modelInput.addEventListener('change', () => {
      const [file] = this.modelInput.files;
      if (file) actions.replaceModel(file);
    });
    document.querySelector('#share-button').addEventListener('click', () => {
      this.setShareReady(!this.shareReady);
    });
    document.querySelector('#settings-button').addEventListener('click', () => {
      this.settings.toggleAttribute('hidden');
      document.exitPointerLock?.();
    });
    document.querySelector('#exposure-control').addEventListener('input', (event) => {
      actions.setExposure(event.target.value);
    });
    document.querySelector('#bloom-control').addEventListener('input', (event) => {
      actions.setBloom(event.target.value);
    });
    document.querySelector('#ssao-control').addEventListener('change', (event) => {
      actions.setSSAO(event.target.checked);
    });
    document.querySelector('#door-button').addEventListener('click', actions.interact);
    this.bindModelDrop(actions.replaceModel);
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

  setMode(label) {
    document.querySelector('#mode-label').textContent = label;
  }

  showInteraction(visible, isOpen = false) {
    const doorButton = document.querySelector('#door-button');
    this.prompt.hidden = !visible;
    doorButton.hidden = !visible;
    this.prompt.classList.toggle('is-visible', visible);
    this.prompt.textContent = isOpen ? 'F · Close door' : 'F · Open door';
    doorButton.classList.toggle('is-visible', visible);
  }

  setShareReady(enabled) {
    this.shareReady = enabled;
    document.body.classList.toggle('share-ready', enabled);
    if (!enabled) this.setStatus('Presentation controls restored');
  }
}
