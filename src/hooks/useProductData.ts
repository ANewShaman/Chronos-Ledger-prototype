import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebaseService';

export function useProductData(productId?: string) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    setLoading(true);
    setProduct(null);
    setError(null);

    const ref = doc(db, 'products', productId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProduct({ id: snap.id, ...snap.data() });
          setError(null);
        } else {
          setProduct(null);
          setError('Product not found');
        }
        setLoading(false);
      },
      (err) => {
        setError(err?.message || String(err));
        setLoading(false);
      }
    );

    // Cleanup when component unmounts or productId changes
    return () => unsub();
  }, [productId]);

  return { product, loading, error };
}
