/**
 * @file ipfsUtils.js
 * @description IPFS integration using Pinata API
 */

const PINATA_API_URL = "https://api.pinata.cloud";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

/**
 * Create Pinata auth headers
 */
export function getPinataHeaders(pinataApiKey, pinataSecretKey) {
  return {
    pinata_api_key: pinataApiKey,
    pinata_secret_api_key: pinataSecretKey,
  };
}

/**
 * Upload encrypted document to IPFS via Pinata
 */
export async function uploadToIPFS(
  encryptedPackage,
  filename,
  pinataApiKey,
  pinataSecretKey
) {
  try {
    const packageJson = JSON.stringify(encryptedPackage);
    const blob = new Blob([packageJson], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", blob, `${filename}.enc.json`);

    const pinataMetadata = JSON.stringify({
      name: filename,
      timestamp: new Date().toISOString(),
    });
    formData.append("pinataMetadata", pinataMetadata);

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: getPinataHeaders(pinataApiKey, pinataSecretKey),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Pinata upload failed: ${error.error}`);
    }

    const data = await response.json();
    return data.IpfsHash;
  } catch (error) {
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
}

/**
 * Download encrypted package from IPFS
 */
export async function downloadFromIPFS(cid) {
  try {
    const url = `${IPFS_GATEWAY}/${cid}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to download from IPFS: ${error.message}`);
  }
}

/**
 * Download with fallback gateways
 */
export async function downloadFromIPFSWithFallback(cid) {
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.web3.storage/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
  ];

  let lastError;
  for (const url of gateways) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw new Error(`Failed to download from IPFS: ${lastError?.message}`);
}

/**
 * Test Pinata connection
 */
export async function testPinataConnection(pinataApiKey, pinataSecretKey) {
  try {
    const response = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
      method: "GET",
      headers: getPinataHeaders(pinataApiKey, pinataSecretKey),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Validate IPFS CID format
 */
export function isValidCID(cid) {
  const cidv0Regex = /^Qm[a-z0-9]{44}$/;
  const cidv1Regex = /^bafy[a-z2-7]{55}$/;
  return cidv0Regex.test(cid) || cidv1Regex.test(cid);
}

/**
 * Get IPFS gateway URL
 */
export function getIPFSUrl(cid) {
  return `${IPFS_GATEWAY}/${cid}`;
}
