import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

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
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   STATE
========================================================= */

let me = null;
let activeChat = null;
let unsubscribeMessages = null;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   USERNAME
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
   STATUS
========================================================= */

function setStatus(message = "") {
  const element = $("auth-status");

  if (element) {
    element.textContent = message;
  }
}


/* =========================================================
   TOAST
========================================================= */

function toast(message = "") {
  const element = $("toast");

  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.__mentraToastTimer);

  window.__mentraToastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2500);
}


/* =========================================================
   SHOW AUTH
========================================================= */

function showAuth() {

  const authPage = $("auth");
  const chatApp = $("chat-app");

  if (authPage) {
    authPage.classList.remove("hidden");
  }

  if (chatApp) {
    chatApp.classList.add("hidden");
  }
}


/* =========================================================
   SHOW CHAT
========================================================= */

function showChat() {

  const authPage = $("auth");
  const chatApp = $("chat-app");

  /*
   * PENTING:
   * LOGIN BERHASIL = LANGSUNG BUKA CHAT.
   * Tidak menunggu Firestore.
   */

  if (authPage) {
    authPage.classList.add("hidden");
  }

  if (chatApp) {
    chatApp.classList.remove("hidden");
  }

  const emptyChat = $("empty-chat");
  const conversation = $("conversation");

  if (emptyChat) {
    emptyChat.classList.remove("hidden");
  }

  if (conversation) {
    conversation.classList.add("hidden");
  }

  $("status-view")?.classList.add("hidden");
  $("channels-view")?.classList.add("hidden");
  $("groups-view")?.classList.add("hidden");

  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.remove("active");
  });

  document
    .querySelector('.nav[data-view="chats"]')
    ?.classList.add("active");
}


/* =========================================================
   FIREBASE ERROR
========================================================= */

function firebaseError(error) {

  console.error("[FIREBASE ERROR]", error);

  const code = error?.code || "";

  const messages = {

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
      "Koneksi ke Firebase gagal.",

    "auth/user-disabled":
      "Akun ini dinonaktifkan.",

    "auth/operation-not-allowed":
      "Login Email/Password belum diaktifkan di Firebase.",

    "auth/invalid-email":
      "Format akun tidak valid.",

    "permission-denied":
      "Firebase Rules menolak akses.",

    "failed-precondition":
      "Firestore membutuhkan konfigurasi/index tambahan."

  };

  return (
    messages[code] ||
    error?.message ||
    "Terjadi kesalahan."
  );
}


/* =========================================================
   AUTH TABS
========================================================= */

document
  .querySelectorAll(".tab")
  .forEach((button) => {

    button.addEventListener("click", () => {

      document
        .querySelectorAll(".tab")
        .forEach((item) => {
          item.classList.remove("active");
        });

      button.classList.add("active");

      const mode = button.dataset.auth;

      $("login-form")?.classList.toggle(
        "hidden",
        mode !== "login"
      );

      $("register-form")?.classList.toggle(
        "hidden",
        mode !== "register"
      );

      setStatus("");
    });

  });


/* =========================================================
   REGISTER
========================================================= */

$("register-form")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const phone =
      $("reg-phone")?.value.trim() || "";

    const username =
      normalizeUsername(
        $("reg-username")?.value || ""
      );

    const password =
      $("reg-password")?.value || "";


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

      setStatus(
        "Password minimal 8 karakter."
      );

      return;
    }


    const button =
      $("create-account");

    if (button) {
      button.disabled = true;
    }


    setStatus(
      "Membuat akun..."
    );


    try {

      const response = await fetch(
        "/api/create-account",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            phone,
            username,
            password
          })
        }
      );


      const data =
        await response
          .json()
          .catch(() => ({}));


      if (!response.ok) {

        throw new Error(
          data.error ||
          `Gagal membuat akun (${response.status})`
        );

      }


      const email =
        data.email ||
        emailForUsername(username);


      setStatus(
        "Akun berhasil dibuat. Login..."
      );


      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


      /*
       * Langsung buka Chat.
       */

      showChat();

      setStatus("");

      toast(
        "Akun berhasil dibuat"
      );


    } catch (error) {

      console.error(
        "[REGISTER ERROR]",
        error
      );

      setStatus(
        error.message ||
        "Gagal membuat akun."
      );

    } finally {

      if (button) {
        button.disabled = false;
      }

    }

  }
);


/* =========================================================
   LOGIN
========================================================= */

$("login-form")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const username =
      normalizeUsername(
        $("login-username")?.value || ""
      );

    const password =
      $("login-password")?.value || "";


    if (!username) {

      setStatus(
        "Username wajib diisi."
      );

      $("login-username")?.focus();

      return;
    }


    if (!password) {

      setStatus(
        "Password wajib diisi."
      );

      $("login-password")?.focus();

      return;
    }


    const button =
      $("login-form")
        ?.querySelector(
          'button[type="submit"]'
        );


    if (button) {
      button.disabled = true;
    }


    setStatus(
      "Menghubungkan ke Firebase..."
    );


    try {

      const email =
        emailForUsername(username);


      console.log(
        "[LOGIN] mencoba:",
        email
      );


      /*
       * LOGIN FIREBASE
       */

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


      console.log(
        "[LOGIN] berhasil"
      );


      /*
       * JANGAN TUNGGU FIRESTORE.
       * LANGSUNG MASUK CHAT.
       */

      showChat();

      setStatus("");

      toast(
        "Login berhasil"
      );


    } catch (error) {

      console.error(
        "[LOGIN ERROR]",
        error
      );

      setStatus(
        firebaseError(error)
      );

    } finally {

      if (button) {
        button.disabled = false;
      }

    }

  }
);


/* =========================================================
   FIREBASE AUTH PERSISTENCE
========================================================= */

setPersistence(
  auth,
  browserLocalPersistence
)
.catch((error) => {

  console.warn(
    "[AUTH PERSISTENCE]",
    error
  );

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    console.log(
      "[AUTH STATE]",
      user
        ? user.uid
        : "SIGNED OUT"
    );


    /*
     * LOGOUT
     */

    if (!user) {

      me = null;
      activeChat = null;


      if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;

      }


      showAuth();

      return;
    }


    /*
     * USER LOGIN
     *
     * LANGSUNG BUKA CHAT.
     */

    showChat();


    /*
     * PROFILE DEFAULT
     */

    me = {

      uid: user.uid,

      username:
        normalizeUsername(
          user.email?.split("@")[0] ||
          "user"
        ),

      phone: "",

      bio: "",

      photoURL: "",

      status: "online"

    };


    /*
     * LOAD USER PROFILE
     *
     * Ini berjalan setelah Chat dibuka.
     */

    try {

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      const snapshot =
        await getDoc(userRef);


      if (snapshot.exists()) {

        me = {
          uid: user.uid,
          ...snapshot.data()
        };

      } else {

        /*
         * Kalau user document belum ada,
         * buat otomatis.
         */

        await setDoc(
          userRef,
          {
            uid: user.uid,

            username:
              me.username,

            phone: "",

            bio: "",

            photoURL: "",

            status: "online",

            lastSeen:
              serverTimestamp()

          },
          {
            merge: true
          }
        );

      }


      updateProfileUI();


    } catch (error) {

      /*
       * PENTING:
       * FIRESTORE ERROR TIDAK BOLEH
       * MEMBUAT USER LOGOUT.
       */

      console.warn(
        "[PROFILE LOAD ERROR]",
        error
      );

      updateProfileUI();

    }


    /*
     * ONLINE STATUS
     */

    try {

      await setDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          status: "online",

          lastSeen:
            serverTimestamp()

        },
        {
          merge: true
        }
      );

    } catch (error) {

      console.warn(
        "[ONLINE STATUS ERROR]",
        error
      );

    }

  }
);


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

  if (!me) return;


  const username =
    me.username || "user";


  const avatar =
    username
      .charAt(0)
      .toUpperCase();


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
      me.bio ||
      "Belum ada bio.";

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


      /*
       * Update offline kalau bisa.
       */

      if (auth.currentUser) {

        try {

          await setDoc(
            doc(
              db,
              "users",
              auth.currentUser.uid
            ),
            {
              status: "offline",
              lastSeen:
                serverTimestamp()
            },
            {
              merge: true
            }
          );

        } catch (_) {}

      }


      await signOut(auth);


      toast(
        "Berhasil keluar."
      );


    } catch (error) {

      console.error(
        "[LOGOUT ERROR]",
        error
      );

      toast(
        firebaseError(error)
      );

    }

  }
);


/* =========================================================
   PROFILE OPEN
========================================================= */

$("profile-btn")?.addEventListener(
  "click",
  () => {

    $("profile-panel")
      ?.classList.remove(
        "hidden"
      );

  }
);


/* =========================================================
   PROFILE CLOSE
========================================================= */

$("close-profile")?.addEventListener(
  "click",
  () => {

    $("profile-panel")
      ?.classList.add(
        "hidden"
      );

  }
);


/* =========================================================
   SAVE PROFILE
========================================================= */

$("save-profile")?.addEventListener(
  "click",
  async () => {

    if (!auth.currentUser) {

      toast(
        "Belum login."
      );

      return;
    }


    const bio =
      $("bio-input")
        ?.value
        .trim() || "";


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


      if (me) {
        me.bio = bio;
      }


      updateProfileUI();


      toast(
        "Profil disimpan."
      );


    } catch (error) {

      console.error(
        "[SAVE PROFILE ERROR]",
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

document
  .querySelectorAll(".nav")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".nav")
          .forEach((item) => {

            item.classList.remove(
              "active"
            );

          });


        button.classList.add(
          "active"
        );


        const view =
          button.dataset.view;


        /*
         * CHATS
         */

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


        /*
         * STATUS
         */

        $("status-view")
          ?.classList.toggle(
            "hidden",
            view !== "status"
          );


        /*
         * CHANNELS
         */

        $("channels-view")
          ?.classList.toggle(
            "hidden",
            view !== "channels"
          );


        /*
         * GROUPS
         */

        $("groups-view")
          ?.classList.toggle(
            "hidden",
            view !== "groups"
          );

      }
    );

  });


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

      toast(
        "Login terlebih dahulu."
      );

      return;
    }


    try {

      const usersQuery =
        query(
          collection(
            db,
            "users"
          ),

          where(
            "username",
            "==",
            username
          ),

          limit(1)
        );


      const snapshot =
        await getDocs(
          usersQuery
        );


      if (snapshot.empty) {

        toast(
          "Username tidak ditemukan."
        );

        return;
      }


      const user =
        snapshot.docs[0].data();


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
        "[SEARCH ERROR]",
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
    document.createElement(
      "div"
    );


  item.className =
    "conversation-item active";


  const avatar =
    document.createElement(
      "div"
    );


  avatar.className =
    "avatar";


  avatar.textContent =
    (
      user.username ||
      "?"
    )
      .charAt(0)
      .toUpperCase();


  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "meta";


  const name =
    document.createElement(
      "strong"
    );


  name.textContent =
    "@" +
    (
      user.username ||
      "user"
    );


  const bio =
    document.createElement(
      "small"
    );


  bio.textContent =
    user.bio ||
    "Mulai percakapan baru";


  meta.appendChild(
    name
  );

  meta.appendChild(
    bio
  );


  item.appendChild(
    avatar
  );

  item.appendChild(
    meta
  );


  item.addEventListener(
    "click",
    () => {

      openChat(user);

    }
  );


  list.appendChild(
    item
  );

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


  /*
   * UI
   */

  $("empty-chat")
    ?.classList.add(
      "hidden"
    );


  $("conversation")
    ?.classList.remove(
      "hidden"
    );


  $("status-view")
    ?.classList.add(
      "hidden"
    );


  $("channels-view")
    ?.classList.add(
      "hidden"
    );


  $("groups-view")
    ?.classList.add(
      "hidden"
    );


  document
    .querySelectorAll(".nav")
    .forEach((button) => {

      button.classList.remove(
        "active"
      );

    });


  document
    .querySelector(
      '.nav[data-view="chats"]'
    )
    ?.classList.add(
      "active"
    );


  /*
   * HEADER CHAT
   */

  if ($("chat-name")) {

    $("chat-name").textContent =
      "@" +
      (
        user.username ||
        "user"
      );

  }


  if ($("chat-avatar")) {

    $("chat-avatar").textContent =
      (
        user.username ||
        "?"
      )
        .charAt(0)
        .toUpperCase();

  }


  if ($("chat-presence")) {

    $("chat-presence").textContent =
      user.status === "online"
        ? "online"
        : "offline";

  }


  /*
   * HENTIKAN LISTENER CHAT LAMA
   */

  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  /*
   * FIRESTORE MESSAGE COLLECTION
   */

  const messagesRef =
    collection(
      db,
      "chats",
      chatId(
        me.uid,
        user.uid
      ),
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


  /*
   * REALTIME CHAT
   */

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
              document.createElement(
                "div"
              );


            wrapper.className =
              "message " +
              (
                message.senderId ===
                me.uid
                  ? "mine"
                  : ""
              );


            /*
             * TEXT
             */

            const text =
              document.createElement(
                "span"
              );


            text.textContent =
              message.text ||
              "";


            wrapper.appendChild(
              text
            );


            /*
             * TIME
             */

            if (
              message.createdAt &&
              typeof message.createdAt.toDate ===
                "function"
            ) {

              const time =
                document.createElement(
                  "time"
                );


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


              wrapper.appendChild(
                time
              );

            }


            box.appendChild(
              wrapper
            );

          }
        );


        /*
         * SCROLL KE BAWAH
         */

        box.scrollTop =
          box.scrollHeight;

      },


      (error) => {

        console.error(
          "[MESSAGE LISTENER ERROR]",
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

      toast(
        "Belum login."
      );

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
      input
        ?.value
        .trim() || "";


    if (!text) {
      return;
    }


    const button =
      $("message-form")
        ?.querySelector(
          'button[type="submit"]'
        );


    if (button) {
      button.disabled = true;
    }


    try {

      await addDoc(

        collection(
          db,
          "chats",
          chatId(
            me.uid,
            activeChat.uid
          ),
          "messages"
        ),

        {
          text,

          senderId:
            me.uid,

          receiverId:
            activeChat.uid,

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
        "[SEND MESSAGE ERROR]",
        error
      );

      toast(
        firebaseError(error)
      );

    } finally {

      if (button) {
        button.disabled = false;
      }

    }

  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

window.addEventListener(
  "error",
  (event) => {

    console.error(
      "[GLOBAL ERROR]",
      event.error ||
      event.message
    );

  }
);


window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "[UNHANDLED PROMISE]",
      event.reason
    );

  }
);


/* =========================================================
   START
========================================================= */

console.log(
  "%cMENTRA CHAT",
  "font-size:20px;font-weight:800"
);

console.log(
  "Firebase:",
  firebaseConfig.projectId
);

console.log(
  "Auth initialized."
);
