const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Log the incoming request details
  console.log("Incoming request:", {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });

  const token = req.header("Authorization")?.replace("Bearer ", "");
  console.log("Token received:", token); // Log the token

  if (!token) {
    console.log("Access denied. No token provided."); // Log access denial
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded); // Log the decoded token

    if (!decoded.id || !decoded.username || !decoded.device) {
      console.log("Invalid token payload."); // Log invalid payload
      return res.status(400).json({ error: "Invalid token payload." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error verifying token:", error); // Log any errors during verification
    res.status(400).json({ error: "Invalid token." });
  }
};

module.exports = authMiddleware;