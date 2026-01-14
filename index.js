// const express = require("express");
// const Razorpay = require("razorpay");
// const cors = require("cors");
// const crypto = require("crypto");
// const bodyParser = require("body-parser");
// const admin = require("firebase-admin");

// /* ================= FIREBASE ADMIN ================= */
// const serviceAccount = JSON.parse(
//   Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
// );

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore();

// /* ================= APP SETUP ================= */
// const app = express();
// app.use(cors());

// /* 🔴 IMPORTANT: RAW BODY FIRST (ONLY WEBHOOK) */
// app.post("/webhook", bodyParser.raw({ type: "*/*" }), async (req, res) => {
//   try {
//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     const signature = req.headers["x-razorpay-signature"];

//     const expectedSignature = crypto
//       .createHmac("sha256", secret)
//       .update(req.body)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       return res.status(400).send("Invalid signature");
//     }

//     const event = JSON.parse(req.body.toString());

//     if (event.event === "payment_link.paid") {
//       const payment = event.payload.payment.entity;
//       const { uid, cartItemIds } = payment.notes;

//       const ids = JSON.parse(cartItemIds || "[]");

//       for (const id of ids) {
//         await db
//           .collection("users")
//           .doc(uid)
//           .collection("cart")
//           .doc(id)
//           .delete();
//       }

//       const snap = await db
//         .collection("users")
//         .doc(uid)
//         .collection("orders")
//         .where("paymentStatus", "==", "PENDING")
//         .orderBy("createdAt", "desc")
//         .limit(1)
//         .get();

//       if (!snap.empty) {
//         await snap.docs[0].ref.update({
//           paymentStatus: "PAID",
//           razorpayPaymentId: payment.id,
//           paidAt: admin.firestore.FieldValue.serverTimestamp(),
//         });
//       }
//     }

//     res.status(200).json({ ok: true });
//   } catch (err) {
//     console.error("Webhook error:", err);
//     res.status(500).send("Webhook error");
//   }
// });

// /* 🔴 JSON AFTER WEBHOOK */
// app.use(express.json());

// /* ================= HEALTH CHECKS (MANDATORY) ================= */
// app.get("/", (req, res) => {
//   res.status(200).send("Backend OK");
// });

// app.post("/", (req, res) => {
//   res.status(200).send("Backend OK");
// });

// /* ================= RAZORPAY ================= */
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// /* ================= CREATE PAYMENT LINK ================= */
// app.post("/create-payment-link", async (req, res) => {
//   try {
//     const { amount, email, uid, cartItemIds, address, items } = req.body;

//     if (!amount || !uid || !cartItemIds?.length) {
//       return res.status(400).json({ error: "Invalid request" });
//     }

//     const link = await razorpay.paymentLink.create({
//       amount: amount * 100,
//       currency: "INR",
//       description: "Nidz Handmade Products",
//       customer: { email },
//       notes: {
//         uid,
//         cartItemIds: JSON.stringify(cartItemIds),
//       },
//     });

//     await db
//       .collection("users")
//       .doc(uid)
//       .collection("orders")
//       .add({
//         items,
//         address,
//         totalAmount: amount,
//         paymentStatus: "PENDING",
//         paymentLinkId: link.id,
//         createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       });

//     res.json({ url: link.short_url });
//   } catch (err) {
//     console.error("Payment error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// /* ================= SERVER ================= */
// const PORT = process.env.PORT || 8080;

// app.listen(PORT, "0.0.0.0", () => {
//   console.log("✅ Server running on port", PORT);
// });

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend OK ✅");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port", PORT);
});
