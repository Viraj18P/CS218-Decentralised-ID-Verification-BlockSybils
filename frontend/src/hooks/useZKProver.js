import { useCallback } from 'react'
import { ethers } from 'ethers'
import { buildPoseidon } from 'circomlibjs'
import { CONTRACTS } from '../contracts'
import ZKGatewayABI from '../abis/ZKGateway.json'

/**
 * Real in-browser ZK proof generation + on-chain verification.
 *
 * Circuit public signals: [0]=current_days, [1]=min_age_days, [2]=commitment
 * commitment = Poseidon(birthdate_days, salt)  ← must match circuit line 31
 */
export function useZKProver() {

  const _readGateway = useCallback(() => {
    const provider = new ethers.BrowserProvider(window.ethereum)
    return new ethers.Contract(CONTRACTS.ZK_GATEWAY, ZKGatewayABI, provider)
  }, [])

  const _loadSnarkjs = useCallback(async () => {
    if (window.snarkjs) return window.snarkjs
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/snarkjs@0.7.4/build/snarkjs.min.js'
      s.onload  = resolve
      s.onerror = () => reject(new Error('Failed to load snarkjs'))
      document.head.appendChild(s)
    })
    return window.snarkjs
  }, [])

  /**
   * @param {string} birthdateISO  — "YYYY-MM-DD"
   * @param {number} minAgeYears   — e.g. 18
   * @param {string} saltHex       — 32-byte hex from crypto.getRandomValues
   * @param {function} onProgress  — callback(string)
   */
  const generateAndVerifyAgeProof = useCallback(async (
    birthdateISO,
    minAgeYears,
    saltHex,
    onProgress = () => {}
  ) => {
    onProgress('Loading snarkjs…')
    const snarkjs = await _loadSnarkjs()

    onProgress('Computing Poseidon commitment…')

    // Days since Unix epoch
    const birthdate_days = Math.floor(new Date(birthdateISO).getTime() / 86400000)
    const current_days   = Math.floor(Date.now() / 86400000)
    const min_age_days   = minAgeYears * 365
    const saltBig        = BigInt(saltHex.startsWith('0x') ? saltHex : '0x' + saltHex)

    // Compute Poseidon(birthdate_days, salt) using circomlibjs npm package
    // This MUST match what the circuit computes at line 31: commitment === hasher.out
    const poseidon   = await buildPoseidon()
    const hashResult = poseidon([BigInt(birthdate_days), saltBig])
    const commitment = poseidon.F.toString(hashResult)

    onProgress('Fetching circuit files…')
    const [wasmResp, zkeyResp] = await Promise.all([
      fetch('/zk/AgeVerifier/AgeVerifier.wasm'),
      fetch('/zk/AgeVerifier/AgeVerifier_final.zkey'),
    ])
    if (!wasmResp.ok) throw new Error('AgeVerifier.wasm not found in /public/zk/AgeVerifier/')
    if (!zkeyResp.ok) throw new Error('AgeVerifier_final.zkey not found in /public/zk/AgeVerifier/')

    const wasmBuffer = await wasmResp.arrayBuffer()
    const zkeyBuffer = await zkeyResp.arrayBuffer()

    onProgress('Generating ZK proof in browser (~5–10s)…')

    // All 5 signals must be passed — 2 private (birthdate_days, salt) + 3 public
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        birthdate_days: birthdate_days.toString(),
        salt:           saltBig.toString(),
        current_days:   current_days.toString(),
        min_age_days:   min_age_days.toString(),
        commitment,                               // ← must equal Poseidon(birthdate, salt)
      },
      new Uint8Array(wasmBuffer),
      new Uint8Array(zkeyBuffer)
    )

    onProgress('Proof generated! Verifying on-chain…')

    // pi_b coords are swapped per EVM Groth16 convention
    const proofStruct = {
      a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
      b: [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
      ],
      c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
    }

    const gateway = _readGateway()
    const valid = await gateway.verifyAgeProof(proofStruct, publicSignals.map(s => BigInt(s)))

    return { proof, publicSignals, proofStruct, valid, commitment, current_days, birthdate_days, min_age_days }
  }, [_loadSnarkjs, _readGateway])

  const isNullifierUsed = useCallback(async (nullifierHashHex) => {
    return _readGateway().isNullifierUsed(nullifierHashHex)
  }, [_readGateway])

  return { generateAndVerifyAgeProof, isNullifierUsed }
}