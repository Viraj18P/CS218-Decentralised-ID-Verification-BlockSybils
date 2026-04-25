import { motion } from 'framer-motion'

/**
 * @notice Displays MetaMask transaction progress inline.
 * @param {{ txState, txHash, explorerBase }} props
 *   txState     — object from useTxState()
 *   explorerBase — e.g. 'https://sepolia.etherscan.io/tx'
 */
export default function TxStatus({ txState, explorerBase = 'https://sepolia.etherscan.io/tx' }) {
  if (txState.status === 'idle') return null

  const colours = {
    pending:   '#f59e0b',
    mining:    '#3b82f6',
    confirmed: '#22c55e',
    error:     '#ef4444',
  }
  const colour = colours[txState.status] ?? '#6b7280'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop:    '1rem',
        padding:      '0.75rem 1rem',
        borderRadius: '8px',
        border:       `1px solid ${colour}33`,
        background:   `${colour}11`,
        display:      'flex',
        alignItems:   'center',
        gap:          '0.75rem',
        fontSize:     '0.85rem',
      }}
    >
      {/* Spinner for in-flight states */}
      {(txState.status === 'pending' || txState.status === 'mining') && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 14, height: 14, flexShrink: 0,
            borderRadius: '50%',
            border: `2px solid ${colour}44`,
            borderTopColor: colour,
          }}
        />
      )}

      {/* Static icon for terminal states */}
      {txState.status === 'confirmed' && <span style={{ color: colour }}>✓</span>}
      {txState.status === 'error'     && <span style={{ color: colour }}>✗</span>}

      <div>
        <div style={{ color: colour, fontWeight: 600 }}>{txState.message}</div>

        {/* Etherscan link once we have a hash */}
        {txState.txHash && (
          <a
            href={`${explorerBase}/${txState.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colour, opacity: 0.8, fontSize: '0.78rem' }}
          >
            {txState.txHash.slice(0, 10)}…{txState.txHash.slice(-6)} ↗
          </a>
        )}
      </div>
    </motion.div>
  )
}