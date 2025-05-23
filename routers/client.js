const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const bcrypt = require("bcryptjs");
const prisma = require("../prisma/prismaClient");

const router = express.Router();

router.get("/all", adminAuth, async (req, res) => {
  try {
    const take = parseInt(req.query.take || 10);
    const skip = parseInt(req.query.skip || 0);
    const q = req.query.q || "";

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { labName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const total = await prisma.client.count({ where });

    const clients = await prisma.client.findMany({
      where,
      take,
      skip,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        username: true,
        platform: true,
        phone: true,
        labName: true,
        email: true,
        address: true,
        active: true,
        device: true,
        Plan: true,
        balance: true,
        createdAt: true,
      },
    });

    res.status(200).json({ data: clients, total });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Could not fetch clients" });
  }
});

router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      labName,
      phone,
      email,
      address,
      device,
      type,
    } = req.body;

    if (!name || !username || !password || !phone || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plan = await prisma.plan.findUnique({
      where: { type: type },
    });
    if (!plan) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const existingUsername = await prisma.client.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingPhone = await prisma.client.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    if (device) {
      const existingDevice = await prisma.client.findUnique({
        where: { device },
      });
      if (existingDevice) {
        return res.status(400).json({ error: "Device already registered" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newClient = await prisma.client.create({
      data: {
        name,
        username,
        password: hashedPassword,
        labName,
        phone,
        email,
        address,
        device,
        planId: plan.id,
      },
    });

    res
      .status(200)
      .json({ success: true, message: "client created successfully" });
  } catch (error) {
    console.error("Error creating client:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Unique constraint violation" });
    }
    res.status(500).json({ error: "Could not create client" });
  }
});

router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, labName, phone, email, address, device, type, active } =
      req.body;

    const existingClient = await prisma.client.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    let plan = null;

    if (type) {
      plan = await prisma.plan.findUnique({
        where: { type },
      });
      if (!plan) {
        return res.status(400).json({ error: "Invalid plan type" });
      }
    }

    if (phone && phone !== existingClient.phone) {
      const existingPhone = await prisma.client.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        return res.status(400).json({ error: "Phone number already exists" });
      }
    }

    if (device && device !== existingClient.device) {
      const existingDevice = await prisma.client.findUnique({
        where: { device },
      });
      if (existingDevice) {
        return res.status(400).json({ error: "Device already registered" });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        name,
        labName,
        phone,
        email,
        address,
        device,
        planId: type ? plan.id : existingClient.planId,
        active,
      },
    });

    console.log(updatedClient);

    res.status(200).json({ message: "Client updated!" });
  } catch (error) {
    console.error("Error updating client:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Unique constraint violation" });
    }
    res.status(500).json({ error: "Could not update client" });
  }
});

router.put("/add-balance/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const amount = parseFloat(req.body.balance);

    if (!amount || isNaN(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number" });
    }

    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        Plan: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.Plan.type === "FREE") {
      return res
        .status(400)
        .json({ error: "Free Plan clients cannot receive balance" });
    }

    const [updatedClient, newWallet] = await prisma.$transaction([
      prisma.client.update({
        where: { id: parseInt(id) },
        data: {
          balance: {
            increment: amount,
          },
        },
      }),
      prisma.wallet.create({
        data: {
          clientId: parseInt(id),
          amount: amount,
          type: "BALANCE",
          whatsappMsgPrice: client.whatsappMsgPrice ?? 0.05,
          createdAt: new Date(),
        },
      }),
    ]);

    res.status(200).json({
      message: "Balance added and wallet entry created",
      balance: updatedClient.balance,
    });
  } catch (error) {
    console.error("Error adding balance:", error);
    res.status(500).json({ error: "Could not update balance" });
  }
});

router.put("/reset-password/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.client.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Could not update password" });
  }
});

router.put("/toggle-status/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        active: !client.active,
      },
    });

    res.status(200).json({ message: "client status updated successfully" });
  } catch (error) {
    console.error("Error toggling client status:", error);
    res.status(500).json({ error: "Could not toggle client status" });
  }
});

module.exports = router;
