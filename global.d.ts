
import { ethers } from 'ethers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let Html5Qrcode: any;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethers: typeof ethers;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CryptoJS: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Html5Qrcode: any;
  }
}
//Need to change :D