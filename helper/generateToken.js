const jwt = require("jsonwebtoken");

const generateToken = (client) => {
  return jwt.sign(
    {
      id: client.id,
      username: client.username,
      device: client.device,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1y" } 
  );
};

module.exports = generateToken;