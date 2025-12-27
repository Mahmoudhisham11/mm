"use client";
import styles from "./styles.module.css";

export default function CartSummary({
  subtotal,
  profit,
  finalTotal,
  appliedDiscount,
  onOpenClientModal,
  isSaving = false,
}) {
  return (
    <div className={styles.totalContainer}>
      <hr />
      <div className={styles.totalBox}>
        <h3>الإجمالي</h3>
        <strong>{finalTotal} EGP</strong>
        {appliedDiscount > 0 && (
          <div>
            <strong>الخصم: {appliedDiscount} EGP</strong>
          </div>
        )}
      </div>
      <div className={styles.resetBtns}>
        <button 
          onClick={onOpenClientModal} 
          className={styles.saveBtn}
          disabled={isSaving}
        >
          {isSaving ? "جاري الحفظ..." : "اضف العميل"}
        </button>
      </div>
    </div>
  );
}
