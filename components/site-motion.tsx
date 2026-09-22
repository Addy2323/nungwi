'use client'

import { useEffect } from 'react'

// Content stays visible without JavaScript; only elements entering the viewport animate.
const targets = [
  '.delivery-checker',
  '.shop-promotions > article', '.section-header', '.catalogue-tools',
  '.category-row', '.card-product', '.shop-footer > div',
  '.checkout-panel', '.checkout-title', '.help-page > section',
  '.shop-category-browser',
].join(', ')

export default function SiteMotion() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!('IntersectionObserver' in window) || !Element.prototype.animate) return
    let stop = () => {}

    const start = () => {
      stop()
      if (preference.matches) return
      const seen = new WeakSet<Element>()
      const animations = new Map<Element, Animation>()
      const observer = new IntersectionObserver(entries => {
        let index = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          if (entry.target.contains(document.activeElement)) continue
          const animation = entry.target.animate([
            { opacity: 0, translate: '0 22px' },
            { opacity: 1, translate: '0 0' },
          ], {
            duration: 650,
            delay: Math.min(index++ * 65, 260),
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards',
          })
          animations.set(entry.target, animation)
          animation.onfinish = () => animations.delete(entry.target)
        }
      }, { threshold: 0.08 })

      const register = (root: Element) => {
        const elements = [...root.querySelectorAll(targets)]
        if (root.matches(targets)) elements.unshift(root)
        for (const element of elements) {
          if (seen.has(element)) continue
          seen.add(element)
          observer.observe(element)
        }
      }
      register(document.body)
      const mutations = new MutationObserver(records => {
        for (const record of records) {
          record.addedNodes.forEach(node => {
            if (node instanceof Element) register(node)
          })
          record.removedNodes.forEach(node => {
            if (!(node instanceof Element)) return
            for (const element of [node, ...node.querySelectorAll(targets)]) {
              observer.unobserve(element)
              animations.get(element)?.cancel()
              animations.delete(element)
            }
          })
        }
      })
      mutations.observe(document.body, { childList: true, subtree: true })
      const onFocus = (event: FocusEvent) => {
        for (const [element, animation] of animations) {
          if (event.target instanceof Node && element.contains(event.target)) {
            animation.cancel()
            animations.delete(element)
          }
        }
      }
      document.addEventListener('focusin', onFocus)
      stop = () => {
        observer.disconnect()
        mutations.disconnect()
        animations.forEach(animation => animation.cancel())
        animations.clear()
        document.removeEventListener('focusin', onFocus)
      }
    }
    start()
    preference.addEventListener('change', start)
    return () => {
      stop()
      preference.removeEventListener('change', start)
    }
  }, [])

  return null
}
