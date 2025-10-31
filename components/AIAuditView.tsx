import React, { useState, useMemo } from 'react';
import { runAIAudit } from '../services/geminiService';
import { getProductAuditTrail } from '../services/firebaseService';
import type { Status, AIAuditResult, AuditTrail } from '../types';

interface AIAuditViewProps {
  updateStatus: (message: string, type: Status['type'], duration?: number) => void;
  walletAddress: string | null;
}

export const AIAuditView: React.FC<AIAuditViewProps> = ({ updateStatus, walletAddress }) => {
  // State for CSV Audit
  const [file, setFile] = useState<File | null>(null);
  const [isAuditing, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AIAuditResult | null>(null);

  // State for Product History Search
  const [auditProductId, setAuditProductId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null);

  const auditSummary = useMemo(() => {
    if (!auditResult) {
      return null;
    }
    const total = auditResult.length;
    const compliant = auditResult.filter(item => item.isCompliant).length;
    const flagged = total - compliant;
    return { total, compliant, flagged };
  }, [auditResult]);

  const handleExport = () => {
    if (!auditResult) return;
    
    const headers = ['Status', 'Product Name', 'Batch ID', 'Flag Reason'];
    const rows = auditResult.map(item => {
        const status = item.isCompliant ? 'Compliant' : 'FLAGGED';
        const escapeCsvCell = (cellData: string) => `"${cellData.replace(/"/g, '""')}"`;
        
        return [
            status,
            escapeCsvCell(item.productName),
            escapeCsvCell(item.batchId),
            item.isCompliant ? 'N/A' : escapeCsvCell(item.reason)
        ].join(',');
    });

    const csvString = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ai_audit_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAuditResult(null);
    }
  };

  const handleRunAudit = async () => {
    if (!file) {
      updateStatus('Please select a CSV file to audit.', 'error', 3000);
      return;
    }

    setIsLoading(true);
    setAuditResult(null);
    updateStatus('Reading file and preparing AI audit...', 'info');

    try {
      const csvData = await file.text();
      updateStatus('File data sent to AI. Awaiting analysis...', 'info');
      const result = await runAIAudit(csvData);
      setAuditResult(result);
      updateStatus('AI audit complete!', 'success', 4000);
    } catch (error) {
      console.error("AI Audit Error:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      updateStatus(`❌ AI Audit Failed: ${errorMessage}`, 'error', 6000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchAuditTrail = async () => {
    if (!auditProductId.trim()) {
        updateStatus('Please enter a product ID.', 'error', 3000);
        return;
    }
    setIsSearching(true);
    setAuditTrail(null);
    updateStatus(`Searching audit trail for ID: ${auditProductId}`, 'info');

    try {
        const trail = await getProductAuditTrail(auditProductId.trim());

        if (!trail) {
            updateStatus('Product ID not found.', 'error', 4000);
            setAuditTrail(null);
            return;
        }

        setAuditTrail(trail);
        updateStatus('Audit trail retrieved successfully.', 'success', 3000);

    } catch (error) {
        console.error("Audit Trail Search Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        updateStatus(`❌ Search Failed: ${errorMessage}`, 'error', 6000);
    } finally {
        setIsSearching(false);
    }
  };
  
  if (!walletAddress) {
    return (
        <div className="text-center p-8 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 animate-fade-in">
            <p className="font-bold text-lg">Wallet Disconnected: Audit Access Denied</p>
            <p className="mt-2">Please connect your designated Auditor wallet to load confidential AI Audit Metrics and the Manual Review Queue.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* CSV AUDIT SECTION */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">AI-Powered Batch Audit</h3>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV of new product batches. The AI will analyze it for compliance and anomalies based on established rules and historical data.
        </p>
      
        <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
            disabled={isAuditing}
          />
          <button
            onClick={handleRunAudit}
            disabled={!file || isAuditing}
            className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isAuditing ? 'Auditing...' : 'Run AI Audit'}
          </button>
        </div>

        {auditResult && auditSummary && (
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-gray-700">Audit Summary:</h4>
              <button
                onClick={handleExport}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Export to Sheets
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-blue-100 rounded-lg shadow">
                    <p className="text-sm text-gray-600">Total Batches Audited</p>
                    <p className="text-2xl font-bold text-blue-800">{auditSummary.total}</p>
                </div>
                <div className="p-4 bg-green-100 rounded-lg shadow">
                    <p className="text-sm text-gray-600">Passed (No Action Needed)</p>
                    <p className="text-2xl font-bold text-green-800">{auditSummary.compliant}</p>
                </div>
                <div className="p-4 bg-red-100 rounded-lg shadow">
                    <p className="text-sm text-gray-600">Flagged (Manual Review Queue)</p>
                    <p className="text-2xl font-bold text-red-800">{auditSummary.flagged}</p>
                </div>
            </div>

            <div className="overflow-x-auto mt-2 border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flag Reason</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {auditResult.map((item, index) => (
                            <tr key={index} className={!item.isCompliant ? 'bg-red-50' : ''}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    {item.isCompliant ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Compliant
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                            FLAGGED
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.productName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.batchId}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">{item.isCompliant ? 'N/A' : item.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      <hr />

      {/* PRODUCT HISTORY SEARCH SECTION */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">Product Audit Trail</h3>
        <p className="text-sm text-gray-500 mt-1">
          Enter a product's document ID to view its registration history and any associated reports.
        </p>

        <div>
            <label htmlFor="auditProductIdInput" className="block text-sm font-medium text-gray-700 mb-1">Product ID to Audit</label>
            <div className="flex flex-col sm:flex-row sm:space-x-2">
              <input
                  type="text"
                  id="auditProductIdInput"
                  value={auditProductId}
                  onChange={(e) => setAuditProductId(e.target.value)}
                  className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter document ID"
                  disabled={isSearching}
              />
              <button
                  id="searchAuditBtn"
                  type="button"
                  onClick={handleSearchAuditTrail}
                  disabled={isSearching || !auditProductId}
                  className="mt-2 sm:mt-0 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                  {isSearching ? 'Searching...' : 'Search History'}
              </button>
            </div>
        </div>

        {auditTrail && (
            <div id="auditResultsArea" className="mt-4 p-4 border rounded-lg bg-gray-50 animate-fade-in">
                <h4 className="font-semibold text-gray-800 mb-3">Audit Trail for: <span className="font-normal">{auditTrail.product.productName}</span></h4>
                
                <div className="mb-4 p-3 bg-white rounded-md border">
                    <h5 className="font-medium text-sm text-gray-700">Original Registration</h5>
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                        <p><strong>Batch ID:</strong> {auditTrail.product.batchId}</p>
                        <p><strong>Mfg. Date:</strong> {new Date(`${auditTrail.product.mfgDate}T00:00:00`).toLocaleDateString()}</p>
                        <p><strong>Registered By:</strong> <code className="text-xs">{auditTrail.product.registeredBy}</code></p>
                        <p><strong>Registered At:</strong> {new Date(auditTrail.product.registeredAt).toLocaleString()}</p>
                        <p><strong>Blockchain Tx Hash:</strong> <code className="text-xs break-all">{auditTrail.product.txHash}</code></p>
                    </div>
                </div>

                <div>
                    <h5 className="font-medium text-sm text-gray-700">Consumer Reports ({auditTrail.reports.length})</h5>
                    {auditTrail.reports.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                            {auditTrail.reports.map(report => (
                                <li key={report.id} className="text-xs p-2 bg-yellow-100 border border-yellow-200 rounded-md">
                                    <p><strong>Reported At:</strong> {new Date(report.reportedAt).toLocaleString()}</p>
                                    <p><strong>Reporter ID:</strong> <code className="text-xs">{report.reporterId}</code></p>
                                    <p><strong>Status:</strong> <span className="font-semibold capitalize">{report.reviewStatus}</span></p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-500 mt-2 p-3 bg-white rounded-md border">No consumer reports found for this product.</p>
                    )}
                </div>
            </div>
        )}
      </div>

    </div>
  );
};
