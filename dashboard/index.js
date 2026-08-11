// Endpoints used by the admin dashboard only.
// Kept separate from ./routers so the existing client/app APIs stay untouched.
const express = require("express");

const labsRouter = require("./labs");
const usersRouter = require("./users");

const router = express.Router();

router.use("/labs", labsRouter);
router.use("/users", usersRouter);

module.exports = router;
