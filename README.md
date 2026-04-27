# Modern Cookie Banner

Framework-agnostic EU cookie banner with a premium first layer, a full preferences modal, consent persistence, and script gating.

This repo is intentionally built to be easy to drop into real websites without needing React, Tailwind, or a complicated build setup.

This project is built to be reused across many websites with the same integration pattern:

1. Load one CSS file
2. Load one JS file
3. Call `initCookieBanner()` with site-specific config
4. Gate optional tags until the matching category is allowed

## Why this shape

The easiest way to reuse a consent component across plain HTML sites, React apps, CMS templates, and static sites is to keep it standalone and self-rendering.

This library:

1. Injects its own banner and modal UI
2. Stores consent with a version and timestamp
3. Reopens preferences from a floating privacy button
4. Supports `Accept all`, `Reject all`, and granular category control
5. Loads blocked scripts only after consent is granted

## Included features

1. Self-rendered banner and preferences modal
2. Necessary, analytics, preferences, and marketing categories by default
3. Cookie storage by default with localStorage mirror
4. Consent versioning for future reprompts
5. Declarative script gating with `data-consent-category`
6. Public runtime API for app integrations
7. Themeable CSS variables
8. Keyboard support and focus trapping in the modal

## Files

```text
dist/cookie-banner.js
dist/cookie-banner.css
demo/index.html
```

## Quick start

If you are a beginner, this is the one thing to understand first:

1. The banner UI by itself is not enough.
2. Optional scripts like analytics or ads must be blocked until consent is granted.
3. In this project, you block them by changing them from normal `<script>` tags into `type="text/plain"` tags with a consent category.

If you skip that part and paste Google Analytics, Meta Pixel, or ad scripts normally, they will load before consent and the banner will not actually protect anything.

### Plain HTML site

This is the easiest copy/paste setup.

```html
<link rel="stylesheet" href="/cookie-banner.css">

<script type="text/plain" data-consent-category="analytics" data-consent-src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX" async></script>

<script type="text/plain" data-consent-category="analytics">
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX');
</script>

<script type="module">
  import { initCookieBanner } from "/cookie-banner.js";

  initCookieBanner({
    policyUrl: "/privacy-policy",
    consentVersion: "2026-04"
  });
</script>
```

### What that example is doing

1. Loads the banner styles
2. Blocks the Google Analytics script so the browser does not run it immediately
3. Marks that script as `analytics`
4. Starts the banner
5. The banner only activates the blocked script after the user allows analytics

### Marketing / ads example

If you use ads, pixels, affiliate tracking, or retargeting tags, use `marketing`.

```html
<script
  type="text/plain"
  data-consent-category="marketing"
  data-consent-src="https://example.com/ads-or-pixel.js"
  async>
</script>
```

What happens:

1. If the user accepts marketing, the script loads
2. If the user rejects marketing, the script never runs

### App integration

```js
import { initCookieBanner } from './cookie-banner.js';
import './cookie-banner.css';

const consent = initCookieBanner({
  policyUrl: '/privacy-policy',
  consentVersion: '2026-04'
});

consent.whenAllowed('analytics', () => {
  console.log('Load analytics SDK here');
});
```

This pattern is useful when your site loads integrations from JavaScript instead of hardcoded script tags.

Example:

```js
consent.whenAllowed('marketing', () => {
  console.log('Load your Meta Pixel, ads SDK, or affiliate script here');
});
```

If `marketing` is rejected, that callback never runs.

## API

### `initCookieBanner(config)`

Creates the UI, restores stored consent if available, and returns an API object.

### Config

```js
initCookieBanner({
  storage: 'cookie',
  consentKey: 'cookie_banner_consent',
  consentVersion: '2026-04',
  cookieMaxAgeDays: 180,
  policyUrl: '/privacy-policy',
  showManageButton: true,
  autoShowModal: false,
  respectDoNotTrack: false,
  text: {
    title: 'Your privacy, your choice',
    description: 'We use cookies to improve the site and measure performance.'
  },
  categories: {
    necessary: {
      label: 'Necessary',
      description: 'Required for core functionality.',
      enabled: true,
      readonly: true
    },
    analytics: {
      label: 'Analytics',
      description: 'Measures traffic and performance.'
    },
    preferences: {
      label: 'Preferences',
      description: 'Remembers settings like language.'
    },
    marketing: {
      label: 'Marketing',
      description: 'Used for advertising and campaign measurement.'
    }
  },
  onConsentReady(api) {
    console.log(api.getConsent());
  },
  onChange(state) {
    console.log(state);
  }
});
```

### Returned API

```js
const consent = initCookieBanner(config);

consent.getConsent();
consent.openPreferences();
consent.resetConsent();
consent.acceptAll();
consent.rejectAll();

const unsubscribe = consent.onChange((state) => {
  console.log(state.categories);
});

const cancel = consent.whenAllowed('analytics', () => {
  console.log('Analytics is now allowed');
});
```

## Script gating

The banner only has real compliance value if optional trackers stay blocked before consent.

This is the most important part of the whole project.

### Bad example

This loads immediately, before consent:

```html
<script src="https://example.com/marketing.js"></script>
```

Do not do that for non-essential scripts.

### Good example

This stays blocked until the matching category is accepted:

```html
<script
  type="text/plain"
  data-consent-category="marketing"
  data-consent-src="https://example.com/marketing.js"
  async>
</script>
```

Use blocked script tags like this:

```html
<script
  type="text/plain"
  data-consent-category="marketing"
  data-consent-src="https://example.com/marketing.js"
  async>
</script>
```

Or inline:

```html
<script type="text/plain" data-consent-category="analytics">
  console.log('Will only run after analytics consent');
</script>
```

When the matching category is allowed, the library converts the blocked tag into a real `<script>` element.

### Simple rule of thumb

1. Site security / login / basket / checkout code: necessary
2. Google Analytics / Clarity / Plausible-style measurement: analytics
3. Language or theme memory: preferences
4. Meta Pixel / ad retargeting / affiliate tracking / ad network tags: marketing

If you are unsure, treat it as non-essential until you confirm what it does.

## Brand colors

Primary and secondary styling is controlled with CSS variables, so matching a site brand is just an override layer.

```css
:root {
  --cb-color-primary: #7c3aed;
  --cb-color-primary-strong: #6d28d9;
  --cb-color-primary-text: #ffffff;

  --cb-color-secondary: rgba(124, 58, 237, 0.08);
  --cb-color-secondary-hover: rgba(124, 58, 237, 0.16);
  --cb-color-secondary-border: rgba(124, 58, 237, 0.28);
  --cb-color-secondary-text: #ede9fe;
}
```

Most sites only need to override those values. The rest of the component will keep the same layout and behavior.

## Multi-site rollout

The easiest rollout model is:

1. Keep this project as the source of truth
2. Host `dist/cookie-banner.js` and `dist/cookie-banner.css` on a versioned static URL or CDN
3. Load those two files in every website
4. Pass a small site-specific config object

That keeps updates simple and avoids rewriting the component per framework.

Example:

```html
<link rel="stylesheet" href="https://cdn.example.com/cookie-banner/0.1.0/cookie-banner.css">

<script type="module">
  import { initCookieBanner } from 'https://cdn.example.com/cookie-banner/0.1.0/cookie-banner.js';

  initCookieBanner({
    policyUrl: '/privacy-policy',
    consentVersion: '2026-04'
  });
</script>
```

## Demo

Open `demo/index.html` in a browser that supports ES modules, or serve the folder locally.

The demo page now also explains the script gating model on-page, including a marketing example.

## Notes

1. This is an engineering implementation, not legal advice.
2. Compliance also depends on how each site classifies and loads its cookies and tags.
3. If categories or wording change materially, bump `consentVersion` so users are reprompted.

## License

This project is licensed under `PolyForm Noncommercial 1.0.0`.

What that means in plain English:

1. You can use the banner on your own websites.
2. You can use it on websites that make money.
3. You can modify it for your own use.
4. You cannot take this banner and sell the banner itself, resell it as a product, or offer it commercially as a paid cookie-banner solution.

For the actual legal terms, see `LICENSE`.
