import { useEffect, useRef } from 'react'

/**
 * Hook for 3D tilt effect based on mouse position
 * Used for feature cards and interactive elements
 */
export const useTilt = (elementRef, intensity = 10) => {
  const handleMouseMove = (e) => {
    if (!elementRef.current) return

    const rect = elementRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Calculate angles
    const rotateY = ((mouseX - centerX) / centerX) * intensity
    const rotateX = -((mouseY - centerY) / centerY) * intensity

    elementRef.current.style.transform = `
      perspective(1000px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.02)
    `
  }

  const handleMouseLeave = () => {
    if (elementRef.current) {
      elementRef.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)'
    }
  }

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [intensity])
}
