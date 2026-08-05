const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");

const router = express.Router();

const planSelect = {
  id: true,
  name: true,
  type: true,
  price: true,
  printLimit: true,
  Active: true,
  createdAt: true,
};

router.get("/all", adminAuth, async (req, res) => {
  try {
    const plans = await prisma.plan.findMany();
    res.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Could not fetch plans" });
  }
});

router.post("/", adminAuth, async (req, res) => {
  try {
    const { name, type, price, printLimit, Active } = req.body;

    if (!name || !type || price === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newPlan = await prisma.plan.create({
      data: {
        name,
        type,
        price: parseInt(price),
        printLimit: printLimit === undefined || printLimit === null ? null : parseInt(printLimit),
        ...(Active === undefined ? {} : { Active }),
      },
      select: planSelect,
    });
    res.json(newPlan);
  } catch (error) {
    console.error("Error creating plan:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "A plan with this type already exists" });
    }
    res.status(500).json({ error: "Could not create plan" });
  }
});

router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, printLimit, Active } = req.body;

    const updatedPlan = await prisma.plan.update({
      where: { id: parseInt(id) },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(price === undefined ? {} : { price: parseInt(price) }),
        ...(printLimit === undefined
          ? {}
          : { printLimit: printLimit === null ? null : parseInt(printLimit) }),
        ...(Active === undefined ? {} : { Active }),
      },
      select: planSelect,
    });
    res.json(updatedPlan);
  } catch (error) {
    console.error("Error updating plan:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.status(500).json({ error: "Could not update plan" });
  }
});

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.plan.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting plan:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.status(500).json({ error: "Could not delete plan" });
  }
});

module.exports = router;
