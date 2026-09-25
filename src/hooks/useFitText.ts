import { useLayoutEffect, type RefObject } from 'react'

interface FitTextOptions {
  /** Smallest allowed size as a fraction of the CSS font size. */
  minScale?: number
  /** Extra pixels to leave unused inside the container. */
  padding?: number
}

/**
 * Shrinks text by lowering `font-size` so content stays on one line inside
 * `containerRef`. Prefers the stylesheet size when it already fits, so desktop
 * layouts are unchanged. Re-runs on resize and text mutations (live tickers).
 */
export function useFitText(
  containerRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  options: FitTextOptions = {},
) {
  const minScale = options.minScale ?? 0.32
  const padding = options.padding ?? 0

  useLayoutEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    let frame = 0
    let baseSize = 0
    let lastKey = ''

    const readBaseSize = () => {
      text.style.fontSize = ''
      baseSize = parseFloat(getComputedStyle(text).fontSize) || 16
    }

    const apply = () => {
      frame = 0

      if (!baseSize) readBaseSize()

      const available = container.clientWidth - padding
      if (available <= 0) {
        lastKey = ''
        return
      }

      // Tabular nums keep width stable for same-length tickers; only refit on
      // length or container changes so live balances do not thrash layout.
      const key = `${available.toFixed(1)}:${(text.textContent ?? '').length}:${baseSize}`
      if (key === lastKey) return
      lastKey = key

      text.style.fontSize = `${baseSize}px`
      const needed = text.scrollWidth
      if (needed <= 0) return

      if (needed <= available) {
        text.style.fontSize = ''
        return
      }

      let lo = baseSize * minScale
      let hi = baseSize
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2
        text.style.fontSize = `${mid}px`
        if (text.scrollWidth <= available) lo = mid
        else hi = mid
      }
      text.style.fontSize = `${lo}px`
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(apply)
    }

    const onResize = () => {
      baseSize = 0
      lastKey = ''
      schedule()
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(text, {
      characterData: true,
      childList: true,
      subtree: true,
    })

    schedule()

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      text.style.fontSize = ''
    }
  }, [containerRef, textRef, minScale, padding])
}
