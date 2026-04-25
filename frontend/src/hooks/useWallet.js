import { useState, useEffect, useCallback } from 'react'
import { REQUIRED_CHAIN_ID, CHAIN_NAME } from '../contracts'

/**
 * @notice Manages MetaMask wallet connection state.
 *
 * Returns:
 *   account        — checksummed address string or null
 *   chainId        — current chain ID number or null
 *   isConnected    — true when account is present AND on the correct chain
 *   isWrongNetwork — true when connected but on wrong chain
 *   connect        — call this to trigger eth_requestAccounts
 *   error          — last user-facing error string or null
 */
export function useWallet() {
  const [account, setAccount]     = useState(null)
  const [chainId, setChainId]     = useState(null)
  const [error, setError]         = useState(null)

  // ── helpers ──────────────────────────────────────────────────────────────
  const ethereum = typeof window !== 'undefined' ? window.ethereum : null

  // Read current accounts silently on mount (no pop-up)
  useEffect(() => {
    if (!ethereum) return

    const init = async () => {
      try {
        // eth_accounts returns already-granted accounts without prompting
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) setAccount(accounts[0])

        const hexChain = await ethereum.request({ method: 'eth_chainId' })
        setChainId(parseInt(hexChain, 16))
      } catch {
        // ignore — user hasn't granted access yet
      }
    }
    init()

    // Listen for MetaMask events
    const onAccountsChanged = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0] : null)
    }
    const onChainChanged = (hexChain) => {
      // MetaMask recommends a full page reload on chain change
      setChainId(parseInt(hexChain, 16))
    }

    ethereum.on('accountsChanged', onAccountsChanged)
    ethereum.on('chainChanged', onChainChanged)

    return () => {
      ethereum.removeListener('accountsChanged', onAccountsChanged)
      ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [ethereum])

  // ── connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setError(null)

    if (!ethereum) {
      setError('MetaMask not detected. Please install the extension.')
      return
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])

      const hexChain = await ethereum.request({ method: 'eth_chainId' })
      setChainId(parseInt(hexChain, 16))
    } catch (err) {
      // 4001 = user rejected
      if (err.code === 4001) {
        setError('Connection rejected by user.')
      } else {
        setError(err.message ?? 'Unknown error connecting wallet.')
      }
    }
  }, [ethereum])

  const isWrongNetwork = account !== null && chainId !== null && chainId !== REQUIRED_CHAIN_ID
  const isConnected    = account !== null && chainId === REQUIRED_CHAIN_ID

  return { account, chainId, isConnected, isWrongNetwork, connect, error, CHAIN_NAME }
}