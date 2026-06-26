import { renderToString } from 'react-dom/server'
import { useLingui } from '@lingui/react'
import { describe, expect, it } from 'vitest'
import {
  LinguiRouterProvider,
  getHtmlAttrs,
  getLocaleDir,
  getLocaleLabel,
  useLinguiRouter,
  type LinguiState,
} from '../src/index'

const state: LinguiState = {
  locale: 'ar',
  localeMeta: { code: 'ar', label: 'العربية', dir: 'rtl' },
  locales: [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'العربية', dir: 'rtl' },
  ],
  messages: {},
  htmlAttrs: { lang: 'ar', dir: 'rtl' },
}

describe('LinguiRouterProvider and hooks', () => {
  it('exposes read-only locale state and metadata through useLinguiRouter', () => {
    function Probe() {
      const lingui = useLinguiRouter()
      return (
        <output>
          {lingui.locale}|{lingui.localeMeta.label}|{lingui.localeMeta.dir}|{lingui.locales.length}|{lingui.htmlAttrs.lang}
        </output>
      )
    }

    const html = renderToString(
      <LinguiRouterProvider state={state}>
        <Probe />
      </LinguiRouterProvider>,
    )

    expect(html.replaceAll(/<!-- -->/g, '')).toContain('ar|العربية|rtl|2|ar')
  })

  it('throws a clear error when hook is used outside provider', () => {
    function Probe() {
      useLinguiRouter()
      return null
    }

    expect(() => renderToString(<Probe />)).toThrow(/LinguiRouterProvider/)
  })
})

describe('locale metadata helpers', () => {
  it('returns html attrs, labels, and direction without mutating document', () => {
    expect(getHtmlAttrs('ar', state.locales)).toEqual({ lang: 'ar', dir: 'rtl' })
    expect(getLocaleDir('ar', state.locales)).toBe('rtl')
    expect(getLocaleLabel('ar', state.locales)).toBe('العربية')
  })
})

describe('provider wires real Lingui catalogs for translation', () => {
  const messages = {
    'app.title': 'lingui-rr',
    'nav.about': 'About',
  }
  const baseState: LinguiState = {
    ...state,
    messages,
  }

  it('renders a message translated through the provider\'s i18n instance', () => {
    function Probe() {
      const { _ } = useLingui()
      return (
        <output>
          {_('app.title')}|{_('nav.about')}
        </output>
      )
    }

    const html = renderToString(
      <LinguiRouterProvider state={baseState}>
        <Probe />
      </LinguiRouterProvider>,
    )

    expect(html.replaceAll(/<!-- -->/g, '')).toContain('lingui-rr|About')
  })

  it('reloads the i18n instance when the locale/messages change', () => {
    let lastRender = ''
    function Probe() {
      const { _ } = useLingui()
      lastRender = _('app.title')
      return null
    }

    // First render with English messages.
    renderToString(
      <LinguiRouterProvider state={{ ...baseState, locale: 'en' }}>
        <Probe />
      </LinguiRouterProvider>,
    )
    expect(lastRender).toBe('lingui-rr')

    // Second render with Arabic messages swapped in.
    renderToString(
      <LinguiRouterProvider
        state={{
          ...baseState,
          locale: 'ar',
          messages: { ...messages, 'app.title': 'كرم' },
        }}
      >
        <Probe />
      </LinguiRouterProvider>,
    )
    expect(lastRender).toBe('كرم')
  })
})
