// frontend/src/contracts.js

export const CONTRACTS = {
  IDENTITY_REGISTRY: '0x928C475EF32Acb7f06A81162C57312ac080983E6',
  KYC_AUCTION:       '0x61E0d6Ab6277c5f75407BEEE90451156BC72311d',
  ZK_GATEWAY:        '0x9706227347cfe349c07f3367D3ca8931FE20f64d',
};

export const REQUIRED_CHAIN_ID = 11155111;
export const CHAIN_NAME = 'Sepolia Testnet';

// ABIs for use with ethers.js or wagmi
export const ZK_GATEWAY_ABI = [
  {
    "inputs": [
      { "internalType": "uint[2]", "name": "a", "type": "uint[2]" },
      { "internalType": "uint[2][2]", "name": "b", "type": "uint[2][2]" },
      { "internalType": "uint[2]", "name": "c", "type": "uint[2]" },
      { "internalType": "uint[3]", "name": "input", "type": "uint[3]" }
    ],
    "name": "verifyAndRegister",
    "outputs": [],
    "stateMutability": "external",
    "type": "function"
  }
];

export const IDENTITY_REGISTRY_ABI = [
  "function isVerified(address user) external view returns (bool)",
  "function updateVerificationStatus(address user, bool status) external"
];

export const KYC_AUCTION_ABI = [
  "function placeBid(uint256 amount) external",
  "function getHighestBid() external view returns (uint256)"
];