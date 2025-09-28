const { uploadToLinode } = require("./uploadToLinode");

const sendOtp = async (phone, otpCode, countryCode = "964") => {
  try {
    const phoneStr = String(phone);
    const formattedPhone = phoneStr.startsWith("0")
      ? `${countryCode}${phoneStr.substring(1)}`
      : `${countryCode}${phoneStr}`;

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
              },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                text: "/otp",
              },
            ],
          },
        ],
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
      // console.log(`Message sent successfully with ID: ${data.messages[0].id}`);
    } else if (data.error) {
      console.error("API Error:", data.error);
    }

    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw new Error("Failed to send WhatsApp message");
  }
};

const sendFileMsg = async (phone, name, labName, file, countryCode = "964") => {
  try {
    const url = await uploadToLinode(file, phone);
    const senderId = "142971062224854";

    if (!url) return { success: false, error: "Uploading Error!" };

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${senderId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `${countryCode}${phone}`,
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
                    text: labName,
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

    const data = await response.json();

    if (data?.messages[0]?.message_status === "accepted")
      return {
        success: true,
        url,
        senderId,
        message: "Message sent successfully",
      };
    else return { success: false, error: "Somthing Warng!" };
  } catch (error) {
    console.error("Error:", error);
    return {
      success: false,
      error: "An error occurred while sending the message",
    };
  }
};

module.exports = { sendOtp, sendFileMsg };
