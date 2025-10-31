import { ethers, type BrowserProvider, type Contract, type Signer, type TransactionResponse } from 'ethers';
import { CONTRACT_ABI } from './contractABI';

// --- BLOCKCHAIN INTEGRATION DETAILS ---
const CONTRACT_ADDRESS = "0x7De200c52a1cbd8156CDbebb6b322e036D3d5838"; // Sepolia Testnet Address

export const connectWallet = async (): Promise<{ provider: BrowserProvider, signer: Signer, contract: Contract, address: string }> => {
    if (!window.ethereum) {
        throw new Error("No Web3 Wallet (like MetaMask) detected.");
    }
    // Fix: Check the imported module object directly, not the window global.
    if (!ethers) {
        throw new Error("Ethers.js library not loaded via module import.");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    return { provider, signer, contract, address };
};

export const initializeReadOnlyProvider = async (): Promise<{ provider: BrowserProvider, contract: Contract }> => {
    if (!window.ethereum) {
        throw new Error("No Web3 provider found. Read-only checks might fail.");
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    return { provider, contract };
};

export const registerHashOnChain = async (contract: Contract, hash: string): Promise<TransactionResponse> => {
    if (!contract) {
        throw new Error("Contract is not initialized.");
    }
    const tx: TransactionResponse = await contract.registerHash(hash);
    return tx;
};

export const isHashRegisteredOnChain = async (contract: Contract | null, hash: string | undefined): Promise<{isRegistered: boolean, onChainStatus: string}> => {
    if (!contract) {
        return { isRegistered: false, onChainStatus: 'UNKNOWN (Provider Missing)' };
    }
    if (!hash) {
        return { isRegistered: false, onChainStatus: 'N/A (No Hash Stored)' };
    }
    try {
        const isRegistered = await contract.isRegistered(hash);
        const onChainStatus = isRegistered ? 'VERIFIED (Hash Registered)' : 'FAILED (Hash Not Registered)';
        return { isRegistered, onChainStatus };
    } catch (error) {
        console.error("Blockchain ReadError:", error);
        return { isRegistered: false, onChainStatus: 'ERROR (Check Failed)' };
    }
};