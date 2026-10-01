import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
function init(){if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    init(); const db=getFirestore(), auth=getAuth();
    const {sessionId,phone,otp,username,password}=req.body||{};
    const clean=String(username||"").toLowerCase().replace(/^@/,"");
    if(!sessionId||!phone||!otp||!clean||String(password||"").length<8)return res.status(400).json({error:"Data belum lengkap"});
    const s=await db.collection("otpSessions").doc(sessionId).get();
    if(!s.exists)return res.status(400).json({error:"Sesi OTP tidak ditemukan"});
    const d=s.data();
    if(d.used||Date.now()>d.expiresAt||d.phone!==phone||String(d.otp)!==String(otp))return res.status(400).json({error:"OTP salah atau sudah kedaluwarsa"});
    const exists=await db.collection("users").where("username","==",clean).limit(1).get();
    if(!exists.empty)return res.status(409).json({error:"Username sudah dipakai"});
    const email=`${clean}@users.mentra.local`;
    const user=await auth.createUser({email,password,displayName:clean});
    await db.collection("users").doc(user.uid).set({uid:user.uid,username:clean,phone, bio:"",photoURL:"",createdAt:FieldValue.serverTimestamp()});
    await s.ref.update({used:true});
    return res.status(200).json({uid:user.uid});
  }catch(e){return res.status(500).json({error:e.message||"Server error"});}
}