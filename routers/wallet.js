const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");

const router = express.Router();

router.get("/all", adminAuth, async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            labName: true,
            balance: true,
            Plan: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(wallets);
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ error: "Could not fetch wallets" });
  }
});


router.delete("/:id",adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
  
      const wallet = await prisma.wallet.findUnique({
        where: { id: parseInt(id) },
        select: {
          amount: true,
          clientId: true
        }
      });
  
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  
      await prisma.$transaction([
        prisma.client.update({
          where: { id: wallet.clientId },
          data: {
            balance: {
              decrement: wallet.amount
            }
          }
        }),
        prisma.wallet.delete({
          where: { id: parseInt(id) }
        })
      ]);
  
      res.json({ message: "Wallet entry deleted and balance updated successfully" });
    } catch (error) {
      console.error("Error deleting wallet:", error);
      res.status(500).json({ error: "Could not delete wallet" });
    }
  });
  
  

module.exports = router;
