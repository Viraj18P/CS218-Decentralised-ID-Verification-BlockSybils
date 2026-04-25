/**
 * @file ZKPanel.jsx
 * @notice Real in-browser Groth16 ZK age proof with full proof inspector.
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './TabPanels.module.css'
import { useZKProver } from '../hooks/useZKProver'

function FieldError({ msg }) {
  if (!msg) return null
  return <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{msg}</p>
}

function NotConnected() {
  return (
    <div className={styles.lockBox}>
      <div className={styles.lockIcon}>🔌</div>
      <div className={styles.lockTitle}>WALLET NOT CONNECTED</div>
      <p>Connect your MetaMask wallet from the Connect tab first.</p>
    </div>
  )
}

function trunc(s, head = 10, tail = 8) {
  const str = String(s)
  if (str.length <= head + tail + 3) return str
  return str.slice(0, head) + '...' + str.slice(-tail)
}

function DataRow({ label, value, tag, tagColor = '#38bdf8', secret = false }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '0.5rem',
      alignItems: 'start',
      padding: '0.55rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.73rem', opacity: 0.55 }}>{label}</span>
          {tag && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em',
              padding: '0.1rem 0.4rem', borderRadius: 3,
              background: tagColor + '22', color: tagColor, border: `1px solid ${tagColor}44`,
            }}>
              {tag}
            </span>
          )}
        </div>
        {secret ? (
          <span style={{ fontSize: '0.78rem', opacity: 0.35, fontStyle: 'italic' }}>
            [hidden — never left your browser]
          </span>
        ) : (
          <span style={{
            fontFamily: 'monospace', fontSize: '0.74rem',
            wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {trunc(String(value))}
          </span>
        )}
      </div>
      {!secret && (
        <button
          onClick={handleCopy}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, padding: '0.2rem 0.5rem',
            color: copied ? '#4ade80' : 'rgba(255,255,255,0.4)',
            fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap', marginTop: '1.2rem',
          }}
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      )}
    </div>
  )
}

export function ZKPanel({ isConnected }) {
  const [birthdate,  setBirthdate]  = useState('')
  const [minAge,     setMinAge]     = useState('18')
  const [fieldError, setFieldError] = useState(null)
  const [status,     setStatus]     = useState('idle')
  const [progress,   setProgress]   = useState('')
  const [result,     setResult]     = useState(null)
  const [errorMsg,   setErrorMsg]   = useState(null)

  const { generateAndVerifyAgeProof } = useZKProver()

  const _randomSalt = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleProve = useCallback(async () => {
    setFieldError(null)
    setResult(null)
    setErrorMsg(null)

    if (!birthdate) return setFieldError('Please enter your birthdate.')
    if (!minAge || isNaN(Number(minAge)) || Number(minAge) < 1)
      return setFieldError('Enter a valid minimum age.')
    if (!isConnected) return setFieldError('Connect wallet first.')

    setStatus('proving')
    try {
      const res = await generateAndVerifyAgeProof(
        birthdate, Number(minAge), _randomSalt(),
        (msg) => setProgress(msg)
      )
      setResult(res)
      setStatus('done')
    } catch (err) {
      let msg = (err && (err.message || err.shortMessage || err.toString())) || '';
      let msgLower = msg.toLowerCase();
      if (msgLower.startsWith('error:')) {
        msg = msg.slice(6).trim();
        msgLower = msg.toLowerCase();
      }
      if (
        msgLower.includes('assert failed') ||
        msgLower.includes('ageverifier_74') ||
        msgLower.includes('line: 41')
      ) {
        setErrorMsg('User is below 18 years old.');
      } else {
        setErrorMsg(msg || 'Proof generation failed.');
      }
      setStatus('error');
    }
  }, [birthdate, minAge, isConnected, generateAndVerifyAgeProof])

  const handleReset = () => {
    setStatus('idle'); setResult(null)
    setErrorMsg(null); setProgress('')
  }

  const epochToDate = (days) => new Date(days * 86400000).toISOString().split('T')[0]

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>ZK Age Proof</h2>
        <p className={styles.subtitle}>
          Prove you meet a minimum age requirement without revealing your birthdate.
          A real Groth16 proof is generated in your browser using snarkjs + AgeVerifier circuit.
        </p>

        {!isConnected ? <NotConnected /> : (
          <>
            {/* What is sent on-chain explainer */}
            {status === 'idle' && (
              <div className={`${styles.card} card`} style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>🧠 What actually goes on-chain?</h3>
                <div style={{ fontSize: '0.83rem', lineHeight: 1.75, opacity: 0.88 }}>
                  <p style={{ margin: '0 0 0.6rem' }}>
                    Your birthdate is a <strong>private input</strong> to the circuit — fed into WebAssembly
                    and never transmitted anywhere. The blockchain only sees three things:
                  </p>
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {[
                      ['📤 π_a, π_b, π_c', 'Three BN254 elliptic curve points that form the Groth16 proof. They encode the fact that you ran the circuit correctly, but reveal nothing about your private inputs.'],
                      ['📤 current_days', "Today's date expressed as days since 1 Jan 1970. Fully public — the contract already knows today's date from block.timestamp."],
                      ['📤 min_age_days', 'The threshold (e.g. 6570 for 18 years). Fully public — you are choosing to prove this specific claim.'],
                      ['📤 Poseidon commitment', 'A one-way hash of (birthdate_days, random_salt). Proves your birthdate is bound to this proof, without revealing what it is. Impossible to reverse without knowing the 256-bit random salt.'],
                    ].map(([title, desc]) => (
                      <div key={title} style={{
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(56,189,248,0.06)',
                        borderRadius: 6, border: '1px solid rgba(56,189,248,0.15)',
                      }}>
                        <strong style={{ color: '#38bdf8', fontSize: '0.8rem' }}>{title}</strong>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: '0.78rem' }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className={`${styles.card} card`}>
              <h3>🔐 Private Inputs — never leave your browser</h3>
              <div className={styles.form}>
                <div className={styles.field}>
                  <label>Your Birthdate</label>
                  <input
                    type="date"
                    value={birthdate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => { setBirthdate(e.target.value); setFieldError(null) }}
                    disabled={status === 'proving'}
                  />
                  <span style={{ fontSize: '0.72rem', opacity: 0.4, marginTop: '0.2rem', display: 'block' }}>
                    Used only inside the WASM circuit — never transmitted
                  </span>
                </div>
                <div className={styles.field}>
                  <label>Minimum Age to Prove (years)</label>
                  <input
                    type="number" min="1" max="120"
                    value={minAge}
                    onChange={(e) => { setMinAge(e.target.value); setFieldError(null) }}
                    disabled={status === 'proving'}
                  />
                </div>
              </div>

              <FieldError msg={fieldError} />

              {(status === 'idle' || status === 'error') && (
                <motion.button
                  className={`btn btn-primary ${styles.fullWidth}`}
                  onClick={handleProve}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{ marginTop: '1rem' }}
                >
                  🔮 Generate &amp; Verify ZK Proof
                </motion.button>
              )}

              {status === 'proving' && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem',
                  background: 'rgba(56,189,248,0.07)', borderRadius: '8px',
                  border: '1px solid rgba(56,189,248,0.2)', fontSize: '0.85rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block' }}
                    >⚙️</motion.span>
                    <span>{progress || 'Working...'}</span>
                  </div>
                  <p style={{ fontSize: '0.73rem', opacity: 0.5, margin: '0.35rem 0 0' }}>
                    BN254 elliptic curve arithmetic running in WebAssembly
                  </p>
                </div>
              )}

              {status === 'error' && errorMsg && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.75rem',
                  background: '#7f1d1d22', border: '1px solid #ef444444',
                  borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem',
                }}>
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Result */}
            <AnimatePresence>
              {status === 'done' && result && (
                <motion.div
                  className={`${styles.card} card`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Status banner */}
                  <div style={{
                    padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem',
                    background: result.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${result.valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {result.valid ? '✅ ZKGateway.verifyAgeProof() returned true' : '❌ Proof rejected'}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.25rem' }}>
                      {result.valid
                        ? `Age ≥ ${minAge} years cryptographically proven. Your birthdate was never revealed.`
                        : 'The on-chain verifier rejected the proof.'}
                    </div>
                  </div>

                  {/* Private section */}
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                    opacity: 0.45, marginBottom: '0.3rem', textTransform: 'uppercase',
                  }}>
                    Stayed in your browser — never transmitted
                  </div>
                  <DataRow label="Your birthdate" secret tag="PRIVATE" tagColor="#ef4444" />
                  <DataRow label="Random 256-bit salt" secret tag="PRIVATE" tagColor="#ef4444" />
                  <DataRow
                    label={`birthdate_days (your DOB as days since 1970-01-01)`}
                    value={result.birthdate_days}
                    secret tag="PRIVATE" tagColor="#ef4444"
                  />

                  {/* Public signals section */}
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                    opacity: 0.45, margin: '1.1rem 0 0.3rem', textTransform: 'uppercase',
                  }}>
                    Public signals — sent on-chain as calldata
                  </div>
                  <DataRow
                    label={`publicSignals[0]  current_days — today is ${epochToDate(result.current_days)}`}
                    value={result.current_days}
                    tag="PUBLIC" tagColor="#38bdf8"
                  />
                  <DataRow
                    label={`publicSignals[1]  min_age_days — ${minAge} years × 365`}
                    value={result.min_age_days}
                    tag="PUBLIC" tagColor="#38bdf8"
                  />
                  <DataRow
                    label="publicSignals[2]  commitment — Poseidon(birthdate_days, salt)"
                    value={result.commitment}
                    tag="PUBLIC" tagColor="#38bdf8"
                  />

                  {/* Proof points */}
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                    opacity: 0.45, margin: '1.1rem 0 0.3rem', textTransform: 'uppercase',
                  }}>
                    Groth16 proof points — sent on-chain, reveal nothing about birthdate
                  </div>
                  <DataRow label="pi_a[0]  (G1 point x)" value={result.proof.pi_a[0]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_a[1]  (G1 point y)" value={result.proof.pi_a[1]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_b[0][0]  (G2 point)" value={result.proof.pi_b[0][0]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_b[0][1]  (G2 point)" value={result.proof.pi_b[0][1]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_b[1][0]  (G2 point)" value={result.proof.pi_b[1][0]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_b[1][1]  (G2 point)" value={result.proof.pi_b[1][1]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_c[0]  (G1 point x)" value={result.proof.pi_c[0]} tag="PROOF" tagColor="#a78bfa" />
                  <DataRow label="pi_c[1]  (G1 point y)" value={result.proof.pi_c[1]} tag="PROOF" tagColor="#a78bfa" />

                  {/* Why commitment is safe */}
                  <div style={{
                    marginTop: '1rem', padding: '0.8rem 1rem',
                    background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: '0.78rem', lineHeight: 1.65,
                  }}>
                    <strong>Why can't someone reverse the commitment to get your birthdate?</strong>
                    <p style={{ margin: '0.4rem 0 0', opacity: 0.7 }}>
                      The commitment is <code>Poseidon(birthdate_days, salt)</code> where salt is a fresh
                      random 256-bit number (2²⁵⁶ possibilities). Even knowing your approximate age,
                      an attacker cannot reconstruct your exact birthdate without guessing the salt —
                      which is computationally impossible. Poseidon is also a one-way hash function:
                      you cannot go backwards from the output.
                    </p>
                  </div>

                  <motion.button
                    className="btn btn-secondary"
                    onClick={handleReset}
                    style={{ marginTop: '1.25rem' }}
                    whileHover={{ scale: 1.02 }}
                  >
                    Try Again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  )
}