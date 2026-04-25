import { useCallback } from 'react'
import { ethers } from 'ethers'
import { CONTRACTS } from '../contracts'
import ABI from '../abis/IdentityRegistry.json'

/**
 * @notice Wraps every IdentityRegistry interaction.
 *
 * @param {string|null} account  — connected wallet address
 * @returns object with read + write helpers
 *
 * GAS NOTE: All view calls go through eth_call (zero gas).
 * Write calls use MetaMask's gas estimation — we never hard-code gasLimit
 * unless a specific override is documented inline.
 */
export function useIdentityRegistry(account) {
  // ── provider / signer helpers ─────────────────────────────────────────────
  const _readContract = useCallback(() => {
    const provider = new ethers.BrowserProvider(window.ethereum)
    return new ethers.Contract(CONTRACTS.IDENTITY_REGISTRY, ABI, provider)
  }, [])

  const _writeContract = useCallback(async () => {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer   = await provider.getSigner()
    return new ethers.Contract(CONTRACTS.IDENTITY_REGISTRY, ABI, signer)
  }, [])

  // ── WRITES ────────────────────────────────────────────────────────────────

  /**
   * @notice Registers a keccak256 document hash on-chain.
   * @param {string} documentHash  — 0x-prefixed 32-byte hex string
   *        Computed off-chain via crypto.subtle.digest('SHA-256', fileBuffer)
   *        and then reinterpreted as bytes32.  The raw document NEVER leaves
   *        the browser — only the hash is sent as calldata.
   *
   * GAS: 1 SSTORE (20 000 gas) for the Identity struct, plus event (~700 gas).
   * Using uint64 timestamps and packing them into one slot saves ~40 000 gas
   * compared to three separate uint256 storage slots.
   */
 const registerIdentity = useCallback(async (verifier, documentHash, ipfsCid, filename) => {
  if (!account) throw new Error('Wallet not connected')

  const contract = await _writeContract()
  const tx = await contract.registerIdentity(verifier, documentHash, ipfsCid, filename)

  return tx.wait()
}, [account, _writeContract])

  /**
   * @notice Verifier approves a pending identity.
   * @param {string} userAddress — address to verify
   *
   * GAS: 1 SSTORE update (5 000 gas, slot already warm) + event.
   */
  const verifyIdentity = useCallback(async (userAddress) => {
    if (!account) throw new Error('Wallet not connected')
    if (!ethers.isAddress(userAddress)) throw new Error('Invalid address')
    const contract = await _writeContract()
    const tx = await contract.verifyIdentity(userAddress)
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Verifier revokes an identity.
   * @param {string} userAddress — address to revoke
   */
  const revokeIdentity = useCallback(async (userAddress) => {
    if (!account) throw new Error('Wallet not connected')
    if (!ethers.isAddress(userAddress)) throw new Error('Invalid address')
    const contract = await _writeContract()
    const tx = await contract.revokeIdentity(userAddress)
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Admin grants VERIFIER_ROLE to an address.
   */
  const addVerifier = useCallback(async (verifierAddress) => {
    if (!account) throw new Error('Wallet not connected')
    if (!ethers.isAddress(verifierAddress)) throw new Error('Invalid address')
    const contract = await _writeContract()
    const tx = await contract.addVerifier(verifierAddress)
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Admin removes VERIFIER_ROLE from an address.
   */
  const removeVerifier = useCallback(async (verifierAddress) => {
    if (!account) throw new Error('Wallet not connected')
    if (!ethers.isAddress(verifierAddress)) throw new Error('Invalid address')
    const contract = await _writeContract()
    const tx = await contract.removeVerifier(verifierAddress)
    return tx.wait()
  }, [account, _writeContract])

  // ── READS (view — no gas) ─────────────────────────────────────────────────

  /**
   * @notice Returns full identity record for an address.
   * @returns {{ documentHash, status, statusLabel, verifiedBy, registeredAt, verifiedAt, revokedAt }}
   *
   * status enum: 0=NotRegistered, 1=Pending, 2=Verified, 3=Revoked
   */
  const getIdentity = useCallback(async (userAddress) => {
    if (!ethers.isAddress(userAddress)) throw new Error('Invalid address')
    const contract = _readContract()
    const [documentHash, status, verifiedBy, registeredAt, verifiedAt, revokedAt] =
      await contract.getIdentity(userAddress)

    const STATUS_LABELS = ['NotRegistered', 'Pending', 'Verified', 'Revoked']

    return {
      documentHash,
      status:       Number(status),
      statusLabel:  STATUS_LABELS[Number(status)] ?? 'Unknown',
      verifiedBy,
      registeredAt: Number(registeredAt),
      verifiedAt:   Number(verifiedAt),
      revokedAt:    Number(revokedAt),
    }
  }, [_readContract])

  /**
   * @notice Returns true only when the user's status === Verified.
   */
  const isVerified = useCallback(async (userAddress) => {
    if (!ethers.isAddress(userAddress)) return false
    const contract = _readContract()
    return contract.isVerified(userAddress)
  }, [_readContract])

  /**
   * @notice Checks whether an address holds DEFAULT_ADMIN_ROLE.
   * Used by the AdminPanel to show/hide admin-only controls.
   */
  const isAdmin = useCallback(async (userAddress) => {
    if (!ethers.isAddress(userAddress)) return false
    const contract = _readContract()
    const adminRole = await contract.DEFAULT_ADMIN_ROLE()
    return contract.hasRole(adminRole, userAddress)
  }, [_readContract])

  /**
   * @notice Checks whether an address holds VERIFIER_ROLE.
   */
  const isVerifierRole = useCallback(async (userAddress) => {
    if (!ethers.isAddress(userAddress)) return false
    const contract = _readContract()
    const verifierRole = await contract.VERIFIER_ROLE()
    return contract.hasRole(verifierRole, userAddress)
  }, [_readContract])

  return {
    registerIdentity,
    verifyIdentity,
    revokeIdentity,
    addVerifier,
    removeVerifier,
    getIdentity,
    isVerified,
    isAdmin,
    isVerifierRole,
  }
}