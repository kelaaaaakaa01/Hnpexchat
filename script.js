import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const FIREBASE_CONFIG = {

  apiKey: "AIzaSyCABFYMEsfwOI5hvZALTqoFsameHqq5QXI",

  authDomain:
    "fire-chat-c043f.firebaseapp.com",

  projectId:
    "fire-chat-c043f",

  storageBucket:
    "fire-chat-c043f.firebasestorage.app",

  messagingSenderId:
    "666512765812",

  appId:
    "1:666512765812:web:9bce88a00a791e2851f221",

  measurementId:
    "G-LW21XL2YRK"
};


const app = initializeApp(FIREBASE_CONFIG);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   GLOBAL STATE
========================================================= */

let me = null;

let activeChat = null;

let unsubscribeMessages = null;

let searchTimer = null;

let localStream = null;

let registrationInProgress = false;


/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);


function toast(message){

  const el = $("toast");

  el.textContent = message;

  el.classList.add("show");

  clearTimeout(el._timer);

  el._timer = setTimeout(() => {

    el.classList.remove("show");

  }, 2600);
}


function setStatus(message){

  $("auth-status").textContent = message;

}


function normalizeUsername(value){

  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);

}


function emailForUsername(username){

  return `${normalizeUsername(username)}@users.mentra.chat`;

}


function initials(username){

  return (username || "M")
    .replace(/^@/, "")
    .slice(0, 1)
    .toUpperCase();

}


function chatId(a, b){

  return [a, b]
    .sort()
    .join("_");

}


function escapeHtml(value = ""){

  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char])
  );

}


/* =========================================================
   AUTH PERSISTENCE
========================================================= */

/*
  Browser session only.

  Tidak memakai local persistence.

  Jadi ketika session browser berakhir,
  user harus login lagi.
*/

await setPersistence(
  auth,
  browserSessionPersistence
);


/* =========================================================
   AUTH TABS
========================================================= */

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.addEventListener("click", () => {

      document
        .querySelectorAll(".tab")
        .forEach(item =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      $("login-form")
        .classList.toggle(
          "hidden",
          button.dataset.auth !== "login"
        );

      $("register-form")
        .classList.toggle(
          "hidden",
          button.dataset.auth !== "register"
        );

      setStatus("");

    });

  });


/* =========================================================
   REGISTER
   NO OTP
========================================================= */

$("register-form")
  .addEventListener("submit", async event => {

    event.preventDefault();

    const phone =
      $("reg-phone").value.trim();

    const username =
      normalizeUsername(
        $("reg-username").value
      );

    const password =
      $("reg-password").value;


    if(phone.length < 6){

      return setStatus(
        "Nomor HP belum valid."
      );

    }


    if(username.length < 3){

      return setStatus(
        "Username minimal 3 karakter."
      );

    }


    if(password.length < 8){

      return setStatus(
        "Password minimal 8 karakter."
      );

    }


    $("register-btn").disabled = true;

    registrationInProgress = true;


    try{

      /*
        Cek username dulu.
      */

      const existing =
        await getDocs(
          query(
            collection(db, "users"),
            where(
              "usernameLower",
              "==",
              username
            ),
            limit(1)
          )
        );


      if(!existing.empty){

        throw new Error(
          "Username sudah dipakai. Pilih username lain."
        );

      }


      /*
        Firebase Auth menggunakan email internal
        yang tidak ditampilkan kepada user.
      */

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          emailForUsername(username),
          password
        );


      /*
        Simpan profile.
        Password TIDAK disimpan di Firestore.
      */

      await setDoc(
        doc(
          db,
          "users",
          credential.user.uid
        ),
        {

          uid:
            credential.user.uid,

          username:
            username,

          usernameLower:
            username,

          phone:
            phone,

          bio:
            "",

          photoURL:
            "",

          contacts:
            [],

          groups:
            [],

          channels:
            [],

          createdAt:
            serverTimestamp()

        }
      );


      registrationInProgress = false;

      toast(
        "Akun berhasil dibuat"
      );


      /*
        User sudah otomatis login
        setelah createUserWithEmailAndPassword.
      */

    }catch(error){

      console.error(error);

      registrationInProgress = false;

      if(
        error.code ===
        "auth/email-already-in-use"
      ){

        setStatus(
          "Username sudah dipakai."
        );

      }else{

        setStatus(
          error.message ||
          "Gagal membuat akun."
        );

      }

    }finally{

      $("register-btn").disabled = false;

    }

  });


/* =========================================================
   LOGIN
========================================================= */

$("login-form")
  .addEventListener("submit", async event => {

    event.preventDefault();


    const username =
      normalizeUsername(
        $("login-username").value
      );

    const password =
      $("login-password").value;


    if(!username || !password){

      return setStatus(
        "Username dan password wajib diisi."
      );

    }


    try{

      await signInWithEmailAndPassword(
        auth,
        emailForUsername(username),
        password
      );

    }catch(error){

      console.error(error);

      setStatus(
        "Username atau password salah."
      );

    }

  });


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    /*
      Ketika register sedang menulis
      dokumen profile, jangan logout
      karena dokumen belum selesai dibuat.
    */

    if(
      user &&
      registrationInProgress
    ){

      return;

    }


    if(!user){

      me = null;

      activeChat = null;


      if(unsubscribeMessages){

        unsubscribeMessages();

        unsubscribeMessages = null;

      }


      $("auth")
        .classList.remove("hidden");

      $("chat-app")
        .classList.add("hidden");

      return;

    }


    try{

      const profile =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if(!profile.exists()){

        /*
          Tunggu sebentar jika profile
          baru saja dibuat.
        */

        await new Promise(
          resolve =>
            setTimeout(resolve, 500)
        );

        const retry =
          await getDoc(
            doc(
              db,
              "users",
              user.uid
            )
          );

        if(!retry.exists()){

          await signOut(auth);

          return;

        }

        me = {
          uid: user.uid,
          ...retry.data()
        };

      }else{

        me = {
          uid: user.uid,
          ...profile.data()
        };

      }


      $("auth")
        .classList.add("hidden");

      $("chat-app")
        .classList.remove("hidden");

      $("chat-app")
        .classList.remove("mobile-list");


      updateProfileUI();

      await loadContacts();

      renderView("chats");


    }catch(error){

      console.error(error);

      toast(
        "Gagal memuat akun."
      );

    }

  }
);


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI(){

  const username =
    me?.username || "username";


  $("me-label").textContent =
    "@" + username;


  $("profile-name").textContent =
    "@" + username;


  $("profile-username-stat").textContent =
    "@" + username;


  $("profile-avatar").textContent =
    initials(username);


  $("profile-bio").textContent =
    me?.bio ||
    "Belum ada bio.";


  $("bio-input").value =
    me?.bio || "";


  $("profile-contact-stat").textContent =
    String(
      (me?.contacts || []).length
    );

}


/* =========================================================
   LOAD CONTACTS
========================================================= */

async function loadContacts(){

  const ids =
    me?.contacts || [];


  const box =
    $("conversation-list");


  box.innerHTML = "";


  if(!ids.length){

    box.innerHTML = `
      <div style="
        padding:20px;
        color:#697486;
        font-size:12px;
        text-align:center
      ">
        Belum ada chat.<br>
        Cari username di atas untuk mulai.
      </div>
    `;

    $("chat-count").textContent = "";

    return;

  }


  const users = [];


  for(
    const uid of ids
  ){

    try{

      const snap =
        await getDoc(
          doc(
            db,
            "users",
            uid
          )
        );


      if(snap.exists()){

        users.push({
          uid: snap.id,
          ...snap.data()
        });

      }

    }catch(error){

      console.error(error);

    }

  }


  renderContactList(users);

}


function renderContactList(users){

  const box =
    $("conversation-list");


  box.innerHTML = "";


  $("chat-count").textContent =
    users.length
      ? ` · ${users.length}`
      : "";


  users.forEach(user => {

    const item =
      document.createElement("div");


    item.className =
      "conversation-item";


    item.dataset.uid =
      user.uid;


    item.innerHTML = `

      <div class="avatar">
        ${escapeHtml(
          initials(user.username)
        )}
      </div>

      <div class="meta">

        <strong>
          @${escapeHtml(
            user.username
          )}
        </strong>

        <small>
          ${escapeHtml(
            user.bio ||
            "Mulai percakapan"
          )}
        </small>

      </div>

    `;


    item.addEventListener(
      "click",
      () => openChat(user)
    );


    box.appendChild(item);

  });

}


/* =========================================================
   SEARCH USERNAME
========================================================= */

$("user-search")
  .addEventListener(
    "input",
    event => {

      clearTimeout(searchTimer);


      const username =
        normalizeUsername(
          event.target.value
        );


      if(!username){

        $("search-result")
          .classList.add("hidden");

        return;

      }


      searchTimer =
        setTimeout(
          () =>
            searchUsername(
              username
            ),
          300
        );

    }
  );


$("user-search")
  .addEventListener(
    "keydown",
    event => {

      if(
        event.key ===
        "Escape"
      ){

        event.target.value = "";

        $("search-result")
          .classList.add(
            "hidden"
          );

      }

    }
  );


async function searchUsername(
  username
){

  try{

    const snap =
      await getDocs(
        query(
          collection(
            db,
            "users"
          ),
          where(
            "usernameLower",
            "==",
            username
          ),
          limit(5)
        )
      );


    const box =
      $("search-result");


    box.classList.remove(
      "hidden"
    );


    box.innerHTML = "";


    if(snap.empty){

      box.innerHTML = `
        <div style="
          padding:10px;
          color:#8c96a8;
          font-size:12px
        ">
          Username tidak ditemukan.
        </div>
      `;

      return;

    }


    snap.forEach(snapshot => {

      const user = {
        uid: snapshot.id,
        ...snapshot.data()
      };


      if(
        user.uid ===
        me.uid
      ){

        box.innerHTML = `
          <div style="
            padding:10px;
            color:#8c96a8;
            font-size:12px
          ">
            Itu akun lu sendiri.
          </div>
        `;

        return;

      }


      const row =
        document.createElement(
          "div"
        );


      row.className =
        "conversation-item";


      row.innerHTML = `

        <div class="avatar">
          ${escapeHtml(
            initials(
              user.username
            )
          )}
        </div>

        <div class="meta">

          <strong>
            @${escapeHtml(
              user.username
            )}
          </strong>

          <small>
            ${escapeHtml(
              user.bio ||
              "Tambah sebagai kontak"
            )}
          </small>

        </div>

        <button class="tool-btn">
          Chat
        </button>

      `;


      row
        .querySelector("button")
        .addEventListener(
          "click",
          async event => {

            event.stopPropagation();

            await addContact(user);

          }
        );


      row.addEventListener(
        "click",
        () => openChat(user)
      );


      box.appendChild(row);

    });


  }catch(error){

    console.error(error);

    toast(
      "Pencarian gagal. Cek Firestore Rules."
    );

  }

}


/* =========================================================
   ADD CONTACT
========================================================= */

async function addContact(user){

  const contacts =
    me.contacts || [];


  if(
    !contacts.includes(
      user.uid
    )
  ){

    await updateDoc(
      doc(
        db,
        "users",
        me.uid
      ),
      {
        contacts:
          arrayUnion(
            user.uid
          )
      }
    );


    me.contacts = [
      ...contacts,
      user.uid
    ];


    updateProfileUI();

    await loadContacts();

  }


  $("search-result")
    .classList.add(
      "hidden"
    );


  $("user-search").value = "";


  await openChat(user);


  toast(
    "Kontak ditambahkan"
  );

}


/* =========================================================
   NAVIGATION
========================================================= */

function renderView(view){

  document
    .querySelectorAll(".nav")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.view === view
      );

    });


  $("home-view")
    .classList.toggle(
      "hidden",
      view !== "chats" ||
      !!activeChat
    );


  $("conversation")
    .classList.toggle(
      "hidden",
      view !== "chats" ||
      !activeChat
    );


  $("status-view")
    .classList.toggle(
      "hidden",
      view !== "status"
    );


  $("channels-view")
    .classList.toggle(
      "hidden",
      view !== "channels"
    );


  $("groups-view")
    .classList.toggle(
      "hidden",
      view !== "groups"
    );


  if(view === "status")
    loadStatuses();


  if(view === "groups")
    loadGroups();


  if(view === "channels")
    loadChannels();

}


document
  .querySelectorAll(".nav")
  .forEach(button => {

    button.addEventListener(
      "click",
      () =>
        renderView(
          button.dataset.view
        )
    );

  });


/* =========================================================
   OPEN CHAT
========================================================= */

async function openChat(user){

  activeChat =
    user;


  $("chat-app")
    .classList.remove(
      "mobile-list"
    );


  $("chat-name")
    .textContent =
    "@" + user.username;


  $("chat-avatar")
    .textContent =
    initials(
      user.username
    );


  $("chat-presence")
    .textContent =
    "Mentra user";


  document
    .querySelectorAll(
      ".conversation-item"
    )
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.uid ===
        user.uid
      );

    });


  renderView("chats");


  if(unsubscribeMessages){

    unsubscribeMessages();

  }


  const id =
    chatId(
      me.uid,
      user.uid
    );


  const messagesQuery =
    query(
      collection(
        db,
        "chats",
        id,
        "messages"
      ),
      orderBy(
        "createdAt",
        "asc"
      )
    );


  unsubscribeMessages =
    onSnapshot(
      messagesQuery,
      snapshot => {

        const box =
          $("messages");


        box.innerHTML = "";


        snapshot.forEach(
          messageDoc => {

            const message =
              messageDoc.data();


            const messageElement =
              document.createElement(
                "div"
              );


            messageElement.className =
              "message " +
              (
                message.senderId ===
                me.uid
                  ? "mine"
                  : ""
              );


            const time =
              message.createdAt?.toDate
                ? message.createdAt
                    .toDate()
                    .toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit"
                      }
                    )
                : "";


            messageElement.innerHTML = `

              ${escapeHtml(
                message.text
              )}

              <time>
                ${time}
              </time>

            `;


            box.appendChild(
              messageElement
            );

          }
        );


        box.scrollTop =
          box.scrollHeight;

      },

      error => {

        console.error(error);

        toast(
          "Chat belum diizinkan oleh Firestore Rules."
        );

      }
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

$("message-form")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const text =
        $("message-input")
          .value
          .trim();


      if(
        !text ||
        !activeChat
      ){

        return;

      }


      try{

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

            senderUsername:
              me.username,

            createdAt:
              serverTimestamp()

          }
        );


        $("message-input")
          .value = "";


        if(
          !(
            me.contacts ||
            []
          ).includes(
            activeChat.uid
          )
        ){

          await addContact(
            activeChat
          );

        }


      }catch(error){

        console.error(error);

        toast(
          "Pesan gagal dikirim. Cek Firestore Rules."
        );

      }

    }
  );


/* =========================================================
   MOBILE BACK
========================================================= */

$("mobile-back")
  .addEventListener(
    "click",
    () => {

      activeChat = null;

      $("chat-app")
        .classList.add(
          "mobile-list"
        );

      renderView(
        "chats"
      );

    }
  );


/* =========================================================
   PROFILE
========================================================= */

$("profile-btn")
  .addEventListener(
    "click",
    () => {

      $("profile-panel")
        .classList.remove(
          "hidden"
        );

    }
  );


$("close-profile")
  .addEventListener(
    "click",
    () => {

      $("profile-panel")
        .classList.add(
          "hidden"
        );

    }
  );


$("save-profile")
  .addEventListener(
    "click",
    async () => {

      const bio =
        $("bio-input")
          .value
          .trim();


      try{

        await updateDoc(
          doc(
            db,
            "users",
            me.uid
          ),
          {
            bio
          }
        );


        me.bio =
          bio;


        updateProfileUI();

        toast(
          "Profil disimpan"
        );


      }catch(error){

        console.error(error);

        toast(
          "Profil gagal disimpan."
        );

      }

    }
  );


/* =========================================================
   LOGOUT
========================================================= */

$("logout")
  .addEventListener(
    "click",
    async () => {

      await signOut(
        auth
      );

      toast(
        "Sesi ditutup"
      );

    }
  );


/* =========================================================
   MODAL
========================================================= */

function openModal(
  title,
  html
){

  $("modal-title")
    .textContent =
    title;

  $("modal-body")
    .innerHTML =
    html;

  $("modal")
    .classList.remove(
      "hidden"
    );

}


function closeModal(){

  $("modal")
    .classList.add(
      "hidden"
    );

  $("modal-body")
    .innerHTML = "";

}


$("modal-close")
  .addEventListener(
    "click",
    closeModal
  );


$("modal")
  .addEventListener(
    "click",
    event => {

      if(
        event.target ===
        $("modal")
      ){

        closeModal();

      }

    }
  );


/* =========================================================
   ADD CONTACT MODAL
========================================================= */

function showAddContact(){

  openModal(
    "Tambah kontak",

    `
      <form
        id="add-contact-form"
        class="modal-form"
      >

        <label>

          Username teman

          <input
            id="contact-username"
            placeholder="@username"
            autocomplete="off"
            required
          >

        </label>

        <button
          class="primary"
          type="submit"
        >
          Cari & buka chat
        </button>

        <div
          id="contact-result"
          class="status"
        ></div>

      </form>
    `
  );


  $("add-contact-form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const username =
          normalizeUsername(
            $("contact-username")
              .value
          );


        if(!username)
          return;


        const result =
          $("contact-result");


        try{

          const snapshot =
            await getDocs(
              query(
                collection(
                  db,
                  "users"
                ),
                where(
                  "usernameLower",
                  "==",
                  username
                ),
                limit(1)
              )
            );


          if(snapshot.empty){

            result.textContent =
              "Username tidak ditemukan.";

            return;

          }


          const user = {
            uid:
              snapshot.docs[0].id,

            ...snapshot.docs[0].data()

          };


          if(
            user.uid ===
            me.uid
          ){

            result.textContent =
              "Itu akun lu sendiri.";

            return;

          }


          await addContact(
            user
          );


          closeModal();


        }catch(error){

          console.error(error);

          result.textContent =
            "Gagal mencari username.";

        }

      }
    );

}


/* =========================================================
   GROUP
========================================================= */

async function createGroup(){

  openModal(
    "Buat grup",

    `
      <form
        id="group-form"
        class="modal-form"
      >

        <label>

          Nama grup

          <input
            id="group-name"
            maxlength="50"
            required
            placeholder="Nama squad"
          >

        </label>


        <label>

          Deskripsi

          <textarea
            id="group-desc"
            maxlength="160"
            placeholder="Tentang grup"
          ></textarea>

        </label>


        <button
          class="primary"
          type="submit"
        >
          Buat grup
        </button>

      </form>
    `
  );


  $("group-form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try{

          const reference =
            await addDoc(
              collection(
                db,
                "groups"
              ),
              {

                name:
                  $("group-name")
                    .value
                    .trim(),

                description:
                  $("group-desc")
                    .value
                    .trim(),

                ownerId:
                  me.uid,

                members:
                  [me.uid],

                createdAt:
                  serverTimestamp()

              }
            );


          await updateDoc(
            doc(
              db,
              "users",
              me.uid
            ),
            {
              groups:
                arrayUnion(
                  reference.id
                )
            }
          );


          if(!me.groups)
            me.groups = [];


          me.groups.push(
            reference.id
          );


          closeModal();

          toast(
            "Grup dibuat"
          );


          loadGroups();


        }catch(error){

          console.error(error);

          toast(
            "Grup gagal dibuat. Cek Firestore Rules."
          );

        }

      }
    );

}


async function loadGroups(){

  const box =
    $("group-list");


  box.innerHTML = "";


  const ids =
    me?.groups || [];


  if(!ids.length){

    box.innerHTML = `
      <div class="placeholder-card">
        Belum ada grup.
        Tekan “Buat grup”
        untuk membuat yang pertama.
      </div>
    `;

    return;

  }


  for(
    const id of ids
  ){

    const snapshot =
      await getDoc(
        doc(
          db,
          "groups",
          id
        )
      );


    if(!snapshot.exists())
      continue;


    const group =
      snapshot.data();


    const row =
      document.createElement(
        "div"
      );


    row.className =
      "feature-row";


    row.innerHTML = `

      <div class="avatar">
        G
      </div>

      <div class="grow">

        <b>
          ${escapeHtml(
            group.name
          )}
        </b>

        <small>
          ${escapeHtml(
            group.description ||
            "Grup Mentra"
          )}
        </small>

      </div>

      <span>
        ${
          group.members?.length ||
          1
        }
        anggota
      </span>

    `;


    box.appendChild(
      row
    );

  }

}


/* =========================================================
   CHANNEL
========================================================= */

async function createChannel(){

  openModal(
    "Buat saluran",

    `
      <form
        id="channel-form"
        class="modal-form"
      >

        <label>

          Nama saluran

          <input
            id="channel-name"
            maxlength="50"
            required
            placeholder="Nama channel"
          >

        </label>


        <label>

          Deskripsi

          <textarea
            id="channel-desc"
            maxlength="160"
            placeholder="Deskripsi saluran"
          ></textarea>

        </label>


        <button
          class="primary"
          type="submit"
        >
          Buat saluran
        </button>

      </form>
    `
  );


  $("channel-form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try{

          const reference =
            await addDoc(
              collection(
                db,
                "channels"
              ),
              {

                name:
                  $("channel-name")
                    .value
                    .trim(),

                description:
                  $("channel-desc")
                    .value
                    .trim(),

                ownerId:
                  me.uid,

                subscribers:
                  [me.uid],

                createdAt:
                  serverTimestamp()

              }
            );


          await updateDoc(
            doc(
              db,
              "users",
              me.uid
            ),
            {
              channels:
                arrayUnion(
                  reference.id
                )
            }
          );


          if(!me.channels)
            me.channels = [];


          me.channels.push(
            reference.id
          );


          closeModal();

          toast(
            "Saluran dibuat"
          );


          loadChannels();


        }catch(error){

          console.error(error);

          toast(
            "Saluran gagal dibuat. Cek Firestore Rules."
          );

        }

      }
    );

}


async function loadChannels(){

  const box =
    $("channel-list");


  box.innerHTML = "";


  const ids =
    me?.channels || [];


  if(!ids.length){

    box.innerHTML = `
      <div class="placeholder-card">
        Belum ada saluran.
        Tekan “Buat saluran”
        untuk membuat yang pertama.
      </div>
    `;

    return;

  }


  for(
    const id of ids
  ){

    const snapshot =
      await getDoc(
        doc(
          db,
          "channels",
          id
        )
      );


    if(!snapshot.exists())
      continue;


    const channel =
      snapshot.data();


    const row =
      document.createElement(
        "div"
      );


    row.className =
      "feature-row";


    row.innerHTML = `

      <div class="avatar">
        C
      </div>

      <div class="grow">

        <b>
          ${escapeHtml(
            channel.name
          )}
        </b>

        <small>
          ${escapeHtml(
            channel.description ||
            "Saluran Mentra"
          )}
        </small>

      </div>

      <span>
        ${
          channel.subscribers?.length ||
          1
        }
        subscriber
      </span>

    `;


    box.appendChild(
      row
    );

  }

}


/* =========================================================
   STATUS
========================================================= */

async function createStatus(){

  openModal(
    "Tambah status",

    `
      <form
        id="status-form"
        class="modal-form"
      >

        <label>

          Isi status

          <textarea
            id="status-text"
            maxlength="500"
            required
            placeholder="Apa yang sedang lu pikirkan?"
          ></textarea>

        </label>


        <button
          class="primary"
          type="submit"
        >
          Post status
        </button>

      </form>
    `
  );


  $("status-form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try{

          await addDoc(
            collection(
              db,
              "statuses"
            ),
            {

              ownerId:
                me.uid,

              username:
                me.username,

              text:
                $("status-text")
                  .value
                  .trim(),

              createdAt:
                serverTimestamp()

            }
          );


          closeModal();

          toast(
            "Status diposting"
          );


          loadStatuses();


        }catch(error){

          console.error(error);

          toast(
            "Status gagal dibuat. Cek Firestore Rules."
          );

        }

      }
    );

}


async function loadStatuses(){

  const box =
    $("status-list");


  box.innerHTML =
    `
      <div class="placeholder-card">
        Memuat status...
      </div>
    `;


  try{

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "statuses"
          ),
          orderBy(
            "createdAt",
            "desc"
          ),
          limit(30)
        )
      );


    box.innerHTML = "";


    if(snapshot.empty){

      box.innerHTML = `
        <div class="placeholder-card">
          Belum ada status.
        </div>
      `;

      return;

    }


    snapshot.forEach(
      documentSnapshot => {

        const status =
          documentSnapshot.data();


        const row =
          document.createElement(
            "div"
          );


        row.className =
          "feature-row";


        row.innerHTML = `

          <div class="avatar">
            ${escapeHtml(
              initials(
                status.username
              )
            )}
          </div>

          <div class="grow">

            <b>
              @${escapeHtml(
                status.username ||
                "user"
              )}
            </b>

            <small>
              ${escapeHtml(
                status.text ||
                ""
              )}
            </small>

          </div>

        `;


        box.appendChild(
          row
        );

      }
    );


  }catch(error){

    console.error(error);

    box.innerHTML = `
      <div class="placeholder-card">
        Status belum aktif di Firestore Rules.
      </div>
    `;

  }

}


/* =========================================================
   QUICK ACTIONS
========================================================= */

document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(element => {

    element.addEventListener(
      "click",
      () => {

        const action =
          element.dataset.action;


        if(
          action ===
          "add-contact"
        ){

          showAddContact();

        }


        if(
          action ===
          "new-group"
        ){

          createGroup();

        }


        if(
          action ===
          "new-channel"
        ){

          createChannel();

        }

      }
    );

  });


$("new-group")
  .addEventListener(
    "click",
    createGroup
  );


$("new-channel")
  .addEventListener(
    "click",
    createChannel
  );


$("new-status")
  .addEventListener(
    "click",
    createStatus
  );


/* =========================================================
   CALL / VIDEO CALL
========================================================= */

async function startCall(
  video
){

  if(!activeChat){

    toast(
      "Buka chat dulu."
    );

    return;

  }


  $("call-title")
    .textContent =
    (
      video
        ? "Video call"
        : "Panggilan suara"
    ) +
    " · @" +
    activeChat.username;


  $("call-status")
    .textContent =
    "Meminta izin perangkat...";


  $("call-modal")
    .classList.remove(
      "hidden"
    );


  try{

    localStream =
      await navigator
        .mediaDevices
        .getUserMedia({

          audio: true,

          video: video

        });


    $("local-video")
      .srcObject =
      localStream;


    $("local-video")
      .style.display =
      video
        ? "block"
        : "none";


    $("call-status")
      .textContent =
      video
        ? "Kamera & mikrofon aktif."
        : "Mikrofon aktif.";


  }catch(error){

    console.error(error);

    $("call-status")
      .textContent =
      "Izin kamera/mikrofon ditolak atau tidak tersedia.";

  }

}


function closeCall(){

  if(localStream){

    localStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    localStream = null;

  }


  $("local-video")
    .srcObject = null;


  $("call-modal")
    .classList.add(
      "hidden"
    );

}


$("voice-call")
  .addEventListener(
    "click",
    () =>
      startCall(false)
  );


$("video-call")
  .addEventListener(
    "click",
    () =>
      startCall(true)
  );


$("call-close")
  .addEventListener(
    "click",
    closeCall
  );


$("call-hangup")
  .addEventListener(
    "click",
    closeCall
  );


$("call-mute")
  .addEventListener(
    "click",
    () => {

      if(!localStream)
        return;


      const track =
        localStream
          .getAudioTracks()[0];


      if(!track)
        return;


      track.enabled =
        !track.enabled;


      $("call-mute")
        .textContent =
        track.enabled
          ? "Mute"
          : "Unmute";

    }
  );


$("chat-info")
  .addEventListener(
    "click",
    () => {

      if(activeChat){

        toast(
          `@${activeChat.username} · chat pribadi`
        );

      }

    }
  );


$("attach-btn")
  .addEventListener(
    "click",
    () => {

      toast(
        "Lampiran membutuhkan Firebase Storage."
      );

    }
  );


window.addEventListener(
  "beforeunload",
  () => {

    if(localStream){

      localStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }

  }
);
