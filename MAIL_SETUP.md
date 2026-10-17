# Gmail setup — NUB Connect

1. আপনার Gmail-এর Google Account → Security থেকে **2-Step Verification** চালু করুন।
2. https://myaccount.google.com/apppasswords খুলে NUB Connect নামে App Password তৈরি করুন।
3. Project root-এর private `.env.mail` file-এ লিখুন:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM_NAME=NUB Connect
```

Project root-এর file: `.env.mail`। এটি ইতিমধ্যে configure করা হয়েছে। সাধারণ Gmail password বসাবেন না। App Password-এর মাঝের spaces server বাদ দেয়। Save করলেই পরবর্তী mail-এ নতুন configuration ব্যবহৃত হবে। Password chat-এ পাঠানোর প্রয়োজন নেই।

অন্য machine-এ project root-এ `.env.mail` তৈরি করুন। প্রয়োজন হলে root `.env`-এ absolute `MAIL_CONFIG_PATH` দিয়ে private mail file-এর অবস্থান দিন। Normal `.env`-এর SMTP variables-ও ব্যবহার করা যায়। কোনো `VITE_` variable-এ password রাখবেন না।

`.env.mail` Git ও source ZIP থেকে বাদ দেওয়া হয়েছে। এটি share/commit করবেন না। Source ZIP-এ credentials থাকে না, তাই নতুন machine-এ নিজে আবার configure করতে হবে।

Admin account তৈরি করলে সরাসরি email/ID ও নির্ধারিত password দিয়ে login করা যাবে। Account creation বা email edit-এর জন্য verification email পাঠানো হয় না। Login page-এ verification option নেই। Email service শুধু Forgot password recovery-এর জন্য ব্যবহৃত হয়।

**Forgot password** থেকে account email দিন → branded reset email → ৩০ মিনিটের single-use link → নতুন password (কমপক্ষে ১১ character) → login। Reset করলে আগের session ও পুরোনো recovery links বাতিল হয়। Google-এর password বদলালে App Password revoke হতে পারে; তখন নতুনটি তৈরি করে file update করুন।

Production-এ `FRONTEND_ORIGIN` অবশ্যই আপনার real HTTPS domain হবে। Localhost-এর email link অন্য computer থেকে app খুলতে পারবে না। Gmail SMTP mail গ্রহণ করলেও Spam/Inbox placement provider-এর উপর নির্ভর করে।

Google নির্দেশনা: https://support.google.com/accounts/answer/185833
Nodemailer Gmail নির্দেশনা: https://nodemailer.com/guides/using-gmail
