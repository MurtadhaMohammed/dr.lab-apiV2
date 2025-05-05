const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");
const dayjs = require("dayjs");

const router = express.Router();

router.get("/all", adminAuth, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        type: true,
        price: true,
        createdAt: true,
        client: {
          select: {
            name: true,
            labName: true
          }
        },
        Plan: {
          select: {
            name: true
          }
        }
        
      },
      orderBy: {
        createdAt: 'desc', 
      }
    });
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Could not fetch invoices" });
  }
});

router.get("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        type: true,
        price: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            labName: true,
            phone: true
          }
        },
        Plan: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    });
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Could not fetch invoice" });
  }
});

router.post("/", adminAuth, async (req, res) => {
  try {
    const { type, price, clientId, planId } = req.body;

    if (!clientId || !planId || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: parseInt(planId) }
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const newInvoice = await prisma.invoice.create({
      data: {
        type,
        price: price || plan.price,
        client: {
          connect: { id: parseInt(clientId) }
        },
        Plan: {
          connect: { id: parseInt(planId) }
        }
      },
      include: {
        client: true,
        Plan: true
      }
    });

    res.json({ message: "Invoice created successfully", invoice: newInvoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Could not create invoice" });
  }
});

// Update invoice
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, price, clientId, planId } = req.body;
    const updatedInvoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: {
        type,
        price,
        clientId,
        planId
      },
      select: {
        id: true,
        type: true,
        price: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            labName: true
          }
        },
        Plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    res.json(updatedInvoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: "Could not update invoice" });
  }
});

// Delete invoice
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.invoice.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Could not delete invoice" });
  }
});

module.exports = router;
