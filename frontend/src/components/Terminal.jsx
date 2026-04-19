import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import styles from './Terminal.module.css'

export default function Terminal() {
  const [displayText, setDisplayText] = useState('')
  const [lineIndex, setLineIndex] = useState(0)

  const terminalLines = [
    '> Initializing CyberVault...',
    '> Loading encryption keys...',
    '> Verifying identity blockchain...',
    '> Authenticating wallet [OK]',
    '> Syncing transaction history...',
    '> All systems operational',
    '',
    '💚 Welcome, anonymous operator.',
    '💚 Type "help" for available commands.',
  ]

  useEffect(() => {
    if (lineIndex >= terminalLines.length) return

    const currentLine = terminalLines[lineIndex]
    let charIndex = 0

    const interval = setInterval(() => {
      if (charIndex < currentLine.length) {
        setDisplayText((prev) => prev + currentLine[charIndex])
        charIndex++
      } else {
        clearInterval(interval)
        setLineIndex(lineIndex + 1)
        setDisplayText((prev) => prev + '\n')
      }
    }, 30)

    return () => clearInterval(interval)
  }, [lineIndex])

  return (
    <section className={styles.terminal}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <h2>Control Terminal</h2>
          <p>Real-time system status and operations</p>
        </motion.div>

        <motion.div
          className={styles.terminalBox}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <div className={styles.titleBar}>
            <div className={styles.buttons}>
              <div className={styles.button} style={{ background: '#ff5f56' }} />
              <div className={styles.button} style={{ background: '#ffbd2e' }} />
              <div className={styles.button} style={{ background: '#27c93f' }} />
            </div>
            <span className={styles.title}>cybervault@terminal</span>
          </div>

          <div className={styles.screen}>
            <pre className={styles.output}>{displayText}</pre>
            {lineIndex < terminalLines.length && (
              <span className={styles.cursor}>▋</span>
            )}
          </div>
        </motion.div>

        {/* Command examples */}
        <motion.div
          className={styles.commands}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <div className={styles.commandItem}>
            <code>&gt; export wallet</code> — Download wallet backup
          </div>
          <div className={styles.commandItem}>
            <code>&gt; verify identity</code> — Initiate verification
          </div>
          <div className={styles.commandItem}>
            <code>&gt; sign transaction</code> — Cryptographic signing
          </div>
        </motion.div>
      </div>
    </section>
  )
}
