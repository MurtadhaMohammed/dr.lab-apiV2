const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const prisma = new PrismaClient();

// 1 - Endpoint to create a serial
router.post("/create-serial", async (req, res) => {
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

// 7 - Endpoint to add a new client
router.post("/add-client", async (req, res) => {
  try {
    const { name, labName, phone, email, address, serialId, type } = req.body;

    const validTypes = ["trial", "paid"];
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
        type:type === "trial" ? "trial" : "paid",
      },
    });

    res.json(newClient);
  } catch (error) {
    console.error("Error adding client:", error);
    res.status(500).json({ error: "Could not add client" });
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

router.post("/register-invoice", async (req, res) => {
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
          registeredAt: dayjs().toISOString(), 
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
