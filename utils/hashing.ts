interface ProductData {
    productName: string;
    batchId: string;
    mfgDate: string;
}

export const generateProductHash = (data: ProductData): string => {
    if (!window.CryptoJS) {
        throw new Error("CryptoJS library not loaded!");
    }
    const dataString = `${data.productName}|${data.batchId}|${data.mfgDate}`;
    const hash = window.CryptoJS.SHA256(dataString).toString(window.CryptoJS.enc.Hex);
    return `0x${hash}`;
};
