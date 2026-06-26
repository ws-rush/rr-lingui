import type { Page, Locator } from '@playwright/test'

// Shared locators + assertions for the fixture home page. The fixture renders:
//   [data-testid=greeting]  translated greeting
//   [data-testid=locale]    active locale code
//   [data-testid=dir]       active locale direction
//   [data-testid=switch-en] submit /change-locale with locale=en
//   [data-testid=switch-ar] submit /change-locale with locale=ar
export const greeting = (page: Page): Locator => page.getByTestId('greeting')
export const localeText = (page: Page): Locator => page.getByTestId('locale')
export const dirText = (page: Page): Locator => page.getByTestId('dir')

// Assert the page shows the English locale: greeting text, <html lang/dir>,
// and the [data-testid=locale]/dir markers.
export async function assertEnglish(page: Page) {
  await page.waitForSelector('[data-testid=greeting]')
  const text = await greeting(page).textContent()
  if (text !== 'Hello from lingui-rr') {
    throw new Error(`expected English greeting, got: ${text}`)
  }
  await assertHtmlAttrs(page, 'en', 'ltr')
  await assertMarkers(page, 'en', 'ltr')
}

export async function assertArabic(page: Page) {
  await page.waitForSelector('[data-testid=greeting]')
  const text = await greeting(page).textContent()
  if (text !== 'مرحبا من lingui-rr') {
    throw new Error(`expected Arabic greeting, got: ${text}`)
  }
  await assertHtmlAttrs(page, 'ar', 'rtl')
  await assertMarkers(page, 'ar', 'rtl')
}

export async function assertHtmlAttrs(page: Page, lang: string, dir: string) {
  const htmlLang = await page.locator('html').getAttribute('lang')
  const htmlDir = await page.locator('html').getAttribute('dir')
  if (htmlLang !== lang) throw new Error(`expected <html lang="${lang}">, got "${htmlLang}"`)
  if (htmlDir !== dir) throw new Error(`expected <html dir="${dir}">, got "${htmlDir}"`)
}

export async function assertMarkers(page: Page, locale: string, dir: string) {
  const loc = await localeText(page).textContent()
  const d = await dirText(page).textContent()
  if (loc !== locale) throw new Error(`expected locale marker "${locale}", got "${loc}"`)
  if (d !== dir) throw new Error(`expected dir marker "${dir}", got "${d}"`)
}

// Submit the locale-switch form for the given locale and wait for the
// post-action redirect + root revalidation to settle.
export async function switchTo(page: Page, locale: 'en' | 'ar') {
  await page.getByTestId(`switch-${locale}`).click()
  await page.waitForSelector('[data-testid=greeting]')
}
