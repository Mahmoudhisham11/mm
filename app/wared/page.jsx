"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import { FaRegTrashAlt } from "react-icons/fa";

export default function Wared() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchDate, setSearchDate] = useState("");

  useEffect(() => {
    const colRef = collection(db, "wared");

    const unsub = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // ترتيب حسب التاريخ تنازليًا
      data.sort((a, b) => b.date?.seconds - a.date?.seconds);

      setProducts(data);
      setFiltered(data);
    });

    return () => unsub();
  }, []);

  const filterByDate = () => {
    if (!searchDate) {
      setFiltered(products);
      return;
    }

    const selectedDate = new Date(searchDate).toLocaleDateString("ar-EG");

    const result = products.filter(p => {
      if (!p.date?.toDate) return false;
      const productDate = p.date.toDate().toLocaleDateString("ar-EG");
      return productDate === selectedDate;
    });

    setFiltered(result);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("هل تريد حذف المنتج؟");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "wared", id));
    alert("تم حذف المنتج بنجاح");
  };

  return (
    <div className={styles.wared}>
      <SideBar />

      <div className={styles.content}>
        {/* البحث بالتاريخ */}
        <div className={styles.searchBox}>
          <div className="inputContainer">
            <input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
          />
          </div>
          <button onClick={filterByDate}>بحث</button>
          <button onClick={() => setFiltered(products)}>عرض الكل</button>
        </div>

        {/* الجدول */}
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>التاريخ</th>
                <th>حذف</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.name ?? "-"}</td>
                  <td>{p.quantity ?? "-"}</td>
                  <td>{p.price ?? "-"}</td>
                  <td>
                    {p.date?.toDate
                      ? p.date.toDate().toLocaleDateString("ar-EG")
                      : "-"}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{ background: "red", color: "#fff", padding: "6px", borderRadius: "6px" }}
                    >
                      <FaRegTrashAlt />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              ❌ لا توجد منتجات
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
