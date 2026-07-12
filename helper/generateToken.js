const jwt = require("jsonwebtoken");

const generateToken = (client, extra = {}) => {

  return jwt.sign(
    {
      id: client.id,
      username: client.username,
      device: client.device,
      labName: client.labName,
      fullName: client.name,
      email: client.email,
      phone: client.phone,
      plan: client.plan,
      address: client.address,
      ...extra
    },
    process.env.JWT_SECRET,
    { expiresIn: "1y" } 
  );
};

module.exports = generateToken;