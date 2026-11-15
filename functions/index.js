const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();

exports.reviewPayment = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "শুধু Admin এই কাজ করতে পারবে।");
  }
  const { paymentId, decision, note = "" } = request.data || {};
  if (typeof paymentId !== "string" || !["approve", "reject"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Payment ID বা decision সঠিক নয়।");
  }
  const ref = db.collection("payments").doc(paymentId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Payment পাওয়া যায়নি।");
    const p = snap.data();
    if (p.status !== "pending") throw new HttpsError("failed-precondition", "এই payment আগে review করা হয়েছে।");
    if (decision === "reject") {
      tx.update(ref, {
        status: "rejected", reviewNote: String(note).slice(0, 300),
        reviewedAt: FieldValue.serverTimestamp(), reviewedBy: request.auth.uid
      });
      return;
    }
    const days = Number(p.durationDays);
    if (!Number.isInteger(days) || days < 0 || days > 36500) {
      throw new HttpsError("failed-precondition", "Payment-এর মেয়াদ সঠিক নয়।");
    }
    const userRef = db.collection("users").doc(p.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User পাওয়া যায়নি।");
    const expiry = days === 0 ? null : Timestamp.fromMillis(Date.now() + days * 86400000);
    tx.update(userRef, {
      subscription: { active: true, expiresAt: expiry, approvedPaymentId: paymentId }
    });
    tx.update(ref, {
      status: "approved", approvedAt: FieldValue.serverTimestamp(), approvedBy: request.auth.uid
    });
  });
  return { success: true };
});