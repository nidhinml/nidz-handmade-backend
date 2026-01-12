const express = require("express");
const app = express();

// 🔴 THIS ROUTE IS REQUIRED FOR RAILWAY
app.get("/", (req, res) => {
  res.status(200).send("OK - Nidz Handmade Backend is running");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port", PORT);
});
