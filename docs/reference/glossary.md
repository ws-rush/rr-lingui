# Glossary of i18n Terms

This glossary defines standard internationalization (i18n) and React Router concepts used throughout the `lingui-rr` documentation.

---

### BCP-47
A standardized format for language tags (e.g., `en`, `en-US`, `ar-EG`). `lingui-rr` supports BCP-47 language tags and automatically handles **regional fallback**: if a user requests `en-US` but your app only configures `en`, it automatically resolves to `en`.

### Default Locale
The primary language the application renders if no language preference is detected or if a URL-Prefix app receives an unprefixed root path.

### Detector
A pluggable utility that attempts to read the user's preferred language. Common detection targets include HTTP headers (`Accept-Language`), cookies, browser-level configuration (`navigator.languages`), or storage keys.

### Framework Mode
The unified full-stack architecture introduced in React Router v8 (previously Remix). It manages server/client routing, data loading (`loaders`), actions (`actions`), and request lifecycle filters (`middleware`) inside a single compile target.

### Isomorphic Cookies
Cookies that are accessible in both browser and server runtime environments. In `lingui-rr`, client cookie detectors and persistence adapters are isomorphic: they read/write `document.cookie` when executing in the browser, but will read the request headers and output `Set-Cookie` if executed server-side (like during SSR actions).

### Persistence
The mechanism by which a user's language selection is saved for future visits. Common persistence drivers write to cookies, session stores, or `localStorage`.

### Revalidation
React Router's process of re-executing all active loaders (including the root layout loader) to refresh page state after an action form submits. In Context mode, custom revalidation rules are necessary to force new dictionary fetching when the language changes but the URL remains static.

### Serialization
The process of translating JavaScript runtime data structures into a string format (JSON) suitable for network transit. React Router requires loader data to be JSON-serializable. Because compiled Lingui catalogs contain runtime structures, `lingui-rr` provides safe loader wrappers that serialize cleanly without needing unsafe code-casting assertions.
