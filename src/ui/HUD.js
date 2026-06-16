export class HUD {
  constructor({ mobile }) {
    this.mobile = mobile;
    this.root = document.querySelector('#hud');
    this.status = document.querySelector('#status');
    this.progress = document.querySelector('#loading-progress');
    this.progressBar = document.querySelector('#loading-progress span');
    this.prompt = document.querySelector('#interaction-prompt');
    this.settings = document.querySelector('#settings');
    this.audit = document.querySelector('#performance-audit');
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
    document.querySelector('#audit-button').addEventListener('click', () => {
      this.audit.toggleAttribute('hidden');
      document.exitPointerLock?.();
      if (!this.audit.hidden) actions.refreshAudit();
    });
    document.querySelector('#settings-close').addEventListener('click', () => {
      this.settings.hidden = true;
    });
    document.querySelector('#audit-close').addEventListener('click', () => {
      this.audit.hidden = true;
    });
    this.bindRange('exposure-control', actions.setExposure, (value) => Number(value).toFixed(2));
    this.bindRange('ambient-control', actions.setAmbient, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('sun-control', actions.setSun, (value) => `${Math.round(value * 100)}%`);
    this.bindRange(
      'practical-control',
      actions.setPractical,
      (value) => `${Math.round(value * 100)}%`,
    );
    this.bindRange(
      'temperature-control',
      actions.setTemperature,
      (value) => `${Math.round(value)} K`,
    );
    this.bindRange('fog-control', actions.setFog, (value) => `${Math.round(value * 100)}%`);
    this.bindRange('bloom-control', actions.setBloom, (value) => Number(value).toFixed(2));
    this.bindRange(
      'bloom-threshold-control',
      actions.setBloomThreshold,
      (value) => Number(value).toFixed(2),
    );
    this.bindRange(
      'vignette-control',
      actions.setVignette,
      (value) => Number(value).toFixed(2),
    );
    this.bindRange('ssao-radius-control', actions.setSSAORadius, (value) => Math.round(value));
    document.querySelector('#ssao-control').addEventListener('change', (event) => {
      actions.setSSAO(event.target.checked);
    });
    document.querySelector('#shadows-control').addEventListener('change', (event) => {
      actions.setShadows(event.target.checked);
    });
    document.querySelector('#quality-control').addEventListener('change', (event) => {
      actions.setQuality(event.target.value);
    });
    document.querySelectorAll('[data-visual-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        actions.applyVisualPreset(button.dataset.visualPreset);
      });
    });
    document.querySelector('#reset-visuals').addEventListener('click', actions.resetVisuals);
    document.querySelector('#audit-refresh').addEventListener('click', actions.refreshAudit);
    document.querySelector('#door-button').addEventListener('click', actions.interact);
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

  setMode(label) {
    document.querySelector('#mode-label').textContent = label;
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
      'vignette-control': [values.vignette, (value) => value.toFixed(2)],
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
    this.setActiveVisualPreset(values.visualPreset);
  }

  setActiveVisualPreset(name) {
    document.querySelectorAll('[data-visual-preset]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.visualPreset === name);
    });
  }

  setPerformanceAudit(audit) {
    const summary = document.querySelector('#audit-summary');
    const values = [
      ['Draw calls', this.formatNumber(audit.drawCalls)],
      ['Triangles', this.formatNumber(audit.triangles)],
      ['Texture memory', `${audit.textureMemoryMiB.toFixed(1)} MiB`],
      ['Materials', this.formatNumber(audit.materials)],
      ['Meshes', this.formatNumber(audit.meshes)],
    ];

    summary.innerHTML = values
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join('');

    this.renderAuditList(
      '#audit-suggestions',
      audit.suggestions.map((item) => ({
        title: item.label,
        detail: item.detail,
      })),
    );
    this.renderAuditList(
      '#audit-merge-targets',
      audit.mergeTargets.length
        ? audit.mergeTargets.map((item) => ({
            title: item.material,
            detail: `${this.formatNumber(item.meshes)} meshes · ${this.formatNumber(item.triangles)} triangles`,
          }))
        : [{ title: 'No obvious merge candidates', detail: 'The current material groups are already compact.' }],
    );
  }

  renderAuditList(selector, items) {
    document.querySelector(selector).innerHTML = items
      .map(
        (item) =>
          `<li><strong>${this.escapeHTML(item.title)}</strong>${this.escapeHTML(item.detail)}</li>`,
      )
      .join('');
  }

  formatNumber(value) {
    return Math.round(value).toLocaleString('en-US');
  }

  escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[character];
    });
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
