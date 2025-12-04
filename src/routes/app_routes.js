const express = require("express");
const router = express.Router();

// Auth controllers
const signUpController = require("../features/auth/controller/sign_up");
const signInController = require("../features/auth/controller/sign_in");
const forgotPasswordController = require("../features/auth/controller/forgot_password/forgot_password_send_otp");
const forgotPasswordVerifyOtpController = require("../features/auth/controller/forgot_password/forgot_password_verify_otp");
const resetPasswordController = require("../features/auth/controller/forgot_password/reset_password");
const googleSignController = require("../features/auth/controller/google_signin/google_signin");
const adminSignUpController = require("../features/auth/controller/admin_signup");
const signOutController = require("../features/auth/controller/sign_out");
const healthArticleController = require("../features/health_article/controller/health_article_controller");
const doctorController = require("../features/doctors/controller/doctors_controller");
const doctorVerificationController = require("../features/doctors/controller/doctor_verification_controller");
const doctorVerificationAdminController = require("../features/doctors/controller/doctor_verification_admin_controller");
const availabilityController = require("../features/doctors/controller/availability_controller");
const appointmentController = require("../features/doctors/controller/appointment_controller");
const profileController = require("../features/profile/controller/profile_controller");
const notificationsController = require("../features/notifications/controller/notifications_controller");
const chatController = require("../features/chat/controller/chat_controller");
const pharmacyProductController = require("../features/pharmacy/controller/pharmacy_product_controller");
const pharmacyOrderController = require("../features/pharmacy/controller/pharmacy_order_controller");
const adminController = require("../features/admin/controller/admin_controller");
const { doctorVerificationUpload, patientDocumentUpload, pharmacyProductUpload } = require("../utils/upload_config");
const { authenticate, isAdmin } = require("../middleware/auth_middleware");

router.post("/auth/sign-up", signUpController.signUp);
router.post("/auth/sign-in", signInController.signIn);
router.post("/auth/forgot-password-send-otp", forgotPasswordController.forgotPasswordSendOtp);
router.post("/auth/forgot-password-verify-otp", forgotPasswordVerifyOtpController.forgotPasswordVerifyOtp);
router.post("/auth/reset-password", resetPasswordController.resetPassword);
router.post("/admin/firebase-config", googleSignController.googleSign);
router.post("/admin/sign-up", adminSignUpController.adminSignUp);
router.post("/auth/sign-out", authenticate, signOutController.signOut);
router.post("/health-article/model/health-artical-model", healthArticleController.createHealthArticle);

// Profile Routes
router.get("/profile/me", authenticate, profileController.getProfile);
router.put("/profile/me", authenticate, profileController.updateProfile);
router.post(
  "/profile/documents",
  authenticate,
  patientDocumentUpload.single("document"),
  profileController.uploadIdentityDocument
);

// Notification Routes
router.get("/notifications", authenticate, notificationsController.getNotifications);
router.patch(
  "/notifications/:notificationId/read",
  authenticate,
  notificationsController.markNotificationRead
);

// Chat Routes
router.get("/chat/rooms", authenticate, chatController.listRooms);
router.post("/chat/rooms", authenticate, chatController.createOrGetRoom);
router.get(
  "/chat/rooms/:roomId/messages",
  authenticate,
  chatController.getMessages
);
router.post(
  "/chat/rooms/:roomId/messages",
  authenticate,
  chatController.sendMessage
);
router.patch(
  "/chat/rooms/:roomId/read",
  authenticate,
  chatController.markRoomRead
);


//Doctors Routes 
router.get("/doctors/top", doctorController.topDoctors);
router.get("/doctor/:doctorId", doctorController.doctor);
router.post("/doctors/sign-up", doctorController.doctorSignUp);
router.get("/doctors/:doctorId/availability", doctorController.doctorAvailability);
router.get("/doctors/my-doctor-id", authenticate, doctorController.getMyDoctorId);

// Doctor Availability Routes (for verified doctors to set their schedule)
router.post(
  "/doctors/:doctorId/availability/set",
  authenticate,
  availabilityController.setAvailability
);
router.get(
  "/doctors/:doctorId/availability/schedule",
  availabilityController.getAvailability
);

// Doctor Verification Routes
router.post(
  "/doctors/verification/submit",
  doctorVerificationUpload,
  doctorVerificationController.submitVerification
);
router.get(
  "/doctors/verification/:doctorId",
  doctorVerificationController.getVerificationStatus
);
router.get(
  "/doctors/verification",
  doctorVerificationController.getAllVerifications
);

// Admin Doctor Verification Routes (Protected - requires authentication and admin role)
router.put(
  "/admin/doctors/verification/:verificationId/approve",
  authenticate,
  isAdmin,
  doctorVerificationAdminController.approveVerification
);
router.put(
  "/admin/doctors/verification/:verificationId/reject",
  authenticate,
  isAdmin,
  doctorVerificationAdminController.rejectVerification
);
router.put(
  "/admin/doctors/verification/:verificationId/status",
  authenticate,
  isAdmin,
  doctorVerificationAdminController.updateVerificationStatus
);
router.get(
  "/admin/doctors/verification/:verificationId",
  authenticate,
  isAdmin,
  doctorVerificationAdminController.getVerificationDetails
);

// Appointment Booking Routes
router.get(
  "/appointments/doctors/available",
  appointmentController.searchAvailableDoctors
);
router.get(
  "/doctors/dashboard/overview",
  authenticate,
  appointmentController.getDoctorDashboardOverview
);
router.get(
  "/doctors/dashboard/appointments",
  authenticate,
  appointmentController.getDoctorAppointments
);
router.get(
  "/doctors/dashboard/patients",
  authenticate,
  appointmentController.getDoctorPatients
);
router.post(
  "/appointments/book",
  authenticate,
  appointmentController.bookAppointment
);
router.get(
  "/appointments/my-appointments",
  authenticate,
  appointmentController.getMyAppointments
);
router.put(
  "/appointments/:appointmentId/cancel",
  authenticate,
  appointmentController.cancelAppointment
);
router.put(
  "/doctors/appointments/:appointmentId/status",
  authenticate,
  appointmentController.updateAppointmentStatusByDoctor
);

// Pharmacy Product Routes
router.post(
  "/pharmacy/products",
  authenticate,
  isAdmin,
  pharmacyProductUpload.array("images", 5),
  pharmacyProductController.createProduct
);
router.get("/pharmacy/products", pharmacyProductController.getProducts);
router.get(
  "/pharmacy/products/:productId",
  pharmacyProductController.getProductById
);
router.put(
  "/pharmacy/products/:productId",
  authenticate,
  isAdmin,
  pharmacyProductUpload.array("images", 5),
  pharmacyProductController.updateProduct
);
router.delete(
  "/pharmacy/products/:productId",
  authenticate,
  isAdmin,
  pharmacyProductController.archiveProduct
);

// Pharmacy Orders
router.post(
  "/pharmacy/orders",
  authenticate,
  pharmacyOrderController.createOrder
);
router.get(
  "/pharmacy/orders/me",
  authenticate,
  pharmacyOrderController.getMyOrders
);
router.get(
  "/pharmacy/orders/:orderId",
  authenticate,
  pharmacyOrderController.getOrderById
);
router.get(
  "/pharmacy/orders",
  authenticate,
  isAdmin,
  pharmacyOrderController.getAllOrders
);
router.patch(
  "/pharmacy/orders/:orderId/status",
  authenticate,
  isAdmin,
  pharmacyOrderController.updateOrderStatus
);

// ============================================================================
// ADMIN ROUTES (All protected with isAdmin middleware)
// ============================================================================

// Dashboard & Statistics
router.get("/admin/dashboard/stats", authenticate, isAdmin, adminController.getDashboardStats);
router.get("/admin/doctors/top", authenticate, isAdmin, adminController.getTopDoctors);

// User Management
router.get("/admin/users", authenticate, isAdmin, adminController.getAllUsers);
router.get("/admin/users/:userId", authenticate, isAdmin, adminController.getUserById);
router.put("/admin/users/:userId/role", authenticate, isAdmin, adminController.updateUserRole);
router.delete("/admin/users/:userId", authenticate, isAdmin, adminController.deleteUser);
router.post("/admin/users/bulk-delete", authenticate, isAdmin, adminController.bulkDeleteUsers);

// Doctor Management
router.get("/admin/doctors", authenticate, isAdmin, adminController.getAllDoctors);
router.get("/admin/doctors/:doctorId", authenticate, isAdmin, adminController.getDoctorById);
router.patch("/admin/doctors/:doctorId/toggle-status", authenticate, isAdmin, adminController.toggleDoctorStatus);
router.put("/admin/doctors/:doctorId", authenticate, isAdmin, adminController.updateDoctorDetails);

// Doctor Verification Management
router.get("/admin/verifications", authenticate, isAdmin, adminController.getAllVerifications);
router.patch("/admin/verifications/:verificationId/status", authenticate, isAdmin, adminController.updateVerificationStatus);

// Appointment Management
router.get("/admin/appointments", authenticate, isAdmin, adminController.getAllAppointments);
router.patch("/admin/appointments/:appointmentId/status", authenticate, isAdmin, adminController.updateAppointmentStatus);
router.delete("/admin/appointments/:appointmentId", authenticate, isAdmin, adminController.deleteAppointment);
router.post("/admin/appointments/bulk-update-status", authenticate, isAdmin, adminController.bulkUpdateAppointmentStatus);

// Pharmacy Management
router.get("/admin/pharmacy/products", authenticate, isAdmin, adminController.getAllPharmacyProducts);
router.get("/admin/pharmacy/orders", authenticate, isAdmin, adminController.getAllPharmacyOrders);
router.patch("/admin/pharmacy/orders/:orderId/status", authenticate, isAdmin, adminController.updatePharmacyOrderStatus);
router.delete("/admin/pharmacy/orders/:orderId", authenticate, isAdmin, adminController.deletePharmacyOrder);

// Notifications Management
router.get("/admin/notifications", authenticate, isAdmin, adminController.getAllNotifications);
router.delete("/admin/notifications/:notificationId", authenticate, isAdmin, adminController.deleteNotification);

// Chat Management
router.get("/admin/chat/rooms", authenticate, isAdmin, adminController.getAllChatRooms);
router.get("/admin/chat/conversations", authenticate, isAdmin, adminController.getAllConversations);

// Health Articles Management
router.get("/admin/health-articles", authenticate, isAdmin, adminController.getAllHealthArticles);
router.post("/admin/health-articles", authenticate, isAdmin, healthArticleController.createHealthArticle);

module.exports = router;