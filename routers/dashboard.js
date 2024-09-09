const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

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
router.patch("/client/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: { active },
    });
    res.json(updatedClient);
  } catch (error) {
    console.error("Error updating client activation:", error);
    res.status(500).json({ error: "Could not update client activation" });
  }
});

router.get("/unused-serials", async (req, res) => {
  try {
    const serials = await prisma.serial.findMany({
      where: { clientId: null },
    });
    res.json(serials);
  } catch (error) {
    console.error("Error fetching unused serials:", error);
    res.status(500).json({ error: "Could not fetch unused serials" });
  }
});

router.put("/edit-serial/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { serial, exp } = req.body;
    const updatedSerial = await prisma.serial.update({
      where: { id: parseInt(id) },
      data: { serial, exp },
    });
    res.json(updatedSerial);
  } catch (error) {
    console.error("Error updating serial:", error);
    res.status(500).json({ error: "Could not update serial" });
  }
}
);
// 4 - Endpoint to read all serials
router.get("/serials", async (req, res) => {
  try {
    const { search } = req.query;

    const serials = await prisma.serial.findMany({
      where: {
        serial: {
          contains: search,
          mode: "insensitive",
        },
      },
      include: {
        client: true,
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

//endpoint to reset to today serial startAt date

router.put("/activate-client/:id", async (req, res) => {
  try {
    const { serial } = req.body; // Expecting the actual serial string in the request body (optional)
    const { id } = req.params;

    // Find the client by ID
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        serials: true, // Include connected serials
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (serial) {
      // If a serial is provided, find the serial by its actual serial number
      const newSerial = await prisma.serial.findFirst({
        where: { serial },
      });

      if (!newSerial) {
        return res.status(404).json({ error: "Serial not found" });
      }

      // Update the start date of the new serial
      await prisma.serial.update({
        where: { id: newSerial.id },
        data: {
          startAt: dayjs().toISOString(),
        },
      });

      const createInvoice = await prisma.invoice.create({
        data: {
          clientId: parseInt(id),
          serialId: newSerial.id,
          type: "UPDATE",
          price: newSerial.price,
        },
      });

      res.json({ updatedClient: client, createInvoice }); 
    } else {
      // If no serials are connected and no serial is provided in the body, return an error
      return res.status(400).json({ error: "No serial provided and no connected serials found" });
    }
  } catch (error) {
    console.error("Error activating client:", error);
    res.status(500).json({ error: "Could not activate client" });
  }
});





// 5 - Endpoint to read all clients
router.get("/clients", async (req, res) => {
  try {
    const { name } = req.query;

    // Fetch clients with their associated serials and invoices
    const clients = await prisma.client.findMany({
      where: {
        name: { contains: name, mode: "insensitive" },
      },
      include: {
        serials: true,
        
      },
    });

    //map client with serials without invoice
    const clientsWithSerials = clients.map((client) => ({
      ...client,
      serials: client.serials.map((serial) => ({
        ...serial,
        
      })),
    }));

    res.json({ clients: clientsWithSerials });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Could not fetch clients" });
  }
});


// 7 - Endpoint to add a new client
router.post("/add-client", async (req, res) => {
  try {
    const { name, labName, phone, email, address, device, type } = req.body;

    const validTypes = ["trial", "basic","premium","enterprise"];
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
        device,
        type
      },
    });

    res.json(newClient);
  } catch (error) {
    console.error("Error adding client:", error);
    res.status(500).json({ error: "Could not add client" });
  }
});

router.put("/add-serial-to-client", async (req, res) => {
  try {
    const { clientId, serialId } = req.body;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const serial = await prisma.serial.findUnique({
      where: { id: serialId },
    });

    if (!serial) {
      return res.status(404).json({ error: "Serial not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        serials: {
          connect: { id: serialId },
        },
      },
    });

    res.json(updatedClient);
  } catch (error) {
    console.error("Error adding serial to client:", error);
    res.status(500).json({ error: "Could not add serial to client" });
  }
});

router.put("/update-client/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, labName, type, active, phone, email, address } = req.body;
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        name,
        labName,
        type,
        active,
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
  const { client, serial, device, phone, type } = req.body;
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

module.exports = router;
