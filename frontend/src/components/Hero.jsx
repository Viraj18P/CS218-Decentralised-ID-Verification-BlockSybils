import { useState } from 'react'
import { motion } from 'framer-motion'
import styles from './Hero.module.css'

export default function Hero({ onConnect, onRegister }) {
  const [showAccessGranted, setShowAccessGranted] = useState(false)

  const handleConnect = () => {
    setShowAccessGranted(true)
    setTimeout(() => setShowAccessGranted(false), 2500)
    onConnect()
  }

  // Staggered text reveal animation for hero title
  const titleVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  }

  const wordVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1], // cubic-bezier(0.22, 1, 0.36, 1)
      },
    },
  }

  // Floating animation for the icon
  const floatVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: [0, -12, 0],
      transition: {
        opacity: { delay: 0.4, duration: 0.8 },
        scale: { delay: 0.4, duration: 0.8 },
        y: { duration: 4, ease: 'easeInOut', repeat: Infinity },
      },
    },
  }

  // Subtext fade-in
  const subtextVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 1, duration: 0.6 },
    },
  }

  // CTA buttons stagger
  const ctaVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 1.3, duration: 0.6 },
    },
  }

  return (
    <section className={styles.hero}>
      {/* Scanline overlay */}
      <div className={styles.scanlineOverlay} />

      <div className={styles.container}>
        {/* Floating Wallet Icon */}
        <motion.div
          className={styles.floatingIcon}
          variants={floatVariants}
          initial="hidden"
          animate="visible"
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Wallet shape with glowing effect */}
            <g opacity="0.9">
              {/* Outer glow */}
              <rect x="15" y="35" width="90" height="60" rx="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
              
              {/* Main wallet body */}
              <rect x="20" y="40" width="80" height="50" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
              
              {/* Card slot */}
              <rect x="28" y="52" width="50" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              
              {/* Lock indicator */}
              <circle cx="82" cy="65" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M82 62V58M82 72V68" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Center crosshair glow */}
            <g opacity="0.8">
              <circle cx="60" cy="65" r="12" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
            </g>
          </svg>
        </motion.div>

        {/* Eyebrow Badge */}
        <motion.div
          className={styles.eyebrow}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className={styles.badge} />
          Powered by MetaMask
        </motion.div>

        {/* Main Heading - Staggered Reveal */}
        <motion.h1
          className={styles.heroTitle}
          variants={titleVariants}
          initial="hidden"
          animate="visible"
        >
          {['Decentralised', 'Crypto', 'Wallet'].map((word, i) => (
            <motion.span key={i} variants={wordVariants} className={i === 2 ? styles.highlight : ''}>
              {word}{i < 2 ? '\n' : ''}
            </motion.span>
          ))}
        </motion.h1>

        {/* Subheading */}
        <motion.p
          className={styles.heroSub}
          variants={subtextVariants}
          initial="hidden"
          animate="visible"
        >
          Secure, self-sovereign identity on-chain. Register, verify, and manage identities with cryptographic proof — no central authority required.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className={styles.ctaGroup}
          variants={ctaVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.button
            className="btn btn-primary"
            onClick={handleConnect}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>🔐</span> Connect MetaMask
          </motion.button>
          <motion.button
            className="btn btn-secondary"
            onClick={onRegister}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            Register Identity →
          </motion.button>
        </motion.div>

        {/* Stats Grid - Animated on scroll */}
        <motion.div
          className={styles.statsGrid}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          <motion.div className={styles.statBox} whileHover={{ scale: 1.05 }}>
            <div className={styles.statValue}>1,284</div>
            <div className={styles.statLabel}>Identities</div>
          </motion.div>
          <motion.div className={styles.statBox} whileHover={{ scale: 1.05 }}>
            <div className={styles.statValue}>847</div>
            <div className={styles.statLabel}>Verified</div>
          </motion.div>
          <motion.div className={styles.statBox} whileHover={{ scale: 1.05 }}>
            <div className={styles.statValue}>312</div>
            <div className={styles.statLabel}>Pending</div>
          </motion.div>
          <motion.div className={styles.statBox} whileHover={{ scale: 1.05 }}>
            <div className={styles.statValue}>125</div>
            <div className={styles.statLabel}>Revoked</div>
          </motion.div>
        </motion.div>
      </div>

      {/* "ACCESS GRANTED" toast */}
      {showAccessGranted && (
        <motion.div
          className={styles.accessGranted}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className={styles.dot} />
          ACCESS GRANTED
          <span className={styles.dot} />
        </motion.div>
      )}
    </section>
  )
}
