import type { BrowserProvider, Contract, Signer } from 'ethers';

export type View = 'admin' | 'consumer' | 'aiAudit';

export interface Status {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface Product {
  productName: string;
  batchId: string;
  mfgDate: string;
  status: 'Authentic' | string;
  registeredBy: string;
  registeredAt: string;
  contractHash: string;
  txHash: string;
}

export interface Web3State {
    provider: BrowserProvider | null;
    signer: Signer | null;
    contract: Contract | null;
    readOnlyContract: Contract | null;
    address: string | null;
}

// Types for AI Audit functionality
export interface AuditEntry {
  batchId: string;
  productName: string;
  isCompliant: boolean;
  reason: string;
}

export type AIAuditResult = AuditEntry[];

// Types for Product Audit Trail
export interface Report {
    id: string;
    productId: string;
    reporterId: string;
    reportedAt: string;
    reviewStatus: string;
}

export interface AuditTrail {
    product: Product;
    reports: Report[];
}
