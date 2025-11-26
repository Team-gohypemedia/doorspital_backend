/**
 * POST /api/auth/sign-out
 * Since we are using stateless JWTs, signing out is handled client-side by
 * deleting the token. This endpoint exists so the client can still call an API
 * and we can perform any future bookkeeping (token blacklist, device tracking, etc.).
 */
const signOut = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Sign out error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { signOut };


