'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, addDoc, Timestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Profit() {
  const [shop, setShop] = useState('');
  const [reports, setReports] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [cashTotal, setCashTotal] = useState(0);
  const [mostafaBalance, setMostafaBalance] = useState(0);
  const [midoBalance, setMidoBalance] = useState(0);
  const [doubleMBalance, setDoubleMBalance] = useState(0);
  const [profit, setProfit] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [withdrawPerson, setWithdrawPerson] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPerson, setPayPerson] = useState("");
  const [payWithdrawId, setPayWithdrawId] = useState(null);

  // 👁️ حالة إظهار أو إخفاء الأرقام
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShop(localStorage.getItem('shop'));
      const savedHiddenState = localStorage.getItem('hideFinance');
      if (savedHiddenState !== null) {
        setIsHidden(savedHiddenState === 'true');
      }
    }
  }, []);

  // دالة لتبديل حالة الإخفاء
  const toggleHidden = () => {
    setIsHidden(prev => {
      const newState = !prev;
      localStorage.setItem('hideFinance', newState);
      return newState;
    });
  };

  const parseDate = (val) => {
    if (!val && val !== 0) return null;
    if (val && typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d)) return d;
      const parts = val.split(/[\/\-\.]/).map(p => p.trim());
      if (parts.length === 3) {
        const [a, b, c] = parts;
        if (c.length === 4) return new Date(Number(c), Number(b) - 1, Number(a));
        if (a.length === 4) return new Date(Number(a), Number(b) - 1, Number(c));
      }
    }
    return null;
  };

  const fetchData = async () => {
    if (!shop) return;

    const reportsSnap = await getDocs(query(collection(db, "reports"), where("shop", "==", shop)));
    const reportsData = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setReports(reportsData);

    const withdrawsSnap = await getDocs(query(collection(db, "withdraws"), where("shop", "==", shop)));
    const withdrawsData = withdrawsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setWithdraws(withdrawsData);

    const debtsSnap = await getDocs(query(collection(db, "debtsPayments"), where("shop", "==", shop)));
    const debtsData = debtsSnap.docs.map(doc => doc.data());
    const totalDebtsFromKhazna = debtsData
      .filter(d => d.source === "خزنة")
      .reduce((sum, d) => sum + (d.paidAmount || 0), 0);

    let totalProfit = reportsData.reduce((sum, r) => {
      if (!r.cart || !Array.isArray(r.cart)) return sum;
      return sum + r.cart.reduce((s, item) => s + ((item.sellPrice || 0) - (item.buyPrice || 0)) * (item.quantity || 0), 0);
    }, 0);

    const dailyProfitSnap = await getDocs(query(collection(db, "dailyProfit"), where("shop", "==", shop)));
    let totalMasrofat = 0;
    let initialCash = 0;
    dailyProfitSnap.forEach(doc => {
      const data = doc.data();
      totalMasrofat += data.totalMasrofat || 0;
      initialCash += data.netTotal || 0;
    });

    totalProfit -= totalMasrofat;
    initialCash -= totalDebtsFromKhazna;

    let mostafaSum = 0;
    let midoSum = 0;
    let doubleMSum = 0;
    let remainingProfit = totalProfit;
    let remainingCash = initialCash;

    withdrawsData.forEach(w => {
      const remaining = (w.amount || 0) - (w.paid || 0);
      remainingProfit -= remaining;
      remainingCash -= remaining;
      if (w.person === "مصطفى") mostafaSum += remaining;
      if (w.person === "ميدو") midoSum += remaining;
      if (w.person === "دبل M") doubleMSum += remaining;
    });

    setProfit(remainingProfit);
    setCashTotal(remainingCash);
    setMostafaBalance(mostafaSum);
    setMidoBalance(midoSum);
    setDoubleMBalance(doubleMSum);
  };

  useEffect(() => { fetchData(); }, [shop]);

  useEffect(() => {
    if (!shop || (!dateFrom && !dateTo)) return;

    const fetchFilteredData = async () => {
      const from = new Date(dateFrom || dateTo);
      const to = new Date(dateTo || dateFrom);
      to.setHours(23, 59, 59, 999);

      const filteredReports = reports.filter(r => {
        const d = parseDate(r.date);
        return d && d >= from && d <= to;
      });

      const filteredWithdraws = withdraws.filter(w => {
        const d = parseDate(w.timestamp?.toDate ? w.timestamp.toDate() : w.date);
        return d && d >= from && d <= to;
      });

      const debtsSnap = await getDocs(query(collection(db, "debtsPayments"), where("shop", "==", shop)));
      const debtsData = debtsSnap.docs.map(doc => doc.data());
      const totalDebtsFromKhazna = debtsData
        .filter(d => d.source === "خزنة")
        .reduce((sum, d) => {
          const dDate = parseDate(d.date);
          if (!dDate || dDate < from || dDate > to) return sum;
          return sum + (d.paidAmount || 0);
        }, 0);

      let totalProfitFiltered = filteredReports.reduce((sum, r) => {
        if (!r.cart || !Array.isArray(r.cart)) return sum;
        return sum + r.cart.reduce((s, item) => s + ((item.sellPrice || 0) - (item.buyPrice || 0)) * (item.quantity || 0), 0);
      }, 0);

      const dailyProfitSnap = await getDocs(query(collection(db, "dailyProfit"), where("shop", "==", shop)));
      let totalMasrofatFiltered = 0;
      let totalCashFiltered = 0;
      dailyProfitSnap.forEach(doc => {
        const data = doc.data();
        const d = parseDate(data.date);
        if (!d || d < from || d > to) return;
        totalMasrofatFiltered += data.totalMasrofat || 0;
        totalCashFiltered += data.netTotal || 0;
      });

      totalProfitFiltered -= totalMasrofatFiltered;
      totalCashFiltered -= totalDebtsFromKhazna;

      let remainingProfit = totalProfitFiltered;
      let remainingCash = totalCashFiltered;
      let mostafaSum = 0;
      let midoSum = 0;
      let doubleMSum = 0;

      filteredWithdraws.forEach(w => {
        const remaining = (w.amount || 0) - (w.paid || 0);
        remainingProfit -= remaining;
        remainingCash -= remaining;
        if (w.person === "مصطفى") mostafaSum += remaining;
        if (w.person === "ميدو") midoSum += remaining;
        if (w.person === "دبل M") doubleMSum += remaining;
      });

      setProfit(remainingProfit);
      setCashTotal(remainingCash);
      setMostafaBalance(mostafaSum);
      setMidoBalance(midoSum);
      setDoubleMBalance(doubleMSum);
    };

    fetchFilteredData();
  }, [dateFrom, dateTo, reports, withdraws, shop]);

  const handleWithdraw = async () => {
    if (!withdrawPerson || !withdrawAmount) return alert("اختر الشخص واكتب المبلغ");
    const amount = Number(withdrawAmount);
    if (amount <= 0) return alert("المبلغ غير صالح");
    if (amount > cashTotal) return alert("رصيد الخزنة غير كافي");

    const docRef = await addDoc(collection(db, "withdraws"), {
      shop,
      person: withdrawPerson,
      amount,
      date: new Date().toLocaleDateString("ar-EG"),
      timestamp: Timestamp.now(),
      paid: 0
    });

    setWithdraws(prev => [
      ...prev,
      { id: docRef.id, person: withdrawPerson, amount, date: new Date().toLocaleDateString("ar-EG"), timestamp: Timestamp.now(), paid: 0 },
    ]);

    setCashTotal(prev => prev - amount);
    setProfit(prev => prev - amount);
    if (withdrawPerson === "مصطفى") setMostafaBalance(prev => prev + amount);
    if (withdrawPerson === "ميدو") setMidoBalance(prev => prev + amount);
    if (withdrawPerson === "دبل M") setDoubleMBalance(prev => prev + amount);

    setWithdrawPerson("");
    setWithdrawAmount("");
    setShowPopup(false);
  };

  const handleDeleteWithdraw = async (id, amount, person, paid) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "withdraws", id));
      setWithdraws(prev => prev.filter(w => w.id !== id));

      const remaining = (amount || 0) - (paid || 0);
      setCashTotal(prev => prev + remaining);
      setProfit(prev => prev + remaining);
      if (person === "مصطفى") setMostafaBalance(prev => prev - remaining);
      if (person === "ميدو") setMidoBalance(prev => prev - remaining);
      if (person === "دبل M") setDoubleMBalance(prev => prev - remaining);

    } catch (error) {
      console.error("خطأ أثناء الحذف:", error);
    }
  };

  const handleOpenPay = (withdraw) => {
    setPayWithdrawId(withdraw.id);
    setPayPerson(withdraw.person);
    setPayAmount("");
    setShowPayPopup(true);
  };

  const handlePay = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return alert("ادخل مبلغ صالح");

    const withdraw = withdraws.find(w => w.id === payWithdrawId);
    if (!withdraw) return alert("حدث خطأ");

    const remainingDebt = withdraw.amount - (withdraw.paid || 0);
    if (amount > remainingDebt) return alert(`المبلغ أكبر من المبلغ المستحق: ${remainingDebt}`);

    const withdrawRef = doc(db, "withdraws", payWithdrawId);
    await updateDoc(withdrawRef, {
      paid: (withdraw.paid || 0) + amount
    });

    setWithdraws(prev => prev.map(w => {
      if (w.id === payWithdrawId) {
        return { ...w, paid: (w.paid || 0) + amount };
      }
      return w;
    }));

    setCashTotal(prev => prev + amount);
    setProfit(prev => prev + amount);
    if (payPerson === "مصطفى") setMostafaBalance(prev => prev - amount);
    if (payPerson === "ميدو") setMidoBalance(prev => prev - amount);
    if (payPerson === "دبل M") setDoubleMBalance(prev => prev - amount);

    setShowPayPopup(false);
  };

  return (
    <div className={styles.profit}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.inputDate}>
          <div className="inputContainer">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="inputContainer">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* 👁️ زرار إظهار/إخفاء الأرقام */}
        <button onClick={toggleHidden} className={styles.withdrawBtn} style={{marginTop: '15px'}}>
          {isHidden ? "👁️ إظهار الأرقام" : "🙈 إخفاء الأرقام"}
        </button>

        <div className={styles.cardContent}>
          <div className={styles.cardsContainer}>
            <div className={styles.card}>
              <h4>الخزنة</h4>
              <p>{isHidden ? "*****" : cashTotal}</p>
            </div>
          </div>
          <div className={styles.cardsContainer}>
            <div className={styles.card}>
              <h4>الربح</h4>
              <p>{isHidden ? "*****" : profit}</p>
            </div>
            <div className={styles.card}>
              <h4>مصطفى</h4>
              <p>{isHidden ? "*****" : mostafaBalance}</p>
            </div>
            <div className={styles.card}>
              <h4>ميدو</h4>
              <p>{isHidden ? "*****" : midoBalance}</p>
            </div>
            <div className={styles.card}>
              <h4>دبل M</h4>
              <p>{isHidden ? "*****" : doubleMBalance}</p>
            </div>
          </div>
        </div>

        <button onClick={() => setShowPopup(true)} className={styles.withdrawBtn}>سحب</button>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المبلغ</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th>حذف</th>
                <th>سداد</th>
              </tr>
            </thead>
            <tbody>
              {withdraws.map(w => (
                <tr key={w.id}>
                  <td>{w.person}</td>
                  <td>{isHidden ? "*****" : w.amount}</td>
                  <td>{isHidden ? "*****" : (w.paid || 0)}</td>
                  <td>{isHidden ? "*****" : (w.amount - (w.paid || 0))}</td>
                  <td>{w.date}</td>
                  <td>
                    {(w.amount - (w.paid || 0)) > 0 && (
                      <button className={styles.delBtn} onClick={() => handleDeleteWithdraw(w.id, w.amount, w.person, w.paid || 0)}>
                        حذف
                      </button>
                    )}
                  </td>
                  <td>
                    {(w.amount - (w.paid || 0)) > 0 && (
                      <button className={styles.payBtn} onClick={() => handleOpenPay(w)}>سداد</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Popup السحب */}
        {showPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <h3>عملية سحب</h3>
              <select value={withdrawPerson} onChange={e => setWithdrawPerson(e.target.value)}>
                <option value="">اختر الشخص</option>
                <option value="مصطفى">مصطفى</option>
                <option value="ميدو">ميدو</option>
                <option value="دبل M">دبل M</option>
              </select>
              <input type="number" placeholder="المبلغ" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
              <div className={styles.popupActions}>
                <button onClick={handleWithdraw}>تأكيد</button>
                <button onClick={() => setShowPopup(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Popup السداد */}
        {showPayPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <h3>سداد مبلغ</h3>
              <p>الشخص: {payPerson}</p>
              <input type="number" placeholder="المبلغ" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              <div className={styles.popupActions}>
                <button onClick={handlePay}>تأكيد</button>
                <button onClick={() => setShowPayPopup(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
