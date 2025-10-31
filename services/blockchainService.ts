import { ethers, type BrowserProvider, type Contract, type Signer, type TransactionResponse } from "ethers";
import { CONTRACT_ABI } from "./contractABI";

// --- BLOCKCHAIN INTEGRATION DETAILS ---
const CONTRACT_ADDRESS = "0x7De200c52a1cbd8156CDbebb6b322e036D3d5838"; // Sepolia contract address
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // Hex chain ID for Sepolia!!!

export const connectWallet = async (): Promise<{
  provider: BrowserProvider;
  signer: Signer;
  contract: Contract;
  address: string;
}> => {
  if (!window.ethereum) {
    throw new Error("No Web3 Wallet (like MetaMask) detected.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  // Ensure MetaMask is on Sepolia !!BEFORE!! connecting
  const currentNetwork = await provider.getNetwork();
  if (currentNetwork.chainId !== 11155111n) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      console.log("Switched to Sepolia network");
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        // If Sepolia isn’t added yet
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: "Sepolia Test Network",
              rpcUrls: ["https://rpc.sepolia.org"],
              nativeCurrency: {
                name: "SepoliaETH",
                symbol: "SEPETH",
                decimals: 18,
              },
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw new Error("Please switch to Sepolia Test Network in MetaMask.");
      }
    }
  }

  // ✅ Now safely request account access and get signer
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  console.log("✅ Connected to Sepolia as:", address);
  return { provider, signer, contract, address };
};

export const initializeReadOnlyProvider = async (): Promise<{
  provider: BrowserProvider;
  contract: Contract;
}> => {
  if (!window.ethereum) {
    throw new Error("No Web3 provider found. Read-only checks might fail.");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  return { provider, contract };
};

export const registerHashOnChain = async (
  contract: Contract,
  hash: string
): Promise<TransactionResponse> => {
  if (!contract) throw new Error("Contract is not initialized.");
  console.log("📦 Registering hash on chain:", hash);
  const tx: TransactionResponse = await contract.registerHash(hash);
  console.log("✅ Transaction sent:", tx.hash);
  return tx;
};

export const isHashRegisteredOnChain = async (
  contract: Contract | null,
  hash: string | undefined
): Promise<{ isRegistered: boolean; onChainStatus: string }> => {
  if (!contract) {
    return { isRegistered: false, onChainStatus: "UNKNOWN (Provider Missing)" };
  }
  if (!hash) {
    return { isRegistered: false, onChainStatus: "N/A (No Hash Stored)" };
  }
  try {
    const isRegistered = await contract.isRegistered(hash);
    const onChainStatus = isRegistered
      ? "VERIFIED (Hash Registered)"
      : "FAILED (Hash Not Registered)";
    return { isRegistered, onChainStatus };
  } catch (error) {
    console.error("Blockchain ReadError:", error);
    return { isRegistered: false, onChainStatus: "ERROR (Check Failed)" };
  }
};
