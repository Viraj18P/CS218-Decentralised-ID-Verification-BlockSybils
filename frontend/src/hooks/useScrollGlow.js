import { useState, useEffect } from 'react'

/**
 * Hook to detect when element scrolls into view
 * Triggers animations on scroll
 */
export const useScrollGlow = (elementRef, threshold = 0.15) => {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          // Optionally unobserve to trigger animation only once
          // observer.unobserve(entry.target)
        }
      },
      { threshold }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [threshold])

  return isInView
}
