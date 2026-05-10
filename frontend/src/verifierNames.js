/**
 * @file verifierNames.js
 * @description Maps verifier Ethereum addresses to human-readable organisation names.
 *
 * Names are stored in localStorage so the admin can set them from the Admin Panel UI.
 * A hardcoded fallback map is used if no localStorage entry exists.
 */

const LS_KEY = 'blocksybils_verifier_names'

// ─── Hardcoded fallback (used if admin hasn't set a name yet) ─────────────────
// Add addresses here as a last-resort fallback. Keys must be lowercase.
const VERIFIER_NAMES_FALLBACK = {
  // '0xabc...': 'My Org Name',
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function _readStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch { return {} }
}

/**
 * Returns the organisation name for a verifier address, or null if not set.
 * Checks localStorage first, then hardcoded fallback.
 */
export function getVerifierName(address) {
  if (!address) return null
  const key = address.toLowerCase()
  const stored = _readStore()[key]
  if (stored) return stored
  return VERIFIER_NAMES_FALLBACK[key] || null
}

/**
 * Returns a display label: org name if set, otherwise a truncated address.
 */
export function getVerifierDisplay(address) {
  if (!address) return 'Unknown'
  const name = getVerifierName(address)
  return name ?? `${address.slice(0, 10)}…${address.slice(-6)}`
}

/**
 * Saves an organisation name for a verifier address to localStorage.
 * Called from the Admin Panel when the admin sets a name.
 * @param {string} address  — Ethereum address (any case)
 * @param {string} name     — Organisation name to display
 */
export function setVerifierName(address, name) {
  if (!address) return
  try {
    const store = _readStore()
    const key = address.toLowerCase()
    if (name && name.trim()) {
      store[key] = name.trim()
    } else {
      delete store[key] // clear if empty
    }
    localStorage.setItem(LS_KEY, JSON.stringify(store))
  } catch {}
}

/**
 * Returns all stored address→name entries from localStorage.
 * @returns {Record<string, string>}
 */
export function getAllStoredNames() {
  return _readStore()
}
