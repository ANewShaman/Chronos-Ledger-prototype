import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { sha256 } from 'js-sha256';
import type { Contract, Signer } from 'ethers';
import { generateProductHash } from '../utils/hashing';
import { registerHashOnChain } from '../services/blockchainService';
import { registerProduct } from '../services/firebaseService';
import type { Status, Product } from '../types';

interface AdminViewProps {
  isReady: boolean;
  userId: string | null;
  updateStatus: (message: string, type: Status['type'], duration?: number) => void;
  contract: Contract | null;
}

export const AdminView: React.FC<AdminViewProps> = ({ isReady, userId, updateStatus, contract }) => {
  const [productName, setProductName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !batchId || !mfgDate) {
      updateStatus('Please fill in all product fields.', 'error', 3000);
      return;
    }
    if (!isReady || !contract || !userId) {
      updateStatus('Admin panel is not ready. Connect wallet and ensure Firebase is initialized.', 'error', 4000);
      return;
    }

    setIsLoading(true);

    try {
      updateStatus('Generating product hash...', 'info');
      const productHash = generateProductHash({ productName, batchId, mfgDate });

      updateStatus('Sending transaction to blockchain...', 'info');
      const tx = await registerHashOnChain(contract, productHash);
      updateStatus(`Transaction sent! Waiting for confirmation (Tx: ${tx.hash.substring(0, 10)}...)`, 'info');
      await tx.wait();

      updateStatus('Transaction confirmed! Registering product in database...', 'info');
      const registrantAddress = await (contract.runner as Signer)?.getAddress();
      if (!registrantAddress) throw new Error('Could not get registrant address.');

      const productData: Omit<Product, 'registeredAt'> = {
        productName,
        batchId,
        mfgDate,
        status: 'Authentic',
        registeredBy: registrantAddress,
        contractHash: productHash,
        txHash: tx.hash,
      };

      const { docId } = await registerProduct(productData);
      updateStatus(`✅ Product registered successfully! Document ID: ${docId}`, 'success', 6000);

      const qrUrl = generateQrFor(docId, batchId);
      setQrValue(qrUrl);

      setProductName('');
      setBatchId('');
      setMfgDate('');
    } catch (error: any) {
      console.error('Registration Error:', error);

      // user-friendly error messages
      let message = 'An unknown error occurred.';
      if (error?.reason?.includes('Hash already registered')) {
        message = '⚠️ Hash already exists! Please try again with a new file.';
      } else if (error?.code === 'NETWORK_ERROR') {
        message = '⚠️ Network error — please check your connection or MetaMask network.';
      } else if (error instanceof Error) {
        message = error.message;
      }

      updateStatus(message, 'error', 6000);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQrFor = (productId?: string, batchId?: string) => {
    if (!productId && !batchId) return null;
    const token = sha256((productId || '') + '::' + (batchId || ''));
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/verify?productId=${encodeURIComponent(productId || '')}&token=${token}`;
  };

  const handleDownloadQr = (canvasId = 'admin-product-qr-canvas') => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_${Date.now()}.png`;
    a.click();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div>
        <label htmlFor="productName" className="block text-sm font-medium text-gray-700">
          Product Name
        </label>
        <input
          type="text"
          id="productName"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g., Premium Green Tea"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="batchId" className="block text-sm font-medium text-gray-700">
          Batch ID
        </label>
        <input
          type="text"
          id="batchId"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g., B-481516"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="mfgDate" className="block text-sm font-medium text-gray-700">
          Manufacturing Date
        </label>
        <input
          type="date"
          id="mfgDate"
          value={mfgDate}
          onChange={(e) => setMfgDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          disabled={isLoading}
        />
      </div>

      {qrValue && (
        <div className="mt-3 text-center">
          <QRCodeCanvas id="admin-product-qr-canvas" value={qrValue} size={160} level={'H'} includeMargin={true} />
          <div className="mt-2">
            <button
              type="button"
              onClick={() => handleDownloadQr('admin-product-qr-canvas')}
              className="px-3 py-1 bg-gray-800 text-white rounded-md text-sm"
            >
              Download QR (PNG)
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!isReady || isLoading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registering...' : 'Register Product on Ledger'}
      </button>

      {!isReady && (
        <p className="text-xs text-center text-yellow-600 mt-2">
          Connect your wallet to enable registration.
        </p>
      )}
    </form>
  );
};
