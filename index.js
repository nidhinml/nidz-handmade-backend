const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

/* ---------- FIREBASE ADMIN ---------- */
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ---------- APP SETUP ---------- */

app.get("/", (req, res) => {
  res.status(200).send("Nidz Handmade Backend is running");
});

const app = express();
app.use(cors());
app.use(express.json());

// RAW BODY ONLY FOR WEBHOOK
app.use("/webhook", bodyParser.raw({ type: "*/*" }));

/* ---------- RAZORPAY ---------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ---------- CREATE PAYMENT LINK ---------- */
app.post("/create-payment-link", async (req, res) => {
  try {
    const { amount, email, uid, cartItemIds, address, items } = req.body;

    if (!amount || !uid || !cartItemIds?.length) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100,
      currency: "INR",
      description: "Nidz Handmade Products",
      customer: { email },
      notes: {
        uid,
        cartItemIds: JSON.stringify(cartItemIds),
      },
      notify: { email: true },
    });

    await db
      .collection("users")
      .doc(uid)
      .collection("orders")
      .add({
        items,
        address,
        totalAmount: amount,
        paymentStatus: "PENDING",
        paymentLinkId: paymentLink.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json({ url: paymentLink.short_url });
  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- WEBHOOK ---------- */
app.post("/webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    const receivedSignature = req.headers["x-razorpay-signature"];

    if (expectedSignature !== receivedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment_link.paid") {
      const payment = event.payload.payment.entity;
      const { uid, cartItemIds } = payment.notes;

      const ids = JSON.parse(cartItemIds || "[]");

      for (const id of ids) {
        await db
          .collection("users")
          .doc(uid)
          .collection("cart")
          .doc(id)
          .delete();
      }

      const orders = await db
        .collection("users")
        .doc(uid)
        .collection("orders")
        .where("paymentStatus", "==", "PENDING")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!orders.empty) {
        await orders.docs[0].ref.update({
          paymentStatus: "PAID",
          razorpayPaymentId: payment.id,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook error");
  }
});

/* ---------- SERVER ---------- */
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
