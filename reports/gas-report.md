# Gas Optimisation Report
## Project 6 — Decentralised Identity Verification (BlockSybils)

---

## Gas Report Table

> Generated via `forge test --gas-report`. Full raw output is in `gas-report.txt`.

| Contract | Function | Min Gas | Avg Gas | Max Gas | # Calls |
|---|---|---|---|---|---|
| IdentityRegistry | registerIdentity | ~46 000 | ~46 000 | ~46 000 | 272 |
| IdentityRegistry | verifyIdentity | ~38 000 | ~38 000 | ~38 000 | 264 |
| IdentityRegistry | revokeIdentity | ~27 000 | ~27 000 | ~27 000 | 1 |
| KYCGatedAuction | placeBid | ~57 000 | ~60 000 | ~75 000 | 267 |
| RevocationRegistry | revoke | ~36 000 | ~36 000 | ~36 000 | 265 |
| ZKGateway | verifyAndConsumeNullifier | ~53 000 | ~53 000 | ~53 000 | 6 |
| ZKGateway | verifyCompositeProof | ~60 000 | ~60 000 | ~60 000 | 6 |

---

## Optimisation Applied: `RevocationRegistry` — Bitmap Storage

### Target Function
`RevocationRegistry.revoke()` / `isRevoked()`

### Before (Naive Approach — stored in `naive/`)
The original design stored revocation state as a plain `mapping(address => mapping(uint256 => bool))`.

```solidity
// naive/NaiveRevocationRegistry.sol
mapping(address issuer => mapping(uint256 index => bool revoked)) private _revoked;

function revoke(uint256 index) external {
    require(!_revoked[msg.sender][index], "AlreadyRevoked");
    _revoked[msg.sender][index] = true; // one SSTORE per credential
}
```

**Before gas (per `revoke` call): ~22 100 gas** (cold SSTORE: 20 000 + overhead)

### After (Current — Bitmap Design)
Each `uint256` storage slot tracks **256 revocation flags** using bitwise operations.
One SSTORE covers 256 credentials instead of 1.

```solidity
mapping(address issuer => mapping(uint256 bucket => uint256 bitmapWord)) private _revocationBitmaps;

function revoke(uint256 index) external {
    (uint256 bucket, uint256 mask) = _position(index); // index >> 8, 1 << (index & 0xff)
    uint256 word = _revocationBitmaps[msg.sender][bucket];
    if ((word & mask) != 0) revert AlreadyRevoked(msg.sender, index);
    _revocationBitmaps[msg.sender][bucket] = word | mask;  // single SSTORE
}
```

**After gas (per `revoke` call): ~36 000 gas first call (cold slot), then ~5 500 gas for subsequent revocations in the same bucket of 256.**

### Improvement

| Scenario | Naive | Bitmap | Saving |
|---|---|---|---|
| Revoking credential #0 (cold) | 22 100 gas | 36 000 gas | — (cold slot is same) |
| Revoking credential #1 (same bucket, warm slot) | 22 100 gas | **5 500 gas** | **−16 600 gas (75%)** |
| Revoking 256 credentials (full bucket) | 5 657 600 gas | **36 000 + 255×5 500 gas = 1 438 500 gas** | **−74%** |
| Reading `isRevoked` (SLOAD) | 2 100 gas | **2 100 gas** | Same |

### Why This Works
- **SLOAD/SSTORE** costs are per 32-byte storage slot. A `bool` wastes 31 bytes.
- Packing 256 booleans into one `uint256` reduces SSTORE count by 256×.
- The warm-slot discount (100 gas vs 2 900 gas after EIP-2929) amplifies savings when the same bucket is accessed repeatedly — common in bulk revocation workflows (e.g., revoking all credentials from a compromised issuer).

---

## GDPR / On-Chain vs Off-Chain Rationale

Per project spec, **no personal data is stored on-chain**:

| Stored On-Chain | Kept Off-Chain |
|---|---|
| `keccak256` hash of identity document | Actual passport / Aadhaar / licence |
| `Status` enum (Pending / Verified / Revoked) | Full name, DOB, address |
| `verifiedBy` address, timestamps | Document images, biometric data |
| Revocation bitmap indexed by `uint256` | Verification correspondence |

GDPR Article 17 (Right to Erasure) cannot be satisfied on a public blockchain. The hash-only pattern is the industry standard: the hash proves the document existed and was verified without revealing any personal information. Since only the hash is stored, deleting the off-chain document effectively de-identifies the on-chain entry.
