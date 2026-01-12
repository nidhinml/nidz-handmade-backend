/**
 * ============================================================
 * MINIMAL EXPRESS SERVER (RAILWAY DEBUG MODE)
 * ============================================================
 * Purpose:
 * - Verify Railway container starts
 * - Verify HTTP networking works
 * - Avoid crashes
 * ============================================================
 */

console.log("BOOTING APP...");

// -------- SAFETY HANDLERS --------
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
});

// -------- EXPRESS SETUP --------
const express = require("express");
const app = express();

// -------- TEST ROUTES --------
app.get("/", (req, res) => {
  res.status(200).send("OK - Railway server is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// -------- PORT (RAILWAY REQUIRED) --------
const PORT = process.env.PORT || 8080;

// IMPORTANT: bind to 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LISTENING ON PORT ${PORT}`);
});

/**
 * ============================================================
 * ALL CODE BELOW IS COMMENTED — DO NOT ENABLE YET
 * ============================================================
 */

/*
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

app.use(cors());
app.use(express.json());
app.use("/webhook", bodyParser.raw({ type: "*" }));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/create-payment-link", async (req, res) => {
  res.json({ message: "Payment disabled (debug mode)" });
});

app.post("/webhook", async (req, res) => {
  res.json({ status: "Webhook disabled (debug mode)" });
});
*/
