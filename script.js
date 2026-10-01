import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCABFYMEsfwOI5hvZALTqoFsameHqq5QXI",
  authDomain: "fire-chat-c043f.firebaseapp.com",
  projectId: "fire-chat-c043f",
  storageBucket: "fire-chat-c043f.firebasestorage.app",
  messagingSenderId: "666512765812",
  appId: "1:666512765812:web:9bce88a00a791e2851f221",
  measurementId: "G-LW21XL2YRK"
};
const API_BASE = ""; // Vercel: same-origin /api/*

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
let me = null, activeChat = null, unsubscribeMessages = null;

const $ = id => document.getElementById(id);
const toast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=> $("toast").classList.remove("show"),2500); };
const setStatus = msg => $("auth-status").textContent = msg;

function normalizeUsername(v){ return v.trim().toLowerCase().replace(/^@/,""); }
function emailForUsername(u){ return `${normalizeUsername(u)}@users.mentra.local`; }

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); btn.classList.add("active");
  $("login-form").classList.toggle("hidden",btn.dataset.auth!=="login");
  $("register-form").classList.toggle("hidden",btn.dataset.auth!=="register");
  setStatus("");
});

$("register-form").onsubmit = async e => {
  e.preventDefault();
  const phone = $("reg-phone").value.trim();
  const username = normalizeUsername($("reg-username").value);
  const password = $("reg-password").value;

  if(!phone || !username || password.length < 8) {
    return setStatus("Nomor HP, username, dan password wajib diisi. Password minimal 8 karakter.");
  }

  $("create-account").disabled = true;
  setStatus("Membuat akun...");
  try {
    const r = await fetch(`${API_BASE}/api/create-account`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone, username, password})
    });
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(d.error || "Gagal membuat akun");

    await signInWithEmailAndPassword(auth, d.email || emailForUsername(username), password);
    toast("Akun berhasil dibuat");
  } catch(err) {
    setStatus(err.message || "Gagal membuat akun.");
  } finally {
    $("create-account").disabled = false;
  }
};

$("login-form").onsubmit=async e=>{
  e.preventDefault();
  try{ await signInWithEmailAndPassword(auth,emailForUsername($("login-username").value),$("login-password").value); }
  catch(err){setStatus("Username atau password salah.");}
};

onAuthStateChanged(auth, async user=>{
  if(!user){$("auth").classList.remove("hidden");$("chat-app").classList.add("hidden");return;}
  const snap=await getDoc(doc(db,"users",user.uid));
  me=snap.data();
  if(!me){await signOut(auth);return;}
  $("auth").classList.add("hidden"); $("chat-app").classList.remove("hidden");
  $("me-label").textContent="@"+me.username;
  $("profile-name").textContent="@"+me.username; $("profile-avatar").textContent=(me.username||"M")[0].toUpperCase();
  $("profile-bio").textContent=me.bio||"Belum ada bio.";
});

$("logout").onclick=()=>signOut(auth);
$("profile-btn").onclick=()=>$("profile-panel").classList.remove("hidden");
$("close-profile").onclick=()=>$("profile-panel").classList.add("hidden");
$("save-profile").onclick=async()=>{await setDoc(doc(db,"users",auth.currentUser.uid),{bio:$("bio-input").value.trim()},{merge:true});$("profile-bio").textContent=$("bio-input").value.trim()||"Belum ada bio.";toast("Profil disimpan");};

document.querySelectorAll(".nav").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  const v=btn.dataset.view;
  $("conversation").classList.toggle("hidden",v!=="chats"||!activeChat);
  $("empty-chat").classList.toggle("hidden",v!=="chats"||!!activeChat);
  $("status-view").classList.toggle("hidden",v!=="status");
  $("channels-view").classList.toggle("hidden",v!=="channels");
  $("groups-view").classList.toggle("hidden",v!=="groups");
});

$("user-search").onkeydown=async e=>{
  if(e.key!=="Enter")return;
  const username=normalizeUsername(e.target.value); if(!username)return;
  const q=query(collection(db,"users"),where("username","==",username));
  const snap=await new Promise((resolve,reject)=>onSnapshot(q,s=>resolve(s),reject));
  if(snap.empty)return toast("Username tidak ditemukan.");
  const u=snap.docs[0].data(); if(u.uid===auth.currentUser.uid)return toast("Itu akun kamu.");
  renderSearchResult(u);
};
function renderSearchResult(u){
  $("conversation-list").innerHTML="";
  const el=document.createElement("div");el.className="conversation-item active";
  el.innerHTML=`<div class="avatar">${(u.username||"?")[0].toUpperCase()}</div><div class="meta"><strong>@${u.username}</strong><small>${u.bio||"Mulai percakapan baru"}</small></div>`;
  el.onclick=()=>openChat(u);$("conversation-list").appendChild(el);
}
function chatId(a,b){return [a,b].sort().join("_");}
function openChat(u){
  activeChat=u;$("empty-chat").classList.add("hidden");$("conversation").classList.remove("hidden");
  $("chat-name").textContent="@"+u.username;$("chat-avatar").textContent=(u.username||"?")[0].toUpperCase();
  if(unsubscribeMessages)unsubscribeMessages();
  const q=query(collection(db,"chats",chatId(me.uid,u.uid),"messages"),orderBy("createdAt","asc"));
  unsubscribeMessages=onSnapshot(q,snap=>{const box=$("messages");box.innerHTML="";snap.forEach(d=>{const m=d.data();const el=document.createElement("div");el.className="message "+(m.senderId===me.uid?"mine":"");el.innerHTML=`${escapeHtml(m.text)} <time>${m.createdAt?.toDate?m.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}</time>`;box.appendChild(el)});box.scrollTop=box.scrollHeight;});
}
$("message-form").onsubmit=async e=>{
  e.preventDefault();const text=$("message-input").value.trim();if(!text||!activeChat)return;
  await addDoc(collection(db,"chats",chatId(me.uid,activeChat.uid),"messages"),{text,senderId:me.uid,createdAt:serverTimestamp()});
  $("message-input").value="";
};
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
