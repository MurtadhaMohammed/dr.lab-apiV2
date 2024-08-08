const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

const router = express.Router();
const prisma = new PrismaClient();

// 1 - Endpoint to create a serial

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
    const { device, labName, name, phone, email, address } = req.body;

    // Find the serial by the device ID
    const client = await prisma.client.findFirst({
      where: { device },
      include: {
        client: true, // Include the client directly
      },
    });

    let existingClient;

    if (client) {
      existingClient = client;
    } else {
      // If no serial is found, find the client directly by the phone number
      existingClient = await prisma.client.findFirst({
        where: { phone },
      });

      if (!existingClient) {
        return res.status(404).json({ error: "Client not found" });
      }
    }


    // Update the client details
    const updatedClient = await prisma.client.update({
      where: { id: existingClient.id },
      data: {
        name: name || existingClient.name,
        labName: labName || existingClient.labName,
        phone: phone || existingClient.phone,
        email: email || existingClient.email,
        address: address || existingClient.address,
      },
    });

    res.json({ updatedClient });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Could not update client" });
  }
});

module.exports = router;

const generateUniqueSerial = async () => {
  let serial = Math.floor(10000000 + Math.random() * 90000000).toString();
  let existingSerial;

  do {
    existingSerial = await prisma.serial.findFirst({
      where: { serial },
    });
  } while (existingSerial);
  console.log(serial);

  return serial;
};

router.post("/register", async (req, res) => {
  const { phone, labName, name, email, address, device } = req.body;

  try {
    
    const existingClient = await prisma.client.findFirst({
      where: { phone },
    });
    
    const deviceId = await prisma.client.findFirst({
      where: { device },
    });
    
    if (existingClient) {
      return res.status(400).json({ message: "Client already exists" });
    }
    
    if (deviceId) {
      return res.status(400).json({ message: "Device already exists" });
    }
    const newSerial = await generateUniqueSerial();

    const createtrial = await prisma.serial.create({
      data: {
        serial: newSerial,
        exp: 7,
      },
    });

    const updatedSerial = await prisma.serial.update({
      where: { id: createtrial.id },
      data: {
        device,
        startAt: dayjs().toISOString(),
        registeredAt: dayjs().toISOString(),
      },
    });

    const newClient = await prisma.client.create({
      data: {
        name,
        labName,
        phone,
        email,
        address,
        device,
        type: "trial", // Set the client type to 'trial'
        serials: {
          connect: { id: createtrial.id },
        },
      },
    });

    res.status(200).json({success: true, client: newClient, serial: updatedSerial});
  } catch (error) {
    console.error("Error registering client:", error);
    res.status(500).json({ error: "Could not register client" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { serial } = req.body;

    // Find the serial by the serial number
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
    });

    if (!existingSerial) {
      return res.status(404).json({ error: "Serial not found" });
    }

    // Update the serial to remove the device
    const updatedSerial = await prisma.serial.update({
      where: { id: existingSerial.id },
      data: { device: null },
    });

    res.json(updatedSerial);
  } catch (error) {
    console.error("Error removing device from serial:", error);
    res.status(500).json({ error: "Could not remove device from serial" });
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
  const { serial, device, platform } = req.body;
  try {
    // Find the serial and include the related invoices and client data
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
      include: {
        invoices: true,
        client: true, // Include the client data directly
      },
    });

    // Check if the serial is valid and active
    if (!existingSerial || !existingSerial.active) {
      return res.status(400).json({ message: "Invalid or inactive serial" });
    }
    // Check if the serial has an associated client
    const client = existingSerial.client;

    if (client) {
      // Update the serial with device, platform, startAt and registeredAt information
      const updatedSerial = await prisma.serial.update({
        where: { id: existingSerial.id },
        data: {
          device,
          platform,
          startAt: dayjs().toISOString(),
          registeredAt: dayjs().toISOString(),
        },
      });
      await prisma.client.update({
        where: { id: client.id },
        data: {
          device,
        },
      });

      // Return the client data, updated serial, and serial details
      return res.json({
        success: true,
        client,
        updatedSerial,
      });
    } else {
      // Serial does not have an associated client
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while checking the client" });
  }
});

module.exports = router;
