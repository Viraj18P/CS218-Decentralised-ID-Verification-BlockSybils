import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useTilt } from '../hooks/useTilt'
import styles from './Features.module.css'

export default function Features() {
  const card1Ref = useRef(null)
  const card2Ref = useRef(null)
  const card3Ref = useRef(null)

  useTilt(card1Ref, 8)
  useTilt(card2Ref, 8)
  useTilt(card3Ref, 8)

  const features = [
    {
      icon: '🔒',
      title: 'Self-Sovereign',
      description: 'You own your identity. No third party can alter or revoke without your consent — unless governance decides.',
      color: 'var(--accent-primary)',
    },
    {
      icon: '⚡',
      title: 'On-chain Proof',
      description: 'Every verification is anchored to the blockchain. Cryptographic hashes ensure tamper-proof audit trails.',
      color: 'var(--accent-secondary)',
    },
    {
      icon: '🛡️',
      title: 'Military-Grade Security',
      description: 'Advanced encryption protocols and multi-sig authorization for maximum protection of your digital assets.',
      color: 'var(--accent-warning)',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <h2>Core Features</h2>
          <p>Why CyberVault stands out from traditional crypto wallets</p>
        </motion.div>

        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {features.map((feature, index) => {
            const refs = [card1Ref, card2Ref, card3Ref]
            return (
              <motion.div
                key={index}
                ref={refs[index]}
                className={styles.featureCard}
                variants={cardVariants}
                whileHover={{ scale: 1.02 }}
              >
                <div className={styles.iconContainer} style={{ '--card-color': feature.color }}>
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className={styles.cardGlow} style={{ '--card-color': feature.color }} />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
