import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function init(){
  if(!getApps().length){
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Vercel");
    initializeApp({credential:cert(JSON.parse(raw))});
  }
}

function normalizeUsername(v){
  return String(v || "").trim().toLowerCase().replace(/^@/,'');
}

function normalizePhone(v){
  return String(v || "").trim().replace(/[\s()-]/g, "");
}

export default async function handler(req,res){
  if(req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  try {
    init();
    const db = getFirestore();
    const auth = getAuth();
    const {phone, username, password} = req.body || {};
    const clean = normalizeUsername(username);
    const cleanPhone = normalizePhone(phone);

    if(!/^\+?[0-9]{8,15}$/.test(cleanPhone))
      return res.status(400).json({error:"Nomor HP tidak valid"});
    if(!/^[a-z0-9._]{3,24}$/.test(clean))
      return res.status(400).json({error:"Username 3-24 karakter: huruf, angka, titik, atau underscore"});
    if(String(password || "").length < 8)
      return res.status(400).json({error:"Password minimal 8 karakter"});

    const exists = await db.collection("users").where("username","==",clean).limit(1).get();
    if(!exists.empty) return res.status(409).json({error:"Username sudah dipakai"});

    const phoneExists = await db.collection("users").where("phone","==",cleanPhone).limit(1).get();
    if(!phoneExists.empty) return res.status(409).json({error:"Nomor HP sudah terdaftar"});

    const accountEmail = `${clean}@users.mentra.local`;
    let user;
    try {
      user = await auth.createUser({email:accountEmail,password,displayName:clean});
      await db.collection("users").doc(user.uid).set({
        uid:user.uid, username:clean, phone:cleanPhone,
        bio:"", photoURL:"", status:"offline",
        createdAt:FieldValue.serverTimestamp(), lastSeen:FieldValue.serverTimestamp()
      });
    } catch(e) {
      if(user?.uid) await auth.deleteUser(user.uid).catch(()=>{});
      throw e;
    }

    return res.status(201).json({ok:true, uid:user.uid, email:accountEmail});
  } catch(e) {
    console.error(e);
    return res.status(500).json({error:e.message || "Server error"});
  }
}
