import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import styles from './Navbar.module.css'

export default function Navbar({ currentTab, onTabChange, isConnected, walletAddress }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { id: 'connect', label: 'Connect' },
    { id: 'register', label: 'Register' },
    { id: 'verify', label: 'Verify' },
    { id: 'lookup', label: 'Lookup' },
    { id: 'auction', label: 'Auction' },
    { id: 'admin', label: 'Admin' },
  ]

  const truncateAddress = (addr) => {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect Wallet'
  }

  return (
    <motion.nav
      className={`${styles.navbar} ${isScrolled ? styles.scrolled : ''}`}
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🔐</div>
          <span className={styles.logoText}>
            Cyber<span className={styles.accent}>Vault</span>
          </span>
        </div>

        {/* Network Chip */}
        <div className={styles.networkChip}>
          <div className={styles.statusDot} />
          <span>Sepolia Testnet</span>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.navTabs}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navTab} ${currentTab === item.id ? styles.active : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Wallet Button */}
        <motion.button
          className={`${styles.walletBtn} ${isConnected ? styles.connected : ''}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className={styles.walletDot} style={{
            background: isConnected ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            boxShadow: isConnected ? 'var(--glow-green)' : 'none'
          }} />
          <span>{truncateAddress(walletAddress)}</span>
        </motion.button>
      </div>
    </motion.nav>
  )
}
