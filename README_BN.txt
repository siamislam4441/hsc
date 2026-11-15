HSC STUDY PORTAL — Firebase Starter Project
=============================================

এই ZIP-এ আছে:
- public/index.html, public/app.js: ওয়েবসাইট
- firestore.rules: Firestore নিরাপত্তা নিয়ম
- functions/: Admin-এর payment approve/reject করার secure Cloud Function
- scripts/set-admin.js: নির্দিষ্ট ইমেইলকে Admin করার script
- firebase.json: Firebase Hosting/Functions config

গুরুত্বপূর্ণ:
1) firebaseConfig পরে public/app.js-এ বসাবে।
2) Firebase Storage ব্যবহার করা হয়নি। ছবি আপলোড/প্রোফাইল ছবি বাদ।
3) bKash payment এখানে MANUAL। সাইট টাকা যাচাই করে না। Admin bKash-এ TrxID যাচাই করে তারপর Approve করবে।
4) শুধু Admin custom claim থাকলে Admin Panel দেখা যাবে। HTML-এ বাটন লুকানো নিরাপত্তা নয়; প্রকৃত নিরাপত্তা Firestore Rules ও Cloud Function দিয়ে।
5) Google Drive ফাইল যদি public share করা থাকে, কেউ ওয়েবসাইটের বাইরে থেকেও লিংক খুলতে পারে। সাবস্ক্রিপশন শুধু পোর্টালের ফাইল তালিকা নিয়ন্ত্রণ করে; পাবলিক Drive URL-কে private করে না।
6) Firebase config web config, এটা ওয়েব অ্যাপে থাকবে। Service Account JSON, password, OTP, bKash PIN কাউকে দেবে না।

সেটআপের ধাপ
------------

A. Firebase Authentication
1. Firebase Console > Authentication > Get started
2. Sign-in method > Email/Password Enable > Save

B. Firestore
1. Build > Firestore Database তৈরি করো।
2. Firestore > Rules-এ এই ZIP-এর firestore.rules-এর সব লেখা paste করে Publish করো।

C. Web Config
1. Project settings > General > Your apps > Web app > SDK setup and configuration > Config
2. public/app.js-এর firebaseConfig placeholder-গুলো নিজের config দিয়ে বদলাও।
3. config-এ Storage দরকার নেই; storageBucket লাইন বাদ দিলেও চলে।

D. Cloud Functions deploy (payment approve/reject-এর জন্য আবশ্যক)
এটার জন্য Firebase CLI এবং Node.js-সহ কম্পিউটার লাগবে।
1. Node.js LTS এবং Firebase CLI install করো।
2. এই project folder-এ terminal খুলে:
   npm install -g firebase-tools
   firebase login
   firebase use --add
   (তোমার Firebase project নির্বাচন করবে)
3. Functions deploy:
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   Note: Cloud Functions deploy করতে Firebase plan/billing requirement আসতে পারে। Console-এ যে billing requirement দেখাবে তা যাচাই করবে; অজানা খরচে সম্মতি দেবে না।
4. Functions region default us-central1। চাইলে functions getFunctions(app, "asia-south1") এবং Function region একইভাবে সেট করতে হবে; default-ই রাখলে এখন পরিবর্তন দরকার নেই।

E. প্রথম Admin তৈরি
1. Firebase Console > Project settings > Service accounts > Generate new private key।
2. Download করা JSON এই project folder-এর root-এ service-account.json নামে রাখবে।
3. কখনো GitHub-এ, Hosting public folder-এ, বা কাউকে পাঠাবে না।
4. Terminal-এ:
   cd functions
   npm install firebase-admin
   cd ..
   npm install firebase-admin
   node scripts/set-admin.js তোমার-অ্যাডমিন-ইমেইল
5. সফল হলে Admin ওই ইমেইল দিয়ে logout/login করবে অথবা token refresh করবে।
6. কাজ শেষে service-account.json নিরাপদে সরিয়ে রাখবে; কম্পিউটার থেকে অনিরাপদ কপি মুছে ফেলবে।
   service-account.json ZIP-এ অন্তর্ভুক্ত নেই।

F. Hosting deploy
1. root folder-এ:
   firebase deploy --only hosting,firestore:rules
2. deploy হলে Firebase Hosting URL-এ ওয়েবসাইট খুলবে।

ব্যবহার
------
- User register/login করবে।
- Subscription tab-এ বর্তমান bKash নম্বর/মূল্য/মেয়াদ দেখবে।
- টাকা পাঠানোর পরে TrxID জমা দেবে।
- Admin bKash account-এ transaction যাচাই করে Admin Panel থেকে Approve/Reject করবে।
- Approve হলে Cloud Function user-এর subscription সক্রিয় করবে।
- Admin Payment Control থেকে নতুন payment-এর জন্য নম্বর, amount, duration বদলাতে পারবে।
- Admin folder/file link add/edit/delete করতে পারবে।
- Community message সব signed-in user দেখতে পারবে; Admin delete করতে পারবে।

সীমাবদ্ধতা ও নিরাপত্তা
---------------------
- এই project একটি deploy-ready starter, Firebase config ও deployment ছাড়া সরাসরি live হবে না।
- Cloud Functions না deploy করলে Approve/Reject কাজ করবে না।
- Firebase Storage বাদ; তাই PDF/ছবি Firebase-এ upload হবে না। PDF/ফাইল URL হিসেবে দিতে হবে।
- Public Google Drive URL অন্যের কাছে share হলে portal-এর বাইরে থেকেও খুলতে পারে।
- Support Chamber public-to-all-signed-in-user; ব্যক্তিগত/গোপন তথ্য শেয়ার করা যাবে না।
- Firestore query-তে index প্রয়োজন হলে Firebase Console error link থেকে index create করতে হবে।
- production-এ চালুর আগে test accounts দিয়ে register, reset password, payment request, approve/reject, expired subscription, admin permissions পরীক্ষা করবে।
