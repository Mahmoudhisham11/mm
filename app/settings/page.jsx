"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { VscPercentage } from "react-icons/vsc";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader/Loader";
import {
  NotificationProvider,
  useNotification,
} from "@/contexts/NotificationContext";
import { IoStorefrontOutline } from "react-icons/io5";
import {
  FiUsers,
  FiRefreshCw,
  FiShield,
  FiSearch,
  FiArrowRight,
  FiCheckCircle,
  FiPlus,
} from "react-icons/fi";
import { MdStorefront, MdOutlineSwapHoriz } from "react-icons/md";
import { BiBuildingHouse } from "react-icons/bi";

function SettingsContent() {
  const router = useRouter();
  const { success, error: showError } = useNotification();
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("usersPermissions");
  const [allUsers, setAllUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [permissions, setPermissions] = useState({
    phones: false,
    products: false,
    masrofat: false,
    employees: false,
    debts: false,
    reports: false,
    settings: false,
  });
  const [employeePercentage, setEmployeePercentage] = useState("");
  const [commissionType, setCommissionType] = useState("percentage");
  const [piecePrice, setPiecePrice] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentShop, setCurrentShop] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // حالة إدارة الفروع والمستخدمين (Super Admin)
  const [adminTargetShop, setAdminTargetShop] = useState("");
  const [adminCustomShop, setAdminCustomShop] = useState("");
  const [adminUseCustomShop, setAdminUseCustomShop] = useState(false);

  const [transferSelectedUserId, setTransferSelectedUserId] = useState("");
  const [transferTargetShop, setTransferTargetShop] = useState("");
  const [transferCustomShop, setTransferCustomShop] = useState("");
  const [transferUseCustomShop, setTransferUseCustomShop] = useState(false);

  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [inlineTransferShops, setInlineTransferShops] = useState({});

  // هل المستخدم المسجل حالياً هو المشرف العام
  const isSuperAdmin = useMemo(() => {
    if (!currentUserName) return false;
    return currentUserName.toLowerCase().trim() === "mostafabeso10@gmail.com";
  }, [currentUserName]);

  // التحقق من الصلاحيات
  useEffect(() => {
    const checkLock = async () => {
      try {
        const userName = localStorage.getItem("userName");
        const shop = localStorage.getItem("shop") || "";
        if (!userName) {
          router.push("/");
          return;
        }
        setCurrentUserName(userName);
        setCurrentShop(shop);

        const q = query(
          collection(db, "users"),
          where("userName", "==", userName)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const user = querySnapshot.docs[0].data();
          // إذا كان settings === true يعني محظور (ليس لديه صلاحية)
          if (user.permissions?.settings === true) {
            showError("ليس لديك الصلاحية للوصول إلى هذه الصفحة❌");
            router.push("/");
            return;
          } else {
            setAuth(true);
            // إذا كان المشرف العام، نبدأ افتراضياً بتبويب إدارة الفروع
            if (userName.toLowerCase().trim() === "mostafabeso10@gmail.com") {
              setActiveTab("branchManagement");
            }
          }
        } else {
          router.push("/");
          return;
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        showError("حدث خطأ أثناء التحقق من الصلاحيات");
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    checkLock();
  }, [router, showError]);

  // جلب كافة المستخدمين في الوقت الفعلي
  useEffect(() => {
    if (!currentUserName) return;

    const unsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAllUsers(usersList);

        // استبعاد المستخدم الحالي لتبويب الصلاحيات
        const filteredUsers = usersList.filter(
          (u) => u.userName !== currentUserName
        );
        setUsers(filteredUsers);
      },
      (error) => {
        console.error("Error fetching users:", error);
        showError("حدث خطأ أثناء جلب المستخدمين");
      }
    );

    return () => unsub();
  }, [currentUserName, showError]);

  // جلب الموظفين - باستخدام onSnapshot
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "employees"),
      (snapshot) => {
        const empData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEmployees(empData);
      },
      (error) => {
        console.error("Error fetching employees:", error);
        showError("حدث خطأ أثناء جلب الموظفين");
      }
    );

    return () => unsub();
  }, [showError]);

  // استخراج قائمة الفروع الفريدة من جميع الحسابات
  const allBranches = useMemo(() => {
    const branchSet = new Set();
    allUsers.forEach((u) => {
      if (u.shop && typeof u.shop === "string" && u.shop.trim() !== "") {
        branchSet.add(u.shop.trim());
      }
    });
    if (currentShop && typeof currentShop === "string" && currentShop.trim() !== "") {
      branchSet.add(currentShop.trim());
    }
    return Array.from(branchSet).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allUsers, currentShop]);

  // تجميع الحسابات حسب الفروع
  const branchesBreakdown = useMemo(() => {
    const map = {};
    allBranches.forEach((b) => {
      map[b] = [];
    });
    const unassigned = [];

    allUsers.forEach((u) => {
      const shopName = u.shop?.trim();
      if (shopName && map[shopName]) {
        map[shopName].push(u);
      } else if (shopName) {
        map[shopName] = [u];
      } else {
        unassigned.push(u);
      }
    });

    const list = Object.entries(map).map(([name, branchUsers]) => ({
      name,
      users: branchUsers,
      count: branchUsers.length,
    }));

    if (unassigned.length > 0) {
      list.push({
        name: "غير محدد",
        users: unassigned,
        count: unassigned.length,
        isUnassigned: true,
      });
    }

    return list;
  }, [allBranches, allUsers]);

  // تصفية المستخدمين للجدول
  const filteredUsersForTable = useMemo(() => {
    return allUsers.filter((u) => {
      const uName = u.userName?.toLowerCase() || "";
      const uShop = u.shop?.toLowerCase() || "";
      const search = branchSearchTerm.toLowerCase().trim();

      const matchesSearch = !search || uName.includes(search) || uShop.includes(search);

      const matchesBranch =
        branchFilter === "all" ||
        (branchFilter === "unassigned" ? !u.shop : u.shop === branchFilter);

      return matchesSearch && matchesBranch;
    });
  }, [allUsers, branchSearchTerm, branchFilter]);

  // إعادة تعيين المدخلات عند تغيير التبويب
  useEffect(() => {
    setSelectedUser("");
    setPermissions({
      phones: false,
      products: false,
      masrofat: false,
      employees: false,
      debts: false,
      reports: false,
      settings: false,
    });
    setEmployeePercentage("");
    setCommissionType("percentage");
    setPiecePrice("");
  }, [activeTab]);

  // تحميل الصلاحيات عند اختيار مستخدم
  useEffect(() => {
    const loadPermissions = async () => {
      if (!selectedUser) {
        setPermissions({
          phones: false,
          products: false,
          masrofat: false,
          employees: false,
          debts: false,
          reports: false,
          settings: false,
        });
        return;
      }

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
        }
      } catch (err) {
        console.error("Error loading user permissions: ", err);
        showError("حدث خطأ أثناء تحميل الصلاحيات");
      }
    };

    loadPermissions();
  }, [selectedUser, showError]);

  // جلب بيانات عمولة الموظف
  const fetchEmployeeCommission = useCallback(
    async (employeeId) => {
      if (!employeeId) {
        setEmployeePercentage("");
        setCommissionType("percentage");
        setPiecePrice("");
        return;
      }
      try {
        const empRef = doc(db, "employees", employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const data = empSnap.data();
          const type = data.commissionType || "percentage";
          setCommissionType(type);
          setEmployeePercentage(data.percentage?.toString() || "");
          setPiecePrice(data.piecePrice?.toString() || "");
        } else {
          setEmployeePercentage("");
          setCommissionType("percentage");
          setPiecePrice("");
        }
      } catch (error) {
        console.error("Error fetching employee commission:", error);
        showError("حدث خطأ أثناء جلب بيانات عمولة الموظف");
      }
    },
    [showError]
  );

  useEffect(() => {
    if (activeTab === "percentage" && selectedUser) {
      fetchEmployeeCommission(selectedUser);
    }
  }, [selectedUser, activeTab, fetchEmployeeCommission]);

  const handlePermissionChange = useCallback((key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSavePermissions = useCallback(async () => {
    if (!selectedUser) {
      showError("يرجى اختيار مستخدم أولًا");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, { permissions });
      success("✅ تم حفظ الصلاحيات بنجاح");
    } catch (error) {
      console.error("Error saving permissions: ", error);
      showError("حدث خطأ أثناء الحفظ ❌");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedUser, permissions, success, showError]);

  const handleSaveEmployeeCommission = useCallback(async () => {
    if (!selectedUser) {
      showError("يرجى اختيار الموظف أولًا");
      return;
    }

    setIsProcessing(true);
    try {
      const empRef = doc(db, "employees", selectedUser);
      const updateData = { commissionType };

      if (commissionType === "percentage") {
        const percentage = Number(employeePercentage);
        if (
          employeePercentage === "" ||
          isNaN(percentage) ||
          percentage < 0 ||
          percentage > 100
        ) {
          showError("يرجى إدخال نسبة صحيحة بين 0 و 100");
          setIsProcessing(false);
          return;
        }
        updateData.percentage = percentage;
        updateData.piecePrice = null;
      } else {
        const price = Number(piecePrice);
        if (piecePrice === "" || isNaN(price) || price < 0) {
          showError("يرجى إدخال سعر القطعة صحيح (رقم موجب)");
          setIsProcessing(false);
          return;
        }
        updateData.piecePrice = price;
      }

      await updateDoc(empRef, updateData);
      success("✅ تم حفظ بيانات عمولة الموظف بنجاح");
    } catch (error) {
      console.error("Error saving employee commission:", error);
      showError("حدث خطأ أثناء الحفظ ❌");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedUser, commissionType, employeePercentage, piecePrice, success, showError]);

  // التبديل السريع لفرع المشرف العام mostafabeso10@gmail.com
  const handleAdminQuickSwitch = async () => {
    const targetShop = adminUseCustomShop
      ? adminCustomShop.trim()
      : adminTargetShop.trim();

    if (!targetShop) {
      showError("يرجى اختيار أو إدخال اسم الفرع المطلوب");
      return;
    }

    setIsProcessing(true);
    try {
      // العثور على حساب المشرف العام في قاعدة البيانات
      const adminDoc = allUsers.find(
        (u) => u.userName?.toLowerCase()?.trim() === "mostafabeso10@gmail.com"
      );

      if (adminDoc) {
        const userRef = doc(db, "users", adminDoc.id);
        await updateDoc(userRef, { shop: targetShop });
      }

      // تحديث localStorage والفرع النشط حالياً للجلسة
      if (typeof window !== "undefined") {
        localStorage.setItem("shop", targetShop);
      }
      setCurrentShop(targetShop);
      setAdminCustomShop("");
      setAdminUseCustomShop(false);
      setAdminTargetShop("");

      success(`✅ تم تبديل فرع حسابك (mostafabeso10@gmail.com) إلى "${targetShop}" بنجاح!`);
    } catch (error) {
      console.error("Error switching admin branch:", error);
      showError("حدث خطأ أثناء تبديل فرع الحساب ❌");
    } finally {
      setIsProcessing(false);
    }
  };

  // نقل أي مستخدم إلى فرع آخر
  const handleTransferUser = async (userId, targetShopName) => {
    if (!userId) {
      showError("يرجى اختيار المستخدم أولاً");
      return;
    }

    const cleanShop = targetShopName?.trim();
    if (!cleanShop) {
      showError("يرجى تحديد الفرع الجديد");
      return;
    }

    const targetUser = allUsers.find((u) => u.id === userId);
    if (!targetUser) {
      showError("المستخدم غير موجود");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { shop: cleanShop });

      // إذا كان المستخدم المنقول هو المشرف الحالي المسجل دخوله، يتم مزامنة الجلسة المحلية
      if (
        targetUser.userName?.toLowerCase()?.trim() ===
          currentUserName?.toLowerCase()?.trim() ||
        targetUser.userName?.toLowerCase()?.trim() === "mostafabeso10@gmail.com"
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem("shop", cleanShop);
        }
        setCurrentShop(cleanShop);
      }

      // تصفير نموذج النقل
      setTransferSelectedUserId("");
      setTransferTargetShop("");
      setTransferCustomShop("");
      setTransferUseCustomShop(false);
      setInlineTransferShops((prev) => ({ ...prev, [userId]: "" }));

      success(
        `✅ تم نقل حساب "${targetUser.userName}" إلى فرع "${cleanShop}" بنجاح!`
      );
    } catch (error) {
      console.error("Error transferring user:", error);
      showError("حدث خطأ أثناء نقل المستخدم ❌");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedUser);
  }, [employees, selectedUser]);

  const selectedTransferUser = useMemo(() => {
    return allUsers.find((u) => u.id === transferSelectedUserId);
  }, [allUsers, transferSelectedUserId]);

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.settings}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>الإعدادات</h2>
        </div>

        <div className={styles.tabs}>
          {/* تبويب خاص يظهر فقط لـ mostafabeso10@gmail.com */}
          {isSuperAdmin && (
            <button
              className={
                activeTab === "branchManagement" ? styles.activeTab : ""
              }
              onClick={() => handleTabChange("branchManagement")}
            >
              <IoStorefrontOutline style={{ marginLeft: "6px", verticalAlign: "middle" }} />
              إدارة الفروع والحسابات
              <span className={styles.adminTabBadge}>VIP</span>
            </button>
          )}
          <button
            className={
              activeTab === "usersPermissions" ? styles.activeTab : ""
            }
            onClick={() => handleTabChange("usersPermissions")}
          >
            صلاحيات المستخدمين
          </button>
          <button
            className={activeTab === "percentage" ? styles.activeTab : ""}
            onClick={() => handleTabChange("percentage")}
          >
            نسبة الموظفين
          </button>
        </div>

        {/* ==================== إدارة الفروع والحسابات (خاصة بـ mostafabeso10@gmail.com) ==================== */}
        {activeTab === "branchManagement" && isSuperAdmin && (
          <div className={styles.branchManagementContainer}>
            {/* بطاقة المشرف العام والتبديل السريع للفرع */}
            <div className={styles.adminHero}>
              <div className={styles.adminHeroHeader}>
                <div className={styles.adminHeroTitleGroup}>
                  <div className={styles.adminAvatarIcon}>
                    <FiShield />
                  </div>
                  <div>
                    <h3 className={styles.adminHeroTitle}>لوحة المشرف العام - إدارة الفروع</h3>
                    <span className={styles.adminHeroEmail}>mostafabeso10@gmail.com</span>
                  </div>
                </div>

                <div className={styles.activeBranchBadge}>
                  <MdStorefront />
                  <span>فرعك النشط حالياً:</span>
                  <span className={styles.activeBranchValue}>{currentShop || "غير محدد"}</span>
                </div>
              </div>

              {/* صندوق التبديل السريع لفرع mostafabeso10@gmail.com */}
              <div className={styles.adminQuickSwitchBox}>
                <div className={styles.adminQuickSwitchLabel}>
                  <MdOutlineSwapHoriz style={{ fontSize: "20px" }} />
                  <span>تبديل فرع حسابك فوراً:</span>
                </div>

                <div className={styles.adminQuickSwitchControls}>
                  {!adminUseCustomShop ? (
                    <select
                      value={adminTargetShop}
                      onChange={(e) => setAdminTargetShop(e.target.value)}
                      className={styles.adminQuickSwitchSelect}
                    >
                      <option value="">-- اختر الفرع المطلوب --</option>
                      {allBranches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch} {branch === currentShop ? "(الفرع الحالي)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="اكتب اسم الفرع الجديد..."
                      value={adminCustomShop}
                      onChange={(e) => setAdminCustomShop(e.target.value)}
                      className={styles.adminQuickSwitchInput}
                    />
                  )}

                  <button
                    type="button"
                    className={styles.customShopToggle}
                    onClick={() => {
                      setAdminUseCustomShop(!adminUseCustomShop);
                      setAdminTargetShop("");
                      setAdminCustomShop("");
                    }}
                  >
                    {adminUseCustomShop ? "← اختيار من الفروع الحالية" : "+ كتابة فرع جديد"}
                  </button>

                  <button
                    className={styles.adminSwitchBtn}
                    onClick={handleAdminQuickSwitch}
                    disabled={
                      isProcessing ||
                      (!adminUseCustomShop && !adminTargetShop) ||
                      (adminUseCustomShop && !adminCustomShop.trim())
                    }
                  >
                    <FiRefreshCw />
                    {isProcessing ? "جاري التبديل..." : "تبديل فرع حسابي الآن"}
                  </button>
                </div>
              </div>
            </div>

            {/* صف الإحصائيات السريعة */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
                  <IoStorefrontOutline />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statNumber}>{allBranches.length}</span>
                  <span className={styles.statText}>إجمالي الفروع المسجلة</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statIconWrapper} ${styles.statIconGreen}`}>
                  <FiUsers />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statNumber}>{allUsers.length}</span>
                  <span className={styles.statText}>إجمالي الحسابات والمستخدمين</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statIconWrapper} ${styles.statIconOrange}`}>
                  <BiBuildingHouse />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statNumber}>{currentShop || "غير محدد"}</span>
                  <span className={styles.statText}>الفرع الفعّال للجلسة</span>
                </div>
              </div>
            </div>

            {/* بطاقة نقل مستخدم محدد */}
            <div className={styles.transferCard}>
              <div className={styles.sectionHeaderBox}>
                <h4 className={styles.sectionHeaderTitle}>
                  <MdOutlineSwapHoriz />
                  نقل أي مستخدم من فرع إلى فرع آخر
                </h4>
                <span className={styles.sectionHeaderSubtitle}>
                  اختر المستخدم والفرع المطلوب لنقله فورياً وحفظ التغيير
                </span>
              </div>

              <div className={styles.transferGrid}>
                <div className={styles.transferField}>
                  <label className={styles.transferLabel}>المستخدم المراد نقله</label>
                  <select
                    value={transferSelectedUserId}
                    onChange={(e) => setTransferSelectedUserId(e.target.value)}
                    className={styles.transferSelect}
                  >
                    <option value="">-- اختر المستخدم --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.userName || "بدون اسم"} (فرعه الحالي: {u.shop || "بدون فرع"})
                        {u.userName?.toLowerCase()?.trim() === "mostafabeso10@gmail.com" ? " ⭐ حسابك" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.transferField}>
                  <label className={styles.transferLabel}>الفرع الجديد المستهدف</label>
                  {!transferUseCustomShop ? (
                    <select
                      value={transferTargetShop}
                      onChange={(e) => setTransferTargetShop(e.target.value)}
                      className={styles.transferSelect}
                    >
                      <option value="">-- اختر الفرع --</option>
                      {allBranches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="اكتب اسم الفرع الجديد..."
                      value={transferCustomShop}
                      onChange={(e) => setTransferCustomShop(e.target.value)}
                      className={styles.transferInput}
                    />
                  )}

                  <button
                    type="button"
                    className={styles.customShopToggle}
                    onClick={() => {
                      setTransferUseCustomShop(!transferUseCustomShop);
                      setTransferTargetShop("");
                      setTransferCustomShop("");
                    }}
                  >
                    {transferUseCustomShop ? "← اختيار من الفروع الحالية" : "+ إنشاء فرع جديد"}
                  </button>
                </div>

                <button
                  className={styles.transferActionBtn}
                  onClick={() =>
                    handleTransferUser(
                      transferSelectedUserId,
                      transferUseCustomShop ? transferCustomShop : transferTargetShop
                    )
                  }
                  disabled={
                    isProcessing ||
                    !transferSelectedUserId ||
                    (!transferUseCustomShop && !transferTargetShop) ||
                    (transferUseCustomShop && !transferCustomShop.trim())
                  }
                >
                  <FiArrowRight />
                  {isProcessing ? "جاري النقل..." : "تأكيد نقل المستخدم"}
                </button>
              </div>
            </div>

            {/* مستكشف الفروع والحسابات التابعة لها */}
            <div>
              <div className={styles.sectionHeaderBox} style={{ marginBottom: "16px" }}>
                <h4 className={styles.sectionHeaderTitle}>
                  <IoStorefrontOutline />
                  كافة الفروع والحسابات التابعة لها ({branchesBreakdown.length})
                </h4>
                <span className={styles.sectionHeaderSubtitle}>
                  عرض تفصيلي لكل فرع وجميع الحسابات المسجلة تحته
                </span>
              </div>

              <div className={styles.branchesGrid}>
                {branchesBreakdown.map((branch) => (
                  <div
                    key={branch.name}
                    className={`${styles.branchCard} ${
                      branch.name === currentShop ? styles.branchCardActive : ""
                    }`}
                  >
                    <div className={styles.branchCardTop}>
                      <div className={styles.branchNameWrapper}>
                        <IoStorefrontOutline style={{ color: "var(--main-color)", fontSize: "18px" }} />
                        <span className={styles.branchName}>{branch.name}</span>
                      </div>
                      <span className={styles.branchCountBadge}>
                        {branch.count} {branch.count === 1 ? "حساب" : "حسابات"}
                      </span>
                    </div>

                    <div className={styles.branchUsersContainer}>
                      {branch.users.length > 0 ? (
                        branch.users.map((u) => {
                          const isMe =
                            u.userName?.toLowerCase()?.trim() === "mostafabeso10@gmail.com";
                          return (
                            <span
                              key={u.id}
                              className={`${styles.userChip} ${
                                isMe ? styles.userChipAdmin : ""
                              }`}
                              title={`الحساب: ${u.userName}`}
                            >
                              {isMe ? "⭐ " : ""}
                              {u.userName}
                            </span>
                          );
                        })
                      ) : (
                        <span className={styles.emptyBranchText}>لا توجد حسابات مسجلة في هذا الفرع</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* جدول الحسابات مع إمكانية النقل المباشر */}
            <div className={styles.tableCard}>
              <div style={{ padding: "20px", borderBottom: "1px solid var(--border-color)" }}>
                <div className={styles.searchFilterBar}>
                  <div className={styles.searchBoxFlex}>
                    <FiSearch style={{ color: "var(--main-color)", fontSize: "18px" }} />
                    <input
                      type="text"
                      placeholder="ابحث باسم المستخدم أو الفرع..."
                      value={branchSearchTerm}
                      onChange={(e) => setBranchSearchTerm(e.target.value)}
                    />
                  </div>

                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">كل الفروع</option>
                    {allBranches.map((b) => (
                      <option key={b} value={b}>
                        فرع: {b}
                      </option>
                    ))}
                    <option value="unassigned">بدون فرع</option>
                  </select>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.userTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم المستخدم</th>
                      <th>الفرع الحالي</th>
                      <th>حالة الحساب</th>
                      <th>نقل إلى فرع آخر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsersForTable.length > 0 ? (
                      filteredUsersForTable.map((u, idx) => {
                        const isMe =
                          u.userName?.toLowerCase()?.trim() === "mostafabeso10@gmail.com";
                        const selectedInlineShop = inlineTransferShops[u.id] || "";

                        return (
                          <tr
                            key={u.id}
                            className={isMe ? styles.userRowAdmin : ""}
                          >
                            <td>{idx + 1}</td>
                            <td>
                              <strong>{u.userName}</strong>
                              {isMe && (
                                <span
                                  style={{
                                    marginRight: "8px",
                                    fontSize: "11px",
                                    background: "rgba(25, 118, 210, 0.1)",
                                    color: "var(--main-color)",
                                    padding: "2px 6px",
                                    borderRadius: "6px",
                                    fontWeight: "bold",
                                  }}
                                >
                                  حسابك (Super Admin)
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={styles.branchPill}>
                                <MdStorefront />
                                {u.shop || "بدون فرع"}
                              </span>
                            </td>
                            <td>
                              {u.isSubscribed !== false ? (
                                <span className={styles.statusActive}>
                                  <FiCheckCircle /> مفعّل
                                </span>
                              ) : (
                                <span className={styles.statusInactive}>غير مفعّل</span>
                              )}
                            </td>
                            <td>
                              <div className={styles.tableTransferGroup}>
                                <select
                                  value={selectedInlineShop}
                                  onChange={(e) =>
                                    setInlineTransferShops((prev) => ({
                                      ...prev,
                                      [u.id]: e.target.value,
                                    }))
                                  }
                                  className={styles.tableBranchSelect}
                                >
                                  <option value="">-- اختر فرعاً جديداً --</option>
                                  {allBranches.map((b) => (
                                    <option
                                      key={b}
                                      value={b}
                                      disabled={b === u.shop}
                                    >
                                      {b} {b === u.shop ? "(الحالي)" : ""}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className={styles.tableTransferBtn}
                                  onClick={() => handleTransferUser(u.id, selectedInlineShop)}
                                  disabled={
                                    isProcessing ||
                                    !selectedInlineShop ||
                                    selectedInlineShop === u.shop
                                  }
                                >
                                  <FiArrowRight />
                                  نقل
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5">
                          <div className={styles.noResultsBox}>
                            لا توجد حسابات مطابقة للبحث أو الفلتر
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== صلاحيات المستخدمين ==================== */}
        {activeTab === "usersPermissions" && (
          <div className={styles.container}>
            <div className={styles.contentContainer}>
              <div className={styles.inputContainer}>
                <label className={styles.inputLabel}>اسم المستخدم</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="">-- اختر المستخدم --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.userName || "مستخدم بدون اسم"}
                      {user.shop ? ` (${user.shop})` : ""}
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
                    <span className={styles.checkmark}></span>
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <button
                className={styles.saveBtn}
                onClick={handleSavePermissions}
                disabled={isProcessing}
              >
                {isProcessing ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        )}

        {/* ==================== نسبة الموظفين ==================== */}
        {activeTab === "percentage" && (
          <div className={styles.container}>
            <div className={styles.contentContainer}>
              <h3 className={styles.percentageTitle}>
                {commissionType === "percentage"
                  ? "نسبة الموظف"
                  : "سعر القطعة للموظف"}
                {selectedUser && selectedEmployee && (
                  <span className={styles.percentageValue}>
                    {commissionType === "percentage"
                      ? employeePercentage !== ""
                        ? `: ${employeePercentage}%`
                        : ": لا توجد نسبة محفوظة"
                      : piecePrice !== ""
                      ? `: ${piecePrice} جنيه/قطعة`
                      : ": لا يوجد سعر محفوظ"}
                  </span>
                )}
              </h3>

              <div className={styles.inputContainer}>
                <label className={styles.inputLabel}>الموظف</label>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    fetchEmployeeCommission(e.target.value);
                  }}
                  className={styles.selectInput}
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || "موظف بدون اسم"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <>
                  <div className={styles.inputContainer}>
                    <label className={styles.inputLabel}>نوع العمولة</label>
                    <div className={styles.toggleContainer}>
                      <button
                        type="button"
                        className={`${styles.toggleOption} ${
                          commissionType === "percentage"
                            ? styles.toggleActive
                            : ""
                        }`}
                        onClick={() => setCommissionType("percentage")}
                      >
                        نسبة مئوية
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleOption} ${
                          commissionType === "piece" ? styles.toggleActive : ""
                        }`}
                        onClick={() => setCommissionType("piece")}
                      >
                        سعر القطعة
                      </button>
                    </div>
                  </div>

                  {commissionType === "percentage" ? (
                    <div className={styles.inputContainer}>
                      <label className={styles.inputLabel}>
                        <VscPercentage />
                        نسبة الموظف (%)
                      </label>
                      <input
                        type="number"
                        placeholder="نسبة الموظف (0-100)"
                        value={employeePercentage}
                        onChange={(e) => setEmployeePercentage(e.target.value)}
                        min="0"
                        max="100"
                        className={styles.numberInput}
                      />
                    </div>
                  ) : (
                    <div className={styles.inputContainer}>
                      <label className={styles.inputLabel}>
                        سعر القطعة (جنيه)
                      </label>
                      <input
                        type="number"
                        placeholder="سعر القطعة (رقم موجب)"
                        value={piecePrice}
                        onChange={(e) => setPiecePrice(e.target.value)}
                        min="0"
                        step="0.01"
                        className={styles.numberInput}
                      />
                    </div>
                  )}
                </>
              )}

              <button
                className={styles.saveBtn}
                onClick={handleSaveEmployeeCommission}
                disabled={isProcessing || !selectedUser}
              >
                {isProcessing ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <NotificationProvider>
      <SettingsContent />
    </NotificationProvider>
  );
}
