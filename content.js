/**
 * Visual Hashing — Content Script (MV3)
 * 
 * Detects password input fields on web pages and renders a color-bar
 * visual hash of the password as the input's background image.
 * Uses SHA-256 via Web Crypto API (replacing the original's hand-rolled SHA-1).
 * Uses MutationObserver (replacing the original's setInterval polling).
 * Uses 'input' event (replacing the original's keydown + setTimeout hack).
 */

(() => {
  'use strict';

  // ─── Settings (loaded from chrome.storage) ───────────────────────────
  let settings = {
    enabled: true,
    numColorBars: 4,
    personalSalt: '',
    randomize: true
  };

  // Load settings from storage
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        { enabled: true, numColorBars: 4, personalSalt: '', randomize: true },
        (result) => {
          settings = { ...settings, ...result };
          resolve(settings);
        }
      );
    });
  }

  // Listen for settings changes from popup/background
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) {
        settings[key] = newValue;
      }
    }
    // If extension was just disabled, restore all fields
    if (changes.enabled && !changes.enabled.newValue) {
      restoreAllFields();
    }
    // If settings changed and extension is enabled, re-hash all active fields
    if (settings.enabled) {
      refreshAllFields();
    }
  });

  // ─── SHA-256 via Web Crypto API ──────────────────────────────────────
  // crypto.subtle is available in secure contexts (HTTPS) and in Chrome
  // extension content scripts regardless of page protocol.
  async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Visual Hash Rendering ──────────────────────────────────────────
  function randomizeHash(hashHex) {
    // Add a small amount of visual noise (±3 per byte) to make the hash
    // look organic rather than flat solid bars
    const result = [];
    for (let i = 0; i < hashHex.length; i += 2) {
      let byte = parseInt(hashHex.substr(i, 2), 16);
      byte = Math.min(Math.max(byte + Math.floor(Math.random() * 6) - 3, 0), 255);
      result.push(byte.toString(16).padStart(2, '0'));
    }
    return result.join('');
  }

  /**
   * Draws a rounded rectangle path. Uses native roundRect if available,
   * otherwise falls back to manual arc drawing for older Chrome versions.
   */
  function drawRoundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      // Manual fallback
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  }

  function renderHashToDataURL(hashHex, width, height, numBars) {
    // Clamp dimensions to reasonable values
    width = Math.max(width, 20);
    height = Math.max(height, 10);
    numBars = Math.min(numBars, Math.floor(hashHex.length / 6));

    // Use a regular canvas (content scripts have full DOM access)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const displayHash = settings.randomize ? randomizeHash(hashHex) : hashHex;
    const barWidth = width / numBars;
    const borderRadius = Math.min(4, height / 6);

    // Draw rounded clip path
    ctx.beginPath();
    drawRoundRect(ctx, 0, 0, width, height, borderRadius);
    ctx.clip();

    // Draw color bars
    for (let i = 0; i < numBars; i++) {
      const color = '#' + displayHash.substr(i * 6, 6);
      ctx.fillStyle = color;
      ctx.fillRect(i * barWidth, 0, barWidth + 1, height); // +1 avoids sub-pixel gaps
    }

    // Thin separator lines between bars
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numBars; i++) {
      const x = Math.round(i * barWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 1);
      ctx.lineTo(x, height - 1);
      ctx.stroke();
    }

    // Subtle outer border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, borderRadius);
    ctx.stroke();

    return canvas.toDataURL();
  }

  // ─── Password Field Management ──────────────────────────────────────
  const managedFields = new WeakMap(); // element -> { originalBg, originalBgColor, originalBgSize, originalBgRepeat }

  function restoreField(elem) {
    const data = managedFields.get(elem);
    if (data) {
      elem.style.backgroundImage = data.originalBg;
      elem.style.backgroundColor = data.originalBgColor;
      elem.style.backgroundSize = data.originalBgSize;
      elem.style.backgroundRepeat = data.originalBgRepeat;
    }
  }

  function restoreAllFields() {
    document.querySelectorAll('input[type="password"][data-visual-hash]').forEach(elem => {
      restoreField(elem);
    });
  }

  function refreshAllFields() {
    document.querySelectorAll('input[type="password"][data-visual-hash]').forEach(elem => {
      updateVisualHash(elem);
    });
  }

  async function updateVisualHash(elem) {
    if (!settings.enabled) {
      restoreField(elem);
      return;
    }

    if (elem.value === '' || elem !== document.activeElement) {
      restoreField(elem);
      return;
    }

    try {
      const password = elem.value + settings.personalSalt;
      const hashHex = await sha256(password);

      // Double-check element is still focused and has value after async
      if (elem.value === '' || elem !== document.activeElement) {
        restoreField(elem);
        return;
      }

      const width = Math.max(elem.clientWidth, elem.offsetWidth) || 200;
      const height = Math.max(elem.clientHeight, elem.offsetHeight) || 30;

      const dataURL = renderHashToDataURL(hashHex, width, height, settings.numColorBars);
      elem.style.backgroundImage = `url(${dataURL})`;
      elem.style.backgroundSize = 'cover';
      elem.style.backgroundRepeat = 'no-repeat';
    } catch (err) {
      // crypto.subtle may fail on insecure origins in edge cases
      console.warn('[Visual Hashing] Failed to compute hash:', err.message);
    }
  }

  function attachToPasswordField(elem) {
    // Skip if already attached
    if (elem.hasAttribute('data-visual-hash')) return;
    if (elem.type !== 'password') return;

    // Store original styles for restoration
    managedFields.set(elem, {
      originalBg: elem.style.backgroundImage || '',
      originalBgColor: elem.style.backgroundColor || '',
      originalBgSize: elem.style.backgroundSize || '',
      originalBgRepeat: elem.style.backgroundRepeat || ''
    });

    // Mark as managed (fixes original's __visualHash property with a proper data attribute)
    elem.setAttribute('data-visual-hash', 'true');

    // Use 'input' event — fires after value is updated
    // (fixes original's keydown + setTimeout(10ms) hack)
    elem.addEventListener('input', () => updateVisualHash(elem));
    elem.addEventListener('focus', () => updateVisualHash(elem));
    elem.addEventListener('blur', () => restoreField(elem));

    // Handle paste events
    elem.addEventListener('paste', () => {
      requestAnimationFrame(() => updateVisualHash(elem));
    });

    // Handle type attribute changes (some sites toggle password/text visibility)
    const typeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'type') {
          if (elem.type === 'password') {
            updateVisualHash(elem);
          } else {
            restoreField(elem);
          }
        }
      }
    });
    typeObserver.observe(elem, { attributes: true, attributeFilter: ['type'] });

    // If element already has focus and value, update immediately
    if (elem === document.activeElement && elem.value) {
      updateVisualHash(elem);
    }
  }

  // ─── DOM Scanning & Observation ─────────────────────────────────────
  function scanForPasswordFields(root = document) {
    const inputs = root.querySelectorAll('input[type="password"]');
    inputs.forEach(attachToPasswordField);
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          if (node.tagName === 'INPUT' && node.type === 'password') {
            attachToPasswordField(node);
          }

          // Also scan children (e.g., a form container was added)
          if (node.querySelectorAll) {
            const inputs = node.querySelectorAll('input[type="password"]');
            inputs.forEach(attachToPasswordField);
          }
        }

        // Check attribute changes (e.g., input type dynamically changed to password)
        if (mutation.type === 'attributes' && mutation.attributeName === 'type') {
          const target = mutation.target;
          if (target.tagName === 'INPUT' && target.type === 'password') {
            attachToPasswordField(target);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type']
    });

    return observer;
  }

  // ─── Initialization ─────────────────────────────────────────────────
  async function init() {
    await loadSettings();
    if (!settings.enabled) return;

    // Scan existing password fields
    scanForPasswordFields();

    // Watch for new password fields (replaces original's setInterval(4000))
    setupMutationObserver();

    // Lightweight fallback interval for edge cases (iframes, lazy-loaded SPAs)
    // Much less aggressive than original's 4s — 10s is enough as backup
    setInterval(() => {
      if (settings.enabled) {
        scanForPasswordFields();
      }
    }, 10000);
  }

  // Handle both DOMContentLoaded and already-loaded states
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
