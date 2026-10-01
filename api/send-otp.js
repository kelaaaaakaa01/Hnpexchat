import crypto from "crypto";
import nodemailer from "nodemailer";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function db(){
  if(!getApps().length) initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});
  return getFirestore();
}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const {phone,email}=req.body||{};
  if(!phone||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:"Nomor HP dan Gmail yang valid wajib diisi"});

  const sessionId=crypto.randomUUID();
  const otp=String(crypto.randomInt(100000,1000000));
  const expiresAt=Date.now()+5*60*1000;

  await db().collection("otpSessions").doc(sessionId).set({
    phone,email:email.toLowerCase(),otp,expiresAt,activated:false,used:false,createdAt:Date.now()
  });

  const transporter=nodemailer.createTransport({
    service:"gmail",
    auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}
  });
  await transporter.sendMail({
    from:`Mentra Chat <${process.env.GMAIL_USER}>`,
    to:email,
    subject:"Mentra Chat — kode OTP aktivasi",
    text:`Kode OTP Mentra Chat: ${otp}\n\nKode berlaku 5 menit.\nSetelah OTP benar, akun akan diaktifkan dan kamu dapat membuat username.\n\nJangan bagikan kode ini kepada siapa pun.`
  });
  return res.status(200).json({sessionId});
}