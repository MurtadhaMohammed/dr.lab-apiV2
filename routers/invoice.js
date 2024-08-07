const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/create-invoice", async (req, res) => {
  const { serial, price } = req.body;
  const { name, labName, phone, email, address, type } = req.body;


  try {
    // Find the serial using the serial number
    const foundSerial = await prisma.serial.findFirst({
      where: { serial },
    });

    if (!foundSerial) {
      return res.status(404).json({ message: "Serial not found" });
    }

    const newClient = await prisma.client.create({
      data: {
        name,
        labName,
        phone,
        email,
        address,
        type: "paid",
      },
    });

    // Connect the serial to the client
    await prisma.serial.update({
      where: { id: foundSerial.id },
      data: { clientId: newClient.id },
    });

    // Create the invoice and connect it to the client and serial
    const newInvoice = await prisma.invoice.create({
      data: {
        price,
        clientId: newClient.id, // Use the found client's ID
        serialId: foundSerial.id, // Use the found serial's ID
      },
    });

    res.json(newInvoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Could not create invoice" });
  }
});

router.get("/invoices", async (req, res) => {
  try {
    const { name, phone, serial } = req.query;

    const invoices = await prisma.invoice.findMany({
      where: {
        client: { phone: { contains: phone, mode: "insensitive" } },
      },
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
