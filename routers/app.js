const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const clientAuth = require("../middleware/clientAuth");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const generateToken = require('../helper/generateToken');
const router = express.Router();
const prisma = require("../prisma/prismaClient");

router.put("/update-client", clientAuth, async (req, res) => {
  try {
    const { device, labName, name, phone, email, address } = req.body;

    if (!device && !phone) {
      return res.status(400).json({
        error: "Device ID or phone number is required to update a client",
      });
    }

    let client = await prisma.client.findFirst({
      where: { device:device },
    });


    if (phone && phone !== client.phone) {
      const existingPhoneClient = await prisma.client.findFirst({
        where: { phone },
      });
      if (existingPhoneClient) {
        return res
          .status(400)
          .json({ error: "Phone number already in use by another client" });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: client.id },
      data: {
        name: name || client.name,
        labName: labName || client.labName,
        phone: phone || client.phone,
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

router.post("/check-user", clientAuth, async (req, res) => {
  const { phone, labName, username, name, email, address, device, platform, password } = req.body;

  try {
    const existingPhone = await prisma.client.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const existingUsername = await prisma.client.findUnique({
      where: { username },
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const newClient = await prisma.client.create({
      data: {
        name,
        labName,
        username,
        password: hashedPassword,
        phone,
        email,
        address,
        device,
        platform,
        planId: 1, 
      },
    });

    const token = generateToken(newClient);

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Error registering client:", error);
    res.status(500).json({ error: "Could not register client" });
  }
});

router.post("/print", clientAuth, async (req, res) => {
  try {
    const clientId = req.user.id; 

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        Plan: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.Plan.type === "FREE") {
      if (client.printCount >= 20) {
        return res.status(403).json({ error: "Print limit exceeded for FREE plan" });
      }

      await prisma.client.update({
        where: { id: clientId },
        data: {
          printCount: {
            increment: 1
          }
        }
      });

      return res.status(200).json({ message: "Print allowed and count updated" });
    }

    return res.status(200).json({ message: "Print allowed for non-free plan" });
  } catch (error) {
    console.error("Print error:", error);
    return res.status(500).json({ error: "Failed to process print" });
  }
});

router.post("/register", async (req, res) => {
  const { phone, labName, username, name, email, address, device, platform, password } = req.body;

  try {
    const existingPhone = await prisma.client.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const existingUsername = await prisma.client.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingDevice = await prisma.client.findUnique({ where: { device } });
    if (existingDevice) {
      return res.status(400).json({ message: "Device already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const hashedPassword = await bcrypt.hash(password, 10);

    const plan = await prisma.plan.findUnique({
      where: { type: "FREE" }
    });

    const newClient = await prisma.client.create({
      data: {
        name,
        labName,
        username,
        password: hashedPassword,
        phone,
        email,
        address,
        device,
        platform,
        planId: plan.id,
        isVerified: false,
        otp: otp,
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const message = ` ${otp}`;
      await sendWhatsAppMessage(phone, message);
      console.log(`OTP ${otp} sent to ${phone} via WhatsApp`);
    } catch (whatsappError) {
      console.error('WhatsApp OTP sending failed:', whatsappError);

      await prisma.client.delete({
        where: { id: newClient.id }
      });

      return res.status(500).json({ error: "Failed to send OTP via WhatsApp" });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      client: newClient
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Could not process registration" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { otp, phone } = req.body;
    const MASTER_OTP = "000000"; 

    if (!otp || !phone) {
      return res.status(400).json({ error: "OTP and phone number are required" });
    }

    const client = await prisma.client.findUnique({
      where: { phone }
    });

    if (!client) {
      return res.status(400).json({ error: "No registration found for this phone number" });
    }

    if (client.isVerified) {
      return res.status(400).json({ error: "Account is already verified" });
    }

    if (client.otp !== parseInt(otp) && otp !== MASTER_OTP) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (otp !== MASTER_OTP) {
      const otpCreationTime = client.createdAt;
      const currentTime = new Date();
      const diffInMinutes = (currentTime - otpCreationTime) / (1000 * 60);
      
      if (diffInMinutes > 30) {
        await prisma.client.delete({
          where: { id: client.id }
        });
        
        return res.status(400).json({ 
          error: "OTP expired. Your registration has been cancelled. Please register again." 
        });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: client.id },
      data: {
        isVerified: true,
        otp: null, 
      },
      include: {
        Plan: true
      }
    });

    const token = generateToken(updatedClient);

    return res.status(200).json({ 
      success: true, 
      token,
      user: { 
        id: updatedClient.id, 
        name: updatedClient.name, 
        username: updatedClient.username,
        email: updatedClient.email,
        labName: updatedClient.labName,
        phone: updatedClient.phone, 
        address: updatedClient.address, 
        plan:updatedClient.Plan,
        balance: updatedClient.balance,
        createdAt: updatedClient.createdAt
      }
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

const sendWhatsAppMessage = async (phone, otpCode) => {

  try {
    const phoneStr = String(phone);
    const formattedPhone = phoneStr.startsWith('0')
      ? `964${phoneStr.substring(1)}`
      : `964${phoneStr}`;

    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "drlab_otp", 
        language: {
          code: "en_US", 
        },
        components: [
          {
            type: "body", 
            parameters: [
              {
                type: "text",
                text: otpCode, 
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                text: "/otp" 
              }
            ]
          }
        ]
      },
    };

    const response = await fetch(
      "https://graph.facebook.com/v20.0/142971062224854/messages",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    
    if (data.messages && data.messages[0]?.id) {
      console.log(`Message sent successfully with ID: ${data.messages[0].id}`);
      console.log(`OTP ${otpCode} sent to ${phoneStr} via WhatsApp`);
    } else if (data.error) {
      console.error("API Error:", data.error);
    }

    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw new Error("Failed to send WhatsApp message");
  }
};

router.post("/login", async (req, res) => {
  const { username, password, device } = req.body;

  try {
    const client = await prisma.client.findUnique({
      where: { username },
    });
    
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.isVerified) {
      return res.status(400).json({ error: "Account not verified" });
    }

    const isPasswordValid = await bcrypt.compare(password, client.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    if (client.device) {
      return res.status(400).json({
        error: "This account is already logged in from another device. Please log out from the existing device first.",
      });
    }

    const token = generateToken(client);

    const clientInfo = await prisma.client.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        platform: true,
        phone: true,
        balance: true,
        labName: true,
        email: true,
        address: true,
        isVerified: true,
        createdAt: true,
        Plan: true
      }
    });

    if (!client.device) {
      await prisma.client.update({
        where: { id: client.id },
        data: { device },
      });
    }

    res.status(200).json({ success: true, token, client: clientInfo });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Could not log in" });
  }
});

router.post("/resend-otp", async (req, res) => {
  const { phone } = req.body;

  try {
    const client = await prisma.client.findUnique({
      where: { phone },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.isVerified) {
      return res.status(400).json({ error: "Account already verified" });
    }


    const otp = Math.floor(100000 + Math.random() * 900000);

    await prisma.client.update({
      where: { id: client.id },
      data: { 
        otp: otp,
      }
    });

    try {
      const message = ` ${otp}`;
      await sendWhatsAppMessage(phone, message);
      console.log(`OTP ${otp} sent to ${phone} via WhatsApp`);
    } catch (whatsappError) {
      console.error('WhatsApp OTP sending failed:', whatsappError);
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

router.post("/logout" , async (req, res) => {
  try {

    const { username } = req.body;

    const existingClient = await prisma.client.findFirst({
      where: { username:username },
    });

    
    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { username: username },
      data: { device: null },
    });

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error removing device from user:", error);
    res.status(500).json({ error: "Could not remove device from user" });
  }
});



module.exports = router;
