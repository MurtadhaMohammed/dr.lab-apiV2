const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");

const router = express.Router();

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
    const { name, price, whatsappLimit, printLimit } = req.body;
    const newPlan = await prisma.plan.create({
      data: {
        name,
        price,
        whatsappLimit,
        printLimit
      },
      select: {
        id: true,
        name: true,
        price: true,
        whatsappLimit: true,
        printLimit: true
      }
    });
    res.json(newPlan);
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(500).json({ error: "Could not create plan" });
  }
});

router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, whatsappLimit, printLimit } = req.body;
    const updatedPlan = await prisma.plan.update({
      where: { id: parseInt(id) },
      data: {
        name,
        price,
        whatsappLimit,
        printLimit
      },
      select: {
        id: true,
        name: true,
        price: true,
        whatsappLimit: true,
        printLimit: true
      }
    });
    res.json(updatedPlan);
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({ error: "Could not update plan" });
  }
});

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.plan.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(500).json({ error: "Could not delete plan" });
  }
});

module.exports = router; 