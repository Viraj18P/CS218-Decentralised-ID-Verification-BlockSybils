// frontend/src/contracts.js

export const CONTRACTS = {
  IDENTITY_REGISTRY: '0xbD0A4573B4aeAAe856A381f244eD693bBB894b2D',
  KYC_AUCTION:       '0x98aFf71590E78Eb199F651767Fa66B9115D3B719',
  ZK_GATEWAY: '0x1e4589Bb6e79a85a78489A63650f96d6999927BC',
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