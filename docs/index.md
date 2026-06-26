---
layout: home

hero:
  name: "lingui-rr"
  text: "React Router v8 integration for Lingui"
  tagline: "Isomorphic BCP-47 routing, cookie and header locale detection, and type-safe integration for React Router framework mode."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: API Reference
      link: /reference/api
    - theme: alt
      text: GitHub
      link: https://github.com/ws-rush/lingui-rr

features:
  - icon: 🌐
    title: "URL-Prefix Routing"
    details: "Handle locale-prefixed URLs (e.g. /en/about) seamlessly, with support for hiding the default locale prefix."
  - icon: ⚙️
    title: "Context Mode"
    details: "Keep clean, un-prefixed URLs and manage the active locale via cookies, headers, or localStorage."
  - icon: 🔄
    title: "Full SSR & SPA Support"
    details: "Distinct, optimized paths for SSR (server: true) and client-only SPA (server: false) architectures."
  - icon: ⚡
    title: "Zero-Cast React Integration"
    details: "State serialization prevents React Router type widening, avoiding messy \"as LinguiState\" assertions."
  - icon: 🛡️
    title: "Built-in Redirection"
    details: "Automatic validation of locale prefixes with regional fallbacks (e.g. en-US -> en) and unlocalized asset exclusion."
  - icon: 📦
    title: "Highly Configurable"
    details: "Pluggable detector and persistence pipelines, support for standard sessions, and customizable cookies."
---
