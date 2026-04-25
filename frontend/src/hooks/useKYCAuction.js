import { useCallback } from 'react'
import { ethers } from 'ethers'
import { CONTRACTS } from '../contracts'
import ABI from '../abis/KYCGatedAuction.json'

/**
 * @notice Wraps every KYCGatedAuction interaction.
 * @param {string|null} account — connected wallet address
 */
export function useKYCAuction(account) {
  const _readContract = useCallback(() => {
    const provider = new ethers.BrowserProvider(window.ethereum)
    return new ethers.Contract(CONTRACTS.KYC_AUCTION, ABI, provider)
  }, [])

  const _writeContract = useCallback(async () => {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer   = await provider.getSigner()
    return new ethers.Contract(CONTRACTS.KYC_AUCTION, ABI, signer)
  }, [])

  // ── WRITES ────────────────────────────────────────────────────────────────

  /**
   * @notice Places a bid.
   * @param {string} ethAmount — bid in ETH as a decimal string, e.g. "0.05"
   *
   * GAS: The ReentrancyGuard adds ~2 300 gas per call (one warm SSTORE flip).
   * Pull-payment pattern means no ETH transfer inside placeBid itself, so
   * re-entrancy is moot here, but the guard is kept for defence-in-depth.
   *
   * SECURITY: msg.value is supplied via { value: ... }. We never trust any
   * value coming from the frontend for on-chain amounts — MetaMask shows the
   * exact ETH value to the user before signing.
   */
  const placeBid = useCallback(async (ethAmount) => {
    if (!account) throw new Error('Wallet not connected')
    const weiValue = ethers.parseEther(ethAmount)
    const contract = await _writeContract()
    const tx = await contract.placeBid({ value: weiValue })
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Withdraws the caller's pending refund.
   * Pull-payment: the contract never pushes ETH to bidders unprompted.
   */
  const withdrawRefund = useCallback(async () => {
    if (!account) throw new Error('Wallet not connected')
    const contract = await _writeContract()
    const tx = await contract.withdrawRefund()
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Owner ends the auction.
   */
  const endAuction = useCallback(async () => {
    if (!account) throw new Error('Wallet not connected')
    const contract = await _writeContract()
    const tx = await contract.endAuction()
    return tx.wait()
  }, [account, _writeContract])

  /**
   * @notice Owner withdraws the winning bid to a recipient.
   * @param {string} recipientAddress — address that receives ETH
   */
  const withdrawProceeds = useCallback(async (recipientAddress) => {
    if (!account) throw new Error('Wallet not connected')
    if (!ethers.isAddress(recipientAddress)) throw new Error('Invalid recipient address')
    const contract = await _writeContract()
    const tx = await contract.withdrawProceeds(recipientAddress)
    return tx.wait()
  }, [account, _writeContract])

  // ── READS (view — no gas) ─────────────────────────────────────────────────

  /**
   * @notice Fetches current auction state in a single batch of eth_call requests.
   * @returns {{ highestBidder, highestBidEth, ended, pendingRefundEth, isOwner }}
   */
  const getAuctionState = useCallback(async (userAddress) => {
    const contract = _readContract()

    // Fire all reads in parallel to minimise latency
    const [highestBidder, highestBid, ended, contractOwner] = await Promise.all([
      contract.highestBidder(),
      contract.highestBid(),
      contract.ended(),
      contract.owner(),
    ])

    // Only fetch pendingReturns if we have a connected user (saves 1 rpc call otherwise)
    let pendingRefundEth = '0'
    if (userAddress && ethers.isAddress(userAddress)) {
      const raw = await contract.pendingReturns(userAddress)
      pendingRefundEth = ethers.formatEther(raw)
    }

    return {
      highestBidder,
      highestBidEth:    ethers.formatEther(highestBid),
      ended,
      pendingRefundEth,
      isOwner: userAddress
        ? contractOwner.toLowerCase() === userAddress.toLowerCase()
        : false,
    }
  }, [_readContract])

  return {
    placeBid,
    withdrawRefund,
    endAuction,
    withdrawProceeds,
    getAuctionState,
  }
}