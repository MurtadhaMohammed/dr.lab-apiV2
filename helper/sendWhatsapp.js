const sendOtp = async (phone, otpCode) => {
  try {
    const phoneStr = String(phone);
    const formattedPhone = phoneStr.startsWith("0")
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
      console.log(`Message sent successfully with ID: ${data.messages[0].id}`);
    } else if (data.error) {
      console.error("API Error:", data.error);
    }

    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw new Error("Failed to send WhatsApp message");
  }
};

module.exports = { sendOtp };
