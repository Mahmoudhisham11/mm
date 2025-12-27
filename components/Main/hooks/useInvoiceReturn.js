"use client";
import { useState } from "react";
import { invoiceService } from "../services/invoiceService";
import { stockService } from "../services/stockService";
import { useNotification } from "@/contexts/NotificationContext";

export function useInvoiceReturn() {
  const [returningItemsState, setReturningItemsState] = useState({});
  const { success, error: showError } = useNotification();

  const returnProduct = async (item, invoiceId, onUpdateInvoice) => {
    const itemKey = `${item.code}_${item.color || ""}_${item.size || ""}`;

    if (returningItemsState[itemKey]) return;
    
    setReturningItemsState((prev) => ({ ...prev, [itemKey]: true }));

    try {
      // Restore stock
      await stockService.restoreStock(item);

      // Update invoice
      const result = await invoiceService.returnProduct(item, invoiceId);

      if (result.success) {
        success(result.message || "تم إرجاع المنتج بنجاح");
        if (onUpdateInvoice) {
          onUpdateInvoice((prev) => ({
            ...prev,
            cart: prev.cart.filter(
              (p) =>
                !(
                  p.code === item.code &&
                  p.quantity === item.quantity &&
                  (p.color || "") === (item.color || "") &&
                  (p.size || "") === (item.size || "")
                )
            ),
          }));
        }
      } else {
        showError(result.message || "حدث خطأ أثناء إرجاع المنتج");
      }
    } catch (err) {
      console.error("Error returning product:", err);
      showError("حدث خطأ أثناء إرجاع المنتج");
    } finally {
      setReturningItemsState((prev) => ({ ...prev, [itemKey]: false }));
    }
  };

  return { returnProduct, returningItemsState };
}
