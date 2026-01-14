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

/*
 ⚠️ VERY IMPORTANT
 Webhook MUST receive RAW body
*/
app.use("/webhook", bodyParser.raw({ type: "*/*" }));
app.use(express.json());

/* ================= HEALTH CHECK ================= */
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

    /* 🔥 USER ORDER (PENDING) */
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

    /* 🔥 ADMIN ORDER (PENDING) */
    await db.collection("admin_orders").add({
      uid,
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

/* ================= WEBHOOK ================= */
app.post("/webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());
    const eventType = event.event;

    console.log("📩 Webhook Event:", eventType);

    /* ✅ HANDLE SUCCESS EVENTS */
    if (
      eventType === "payment_link.paid" ||
      eventType === "payment.captured"
    ) {
      const payment =
        event.payload.payment?.entity ||
        event.payload.payment_link?.entity;

      if (!payment || !payment.notes) {
        return res.json({ status: "ignored" });
      }

      const uid = payment.notes.uid;
      const cartItemIds = JSON.parse(payment.notes.cartItemIds || "[]");

      const paymentLinkId =
        event.payload.payment_link?.entity?.id ||
        payment.payment_link_id;

      /* 🔥 DELETE CART ITEMS */
      for (const id of cartItemIds) {
        await db
          .collection("users")
          .doc(uid)
          .collection("cart")
          .doc(id)
          .delete();
      }

      /* 🔥 UPDATE USER ORDER */
      const userOrders = await db
        .collection("users")
        .doc(uid)
        .collection("orders")
        .where("paymentLinkId", "==", paymentLinkId)
        .limit(1)
        .get();

      if (!userOrders.empty) {
        await userOrders.docs[0].ref.update({
          paymentStatus: "PAID",
          razorpayPaymentId: payment.id,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      /* 🔥 UPDATE ADMIN ORDER */
      const adminOrders = await db
        .collection("admin_orders")
        .where("paymentLinkId", "==", paymentLinkId)
        .limit(1)
        .get();

      if (!adminOrders.empty) {
        await adminOrders.docs[0].ref.update({
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

/* ================= SERVER ================= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
