const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  console.log("Incoming request:", {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });

  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    console.log("Access denied. No token provided.");
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !decoded.phone) {
      console.log("Invalid token payload.");
      return res.status(400).json({ error: "Invalid token payload." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(400).json({ error: "Invalid token." });
  }
};

module.exports = authMiddleware;
