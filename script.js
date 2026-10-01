import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCABFYMEsfwOI5hvZALTqoFsameHqq5QXI",
  authDomain: "fire-chat-c043f.firebaseapp.com",
  projectId: "fire-chat-c043f",
  storageBucket: "fire-chat-c043f.firebasestorage.app",
  messagingSenderId: "666512765812",
  appId: "1:666512765812:web:9bce88a00a791e2851f221",
  measurementId: "G-LW21XL2YRK"
};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   GLOBAL STATE
========================================================= */

let me = null;
let activeChat = null;
let unsubscribeMessages = null;
let unsubscribeAuth = null;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   SAFE STATUS / TOAST
========================================================= */

function setStatus(message = "") {
  const el = $("auth-status");

  if (el) {
    el.textContent = message;
  }
}


function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}


/* =========================================================
   USERNAME / EMAIL
========================================================= */

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}


function emailForUsername(username) {
  return `${normalizeUsername(username)}@users.mentra.local`;
}


/* =========================================================
   FIREBASE ERROR TRANSLATION
========================================================= */

function firebaseError(error) {

  console.error("Firebase error:", error);

  const code = error?.code || "";

  const errors = {

    "auth/invalid-credential":
      "Username atau password salah.",

    "auth/invalid-login-credentials":
      "Username atau password salah.",

    "auth/user-not-found":
      "Username belum terdaftar.",

    "auth/wrong-password":
      "Password salah.",

    "auth/too-many-requests":
      "Terlalu banyak percobaan login. Coba lagi nanti.",

    "auth/network-request-failed":
      "Koneksi ke Firebase gagal. Periksa internet.",

    "auth/user-disabled":
      "Akun ini telah dinonaktifkan.",

    "auth/operation-not-allowed":
      "Login Email/Password belum diaktifkan di Firebase.",

    "auth/invalid-email":
      "Format akun tidak valid.",

    "permission-denied":
      "Akses Firestore ditolak oleh Firebase Rules."

  };

  return errors[code] || error?.message || "Terjadi kesalahan Firebase.";
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(button, loading, loadingText) {

  if (!button) return;

  if (loading) {

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    button.disabled = true;

    if (loadingText) {
      button.innerHTML = loadingText;
    }

  } else {

    button.disabled = false;

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}


/* =========================================================
   AUTH TAB
========================================================= */

document.querySelectorAll(".tab").forEach((button) => {

  button.addEventListener("click", () => {

    document
      .querySelectorAll(".tab")
      .forEach((item) => item.classList.remove("active"));

    button.classList.add("active");

    const isLogin = button.dataset.auth === "login";

    $("login-form")?.classList.toggle("hidden", !isLogin);
    $("register-form")?.classList.toggle("hidden", isLogin);

    setStatus("");
  });

});


/* =========================================================
   REGISTER
========================================================= */

$("register-form")?.addEventListener("submit", async (event) => {

  event.preventDefault();

  const phone = $("reg-phone")?.value.trim() || "";
  const username = normalizeUsername(
    $("reg-username")?.value || ""
  );
  const password = $("reg-password")?.value || "";

  if (!phone) {
    setStatus("Nomor HP wajib diisi.");
    return;
  }

  if (!username) {
    setStatus("Username wajib diisi.");
    return;
  }

  if (!/^[a-z0-9._]{3,24}$/.test(username)) {
    setStatus(
      "Username 3-24 karakter. Gunakan huruf, angka, titik, atau underscore."
    );
    return;
  }

  if (password.length < 8) {
    setStatus("Password minimal 8 karakter.");
    return;
  }

  const button = $("create-account");

  setButtonLoading(
    button,
    true,
    "Membuat akun..."
  );

  setStatus("Membuat akun...");

  try {

    const response = await fetch("/api/create-account", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        phone,
        username,
        password
      })
    });


    const data = await response
      .json()
      .catch(() => ({}));


    if (!response.ok) {

      throw new Error(
        data.error ||
        `Server error (${response.status})`
      );
    }


    if (!data.email) {
      throw new Error(
        "Server berhasil membuat akun tetapi email login tidak diterima."
      );
    }


    setStatus("Akun berhasil dibuat. Masuk ke akun...");


    await signInWithEmailAndPassword(
      auth,
      data.email,
      password
    );


    toast("Akun berhasil dibuat");


  } catch (error) {

    console.error("REGISTER ERROR:", error);

    setStatus(
      error.message ||
      "Gagal membuat akun."
    );

  } finally {

    setButtonLoading(
      button,
      false
    );
  }

});


/* =========================================================
   LOGIN
========================================================= */

$("login-form")?.addEventListener("submit", async (event) => {

  event.preventDefault();

  const username = normalizeUsername(
    $("login-username")?.value || ""
  );

  const password =
    $("login-password")?.value || "";


  if (!username) {

    setStatus("Username wajib diisi.");

    $("login-username")?.focus();

    return;
  }


  if (!password) {

    setStatus("Password wajib diisi.");

    $("login-password")?.focus();

    return;
  }


  const button =
    $("login-form")?.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    button,
    true,
    "Memeriksa akun..."
  );


  setStatus(
    "Menghubungkan ke Firebase..."
  );


  try {

    const email =
      emailForUsername(username);


    console.log(
      "Login Firebase:",
      email
    );


    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


    console.log(
      "Login berhasil:",
      credential.user.uid
    );


    setStatus(
      "Login berhasil. Membuka Mentra..."
    );


    toast("Login berhasil");


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    setStatus(
      firebaseError(error)
    );


  } finally {

    setButtonLoading(
      button,
      false
    );

  }

});


/* =========================================================
   AUTH PERSISTENCE
========================================================= */

async function setupAuthPersistence() {

  try {

    await setPersistence(
      auth,
      browserLocalPersistence
    );

  } catch (error) {

    console.error(
      "Auth persistence error:",
      error
    );

  }

}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async (user) => {

  try {

    if (!user) {

      me = null;
      activeChat = null;

      $("auth")?.classList.remove("hidden");
      $("chat-app")?.classList.add("hidden");

      return;
    }


    console.log(
      "Firebase user:",
      user.uid
    );


    const userRef =
      doc(db, "users", user.uid);


    const snapshot =
      await getDoc(userRef);


    if (!snapshot.exists()) {

      console.error(
        "User Firestore tidak ditemukan:",
        user.uid
      );


      setStatus(
        "Data akun tidak ditemukan di database."
      );


      await signOut(auth);

      return;
    }


    me = {
      uid: user.uid,
      ...snapshot.data()
    };


    $("auth")?.classList.add("hidden");
    $("chat-app")?.classList.remove("hidden");


    updateProfileUI();


  } catch (error) {

    console.error(
      "AUTH STATE ERROR:",
      error
    );

    $("auth")?.classList.remove("hidden");
    $("chat-app")?.classList.add("hidden");

    setStatus(
      firebaseError(error)
    );

  }

});


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

  if (!me) return;

  const username =
    me.username || "user";

  const avatar =
    username.charAt(0).toUpperCase();


  if ($("me-label")) {
    $("me-label").textContent =
      "@" + username;
  }


  if ($("profile-name")) {
    $("profile-name").textContent =
      "@" + username;
  }


  if ($("profile-avatar")) {
    $("profile-avatar").textContent =
      avatar;
  }


  if ($("profile-bio")) {
    $("profile-bio").textContent =
      me.bio || "Belum ada bio.";
  }


  if ($("bio-input")) {
    $("bio-input").value =
      me.bio || "";
  }

}


/* =========================================================
   LOGOUT
========================================================= */

$("logout")?.addEventListener(
  "click",
  async () => {

    try {

      if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
      }

      activeChat = null;

      await signOut(auth);

      toast("Berhasil keluar.");

    } catch (error) {

      console.error(
        "LOGOUT ERROR:",
        error
      );

      toast(
        firebaseError(error)
      );

    }

  }
);


/* =========================================================
   PROFILE
========================================================= */

$("profile-btn")?.addEventListener(
  "click",
  () => {

    $("profile-panel")
      ?.classList.remove("hidden");

  }
);


$("close-profile")?.addEventListener(
  "click",
  () => {

    $("profile-panel")
      ?.classList.add("hidden");

  }
);


$("save-profile")?.addEventListener(
  "click",
  async () => {

    if (!auth.currentUser || !me) {
      toast("Belum login.");
      return;
    }


    const bio =
      $("bio-input")?.value.trim() || "";


    try {

      await setDoc(
        doc(
          db,
          "users",
          auth.currentUser.uid
        ),
        {
          bio
        },
        {
          merge: true
        }
      );


      me.bio = bio;

      updateProfileUI();

      toast("Profil disimpan.");


    } catch (error) {

      console.error(
        "PROFILE ERROR:",
        error
      );

      toast(
        firebaseError(error)
      );

    }

  }
);


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".nav")
          .forEach(
            (item) =>
              item.classList.remove("active")
          );


        button.classList.add("active");


        const view =
          button.dataset.view;


        $("conversation")
          ?.classList.toggle(
            "hidden",
            view !== "chats" ||
            !activeChat
          );


        $("empty-chat")
          ?.classList.toggle(
            "hidden",
            view !== "chats" ||
            !!activeChat
          );


        $("status-view")
          ?.classList.toggle(
            "hidden",
            view !== "status"
          );


        $("channels-view")
          ?.classList.toggle(
            "hidden",
            view !== "channels"
          );


        $("groups-view")
          ?.classList.toggle(
            "hidden",
            view !== "groups"
          );

      }
    );

  }
);


/* =========================================================
   SEARCH USER
========================================================= */

$("user-search")?.addEventListener(
  "keydown",
  async (event) => {

    if (event.key !== "Enter") {
      return;
    }


    event.preventDefault();


    const username =
      normalizeUsername(
        event.target.value
      );


    if (!username) {
      return;
    }


    if (!auth.currentUser || !me) {
      toast("Login terlebih dahulu.");
      return;
    }


    try {

      const usersQuery =
        query(
          collection(db, "users"),
          where(
            "username",
            "==",
            username
          ),
          limit(1)
        );


      const snapshot =
        await getDocs(usersQuery);


      if (snapshot.empty) {

        toast(
          "Username tidak ditemukan."
        );

        return;
      }


      const userDoc =
        snapshot.docs[0];


      const user =
        userDoc.data();


      if (
        user.uid ===
        auth.currentUser.uid
      ) {

        toast(
          "Itu akun kamu sendiri."
        );

        return;
      }


      renderSearchResult(user);


    } catch (error) {

      console.error(
        "SEARCH ERROR:",
        error
      );


      toast(
        firebaseError(error)
      );

    }

  }
);


/* =========================================================
   SEARCH RESULT
========================================================= */

function renderSearchResult(user) {

  const list =
    $("conversation-list");


  if (!list) return;


  list.innerHTML = "";


  const item =
    document.createElement("div");


  item.className =
    "conversation-item active";


  const avatar =
    document.createElement("div");

  avatar.className =
    "avatar";

  avatar.textContent =
    (user.username || "?")
      .charAt(0)
      .toUpperCase();


  const meta =
    document.createElement("div");

  meta.className =
    "meta";


  const name =
    document.createElement("strong");

  name.textContent =
    "@" + (user.username || "user");


  const bio =
    document.createElement("small");

  bio.textContent =
    user.bio ||
    "Mulai percakapan baru";


  meta.appendChild(name);
  meta.appendChild(bio);


  item.appendChild(avatar);
  item.appendChild(meta);


  item.addEventListener(
    "click",
    () => openChat(user)
  );


  list.appendChild(item);

}


/* =========================================================
   CHAT ID
========================================================= */

function chatId(a, b) {

  return [
    String(a),
    String(b)
  ]
    .sort()
    .join("_");

}


/* =========================================================
   OPEN CHAT
========================================================= */

function openChat(user) {

  if (!me || !user) {
    return;
  }


  activeChat = user;


  $("empty-chat")
    ?.classList.add("hidden");


  $("conversation")
    ?.classList.remove("hidden");


  $("chat-name").textContent =
    "@" + (user.username || "user");


  $("chat-avatar").textContent =
    (user.username || "?")
      .charAt(0)
      .toUpperCase();


  if ($("chat-presence")) {
    $("chat-presence").textContent =
      user.status === "online"
        ? "online"
        : "offline";
  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  const messagesRef =
    collection(
      db,
      "chats",
      chatId(me.uid, user.uid),
      "messages"
    );


  const messagesQuery =
    query(
      messagesRef,
      orderBy(
        "createdAt",
        "asc"
      )
    );


  unsubscribeMessages =
    onSnapshot(
      messagesQuery,

      (snapshot) => {

        const box =
          $("messages");


        if (!box) return;


        box.innerHTML = "";


        snapshot.forEach(
          (messageDoc) => {

            const message =
              messageDoc.data();


            const wrapper =
              document.createElement("div");


            wrapper.className =
              "message " +
              (
                message.senderId === me.uid
                  ? "mine"
                  : ""
              );


            const text =
              document.createElement("span");


            text.textContent =
              message.text || "";


            wrapper.appendChild(text);


            if (
              message.createdAt &&
              typeof message.createdAt.toDate ===
                "function"
            ) {

              const time =
                document.createElement("time");


              time.textContent =
                message.createdAt
                  .toDate()
                  .toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit"
                    }
                  );


              wrapper.appendChild(time);

            }


            box.appendChild(wrapper);

          }
        );


        box.scrollTop =
          box.scrollHeight;

      },

      (error) => {

        console.error(
          "MESSAGE LISTENER ERROR:",
          error
        );


        toast(
          firebaseError(error)
        );

      }
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

$("message-form")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    if (!auth.currentUser || !me) {

      toast("Belum login.");

      return;
    }


    if (!activeChat) {

      toast(
        "Pilih teman terlebih dahulu."
      );

      return;
    }


    const input =
      $("message-input");


    const text =
      input?.value.trim() || "";


    if (!text) {
      return;
    }


    const sendButton =
      $("message-form")
        ?.querySelector(
          'button[type="submit"]'
        );


    if (sendButton) {
      sendButton.disabled = true;
    }


    try {

      const messagesRef =
        collection(
          db,
          "chats",
          chatId(
            me.uid,
            activeChat.uid
          ),
          "messages"
        );


      await addDoc(
        messagesRef,
        {
          text,
          senderId: me.uid,
          receiverId: activeChat.uid,
          createdAt:
            serverTimestamp()
        }
      );


      if (input) {
        input.value = "";
        input.focus();
      }


    } catch (error) {

      console.error(
        "SEND MESSAGE ERROR:",
        error
      );


      toast(
        firebaseError(error)
      );


    } finally {

      if (sendButton) {
        sendButton.disabled = false;
      }

    }

  }
);


/* =========================================================
   GLOBAL ERROR HANDLERS
========================================================= */

window.addEventListener(
  "error",
  (event) => {

    console.error(
      "GLOBAL JS ERROR:",
      event.error || event.message
    );

  }
);


window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "UNHANDLED PROMISE:",
      event.reason
    );

  }
);


/* =========================================================
   START
========================================================= */

setupAuthPersistence();

console.log(
  "%cMentra Chat",
  "font-size:20px;font-weight:bold"
);

console.log(
  "Firebase:",
  FIREBASE_CONFIG.projectId
);
