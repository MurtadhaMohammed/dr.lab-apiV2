const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

const router = express.Router();
const prisma = new PrismaClient();

// 1 - Endpoint to create a serial
router.post("/create-serial", adminAuth, async (req, res) => {
  try {
    const { serial, exp } = req.body;
    const newSerial = await prisma.serial.create({
      data: {
        serial,
        exp,
      },
    });
    res.json(newSerial);
  } catch (error) {
    console.error("Error creating serial:", error);
    res.status(500).json({ error: "Could not create serial" });
  }
});

// 2 - Endpoint to register device by checking if serial is valid
router.post("/register-device", async (req, res) => {
  try {
    const { serial, device, platform } = req.body;
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
    });
    if (existingSerial) {
      if (existingSerial.device && existingSerial.device !== device) {
        res.status(404).json({ error: "Serial not valid" });
        return;
      }
      const updatedSerial = await prisma.serial.update({
        where: { id: parseInt(existingSerial?.id) },
        data: existingSerial.registeredAt
          ? {
              device,
              platform,
            }
          : {
              device,
              platform,
              registeredAt: dayjs().toISOString(),
            },
        include: { client: true },
      });
      res.json(updatedSerial);
    } else {
      res.status(404).json({ error: "Serial not found" });
    }
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({ error: "Could not register device" });
  }
});

// 6 - Endpoint to check if a serial has a client
router.get("/serial-has-client/:serialId", async (req, res) => {
  try {
    const { serialId } = req.params;
    const serial = await prisma.serial.findUnique({
      where: { id: parseInt(serialId) },
      include: { client: true },
    });
    if (serial && serial.client) {
      res.json({ serialId: serial.id });
    } else {
      res.status(404).json({ error: "Serial does not have a client" });
    }
  } catch (error) {
    console.error("Error checking serial client:", error);
    res.status(500).json({ error: "Could not check serial client" });
  }
});

router.put("/update-client", async (req, res) => {
  try {
    const { device, name, phone, email, address } = req.body;

    // Find the serial by the device ID
    const serial = await prisma.serial.findFirst({
      where: { device },
    });

    if (!serial) {
      return res.status(404).json({ error: "Serial not found" });
    }

    // Find the client associated with the serial
    const existingClient = await prisma.client.findUnique({
      where: { serialId: serial.id },
    });

    if (!existingClient) {
      return res
        .status(404)
        .json({ error: "Client not found for the given device" });
    }

    // Update the client details
    const updatedClient = await prisma.client.update({
      where: { id: existingClient.id },
      data: {
        name: name || existingClient.name,
        phone: phone || existingClient.phone,
        email: email || existingClient.email,
        address: address || existingClient.address,
      },
    });

    res.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Could not update client" });
  }
});
router.post("/register", async (req, res) => {
  const { serial, phone, name, email, address } = req.body;
  try {
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
    });

    if (!existingSerial || !existingSerial.active) {
      return res.status(400).json({ message: "Invalid or inactive serial" });
    }

    const existingClient = await prisma.client.findFirst({
      where: { phone },
    });

    if (existingClient) {
      return res.status(400).json({ message: "Client already exists" });
    }

    const newClient = await prisma.client.create({
      data: {
        name,
        phone,
        email,
        address,
        serialId: existingSerial.id,
      },
    });

    res.json(newClient);
  } catch (error) {
    console.error("Error registering client:", error);
    res.status(500).json({ error: "Could not register client" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { serialId } = req.body;
    const updatedSerial = await prisma.subscription.update({
      where: { serialId },
      data: { device: null },
    });
    res.json(updatedSerial);
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({ error: "Could not register device" });
  }
});
// Endpoint to check if a serial is expired
router.post("/check-serial-expiration", async (req, res) => {
  const { serialId } = req.body;
  try {
    const serial = await prisma.serial.findFirst({
      where: { id: serialId }, // Ensure you're using 'id' not 'serialId'
    });
    if (!serial) {
      return res.status(404).json({ message: "Serial not found" });
    }
    const expired = isSerialExpired(serial);
    res.json({ expired, serial });
  } catch (error) {
    console.error("Error checking serial expiration:", error);
    res.status(500).json({
      error: "An error occurred while checking the serial expiration",
    });
  }
});

function isSerialExpired(serial) {
  try {
    // Ensure registeredAt and exp fields are available
    if (!serial?.registeredAt || !serial?.exp) {
      return false;
    }

    // Calculate the expiration date by adding exp (in days) to registeredAt
    const expirationDate = new Date(serial.registeredAt);
    expirationDate.setDate(expirationDate.getDate() + serial.exp);

    // Get the current date
    const currentDate = new Date();

    // Compare the current date with the expiration date
    if (currentDate > expirationDate) {
      return true; // Serial has expired
    } else {
      return false; // Serial is still valid
    }
  } catch (error) {
    console.error("Error checking serial expiration:", error);
    throw error;
  }
}

router.post("/check-client", async (req, res) => {
  const { phone, serial } = req.body;
  try {
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
      include: {
        invoices: true,
      },
    });

    if (!existingSerial || !existingSerial.active) {
      return res.status(400).json({ message: "Invalid or inactive serial" });
    }

    const client = await prisma.client.findFirst({
      where: {
        phone: phone,
      },
    });

    if (
      existingSerial &&
      existingSerial.registeredAt &&
      existingSerial?.invoices[0]?.clientId !== parseInt(client?.id)
    ) {
      return res.status(400).json({ message: "Invalid or inactive serial2" });
    }

    if (client) {
      res.json({ success: true, client });
    } else {
      res.json({ success: false, message: "Client not found" });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while checking the client" });
  }
});





module.exports = router;
