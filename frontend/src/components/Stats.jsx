import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useCountUp } from '../hooks/useCountUp'
import { useScrollGlow } from '../hooks/useScrollGlow'
import styles from './Stats.module.css'

export default function Stats() {
  const ref = useRef(null)
  const isInView = useScrollGlow(ref)

  const stats = [
    { label: '30M+', title: 'Active Users', suffix: '' },
    { label: '2.4B+', title: 'Transactions', suffix: '' },
    { label: '99.99%', title: 'Uptime', suffix: '' },
    { label: '150+', title: 'Countries', suffix: '' },
  ]

  return (
    <section ref={ref} className={styles.stats}>
      <div className={styles.container}>
        <motion.div
          className={styles.grid}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className={styles.statItem}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className={styles.value}>
                <CountUpNumber 
                  target={parseInt(stat.label.replace(/[^\d]/g, ''))} 
                  shouldCount={isInView} 
                  suffix={stat.label.includes('+') ? '+' : stat.label.includes('%') ? '%' : ''}
                />
              </div>
              <div className={styles.label}>{stat.title}</div>
              <div className={styles.glow} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function CountUpNumber({ target, shouldCount, suffix }) {
  const count = useCountUp(target, 2000, shouldCount)
  return (
    <>
      <span className={styles.count}>{count.toLocaleString()}</span>
      <span className={styles.suffix}>{suffix}</span>
    </>
  )
}
