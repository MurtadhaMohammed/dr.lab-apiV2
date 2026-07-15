const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // console.log("Incoming request:", {
  //   method: req.method,
  //   url: req.url,
  //   headers: req.headers,
  //   body: req.body,
  // });

  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    // console.log("Access denied. No token provided.");
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !decoded.phone) {
      // console.log("Invalid token payload.");
      return res.status(400).json({ error: "Invalid token payload." });
    }

    req.user = decoded;
    // New (User-based) tokens carry clientId explicitly. Legacy (Client-based)
    // tokens don't — for those, `id` IS the Client's own id, so fall back to
    // it. This keeps every already-issued token working unchanged; the
    // desktop app is responsible for detecting isLegacyToken client-side and
    // forcing a fresh login through the new User-based flow.
    req.user.isLegacyToken = decoded.clientId == null;
    req.user.clientId = decoded.clientId ?? decoded.id;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(400).json({ error: "Invalid token." });
  }
};

module.exports = authMiddleware;
