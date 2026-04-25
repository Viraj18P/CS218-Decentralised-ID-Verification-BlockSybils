import { useState, useCallback } from 'react'

/**
 * @notice Tiny state machine for MetaMask transaction lifecycle.
 *
 * States:  idle → pending → mining → confirmed
 *                        → error
 *
 * Usage:
 *   const { txState, run, reset } = useTxState()
 *
 *   <button onClick={() => run(() => contract.doSomething())}>
 *     {txState.status === 'pending' ? 'Waiting for signature…' : 'Submit'}
 *   </button>
 */
export function useTxState() {
  const [txState, setTxState] = useState({
    status:  'idle',   // 'idle' | 'pending' | 'mining' | 'confirmed' | 'error'
    txHash:  null,
    message: null,
  })

  /**
   * @param {() => Promise<TransactionReceipt>} txFn
   *        An async function that submits a transaction and awaits its receipt.
   *        Must throw on failure.
   */
  const run = useCallback(async (txFn) => {
    setTxState({ status: 'pending', txHash: null, message: 'Waiting for MetaMask signature…' })

    try {
      // txFn returns the receipt (after tx.wait())
      const receipt = await txFn()
      setTxState({
        status:  'confirmed',
        txHash:  receipt.hash,
        message: 'Transaction confirmed ✓',
      })
    } catch (err) {
      // 4001 = user rejected in MetaMask
      const message = err.code === 4001
        ? 'Transaction rejected by user.'
        : (err.reason ?? err.shortMessage ?? err.message ?? 'Transaction failed.')

      setTxState({ status: 'error', txHash: null, message })
    }
  }, [])

  const reset = useCallback(() => {
    setTxState({ status: 'idle', txHash: null, message: null })
  }, [])

  return { txState, run, reset }
}