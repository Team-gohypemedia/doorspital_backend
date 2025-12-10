const jwt = require("jsonwebtoken");
const User = require("../features/auth/model/user_model");

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is required",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Get user from database
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Middleware to check if user is admin
 */
const authorizeRoles = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. ${roles.join(" or ")} privileges required.`,
        });
      }

      next();
    } catch (error) {
      console.error("Role authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Authorization failed",
      });
    }
  };
};

const isAdmin = authorizeRoles(["admin"]);
const isAdminOrPharmacy = authorizeRoles(["admin", "pharmacy"]);
const isPharmacy = authorizeRoles(["pharmacy"]);

module.exports = {
  authenticate,
  isAdmin,
  isAdminOrPharmacy,
  isPharmacy,
};



