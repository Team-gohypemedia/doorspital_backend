# Admin API Documentation

This document describes all admin endpoints for full database access and management. All endpoints are **protected** with JWT authentication and require **`admin`** role.

**Base URL**: `https://doorspital-backend.onrender.com` (or `http://localhost:3000` locally)

**Authentication**: All requests require header:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## Table of Contents
1. [Dashboard & Statistics](#dashboard--statistics)
2. [User Management](#user-management)
3. [Doctor Management](#doctor-management)
4. [Doctor Verification](#doctor-verification)
5. [Appointment Management](#appointment-management)
6. [Pharmacy Management](#pharmacy-management)
7. [Notifications Management](#notifications-management)
8. [Chat Management](#chat-management)
9. [Health Articles](#health-articles)
10. [Bulk Operations](#bulk-operations)

---

## Dashboard & Statistics

### GET /admin/dashboard/stats
Get complete platform statistics and overview.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "doctors": 25,
      "patients": 123,
      "admins": 2
    },
    "doctors": {
      "total": 25
    },
    "appointments": {
      "total": 450,
      "confirmed": 380,
      "completed": 350,
      "cancelled": 70
    },
    "pharmacy": {
      "products": 500,
      "orders": 120,
      "ordersDelivered": 100
    },
    "verification": {
      "pending": 5,
      "approved": 20,
      "rejected": 1
    },
    "notifications": 2500,
    "chatRooms": 80,
    "healthArticles": 45
  }
}
```

**curl (PowerShell)**:
```powershell
$token = '<admin_jwt>'
curl -X GET "http://localhost:3000/admin/dashboard/stats" `
  -H "Authorization: Bearer $token"
```

---

## User Management

### GET /admin/users
List all users with pagination and filtering.

**Query Parameters**:
- `page` (optional, default: 1) — page number
- `limit` (optional, default: 20, max: 100) — items per page
- `role` (optional) — filter by role: `user`, `doctor`, `admin`
- `search` (optional) — search by email or userName

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "692400...",
      "userName": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "phoneNumber": "+91-9999999999",
      "createdAt": "2025-11-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/users?page=1&limit=20&role=doctor" `
  -H "Authorization: Bearer $token"
```

### GET /admin/users/:userId
Get detailed information for a specific user.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "_id": "692400...",
    "userName": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "phoneNumber": "+91-9999999999",
    "gender": "male",
    "dateOfBirth": "1990-05-15T00:00:00Z",
    "bloodType": "O+",
    "allergies": [],
    "createdAt": "2025-11-20T10:00:00Z"
  }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/users/692400..." `
  -H "Authorization: Bearer $token"
```

### PUT /admin/users/:userId/role
Update user role.

**Request Body**:
```json
{
  "role": "admin"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Role updated",
  "data": { "_id": "...", "role": "admin" }
}
```

**curl (PowerShell)**:
```powershell
$body = @{ role = "admin" } | ConvertTo-Json
curl -X PUT "http://localhost:3000/admin/users/692400.../role" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -Body $body
```

### DELETE /admin/users/:userId
Delete a user.

**Response (200)**:
```json
{
  "success": true,
  "message": "User deleted"
}
```

**curl (PowerShell)**:
```powershell
curl -X DELETE "http://localhost:3000/admin/users/692400..." `
  -H "Authorization: Bearer $token"
```

### POST /admin/users/bulk-delete
Delete multiple users at once.

**Request Body**:
```json
{
  "userIds": ["id1", "id2", "id3"]
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Deleted 3 users"
}
```

---

## Doctor Management

### GET /admin/doctors
List all doctors with optional filtering.

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `specialization` (optional) — filter by specialization (case-insensitive)
- `city` (optional) — filter by city (case-insensitive)

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "693001...",
      "user": {
        "_id": "692400...",
        "email": "dr.john@example.com",
        "userName": "dr_john"
      },
      "specialization": "Cardiology",
      "experienceYears": 10,
      "consultationFee": 500,
      "city": "Mumbai",
      "timeZone": "Asia/Kolkata",
      "isActive": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 25, "pages": 2 }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/doctors?page=1&specialization=Cardiology" `
  -H "Authorization: Bearer $token"
```

### GET /admin/doctors/:doctorId
Get detailed info for a doctor including verifications and appointments.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "doctor": {
      "_id": "693001...",
      "specialization": "Cardiology",
      "experienceYears": 10,
      "consultationFee": 500
    },
    "verification": {
      "_id": "694001...",
      "status": "approved",
      "personalDetails": { "fullName": "Dr. John Doe" }
    },
    "availability": [
      { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" }
    ],
    "appointmentCount": 45
  }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/doctors/693001..." `
  -H "Authorization: Bearer $token"
```

### PATCH /admin/doctors/:doctorId/toggle-status
Enable or disable a doctor's account.

**Response (200)**:
```json
{
  "success": true,
  "message": "Doctor status updated",
  "data": { "_id": "693001...", "isActive": false }
}
```

**curl (PowerShell)**:
```powershell
curl -X PATCH "http://localhost:3000/admin/doctors/693001.../toggle-status" `
  -H "Authorization: Bearer $token"
```

---

## Doctor Verification

### GET /admin/verifications
List all doctor verifications with status filtering.

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `status` (optional) — `pending`, `under_review`, `approved`, `rejected`

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "694001...",
      "doctor": { "_id": "693001...", "specialization": "Cardiology" },
      "personalDetails": { "fullName": "Dr. John Doe", "email": "dr.john@example.com" },
      "status": "pending",
      "createdAt": "2025-11-27T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/verifications?status=pending" `
  -H "Authorization: Bearer $token"
```

### PATCH /admin/verifications/:verificationId/status
Update verification status (approve/reject).

**Request Body**:
```json
{
  "status": "approved",
  "adminNotes": "All documents are valid"
}
```

**Valid Statuses**: `pending`, `under_review`, `approved`, `rejected`

**Response (200)**:
```json
{
  "success": true,
  "message": "Verification status updated",
  "data": { "_id": "694001...", "status": "approved" }
}
```

**curl (PowerShell)**:
```powershell
$body = @{
  status = "approved"
  adminNotes = "All documents verified"
} | ConvertTo-Json

curl -X PATCH "http://localhost:3000/admin/verifications/694001.../status" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -Body $body
```

---

## Appointment Management

### GET /admin/appointments
List all appointments with filtering.

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `status` (optional) — `pending`, `confirmed`, `cancelled`, `completed`
- `mode` (optional) — `online`, `offline`

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "695001...",
      "patient": { "_id": "...", "userName": "patient1", "email": "patient@example.com" },
      "doctor": { "_id": "...", "specialization": "Cardiology" },
      "startTime": "2025-12-01T10:00:00Z",
      "endTime": "2025-12-01T10:30:00Z",
      "status": "confirmed",
      "mode": "online"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 450, "pages": 23 }
}
```

**curl (PowerShell)**:
```powershell
curl -X GET "http://localhost:3000/admin/appointments?status=confirmed&mode=online" `
  -H "Authorization: Bearer $token"
```

### PATCH /admin/appointments/:appointmentId/status
Update appointment status.

**Request Body**:
```json
{
  "status": "completed"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointment updated",
  "data": { "_id": "695001...", "status": "completed" }
}
```

### DELETE /admin/appointments/:appointmentId
Delete an appointment.

**Response (200)**:
```json
{
  "success": true,
  "message": "Appointment deleted"
}
```

### POST /admin/appointments/bulk-update-status
Update multiple appointments to the same status.

**Request Body**:
```json
{
  "appointmentIds": ["id1", "id2", "id3"],
  "status": "cancelled"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Updated 3 appointments"
}
```

---

## Pharmacy Management

### GET /admin/pharmacy/products
List all pharmacy products.

**Query Parameters**:
- `page`, `limit` (optional)
- `status` (optional) — `draft`, `active`, `inactive`
- `search` (optional) — search by product name

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "696001...",
      "name": "Aspirin 500mg",
      "brand": "Bayer",
      "price": 45,
      "stock": 100,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 500, "pages": 25 }
}
```

### GET /admin/pharmacy/orders
List all pharmacy orders.

**Query Parameters**:
- `page`, `limit` (optional)
- `status` (optional) — `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "697001...",
      "user": { "_id": "...", "userName": "customer1", "email": "customer@example.com" },
      "items": [ { "product": "...", "name": "Aspirin", "quantity": 2, "price": 45 } ],
      "total": 90,
      "status": "delivered",
      "createdAt": "2025-11-25T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 120, "pages": 6 }
}
```

### PATCH /admin/pharmacy/orders/:orderId/status
Update order status.

**Request Body**:
```json
{
  "status": "shipped"
}
```

**Valid Statuses**: `pending`, `processing`, `shipped`, `delivered`, `cancelled`

---

## Notifications Management

### GET /admin/notifications
List all notifications sent to users.

**Query Parameters**:
- `page`, `limit` (optional)

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "698001...",
      "user": { "_id": "...", "userName": "user1", "email": "user@example.com" },
      "title": "Appointment Confirmed",
      "body": "Your appointment with Dr. John is confirmed for tomorrow at 10:00 AM",
      "isRead": false,
      "type": "appointment",
      "createdAt": "2025-11-28T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2500, "pages": 125 }
}
```

### DELETE /admin/notifications/:notificationId
Delete a specific notification.

---

## Chat Management

### GET /admin/chat/rooms
List all chat rooms (appointment-based chats).

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "699001...",
      "patient": { "_id": "...", "userName": "patient1" },
      "doctor": { "_id": "...", "specialization": "Cardiology" },
      "doctorUser": { "_id": "...", "userName": "dr_john" },
      "lastMessage": { "text": "See you tomorrow", "sentAt": "2025-11-28T15:00:00Z" },
      "patientUnreadCount": 0,
      "doctorUnreadCount": 2
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 80, "pages": 4 }
}
```

### GET /admin/chat/conversations
List all conversations (direct 1-to-1 chats).

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6900a1...",
      "participants": ["692400...", "692401..."],
      "messages": [
        { "sender": "692400...", "text": "Hi!", "createdAt": "2025-11-28T10:00:00Z" }
      ],
      "updatedAt": "2025-11-28T10:05:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
}
```

---

## Health Articles

### GET /admin/health-articles
List all health articles.

**Query Parameters**:
- `page`, `limit` (optional)

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6901a1...",
      "title": "Heart Health Tips",
      "content": "Keep your heart healthy by...",
      "author": { "_id": "...", "userName": "dr_john", "email": "dr.john@example.com" },
      "createdAt": "2025-11-20T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

---

## Bulk Operations

### POST /admin/users/bulk-delete
Delete multiple users.

**Request Body**:
```json
{
  "userIds": ["id1", "id2", "id3"]
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Deleted 3 users"
}
```

### POST /admin/appointments/bulk-update-status
Update multiple appointments to the same status.

**Request Body**:
```json
{
  "appointmentIds": ["appt1", "appt2"],
  "status": "cancelled"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Updated 2 appointments"
}
```

---

## Error Responses

All endpoints return error responses in this format:

**400 Bad Request**:
```json
{
  "success": false,
  "message": "Invalid request parameters"
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

**403 Forbidden** (not admin):
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

**404 Not Found**:
```json
{
  "success": false,
  "message": "Resource not found"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Quick Testing Checklist

1. **Get Dashboard Stats**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/dashboard/stats" -H "Authorization: Bearer $token"
   ```

2. **List All Users**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/users?page=1&limit=10" -H "Authorization: Bearer $token"
   ```

3. **List All Doctors**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/doctors" -H "Authorization: Bearer $token"
   ```

4. **Get Pending Verifications**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/verifications?status=pending" -H "Authorization: Bearer $token"
   ```

5. **Update Verification Status**:
   ```powershell
   $body = @{ status = "approved"; adminNotes = "OK" } | ConvertTo-Json
   curl -X PATCH "http://localhost:3000/admin/verifications/<verificationId>/status" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -Body $body
   ```

6. **List Appointments**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/appointments?status=confirmed" -H "Authorization: Bearer $token"
   ```

7. **List Pharmacy Orders**:
   ```powershell
   curl -X GET "http://localhost:3000/admin/pharmacy/orders" -H "Authorization: Bearer $token"
   ```

---

## Import into Postman

All endpoints are available in the `doorspital-postman-collection.json` file (add admin collection or update existing one with these admin endpoints). You can manually add them or request an updated collection.

---

## Next Steps

- Create an admin dashboard frontend (React/Vue) that consumes these APIs.
- Add role-based access control (RBAC) for super-admin, moderator, etc.
- Add audit logging to track admin actions (who changed what and when).
- Add export/download functionality (CSV/Excel) for reports.
- Set up admin alerts and monitoring for critical events (verification rejections, order issues, etc.).
