// নিরাপদে নিজের কম্পিউটারে চালাবে। service-account.json কখনো ওয়েবসাইটে আপলোড করবে না।
const admin = require("firebase-admin");
const serviceAccount = require("../service-account.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("ব্যবহার: node scripts/set-admin.js admin@example.com");
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Admin role দেওয়া হয়েছে: ${email}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });