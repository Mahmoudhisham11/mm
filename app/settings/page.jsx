"use client";
import { useState, useEffect } from "react";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { VscPercentage } from "react-icons/vsc";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader/Loader";

export default function Settings() {
  const router = useRouter();
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("usersPermissions");
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [permissions, setPermissions] = useState({
    phones: true,
    products: true,
    masrofat: false,
    employees: true,
    debts: false,
    reports: true,
    settings: true,
  });

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [employeePercentage, setEmployeePercentage] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  useEffect(() => {
    const checkLock = async () => {
      const userName = localStorage.getItem("userName");
      if (!userName) {
        router.push("/");
        return;
      }
      setCurrentUserName(userName); // ✅ حفظ اسم المستخدم الحالي

      const q = query(
        collection(db, "users"),
        where("userName", "==", userName)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const user = querySnapshot.docs[0].data();
        if (user.permissions?.settings === true) {
          alert("ليس لديك الصلاحية للوصول الى هذه الصفحة❌");
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

  // ✅ جلب المستخدمين بدون المستخدم الحالي
  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const allUsers = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // استبعاد المستخدم اللي اسمه نفس الموجود في localStorage
    const filteredUsers = allUsers.filter(
      (u) => u.userName !== currentUserName
    );

    setUsers(filteredUsers);
  };

  const fetchEmployees = async () => {
    const querySnapshot = await getDocs(collection(db, "employees"));
    const empData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setEmployees(empData);
  };

  useEffect(() => {
    if (currentUserName) {
      fetchUsers();
      fetchEmployees();
    }
  }, [currentUserName]);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!selectedUser) return;

      try {
        const userRef = doc(db, "users", selectedUser);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();

          setPermissions(
            userData.permissions || {
              phones: false,
              products: false,
              masrofat: false,
              employees: false,
              debts: false,
              reports: false,
              settings: false,
            }
          );

          setIsSubscribed(userData.isSubscribed || false);
        }
      } catch (err) {
        console.error("Error loading user permissions: ", err);
      }
    };

    loadPermissions();
  }, [selectedUser]);

  const handlePermissionChange = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) {
      alert("يرجى اختيار مستخدم أولًا");
      return;
    }

    try {
      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, { permissions });
      alert("تم حفظ الصلاحيات بنجاح ✅");
      await fetchUsers();
    } catch (error) {
      console.error("Error saving permissions: ", error);
      alert("حدث خطأ أثناء الحفظ ❌");
    }
  };

  const handleActivationChange = async () => {
    if (!selectedUser) {
      alert("يرجى اختيار مستخدم أولًا");
      return;
    }

    const newStatus = !isSubscribed;
    setIsSubscribed(newStatus);

    try {
      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, { isSubscribed: newStatus });
      alert(`تم ${newStatus ? "تفعيل" : "إلغاء تفعيل"} المستخدم بنجاح ✅`);
      await fetchUsers();
    } catch (error) {
      console.error("Error updating subscription: ", error);
      alert("حدث خطأ أثناء تحديث التفعيل ❌");
    }
  };

  const fetchEmployeePercentage = async (employeeId) => {
    if (!employeeId) {
      setEmployeePercentage("");
      return;
    }
    try {
      const empRef = doc(db, "employees", employeeId);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        const data = empSnap.data();
        setEmployeePercentage(data.percentage || "");
      } else {
        setEmployeePercentage("");
      }
    } catch (error) {
      console.error("Error fetching employee percentage:", error);
    }
  };

  const handleSaveEmployeePercentage = async () => {
    if (!selectedUser) {
      alert("يرجى اختيار الموظف أولًا");
      return;
    }
    if (employeePercentage === "") {
      alert("يرجى إدخال النسبة للموظف");
      return;
    }

    try {
      const empRef = doc(db, "employees", selectedUser);
      await updateDoc(empRef, { percentage: Number(employeePercentage) });
      alert("تم حفظ نسبة الموظف بنجاح ✅");
      fetchEmployees();
    } catch (error) {
      console.error("Error saving employee percentage:", error);
      alert("حدث خطأ أثناء حفظ النسبة ❌");
    }
  };

  useEffect(() => {
    if (activeTab === "percentage" && selectedUser) {
      fetchEmployeePercentage(selectedUser);
    }
  }, [selectedUser, activeTab]);

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.settings}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.title}>
          <h2>الإعدادات</h2>
        </div>

        <div className={styles.tabs}>
          <button
            className={activeTab === "usersPermissions" ? styles.active : ""}
            onClick={() => setActiveTab("usersPermissions")}
          >
            صلاحيات المستخدمين
          </button>
          <button
            className={activeTab === "usersActivations" ? styles.active : ""}
            onClick={() => setActiveTab("usersActivations")}
          >
            تفعيلات المستخدمين
          </button>
          <button
            className={activeTab === "percentage" ? styles.active : ""}
            onClick={() => setActiveTab("percentage")}
          >
            نسبة الموظفين
          </button>
        </div>

        {/* ✅ صلاحيات المستخدمين */}
        {activeTab === "usersPermissions" && (
          <div className={styles.container}>
            <div className={styles.contentContainer}>
              <div className={styles.top}>
                <div className="inputContainer">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">-- اسم المستخدم --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.userName || "مستخدم بدون اسم"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.checkContent}>
                  {[
                    { key: "products", label: "صفحة المنتجات" },
                    { key: "masrofat", label: "صفحة المصاريف" },
                    { key: "employees", label: "صفحة الموظفين" },
                    { key: "debts", label: "صفحة فواتير البضاعة" },
                    { key: "reports", label: "صفحة المرتجعات" },
                    { key: "settings", label: "صفحة الإعدادات" },
                  ].map((item) => (
                    <label key={item.key} className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={permissions[item.key] || false}
                        onChange={() => handlePermissionChange(item.key)}
                      />
                      {item.label}
                      <span className={styles.checkmark}></span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                className={styles.saveBtn}
                onClick={handleSavePermissions}
              >
                حفظ
              </button>
            </div>
          </div>
        )}

        {/* ✅ تفعيلات المستخدمين */}
        {activeTab === "usersActivations" && (
          <div className={styles.container}>
            <div className={styles.contentContainer}>
              <div className={styles.top}>
                <div className="inputContainer">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">-- اسم المستخدم --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.userName || "مستخدم بدون اسم"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.checkContent}>
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      checked={isSubscribed}
                      onChange={handleActivationChange}
                    />
                    تفعيل المستخدم
                    <span className={styles.checkmark}></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ نسبة الموظفين */}
        {activeTab === "percentage" && (
          <div className={styles.container}>
            <div className={styles.contentContainer}>
              <h4>نسبة كل موظف</h4>
              <div className={styles.top}>
                <select
                  className="inputContainer"
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    fetchEmployeePercentage(e.target.value);
                  }}
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || "موظف بدون اسم"}
                    </option>
                  ))}
                </select>

                {selectedUser && (
                  <>
                    <div className={styles.cardContainer}>
                      <div className={styles.card}>
                        <h4>
                          نسبة{" "}
                          {employees.find((e) => e.id === selectedUser)?.name ||
                            "الموظف"}
                        </h4>
                        <p>
                          {employeePercentage !== ""
                            ? `${employeePercentage}%`
                            : "لا توجد نسبة محفوظة لهذا الموظف"}
                        </p>
                      </div>
                    </div>

                    <div
                      className="inputContainer"
                      style={{ marginTop: "15px" }}
                    >
                      <label>
                        <VscPercentage />
                      </label>
                      <input
                        type="number"
                        placeholder="نسبة الموظف"
                        value={employeePercentage}
                        onChange={(e) => setEmployeePercentage(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                className={styles.saveBtn}
                style={{ marginTop: "10px" }}
                onClick={handleSaveEmployeePercentage}
              >
                حفظ نسبة الموظف
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
