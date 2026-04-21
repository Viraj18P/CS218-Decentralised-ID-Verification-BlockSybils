import { motion } from 'framer-motion'
import styles from './Footer.module.css'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className={styles.section}>
            <h3>CyberVault</h3>
            <p>Decentralised crypto wallet powered by MetaMask.</p>
            <div className={styles.socials}>
              <a href="#" aria-label="Twitter">𝕏</a>
              <a href="#" aria-label="GitHub">◊</a>
              <a href="#" aria-label="Discord">◈</a>
              <a href="#" aria-label="Telegram">✈</a>
            </div>
          </div>

          <div className={styles.section}>
            <h4>Product</h4>
            <ul>
              <li><a href="#connect">Connect Wallet</a></li>
              <li><a href="#register">Register Identity</a></li>
              <li><a href="#verify">Verify Account</a></li>
              <li><a href="#lookup">Lookup Status</a></li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">API Reference</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#">Blog</a></li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          className={styles.bottom}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <p>&copy; {currentYear} CyberVault. All rights reserved.</p>
          <p>Built with 💚 for the decentralised web</p>
        </motion.div>
      </div>
    </footer>
  )
}
