/**
 * Visual Hashing — Service Worker (MV3 Background)
 *
 * Manages extension lifecycle, default settings, and badge state.
 */

// Default settings
const DEFAULTS = {
  enabled: true,
  numColorBars: 4,
  personalSalt: '',
  randomize: true
};

// Initialize default settings on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set(DEFAULTS);
    console.log('[Visual Hashing] Extension installed with default settings.');
  } else if (details.reason === 'update') {
    // Merge new defaults with existing settings
    chrome.storage.local.get(DEFAULTS, (existing) => {
      chrome.storage.local.set({ ...DEFAULTS, ...existing });
    });
    console.log(`[Visual Hashing] Extension updated to v${chrome.runtime.getManifest().version}`);
  }
});

// Update badge to show enabled/disabled state
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#888888' });
  }
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateBadge(changes.enabled.newValue);
  }
});

// Set initial badge state
chrome.storage.local.get({ enabled: true }, (result) => {
  updateBadge(result.enabled);
});
