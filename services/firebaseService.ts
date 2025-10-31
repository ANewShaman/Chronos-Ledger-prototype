

// FIX: Use modular imports for Firebase v9+ SDK.
// FIX: Corrected Firebase v9+ SDK imports. Replaced the incorrect namespace import for 'firebase/app' with named imports.
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import type { Product, Report, AuditTrail } from '../types';

// IMPORTANT: Replace with your actual Firebase configuration from your Firebase project console.
const firebaseConfig = {
  apiKey: "AIzaSyA45tSeT-p1cnwiKMMiL2tes-WHdKhJTms",
  authDomain: "dtriplemvp.firebaseapp.com",
  projectId: "dtriplemvp",
  storageBucket: "dtriplemvp.firebasestorage.app",
  messagingSenderId: "583926694199",
  appId: "1:583926694199:web:89c3c64502a185ac831ab2",
  measurementId: "G-7VGSV1PHL2"
};

// Initialize Firebase only if it hasn't been initialized yet
// FIX: Call the imported functions directly instead of through a namespace.
// FIX: Corrected Firebase v9+ app initialization to use imported functions directly. This is expected to fix module resolution errors for other Firebase services.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

const productsCollection = collection(db, 'products');
const manualReviewsCollection = collection(db, 'manualReviews');
const productReportsCollection = collection(db, 'productReports');


export const initFirebase = (
  onSuccess: (user: User) => void,
  onError: (error: Error) => void
) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onSuccess(user);
    } else {
      signInAnonymously(auth)
        .then((userCredential) => {
          onSuccess(userCredential.user);
        })
        .catch((error) => {
          console.error("Anonymous sign-in failed", error);
          onError(error);
        });
    }
  });
};

export const registerProduct = async (productData: Omit<Product, 'registeredAt' | 'status'>): Promise<{docId: string}> => {
  try {
    const docRef = await addDoc(productsCollection, {
      ...productData,
      status: 'Authentic',
      registeredAt: serverTimestamp(),
    });
    return { docId: docRef.id };
  } catch (error) {
    console.error("Error registering product in Firestore:", error);
    throw new Error("Failed to register product in Firestore.");
  }
};

export const verifyProduct = async (documentId: string): Promise<Product | null> => {
    try {
        const docRef = doc(db, 'products', documentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Firestore timestamps need to be converted to string for our Product type
            const registeredAtTimestamp = data.registeredAt;
            const registeredAtString = registeredAtTimestamp?.toDate
                ? registeredAtTimestamp.toDate().toISOString()
                : new Date().toISOString();
            
            return {
                productName: data.productName || '',
                batchId: data.batchId || '',
                mfgDate: data.mfgDate || '',
                status: data.status || 'Unknown',
                registeredBy: data.registeredBy || '',
                registeredAt: registeredAtString,
                contractHash: data.contractHash || '',
                txHash: data.txHash || '',
            } as Product;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error verifying product in Firestore:", error);
        throw new Error("Could not connect to the product registry.");
    }
};

export const requestManualReview = async (productData: {productName: string, batchId: string, mfgDate: string}, aiReason: string): Promise<void> => {
    try {
      await addDoc(manualReviewsCollection, {
        ...productData,
        aiReason,
        reviewStatus: 'pending',
        requestedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error requesting manual review:", error);
      throw new Error("Failed to submit for manual review.");
    }
};

export const submitProductReport = async (productId: string, userId: string | null): Promise<void> => {
    if (!userId) {
        throw new Error("User is not authenticated. Cannot submit report.");
    }
    try {
      await addDoc(productReportsCollection, {
        productId: productId,
        reporterId: userId,
        reportedAt: serverTimestamp(),
        reviewStatus: 'pending',
      });
    } catch (error) {
      console.error("Error submitting product report:", error);
      throw new Error("Failed to submit product report.");
    }
};

export const getProductAuditTrail = async (productId: string): Promise<AuditTrail | null> => {
    const product = await verifyProduct(productId);
    if (!product) {
        return null;
    }

    const reportsQuery = query(
        productReportsCollection,
        where("productId", "==", productId),
        orderBy("reportedAt", "desc")
    );

    const reportsSnapshot = await getDocs(reportsQuery);
    const reports: Report[] = reportsSnapshot.docs.map(doc => {
        const data = doc.data();
        const reportedAtTimestamp = data.reportedAt;
        const reportedAtString = reportedAtTimestamp?.toDate
            ? reportedAtTimestamp.toDate().toISOString()
            : new Date().toISOString();

        return {
            id: doc.id,
            productId: data.productId,
            reporterId: data.reporterId,
            reportedAt: reportedAtString,
            reviewStatus: data.reviewStatus,
        };
    });

    return { product, reports };
};