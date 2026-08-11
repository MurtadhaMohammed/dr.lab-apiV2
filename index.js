require("dotenv").config();
const express = require("express");
var cors = require("cors");
const app = express();

// Load config based on environment
const port = process.env.PORT || 3000;

// Import routers
const adminRouter = require("./routers/admin");
const clientRouter = require("./routers/client");
const planRouter = require("./routers/plan");
const invoiceRouter = require("./routers/invoice");
const walletRouter = require("./routers/wallet");

// const dashboardRouter = require("./routers/dashboard")
const appRouter = require("./routers/app");
const syncRouter = require("./routers/sync");

// Admin dashboard endpoints (separate folder, does not touch ./routers)
const adminDashboardRouter = require("./dashboard");

const fileUpload = require("express-fileupload");



app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  })
);

app.get("/api", (req, res) => {
  res.json({ msg: "hi All" });
});

// Use routers
app.use("/api/admin", adminRouter);
app.use("/api/client", clientRouter);
// app.use("/api/dashboard", dashboardRouter);
app.use("/api/plan", planRouter);
app.use("/api/invoice", invoiceRouter);
app.use("/api/app", appRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/sync", syncRouter);
app.use("/api/dashboard", adminDashboardRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
