/* =========================================================
   MENTRA CHAT
   Firebase Client
   Auth: username + password
   Register: phone + username + password
   No OTP
   ========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
} from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCABFYMEsfwOI5hvZALTqoFsameHqq5QXI",
  authDomain: "fire-chat-c043f.firebaseapp.com",
  projectId: "fire-chat-c043f",
  storageBucket: "fire-chat-c043f.firebasestorage.app",
  messagingSenderId: "666512765812",
  appId: "1:666512765812:web:9bce88a00a791e2851f221",
  measurementId: "G-LW21XL2YRK"
};


/* =========================================================
   FIREBASE INIT
   ========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let me = null;
let currentUser = null;

let currentChatId = null;
let currentChatUser = null;

let unsubscribeMessages = null;
let unsubscribeChats = null;

let registrationInProgress = false;

let contactsCache = [];
let usersCache = [];

let activeSection = "chat";


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function show(id) {
  const el = $(id);
  if (el) el.style.display = "";
}

function hide(id) {
  const el = $(id);
  if (el) el.style.display = "none";
}

function text(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}

function value(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "") {
  const clean = String(name).trim();

  if (!clean) return "?";

  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x.charAt(0).toUpperCase())
    .join("");
}

function usernameToEmail(username, old = false) {
  const clean = username.toLowerCase().trim();

  return old
    ? `${clean}@users.mentra.local`
    : `${clean}@users.mentra.chat`;
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message, type = "normal") {
  let container = $("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";

    Object.assign(container.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: "99999",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      maxWidth: "calc(100vw - 40px)"
    });

    document.body.appendChild(container);
  }

  const item = document.createElement("div");

  item.textContent = message;

  Object.assign(item.style, {
    padding: "12px 16px",
    borderRadius: "14px",
    background:
      type === "error"
        ? "#3a1519"
        : type === "success"
          ? "#123a2a"
          : "#171b25",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    fontSize: "14px",
    maxWidth: "340px"
  });

  container.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(8px)";
    item.style.transition = ".25s";

    setTimeout(() => item.remove(), 250);
  }, 2800);
}


/* =========================================================
   FIREBASE ERROR TRANSLATOR
   ========================================================= */

function firebaseError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-credential":
      "Username atau password salah.",

    "auth/invalid-login-credentials":
      "Username atau password salah.",

    "auth/user-not-found":
      "Akun tidak ditemukan.",

    "auth/wrong-password":
      "Password salah.",

    "auth/email-already-in-use":
      "Username tersebut sudah digunakan.",

    "auth/weak-password":
      "Password terlalu lemah.",

    "auth/invalid-email":
      "Username tidak valid.",

    "auth/network-request-failed":
      "Koneksi internet bermasalah.",

    "auth/too-many-requests":
      "Terlalu banyak percobaan. Coba lagi nanti.",

    "permission-denied":
      "Firebase menolak akses. Cek Firestore Rules.",

    "failed-precondition":
      "Firebase membutuhkan konfigurasi tambahan."
  };

  return messages[code] ||
    error?.message ||
    "Terjadi kesalahan.";
}


/* =========================================================
   AUTH PERSISTENCE
   ========================================================= */

async function setupPersistence() {
  try {
    await setPersistence(
      auth,
      browserSessionPersistence
    );
  } catch (error) {
    console.error("Persistence error:", error);
  }
}


/* =========================================================
   AUTH UI
   ========================================================= */

function showAuth() {
  const authScreen = $("authScreen");
  const appScreen = $("appScreen");

  if (authScreen) authScreen.style.display = "";
  if (appScreen) appScreen.style.display = "none";

  hide("profilePanel");
  hide("callModal");
}

function showApp() {
  const authScreen = $("authScreen");
  const appScreen = $("appScreen");

  if (authScreen) authScreen.style.display = "none";
  if (appScreen) appScreen.style.display = "";

  renderMyProfile();
}


/* =========================================================
   AUTH MODE
   ========================================================= */

function switchAuthMode(mode) {
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");

  const loginTab = $("loginTab");
  const registerTab = $("registerTab");

  if (mode === "register") {
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "";

    if (loginTab) loginTab.classList.remove("active");
    if (registerTab) registerTab.classList.add("active");
  } else {
    if (loginForm) loginForm.style.display = "";
    if (registerForm) registerForm.style.display = "none";

    if (loginTab) loginTab.classList.add("active");
    if (registerTab) registerTab.classList.remove("active");
  }
}


/* =========================================================
   VALIDATE USERNAME
   ========================================================= */

function validateUsername(username) {
  if (!username) {
    return "Username wajib diisi.";
  }

  if (username.length < 3) {
    return "Username minimal 3 karakter.";
  }

  if (username.length > 24) {
    return "Username maksimal 24 karakter.";
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return "Username hanya boleh memakai huruf, angka, titik, dan underscore.";
  }

  return null;
}


/* =========================================================
   CHECK USERNAME
   ========================================================= */

async function usernameExists(username) {
  const usernameLower = username.toLowerCase();

  const q = query(
    collection(db, "users"),
    where("usernameLower", "==", usernameLower),
    limit(1)
  );

  const result = await getDocs(q);

  return !result.empty;
}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerAccount(event) {
  event?.preventDefault();

  if (registrationInProgress) return;

  const phone = value("registerPhone");
  const usernameRaw = value("registerUsername");
  const password = value("registerPassword");

  const username = usernameRaw.toLowerCase();

  if (!phone) {
    toast("Nomor HP wajib diisi.", "error");
    return;
  }

  const usernameError = validateUsername(username);

  if (usernameError) {
    toast(usernameError, "error");
    return;
  }

  if (!password || password.length < 8) {
    toast("Password minimal 8 karakter.", "error");
    return;
  }

  registrationInProgress = true;

  let createdCredential = null;

  try {
    /* ---------------------------------------------
       CHECK USERNAME
       --------------------------------------------- */

    const exists = await usernameExists(username);

    if (exists) {
      throw new Error("USERNAME_ALREADY_EXISTS");
    }


    /* ---------------------------------------------
       CREATE FIREBASE AUTH
       --------------------------------------------- */

    const internalEmail =
      usernameToEmail(username);

    createdCredential =
      await createUserWithEmailAndPassword(
        auth,
        internalEmail,
        password
      );


    /* ---------------------------------------------
       CREATE USER PROFILE
       --------------------------------------------- */

    const uid = createdCredential.user.uid;

    const profile = {
      uid,
      username,
      usernameLower: username,
      phone,
      bio: "",
      photoURL: "",
      contacts: [],
      groups: [],
      channels: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, "users", uid),
      profile
    );


    /* ---------------------------------------------
       CREATE USERNAME INDEX
       --------------------------------------------- */

    await setDoc(
      doc(db, "usernames", username),
      {
        uid,
        username,
        createdAt: serverTimestamp()
      }
    );


    /* ---------------------------------------------
       LOAD ACCOUNT
       --------------------------------------------- */

    registrationInProgress = false;

    await loadCurrentAccount(
      createdCredential.user
    );

    toast(
      "Akun berhasil dibuat.",
      "success"
    );

  } catch (error) {

    console.error("REGISTER ERROR:", error);

    registrationInProgress = false;


    /* ---------------------------------------------
       CUSTOM ERROR
       --------------------------------------------- */

    if (error.message === "USERNAME_ALREADY_EXISTS") {
      toast(
        "Username sudah digunakan.",
        "error"
      );

      return;
    }


    /* ---------------------------------------------
       ROLLBACK AUTH USER
       --------------------------------------------- */

    if (
      createdCredential?.user &&
      auth.currentUser?.uid === createdCredential.user.uid
    ) {
      try {
        await deleteUser(
          createdCredential.user
        );
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }
    }

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginAccount(event) {
  event?.preventDefault();

  const usernameRaw = value("loginUsername");
  const password = value("loginPassword");

  const username = usernameRaw.toLowerCase();

  if (!username) {
    toast("Username wajib diisi.", "error");
    return;
  }

  if (!password) {
    toast("Password wajib diisi.", "error");
    return;
  }

  const usernameError = validateUsername(username);

  if (usernameError) {
    toast(usernameError, "error");
    return;
  }

  try {

    /* ---------------------------------------------
       TRY NEW INTERNAL EMAIL
       --------------------------------------------- */

    let credential = null;

    try {

      credential =
        await signInWithEmailAndPassword(
          auth,
          usernameToEmail(username, false),
          password
        );

    } catch (newError) {

      /*
       Support account lama dari versi sebelumnya
       yang masih memakai @users.mentra.local
      */

      if (
        newError.code === "auth/invalid-credential" ||
        newError.code === "auth/user-not-found" ||
        newError.code === "auth/wrong-password"
      ) {

        credential =
          await signInWithEmailAndPassword(
            auth,
            usernameToEmail(username, true),
            password
          );

      } else {
        throw newError;
      }
    }


    /* ---------------------------------------------
       LOAD PROFILE
       --------------------------------------------- */

    await loadCurrentAccount(
      credential.user
    );

    toast(
      "Berhasil masuk.",
      "success"
    );

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   LOAD CURRENT ACCOUNT
   ========================================================= */

async function loadCurrentAccount(user) {

  if (!user) {
    showAuth();
    return;
  }

  currentUser = user;

  try {

    const ref =
      doc(db, "users", user.uid);

    const snap =
      await getDoc(ref);


    /* ---------------------------------------------
       PROFILE TIDAK ADA
       --------------------------------------------- */

    if (!snap.exists()) {

      console.error(
        "Profile Firebase tidak ditemukan:",
        user.uid
      );

      toast(
        "Data akun tidak ditemukan.",
        "error"
      );

      await signOut(auth);

      return;
    }


    /* ---------------------------------------------
       SET STATE
       --------------------------------------------- */

    me = {
      id: user.uid,
      ...snap.data()
    };


    /* ---------------------------------------------
       NORMALIZE
       --------------------------------------------- */

    me.contacts =
      Array.isArray(me.contacts)
        ? me.contacts
        : [];

    me.groups =
      Array.isArray(me.groups)
        ? me.groups
        : [];

    me.channels =
      Array.isArray(me.channels)
        ? me.channels
        : [];


    /* ---------------------------------------------
       ENTER APP
       --------------------------------------------- */

    showApp();

    await loadContacts();

    renderChatList();

    openSection("chat");

  } catch (error) {

    console.error(
      "LOAD ACCOUNT ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    console.log(
      "AUTH STATE:",
      user ? user.uid : "LOGGED OUT"
    );

    if (!user) {

      currentUser = null;
      me = null;

      if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
      }

      if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
      }

      showAuth();

      return;
    }

    /*
      Saat register sedang membuat profile,
      jangan jalankan load account dulu.
    */

    if (registrationInProgress) {
      return;
    }

    await loadCurrentAccount(user);
  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAccount() {

  try {

    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    if (unsubscribeChats) {
      unsubscribeChats();
      unsubscribeChats = null;
    }

    await signOut(auth);

    me = null;
    currentUser = null;
    currentChatId = null;
    currentChatUser = null;

    toast(
      "Kamu sudah keluar.",
      "success"
    );

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CONTACTS
   ========================================================= */

async function loadContacts() {

  if (!me) return;

  contactsCache = [];

  for (const uid of me.contacts || []) {

    try {

      const snap =
        await getDoc(
          doc(db, "users", uid)
        );

      if (snap.exists()) {

        contactsCache.push({
          id: uid,
          ...snap.data()
        });

      }

    } catch (error) {

      console.error(
        "Contact load error:",
        error
      );
    }
  }
}


/* =========================================================
   SEARCH USERNAME
   ========================================================= */

async function searchUsername(username) {

  username = username
    .trim()
    .toLowerCase();

  if (!username) {
    toast(
      "Masukkan username.",
      "error"
    );
    return null;
  }

  try {

    const q = query(
      collection(db, "users"),
      where(
        "usernameLower",
        "==",
        username
      ),
      limit(1)
    );

    const result =
      await getDocs(q);

    if (result.empty) {

      toast(
        "Username tidak ditemukan.",
        "error"
      );

      return null;
    }

    const snap =
      result.docs[0];

    return {
      id: snap.id,
      ...snap.data()
    };

  } catch (error) {

    console.error(
      "SEARCH ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );

    return null;
  }
}


/* =========================================================
   ADD CONTACT
   ========================================================= */

async function addContactByUsername(username) {

  if (!me) return;

  const target =
    await searchUsername(username);

  if (!target) return;

  if (target.id === me.id) {

    toast(
      "Tidak bisa menambahkan diri sendiri.",
      "error"
    );

    return;
  }

  if (
    (me.contacts || [])
      .includes(target.id)
  ) {

    toast(
      "Kontak sudah ada.",
      "normal"
    );

    openChat(target);

    return;
  }

  try {

    const contacts = [
      ...(me.contacts || []),
      target.id
    ];

    await updateDoc(
      doc(db, "users", me.id),
      {
        contacts,
        updatedAt: serverTimestamp()
      }
    );

    me.contacts = contacts;

    contactsCache.push(target);

    renderChatList();

    toast(
      `@${target.username} ditambahkan.`,
      "success"
    );

    openChat(target);

  } catch (error) {

    console.error(
      "ADD CONTACT ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CHAT ID
   ========================================================= */

function makeChatId(uid1, uid2) {

  return [uid1, uid2]
    .sort()
    .join("_");
}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openChat(user) {

  if (!me || !user) return;

  currentChatUser = user;

  currentChatId =
    makeChatId(me.id, user.id);

  activeSection = "chat";

  showChatView();

  text(
    "chatTitle",
    user.username
      ? `@${user.username}`
      : "Chat"
  );

  text(
    "chatSubtitle",
    user.bio || "Online"
  );

  const avatar = $("chatAvatar");

  if (avatar) {

    avatar.textContent =
      initials(user.username);
  }

  loadMessages();
}


/* =========================================================
   CHAT VIEW
   ========================================================= */

function showChatView() {

  const views = [
    "chatView",
    "statusView",
    "groupsView",
    "channelsView"
  ];

  views.forEach(id => {
    const el = $(id);

    if (el) {
      el.style.display =
        id === "chatView"
          ? ""
          : "none";
    }
  });
}


/* =========================================================
   LOAD MESSAGES
   ========================================================= */

function loadMessages() {

  if (!currentChatId) return;

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  const messagesRef =
    collection(
      db,
      "chats",
      currentChatId,
      "messages"
    );

  const q = query(
    messagesRef,
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages =
    onSnapshot(
      q,
      snapshot => {

        const container =
          $("messages");

        if (!container) return;

        container.innerHTML = "";

        snapshot.forEach(
          messageSnap => {

            const msg =
              messageSnap.data();

            renderMessage(
              container,
              msg
            );
          }
        );

        container.scrollTop =
          container.scrollHeight;
      },
      error => {

        console.error(
          "MESSAGE LISTENER:",
          error
        );

        toast(
          firebaseError(error),
          "error"
        );
      }
    );
}


/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function renderMessage(container, msg) {

  const mine =
    msg.senderId === me?.id;

  const bubble =
    document.createElement("div");

  bubble.className =
    mine
      ? "message mine"
      : "message";

  const messageText =
    escapeHTML(msg.text || "");

  bubble.innerHTML = `
    <div class="message-bubble">
      ${messageText}
    </div>
  `;

  container.appendChild(bubble);
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  if (!me || !currentChatId) {

    toast(
      "Pilih chat terlebih dahulu.",
      "error"
    );

    return;
  }

  const input =
    $("messageInput");

  if (!input) return;

  const message =
    input.value.trim();

  if (!message) return;

  try {

    input.value = "";

    await addDoc(
      collection(
        db,
        "chats",
        currentChatId,
        "messages"
      ),
      {
        senderId: me.id,
        receiverId:
          currentChatUser.id,
        text: message,
        createdAt:
          serverTimestamp()
      }
    );

  } catch (error) {

    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CHAT LIST
   ========================================================= */

function renderChatList() {

  const list =
    $("chatList");

  if (!list) return;

  list.innerHTML = "";

  if (!contactsCache.length) {

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">
          Belum ada chat
        </div>

        <div class="empty-text">
          Tambahkan kontak menggunakan username.
        </div>
      </div>
    `;

    return;
  }

  contactsCache.forEach(user => {

    const item =
      document.createElement("button");

    item.className =
      "chat-list-item";

    item.type = "button";

    item.innerHTML = `
      <div class="avatar">
        ${escapeHTML(initials(user.username))}
      </div>

      <div class="chat-list-info">
        <div class="chat-list-name">
          @${escapeHTML(user.username)}
        </div>

        <div class="chat-list-preview">
          ${escapeHTML(
            user.bio || "Mulai percakapan"
          )}
        </div>
      </div>
    `;

    item.addEventListener(
      "click",
      () => openChat(user)
    );

    list.appendChild(item);
  });
}


/* =========================================================
   GLOBAL SEARCH
   ========================================================= */

async function performSearch() {

  const input =
    $("searchInput");

  if (!input) return;

  const keyword =
    input.value.trim().toLowerCase();

  if (!keyword) {

    renderChatList();

    return;
  }

  const result =
    contactsCache.filter(user =>
      user.usernameLower
        ?.includes(keyword)
    );

  const list =
    $("chatList");

  if (!list) return;

  list.innerHTML = "";

  if (!result.length) {

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">
          Tidak ditemukan
        </div>

        <div class="empty-text">
          Coba username lain.
        </div>
      </div>
    `;

    return;
  }

  result.forEach(user => {

    const item =
      document.createElement("button");

    item.className =
      "chat-list-item";

    item.type = "button";

    item.innerHTML = `
      <div class="avatar">
        ${escapeHTML(initials(user.username))}
      </div>

      <div class="chat-list-info">
        <div class="chat-list-name">
          @${escapeHTML(user.username)}
        </div>

        <div class="chat-list-preview">
          ${escapeHTML(user.bio || "")}
        </div>
      </div>
    `;

    item.onclick =
      () => openChat(user);

    list.appendChild(item);
  });
}


/* =========================================================
   SECTIONS
   ========================================================= */

function openSection(section) {

  activeSection = section;

  const views = {
    chat: "chatView",
    status: "statusView",
    groups: "groupsView",
    channels: "channelsView"
  };

  Object.values(views)
    .forEach(id => {

      const el = $(id);

      if (el) {
        el.style.display = "none";
      }
    });

  const target =
    $(views[section]);

  if (target) {
    target.style.display = "";
  }

  document
    .querySelectorAll(
      "[data-section]"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.section === section
      );
    });


  if (section === "groups") {
    loadGroups();
  }

  if (section === "channels") {
    loadChannels();
  }

  if (section === "status") {
    loadStatuses();
  }
}


/* =========================================================
   STATUS
   ========================================================= */

async function loadStatuses() {

  const container =
    $("statusList");

  if (!container || !me) return;

  container.innerHTML = `
    <div class="empty-state">
      Memuat status...
    </div>
  `;

  try {

    const q = query(
      collection(db, "statuses"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const result =
      await getDocs(q);

    container.innerHTML = "";

    if (result.empty) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">
            Belum ada status
          </div>

          <div class="empty-text">
            Buat status pertama kamu.
          </div>
        </div>
      `;

      return;
    }

    result.forEach(snap => {

      const status =
        snap.data();

      const item =
        document.createElement("div");

      item.className =
        "status-item";

      item.innerHTML = `
        <div class="avatar">
          ${escapeHTML(
            initials(status.username)
          )}
        </div>

        <div>
          <strong>
            @${escapeHTML(
              status.username || "user"
            )}
          </strong>

          <div>
            ${escapeHTML(
              status.text || ""
            )}
          </div>
        </div>
      `;

      container.appendChild(item);
    });

  } catch (error) {

    console.error(
      "STATUS ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CREATE STATUS
   ========================================================= */

async function createStatus() {

  if (!me) return;

  const input =
    $("statusInput");

  if (!input) return;

  const statusText =
    input.value.trim();

  if (!statusText) {

    toast(
      "Isi status terlebih dahulu.",
      "error"
    );

    return;
  }

  try {

    await addDoc(
      collection(db, "statuses"),
      {
        ownerId: me.id,
        username: me.username,
        text: statusText,
        createdAt: serverTimestamp()
      }
    );

    input.value = "";

    toast(
      "Status dibuat.",
      "success"
    );

    loadStatuses();

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   GROUPS
   ========================================================= */

async function loadGroups() {

  const container =
    $("groupList");

  if (!container || !me) return;

  container.innerHTML = `
    <div class="empty-state">
      Memuat grup...
    </div>
  `;

  try {

    const q = query(
      collection(db, "groups"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const result =
      await getDocs(q);

    container.innerHTML = "";

    if (result.empty) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">
            Belum ada grup
          </div>

          <div class="empty-text">
            Buat grup untuk mulai ngobrol bersama.
          </div>
        </div>
      `;

      return;
    }

    result.forEach(snap => {

      const group =
        snap.data();

      const item =
        document.createElement("div");

      item.className =
        "group-item";

      item.innerHTML = `
        <div class="avatar">
          ${escapeHTML(
            initials(group.name)
          )}
        </div>

        <div class="chat-list-info">
          <div class="chat-list-name">
            ${escapeHTML(
              group.name || "Group"
            )}
          </div>

          <div class="chat-list-preview">
            ${escapeHTML(
              group.description || "Group chat"
            )}
          </div>
        </div>
      `;

      container.appendChild(item);
    });

  } catch (error) {

    console.error(
      "GROUP ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CREATE GROUP
   ========================================================= */

async function createGroup() {

  if (!me) return;

  const name =
    value("groupName");

  const description =
    value("groupDescription");

  if (!name) {

    toast(
      "Nama grup wajib diisi.",
      "error"
    );

    return;
  }

  try {

    const groupRef =
      await addDoc(
        collection(db, "groups"),
        {
          name,
          description,
          ownerId: me.id,
          members: [me.id],
          createdAt: serverTimestamp()
        }
      );

    me.groups = [
      ...(me.groups || []),
      groupRef.id
    ];

    await updateDoc(
      doc(db, "users", me.id),
      {
        groups: me.groups,
        updatedAt: serverTimestamp()
      }
    );

    if ($("groupName")) {
      $("groupName").value = "";
    }

    if ($("groupDescription")) {
      $("groupDescription").value = "";
    }

    toast(
      "Grup berhasil dibuat.",
      "success"
    );

    loadGroups();

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CHANNELS
   ========================================================= */

async function loadChannels() {

  const container =
    $("channelList");

  if (!container || !me) return;

  container.innerHTML = `
    <div class="empty-state">
      Memuat saluran...
    </div>
  `;

  try {

    const q = query(
      collection(db, "channels"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const result =
      await getDocs(q);

    container.innerHTML = "";

    if (result.empty) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">
            Belum ada saluran
          </div>

          <div class="empty-text">
            Buat saluran untuk membagikan informasi.
          </div>
        </div>
      `;

      return;
    }

    result.forEach(snap => {

      const channel =
        snap.data();

      const item =
        document.createElement("div");

      item.className =
        "channel-item";

      item.innerHTML = `
        <div class="avatar">
          ${escapeHTML(
            initials(channel.name)
          )}
        </div>

        <div class="chat-list-info">
          <div class="chat-list-name">
            ${escapeHTML(
              channel.name || "Channel"
            )}
          </div>

          <div class="chat-list-preview">
            ${escapeHTML(
              channel.description || ""
            )}
          </div>
        </div>
      `;

      container.appendChild(item);
    });

  } catch (error) {

    console.error(
      "CHANNEL ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CREATE CHANNEL
   ========================================================= */

async function createChannel() {

  if (!me) return;

  const name =
    value("channelName");

  const description =
    value("channelDescription");

  if (!name) {

    toast(
      "Nama saluran wajib diisi.",
      "error"
    );

    return;
  }

  try {

    const channelRef =
      await addDoc(
        collection(db, "channels"),
        {
          name,
          description,
          ownerId: me.id,
          members: [me.id],
          createdAt: serverTimestamp()
        }
      );

    me.channels = [
      ...(me.channels || []),
      channelRef.id
    ];

    await updateDoc(
      doc(db, "users", me.id),
      {
        channels: me.channels,
        updatedAt: serverTimestamp()
      }
    );

    if ($("channelName")) {
      $("channelName").value = "";
    }

    if ($("channelDescription")) {
      $("channelDescription").value = "";
    }

    toast(
      "Saluran berhasil dibuat.",
      "success"
    );

    loadChannels();

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   PROFILE
   ========================================================= */

function renderMyProfile() {

  if (!me) return;

  const username =
    `@${me.username || ""}`;

  text(
    "profileUsername",
    username
  );

  text(
    "profileBio",
    me.bio || "Belum ada bio."
  );

  text(
    "sidebarUsername",
    username
  );

  text(
    "sidebarBio",
    me.bio || ""
  );

  const profileAvatar =
    $("profileAvatar");

  if (profileAvatar) {
    profileAvatar.textContent =
      initials(me.username);
  }

  const sidebarAvatar =
    $("sidebarAvatar");

  if (sidebarAvatar) {
    sidebarAvatar.textContent =
      initials(me.username);
  }

  const usernameInput =
    $("profileUsernameInput");

  if (usernameInput) {
    usernameInput.value =
      me.username || "";
  }

  const bioInput =
    $("profileBioInput");

  if (bioInput) {
    bioInput.value =
      me.bio || "";
  }

  const phoneInput =
    $("profilePhone");

  if (phoneInput) {
    phoneInput.value =
      me.phone || "";
  }
}


/* =========================================================
   OPEN PROFILE
   ========================================================= */

function openProfile() {

  renderMyProfile();

  const panel =
    $("profilePanel");

  if (panel) {
    panel.style.display = "";
  }
}


/* =========================================================
   CLOSE PROFILE
   ========================================================= */

function closeProfile() {

  hide("profilePanel");
}


/* =========================================================
   SAVE PROFILE
   ========================================================= */

async function saveProfile() {

  if (!me) return;

  const bio =
    value("profileBioInput");

  try {

    await updateDoc(
      doc(db, "users", me.id),
      {
        bio,
        updatedAt: serverTimestamp()
      }
    );

    me.bio = bio;

    renderMyProfile();

    toast(
      "Profile berhasil diperbarui.",
      "success"
    );

  } catch (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );

    toast(
      firebaseError(error),
      "error"
    );
  }
}


/* =========================================================
   CALL UI
   ========================================================= */

async function startCall(type) {

  if (!currentChatUser) {

    toast(
      "Pilih chat terlebih dahulu.",
      "error"
    );

    return;
  }

  const modal =
    $("callModal");

  if (!modal) return;

  const title =
    $("callTitle");

  if (title) {
    title.textContent =
      type === "video"
        ? "Video Call"
        : "Voice Call";
  }

  const target =
    $("callUser");

  if (target) {
    target.textContent =
      `@${currentChatUser.username}`;
  }

  modal.style.display = "";

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    toast(
      "Browser tidak mendukung akses kamera/mikrofon.",
      "error"
    );

    return;
  }

  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: type === "video"
        });

    window.mentraCallStream =
      stream;

    const video =
      $("callVideo");

    if (
      video &&
      type === "video"
    ) {

      video.srcObject =
        stream;

      video.play().catch(() => {});
    }

  } catch (error) {

    console.error(
      "MEDIA ERROR:",
      error
    );

    toast(
      "Izin kamera/mikrofon ditolak.",
      "error"
    );
  }
}


/* =========================================================
   END CALL
   ========================================================= */

function endCall() {

  const stream =
    window.mentraCallStream;

  if (stream) {

    stream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    window.mentraCallStream =
      null;
  }

  const video =
    $("callVideo");

  if (video) {
    video.srcObject = null;
  }

  hide("callModal");
}


/* =========================================================
   MODAL HELPERS
   ========================================================= */

function openModal(id) {

  const el = $(id);

  if (el) {
    el.style.display = "";
  }
}

function closeModal(id) {

  const el = $(id);

  if (el) {
    el.style.display = "none";
  }
}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {

  /* ---------------------------------------------
     LOGIN
     --------------------------------------------- */

  $("loginForm")
    ?.addEventListener(
      "submit",
      loginAccount
    );


  /* ---------------------------------------------
     REGISTER
     --------------------------------------------- */

  $("registerForm")
    ?.addEventListener(
      "submit",
      registerAccount
    );


  /* ---------------------------------------------
     AUTH TABS
     --------------------------------------------- */

  $("loginTab")
    ?.addEventListener(
      "click",
      () => switchAuthMode("login")
    );

  $("registerTab")
    ?.addEventListener(
      "click",
      () => switchAuthMode("register")
    );


  /* ---------------------------------------------
     LOGOUT
     --------------------------------------------- */

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logoutAccount
    );


  /* ---------------------------------------------
     SEARCH
     --------------------------------------------- */

  $("searchInput")
    ?.addEventListener(
      "input",
      performSearch
    );


  /* ---------------------------------------------
     ENTER SEARCH
     --------------------------------------------- */

  $("searchInput")
    ?.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          performSearch();
        }
      }
    );


  /* ---------------------------------------------
     ADD CONTACT
     --------------------------------------------- */

  $("addContactBtn")
    ?.addEventListener(
      "click",
      async () => {

        const username =
          value("contactUsername");

        if (!username) {

          toast(
            "Masukkan username.",
            "error"
          );

          return;
        }

        await addContactByUsername(
          username
        );

        if ($("contactUsername")) {
          $("contactUsername").value = "";
        }
      }
    );


  /* ---------------------------------------------
     SEND MESSAGE
     --------------------------------------------- */

  $("sendMessageBtn")
    ?.addEventListener(
      "click",
      sendMessage
    );


  $("messageInput")
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendMessage();
        }
      }
    );


  /* ---------------------------------------------
     NAVIGATION
     --------------------------------------------- */

  document
    .querySelectorAll(
      "[data-section]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openSection(
            button.dataset.section
          );
        }
      );
    });


  /* ---------------------------------------------
     PROFILE
     --------------------------------------------- */

  $("profileBtn")
    ?.addEventListener(
      "click",
      openProfile
    );

  $("closeProfileBtn")
    ?.addEventListener(
      "click",
      closeProfile
    );

  $("saveProfileBtn")
    ?.addEventListener(
      "click",
      saveProfile
    );


  /* ---------------------------------------------
     STATUS
     --------------------------------------------- */

  $("createStatusBtn")
    ?.addEventListener(
      "click",
      createStatus
    );


  /* ---------------------------------------------
     GROUP
     --------------------------------------------- */

  $("createGroupBtn")
    ?.addEventListener(
      "click",
      createGroup
    );


  /* ---------------------------------------------
     CHANNEL
     --------------------------------------------- */

  $("createChannelBtn")
    ?.addEventListener(
      "click",
      createChannel
    );


  /* ---------------------------------------------
     VOICE CALL
     --------------------------------------------- */

  $("voiceCallBtn")
    ?.addEventListener(
      "click",
      () => startCall("voice")
    );


  /* ---------------------------------------------
     VIDEO CALL
     --------------------------------------------- */

  $("videoCallBtn")
    ?.addEventListener(
      "click",
      () => startCall("video")
    );


  /* ---------------------------------------------
     END CALL
     --------------------------------------------- */

  $("endCallBtn")
    ?.addEventListener(
      "click",
      endCall
    );


  /* ---------------------------------------------
     CLOSE MODALS
     --------------------------------------------- */

  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          closeModal(
            button.dataset.closeModal
          );
        }
      );
    });


  /* ---------------------------------------------
     ADD CONTACT ENTER
     --------------------------------------------- */

  $("contactUsername")
    ?.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {

          event.preventDefault();

          $("addContactBtn")
            ?.click();
        }
      }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

(async function init() {

  console.log(
    "Mentra Chat starting..."
  );

  bindEvents();

  await setupPersistence();

  switchAuthMode("login");

  console.log(
    "Mentra Chat ready."
  );

})();
