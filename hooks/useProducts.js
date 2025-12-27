"use client";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/app/firebase";

export function useProducts(shop) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "lacosteProducts"),
      where("shop", "==", shop)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setProducts(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching products:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [shop]);

  const filterProducts = (searchCode, filterType = "all") => {
    return products.filter((p) => {
      const search = searchCode.trim().toLowerCase();
      const matchName =
        search === "" ||
        (p.code && p.code.toString().toLowerCase().includes(search));
      const matchType =
        filterType === "all"
          ? true
          : filterType === "phone"
          ? p.type === "phone"
          : p.type !== "phone";
      return matchName && matchType;
    });
  };

  return {
    products,
    loading,
    error,
    filterProducts,
  };
}
