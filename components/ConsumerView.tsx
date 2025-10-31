import React, { useState, useEffect, useRef, useCallback } from 'react';
import { verifyProduct, submitProductReport } from '../services/firebaseService';
import { isHashRegisteredOnChain } from '../services/blockchainService';
import type { Status, Product } from '../types';
import type { Contract } from 'ethers';
import { Html5Qrcode } from 'html5-qrcode';

type VerificationStatus = 'Authentic' | 'Warning' | 'NotFound' | 'Critical';
type VerificationResult = {
  product: Partial<Product>;
  status: VerificationStatus;
  id: string;
  onChainStatus: string;
};

interface ConsumerViewProps {
  isReady: boolean;
  updateStatus: (message: string, type: Status['type'], duration?: number) => void;
  verificationResult: VerificationResult | null;
  setVerificationResult: React.Dispatch<React.SetStateAction<VerificationResult | null>>;
  readOnlyContract: Contract | null;
  userId: string | null;
}

/* ResultCard kept inside same file for convenience.
   If you have a separate ResultCard component, you can remove this block and import it. */
const ResultCard: React.FC<{ 
  result: VerificationResult | null, 
  userId: string | null,
  updateStatus: ConsumerViewProps['updateStatus']
}> = ({ result, userId, updateStatus }) => {
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  if (!result) return null;
  const { status, product, id, onChainStatus } = result;

  const handleReport = async () => {
    if (!userId) {
      updateStatus('Login required to report product.', 'error', 4000);
      return;
    }
    setIsReporting(true);
    updateStatus('Submitting report...', 'info');
    try {
      await submitProductReport(id, userId);
      setReportSubmitted(true);
      updateStatus('✅ Report submitted successfully!', 'success', 4000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error.';
      updateStatus(`❌ Failed to submit report: ${msg}`, 'error', 5000);
    } finally {
      setIsReporting(false);
    }
  };

  const isCritical = status === 'Critical';
  const isAuthentic = status === 'Authentic';
  const isWarning = status === 'Warning';
  const isNotFound = status === 'NotFound';

  const colorClass = isAuthentic
    ? 'bg-green-50 border-green-200 text-green-800'
    : isWarning
    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
    : 'bg-red-50 border-red-200 text-red-800';

  const title = isAuthentic
    ? '✅ VERIFIED AUTHENTIC'
    : isWarning
    ? '⚠️ WARNING'
    : isCritical
    ? '🚨 CRITICAL: HASH MISMATCH'
    : '❌ NOT FOUND';

  return (
    <div className={`p-4 rounded-lg border mt-4 ${colorClass}`}>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>

      {!isNotFound ? (
        <>
          <p><strong>Product:</strong> {product?.productName ?? '—'}</p>
          <p><strong>Batch ID:</strong> {product?.batchId ?? '—'}</p>
          <p><strong>Mfg Date:</strong> {product?.mfgDate ?? '—'}</p>
          <p><strong>Registry ID:</strong> {id}</p>
          <p><strong>On-Chain Status:</strong> {onChainStatus}</p>
          {isCritical && (
            <p className="mt-2 text-red-700 font-semibold">
              Blockchain validation failed. Product hash mismatch detected!
            </p>
          )}
        </>
      ) : (
        <p>ID <code>{id}</code> not found in registry.</p>
      )}

      {!isAuthentic && (
        <div className="mt-4 text-center">
          <button
            onClick={handleReport}
            disabled={isReporting || reportSubmitted}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
          >
            {isReporting ? 'Submitting...' : reportSubmitted ? '✅ Reported' : 'Report Product'}
          </button>
        </div>
      )}
    </div>
  );
};


export const ConsumerView: React.FC<ConsumerViewProps> = ({
  isReady,
  updateStatus,
  verificationResult,
  setVerificationResult,
  readOnlyContract,
  userId
}) => {
  const [documentId, setDocumentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const qrReaderRef = useRef<Html5Qrcode | null>(null);

  const handleVerify = useCallback(async (idToVerify: string) => {
    const id = idToVerify.trim();
    if (!id) {
      updateStatus('Enter a valid ID.', 'error', 3000);
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);
    updateStatus('🔍 Checking Firestore...', 'info');

    try {
      const product = await verifyProduct(id); // your firebase service should return product object or null
      if (!product) {
        setVerificationResult({ product: {}, status: 'NotFound', id, onChainStatus: 'Not Found' });
        updateStatus('Product not found.', 'error', 4000);
        return;
      }

      updateStatus('🔗 Verifying blockchain hash...', 'info');
      const { isRegistered, onChainStatus } = await isHashRegisteredOnChain(readOnlyContract, product.contractHash);

      if (!isRegistered) {
        setVerificationResult({ product, status: 'Critical', id, onChainStatus });
        updateStatus('Critical: On-chain verification failed.', 'error', 5000);
      } else if (product.status === 'Authentic') {
        setVerificationResult({ product, status: 'Authentic', id, onChainStatus });
        updateStatus('Product is authentic!', 'success', 4000);
      } else {
        setVerificationResult({ product, status: 'Warning', id, onChainStatus });
        updateStatus(`Verification warning: status = ${product.status}`, 'warning', 4000);
      }
    } catch (err) {
      console.error('Verification error', err);
      updateStatus('❌ Verification failed. See console for details.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  }, [readOnlyContract, setVerificationResult, updateStatus]);

  const stopScanner = useCallback(async () => {
    const reader = qrReaderRef.current;
    if (reader) {
      try {
        await reader.stop();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      qrReaderRef.current = null;
    }
    setIsScanning(false);
    updateStatus('Scanner stopped.', 'info', 2000);
  }, [updateStatus]);

  const startScanner = useCallback(async () => {
    // Prevent double start
    if (qrReaderRef.current) {
      updateStatus('Scanner already running.', 'info', 1500);
      return;
    }

    const newScanner = new Html5Qrcode('qr-reader');
    qrReaderRef.current = newScanner;
    setIsScanning(true);

    try {
      await newScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // When a code is scanned:
          void (async () => {
            try {
              await stopScanner(); // ensure scanner stops
            } catch (e) {
              /* ignore */
            }
            setDocumentId(decodedText);
            updateStatus('QR Scanned!', 'success', 2000);
            await handleVerify(decodedText);
          })();
        },
        // optional error callback - we ignore most non-fatal scan errors
        (errorMessage: string) => {
          // No-op or log minor scan failures
          // console.debug('scan fail', errorMessage);
        }
      ); // <-- crucial closing of .start(...)
      updateStatus('Scanner active. Point camera at code.', 'info', 2000);
    } catch (err) {
      console.error('Scanner start error:', err);
      updateStatus(`Scanner error: ${String(err)}`, 'error', 4000);
      // ensure state consistent
      qrReaderRef.current = null;
      setIsScanning(false);
    }
  }, [handleVerify, stopScanner, updateStatus]);

  // cleanup on unmount to avoid camera lock
  useEffect(() => {
    return () => {
      if (qrReaderRef.current) {
        // best-effort stop
        qrReaderRef.current.stop().catch(() => {});
        qrReaderRef.current = null;
      }
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Enter Product ID</label>
        <div className="flex space-x-2">
          <input
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="flex-grow px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter product ID"
          />
          <button
            onClick={() => void handleVerify(documentId)}
            disabled={isLoading || !isReady}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={() => { if (isScanning) void stopScanner(); else void startScanner(); }}
          className="px-4 py-2 border rounded-md bg-white hover:bg-gray-50"
        >
          {isScanning ? 'Stop Scan' : 'Scan QR Code'}
        </button>
      </div>

      {isScanning && (
        <div id="qr-reader-container" className="w-full max-w-sm mx-auto bg-gray-100 p-2 rounded-lg">
          <div id="qr-reader" style={{ width: '100%' }}></div>
        </div>
      )}

      <ResultCard
        result={verificationResult}
        userId={userId}
        updateStatus={updateStatus}
        key={verificationResult ? verificationResult.id : 'initial'}
      />
    </div>
  );
};
