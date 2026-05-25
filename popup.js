/**
 * Visual Hashing — Popup Script
 *
 * Manages the extension popup UI: settings persistence, live preview,
 * and interaction with chrome.storage.
 */

(() => {
  'use strict';

  // ─── DOM Elements ─────────────────────────────────────────────────
  const toggleEnabled = document.getElementById('toggle-enabled');
  const toggleRandomize = document.getElementById('toggle-randomize');
  const barSelector = document.getElementById('bar-selector');
  const saltInput = document.getElementById('salt-input');
  const saltClear = document.getElementById('salt-clear');
  const previewInput = document.getElementById('preview-input');
  const previewBar = document.getElementById('preview-bar');
  const popupContainer = document.querySelector('.popup-container');

  // ─── Settings State ───────────────────────────────────────────────
  let settings = {
    enabled: true,
    numColorBars: 4,
    personalSalt: '',
    randomize: true
  };

  // ─── SHA-256 ──────────────────────────────────────────────────────
  async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Preview Rendering ────────────────────────────────────────────
  function randomizeHash(hashHex) {
    const chars = hashHex.split('');
    const result = [];
    for (let i = 0; i < chars.length; i += 2) {
      let byte = parseInt(chars[i] + chars[i + 1], 16);
      byte = Math.min(Math.max(byte + Math.floor(Math.random() * 6) - 3, 0), 255);
      result.push(byte.toString(16).padStart(2, '0'));
    }
    return result.join('');
  }

  async function updatePreview() {
    const password = previewInput.value;
    const numBars = settings.numColorBars;

    if (!password) {
      // Show default placeholder colors
      const placeholderColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      renderPreviewBars(placeholderColors.slice(0, numBars));
      return;
    }

    const hashHex = await sha256(password + settings.personalSalt);
    const displayHash = settings.randomize ? randomizeHash(hashHex) : hashHex;

    const colors = [];
    for (let i = 0; i < numBars; i++) {
      colors.push('#' + displayHash.substr(i * 6, 6));
    }
    renderPreviewBars(colors);
  }

  function renderPreviewBars(colors) {
    previewBar.innerHTML = '';
    colors.forEach((color, i) => {
      const band = document.createElement('div');
      band.className = 'preview-band';
      band.style.background = color;
      // Animate entry
      band.style.animation = `fadeIn 0.25s ease ${i * 0.05}s backwards`;
      previewBar.appendChild(band);
    });
  }

  // ─── Settings Management ──────────────────────────────────────────
  function saveSettings() {
    chrome.storage.local.set(settings);
  }

  function updateDisabledState() {
    if (settings.enabled) {
      popupContainer.classList.remove('disabled');
    } else {
      popupContainer.classList.add('disabled');
    }
  }

  function updateBarSelectorUI() {
    barSelector.querySelectorAll('.bar-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.value) === settings.numColorBars);
    });
  }

  // ─── Event Handlers ───────────────────────────────────────────────
  toggleEnabled.addEventListener('change', () => {
    settings.enabled = toggleEnabled.checked;
    saveSettings();
    updateDisabledState();
  });

  toggleRandomize.addEventListener('change', () => {
    settings.randomize = toggleRandomize.checked;
    saveSettings();
    updatePreview();
  });

  barSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.bar-btn');
    if (!btn) return;
    settings.numColorBars = parseInt(btn.dataset.value);
    saveSettings();
    updateBarSelectorUI();
    updatePreview();
  });

  saltInput.addEventListener('input', () => {
    settings.personalSalt = saltInput.value;
    saveSettings();
    updatePreview();
  });

  saltClear.addEventListener('click', () => {
    saltInput.value = '';
    settings.personalSalt = '';
    saveSettings();
    updatePreview();
    saltInput.focus();
  });

  // Preview input — debounced update
  let previewTimer;
  previewInput.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 50);
  });

  // ─── Initialization ───────────────────────────────────────────────
  chrome.storage.local.get(
    { enabled: true, numColorBars: 4, personalSalt: '', randomize: true },
    (result) => {
      settings = { ...settings, ...result };

      // Apply to UI
      toggleEnabled.checked = settings.enabled;
      toggleRandomize.checked = settings.randomize;
      saltInput.value = settings.personalSalt;
      updateBarSelectorUI();
      updateDisabledState();
      updatePreview();
    }
  );
})();
