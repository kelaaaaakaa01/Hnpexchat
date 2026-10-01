# Mentra Chat

Fondasi aplikasi chat username-based bergaya comic/pro.

## Yang sudah tersedia
- Register memakai nomor HP + OTP server-side.
- OTP dibuat random, disimpan di Firestore dan dikirim melalui Gmail SMTP.
- Login memakai username + password; nomor tidak dipakai sebagai identitas chat.
- Profil + bio.
- Pencarian username.
- 1-on-1 realtime chat via Firestore.
- UI responsive, PWA-ready, tema gelap comic dengan font Bangers/Space Grotesk.
- Tab dasar Chats, Status, Saluran, Grup.
- Endpoint serverless `/api/send-otp` dan `/api/verify-otp`.

## Penting soal OTP
Browser tidak boleh menyimpan password Gmail. Gunakan Gmail App Password pada environment variable server.
Jika maksudmu OTP dikirim ke nomor HP, bukan email, flow ini perlu SMS provider seperti Twilio/MessageBird. Gmail sendiri hanya mengirim email.

## Setup Firebase
1. Buat project di Firebase.
2. Aktifkan Authentication > Email/Password.
3. Buat Firestore Database.
4. Tambahkan Web App dan salin config ke `script.js`.
5. Buat Service Account dan simpan JSON-nya sebagai `FIREBASE_SERVICE_ACCOUNT_JSON` di Vercel.
6. Deploy rules dari `firebase.rules`.

## Setup Gmail
1. Login ke akun `mentrastore8@gmail.com`.
2. Aktifkan 2-Step Verification.
3. Buat App Password khusus Mentra Chat.
4. Di Vercel Environment Variables:
   - `GMAIL_USER=mentrastore8@gmail.com`
   - `GMAIL_APP_PASSWORD=...`
   - `OTP_DESTINATION_EMAIL=...`
   - `FIREBASE_SERVICE_ACCOUNT_JSON=...`

## Vercel
Import folder ini ke Vercel. Karena API ada di folder `/api`, endpoint akan otomatis menjadi:
- `/api/send-otp`
- `/api/verify-otp`

## Pengembangan tahap berikutnya
Untuk benar-benar menyamai fitur messenger modern, lanjutkan:
- upload avatar/foto/video ke Firebase Storage
- group chat + admin/member roles
- status 24 jam
- channels + subscribers
- read receipts / typing / presence
- voice/video call menggunakan WebRTC + signaling Firestore
- push notification FCM
- block/report/privacy settings
- message reply, edit, delete, reactions, pin
- end-to-end encryption jika dibutuhkan

Jangan taruh Firebase Admin JSON atau Gmail App Password di frontend.
