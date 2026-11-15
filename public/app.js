
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  limit,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* Firebase Configuration */

const firebaseConfig = {
  apiKey: "AIzaSyA9quwSDpC9bENSDIfyfN9U7kn4ZBX2RbQ",
  authDomain: "hsc28-50fca.firebaseapp.com",
  projectId: "hsc28-50fca",
  messagingSenderId: "868065294221",
  appId: "1:868065294221:web:5a95fc562bfcf15d952fc4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let currentUser = null;
let isAdmin = false;
let unsubs = [];

const DEFAULT_SETTINGS = {
  number: "01517035617",
  amount: 5,
  durationDays: 0
};

/* General Functions */

function msg(t) {
  $("notice").textContent = t;
  $("notice").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearSubs() {
  unsubs.forEach(fn => fn());
  unsubs = [];
}

function showTab(name) {
  if (name === "admin" && !isAdmin) return;

  document.querySelectorAll(".tab").forEach(x => {
    x.classList.add("hidden");
  });

  $(name).classList.remove("hidden");
}

document.querySelectorAll("[data-tab]").forEach(b => {
  b.addEventListener("click", () => showTab(b.dataset.tab));
});

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function validUrl(s) {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

function niceDate(ts) {
  try {
    return ts?.toDate ? ts.toDate().toLocaleString() : "";
  } catch {
    return "";
  }
}

async function userDoc() {
  const s = await getDoc(doc(db, "users", currentUser.uid));
  return s.exists() ? s.data() : {};
}

async function getConfig() {
  const s = await getDoc(doc(db, "settings", "payment"));

  return s.exists()
    ? { ...DEFAULT_SETTINGS, ...s.data() }
    : DEFAULT_SETTINGS;
}

function errorText(e) {
  const map = {
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
    "auth/email-already-in-use": "এই ইমেইল দিয়ে অ্যাকাউন্ট আছে।",
    "auth/weak-password": "কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।",
    "auth/invalid-email": "সঠিক ইমেইল দিন।",
    "permission-denied": "এই কাজের অনুমতি নেই। Firebase Rules যাচাই করো।",
    "failed-precondition": "এই কাজটি সম্পন্ন করা যাচ্ছে না।",
    "unavailable": "ইন্টারনেট সংযোগ পরীক্ষা করো।"
  };

  return map[e?.code] || e?.message || "কাজটি সম্পন্ন হয়নি।";
}

/* Authentication */

$("loginBtn").onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );
  } catch (e) {
    msg(errorText(e));
  }
};

$("registerBtn").onclick = async () => {
  try {
    const name = $("regName").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!name) return msg("নাম লিখুন।");

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(cred.user, {
      displayName: name
    });

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email: cred.user.email,
      phone: "",
      createdAt: serverTimestamp(),
      subscription: {
        active: false,
        expiresAt: null
      }
    });

    msg("অ্যাকাউন্ট তৈরি হয়েছে।");

  } catch (e) {
    msg(errorText(e));
  }
};

$("resetBtn").onclick = async () => {
  try {
    const email = $("email").value.trim();

    if (!email) return msg("প্রথমে Email লিখুন।");

    await sendPasswordResetEmail(auth, email);
    msg("পাসওয়ার্ড রিসেটের ইমেইল পাঠানো হয়েছে।");

  } catch (e) {
    msg(errorText(e));
  }
};

$("logoutBtn").onclick = () => signOut(auth);

/* Authentication State */

onAuthStateChanged(auth, async u => {
  clearSubs();

  currentUser = u;
  isAdmin = false;

  if (!u) {
    $("auth").classList.remove("hidden");
    $("app").classList.add("hidden");
    $("who").textContent = "";
    return;
  }

  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = u.email || "";

  try {
    const token = await u.getIdTokenResult(true);
    isAdmin = token.claims.admin === true;
  } catch (e) {
    console.error(e);
  }

  $("adminTab").classList.toggle("hidden", !isAdmin);

  try {
    await loadProfile();

    loadResources();
    loadPlan();
    loadPayments();
    loadSupport();

    if (isAdmin) {
      loadAdminConfig();
      loadPending();
      loadFolders();
      loadAdminFiles();
      loadAdminMessages();
    }

    showTab("home");

  } catch (e) {
    console.error(e);
    msg(errorText(e));
  }
});

/* Profile */

async function loadProfile() {
  const d = await userDoc();

  $("profileName").value =
    d.name || currentUser.displayName || "";

  $("profilePhone").value = d.phone || "";

  $("profileMeta").textContent =
    `Email: ${currentUser.email} | UID: ${currentUser.uid}`;
}

$("saveProfile").onclick = async () => {
  try {
    const name = $("profileName").value.trim();
    const phone = $("profilePhone").value.trim();

    if (!name) return msg("নাম লিখুন।");

    await updateDoc(doc(db, "users", currentUser.uid), {
      name,
      phone
    });

    await updateProfile(currentUser, {
      displayName: name
    });

    msg("প্রোফাইল আপডেট হয়েছে।");

  } catch (e) {
    msg(errorText(e));
  }
};

/* Subscription */

async function loadPlan() {
  try {
    const c = await getConfig();
    const d = await userDoc();
    const sub = d.subscription || {};

    const active =
      sub.active === true &&
      (!sub.expiresAt || sub.expiresAt.toMillis() > Date.now());

    $("planInfo").innerHTML = `
      <div class="item">
        bKash নম্বর: <b>${esc(c.number)}</b><br>
        পরিশোধযোগ্য: <b>${Number(c.amount)} টাকা</b><br>
        মেয়াদ:
        <b>
          ${Number(c.durationDays) === 0
            ? "মেয়াদ নেই (Lifetime)"
            : Number(c.durationDays) + " দিন"}
        </b>
        <br><br>
        টাকা পাঠানোর পর TrxID জমা দাও।
        Admin যাচাই করে অনুমোদন দিলে অ্যাক্সেস পাবে।
        <br>
        বর্তমান অবস্থা:
        <span class="badge">${active ? "Active" : "Inactive"}</span>
        ${sub.expiresAt
          ? `<br>মেয়াদ শেষ: ${niceDate(sub.expiresAt)}`
          : ""}
      </div>
    `;

  } catch (e) {
    msg(errorText(e));
  }
}

/* Payment Submission and Correction */

$("submitPayment").onclick = async () => {
  const trx = $("trxid").value.trim();

  if (!trx) return msg("TrxID লিখুন।");
  if (trx.length < 5) return msg("সঠিক TrxID লিখুন।");

  try {
    const c = await getConfig();

    const paymentRef = doc(db, "payments", currentUser.uid);
    const historyRef = doc(
      collection(db, "payments", currentUser.uid, "history")
    );

    await runTransaction(db, async tx => {
      const snap = await tx.get(paymentRef);

      // First submission
      if (!snap.exists()) {
        tx.set(paymentRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          trxid: trx,
          amount: Number(c.amount),
          durationDays: Number(c.durationDays),
          status: "pending",
          correctionCount: 0,
          rejectCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        tx.set(historyRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          trxid: trx,
          action: "submitted",
          correctionCount: 0,
          createdAt: serverTimestamp()
        });

        return;
      }

      const p = snap.data();

      if (p.status === "approved") {
        throw new Error("পেমেন্ট Approve হয়েছে। নতুন ID দেওয়া যাবে না।");
      }

      // Correct pending ID
      if (p.status === "pending") {
        const count = Number(p.correctionCount || 0);

        if (count >= 3) {
          throw new Error("৩ বার ID পরিবর্তন করা হয়েছে। আর পরিবর্তন করা যাবে না।");
        }

        if (trx === p.trxid) {
          throw new Error("নতুন Transaction ID দিন।");
        }

        tx.update(paymentRef, {
          trxid: trx,
          amount: Number(c.amount),
          durationDays: Number(c.durationDays),
          correctionCount: count + 1,
          updatedAt: serverTimestamp()
        });

        tx.set(historyRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          trxid: trx,
          action: "corrected",
          correctionCount: count + 1,
          createdAt: serverTimestamp()
        });

        return;
      }

      // Resubmit after admin rejection
      if (p.status === "rejected") {
        if (trx === p.trxid) {
          throw new Error("নতুন Transaction ID দিন।");
        }

        tx.update(paymentRef, {
          trxid: trx,
          amount: Number(c.amount),
          durationDays: Number(c.durationDays),
          status: "pending",
          correctionCount: 0,
          reviewNote: "",
          updatedAt: serverTimestamp()
        });

        tx.set(historyRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          trxid: trx,
          action: "resubmitted",
          correctionCount: 0,
          createdAt: serverTimestamp()
        });

        return;
      }

      throw new Error("Payment Status সঠিক নয়।");
    });

    $("trxid").value = "";
    msg("Transaction ID জমা হয়েছে।");

  } catch (e) {
    console.error(e);
    msg(errorText(e));
  }
};

/* User Payment History */

function loadPayments() {
  const paymentRef = doc(db, "payments", currentUser.uid);

  unsubs.push(onSnapshot(paymentRef, snap => {
    if (!snap.exists()) {
      $("myPayments").innerHTML =
        "<h3>আমার পেমেন্ট</h3> এখনো কোনো Payment Request নেই।";

      $("submitPayment").disabled = false;
      $("trxid").disabled = false;
      return;
    }

    const p = snap.data();

    $("myPayments").innerHTML = `
      <h3>আমার পেমেন্ট</h3>
      <div class="item">
        বর্তমান TrxID: <b>${esc(p.trxid)}</b><br>
        Status: <b>${esc(p.status)}</b><br>
        Correction: ${Number(p.correctionCount || 0)}/3<br>
        Reject Count: ${Number(p.rejectCount || 0)}<br>
        Amount: ${Number(p.amount)} টাকা<br>
        ${p.reviewNote ? `Reject কারণ: ${esc(p.reviewNote)}` : ""}
      </div>
      <h3>Transaction ID History</h3>
      <div id="myPaymentHistory">লোড হচ্ছে...</div>
    `;

    const locked = p.status === "approved";

    $("submitPayment").disabled = locked;
    $("trxid").disabled = locked;

  }, e => msg(errorText(e))));

  const historyQuery = query(
    collection(db, "payments", currentUser.uid, "history"),
    orderBy("createdAt", "asc")
  );

  unsubs.push(onSnapshot(historyQuery, s => {
    const el = $("myPaymentHistory");
    if (!el) return;

    el.innerHTML = s.docs.map(d => {
      const h = d.data();

      return `
        <div class="item">
          TrxID: <b>${esc(h.trxid)}</b><br>
          Action: ${esc(h.action)}<br>
          ${niceDate(h.createdAt)}
        </div>
      `;
    }).join("") || "কোনো History নেই।";

  }, e => msg(errorText(e))));
}

/* Resources */

async function loadResources() {
  try {
    const d = await userDoc();
    const sub = d.subscription || {};

    const active =
      sub.active === true &&
      (!sub.expiresAt || sub.expiresAt.toMillis() > Date.now());

    if (!active && !isAdmin) {
      $("resourceList").innerHTML =
        '<div class="item">রিসোর্স দেখতে সাবস্ক্রিপশন প্রয়োজন।</div>';
      return;
    }

    const foldersSnap = await getDocs(
      query(collection(db, "folders"), orderBy("createdAt", "asc"))
    );

    const filesSnap = await getDocs(
      query(collection(db, "files"), orderBy("createdAt", "desc"))
    );

    const folders = foldersSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const items = filesSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const groups = [
      ...folders.map(f => ({
        id: f.id,
        name: f.name
      })),
      {
        id: "__other",
        name: "অন্যান্য"
      }
    ];

    $("resourceList").innerHTML =
      groups.map(g => {
        const fs = items.filter(
          f => (f.folderId || "__other") === g.id
        );

        return fs.length
          ? `
            <div class="resource-folder">
              <h3>${esc(g.name)}</h3>
              ${fs.map(f => `
                <div class="item">
                  <b>${esc(f.name)}</b>
                  ${f.description
                    ? `<p>${esc(f.description)}</p>`
                    : ""}
                  <a
                    href="${esc(validUrl(f.url) ? f.url : "#")}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ফাইল খুলুন ↗
                  </a>
                </div>
              `).join("")}
            </div>
          `
          : "";
      }).join("") || "এখনো কোনো রিসোর্স যোগ করা হয়নি।";

  } catch (e) {
    $("resourceList").textContent = errorText(e);
  }
}

/* User Support */

function loadSupport() {
  const q = query(
    collection(db, "support"),
    where("uid", "==", currentUser.uid),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  unsubs.push(onSnapshot(q, s => {
    $("supportList").innerHTML = s.docs.map(d => {
      const x = d.data();

      return `
        <div class="item">
          <b>${esc(x.name || "User")}</b>
          <span class="muted">${niceDate(x.createdAt)}</span>
          <p>${esc(x.text)}</p>
        </div>
      `;
    }).join("");

  }, e => msg(errorText(e))));
}

$("sendSupport").onclick = async () => {
  const text = $("supportText").value.trim();

  if (!text) return;

  try {
    const d = await userDoc();

    await addDoc(collection(db, "support"), {
      uid: currentUser.uid,
      email: currentUser.email,
      name: d.name || currentUser.displayName || "User",
      text,
      createdAt: serverTimestamp()
    });

    $("supportText").value = "";

  } catch (e) {
    msg(errorText(e));
  }
};

/* Admin Payment Configuration */

async function loadAdminConfig() {
  if (!isAdmin) return;

  const c = await getConfig();

  $("cfgNumber").value = c.number;
  $("cfgAmount").value = c.amount;
  $("cfgDays").value = c.durationDays;
}

$("saveConfig").onclick = async () => {
  if (!isAdmin) return;

  const number = $("cfgNumber").value.trim();
  const amount = Number($("cfgAmount").value);
  const durationDays = Number($("cfgDays").value);

  if (
    !number ||
    !Number.isFinite(amount) ||
    amount < 1 ||
    !Number.isInteger(durationDays) ||
    durationDays < 0
  ) {
    return msg("সঠিক নম্বর, মূল্য ও মেয়াদ লিখুন।");
  }

  try {
    await setDoc(doc(db, "settings", "payment"), {
      number,
      amount,
      durationDays,
      updatedAt: serverTimestamp()
    });

    msg("Payment Control সংরক্ষণ হয়েছে।");
    loadPlan();

  } catch (e) {
    msg(errorText(e));
  }
};

/* Admin Pending Payments and ID History */

function loadPending() {
  if (!isAdmin) return;

  const q = query(
    collection(db, "payments"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  unsubs.push(onSnapshot(q, async s => {
    try {
      const items = await Promise.all(s.docs.map(async d => {
        const x = d.data();

        const hs = await getDocs(query(
          collection(db, "payments", d.id, "history"),
          orderBy("createdAt", "asc")
        ));

        const history = hs.docs.map(h => {
          const v = h.data();

          return `
            <div class="muted">
              TrxID: ${esc(v.trxid)} |
              ${esc(v.action)} |
              ${niceDate(v.createdAt)}
            </div>
          `;
        }).join("");

        return `
          <div class="item">
            <b>${esc(x.email)}</b><br>
            UID: ${esc(x.uid)}<br>
            Current TrxID: <b>${esc(x.trxid)}</b><br>
            Amount: ${Number(x.amount)} টাকা<br>
            Correction: ${Number(x.correctionCount || 0)}/3<br>
            Reject Count: ${Number(x.rejectCount || 0)}<br>

            <details>
              <summary>Transaction ID History দেখুন</summary>
              ${history || "History নেই।"}
            </details>

            <br>
            <button class="good" data-approve="${d.id}">
              Approve
            </button>

            <button class="danger" data-reject="${d.id}">
              Reject
            </button>
          </div>
        `;
      }));

      $("pendingList").innerHTML =
        items.join("") || "Pending payment নেই।";

      document.querySelectorAll("[data-approve]").forEach(b => {
        b.onclick = () => review(b.dataset.approve, "approve");
      });

      document.querySelectorAll("[data-reject]").forEach(b => {
        b.onclick = () => review(b.dataset.reject, "reject");
      });

    } catch (e) {
      console.error(e);
      msg(errorText(e));
    }

  }, e => msg(errorText(e))));
}

/* Payment Approval and Rejection */

async function review(paymentId, decision) {
  if (!isAdmin) return;

  const note = decision === "reject"
    ? (prompt("Reject করার কারণ (ঐচ্ছিক):") || "")
    : "";

  try {
    await runTransaction(db, async tx => {
      const paymentRef = doc(db, "payments", paymentId);
      const paymentSnap = await tx.get(paymentRef);

      if (!paymentSnap.exists()) {
        throw new Error("Payment পাওয়া যায়নি।");
      }

      const payment = paymentSnap.data();

      if (payment.status !== "pending") {
        throw new Error("এই Payment আগে Review করা হয়েছে।");
      }

      if (decision === "approve") {
        const userRef = doc(db, "users", payment.uid);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists()) {
          throw new Error("User পাওয়া যায়নি।");
        }

        const days = Number(payment.durationDays);

        if (
          !Number.isInteger(days) ||
          days < 0 ||
          days > 36500
        ) {
          throw new Error("Payment-এর মেয়াদ সঠিক নয়।");
        }

        const expiry = days === 0
          ? null
          : new Date(Date.now() + days * 86400000);

        tx.update(userRef, {
          subscription: {
            active: true,
            expiresAt: expiry,
            approvedPaymentId: paymentId
          }
        });

        tx.update(paymentRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
          approvedBy: currentUser.uid
        });

      } else if (decision === "reject") {
        tx.update(paymentRef, {
          status: "rejected",
          rejectCount: Number(payment.rejectCount || 0) + 1,
          reviewNote: note.slice(0, 300),
          reviewedAt: serverTimestamp(),
          reviewedBy: currentUser.uid
        });

      } else {
        throw new Error("সঠিক সিদ্ধান্ত নির্বাচন করো।");
      }
    });

    msg(
      decision === "approve"
        ? "পেমেন্ট অনুমোদিত হয়েছে।"
        : "পেমেন্ট Reject হয়েছে।"
    );

    loadPlan();
    loadResources();

  } catch (e) {
    console.error("Payment review error:", e);
    msg(errorText(e));
  }
}

/* Admin Folders */

async function loadFolders() {
  if (!isAdmin) return;

  const s = await getDocs(
    query(collection(db, "folders"), orderBy("createdAt", "asc"))
  );

  const fs = s.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  $("folderList").innerHTML =
    fs.map(f => `
      <div class="item">
        ${esc(f.name)}
        <button class="secondary" data-edit-folder="${f.id}">
          Edit
        </button>
        <button class="danger" data-del-folder="${f.id}">
          Delete
        </button>
      </div>
    `).join("") || "কোনো ফোল্ডার নেই।";

  $("fileFolder").innerHTML =
    '<option value="">অন্যান্য</option>' +
    fs.map(f => `
      <option value="${f.id}">${esc(f.name)}</option>
    `).join("");

  document.querySelectorAll("[data-del-folder]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("ফোল্ডার মুছবে?")) return;

      try {
        await deleteDoc(doc(db, "folders", b.dataset.delFolder));
        loadFolders();
      } catch (e) {
        msg(errorText(e));
      }
    };
  });

  document.querySelectorAll("[data-edit-folder]").forEach(b => {
    b.onclick = async () => {
      const ref = doc(db, "folders", b.dataset.editFolder);
      const d = await getDoc(ref);

      const name = prompt(
        "ফোল্ডারের নতুন নাম:",
        d.data()?.name || ""
      );

      if (name?.trim()) {
        try {
          await updateDoc(ref, {
            name: name.trim(),
            updatedAt: serverTimestamp()
          });

          loadFolders();

        } catch (e) {
          msg(errorText(e));
        }
      }
    };
  });
}

$("addFolder").onclick = async () => {
  const name = $("folderName").value.trim();

  if (!name) return msg("ফোল্ডারের নাম লিখুন।");

  try {
    await addDoc(collection(db, "folders"), {
      name,
      createdAt: serverTimestamp()
    });

    $("folderName").value = "";
    loadFolders();

  } catch (e) {
    msg(errorText(e));
  }
};

/* Admin Files */

$("saveFile").onclick = async () => {
  const name = $("fileName").value.trim();
  const url = $("fileUrl").value.trim();

  if (!name || !validUrl(url)) {
    return msg("সঠিক ফাইলের নাম ও URL দিন।");
  }

  try {
    await addDoc(collection(db, "files"), {
      name,
      url,
      description: $("fileDesc").value.trim(),
      folderId: $("fileFolder").value || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $("fileName").value = "";
    $("fileUrl").value = "";
    $("fileDesc").value = "";

    msg("ফাইল যোগ হয়েছে।");
    loadAdminFiles();

  } catch (e) {
    msg(errorText(e));
  }
};

async function loadAdminFiles() {
  if (!isAdmin) return;

  const s = await getDocs(
    query(collection(db, "files"), orderBy("createdAt", "desc"))
  );

  $("adminFiles").innerHTML =
    s.docs.map(d => {
      const x = d.data();

      return `
        <div class="item">
          ${esc(x.name)}
          <br>
          <span class="muted">${esc(x.url)}</span>
          <br>
          <button class="secondary" data-edit-file="${d.id}">
            Edit
          </button>
          <button class="danger" data-del-file="${d.id}">
            Delete
          </button>
        </div>
      `;
    }).join("") || "কোনো ফাইল নেই।";

  document.querySelectorAll("[data-del-file]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("ফাইল মুছবে?")) return;

      try {
        await deleteDoc(doc(db, "files", b.dataset.delFile));
        loadAdminFiles();
      } catch (e) {
        msg(errorText(e));
      }
    };
  });

  document.querySelectorAll("[data-edit-file]").forEach(b => {
    b.onclick = async () => {
      const ref = doc(db, "files", b.dataset.editFile);
      const d = (await getDoc(ref)).data();

      const name = prompt("ফাইলের নাম:", d.name);
      if (name === null) return;

      const url = prompt("ফাইল URL:", d.url);
      if (url === null || !validUrl(url)) {
        return msg("সঠিক URL দিন।");
      }

      const description = prompt(
        "বিবরণ:",
        d.description || ""
      );

      try {
        await updateDoc(ref, {
          name: name.trim(),
          url,
          description: description || "",
          updatedAt: serverTimestamp()
        });

        loadAdminFiles();

      } catch (e) {
        msg(errorText(e));
      }
    };
  });
}

/* Admin Support Messages */

function loadAdminMessages() {
  if (!isAdmin) return;

  const q = query(
    collection(db, "support"),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  unsubs.push(onSnapshot(q, s => {
    $("adminMessages").innerHTML =
      s.docs.map(d => `
        <div class="item">
          <b>
            ${esc(d.data().name || d.data().email || "User")}
          </b>
          <p>${esc(d.data().text)}</p>
          <button class="danger" data-del-message="${d.id}">
            মেসেজ মুছুন
          </button>
        </div>
      `).join("") || "মেসেজ নেই।";

    document.querySelectorAll("[data-del-message]").forEach(b => {
      b.onclick = async () => {
        if (!confirm("মেসেজটি মুছবে?")) return;

        try {
          await deleteDoc(doc(db, "support", b.dataset.delMessage));
        } catch (e) {
          msg(errorText(e));
        }
      };
    });

  }, e => msg(errorText(e))));
}
