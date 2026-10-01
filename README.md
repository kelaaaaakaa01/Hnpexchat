# Mentra Chat

Versi ini memakai Firebase sebagai backend untuk akun, chat, profil, dan data aktivitas.

## Registrasi

Tidak ada OTP/Gmail.

Pengguna mendaftar dengan:
- Nomor HP
- Username
- Password minimal 8 karakter

Setelah akun dibuat, aplikasi otomatis login.

## Login

Login menggunakan username + password. Di belakang layar username dipetakan ke email internal Firebase:
`username@users.mentra.local`

Nomor HP tetap disimpan di Firestore sebagai data akun.

## Vercel Environment Variable

Wajib:

`FIREBASE_SERVICE_ACCOUNT_JSON`

Isi dengan seluruh JSON Firebase Admin Service Account.

Tidak perlu lagi:
- GMAIL_USER
- GMAIL_APP_PASSWORD
- OTP session
- provider SMS

## Firebase

Aktifkan:
1. Authentication → Sign-in method → Email/Password
2. Firestore Database

Deploy `firebase.rules` ke Firestore Rules.

## Catatan

API `/api/create-account` memakai Firebase Admin SDK untuk membuat akun Auth dan dokumen `users`. Admin SDK melewati Firestore Security Rules, sedangkan operasi chat dari browser tetap dibatasi oleh Rules.
