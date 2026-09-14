// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import IconSprite from './IconSprite'

/**
 * Schritt 1 von Paket 01 (Startseite) braucht drei Symbole im Sprite, bevor
 * Schritt 3 (Home.tsx) sie ueber <Icon name="…"/> verwenden kann:
 * `icon-medal` (home.html:82), `icon-calendar` (home.html:81),
 * `icon-brand-runner` (home.html:137, dort inline statt ueber <use>). Ohne
 * diesen Test wuerde ein fehlendes Symbol erst beim Rendern von Home.tsx
 * auffallen - als leeres <use>, keine Fehlermeldung.
 *
 * `@vitest-environment jsdom` und `cleanup` in afterEach wie in
 * Seitenkopf.render.test.tsx: ohne `globals: true` in vite.config.ts meldet
 * @testing-library/react sein Aufraeumen nicht selbst an.
 */

afterEach(() => {
  cleanup()
})

describe('IconSprite', () => {
  it('enthaelt die drei fuer die Startseite (Paket 01) benoetigten Symbole', () => {
    const { container } = render(<IconSprite />)

    for (const id of ['icon-medal', 'icon-calendar', 'icon-brand-runner']) {
      expect(
        container.querySelector(`symbol#${id}`),
        `Symbol #${id} fehlt im Sprite`,
      ).not.toBeNull()
    }
  })
})
