import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'lingui-rr',
  description: 'React Router framework-mode integration for Lingui',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Reference', link: '/reference/configuration' },
      { text: 'GitHub', link: 'https://github.com/ws-rush/lingui-rr' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation & Setup', link: '/guide/installation' }
          ]
        },
        {
          text: 'Interactive Lessons',
          items: [
            { text: 'Lesson 1: SSR with URL-Prefix', link: '/guide/lesson-1-ssr-url-prefix' },
            { text: 'Lesson 2: Client with URL-Prefix', link: '/guide/lesson-2-client-url-prefix' },
            { text: 'Lesson 3: SSR with Context Mode', link: '/guide/lesson-3-ssr-context-mode' },
            { text: 'Lesson 4: Client with Context Mode', link: '/guide/lesson-4-client-context-mode' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Configuration Reference', link: '/reference/configuration' },
            { text: 'API Reference', link: '/reference/api' },
            { text: 'Glossary of i18n Terms', link: '/reference/glossary' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ws-rush/lingui-rr' }
    ],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present ws-rush'
    }
  }
})
