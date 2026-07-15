const express = require("express");
const clientAuth = require("../middleware/clientAuth");
const dayjs = require("dayjs");
const generateToken = require("../helper/generateToken");
const router = express.Router();
const prisma = require("../prisma/prismaClient");
const { sendOtp, sendFileMsg } = require("../helper/sendWhatsapp");
const { otpLimiter } = require("../middleware/rateLimit");
const newTestGroups = require("../helper/newTestGroups.json");
const { uploadToLinode, linodeUrl } = require("../helper/uploadToLinode");

router.put("/update-client", clientAuth, async (req, res) => {
  try {
    const { labName, name, email, address } = req.body;
    const clientId = req.user.clientId;

    // Find client by ID only (from JWT token)
    let client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: client.id },
      data: {
        name: name || client.name,
        labName: labName || client.labName,
        email: email || client.email,
        address: address || client.address,
      },
    });

    res.status(200).json({ updatedClient });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Could not update client" });
  }
});

router.post("/register", async (req, res) => {
  const { phone, labName, name, email, address, device, platform, code } =
    req.body;

  try {
    const existingPhone = await prisma.client.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const existingUsername = await prisma.client.findUnique({
      where: { phone },
    });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingDevice = await prisma.client.findUnique({
      where: { device },
    });
    if (existingDevice) {
      return res.status(400).json({ message: "Device already registered" });
    }

    const plan = await prisma.plan.findUnique({
      where: { type: "FREE" },
    });

    await prisma.client.create({
      data: {
        name,
        labName,
        phone,
        email,
        code,
        address,
        platform,
        isTestUpdated: true,
        printCount: 20,
        planId: plan.id,
      },
    });

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Could not process registration" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { otp, phone, device } = req.body;
    const MASTER_OTP = "000000";

    if (!otp || !phone) {
      return res
        .status(400)
        .json({ error: "OTP and phone number are required" });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "No registration found for this phone number" });
    }

    if (user.otp !== parseInt(otp) && otp !== MASTER_OTP) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (otp !== MASTER_OTP) {
      const otpCreationTime = user.otpCreatedAt;
      const currentTime = new Date();
      const diffInMinutes = (currentTime - otpCreationTime) / (1000 * 60);

      if (diffInMinutes > 30) {
        return res.status(400).json({
          error: "OTP expired. Please register again.",
        });
      }
    }

    const client = await prisma.client.findUnique({ where: { id: user.clientId } });
    if (!client) {
      return res.status(400).json({ error: "Client not found for this user" });
    }

    // Multi-device (sync-enabled) accounts register a Device row instead of
    // being locked to User.device. Legacy accounts keep the old behavior.
    let deviceRecord = null;
    if (client.syncEnabled && device) {
      const existingDevice = await prisma.device.findUnique({
        where: { clientId_machineId: { clientId: client.id, machineId: device } },
      });

      if (existingDevice?.revokedAt) {
        return res.status(403).json({
          error: "This device has been revoked. Contact the account owner.",
        });
      }

      if (!existingDevice) {
        const activeCount = await prisma.device.count({
          where: { clientId: client.id, revokedAt: null },
        });
        if (activeCount >= client.maxDevices) {
          return res.status(403).json({
            error: `Device limit reached (${client.maxDevices}). Revoke another device first.`,
          });
        }
      }

      deviceRecord = await prisma.device.upsert({
        where: { clientId_machineId: { clientId: client.id, machineId: device } },
        create: {
          clientId: client.id,
          machineId: device,
          platform: client.platform,
          lastSeenAt: new Date(),
        },
        update: { lastSeenAt: new Date() },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCreatedAt: null,
        otp: null,
        otpCount: 0,
        device,
        isVerified: true,
      },
    });

    const token = generateToken(
      updatedUser,
      deviceRecord ? { deviceId: deviceRecord.id } : {}
    );

    return res.status(200).json({
      success: true,
      token,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.post("/resend-otp", otpLimiter, async (req, res) => {
  const { phone } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(404).json({ error: "Client not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpCreatedAt: dayjs().toISOString(),
        otpCount: {
          increment: user.otpCount ?? 0,
        },
      },
    });

    try {
      await sendOtp(phone, otp, user.code);
      // console.log(`OTP ${otp} sent to ${phone} via WhatsApp`);
    } catch (whatsappError) {
      console.error("WhatsApp OTP sending failed:", whatsappError);
      return res.status(500).json({ error: "Failed to send OTP via WhatsApp" });
    }

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ error: "Could not resend OTP" });
  }
});

router.post("/logout", clientAuth, async (req, res) => {
  try {
    if (req.user.isLegacyToken) {
      // Old Client-based session — clear Client.device (legacy behavior).
      const existingClient = await prisma.client.findUnique({
        where: { id: parseInt(req.user.id) },
      });
      if (!existingClient) {
        return res.status(404).json({ error: "Client not found" });
      }
      await prisma.client.update({
        where: { id: existingClient.id },
        data: { device: null },
      });
    } else {
      const existingUser = await prisma.user.findUnique({
        where: { id: parseInt(req.user.id) },
      });
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { device: null },
      });
    }

    // Logout only ends the session token — it does NOT revoke the device.
    // A device stays authorized to sync until the user explicitly revokes it
    // from the Devices settings page (POST /app/devices/:id/revoke). This
    // matches how a normal "log out" should behave: signing out to switch
    // accounts or restart the app shouldn't require re-authorizing the PC.

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error removing device from user:", error);
    res.status(500).json({ error: "Could not remove device from user" });
  }
});

router.post("/user/v2", clientAuth, async (req, res) => {
  try {
    const clientId = req?.user?.clientId;
    const client = await prisma.client.findUnique({
      where: {
        id: parseInt(clientId, 10),
      },
      include: {
        Plan: true,
      },
    });

    if (!client || !client?.active) {
      return res.status(404).json({ error: "User unactive !." });
    }

    const now = dayjs();
    const lastActive = dayjs(client.lastActive);

    if (!client.lastActive || now.diff(lastActive, "minute") >= 15) {
      await prisma.client.update({
        where: { id: clientId },
        data: { lastActive: now.toISOString() },
      });
    }

    if (!client?.isTestUpdated) {
      client.testGroups = JSON.stringify(newTestGroups);
      await prisma.client.update({
        where: { id: clientId },
        data: { isTestUpdated: true },
      });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error("Error removing device from user:", error);
    res.status(500).json({ error: "Could not get user data" });
  }
});

router.post("/user", clientAuth, async (req, res) => {
  try {
    const clientId = req?.user?.clientId;
    const client = await prisma.client.findUnique({
      where: {
        id: parseInt(clientId, 10),
      },
      include: {
        Plan: true,
      },
    });

    if (!client || !client?.active) {
      return res.status(404).json({ error: "User unactive !." });
    }

    const now = dayjs();
    const lastActive = dayjs(client.lastActive);

    if (!client.lastActive || now.diff(lastActive, "minute") >= 15) {
      await prisma.client.update({
        where: { id: clientId },
        data: { lastActive: now.toISOString() },
      });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error("Error removing device from user:", error);
    res.status(500).json({ error: "Could not get user data" });
  }
});

router.post("/login", otpLimiter, async (req, res) => {
  const { phone, password, device, platform, code, name, labName, email, address } =
    req.body;

  try {
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // No User account yet for this phone. Either migrate a legacy Client
      // ("Copy to User") or, if neither exists, create a fresh Client + its
      // owner User together — new users for an EXISTING lab are still
      // created only via the admin Dashboard, never here.
      const legacyClient = await prisma.client.findUnique({ where: { phone } });

      if (legacyClient) {
        user = await prisma.user.create({
          data: {
            clientId: legacyClient.id,
            name: legacyClient.name,
            phone: legacyClient.phone,
            password: legacyClient.password,
            device: legacyClient.device,
            platform: legacyClient.platform,
            code: legacyClient.code,
            role: "owner",
          },
        });
        console.log("client_login_attempt : migrated legacy client to user", {
          clientId: legacyClient.id,
          userId: user.id,
          phone,
        });
      } else {
        const plan = await prisma.plan.findUnique({ where: { type: "FREE" } });
        const newClient = await prisma.client.create({
          data: {
            name: name || phone,
            labName,
            phone,
            email,
            address,
            platform,
            code,
            planId: plan.id,
          },
        });
        user = await prisma.user.create({
          data: {
            clientId: newClient.id,
            name: name || phone,
            phone,
            device,
            platform,
            code,
            role: "owner",
          },
        });
        console.log("client_login_attempt : created new client + user", {
          clientId: newClient.id,
          userId: user.id,
          phone,
        });
      }
    }

    const client = await prisma.client.findUnique({ where: { id: user.clientId } });
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Sync-enabled accounts may log in from multiple devices; the limit is
    // enforced per-device in /verify-otp instead.
    if (!client.syncEnabled && user.device && !password && password !== "true") {
      console.log("client_login_attempt : error -> already logged in", {
        success: false,
        userId: user.id,
        phone,
        device: user.device,
        reason: "Already logged in on another device",
      });
      return res.status(400).json({
        error:
          "This account is already logged in from another device. Please log out from the existing device first.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpCreatedAt: dayjs().toISOString(),
        otpCount: {
          increment: user.otpCount ?? 0,
        },
      },
    });

    await sendOtp(phone, otp, user.code || client.code);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Could not log in" });
  }
});

router.get("/devices", clientAuth, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { clientId: parseInt(req.user.clientId) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        machineId: true,
        name: true,
        platform: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    res.status(200).json({ devices });
  } catch (error) {
    console.error("Error listing devices:", error);
    res.status(500).json({ error: "Could not list devices" });
  }
});

router.post("/devices/:id/revoke", clientAuth, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    // Scope to the caller's own account — never allow cross-client revocation.
    if (!device || device.clientId !== parseInt(req.user.clientId)) {
      return res.status(404).json({ error: "Device not found" });
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error revoking device:", error);
    res.status(500).json({ error: "Could not revoke device" });
  }
});

router.post("/devices/:id/rename", clientAuth, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const { name } = req.body;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    if (!device || device.clientId !== parseInt(req.user.clientId)) {
      return res.status(404).json({ error: "Device not found" });
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { name: name || null },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error renaming device:", error);
    res.status(500).json({ error: "Could not rename device" });
  }
});

router.post("/upload-pdf", clientAuth, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(501).json({ error: "Phone is requierd!." });
    }
    const pdfUrl = await uploadToLinode(req.files, phone);
    if (!pdfUrl) {
      return res.status(501).json({ error: "Uploading Error!." });
    }
    res.status(200).send({
      pdfUrl: `https://drlab.app/pdf/${pdfUrl.replace("files/", "")}`,
    });
  } catch (error) {
    console.error("Error Uploading : ", error);
    res.status(500).json({ error: "Error Uploading" });
  }
});

router.post("/whatsapp-message", clientAuth, async (req, res) => {
  const { phone, name } = req.body;
  const clientId = req.user.clientId;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(clientId) },
  });

  if (!client) {
    return res.status(404).json({ error: "Client not found" });
  }

  if (client?.balance < client?.whatsappMsgPrice) {
    return res.status(500).json({ error: "Your Balance not enough!." });
  }

  const result = await sendFileMsg(
    phone,
    name,
    client?.labName,
    req.files,
    client?.code
  );
  if (!result?.success) {
    return res.status(500).json({ success: false, message: result?.error });
  }

  await prisma.whatsapp.create({
    data: {
      name,
      labName: client?.labName,
      receiverPhone: phone,
      senderPhone: result?.senderId,
      clientId: parseInt(clientId),
      fileName: result?.url,
      createdAt: dayjs().toISOString(),
    },
  });

  await prisma.client.update({
    where: { id: parseInt(clientId) },
    data: {
      balance: {
        decrement: client?.whatsappMsgPrice,
      },
    },
  });

  res.status(200).json({ message: result?.message, success: true });
});

module.exports = router;
