// Service for invoice operations
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/app/firebase";
import { calculateSubtotal, calculateProfit } from "@/utils/cartHelpers";

export const invoiceService = {
  async createInvoice(cart, clientData, shop, employee) {
    try {
      // Get next invoice number
      const counterRef = doc(db, "counters", "invoiceCounter");
      const counterSnap = await getDoc(counterRef);
      const currentNumber = counterSnap.exists()
        ? counterSnap.data().lastInvoiceNumber || 0
        : 0;
      const invoiceNumber = currentNumber + 1;

      // Update counter
      await setDoc(
        counterRef,
        { lastInvoiceNumber: invoiceNumber },
        { merge: true }
      );

      // Calculate totals
      const total = calculateSubtotal(cart);
      const profit = calculateProfit(cart);

      // Prepare invoice data
      const saleData = {
        invoiceNumber,
        cart,
        clientName: clientData.clientName || "",
        phone: clientData.phone || "",
        date: new Date(),
        shop,
        total,
        profit,
        employee: employee || "غير محدد",
        discount: clientData.discount || 0,
        discountNotes: clientData.discountNotes || "",
      };

      // Save invoice
      const invoiceRef = await addDoc(collection(db, "dailySales"), saleData);

      return { success: true, invoice: { id: invoiceRef.id, ...saleData } };
    } catch (error) {
      console.error("Error creating invoice:", error);
      return { success: false, error };
    }
  },

  async getInvoiceByNumber(invoiceNumber) {
    try {
      const q = query(
        collection(db, "dailySales"),
        where("invoiceNumber", "==", Number(invoiceNumber))
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: false, message: "الفاتورة غير موجودة" };
      }

      const invoiceData = snapshot.docs[0].data();
      return { success: true, invoice: invoiceData };
    } catch (error) {
      console.error("Error getting invoice:", error);
      return { success: false, error };
    }
  },

  async returnProduct(item, invoiceId) {
    try {
      const invoiceRef = doc(db, "dailySales", invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);

      if (!invoiceSnap.exists()) {
        return { success: false, message: "الفاتورة غير موجودة" };
      }

      const invoiceData = invoiceSnap.data();
      const updatedCart = invoiceData.cart.filter(
        (p) =>
          !(
            p.code === item.code &&
            p.quantity === item.quantity &&
            (p.color || "") === (item.color || "") &&
            (p.size || "") === (item.size || "")
          )
      );

      if (updatedCart.length > 0) {
        const newTotal = calculateSubtotal(updatedCart);
        const newProfit = calculateProfit(updatedCart);

        await updateDoc(invoiceRef, {
          cart: updatedCart,
          total: newTotal,
          profit: newProfit,
        });

        return { success: true, message: "تم إرجاع المنتج بنجاح" };
      } else {
        await deleteDoc(invoiceRef);
        return { success: true, message: "تم إرجاع المنتج وحذف الفاتورة" };
      }
    } catch (error) {
      console.error("Error returning product:", error);
      return { success: false, error };
    }
  },
};
