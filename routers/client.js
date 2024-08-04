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

// router.post("/check-client", async (req, res) => {
//   try {
//     const { phone } = req.body;
//     const client = await prisma.client.findFirst({
//       where: { phone },
//     });

//     if (client) {
//       res.status(200).json({ client, success: "Phone number is registered" });
//     } else {
//       res.status(404).json({ error: "Phone number is not registered" });
//     }
//   } catch (error) {
//     console.error("Error checking client registration:", error);
//     res.status(500).json({ error: "Could not check client registration" });
//   }
// });

// router.post("/register", async (req, res) => {
//   try {
//     const { device, platform, serialId, clientId } = req.body;
//     const newSubscription = await prisma.subscription.create({
//       data: {
//         device,
//         platform,
//         serialId,
//         clientId,
//       },
//     });
//     res.json(newSubscription);
//   } catch (error) {
//     console.error("Error registering device:", error);
//     res.status(500).json({ error: "Could not register device" });
//   }
// });

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
router.get("/serials", async (req, res) => {
  try {
    const serials = await prisma.serial.findMany({
      include: {
        client: true,
        invoices: true,
      },
    });

    const serialsWithDetails = serials?.map((serial) => ({
      ...serial,
      feature: serial?.feature,
    }));

    res.json(serialsWithDetails);
  } catch (error) {
    console.error("Error fetching serials:", error);
    res.status(500).json({ error: "Could not fetch serials" });
  }
});

router.put("/add-feature-to-serial", adminAuth, async (req, res) => {
  try {
    const { serialId, featureId } = req.body;

    // Fetch the serial
    const serial = await prisma.serial.findUnique({
      where: { id: serialId },
    });

    if (!serial) {
      return res.status(404).json({ error: "Serial not found" });
    }

    // Fetch the feature data from another table
    const featureData = await prisma.feature.findUnique({
      where: { id: featureId },
    });

    if (!featureData) {
      return res.status(404).json({ error: "Feature not found" });
    }

    // Update the serial with the new feature
    const updatedSerial = await prisma.serial.update({
      where: { id: serialId },
      data: {
        feature: {
          id: featureData.id,
          name: featureData.name,
          note: featureData.note,
          startDate,
          endDate,
          price: featureData.price,
        },
      },
    });

    res.json(updatedSerial);
  } catch (error) {
    console.error("Error adding feature to serial:", error);
    res.status(500).json({ error: "Could not add feature to serial" });
  }
});

// 5 - Endpoint to read all clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        serials: true,
        invoices: true,
      },
    });

    const clientsWithSerials = clients.map((client) => ({
      ...client,
      serials: client.invoices.map((invoice) => invoice.serialId),
    }));

    res.json(clientsWithSerials);
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
    const { name, labName, phone, email, address, serialId, type } = req.body;

    // Validate `type` to ensure it is a valid `ClientType`
    const validTypes = ["trail", "paid"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid client type" });
    }

    // Create a new client
    const newClient = await prisma.client.create({
      data: {
        name,
        labName,
        phone,
        email,
        address,
        type, // Ensure type is one of the valid enum values

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

router.put("/update-client/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        name,
        phone,
        email,
        address,
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

router.post("/register", async (req, res) => {
  const { client, serial, device, phone ,type} = req.body;
  try {
    // Check if the serial is valid and active
    const existingSerial = await prisma.serial.findFirst({
      where: { serial },
    });

    let existingClient = await prisma.client.findFirst({
      where: { phone },
    });

    if (!existingSerial || !existingSerial.active) {
      return res.status(400).json({ message: "Invalid or inactive serial" });
    }

    // Check if the serial is already registered
    const existingInvoice = await prisma.invoice.findFirst({
      where: { serialId: existingSerial.id },
      include: {
        serial: true,
        client: true,
      },
    });

    if (existingInvoice && existingInvoice.device !== device) {
      return res
        .status(400)
        .json({ message: "Serial number is already registered" });
    }

    if (
      existingInvoice &&
      existingInvoice.device === device &&
      !isSerialExpired(existingSerial)
    ) {
      return res.json(existingInvoice);
    }

    if (
      existingInvoice &&
      !existingInvoice.device &&
      !isSerialExpired(existingSerial) &&
      existingInvoice.client.phone === phone
    ) {
      return res.json(existingInvoice);
    }

    if (!existingClient) {
      existingClient = await prisma.client.create({
        data: client,
      });
    }

    if (!device) {
      return res.status(400).json({ message: "Invalid or missing data" });
    }

    const updateSerial = await prisma.serial.update({
      where: { id: parseInt(existingSerial.id) },
      data: {
        registeredAt: dayjs().toISOString(), // Set registeredAt to the current date and time
      },
    });

    const createInvoice = await prisma.invoice.create({
      data: {
        clientId: parseInt(existingClient.id),
        serialId: parseInt(updateSerial.id),
        type,
        price: existingSerial.price, 
        device,
      },
      include: {
        serial: true,
        client: true, 
      },
    });

    res.json(createInvoice);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "An error occurred while checking the client" });
  }
});


// Endpoint to fetch all subscriptions
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany;
    const q = req.query.q;
    ({
      include: {
        client: true,
        serial: true,
      },
    });

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Could not fetch invoice" });
  }
});

module.exports = router;
