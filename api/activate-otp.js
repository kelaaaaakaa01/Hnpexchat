import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
function init(){if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    init();
    const {sessionId,otp}=req.body||{};
    if(!sessionId||!otp)return res.status(400).json({error:"Session dan OTP wajib diisi"});
    const ref=getFirestore().collection("otpSessions").doc(sessionId), snap=await ref.get();
    if(!snap.exists)return res.status(400).json({error:"Sesi OTP tidak ditemukan"});
    const d=snap.data();
    if(d.used)return res.status(400).json({error:"OTP sudah digunakan"});
    if(Date.now()>d.expiresAt)return res.status(400).json({error:"OTP sudah kedaluwarsa"});
    if(String(d.otp)!==String(otp))return res.status(400).json({error:"OTP salah"});
    await ref.update({activated:true,activatedAt:Date.now()});
    return res.status(200).json({activated:true});
  }catch(e){return res.status(500).json({error:e.message||"Server error"});}
}
