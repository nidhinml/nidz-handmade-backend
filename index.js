const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

/* ================= FIREBASE ADMIN ================= */
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ================= APP ================= */
const app = express();
app.use(cors());
app.use(express.json());

/* Health check */
app.get("/", (req, res) => {
  res.send("Backend OK ✅");
});

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= CREATE PAYMENT LINK ================= */
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

    /* 🔥 CREATE ORDER WITH paymentLinkId */
    await db.collection("users").doc(uid).collection("orders").add({
      items,
      address,
      totalAmount: amount,
      paymentStatus: "PENDING",
      paymentLinkId: paymentLink.id, // ✅ IMPORTANT
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ url: paymentLink.short_url });
  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= WEBHOOK ================= */
app.post(
  "/webhook",
  bodyParser.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const receivedSignature = req.headers["x-razorpay-signature"];

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (receivedSignature !== expectedSignature) {
        return res.status(400).send("Invalid signature");
      }

      const event = JSON.parse(req.body.toString());

      /* ✅ PAYMENT LINK PAID */
      if (event.event === "payment_link.paid") {
        const payment = event.payload.payment.entity;
        const notes = payment.notes;

        const uid = notes.uid;
        const cartItemIds = JSON.parse(notes.cartItemIds || "[]");
        const paymentLinkId = event.payload.payment_link.entity.id;

        /* 🔥 DELETE CART ITEMS */
        for (const id of cartItemIds) {
          await db
            .collection("users")
            .doc(uid)
            .collection("cart")
            .doc(id)
            .delete();
        }

        /* 🔥 UPDATE EXACT ORDER */
        const ordersSnap = await db
          .collection("users")
          .doc(uid)
          .collection("orders")
          .where("paymentLinkId", "==", paymentLinkId)
          .limit(1)
          .get();

        if (!ordersSnap.empty) {
          await ordersSnap.docs[0].ref.update({
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
  }
);

/* ================= SERVER ================= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
