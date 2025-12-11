"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { CiSearch, CiPhone } from "react-icons/ci";
import { FaRegTrashAlt } from "react-icons/fa";
import { GiMoneyStack } from "react-icons/gi";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { db } from "@/app/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader/Loader";

function Debts() {
  const router = useRouter();
  const [detailsAslDebt, setDetailsAslDebt] = useState(0);
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    debt: "",
    debtType: "",
    debtDirection: "",
    dateInput: "",
    paymentAmount: "", // مبلغ السداد مباشرة
    paymentSource: "درج", // درج أو خزنة
  });

  const [customers, setCustomers] = useState([]);
  const getTreasuryBalance = async () => {
    const q = query(collection(db, "dailyProfit"), where("shop", "==", shop));
    const snapshot = await getDocs(q);

    let totalSales = 0;
    let totalMasrofat = 0;
    let totalSaddad = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "سداد") {
        totalSaddad += Number(data.totalSales || 0);
      } else {
        totalSales += Number(data.totalSales || 0);
      }
      totalMasrofat += Number(data.totalMasrofat || 0);
    });

    const balance = totalSales - totalMasrofat - totalSaddad;
    return balance;
  };

  // ===== payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentSource, setPaymentSource] = useState("درج"); // درج أو خزنة
  const [processingPayment, setProcessingPayment] = useState(false);

  // ===== details popup
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const [detailsPayments, setDetailsPayments] = useState([]);

  const shop =
    typeof window !== "undefined" ? localStorage.getItem("shop") : "";

  useEffect(() => {
    const checkLock = async () => {
      const userName = localStorage.getItem("userName");
      if (!userName) {
        router.push("/");
        return;
      }
      const q = query(
        collection(db, "users"),
        where("userName", "==", userName)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const user = querySnapshot.docs[0].data();
        if (user.permissions?.debts === true) {
          alert("ليس ليدك الصلاحية للوصول الى هذه الصفحة❌");
          router.push("/");
          return;
        } else {
          setAuth(true);
        }
      } else {
        router.push("/");
        return;
      }
      setLoading(false);
    };
    checkLock();
  }, []);

  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, "debts"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    });

    return () => unsubscribe();
  }, [shop]);

  const handleAddProduct = async () => {
    if (!form.name || !form.phone || !form.debt) {
      alert("يرجى ملء كل الحقول");
      return;
    }

    const debtAmount = Number(form.debt);
    const paymentAmountNum = Number(form.paymentAmount || 0); // مبلغ السداد
    const remainingDebt = debtAmount - paymentAmountNum;

    // إنشاء مستند الدين
    const newDebtDoc = await addDoc(collection(db, "debts"), {
      name: form.name,
      phone: form.phone,
      debt: remainingDebt > 0 ? remainingDebt : 0,
      debtType: form.debtType,
      debtDirection: form.debtDirection,
      dateInput: form.dateInput,
      date: new Date(),
      shop: shop,
      aslDebt: form.debt,
    });

    // ===== تسجيل السداد إذا موجود
    if (paymentAmountNum > 0) {
      // إنشاء مستند السداد وحفظ الـ id
      const paymentDoc = await addDoc(collection(db, "debtsPayments"), {
        name: form.name,
        phone: form.phone,
        paidAmount: paymentAmountNum,
        previousDebt: debtAmount,
        remainingDebt: remainingDebt > 0 ? remainingDebt : 0,
        date: new Date(),
        shop: shop,
        source: form.paymentSource || "درج",
        debtid: newDebtDoc.id, // ربط السداد بالدين الأصلي
      });

      // إذا مصدر السداد خزنة، تسجيله في dailyProfit مع ربطه بالسداد
      if (form.paymentSource === "خزنة") {
        const now = new Date();
        await addDoc(collection(db, "dailyProfit"), {
          createdAt: now,
          date: `${String(now.getDate()).padStart(2, "0")}/${String(
            now.getMonth() + 1
          ).padStart(2, "0")}/${now.getFullYear()}`,
          shop: shop,
          totalSales: paymentAmountNum,
          type: "سداد",
          debtPaymentId: paymentDoc.id, // ربط هذا السجل بالسداد الأصلي
        });
      }
    }

    // إعادة ضبط الفورم والحالة
    setForm({
      name: "",
      phone: "",
      debt: "",
      debtType: "",
      debtDirection: "",
      dateInput: "",
      paymentAmount: "",
      paymentSource: "درج",
    });
    setActive(false);
    setDetailsPayments([]);
    setDetailsAslDebt(0);
  };

  const handleDelete = async (id, phone) => {
    try {
      // ===== جلب كل السدادات الخاصة بالعميل =====
      const paymentsQuery = query(
        collection(db, "debtsPayments"),
        where("phone", "==", phone),
        where("shop", "==", shop)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      // ===== حذف كل السدادات مع تحديث dailyProfit إذا السداد من الخزنة =====
      const deletePaymentsPromises = paymentsSnapshot.docs.map(
        async (docSnap) => {
          const paymentData = docSnap.data();

          // إذا السداد من الخزنة، حذف السجل المرتبط في dailyProfit
          if (paymentData.source === "خزنة") {
            const profitQuery = query(
              collection(db, "dailyProfit"),
              where("debtPaymentId", "==", docSnap.id)
            );
            const profitSnapshot = await getDocs(profitQuery);
            const deleteProfitPromises = profitSnapshot.docs.map((pDoc) =>
              deleteDoc(pDoc.ref)
            );
            await Promise.all(deleteProfitPromises);
          }

          // حذف السداد نفسه
          await deleteDoc(docSnap.ref);
        }
      );

      await Promise.all(deletePaymentsPromises);

      // ===== حذف الدين نفسه =====
      await deleteDoc(doc(db, "debts", id));

      alert(
        "✅ تم حذف العميل وكل السدادات المرتبطة به، وتم تحديث dailyProfit إذا لزم الأمر"
      );
    } catch (err) {
      console.error(err);
      alert("❌ حدث خطأ أثناء الحذف");
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!c.date) return false;

    // حول الـ Timestamp لـ Date
    const dateObj = c.date.toDate ? c.date.toDate() : new Date(c.date);

    // استخرج اليوم والشهر والسنة
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();

    // حولها لصيغة YYYY-MM-DD عشان متوافقة مع input type="date"
    const dateStr = `${year}-${month}-${day}`;

    // لو فيه تاريخ محدد في البحث
    if (searchCode) {
      return dateStr.includes(searchCode); // ابحث بالـ date فقط
    } else {
      // بدون تاريخ، اعرض بس العملاء اللي عندهم دين > 0
      return Number(c.debt || 0) > 0;
    }
  });

  // ===== Open payment modal
  const openPaymentModal = (customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount("");
    setPaymentSource("درج"); // default
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentCustomer(null);
    setPaymentAmount("");
    setPaymentSource("درج");
    setProcessingPayment(false);
  };

  // ===== Confirm payment
  const handleConfirmPayment = async () => {
    if (!paymentCustomer) return;
    const paid = Number(paymentAmount);
    if (!paid || paid <= 0 || isNaN(paid)) {
      alert("الرجاء إدخال مبلغ سداد صالح أكبر من صفر");
      return;
    }

    setProcessingPayment(true);

    try {
      // ===== فحص رصيد الخزنة =====
      if (paymentSource === "خزنة") {
        const treasuryBalance = await getTreasuryBalance(); // استدعاء دالة حساب الرصيد
        if (paid > treasuryBalance) {
          alert(
            `رصيد الخزنة الحالي (${treasuryBalance} EGP) أقل من المبلغ المطلوب سداده (${paid} EGP).`
          );
          setProcessingPayment(false);
          return;
        }
      }

      const debtRef = doc(db, "debts", paymentCustomer.id);
      const debtSnap = await getDoc(debtRef);

      if (!debtSnap.exists()) {
        alert("لم يتم العثور على بيانات الدين — ربما حُذف بالفعل.");
        setProcessingPayment(false);
        closePaymentModal();
        return;
      }

      const debtData = debtSnap.data();
      const previousDebt = Number(debtData.debt || 0);
      if (paid > previousDebt) {
        alert(`المبلغ أكبر من الدين الحالي (${previousDebt} EGP).`);
        setProcessingPayment(false);
        return;
      }

      const remainingDebt = previousDebt - paid;

      // ===== تحديث الدين في Firestore =====
      await updateDoc(debtRef, { debt: remainingDebt });

      // ===== تحديث الدين في state المحلي مباشرة =====
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === paymentCustomer.id ? { ...c, debt: remainingDebt } : c
        )
      );

      // ===== تسجيل السداد في debtsPayments =====
      const paymentDoc = await addDoc(collection(db, "debtsPayments"), {
        name: debtData.name || paymentCustomer.name || "",
        phone: debtData.phone || paymentCustomer.phone || "",
        paidAmount: paid,
        previousDebt: previousDebt,
        remainingDebt: remainingDebt,
        debtid: paymentCustomer.id,
        date: new Date(),
        userName: localStorage.getItem("userName"),
        shop: shop,
        source: paymentSource, // درج أو خزنة
      });

      // ===== إذا مصدر السداد خزنة، نسجل المبلغ في dailyProfit مع ربط السداد بالـ id =====
      if (paymentSource === "خزنة") {
        const now = new Date();
        await addDoc(collection(db, "dailyProfit"), {
          createdAt: now,
          date: `${String(now.getDate()).padStart(2, "0")}/${String(
            now.getMonth() + 1
          ).padStart(2, "0")}/${now.getFullYear()}`,
          shop: shop,
          totalSales: paid,
          type: "سداد",
          debtPaymentId: paymentDoc.id, // ربط هذا السجل بالسداد الأصلي
        });
      }

      alert("✅ تم تسجيل السداد بنجاح");
      closePaymentModal();
    } catch (err) {
      console.error("خطأ أثناء معالجة السداد:", err);
      alert("❌ حدث خطأ أثناء معالجة السداد، حاول مرة أخرى");
      setProcessingPayment(false);
    }
  };

  // ===== Open details popup
  const openDetailsPopup = async (customer) => {
    if (!customer) return;

    // مسح بيانات السداد القديمة
    setDetailsPayments([]);
    setDetailsAslDebt(0);

    // حفظ اصل الدين للعميل الجديد
    setDetailsAslDebt(customer.aslDebt || customer.debt || 0);

    const q = query(
      collection(db, "debtsPayments"),
      where("shop", "==", shop),
      where("debtid", "==", customer.id)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setDetailsPayments(data);
    setShowDetailsPopup(true);
  };
  const closeDetailsPopup = () => {
    setDetailsPayments([]);
    setShowDetailsPopup(false);
  };

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.debts}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.btns}>
          <button onClick={() => setActive(false)}>كل العملاء</button>
          <button onClick={() => setActive(true)}>اضف عميل جديد</button>
        </div>

        {/* عرض العملاء */}
        <div
          className={styles.phoneContainer}
          style={{ display: active ? "none" : "flex" }}
        >
          <div className={styles.searchBox}>
            <div className="inputContainer">
              <label>
                <CiSearch />
              </label>
              <input
                type="date"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رقم الهاتف</th>
                  <th>الدين</th>
                  <th>الدين لمين</th>
                  <th>تاريخ الدين</th>
                  <th>تاريخ الإضافة</th>
                  <th>سداد</th>
                  <th>عرض التفاصيل</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.debt} EGP</td>
                    <td>{customer.debtDirection}</td>
                    <td>{customer.dateInput}</td>
                    <td>
                      {customer.date?.toDate().toLocaleDateString("ar-EG")}
                    </td>
                    <td>
                      <button
                        className={styles.payBtn}
                        onClick={() => openPaymentModal(customer)}
                      >
                        سداد
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => openDetailsPopup(customer)}
                        style={{ padding: "4px 8px", borderRadius: 6 }}
                      >
                        عرض
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.delBtn}
                        onClick={() => {
                          const ok = confirm(
                            "هل تريد حذف سجل هذا العميل وكل السدادات الخاصة به؟"
                          );
                          if (ok) handleDelete(customer.id, customer.phone);
                        }}
                      >
                        <FaRegTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* إضافة عميل */}
        <div
          className={styles.addContainer}
          style={{ display: active ? "flex" : "none" }}
        >
          <div className={styles.inputBox}>
            <div className="inputContainer">
              <label>
                <MdDriveFileRenameOutline />
              </label>
              <input
                type="text"
                placeholder="اسم العميل"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.inputBox}>
            <div className="inputContainer">
              <label>
                <CiPhone />
              </label>
              <input
                type="text"
                placeholder="رقم الهاتف"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="inputContainer">
              <label>
                <GiMoneyStack />
              </label>
              <input
                type="number"
                placeholder="الدين"
                value={form.debt}
                onChange={(e) => setForm({ ...form, debt: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.inputBox}>
            <div className="inputContainer">
              <input
                type="date"
                value={form.dateInput}
                onChange={(e) =>
                  setForm({ ...form, dateInput: e.target.value })
                }
              />
            </div>

            <div className="inputContainer">
              <label>
                <GiMoneyStack />
              </label>
              <select
                value={form.debtDirection}
                onChange={(e) =>
                  setForm({ ...form, debtDirection: e.target.value })
                }
              >
                <option value="ليك">ليك فلوس</option>
                <option value="بضاعة اجل">بضاعة اجل</option>
                <option value="بضاعة كاش">بضاعة كاش</option>
              </select>
            </div>
          </div>
          <div className={styles.inputBox}>
            <div className="inputContainer">
              <input
                type="number"
                placeholder="مبلغ السداد"
                value={form.paymentAmount || ""}
                onChange={(e) =>
                  setForm({ ...form, paymentAmount: e.target.value })
                }
              />
            </div>

            <div className="inputContainer">
              <label>
                <GiMoneyStack />
              </label>
              <select
                value={form.paymentSource || "درج"}
                onChange={(e) =>
                  setForm({ ...form, paymentSource: e.target.value })
                }
              >
                <option value="خزنة">خزنة</option>
                <option value="درج">درج</option>
              </select>
            </div>
          </div>
          <button className={styles.addBtn} onClick={handleAddProduct}>
            اضف العميل
          </button>
        </div>
      </div>

      {/* ===== Payment Modal ===== */}
      {showPaymentModal && paymentCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closePaymentModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 96%)",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transform: processingPayment ? "scale(0.99)" : "scale(1)",
              transition: "all 200ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>سداد دين — {paymentCustomer.name}</h3>
              <button
                onClick={closePaymentModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✖
              </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14, color: "#555" }}>
                الدين الحالي: <strong>{paymentCustomer.debt} EGP</strong>
              </div>

              <label style={{ fontSize: 13, color: "#333" }}>
                المبلغ الذي سُدِّد (جنيه)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="اكتب المبلغ"
                min="0"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              <label style={{ fontSize: 13, color: "#333" }}>مصدر السداد</label>
              <select
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value)}
                style={{ padding: "6px", borderRadius: 6 }}
              >
                <option value="درج">درج</option>
                <option value="خزنة">خزنة</option>
              </select>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  onClick={closePaymentModal}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={processingPayment}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0b5ed7",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {processingPayment ? "جاري الحفظ..." : "تأكيد السداد"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Details Popup ===== */}
      {showDetailsPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closeDetailsPopup}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(600px, 96%)",
              maxHeight: "80vh",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>تفاصيل السداد</h3>
              <button
                onClick={closeDetailsPopup}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✖
              </button>
            </div>
            <h3>اصل الدين: {detailsAslDebt} EGP</h3>

            {detailsPayments.length === 0 ? (
              <p>لا توجد مدفوعات لهذا العميل.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>المبلغ المدفوع</th>
                    <th>المتبقي بعد السداد</th>
                    <th>التاريخ</th>
                    <th>مصدر السداد</th>
                    <th>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsPayments.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid #ddd" }}>
                      <td>{p.userName} </td>
                      <td>{p.paidAmount} EGP</td>
                      <td>{p.remainingDebt} EGP</td>
                      <td>
                        {p.date?.toDate
                          ? p.date.toDate().toLocaleDateString("ar-EG")
                          : new Date(p.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td>{p.source}</td>
                      <td>
                        <button
                          onClick={async () => {
                            const ok = confirm(
                              "هل تريد حذف هذا السداد واسترجاع المبلغ للدين؟"
                            );
                            if (!ok) return;

                            try {
                              // احصل على بيانات السداد قبل الحذف
                              const paymentRef = doc(db, "debtsPayments", p.id);
                              const paymentSnap = await getDoc(paymentRef);
                              if (!paymentSnap.exists()) {
                                alert("السداد غير موجود");
                                return;
                              }
                              const paymentData = paymentSnap.data();

                              // حذف السداد من Firestore
                              await deleteDoc(paymentRef);

                              // استرجاع قيمة السداد إلى الدين الأصلي مباشرة باستخدام debtid
                              const debtRef = doc(
                                db,
                                "debts",
                                paymentData.debtid
                              );
                              const debtSnap = await getDoc(debtRef);

                              if (debtSnap.exists()) {
                                const currentDebt = Number(
                                  debtSnap.data().debt || 0
                                );
                                const paidAmount = Number(
                                  paymentData.paidAmount || 0
                                );
                                await updateDoc(debtRef, {
                                  debt: currentDebt + paidAmount,
                                });
                              } else {
                                alert("❌ الدين الأصلي غير موجود");
                              }

                              // إذا السداد كان من الخزنة، حذف السجل المرتبط في dailyProfit
                              if (paymentData.source === "خزنة") {
                                const profitQuery = query(
                                  collection(db, "dailyProfit"),
                                  where("debtPaymentId", "==", p.id)
                                );
                                const profitSnapshot = await getDocs(
                                  profitQuery
                                );
                                const deleteProfitPromises =
                                  profitSnapshot.docs.map((docSnap) =>
                                    deleteDoc(docSnap.ref)
                                  );
                                await Promise.all(deleteProfitPromises);
                              }

                              // تحديث الحالة المحلية لإزالة الصف
                              setDetailsPayments((prev) =>
                                prev.filter((item) => item.id !== p.id)
                              );

                              alert(
                                "✅ تم حذف السداد وإرجاع المبلغ للدين بنجاح"
                              );
                            } catch (err) {
                              console.error(err);
                              alert("❌ حدث خطأ أثناء الحذف");
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "#ff4d4f",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Debts;
