const express = require("express");
const { PrismaClient } = require("@prisma/client");
// const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");
const shortid = require("shortid");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
// const AWS = require("aws-sdk");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// const AWS = require("aws-sdk");

//4VprTapVdABKFsPf8re8dUEdRiA0jyKGrEERE6JT

const router = express.Router();
const prisma = new PrismaClient();

// const s3 = new AWS.S3({
//   accessKeyId: "YIV0FZNI8VLMWPVYF4A4", // Replace with your Access Key
//   secretAccessKey: "4VprTapVdABKFsPf8re8dUEdRiA0jyKGrEERE6JT", // Replace with your Secret Key
//   endpoint: "https://us-east-1.linodeobjects.com", // Linode Object Storage endpoint
//   s3ForcePathStyle: true, // Required for Linode Object Storage
//   signatureVersion: "v4", // Required for S3-compatible services
// });

const s3Client = new S3Client({
  region: "us-east-1", // Replace with your region
  credentials: {
    accessKeyId: "EIY10XXI3SVFYW5QEF4D", // Replace with your Access Key
    secretAccessKey: "4VprTapVdABKFsPf8re8dUEdRiA0jyKGrEERE6JT", // Replace with your Secret Key
  },
  endpoint: "https://drlab.us-east-1.linodeobjects.com", // Linode Object Storage endpoint
  forcePathStyle: true, // Required for S3-compatible storage
});

const uploadToLinode = async (files, phone) => {
  if (!files || Object.keys(files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const file = files.file;
  const bucketName = "files"; // Replace with your bucket name
  const objectName = `${phone}-${shortid.generate().slice(0, 6)}`; // Generate the file name

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectName,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: "public-read", // Make the file publicly accessible
    });

    await s3Client.send(command);

    const fileUrl = `${bucketName}/${objectName}`;
    return fileUrl;
  } catch (error) {
    console.error("File upload failed:", error);
  }
};

router.get("/whatsapp", async (req, res) => {
  try{
    const whatsapp = await prisma.whatsapp.findMany();
    res.status(200).json(whatsapp);
  }catch(error){
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Could not fetch messages" });
  }
});

router.post("/whatsapp-message", async (req, res) => {
  const { clientId, phone, name, lab, senderPhone } = req.body;
  
  try {
    const url = await uploadToLinode(req.files, phone);
    if (!url) {
      return res.status(500).json({ message: "Uploading Error!" });
    }

    const whatsapp = await prisma.whatsapp.create({
      data: {
        name,
        labName: lab,
        receiverPhone: phone,
        senderPhone,
        clientId: parseInt(clientId),
        fileName: url,
        createdAt: dayjs().toISOString(),
      },
    });

    const response = await fetch(
      "https://graph.facebook.com/v20.0/142971062224854/messages",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `964${phone}`,
          type: "template",
          template: {
            name: "lab",
            language: {
              code: "ar",
            },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "text",
                    text: name,
                  },
                ],
              },
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: lab,
                  },
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  {
                    type: "text",
                    text: url,
                  },
                ],
              },
            ],
          },
        }),
      }
    );

    const resp = await response.json({ whatsapp });
    res.status(200).json({ message: "Message sent successfully", resp });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred while sending the message" });
  }
});

router.get("/whatsapp-count/:clientId", async (req, res) => {
  const clientId = parseInt(req.params.clientId);

  if (isNaN(clientId)) {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const firstSerial = await prisma.serial.findFirst({
      where: { clientId: clientId },
      orderBy: { startAt: 'asc' },
    });

    if (!firstSerial) {
      return res.status(404).json({ error: "No serial found for the client" });
    }

    let count = 0; 

      const start = dayjs(firstSerial.startAt).startOf('month');
      const end = start.endOf('month');

      count = await prisma.whatsapp.count({
        where: {
          clientId: clientId,
          createdAt: {
            gte: start.toDate(),
            lt: end.toDate(),
          },
        },
      });
    

    res.json({ clientId, count });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred while counting messages" });
  }
});

router.get("/whatsapp-messages", async (req, res) => {
  try {
    const messages = await prisma.whatsapp.findMany();
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Could not fetch messages" });
  }
});

// router.post("/whatsapp-message", async (req, res) => {
//   const { phone, name, lab } = req.body; // Extract 'to' and 'link' from the request body

//   let url = await uploadToLinode(req.files);

//   console.log(phone, name, lab, url);
//   if (!url) res.status(500).json({ massege: "Uploading Error!" });

//   try {
//     //return a ok if file recevede
//     res.status(200).json({ url });
//     const response = await fetch(
//       "https://graph.facebook.com/v20.0/142971062224854/messages",
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           messaging_product: "whatsapp",
//           to: `964${phone}`,
//           type: "template",
//           template: {
//             name: "lab",
//             language: {
//               code: "ar",
//             },
//             components: [
//               {
//                 type: "header", // This is the body component of the template
//                 parameters: [
//                   {
//                     type: "text",
//                     text: name, // Replace with your variable
//                   },
//                 ],
//               },
//               {
//                 type: "body", // This is the body component of the template
//                 parameters: [
//                   {
//                     type: "text",
//                     text: lab, // Replace with your variable
//                   },
//                 ],
//               },
//               {
//                 type: "button",
//                 sub_type: "url", // Specifies that this is a URL button
//                 index: "0", // Index of the button (starts from 0)
//                 parameters: [
//                   {
//                     type: "text",
//                     text: url, // Replace with the actual URL for the button
//                   },
//                 ],
//               },
//             ],
//           },
//         }),
//       }
//     );

//     const data = await response.json();
//     res.status(200).json(data); // Respond with the data received from the API
//   } catch (error) {
//     console.error("Error:", error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while sending the message" });
//   }
// });

module.exports = router;
