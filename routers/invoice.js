const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

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

    const usedSerial = await prisma.serial.findFirst({
      //if serial id is not null
      where: { serial, clientId: { not: null } },
    });
    if (usedSerial) {
      return res.status(400).json({ message: "Serial already in use" });
    }
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

//endpoint to create a resub invoice through invoice id and then reset serial startAt to today and create a type UPDATE invoice
router.post("/resub-invoice/:id", async (req, res) => {
  const { price,note } = req.body;
  const invoiceId = req.params;

  try {
    // Find the invoice using the invoice ID
    const foundInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId },
    });

    if (!foundInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Find the client using the client ID
    const foundClient = await prisma.client.findFirst({
      where: { id: foundInvoice.clientId },
    });

    if (!foundClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Find the serial using the serial ID
    const foundSerial = await prisma.serial.findFirst({
      where: { id: foundInvoice.serialId },
    });

    if (!foundSerial) {
      return res.status(404).json({ message: "Serial not found" });
    }

    // Create a new invoice with the same client and serial
    const newInvoice = await prisma.invoice.create({
      data: {
        price,
        note,
        clientId: foundClient.id,
        serialId: foundSerial.id,
        type: "UPDATE",
      },
    });

    // Update the serial to reset the startAt date to today
    await prisma.serial.update({
      where: { id: foundSerial.id },
      data: { startAt: dayjs().toISOString() },
    });

    res.json(newInvoice);
  } catch (error) {
    console.error("Error resubmitting invoice:", error);
    res.status(500).json({ error: "Could not resubmit invoice" });
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