import React, { useState, useEffect, useCallback } from 'react';
import { initFirebase } from './services/firebaseService';
import { connectWallet, initializeReadOnlyProvider } from './services/blockchainService';
import type { Status, View, Product, Web3State } from './types';
import { AdminView } from './components/AdminView';
import { ConsumerView } from './components/ConsumerView';
import { AIAuditView } from './components/AIAuditView'; 
import { StatusBox } from './components/StatusBox';
import { TabButton } from './components/TabButton';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('admin');
  const [status, setStatus] = useState<Status>({ message: 'Initializing...', type: 'info' });
  const [userId, setUserId] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{product: Partial<Product>, status: 'Authentic' | 'Warning' | 'NotFound' | 'Critical', id: string, onChainStatus: string} | null>(null);
  
  const [web3State, setWeb3State] = useState<Web3State>({
    provider: null,
    signer: null,
    contract: null,
    readOnlyContract: null,
    address: null,
  });

  const updateStatus = useCallback((message: string, type: Status['type'] = 'info', duration: number = 0) => {
    setStatus({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        // Only revert if the current message is the one we set
        setStatus(currentStatus => {
          if (currentStatus.message === message) {
            let defaultMsg = 'Initializing...';
            let defaultType: Status['type'] = 'info';
            if (isFirebaseReady && web3State.address) {
              defaultMsg = '✅ Firebase & Wallet Connected.';
              defaultType = 'success';
            } else if (isFirebaseReady) {
              defaultMsg = '✅ Firebase Connected. Wallet needed for registration.';
              defaultType = 'warning';
            }
            return { message: defaultMsg, type: defaultType };
          }
          return currentStatus;
        });
      }, duration);
    }
  }, [isFirebaseReady, web3State.address]);

  useEffect(() => {
    initFirebase(
      (user) => {
        setUserId(user.uid);
        setIsFirebaseReady(true);
        if (web3State.address) {
          updateStatus('✅ Firebase & Wallet Connected.', 'success');
        } else {
          updateStatus('✅ Firebase Connected. Wallet needed for registration.', 'warning');
        }
      },
      (error) => {
        console.error("Firebase Auth Error:", error);
        setIsFirebaseReady(false);
        updateStatus('❌ Anonymous Auth Failed. Check Firebase Console rules.', 'error', 6000);
      }
    );

    const initWeb3 = async () => {
        try {
            const readOnly = await initializeReadOnlyProvider();
            setWeb3State(prevState => ({ ...prevState, readOnlyContract: readOnly.contract }));
        } catch (error) {
            if (error instanceof Error) {
                updateStatus(`⚠️ ${error.message}`, 'warning', 4000);
            }
        }
    };
    initWeb3();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectWallet = async () => {
    try {
      updateStatus('🔌 Connecting to wallet...', 'info');
      const { provider, signer, contract, address } = await connectWallet();
      setWeb3State(prevState => ({...prevState, provider, signer, contract, address}));
      const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
      updateStatus(`✅ Wallet Connected: ${shortAddress}`, 'success');
    } catch (error) {
      if (error instanceof Error) {
        updateStatus(`❌ Wallet connection failed: ${error.message}`, 'error', 4000);
      }
    }
  };

  const setActiveViewHandler = (viewId: View) => {
    setActiveView(viewId);
    setVerificationResult(null); // Reset results on view change
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Chronos Ledger</h1>
          <p className="text-sm text-gray-500">(Core Build with Blockchain)</p>
        </header>

        <StatusBox status={status} />

        {!web3State.address && (
          <button
            type="button"
            id="connectWalletBtn"
            onClick={handleConnectWallet}
            className="w-full text-base py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Connect Web3 Wallet (Ethers.js)
          </button>
        )}

        <nav className="flex border-b border-gray-200">
          <TabButton
            label="Admin"
            isActive={activeView === 'admin'}
            onClick={() => setActiveViewHandler('admin')}
          />
          <TabButton
            label="Consumer"
            isActive={activeView === 'consumer'}
            onClick={() => setActiveViewHandler('consumer')}
          />
           <TabButton
            label="AI Audit"
            isActive={activeView === 'aiAudit'}
            onClick={() => setActiveViewHandler('aiAudit')}
          />
        </nav>

        <main>
          {activeView === 'admin' && (
            <AdminView 
              isReady={isFirebaseReady && !!web3State.signer} 
              userId={userId} 
              updateStatus={updateStatus} 
              contract={web3State.contract}
            />
          )}
          {activeView === 'consumer' && (
            <ConsumerView 
              isReady={isFirebaseReady} 
              updateStatus={updateStatus} 
              verificationResult={verificationResult}
              setVerificationResult={setVerificationResult}
              readOnlyContract={web3State.readOnlyContract}
              userId={userId}
            />
          )}
          {activeView === 'aiAudit' && (
            <AIAuditView 
              updateStatus={updateStatus} 
              walletAddress={web3State.address} 
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
