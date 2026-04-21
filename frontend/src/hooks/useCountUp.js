import { useState, useEffect, useRef } from 'react'

/**
 * Hook to animate numbers counting up from 0 to target
 * Used for stats sections with scroll-triggered animation
 */
export const useCountUp = (targetValue, duration = 2000, shouldCount = true) => {
  const [count, setCount] = useState(0)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (!shouldCount || hasStarted.current) return

    hasStarted.current = true
    const startTime = Date.now()
    let animationFrame

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(easedProgress * targetValue))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [shouldCount, targetValue, duration])

  return count
}
