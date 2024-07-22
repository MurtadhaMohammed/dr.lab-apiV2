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
        exp: Number(30),
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
    const { serial, device } = req.body;
    const existingSerial = await prisma.serial.findUnique({
      where: { serial },
    });
    if (existingSerial) {
      if (existingSerial.device && existingSerial.device !== device) {
        res.status(404).json({ error: "Serial not valid" });
        return;
      }
      const updatedSerial = await prisma.serial.update({
        where: { serial },
        data: existingSerial.registeredAt
          ? {
              device,
            }
          : {
              device,
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

// 3 - Endpoint to activate/deactivate a serial
router.patch("/serial/:id/activate", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const updatedSerial = await prisma.serial.update({
      where: { id: parseInt(id) },
      data: { active },
    });
    res.json(updatedSerial);
  } catch (error) {
    console.error("Error updating serial activation:", error);
    res.status(500).json({ error: "Could not update serial activation" });
  }
});

// 4 - Endpoint to read all serials
router.get("/serials", adminAuth, async (req, res) => {
  try {
    const serials = await prisma.serial.findMany();
    res.json(serials);
  } catch (error) {
    console.error("Error fetching serials:", error);
    res.status(500).json({ error: "Could not fetch serials" });
  }
});

// 5 - Endpoint to read all clients
router.get("/clients", adminAuth, async (req, res) => {
  try {
    const clients = await prisma.client.findMany();
    res.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Could not fetch clients" });
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

// 7 - Endpoint to add a new client
router.post("/add-client", async (req, res) => {
  try {
    const { name, phone, email, address, serialId } = req.body;
    const newClient = await prisma.client.create({
      data: {
        name,
        phone,
        email,
        address,
        serialId,
      },
    });
    res.json(newClient);
  } catch (error) {
    console.error("Error adding client:", error);
    res.status(500).json({ error: "Could not add client" });
  }
});

router.put("/update-client", async (req, res) => {
  try {
    const { name, phone, email, address, serialId } = req.body;
    const newClient = await prisma.client.create({
      data: {
        name,
        phone,
        email,
        address,
        serialId,
      },
    });
    res.json(newClient);
  } catch (error) {
    console.error("Error adding client:", error);
    res.status(500).json({ error: "Could not add client" });
  }
});

router.put("/update-client", async (req, res) => {
  try {
    const { device, name, phone, email, address } = req.body;

    // Find the serial by the device ID
    const serial = await prisma.serial.findUnique({
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

router.post("/logout", async (req, res) => {
  try {
    const { serialId } = req.body;
    const updatedSerial = await prisma.serial.update({
      where: { id: serialId },
      data: { device: null },
    });
    res.json(updatedSerial);
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({ error: "Could not register device" });
  }
});

module.exports = router;
