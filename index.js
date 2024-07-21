const express = require("express");
var cors = require("cors");
const app = express();
const port = 3000;
const adminRouter = require("./routers/admin");
const clientRouter = require('./routers/client');


require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ msg: "hi All" });
});

app.use("/api/admin", adminRouter);
app.use('/api/client', clientRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
