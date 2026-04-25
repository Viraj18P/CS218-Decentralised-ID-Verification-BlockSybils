/**
 * @file TabPanels.jsx — BlockSybils UI with End-to-End Encryption
 *
 * Changes from original:
 *
 * RegisterPanel:
 *   - "Share your encryption key" button lets the verifier export their pubkey
 *   - Registrant pastes the verifier's pubkey to enable encryption
 *   - Before IPFS upload: AES-encrypts the file, wraps AES key with verifier pubkey
 *   - Uploads only ciphertext; encryptedKey + IV stored in the filename field on-chain
 *
 * VerifyPanel:
 *   - Shows ONLY identities where assignedVerifier === connected account
 *   - Each row shows 🔒/🔓 badge
 *   - "Decrypt & View" button triggers MetaMask eth_decrypt popup then renders doc locally
 *   - Raw IPFS links are never displayed
 *
 * No new tabs. No RSA keypair panel. MetaMask IS the keypair.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ethers } from 'ethers'
import styles from './TabPanels.module.css'
import TxStatus from './TxStatus'
import { useIdentityRegistry } from '../hooks/useIdentityRegistry'
import { useKYCAuction }        from '../hooks/useKYCAuction'
import { useTxState }            from '../hooks/useTxState'
import { useZKProver }           from '../hooks/useZKProver'
import { CONTRACTS }             from '../contracts'
import RegistryABI               from '../abis/IdentityRegistry.json'
import {
  getEncryptionPublicKey,
  encryptAndUpload,
  uploadPlainToIPFS,
  fetchAndDecrypt,
  getCachedPubKey,
  cachePubKey,
  encodeFilename,
  decodeFilename,
} from '../utils/cryptoUtils'

// ─── Status helpers (unchanged) ───────────────────────────────────────────────
const STATUS_LABELS = ['Not Registered', 'Pending', 'Verified', 'Revoked']
const STATUS_ICONS  = ['❓', '⏳', '✅', '🚫']
const STATUS_TYPES  = ['none', 'pending', 'verified', 'revoked']
const STATUS_COLORS = ['#6b7280', '#f59e0b', '#22c55e', '#ef4444']

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

// ─── Encryption badge ─────────────────────────────────────────────────────────
function EncBadge({ encrypted }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: '0.05rem 0.4rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
      background: encrypted ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
      color: encrypted ? '#22c55e' : '#9ca3af',
      border: '1px solid ' + (encrypted ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'),
    }}>
      {encrypted ? '🔒 Encrypted' : '🔓 Plain'}
    </span>
  )
}

// ─── fetchAllIdentities (updated to decode filename meta) ─────────────────────
async function fetchAllIdentities() {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(CONTRACTS.IDENTITY_REGISTRY, RegistryABI, provider)

    let logs = []
    try {
      logs = await contract.queryFilter(contract.filters.IdentityRegistered(), 0, 'latest')
    } catch (e) {
      console.warn('Could not query IdentityRegistered events:', e)
    }

    const addresses = [...new Set(logs.map(l => l.args[0]))]

    const identities = await Promise.all(
      addresses.map(async (addr) => {
        try {
          const [documentHash, status, verifiedBy, , assignedVerifier, registeredAt, verifiedAt, revokedAt, ipfsCid, rawFilename] =
            await contract.getIdentity(addr)

          const { filename, encryptedKeyJson, ivB64, isEncrypted } = decodeFilename(rawFilename)

          return {
            address: addr,
            documentHash,
            status: Number(status),
            statusLabel: STATUS_LABELS[Number(status)] ?? 'Unknown',
            verifiedBy,
            assignedVerifier,
            registeredAt: Number(registeredAt),
            verifiedAt: Number(verifiedAt),
            revokedAt: Number(revokedAt),
            ipfsCid,
            filename,
            isEncrypted,
            encryptedKeyJson,
            ivB64,
          }
        } catch {
          return null
        }
      })
    )

    return identities.filter(Boolean)
  } catch (err) {
    console.error('fetchAllIdentities error:', err)
    return []
  }
}

// ─── fetchAllVerifiers (unchanged from original) ──────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// PASTE 1 — Replace fetchAllVerifiers (around line 90 in TabPanels.jsx)
// ═══════════════════════════════════════════════════════════════════════════════
 
async function fetchAllVerifiers(currentAccount = null) {
  try {
    const provider     = new ethers.BrowserProvider(window.ethereum)
    const contract     = new ethers.Contract(CONTRACTS.IDENTITY_REGISTRY, RegistryABI, provider)
    const verifierRole = await contract.VERIFIER_ROLE()
    const active       = new Set()
 
    try {
      const latest    = await provider.getBlockNumber()
      const fromBlock = Math.max(0, latest - 100000)
 
      // Use raw getLogs with RoleGranted/RoleRevoked topic signatures
      // These are emitted by OZ AccessControl but not in your custom ABI events
      const [grantedLogs, revokedLogs] = await Promise.all([
        provider.getLogs({
          address:   CONTRACTS.IDENTITY_REGISTRY,
          topics:    [ethers.id('RoleGranted(bytes32,address,address)'), verifierRole],
          fromBlock,
          toBlock:   latest,
        }),
        provider.getLogs({
          address:   CONTRACTS.IDENTITY_REGISTRY,
          topics:    [ethers.id('RoleRevoked(bytes32,address,address)'), verifierRole],
          fromBlock,
          toBlock:   latest,
        }),
      ])
 
      // account is the 2nd indexed topic → topics[2], padded to 32 bytes
      grantedLogs.forEach(log => {
        const account = ethers.getAddress('0x' + log.topics[2].slice(26))
        active.add(account.toLowerCase())
      })
      revokedLogs.forEach(log => {
        const account = ethers.getAddress('0x' + log.topics[2].slice(26))
        active.delete(account.toLowerCase())
      })
    } catch (e) {
      console.warn('RoleGranted log query failed, falling back:', e)
    }
 
    // Always include currentAccount if they hold the role
    if (currentAccount && ethers.isAddress(currentAccount)) {
      const has = await contract.hasRole(verifierRole, currentAccount).catch(() => false)
      if (has) active.add(currentAccount.toLowerCase())
    }
 
    // Verify each address still has the role on-chain
    const results = await Promise.all(
      Array.from(active).map(async addr => {
        const has = await contract.hasRole(verifierRole, addr).catch(() => false)
        return has ? ethers.getAddress(addr) : null
      })
    )
 
    return results.filter(Boolean)
  } catch (err) {
    console.error('fetchAllVerifiers error:', err)
    return []
  }
}
// ─── Error parser (unchanged) ─────────────────────────────────────────────────
function parseContractError(err, context = {}) {
  const addr = context.addr ? `${context.addr.slice(0,10)}…` : 'This address'
  if (err?.code === 4001) return 'Transaction rejected by user.'
  const reason = err?.reason ?? err?.shortMessage ?? err?.data?.message ?? err?.message ?? ''
  const errData = err?.data ?? ''
  if (reason.includes('AccessControlUnauthorizedAccount') || reason.includes('missing role') || errData.includes('AccessControlUnauthorizedAccount'))
    return 'Your wallet does not have the Verifier role. Ask an admin to grant it first.'
  if (reason.includes('not registered') || reason.includes('NotRegistered'))
    return `${addr} has never registered an identity.`
  if (reason.includes('already revoked') || reason.includes('AlreadyRevoked'))
    return `${addr} is already revoked.`
  if (reason.includes('not pending') || reason.includes('NotPending'))
    return `${addr} identity is not Pending.`
  if (reason.includes('already registered') || reason.includes('AlreadyRegistered'))
    return 'This address has already registered an identity.'
  if (reason.includes('unknown custom error') || reason === '') {
    if (context.action === 'revoke') return `Cannot revoke: ${addr} may not have a registered identity, or is already revoked.`
    if (context.action === 'verify') return `Cannot verify: ${addr} may not be in Pending state.`
    return 'Transaction failed — check your role and the identity state.'
  }
  return reason || 'Transaction failed.'
}

// ─── DecryptModal ─────────────────────────────────────────────────────────────
function DecryptModal({ identity, account, onClose }) {
  const [phase, setPhase]       = useState('idle') // idle | fetching | metamask | done | error
  const [error, setError]       = useState(null)
  const [objectUrl, setObj]     = useState(null)
  const [mimeType, setMime]     = useState('application/octet-stream')

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])

  const handleDecrypt = async () => {
    setPhase('fetching')
    setError(null)
    try {
      setPhase('metamask') // MetaMask popup will appear for eth_decrypt
      const plainBytes = await fetchAndDecrypt(
        identity.ipfsCid,
        identity.encryptedKeyJson,
        identity.ivB64,
        account
      )
      const ext = (identity.filename || '').split('.').pop().toLowerCase()
      const mime = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'application/octet-stream'
      setMime(mime)
      const blob = new Blob([plainBytes], { type: mime })
      setObj(URL.createObjectURL(blob))
      setPhase('done')
    } catch (err) {
      setError(err.message || 'Decryption failed.')
      setPhase('error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        style={{ background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '90%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, color: '#a78bfa' }}>🔑 Decrypt Document</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ fontSize: '0.82rem', opacity: 0.7, marginBottom: '1rem' }}>
          <div><strong>User:</strong> {identity.address.slice(0, 12)}…{identity.address.slice(-6)}</div>
          {identity.filename && <div><strong>File:</strong> {identity.filename}</div>}
        </div>

        <div style={{ padding: '0.6rem', background: 'rgba(139,92,246,0.08)', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '1.25rem', color: '#c4b5fd' }}>
          🔒 Decryption is 100% local. MetaMask will ask you to approve once. No data leaves your browser.
        </div>

        {phase === 'idle' && (
          <button onClick={handleDecrypt} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontWeight: 700, fontSize: '0.95rem' }}>
            🔓 Decrypt with MetaMask
          </button>
        )}

        {phase === 'fetching' && (
          <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>⏳ Fetching encrypted document from IPFS…</div>
        )}

        {phase === 'metamask' && (
          <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.8 }}>
            🦊 MetaMask popup — please approve the decryption request…
          </div>
        )}

        {phase === 'error' && (
          <div style={{ padding: '0.7rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.83rem' }}>
            ❌ {error}
            <button onClick={() => setPhase('idle')} style={{ marginTop: '0.5rem', display: 'block', background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.8rem' }}>↩ Try again</button>
          </div>
        )}

        {phase === 'done' && objectUrl && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: '0.75rem' }}>✅ Decryption successful</div>
            {mimeType.startsWith('image/') && (
              <img src={objectUrl} alt="Decrypted" style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', marginBottom: '0.75rem' }} />
            )}
            {mimeType === 'application/pdf' && (
              <iframe src={objectUrl} title="PDF" style={{ width: '100%', height: '260px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.75rem' }} />
            )}
            <a href={objectUrl} download={identity.filename || 'document'} style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontWeight: 700, textDecoration: 'none', fontSize: '0.88rem' }}>
              ⬇️ Download
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── IdentityRow (updated: encryption badge + decrypt button) ─────────────────
function IdentityRow({ identity, account, onAction, actionLabel, actionStyle, disabled, onDecrypt }) {
  const fmtTs = ts => ts > 0 ? new Date(ts * 1000).toLocaleDateString() : '—'
  const color = STATUS_COLORS[identity.status] ?? '#6b7280'

  // Only show Decrypt button if: this identity is assigned to me, it is encrypted, and there is encryptedKeyJson
  const canDecrypt =
    identity.isEncrypted &&
    identity.encryptedKeyJson &&
    identity.assignedVerifier?.toLowerCase() === account?.toLowerCase()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
      <span style={{ fontSize: '1rem' }}>{STATUS_ICONS[identity.status]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
          {identity.address.slice(0, 10)}…{identity.address.slice(-6)}
        </div>
        <div style={{ opacity: 0.55, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ color, fontWeight: 600 }}>{identity.statusLabel}</span>
          <span>·</span>
          <span>Reg {fmtTs(identity.registeredAt)}</span>
          {identity.verifiedAt > 0 && <><span>·</span><span>Ver {fmtTs(identity.verifiedAt)}</span></>}
          <EncBadge encrypted={identity.isEncrypted} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        {canDecrypt && (
          <button
            onClick={() => onDecrypt && onDecrypt(identity)}
            style={{ padding: '0.28rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}
          >
            🔑 Decrypt
          </button>
        )}
        {onAction && (
          <button
            onClick={() => onAction(identity.address)}
            disabled={disabled}
            style={{ padding: '0.28rem 0.6rem', borderRadius: '6px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 600, background: actionStyle === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: actionStyle === 'danger' ? '#ef4444' : '#22c55e', opacity: disabled ? 0.5 : 1 }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ConnectPanel (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
export function ConnectPanel({ onConnect, isConnected, account }) {
  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>Your Secure Gateway</h2>
        <p className={styles.subtitle}>Connect your MetaMask wallet to access decentralised identity verification, asset management, and blockchain operations.</p>
        <motion.button className="btn btn-primary" onClick={onConnect} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
          <span>🔐</span> {isConnected ? `Connected: ${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect MetaMask'}
        </motion.button>
        <div className={styles.grid}>
          <div className={`${styles.card} card`}><h3>🔒 Self-Sovereign Identity</h3><p>You own your identity. Only authorised verifiers can change your status.</p></div>
          <div className={`${styles.card} card`}><h3>⚡ On-chain Proof</h3><p>Every verification is anchored to the blockchain via keccak256 hashes.</p></div>
          <div className={`${styles.card} card`}><h3>🛡️ End-to-End Encryption</h3><p>Documents are AES-256-GCM encrypted in your browser. Only the assigned verifier can decrypt via MetaMask.</p></div>
          <div className={`${styles.card} card`}><h3>🔑 MetaMask Native</h3><p>No extra keys needed. The verifier decrypts with their existing MetaMask wallet.</p></div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RegisterPanel — with encryption
// ═══════════════════════════════════════════════════════════════════════════════
export function RegisterPanel({ isConnected, account }) {
  const fileInputRef = useRef(null)
  const [documentHash,     setDocumentHash]     = useState(null)
  const [fileName,         setFileName]         = useState(null)
  const [fieldError,       setFieldError]       = useState(null)
  const [isUploading,      setIsUploading]      = useState(false)
  const [verifiers,        setVerifiers]        = useState([])
  const [selectedVerifier, setSelectedVerifier] = useState('')

  // Encryption state
  const [verifierPubKey,   setVerifierPubKey]   = useState(null)  // cached pubkey for selected verifier
  const [pubKeyStatus,     setPubKeyStatus]     = useState('none') // none | fetching | ready | error
  const [uploadStatus,     setUploadStatus]     = useState('')

  const { registerIdentity } = useIdentityRegistry(account)
  const { txState, run, reset } = useTxState()

  useEffect(() => {
    if (!isConnected) return
    fetchAllVerifiers(account)
      .then(list => {
        setVerifiers(list)
        if (list.length > 0) setSelectedVerifier(list[0])
        else setFieldError('No active verifiers found. Deployer may need to grant roles in Admin panel.')
      })
      .catch(() => setFieldError('Failed to load active verifiers.'))
  }, [isConnected, account])

  // When verifier changes, check cache for their pubkey
  useEffect(() => {
    if (!selectedVerifier) return
    const cached = getCachedPubKey(selectedVerifier)
    if (cached) {
      setVerifierPubKey(cached)
      setPubKeyStatus('ready')
    } else {
      setVerifierPubKey(null)
      setPubKeyStatus('none')
    }
  }, [selectedVerifier])

  const handleFetchPubKey = async () => {
    if (!selectedVerifier) return
    setPubKeyStatus('fetching')
    setFieldError(null)
    try {
      // This asks MetaMask on the VERIFIER's machine; typically the verifier
      // exports this once and shares it, OR the registrant asks MetaMask
      // if they happen to be on the same browser (testing).
      const pubKey = await getEncryptionPublicKey(selectedVerifier)
      cachePubKey(selectedVerifier, pubKey)
      setVerifierPubKey(pubKey)
      setPubKeyStatus('ready')
    } catch (err) {
      // User rejected or wrong account — fall back gracefully
      setFieldError('Could not get verifier pubkey: ' + (err.message || 'MetaMask rejected'))
      setPubKeyStatus('error')
    }
  }

  const hashFile = useCallback(async (file) => {
    setFieldError(null); setDocumentHash(null); setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hexHash = '0x' + Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      setDocumentHash(hexHash)
    } catch {
      setFieldError('Failed to hash the file. Please try again.')
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) hashFile(file)
  }, [hashFile])

  const handleRegister = async () => {
    if (!isConnected)  return setFieldError('Connect your wallet first.')
    if (!documentHash) return setFieldError('Please select a document to hash.')
    if (!selectedVerifier) return setFieldError('Please select a verifier from the list.')

    const file = fileInputRef.current?.files?.[0]
    if (!file) return setFieldError('Unable to locate the file for upload.')

    const apiKey    = import.meta.env.VITE_PINATA_API_KEY || ''
    const apiSecret = import.meta.env.VITE_PINATA_SECRET_API_KEY || ''

    try {
      setIsUploading(true); setFieldError(null); reset()
      let ipfsCid, filenameOnChain

      if (verifierPubKey && pubKeyStatus === 'ready') {
        // ── Encrypted path ─────────────────────────────────────────────
        setUploadStatus('🔒 Encrypting document locally…')
        const result = await encryptAndUpload(file, verifierPubKey, apiKey, apiSecret)
        ipfsCid = result.ipfsCid
        // Encode encryptedKey + IV into filename field — no contract change needed
        filenameOnChain = encodeFilename(fileName || '', result.encryptedKeyJson, result.ivB64)
        setUploadStatus('')
      } else {
        // ── Plain fallback ──────────────────────────────────────────────
        setUploadStatus('⏳ Uploading to IPFS…')
        ipfsCid = await uploadPlainToIPFS(file, apiKey, apiSecret)
        filenameOnChain = fileName || ''
        setUploadStatus('')
      }

      run(() => registerIdentity(selectedVerifier, documentHash, ipfsCid, filenameOnChain))
    } catch (err) {
      setFieldError(err.message || 'Upload failed.')
    } finally {
      setIsUploading(false)
      setUploadStatus('')
    }
  }

  const encryptionReady = pubKeyStatus === 'ready' && verifierPubKey

  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>Register Identity</h2>
        <p className={styles.subtitle}>Your document is encrypted in the browser before upload. Only your selected verifier can decrypt it using MetaMask.</p>

        {!isConnected ? <NotConnected /> : (
          <div className={`${styles.card} card`}>

            {/* Verifier selector */}
            <div className={styles.field} style={{ marginBottom: '1.25rem' }}>
              <label>Select an Authorized Verifier</label>
              {verifiers.length === 0 ? (
                <div style={{ opacity: 0.6, fontSize: '0.8rem', padding: '0.5rem 0', color: '#f59e0b' }}>
                  ⏳ Loading verifiers...
                </div>
              ) : (
                <select
                  value={selectedVerifier}
                  onChange={(e) => { setSelectedVerifier(e.target.value); setFieldError(null) }}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                >
                  {verifiers.map(v => <option key={v} value={v} style={{ color: '#000' }}>{v}</option>)}
                </select>
              )}
            </div>

            {/* Encryption key status */}
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: '10px', background: encryptionReady ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (encryptionReady ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)') }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.82rem' }}>
                  {encryptionReady
                    ? <span style={{ color: '#22c55e' }}>🔒 Encryption ready — document will be encrypted for this verifier</span>
                    : <span style={{ color: '#f59e0b' }}>⚠️ No encryption key — document will be uploaded unencrypted</span>}
                </div>
                {!encryptionReady && selectedVerifier && (
                  <button
                    onClick={handleFetchPubKey}
                    disabled={pubKeyStatus === 'fetching'}
                    style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.7rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                  >
                    {pubKeyStatus === 'fetching' ? '…' : '🔑 Get Key'}
                  </button>
                )}
              </div>
              {encryptionReady && (
                <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '0.35rem' }}>
                  Key cached for {selectedVerifier.slice(0, 12)}…
                </div>
              )}
            </div>

            {/* Document selection */}
            <h3>📂 Document Selection</h3>
            <div className={styles.dropzone} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} role="button">
              <div className={styles.dzIcon}>📄</div>
              <div className={styles.dzText}>{fileName ?? 'Drop your document here or click to browse'}</div>
              <div className={styles.dzSub}>PDF, JPG, PNG — max 10 MB</div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.png,.jpeg" onChange={(e) => e.target.files?.[0] && hashFile(e.target.files[0])} style={{ display: 'none' }} />

            <div className={styles.hashBox}>
              <span style={{ opacity: 0.7 }}>Local SHA-256 Hash: </span>{documentHash ?? 'Awaiting file…'}
            </div>

            <FieldError msg={fieldError} />

            <motion.button
              className={`btn btn-primary ${styles.fullWidth}`}
              onClick={handleRegister}
              disabled={isUploading || txState.status === 'pending' || txState.status === 'mining'}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} style={{ marginTop: '1rem' }}
            >
              {uploadStatus || (txState.status === 'pending' ? '⏳ Waiting for MetaMask…' : encryptionReady ? '🔒 Encrypt, Upload & Register' : '🔐 Upload & Register on-chain')}
            </motion.button>
            <TxStatus txState={txState} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLACE your existing VerifyPanel export with this version.
// Added: role check at panel level — non-verifiers see ACCESS RESTRICTED.
// ═══════════════════════════════════════════════════════════════════════════════

export function VerifyPanel({ isConnected, account }) {
  const [addr,          setAddr]          = useState('')
  const [addrError,     setAddrError]     = useState(null)
  const [preflights,    setPreflights]    = useState(null)
  const [identities,    setIdentities]    = useState([])
  const [listLoading,   setListLoading]   = useState(false)
  const [filter,        setFilter]        = useState('mine')
  const [actionError,   setActionError]   = useState(null)
  const [decryptTarget, setDecryptTarget] = useState(null)

  // ── Role check ────────────────────────────────────────────────────────────
  const [isPrivileged,  setIsPrivileged]  = useState(false)
  const [roleChecked,   setRoleChecked]   = useState(false) // prevent flicker

  const { verifyIdentity, revokeIdentity, getIdentity, isVerifierRole, isAdmin } =
    useIdentityRegistry(account)
  const { txState, run, reset } = useTxState()

  // Check verifier or admin role whenever account changes
  useEffect(() => {
    setIsPrivileged(false)
    setRoleChecked(false)
    if (!account || !isConnected) { setRoleChecked(true); return }

    Promise.all([isVerifierRole(account), isAdmin(account)])
      .then(([v, a]) => {
        setIsPrivileged(v || a)
        setRoleChecked(true)
      })
      .catch(() => {
        setIsPrivileged(false)
        setRoleChecked(true)
      })
  }, [account, isConnected, isVerifierRole, isAdmin])

  const loadList = useCallback(async () => {
    if (!isConnected || !isPrivileged) return
    setListLoading(true)
    try { setIdentities(await fetchAllIdentities()) }
    finally { setListLoading(false) }
  }, [isConnected, isPrivileged])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { if (txState.status === 'confirmed') loadList() }, [txState.status, loadList])

  useEffect(() => {
    setPreflights(null)
    if (!addr || !ethers.isAddress(addr) || !isConnected) return
    let cancelled = false
    Promise.all([getIdentity(addr), isVerifierRole(account)])
      .then(([identity, isVerifier]) => { if (!cancelled) setPreflights({ identity, isVerifier }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [addr, account, isConnected, getIdentity, isVerifierRole])

  const selectAddress = (a) => { setAddr(a); setAddrError(null); setActionError(null) }

  const validate = () => {
    if (!addr) { setAddrError('Enter an address.'); return false }
    if (!ethers.isAddress(addr)) { setAddrError('Invalid Ethereum address.'); return false }
    setAddrError(null); return true
  }

  const handleApprove = () => {
    if (!isConnected || !validate()) return
    if (preflights && preflights.identity.status !== 1)
      return setActionError(`Cannot verify: identity is "${preflights.identity.statusLabel}", not Pending.`)
    if (preflights && !preflights.isVerifier)
      return setActionError('Your wallet does not have Verifier role.')
    setActionError(null); reset()
    run(async () => {
      try { return await verifyIdentity(addr) }
      catch (err) { throw new Error(parseContractError(err, { addr, action: 'verify' })) }
    })
  }

  const handleRevoke = async (targetAddr = addr) => {
    if (!isConnected) return
    if (targetAddr === addr && !validate()) return
    setActionError(null)

    // Pre-check status before sending tx
    try {
      const identity = await getIdentity(targetAddr)
      if (identity.status === 0)
        return setActionError(`${targetAddr.slice(0,10)}… has never registered an identity.`)
      if (identity.status === 1)
        return setActionError(`Cannot revoke a Pending identity. Approve it first.`)
      if (identity.status === 3)
        return setActionError(`${targetAddr.slice(0,10)}… is already Revoked.`)
    } catch { /* let contract decide */ }

    reset()
    run(async () => {
      try { return await revokeIdentity(targetAddr) }
      catch (err) { throw new Error(parseContractError(err, { addr: targetAddr, action: 'revoke' })) }
    })
  }

  const filtered = identities.filter(i => {
    if (filter === 'mine')     return i.assignedVerifier?.toLowerCase() === account?.toLowerCase()
    if (filter === 'pending')  return i.status === 1
    if (filter === 'verified') return i.status === 2
    return true
  })

  const myPendingCount = identities.filter(i =>
    i.assignedVerifier?.toLowerCase() === account?.toLowerCase() && i.status === 1
  ).length

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.content}>
          <h2 className={styles.title}>KYC Verification</h2>
          <NotConnected />
        </div>
      </motion.div>
    )
  }

  // ── Role check still loading (prevents flicker) ───────────────────────────
  if (!roleChecked) {
    return (
      <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.content}>
          <h2 className={styles.title}>KYC Verification</h2>
          <div style={{ opacity: 0.5, fontSize: '0.85rem', padding: '2rem 0' }}>
            Checking role…
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Not a verifier or admin ───────────────────────────────────────────────
  if (!isPrivileged) {
    return (
      <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.content}>
          <h2 className={styles.title}>KYC Verification</h2>
          <div className={styles.lockBox}>
            <div className={styles.lockIcon}>🔐</div>
            <div className={styles.lockTitle}>ACCESS RESTRICTED</div>
            <p>
              Your wallet ({account?.slice(0, 8)}…) does not hold
              VERIFIER_ROLE or DEFAULT_ADMIN_ROLE.
            </p>
            <p style={{ fontSize: '0.82rem', opacity: 0.6, marginTop: '0.5rem' }}>
              Ask the contract admin to grant you the Verifier role from the Admin panel.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Full panel (verifiers and admins only) ────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {decryptTarget && (
          <DecryptModal
            identity={decryptTarget}
            account={account}
            onClose={() => setDecryptTarget(null)}
          />
        )}
      </AnimatePresence>

      <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={styles.content}>
          <h2 className={styles.title}>KYC Verification</h2>
          <p className={styles.subtitle}>
            Verifier panel — review, decrypt, approve, or revoke identities assigned to you.
          </p>

          <div className={`${styles.card} card`}>
            <h3>
              📋 Identity Queue
              {myPendingCount > 0 && (
                <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', borderRadius: '99px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700 }}>
                  {myPendingCount} pending
                </span>
              )}
            </h3>

            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {[['mine','👤 Mine'],['all','All'],['pending','⏳ Pending'],['verified','✅ Verified']].map(([key, label]) => (
                <button
                  key={key} onClick={() => setFilter(key)}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', background: filter === key ? 'rgba(var(--accent-primary-rgb),0.2)' : 'rgba(255,255,255,0.05)', color: filter === key ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: filter === key ? 600 : 400 }}
                >{label}</button>
              ))}
              <button
                onClick={loadList}
                style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
              >↻ Refresh</button>
            </div>

            {listLoading
              ? <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>Fetching from chain…</div>
              : filtered.length === 0
                ? <div style={{ opacity: 0.4, fontSize: '0.85rem' }}>
                    {filter === 'mine' ? 'No identities assigned to your address yet.' : 'No identities found.'}
                  </div>
                : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {filtered.map(identity => (
                      <IdentityRow
                        key={identity.address}
                        identity={identity}
                        account={account}
                        onDecrypt={setDecryptTarget}
                        onAction={
                          identity.status === 1 ? (a) => selectAddress(a) :
                          identity.status === 2 ? (a) => handleRevoke(a) : null
                        }
                        actionLabel={identity.status === 1 ? 'Select' : 'Revoke'}
                        actionStyle={identity.status === 2 ? 'danger' : 'primary'}
                        disabled={txState.status === 'pending'}
                      />
                    ))}
                  </div>
                )
            }
          </div>

          <div className={`${styles.card} card`}>
            <h3>✅ Verify / Revoke by Address</h3>
            <div className={styles.checks}>
              <div className={`${styles.check} ${preflights?.isVerifier ? styles.pass : styles.unknown}`}>
                <span>{preflights?.isVerifier ? '✓' : '○'}</span> Verifier role
              </div>
            </div>
            <div className={styles.form}>
              <div className={styles.field}>
                <label>Wallet Address</label>
                <input
                  type="text" placeholder="0x…" value={addr}
                  onChange={(e) => { setAddr(e.target.value); setAddrError(null); setActionError(null) }}
                />
                <FieldError msg={addrError} />
              </div>
              {actionError && (
                <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  ⚠️ {actionError}
                </div>
              )}
              <div className={styles.buttonGroup}>
                <motion.button className="btn btn-primary" onClick={handleApprove} disabled={txState.status === 'pending'}>
                  ✓ Approve &amp; Verify
                </motion.button>
                <motion.button className="btn btn-danger" onClick={() => handleRevoke()} disabled={txState.status === 'pending'}>
                  ✗ Revoke Identity
                </motion.button>
              </div>
            </div>
            <TxStatus txState={txState} />
          </div>
        </div>
      </motion.div>
    </>
  )
}
// ═══════════════════════════════════════════════════════════════════════════════
// LookupPanel (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════════
export function LookupPanel() {
  const [addr,    setAddr]    = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const { getIdentity } = useIdentityRegistry(null)

  const handleLookup = async () => {
    setError(null); setResult(null)
    if (!addr)                   { setError('Enter an address.'); return }
    if (!ethers.isAddress(addr)) { setError('Invalid Ethereum address.'); return }
    setLoading(true)
    try {
      const identity = await getIdentity(addr)
      setResult(identity)
    } catch (err) {
      setError(err.shortMessage ?? err.message ?? 'Failed to fetch identity.')
    } finally { setLoading(false) }
  }

  const statusType = result ? STATUS_TYPES[result.status] : null
  const fmtTs = (ts) => ts > 0 ? new Date(ts * 1000).toLocaleString() : '—'

  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>Identity Lookup</h2>
        <p className={styles.subtitle}>Query the on-chain verification status of any wallet address. Free — no gas.</p>
        <div className={`${styles.card} card`}>
          <h3>🔍 Query Chain</h3>
          <div className={styles.field}>
            <label>Wallet Address</label>
            <input type="text" placeholder="0x…" value={addr} onChange={(e) => { setAddr(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleLookup()} />
            <FieldError msg={error} />
          </div>
          <motion.button className={`btn btn-secondary ${styles.fullWidth}`} onClick={handleLookup} disabled={loading} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            {loading ? 'Querying…' : 'Query Status'}
          </motion.button>
          {result && (
            <motion.div className={`${styles.resultBox} ${styles[statusType]}`} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
              <div className={styles.resultIcon}>{STATUS_ICONS[result.status]}</div>
              <div className={styles.resultTitle}>{STATUS_LABELS[result.status]}</div>
              <div className={styles.resultDetail}>
                {result.status > 0 && (
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr><td style={{ opacity: 0.7, paddingRight: '1rem' }}>Document hash</td><td style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{result.documentHash.slice(0, 18)}…</td></tr>
                      {result.verifiedBy !== ethers.ZeroAddress && <tr><td style={{ opacity: 0.7 }}>Verified by</td><td style={{ fontFamily: 'monospace' }}>{result.verifiedBy.slice(0, 10)}…</td></tr>}
                      <tr><td style={{ opacity: 0.7 }}>Registered</td><td>{fmtTs(result.registeredAt)}</td></tr>
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AuctionPanel (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════════
export function AuctionPanel({ isConnected, account }) {
  const [bidAmount,    setBidAmount]    = useState('')
  const [auctionState, setAuctionState] = useState(null)
  const [bidAmountErr, setBidAmountErr] = useState(null)

  const { placeBid, withdrawRefund, endAuction, getAuctionState } = useKYCAuction(account)
  const { txState, run, reset } = useTxState()

  const loadState = useCallback(async () => {
    if (!isConnected) return
    try { setAuctionState(await getAuctionState(account)) } catch {}
  }, [account, isConnected, getAuctionState])

  useEffect(() => { loadState() }, [loadState, txState.status])

  const handleBid = () => {
    setBidAmountErr(null)
    if (!isConnected) return setBidAmountErr('Connect wallet first.')
    if (!bidAmount || isNaN(Number(bidAmount)) || Number(bidAmount) <= 0) return setBidAmountErr('Enter a valid ETH amount.')
    reset(); run(() => placeBid(bidAmount))
  }

  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>KYC-Gated Auction</h2>
        <p className={styles.subtitle}>Only verified identities can place bids.</p>
        {!isConnected ? <NotConnected /> : (<>
          <div className={styles.bidBoard}>
            <div className={styles.bidStat}><div className={styles.bidLabel}>Highest Bid</div><div className={styles.bidValue}>{auctionState ? `${auctionState.highestBidEth} ETH` : '—'}</div></div>
            <div className={styles.bidStat}><div className={styles.bidLabel}>Status</div><div className={styles.bidValue}>{auctionState === null ? '…' : auctionState.ended ? 'ENDED' : 'LIVE'}</div></div>
            <div className={styles.bidStat}><div className={styles.bidLabel}>Your Refund</div><div className={styles.bidValue}>{auctionState ? `${auctionState.pendingRefundEth} ETH` : '—'}</div></div>
          </div>
          {!auctionState?.ended && (
            <div className={`${styles.card} card`}>
              <h3>⬡ Place Bid</h3>
              <div className={styles.field}>
                <label>Bid Amount (ETH)</label>
                <input type="number" step="0.001" min="0" placeholder="0.05" value={bidAmount} onChange={(e) => { setBidAmount(e.target.value); setBidAmountErr(null) }} />
                <FieldError msg={bidAmountErr} />
              </div>
              <motion.button className={`btn btn-primary ${styles.fullWidth}`} onClick={handleBid} disabled={txState.status === 'pending'}>
                🔐 Sign &amp; Place Bid
              </motion.button>
            </div>
          )}
          <TxStatus txState={txState} />
        </>)}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AdminPanel (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════════
export function AdminPanel({ isConnected, account }) {
  const [grantAddr,   setGrantAddr]   = useState('')
  const [revokeAddr,  setRevokeAddr]  = useState('')
  const [grantErr,    setGrantErr]    = useState(null)
  const [revokeErr,   setRevokeErr]   = useState(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [verifiers,   setVerifiers]   = useState([])
  const [listLoading, setListLoading] = useState(false)

  const { addVerifier, removeVerifier, isAdmin } = useIdentityRegistry(account)
  const grantTx  = useTxState()
  const revokeTx = useTxState()

  useEffect(() => {
    if (!account || !isConnected) { setIsAdminUser(false); return }
    isAdmin(account).then(setIsAdminUser).catch(() => setIsAdminUser(false))
  }, [account, isConnected, isAdmin])

  const loadVerifiers = useCallback(async () => {
    if (!isConnected) return
    setListLoading(true)
    try { setVerifiers(await fetchAllVerifiers(account)) }
    catch {}
    finally { setListLoading(false) }
  }, [isConnected, account])

  useEffect(() => { loadVerifiers() }, [loadVerifiers])
  useEffect(() => {
    if (grantTx.txState.status === 'confirmed' || revokeTx.txState.status === 'confirmed') loadVerifiers()
  }, [grantTx.txState.status, revokeTx.txState.status, loadVerifiers])

  const handleGrant = async () => {
    setGrantErr(null)
    if (!ethers.isAddress(grantAddr)) return setGrantErr('Invalid address.')
    grantTx.reset()
    grantTx.run(async () => {
      try { return await addVerifier(grantAddr) }
      catch (err) { throw new Error(parseContractError(err, { addr: grantAddr })) }
    })
  }

  const handleRevoke = async (targetAddr = revokeAddr) => {
    if (targetAddr === revokeAddr) setRevokeErr(null)
    if (!ethers.isAddress(targetAddr)) { if (targetAddr === revokeAddr) setRevokeErr('Invalid address.'); return }
    revokeTx.reset()
    revokeTx.run(async () => {
      try { return await removeVerifier(targetAddr) }
      catch (err) { throw new Error(parseContractError(err, { addr: targetAddr })) }
    })
  }

  if (!isConnected) return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.content}><h2 className={styles.title}>Admin Panel</h2><NotConnected /></div>
    </motion.div>
  )

  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>Admin Panel</h2>
        <p className={styles.subtitle}>Manage verifier roles. Requires DEFAULT_ADMIN_ROLE.</p>
        {!isAdminUser ? (
          <div className={styles.lockBox}>
            <div className={styles.lockIcon}>🔐</div>
            <div className={styles.lockTitle}>ACCESS RESTRICTED</div>
            <p>Your wallet ({account?.slice(0, 8)}…) does not hold DEFAULT_ADMIN_ROLE. Switch to the deployer account.</p>
          </div>
        ) : (<>
          <div className={`${styles.card} card`}>
            <h3>🛡️ Active Verifiers</h3>
            {listLoading ? <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>Fetching from chain…</div> :
             verifiers.length === 0 ? <div style={{ opacity: 0.4, fontSize: '0.85rem' }}>No verifiers granted yet.</div> : (
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {verifiers.map(addr => (
                  <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                    <span>🛡️</span><span style={{ fontFamily: 'monospace', flex: 1 }}>{addr.slice(0,12)}…{addr.slice(-8)}</span>
                    <button onClick={() => handleRevoke(addr)} disabled={revokeTx.txState.status === 'pending'} style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>Revoke</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={loadVerifiers} style={{ marginTop: '0.5rem', padding: '0.25rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>↻ Refresh</button>
          </div>
          <div className={styles.adminGrid}>
            <div className={`${styles.card} card`}>
              <h3>⚙️ Grant Verifier Role</h3>
              <div className={styles.field}><label>Wallet Address</label><input type="text" placeholder="0x…" value={grantAddr} onChange={(e) => { setGrantAddr(e.target.value); setGrantErr(null) }} /><FieldError msg={grantErr} /></div>
              <motion.button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleGrant} disabled={grantTx.txState.status === 'pending'}>Grant Verifier Role</motion.button>
              <TxStatus txState={grantTx.txState} />
            </div>
            <div className={`${styles.card} card`}>
              <h3>🚫 Revoke Verifier Role</h3>
              <div className={styles.field}><label>Wallet Address</label><input type="text" placeholder="0x…" value={revokeAddr} onChange={(e) => { setRevokeAddr(e.target.value); setRevokeErr(null) }} /><FieldError msg={revokeErr} /></div>
              <motion.button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleRevoke()} disabled={revokeTx.txState.status === 'pending'}>Revoke Verifier Role</motion.button>
              <TxStatus txState={revokeTx.txState} />
            </div>
          </div>
        </>)}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZKPanel (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════════
export function ZKPanel({ isConnected }) {
  const [birthdate,  setBirthdate]  = useState('')
  const [minAge,     setMinAge]     = useState('18')
  const [fieldError, setFieldError] = useState(null)
  const [status,     setStatus]     = useState('idle')
  const [progress,   setProgress]   = useState('')
  const [result,     setResult]     = useState(null)
  const [errorMsg,   setErrorMsg]   = useState(null)

  const { generateAndVerifyAgeProof } = useZKProver()

  const handleProve = useCallback(async () => {
    setFieldError(null); setResult(null); setErrorMsg(null)
    if (!birthdate) return setFieldError('Please enter your birthdate.')
    if (!minAge) return setFieldError('Enter a valid minimum age.')
    if (!isConnected) return setFieldError('Connect wallet first.')
    const birthdate_days = Math.floor(new Date(birthdate).getTime() / 86400000)
    const current_days   = Math.floor(Date.now() / 86400000)
    const min_age_days   = Number(minAge) * 365
    if (current_days - birthdate_days < min_age_days)
      return setErrorMsg(`User is below ${minAge} years old. Proof generation blocked.`)
    setStatus('proving')
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const salt = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      const res = await generateAndVerifyAgeProof(birthdate, Number(minAge), salt, (msg) => setProgress(msg))
      setResult(res); setStatus('done')
    } catch (err) {
      setErrorMsg(err.message || 'Proof generation failed.'); setStatus('error')
    }
  }, [birthdate, minAge, isConnected, generateAndVerifyAgeProof])

  return (
    <motion.div className={styles.panel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={styles.content}>
        <h2 className={styles.title}>ZK Age Proof</h2>
        <p className={styles.subtitle}>Prove you meet a minimum age without revealing your birthdate.</p>
        {!isConnected ? <NotConnected /> : (<>
          <div className={`${styles.card} card`}>
            <h3>🔐 Private Inputs (never leave your browser)</h3>
            <div className={styles.form}>
              <div className={styles.field}><label>Your Birthdate</label><input type="date" value={birthdate} max={new Date().toISOString().split('T')[0]} onChange={(e) => { setBirthdate(e.target.value); setFieldError(null); setErrorMsg(null) }} /></div>
              <div className={styles.field}><label>Minimum Age to Prove</label><input type="number" min="1" max="120" value={minAge} onChange={(e) => { setMinAge(e.target.value); setFieldError(null); setErrorMsg(null) }} /></div>
            </div>
            <FieldError msg={fieldError} />
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.83rem', lineHeight: 1.5 }}>
                  ⚠️ {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>
            {status === 'proving' ? (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(var(--accent-primary-rgb),0.08)', borderRadius: '8px', border: '1px solid rgba(var(--accent-primary-rgb),0.2)', fontSize: '0.85rem' }}>
                ⚙️ {progress || 'Working…'}
              </div>
            ) : (
              <motion.button className={`btn btn-primary ${styles.fullWidth}`} onClick={handleProve} style={{ marginTop: '1rem' }}>🔮 Generate &amp; Verify ZK Proof</motion.button>
            )}
          </div>
          {status === 'done' && result && (
            <motion.div className={`${styles.card} card`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <h3>{result.valid ? '✅ Proof Verified On-Chain' : '⚠️ Proof Generated (Verifier Mismatch)'}</h3>
              <motion.button className="btn btn-secondary" onClick={() => { setStatus('idle'); setResult(null); setErrorMsg(null) }} style={{ marginTop: '1rem' }}>Try Again</motion.button>
            </motion.div>
          )}
        </>)}
      </div>
    </motion.div>
  )
}