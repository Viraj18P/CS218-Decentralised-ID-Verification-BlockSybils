import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import styles from './TabPanels.module.css'

export function ConnectPanel({ onConnect, isConnected }) {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Your Secure Gateway</h2>
        <p className={styles.subtitle}>
          Connect your MetaMask wallet to access decentralised identity verification, asset management, and blockchain operations.
        </p>

        <motion.button
          className="btn btn-primary"
          onClick={onConnect}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          style={{ marginTop: '2rem', marginBottom: '1.5rem' }}
        >
          <span>🔐</span> {isConnected ? 'Already Connected' : 'Connect MetaMask'}
        </motion.button>

        <div className={styles.grid}>
          <div className={`${styles.card} card`}>
            <h3>🔒 Self-Sovereign Identity</h3>
            <p>You own your identity. No third party can alter or revoke without your consent — unless governance decides.</p>
          </div>
          <div className={`${styles.card} card`}>
            <h3>⚡ On-chain Proof</h3>
            <p>Every verification is anchored to the blockchain. Cryptographic hashes ensure tamper-proof audit trails.</p>
          </div>
        </div>

        <motion.div
          className={styles.statsGrid}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className={styles.stat}>
            <div className={styles.statValue}>1,284</div>
            <div className={styles.statLabel}>Identities</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>847</div>
            <div className={styles.statLabel}>Verified</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>312</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>125</div>
            <div className={styles.statLabel}>Revoked</div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export function RegisterPanel({ isConnected }) {
  const fileInputRef = useRef(null)
  const [hash, setHash] = useState('Awaiting file…')
  const [formData, setFormData] = useState({ name: '', id: '', country: '' })
  const [txStatus, setTxStatus] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    setHash('0x' + hashHex)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) handleFile(files[0])
  }

  const handleRegister = async () => {
    if (!isConnected) {
      alert('Please connect MetaMask first.')
      return
    }
    setTxStatus('pending')
    await new Promise(r => setTimeout(r, 900))
    setTxStatus('confirmed')
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Register Identity</h2>
        <p className={styles.subtitle}>Upload your document hash and initiate on-chain registration.</p>

        <div className={`${styles.card} card`}>
          <h3>📂 Document Hash</h3>

          <div
            className={styles.dropzone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={styles.dzIcon}>📄</div>
            <div className={styles.dzText}>Drop your document here or click to browse</div>
            <div className={styles.dzSub}>PDF, JPG, PNG — max 10 MB</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.png,.jpeg"
            onChange={(e) => handleFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />

          <div className={styles.hashBox}>{hash}</div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Alice Nakamoto"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className={styles.field}>
              <label>National ID / Passport Number</label>
              <input
                type="text"
                placeholder="AB 1234567"
                value={formData.id}
                onChange={(e) => setFormData({...formData, id: e.target.value})}
              />
            </div>
            <div className={styles.field}>
              <label>Issuing Country</label>
              <input
                type="text"
                placeholder="United Kingdom"
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
              />
            </div>

            <motion.button
              className={`btn btn-primary ${styles.fullWidth}`}
              onClick={handleRegister}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              🔐 Sign & Register via MetaMask
            </motion.button>
          </div>

          {txStatus && (
            <motion.div
              className={styles.txStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.txRing + ' ' + (txStatus === 'pending' ? styles.pending : styles.confirmed)} />
              <div>
                <div className={styles.txText}>
                  {txStatus === 'pending' ? 'Broadcasting transaction...' : 'Transaction confirmed!'}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className={styles.gdpr}>
          <strong>Privacy Notice:</strong> Only a cryptographic hash of your document is submitted on-chain. Your raw document never leaves your device.
        </div>
      </div>
    </motion.div>
  )
}

export function VerifyPanel({ isConnected }) {
  const [addr, setAddr] = useState('')
  const [notes, setNotes] = useState('')
  const [txStatus, setTxStatus] = useState(null)

  const handleAction = async (action) => {
    if (!isConnected) {
      alert('Connect wallet first.')
      return
    }
    setTxStatus('pending')
    await new Promise(r => setTimeout(r, 1600))
    setTxStatus('confirmed')
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>KYC Verification</h2>
        <p className={styles.subtitle}>Authority panel to approve or revoke registered identities.</p>

        <div className={`${styles.card} card`}>
          <h3>✅ Pre-flight Checks</h3>

          <div className={styles.checks}>
            <div className={styles.check + ' ' + styles.pass}>
              <span>✓</span> Wallet connected & authority role confirmed
            </div>
            <div className={styles.check + ' ' + styles.pass}>
              <span>✓</span> Identity hash exists on-chain
            </div>
            <div className={styles.check + ' ' + styles.unknown}>
              <span>○</span> Document cross-check pending
            </div>
            <div className={styles.check + ' ' + styles.unknown}>
              <span>○</span> Sanctions screening not run
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label>Wallet Address to Verify</label>
              <input
                type="text"
                placeholder="0x…"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Reviewer Notes (off-chain)</label>
              <input
                type="text"
                placeholder="Document cross-checked, match confirmed"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className={styles.buttonGroup}>
              <motion.button
                className="btn btn-primary"
                onClick={() => handleAction('approve')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                ✓ Approve & Verify
              </motion.button>
              <motion.button
                className="btn btn-danger"
                onClick={() => handleAction('revoke')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                ✗ Revoke Identity
              </motion.button>
            </div>
          </div>

          {txStatus && (
            <motion.div
              className={styles.txStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.txRing + ' ' + (txStatus === 'pending' ? styles.pending : styles.confirmed)} />
              <div>
                <div className={styles.txText}>
                  {txStatus === 'pending' ? 'Broadcasting transaction...' : 'Transaction confirmed!'}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function LookupPanel() {
  const [addr, setAddr] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  const DEMO_STATUS = {
    '0xabc': { type: 'verified', icon: '✅', title: 'VERIFIED', detail: 'On-chain since block 4,821,029.' },
    '0x123': { type: 'pending', icon: '⏳', title: 'PENDING', detail: 'Awaiting authority review.' },
    '0xdead': { type: 'revoked', icon: '🚫', title: 'REVOKED', detail: 'Authority revocation at block 4,910,441.' },
  }

  const handleLookup = () => {
    if (!addr) {
      alert('Enter an address.')
      return
    }
    const key = Object.keys(DEMO_STATUS).find(k => addr.toLowerCase().startsWith(k))
    const res = key ? DEMO_STATUS[key] : { type: 'none', icon: '❓', title: 'NOT REGISTERED', detail: 'No record found.' }
    setResult(res)
    setHistory([addr.slice(0, 10) + '…', ...history].slice(0, 5))
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Identity Lookup</h2>
        <p className={styles.subtitle}>Query the verification status of any wallet address.</p>

        <div className={`${styles.card} card`}>
          <h3>🔍 Query Chain</h3>

          <div className={styles.field}>
            <label>Wallet Address</label>
            <input
              type="text"
              placeholder="0x742d35Cc6634C0532925a3b8D4C9C2F3b…"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
            />
          </div>
          <motion.button
            className={`btn btn-secondary ${styles.fullWidth}`}
            onClick={handleLookup}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Query Status
          </motion.button>

          {result && (
            <motion.div
              className={`${styles.resultBox} ${styles[result.type]}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className={styles.resultIcon}>{result.icon}</div>
              <div className={styles.resultTitle}>{result.title}</div>
              <div className={styles.resultDetail}>{result.detail}</div>
            </motion.div>
          )}
        </div>

        {history.length > 0 && (
          <div className={`${styles.card} card`}>
            <h3>Recent Lookups</h3>
            <div className={styles.historyList}>
              {history.map((h, i) => (
                <div key={i}>{h}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function AuctionPanel({ isConnected }) {
  const [bidAmount, setBidAmount] = useState('')
  const [txStatus, setTxStatus] = useState(null)
  const [endTime] = useState(Date.now() + 4 * 3600000)

  const getRemainingTime = () => {
    const rem = endTime - Date.now()
    if (rem <= 0) return 'ENDED'
    const h = Math.floor(rem / 3600000)
    const m = Math.floor((rem % 3600000) / 60000)
    const s = Math.floor((rem % 60000) / 1000)
    return `${h}h ${m}m ${s}s`
  }

  const handleBid = async () => {
    if (!isConnected) {
      alert('Connect wallet first.')
      return
    }
    if (!bidAmount || parseFloat(bidAmount) < 0.43) {
      alert('Minimum bid is 0.43 ETH.')
      return
    }
    setTxStatus('pending')
    await new Promise(r => setTimeout(r, 1500))
    setTxStatus('confirmed')
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Identity Auctions</h2>
        <p className={styles.subtitle}>Bid on verified identity slots when demand is high.</p>

        <div className={styles.bidBoard}>
          <div className={styles.bidStat}>
            <div className={styles.bidLabel}>Current Bid</div>
            <div className={styles.bidValue}>0.42 ETH</div>
          </div>
          <div className={styles.bidStat}>
            <div className={styles.bidLabel}>Ends In</div>
            <div className={styles.bidValue}>{getRemainingTime()}</div>
          </div>
          <div className={styles.bidStat}>
            <div className={styles.bidLabel}>Bidders</div>
            <div className={styles.bidValue}>17</div>
          </div>
        </div>

        <div className={`${styles.card} card`}>
          <h3>⬡ Place Bid</h3>

          <div className={styles.field}>
            <label>Bid Amount (ETH)</label>
            <input
              type="number"
              step="0.01"
              min="0.43"
              placeholder="0.43"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
          </div>

          <motion.button
            className={`btn btn-primary ${styles.fullWidth}`}
            onClick={handleBid}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            🔐 Sign & Place Bid
          </motion.button>

          {txStatus && (
            <motion.div
              className={styles.txStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.txRing + ' ' + (txStatus === 'pending' ? styles.pending : styles.confirmed)} />
              <div>
                <div className={styles.txText}>
                  {txStatus === 'pending' ? 'Submitting bid...' : 'Bid placed!'}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function AdminPanel({ isConnected, isOwner }) {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Admin Panel</h2>
        <p className={styles.subtitle}>Contract owner functions. Restricted access.</p>

        {!isOwner ? (
          <div className={styles.lockBox}>
            <div className={styles.lockIcon}>🔐</div>
            <div className={styles.lockTitle}>ACCESS RESTRICTED</div>
            <p>Connect with the contract owner's wallet to unlock admin functions.</p>
          </div>
        ) : (
          <div className={styles.adminGrid}>
            <div className={`${styles.card} card`}>
              <h3>⚙️ Grant Authority</h3>
              <div className={styles.field}>
                <label>Wallet Address</label>
                <input type="text" placeholder="0x…" />
              </div>
              <button className="btn btn-secondary" style={{ width: '100%' }}>
                Grant Authority
              </button>
            </div>
            <div className={`${styles.card} card`}>
              <h3>🚫 Revoke Authority</h3>
              <div className={styles.field}>
                <label>Wallet Address</label>
                <input type="text" placeholder="0x…" />
              </div>
              <button className="btn btn-danger" style={{ width: '100%' }}>
                Revoke Authority
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
