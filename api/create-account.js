import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
function init(){if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    init();
    const db=getFirestore(), auth=getAuth();
    const {sessionId,phone,email,username,password}=req.body||{};
    const clean=String(username||"").toLowerCase().replace(/^@/,"");
    if(!sessionId||!phone||!email||!clean||String(password||"").length<8)
      return res.status(400).json({error:"Data belum lengkap"});
    const sref=db.collection("otpSessions").doc(sessionId), s=await sref.get();
    if(!s.exists)return res.status(400).json({error:"Sesi aktivasi tidak ditemukan"});
    const d=s.data();
    if(!d.activated)return res.status(403).json({error:"Aktifkan akun dengan OTP terlebih dahulu"});
    if(d.used)return res.status(400).json({error:"Sesi sudah digunakan"});
    if(d.phone!==phone||d.email!==String(email).toLowerCase())return res.status(400).json({error:"Data pendaftaran tidak cocok"});
    if(Date.now()>d.expiresAt)return res.status(400).json({error:"Sesi aktivasi sudah kedaluwarsa"});
    const exists=await db.collection("users").where("username","==",clean).limit(1).get();
    if(!exists.empty)return res.status(409).json({error:"Username sudah dipakai"});
    const accountEmail=`${clean}@users.mentra.local`;
    const user=await auth.createUser({email:accountEmail,password,displayName:clean});
    await db.collection("users").doc(user.uid).set({
      uid:user.uid,username:clean,phone,registrationEmail:String(email).toLowerCase(),
      bio:"",photoURL:"",createdAt:FieldValue.serverTimestamp()
    });
    await sref.update({used:true});
    return res.status(200).json({uid:user.uid});
  }catch(e){return res.status(500).json({error:e.message||"Server error"});}
}