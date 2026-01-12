
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: "rzp_test_S1gf5dCkjIZnKm",
  key_secret: "Hxk2EdLOJAYjVBzI63kjM4au",
});

app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "order_" + Date.now(),
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/create-payment-link", async (req, res) => {
  try {
    const { amount, email } = req.body;

    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100,
      currency: "INR",
      accept_partial: false,
      customer: { email },
      notify: { email: true },
      callback_url: "https://example.com/success",
      callback_method: "get",
    });

    res.json({ url: paymentLink.short_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/razorpay-webhook", express.raw({ type: "*/*" }), (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  const receivedSignature = req.headers["x-razorpay-signature"];

  if (expectedSignature !== receivedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const payload = JSON.parse(req.body.toString());

  if (payload.event === "payment_link.paid") {
    // ✅ Payment confirmed
    // Save order to Firestore
  }

  res.status(200).send("OK");
});

app.post("/create-payment-link", async (req, res) => {
  const { amount, email, uid, cartItemIds } = req.body;

  const paymentLink = await razorpay.paymentLink.create({
    amount: amount * 100,
    currency: "INR",
    description: "Nidz Handmade Products",
    customer: { email },
    notes: {
      uid,
      cartItemIds: JSON.stringify(cartItemIds), // 🔥 STORE HERE
    },
  });

  res.json({ url: paymentLink.short_url });
});

app.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const crypto = require("crypto");

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  const receivedSignature = req.headers["x-razorpay-signature"];

  if (expectedSignature !== receivedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(req.body);

  if (event.event === "payment.captured") {
    const notes = event.payload.payment.entity.notes;
    const uid = notes.uid;
    const cartItemIds = JSON.parse(notes.cartItemIds);

    const db = admin.firestore();

    // 🔥 DELETE ONLY PAID ITEMS
    for (const id of cartItemIds) {
      await db
        .collection("users")
        .doc(uid)
        .collection("cart")
        .doc(id)
        .delete();
    }

    // 🔥 CREATE ORDER
    await db
      .collection("users")
      .doc(uid)
      .collection("orders")
      .add({
        amount: event.payload.payment.entity.amount / 100,
        paymentId: event.payload.payment.entity.id,
        status: "PAID",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }

  res.json({ status: "ok" });
});



app.listen(5000, () => {
  console.log("Server running on port 5000");
});
