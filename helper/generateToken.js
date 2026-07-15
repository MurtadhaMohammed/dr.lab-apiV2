const jwt = require("jsonwebtoken");

// Issues a token for a User row (the per-person login within a lab).
// clientId links back to the owning Client (the lab/tenant) — every
// clientAuth-protected route scopes data by req.user.clientId, not
// req.user.id (which is this User's own id).
const generateToken = (user, extra = {}) => {

  return jwt.sign(
    {
      id: user.id,
      clientId: user.clientId,
      role: user.role,
      username: user.username,
      device: user.device,
      fullName: user.name,
      phone: user.phone,
      ...extra
    },
    process.env.JWT_SECRET,
    { expiresIn: "1y" }
  );
};

module.exports = generateToken;
