const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/create-invoice", async (req, res) => {
    const { phone, serial, amount } = req.body;
  
    try {
      // Find the serial using the serial number
      const foundSerial = await prisma.serial.findFirst({
        where: { serial },
      });
  
      if (!foundSerial) {
        return res.status(404).json({ message: "Serial not found" });
      }
  
      // Find the client using the phone number
      const client = await prisma.client.findUnique({
        where: { phone },
      });
  
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
  
      // Connect the serial to the client
      await prisma.serial.update({
        where: { id: foundSerial.id },
        data: { clientId: client.id },
      });
  
      // Create the invoice and connect it to the client and serial
      const newInvoice = await prisma.invoice.create({
        data: {
          amount,
          clientId: client.id, // Use the found client's ID
          serialId: foundSerial.id, // Use the found serial's ID
        },
      });
  
      // Update the client type to 'paid' if not already 'paid'
      if (client.type === 'trial') {
        await prisma.client.update({
          where: { phone },
          data: { type: 'paid' },
        });
      }
  
      res.json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Could not create invoice" });
    }
  });
  

router.get("/invoice", async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        client: true,
        serial: true,
      },
    });

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Could not fetch invoices" });
  }
});

module.exports = router;
