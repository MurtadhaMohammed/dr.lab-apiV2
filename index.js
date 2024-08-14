const express = require("express");
var cors = require("cors");
const app = express();
const port = 3001;
const adminRouter = require("./routers/admin");
const appRouter = require("./routers/app");
const whatsappRouter = require("./routers/whatsapp");
const featureRouter = require("./routers/feature");
const dashboardRouter = require("./routers/dashboard");
const invoiceRouter = require("./routers/invoice");
const fileUpload = require("express-fileupload");

require("dotenv").config();

app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ msg: "hi All" });
});

app.use("/api/admin", adminRouter);
app.use("/api/app", appRouter);
app.use("/api/send", whatsappRouter);
app.use("/api/feature", featureRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/invoice", invoiceRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
