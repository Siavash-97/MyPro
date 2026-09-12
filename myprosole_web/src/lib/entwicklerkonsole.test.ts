import { afterEach, describe, expect, it, vi } from 'vitest'
import { entwicklerWarnung } from './entwicklerkonsole'

/**
 * Die Zusicherung ist die Abwesenheit: In der ausgelieferten Fassung
 * erreicht fremder Text die Konsole NICHT. Der Fall "beim Entwickeln kommt
 * er an" steht daneben, damit die Funktion nicht einfach schweigt.
 */
describe('entwicklerWarnung', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('schweigt in der ausgelieferten Fassung', () => {
    vi.stubEnv('DEV', false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    entwicklerWarnung('permission denied for table runs')
    expect(warn).not.toHaveBeenCalled()
  })

  it('spricht beim Entwickeln, wortgleich', () => {
    vi.stubEnv('DEV', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    entwicklerWarnung('permission denied for table runs')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('permission denied for table runs')
  })
})
