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

const fileUpload = require("express-fileupload");

require("dotenv").config();

app.set('trust proxy', true);
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
