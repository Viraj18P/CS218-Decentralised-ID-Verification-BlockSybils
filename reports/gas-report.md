# Gas Optimisation Report
## Project 6 - Decentralised Identity Verification (BlockSybils)

---

## Gas Report Table

> Generated via `forge test --gas-report`. Full raw output is in `gas-report.txt`.

| Contract | Function | Min Gas | Avg Gas | Max Gas | # Calls |
|---|---:|---:|---:|---:|---:|
| IdentityRegistry | registerIdentity | 21,971 | 71,576 | 71,902 | 299 |
| IdentityRegistry | verifyIdentity | 24,513 | 54,273 | 54,668 | 293 |
| IdentityRegistry | revokeIdentity | 24,470 | 30,512 | 36,932 | 7 |
| KYCGatedAuction | placeBid | 28,982 | 77,394 | 78,350 | 273 |
| RevocationRegistry | revoke | 24,313 | 46,404 | 46,867 | 269 |
| ZKGateway | verifyAndConsumeNullifier | 23,673 | 41,012 | 63,195 | 6 |
| ZKGateway | verifyCompositeProof | 25,252 | 43,152 | 70,375 | 7 |

---

## Optimisation Applied: `IdentityRegistry` - Direct Mapping Status Check

### Target Function
`IdentityRegistry.registerIdentity()`

### Before (Baseline Approach - shown in `report.pdf`)
The baseline design tracked registered users in an auxiliary array and scanned it before each registration. This made registration more expensive as the number of registered users increased.

```solidity
address[] private _registeredUsers;

for (uint256 i = 0; i < _registeredUsers.length; i++) {
    require(_registeredUsers[i] != msg.sender, "Already registered");
}

_registeredUsers.push(msg.sender);
```

**Before gas (`registerIdentity`): 114,952 gas** according to the baseline figure in `report.pdf`.

### After (Optimised - Direct Status Lookup)
The optimised design checks the caller's registration state directly from the `_identities` mapping. This removes the linear scan and avoids pushing to an auxiliary bookkeeping array.

```solidity
require(
    _identities[msg.sender].status == Status.NotRegistered,
    "Already registered"
);

// No auxiliary user array push.
```

**After gas (`registerIdentity`): 71,576 gas average** in `gas-report.txt`.

### Improvement

| Scenario | Baseline | Optimised | Saving |
|---|---:|---:|---:|
| Single `registerIdentity` call | 114,952 gas | 71,576 gas | 43,376 gas |
| Percentage reduction | 100% | 62.3% of baseline | 37.7% |
| Storage pattern | Mapping + array push | Mapping status only | Removes extra storage write |
| Scaling behavior | Linear scan over registered users | Constant-time mapping read | Lower growth cost |

### Why This Works
- Registration status already exists in the `Identity` struct, so `_registeredUsers` duplicates state.
- A direct mapping lookup avoids looping over every registered address.
- Removing the array push also removes unnecessary on-chain bookkeeping.
- Events can still provide an off-chain registration history without storing an extra list on-chain.

---

## Optimisation Applied: `KYCGatedAuction` - Event-Based Bid History

### Target Function
`KYCGatedAuction.placeBid()`

### Before (Baseline Approach - shown in `report.pdf`)
The baseline auction stored each bid in an on-chain history array. This made every successful bid pay for storage that was not needed by the auction's settlement logic.

```solidity
struct BidRecord {
    address bidder;
    uint256 amount;
}

BidRecord[] private _bidHistory;

_bidHistory.push(BidRecord({
    bidder: msg.sender,
    amount: msg.value
}));
```

**Before gas (`placeBid`): 142,516 gas** according to the baseline figure in `report.pdf`.

### After (Optimised - State + Events Only)
The optimised path keeps only the state needed to run the auction: the current highest bidder, current highest bid, refunds, and an event log for bid history.

```solidity
// Removed on-chain bid history storage.
highestBidder = msg.sender;
highestBid = msg.value;

emit BidPlaced(msg.sender, msg.value);
```

**After gas (`placeBid`): 77,394 gas average** in `gas-report.txt`.

### Improvement

| Scenario | Baseline | Optimised | Saving |
|---|---:|---:|---:|
| Single successful `placeBid` call | 142,516 gas | 77,394 gas | 65,122 gas |
| Percentage reduction | 100% | 54.3% of baseline | 45.7% |
| Bid history | Stored in contract storage | Emitted as events | Removes redundant SSTOREs |
| Auction settlement | Uses highest bid state | Uses highest bid state | Same behavior |

### Why This Works
- The contract only needs `highestBidder`, `highestBid`, and `pendingReturns` to settle the auction.
- Historical bids are better represented by `BidPlaced` events, which are cheaper than persistent storage.
- Removing `_bidHistory.push(...)` avoids writing a new storage record for every bid.
- This keeps the on-chain state minimal while preserving auditability through logs.

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
