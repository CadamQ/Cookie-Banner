const DEFAULT_TEXT = {
  kicker: 'Privacy controls',
  title: 'Your privacy, your choice',
  description:
    'We use cookies to keep the site secure, understand traffic, remember preferences, and improve campaigns. You can accept all, reject all non-essential cookies, or decide category by category.',
  privacyPolicyText: 'Privacy Policy',
  manage: 'Manage preferences',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  modalTitle: 'Privacy preferences',
  modalDescription:
    'Choose which categories you want to allow. Necessary cookies stay on because they are required for core site functionality.',
  saveSelection: 'Save selection',
  close: 'Close',
  alwaysOn: 'Always on',
  manageLabel: 'Privacy settings'
};

const DEFAULT_CATEGORIES = {
  necessary: {
    label: 'Necessary',
    description: 'Required for security, session handling, and core site functionality.',
    enabled: true,
    readonly: true
  },
  analytics: {
    label: 'Analytics',
    description: 'Helps measure traffic and improve the site based on anonymous usage patterns.',
    enabled: false,
    readonly: false
  },
  preferences: {
    label: 'Preferences',
    description: 'Stores choices like language, region, and interface preferences.',
    enabled: false,
    readonly: false
  },
  marketing: {
    label: 'Marketing',
    description: 'Used to personalize ads, measure campaigns, and connect ad platforms.',
    enabled: false,
    readonly: false
  }
};

const DEFAULT_CONFIG = {
  mode: 'opt-in',
  storage: 'cookie',
  consentKey: 'cookie_banner_consent',
  cookieMaxAgeDays: 180,
  consentVersion: '1',
  policyUrl: '/privacy-policy',
  text: DEFAULT_TEXT,
  categories: DEFAULT_CATEGORIES,
  mount: null,
  showManageButton: true,
  autoShowModal: false,
  respectDoNotTrack: false,
  onConsentReady: null,
  onChange: null
};

const instanceRegistry = new WeakMap();

function mergeConfig(input = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    text: { ...DEFAULT_TEXT, ...(input.text || {}) },
    categories: mergeCategories(input.categories || {})
  };
}

function mergeCategories(input) {
  const merged = {};
  const keys = new Set([...Object.keys(DEFAULT_CATEGORIES), ...Object.keys(input)]);

  keys.forEach((key) => {
    merged[key] = {
      ...(DEFAULT_CATEGORIES[key] || {
        label: toTitleCase(key),
        description: '',
        enabled: false,
        readonly: false
      }),
      ...(input[key] || {})
    };
  });

  if (merged.necessary) {
    merged.necessary.enabled = true;
    merged.necessary.readonly = true;
  }

  return merged;
}

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createDefaultConsent(categories, version) {
  const state = {};

  Object.keys(categories).forEach((key) => {
    state[key] = categories[key].readonly ? true : Boolean(categories[key].enabled);
  });

  return {
    version,
    updatedAt: null,
    categories: state
  };
}

function parseStoredValue(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function getCookie(name) {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|; )' + safeName + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, maxAgeDays) {
  const maxAge = Math.floor(maxAgeDays * 24 * 60 * 60);
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function removeCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getStoredConsent(config) {
  const cookieValue = getCookie(config.consentKey);
  const localValue = safeLocalStorageGet(config.consentKey);
  const stored = parseStoredValue(config.storage === 'localStorage' ? localValue : cookieValue || localValue);

  if (!stored || stored.version !== config.consentVersion) {
    return null;
  }

  return stored;
}

function saveStoredConsent(config, consent) {
  const serialized = JSON.stringify(consent);

  if (config.storage === 'localStorage') {
    safeLocalStorageSet(config.consentKey, serialized);
    removeCookie(config.consentKey);
    return;
  }

  setCookie(config.consentKey, serialized, config.cookieMaxAgeDays);
  safeLocalStorageSet(config.consentKey, serialized);
}

function clearStoredConsent(config) {
  removeCookie(config.consentKey);
  safeLocalStorageRemove(config.consentKey);
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    return null;
  }
}

function safeLocalStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    return null;
  }
}

function allowsCategory(consent, category) {
  return Boolean(consent && consent.categories && consent.categories[category]);
}

function createElement(tag, className, attributes = {}) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (key === 'text') {
      element.textContent = value;
      return;
    }

    if (key === 'html') {
      element.innerHTML = value;
      return;
    }

    element.setAttribute(key, value);
  });

  return element;
}

function buildDescription(config) {
  const description = escapeHtml(config.text.description);

  if (!config.policyUrl) {
    return description;
  }

  return `${description} <a href="${escapeAttribute(config.policyUrl)}">${escapeHtml(config.text.privacyPolicyText)}</a>.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function getDoNotTrack() {
  return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
}

function trapFocus(container, event) {
  if (event.key !== 'Tab') {
    return;
  }

  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  if (!focusable.length) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function loadDeferredScripts(consent) {
  const blockedScripts = document.querySelectorAll('script[type="text/plain"][data-consent-category]');

  blockedScripts.forEach((blockedScript) => {
    const category = blockedScript.dataset.consentCategory;

    if (!allowsCategory(consent, category) || blockedScript.dataset.consentLoaded === 'true') {
      return;
    }

    const liveScript = document.createElement('script');
    const src = blockedScript.dataset.consentSrc || blockedScript.getAttribute('src');

    Array.from(blockedScript.attributes).forEach((attribute) => {
      if (
        attribute.name === 'type' ||
        attribute.name === 'data-consent-category' ||
        attribute.name === 'data-consent-src' ||
        attribute.name === 'data-consent-loaded'
      ) {
        return;
      }

      liveScript.setAttribute(attribute.name, attribute.value);
    });

    if (src) {
      liveScript.src = src;
    }

    const inlineCode = blockedScript.textContent.trim();
    if (inlineCode) {
      liveScript.textContent = inlineCode;
    }

    blockedScript.dataset.consentLoaded = 'true';
    blockedScript.parentNode.insertBefore(liveScript, blockedScript.nextSibling);
  });
}

export function initCookieBanner(inputConfig = {}) {
  const config = mergeConfig(inputConfig);
  const mount = config.mount || document.body;

  if (!mount) {
    throw new Error('initCookieBanner requires document.body to exist or a custom mount element.');
  }

  if (instanceRegistry.has(mount)) {
    return instanceRegistry.get(mount);
  }

  const defaultConsent = createDefaultConsent(config.categories, config.consentVersion);
  let consent = getStoredConsent(config) || defaultConsent;
  let hasExplicitConsent = Boolean(consent.updatedAt);
  const changeListeners = new Set();
  const pendingCallbacks = new Map();

  Object.keys(config.categories).forEach((key) => {
    pendingCallbacks.set(key, new Set());
  });

  if (config.respectDoNotTrack && getDoNotTrack() && !hasExplicitConsent) {
    consent = {
      version: config.consentVersion,
      updatedAt: new Date().toISOString(),
      categories: Object.keys(config.categories).reduce((accumulator, key) => {
        accumulator[key] = config.categories[key].readonly;
        return accumulator;
      }, {})
    };
    hasExplicitConsent = true;
    saveStoredConsent(config, consent);
  }

  const root = createElement('div', 'cb-root');
  mount.appendChild(root);

  const bannerWrap = createElement('div', 'cb-banner-wrap');
  const banner = createElement('section', 'cb-banner', {
    role: 'dialog',
    'aria-live': 'polite',
    'aria-label': config.text.title
  });
  const copy = createElement('div', 'cb-copy');
  const kicker = createElement('p', 'cb-kicker', { text: config.text.kicker });
  const title = createElement('h2', 'cb-title', { text: config.text.title });
  const description = createElement('p', 'cb-description', { html: buildDescription(config) });
  const actions = createElement('div', 'cb-actions');
  const rejectButton = createElement('button', 'cb-button cb-button-secondary', {
    type: 'button',
    text: config.text.rejectAll
  });
  const manageButton = createElement('button', 'cb-button cb-button-ghost', {
    type: 'button',
    text: config.text.manage
  });
  const acceptButton = createElement('button', 'cb-button cb-button-primary', {
    type: 'button',
    text: config.text.acceptAll
  });

  copy.append(kicker, title, description);
  actions.append(rejectButton, manageButton, acceptButton);
  banner.append(copy, actions);
  bannerWrap.appendChild(banner);

  const reopenButton = createElement('button', 'cb-manage-button cb-hidden', {
    type: 'button',
    'aria-label': config.text.manageLabel
  });
  reopenButton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l7 4v6c0 5.25-3.44 10.08-7 11-3.56-.92-7-5.75-7-11V6l7-4zm0 5.25a2.75 2.75 0 100 5.5 2.75 2.75 0 000-5.5zm-4 10.2c.84-1.9 2.3-2.95 4-2.95s3.16 1.05 4 2.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' +
    escapeHtml(config.text.manageLabel) +
    '</span>';

  const backdrop = createElement('div', 'cb-backdrop cb-hidden', { role: 'presentation' });
  const modal = createElement('section', 'cb-modal', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'cb-modal-title'
  });
  const modalHeader = createElement('div', 'cb-modal-header');
  const modalHeaderCopy = createElement('div');
  const modalTitle = createElement('h2', 'cb-modal-title', { id: 'cb-modal-title', text: config.text.modalTitle });
  const modalSubtitle = createElement('p', 'cb-modal-subtitle', { text: config.text.modalDescription });
  const closeButton = createElement('button', 'cb-icon-button', {
    type: 'button',
    'aria-label': config.text.close,
    text: '×'
  });
  modalHeaderCopy.append(modalTitle, modalSubtitle);
  modalHeader.append(modalHeaderCopy, closeButton);

  const modalBody = createElement('div', 'cb-modal-body');
  const categoryList = createElement('div', 'cb-category-list');
  const toggleInputs = new Map();

  Object.keys(config.categories).forEach((key) => {
    const category = config.categories[key];
    const card = createElement('div', 'cb-category-card');
    const details = createElement('div');
    const titleRow = createElement('div', 'cb-category-title-row');
    const categoryTitle = createElement('h3', 'cb-category-title', { text: category.label });
    titleRow.appendChild(categoryTitle);

    if (category.readonly) {
      titleRow.appendChild(createElement('span', 'cb-badge', { text: config.text.alwaysOn }));
    }

    const categoryDescription = createElement('p', 'cb-category-description', { text: category.description });
    details.append(titleRow, categoryDescription);

    const switchLabel = createElement('label', 'cb-switch');
    const input = createElement('input', null, {
      type: 'checkbox',
      'data-category': key
    });
    input.checked = allowsCategory(consent, key);
    input.disabled = Boolean(category.readonly);
    const track = createElement('span', 'cb-switch-track', { 'aria-hidden': 'true' });
    switchLabel.append(input, track);
    toggleInputs.set(key, input);

    card.append(details, switchLabel);
    categoryList.appendChild(card);
  });

  modalBody.appendChild(categoryList);
  const modalFooter = createElement('div', 'cb-modal-footer');
  const footerNote = createElement('p', 'cb-modal-subtitle', {
    text: 'You can reopen these settings at any time from the privacy button.'
  });
  const footerActions = createElement('div', 'cb-footer-actions');
  const modalRejectButton = createElement('button', 'cb-button cb-button-secondary', {
    type: 'button',
    text: config.text.rejectAll
  });
  const modalAcceptButton = createElement('button', 'cb-button cb-button-ghost', {
    type: 'button',
    text: config.text.acceptAll
  });
  const saveButton = createElement('button', 'cb-button cb-button-primary', {
    type: 'button',
    text: config.text.saveSelection
  });
  footerActions.append(modalRejectButton, modalAcceptButton, saveButton);
  modalFooter.append(footerNote, footerActions);

  modal.append(modalHeader, modalBody, modalFooter);
  backdrop.appendChild(modal);

  root.append(bannerWrap, reopenButton, backdrop);

  let previousFocus = null;

  function snapshotConsent() {
    return JSON.parse(JSON.stringify(consent));
  }

  function syncToggleUI() {
    toggleInputs.forEach((input, key) => {
      input.checked = allowsCategory(consent, key);
    });
  }

  function refreshVisibility() {
    bannerWrap.classList.toggle('cb-hidden', hasExplicitConsent);
    reopenButton.classList.toggle('cb-hidden', !config.showManageButton || !hasExplicitConsent);
  }

  function emitChange() {
    loadDeferredScripts(consent);

    changeListeners.forEach((listener) => listener(snapshotConsent()));

    if (typeof config.onChange === 'function') {
      config.onChange(snapshotConsent());
    }

    pendingCallbacks.forEach((callbacks, category) => {
      if (!allowsCategory(consent, category)) {
        return;
      }

      callbacks.forEach((callback) => {
        callback(snapshotConsent());
        callbacks.delete(callback);
      });
    });
  }

  function applyConsent(nextCategories) {
    consent = {
      version: config.consentVersion,
      updatedAt: new Date().toISOString(),
      categories: Object.keys(config.categories).reduce((accumulator, key) => {
        accumulator[key] = config.categories[key].readonly ? true : Boolean(nextCategories[key]);
        return accumulator;
      }, {})
    };

    hasExplicitConsent = true;
    saveStoredConsent(config, consent);
    syncToggleUI();
    refreshVisibility();
    closePreferences();
    emitChange();
  }

  function acceptAll() {
    const allAllowed = {};

    Object.keys(config.categories).forEach((key) => {
      allAllowed[key] = true;
    });

    applyConsent(allAllowed);
  }

  function rejectAll() {
    const requiredOnly = {};

    Object.keys(config.categories).forEach((key) => {
      requiredOnly[key] = Boolean(config.categories[key].readonly);
    });

    applyConsent(requiredOnly);
  }

  function saveSelection() {
    const selections = {};
    toggleInputs.forEach((input, key) => {
      selections[key] = input.checked;
    });
    applyConsent(selections);
  }

  function openPreferences() {
    previousFocus = document.activeElement;
    syncToggleUI();
    backdrop.classList.remove('cb-hidden');
    closeButton.focus();
  }

  function closePreferences() {
    backdrop.classList.add('cb-hidden');
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  function resetConsent() {
    consent = createDefaultConsent(config.categories, config.consentVersion);
    hasExplicitConsent = false;
    clearStoredConsent(config);
    syncToggleUI();
    refreshVisibility();
  }

  rejectButton.addEventListener('click', rejectAll);
  acceptButton.addEventListener('click', acceptAll);
  manageButton.addEventListener('click', openPreferences);
  reopenButton.addEventListener('click', openPreferences);
  closeButton.addEventListener('click', closePreferences);
  modalRejectButton.addEventListener('click', rejectAll);
  modalAcceptButton.addEventListener('click', acceptAll);
  saveButton.addEventListener('click', saveSelection);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closePreferences();
    }
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePreferences();
      return;
    }

    trapFocus(modal, event);
  });

  const api = {
    getConsent() {
      return snapshotConsent();
    },
    openPreferences,
    resetConsent,
    acceptAll,
    rejectAll,
    onChange(callback) {
      changeListeners.add(callback);
      return () => changeListeners.delete(callback);
    },
    whenAllowed(category, callback) {
      if (allowsCategory(consent, category)) {
        callback(snapshotConsent());
        return () => undefined;
      }

      if (!pendingCallbacks.has(category)) {
        pendingCallbacks.set(category, new Set());
      }

      pendingCallbacks.get(category).add(callback);
      return () => pendingCallbacks.get(category).delete(callback);
    }
  };

  instanceRegistry.set(mount, api);
  refreshVisibility();
  loadDeferredScripts(consent);

  if (config.autoShowModal && !hasExplicitConsent) {
    openPreferences();
  }

  if (typeof config.onConsentReady === 'function') {
    config.onConsentReady(api);
  }

  return api;
}
