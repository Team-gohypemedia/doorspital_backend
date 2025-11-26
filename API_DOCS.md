# Doorspital Backend — API Documentation

Base URL (deployed): `https://doorspital-backend.onrender.com`

Authentication: most protected endpoints require a Bearer JWT in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

Testing tips:
- Use Postman or curl. For file uploads use `multipart/form-data`.
- Set required environment variables (in Render dashboard) before testing protected flows: `MONGODB`, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FIREBASE_SERVICE_ACCOUNT` (if using Firebase features).

---

## Auth

### POST /api/auth/sign-up
Create a user account.

Request (JSON):
```json
{
  "userName": "john_doe",
  "email": "john@example.com",
  "password": "strongPassword123"
}
```

Response: 200 OK — user created (note: password is persisted hashed).

---

### POST /api/auth/sign-in
Sign in and receive JWT.

Request (JSON):
```json
{
  "email": "john@example.com",
  "password": "strongPassword123"
}
```

Response: 200 OK
```json
{
  "success": true,
  "message": "Signed in",
  "token": "<JWT_TOKEN>",
  "user": { "id": "...", "email":"john@example.com", "userName":"john_doe", "role":"user" }
}
```

---

### POST /api/auth/sign-out
Protected — client should call to indicate sign-out.

Headers: `Authorization: Bearer <token>`

Response: 200 OK

---

### POST /api/admin/sign-up
Create an admin user (use carefully).

Request (JSON):
```json
{
  "userName": "admin",
  "email": "admin@example.com",
  "password": "AdminPass!"
}
```

Response: 201 Created — returns admin id and role.

---

### POST /api/admin/firebase-config
Used for Google sign-in (verifies Firebase ID token).

Request (JSON):
```json
{ "idToken": "<FIREBASE_ID_TOKEN_FROM_CLIENT>" }
```

Response: 200 OK — returns `token` (your app JWT) on success.

---

### Forgot / Reset Password

- POST /api/auth/forgot-password-send-otp
  - Body: `{ "email": "user@example.com" }`
  - Sends OTP to email (uses configured SMTP)

- POST /api/auth/forgot-password-verify-otp
  - Body: `{ "email": "user@example.com", "otp": "123456" }`
  - Response includes `reset_token` (short-lived JWT for password reset)

- POST /api/auth/reset-password
  - Body: `{ "reset_token": "<token>", "password": "newpass", "confirm_password": "newpass" }`
  - Resets password using reset_token


---

## Profile

### GET /api/profile/me
Protected. Returns authenticated user's profile (password and OTP fields removed).

Headers: `Authorization: Bearer <token>`

---

### PUT /api/profile/me
Protected. Update profile fields.

Request (JSON) — any of:
- `userName`, `phoneNumber`, `gender` (male|female|other|prefer_not_to_say),
- `dateOfBirth` (ISO date), `heightCm`, `weightKg`, `bloodType`, `preferredLanguage`, `location`, `bio`,
- `allergies` (array or comma-separated string),
- `emergencyContact` object `{ name, phone, relation }`.

Example:
```json
{
  "userName": "John D",
  "phoneNumber": "+911234567890",
  "allergies": ["pollen", "peanuts"]
}
```

---

### POST /api/profile/documents
Protected. Upload identity document for the user.

- Content-Type: `multipart/form-data`
- Fields:
  - `document` (file) — the uploaded file
  - `documentType` (string) — e.g. `Aadhaar Card`, `PAN Card`, `Passport`, `Driving License`

Example (curl):
```bash
curl -X POST "https://doorspital-backend.onrender.com/api/profile/documents" \
  -H "Authorization: Bearer <token>" \
  -F "document=@/path/to/file.pdf" \
  -F "documentType=Aadhaar Card"
```

---

## Notifications

### GET /api/notifications
Protected. Query: `page`, `limit` (optional)

### PATCH /api/notifications/:notificationId/read
Protected. Marks a notification as read.

Headers: `Authorization: Bearer <token>`

---

## Doctors & Availability

### GET /api/doctors/top
List doctors. Query params:
- `specialization`, `city`, `page`, `limit`.

Example:
```
GET /api/doctors/top?specialization=Cardiology&city=Delhi&page=1&limit=10
```

---

### GET /api/doctor/:doctorId
Get details of a doctor.

---

### POST /api/doctors/sign-up
Register a doctor (creates associated user and doctor profile).

Request (JSON):
```json
{
  "name": "Dr. A",
  "email": "dr.a@example.com",
  "password": "securePass",
  "specialization": "Cardiology",
  "experienceYears": 5,
  "consultationFee": 500,
  "city": "Mumbai",
  "timeZone": "Asia/Kolkata"
}
```

Response: 201 Created — returns `doctorId` and `userId`.

---

### POST /api/doctors/:doctorId/availability/set
Protected — only verified doctors can set availability.

Path param: `doctorId`
Headers: `Authorization: Bearer <token>`

Request (JSON):
```json
{
  "availability": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00", "slotDurationMinutes": 15 },
    { "dayOfWeek": 3, "startTime": "14:00", "endTime": "17:00", "slotDurationMinutes": 20 }
  ]
}
```
- `dayOfWeek`: 0 (Sunday) to 6 (Saturday)
- `startTime` / `endTime`: `HH:MM` 24-hour

Response: 201 Created — returns created availability rules.

---

### GET /api/doctors/:doctorId/availability/schedule
Public. Query params: `start` (ISO), `days` (1-14), `tz` (optional)
Returns weekly availability with slots.

Example:
```
GET /api/doctors/6123.../availability/schedule?start=2025-11-26T00:00:00Z&days=7
```

---

## Doctor Verification

### POST /api/doctors/verification/submit
Submit verification documents (multipart).

- Content-Type: `multipart/form-data`
- Required form fields:
  - `doctorId` (string)
  - `fullName`, `email`, `phoneNumber`, `medicalSpecialization`, `yearsOfExperience`, `clinicHospitalName`, `clinicAddress`, `state`, `city`,
  - `registrationNumber`, `councilName` (one of `MCI`, `State Council`), `issueDate` (ISO date),
  - `documentType` (`Aadhaar Card`, `PAN Card`, `Passport`, `Driving License`)
- Required file fields:
  - `mbbsCertificate` (file)
  - `registrationCertificate` (file)
  - `governmentId` (file)
  - `selfie` (file)
- Optional file: `mdMsBdsCertificate`

Example (curl):
```bash
curl -X POST "https://doorspital-backend.onrender.com/api/doctors/verification/submit" \
  -F "doctorId=6123..." \
  -F "fullName=Dr Name" \
  -F "email=dr@example.com" \
  -F "phoneNumber=+911234567890" \
  -F "medicalSpecialization=Cardiology" \
  -F "yearsOfExperience=5" \
  -F "clinicHospitalName=Clinic XYZ" \
  -F "clinicAddress=123 Street" \
  -F "state=State" \
  -F "city=City" \
  -F "registrationNumber=REG123" \
  -F "councilName=MCI" \
  -F "issueDate=2020-01-01" \
  -F "documentType=Aadhaar Card" \
  -F "mbbsCertificate=@/path/to/mbbs.pdf" \
  -F "registrationCertificate=@/path/to/reg.pdf" \
  -F "governmentId=@/path/to/id.pdf" \
  -F "selfie=@/path/to/selfie.jpg"
```

Response: 201 Created — returns `verificationId` and status (`pending`).

---

### GET /api/doctors/verification/:doctorId
Get verification status for a doctor (sanitized, no file paths).

### GET /api/doctors/verification
Query: `status`, `page`, `limit` — returns list (mostly for admin)

Admin actions (require `Authorization: Bearer <admin token>` and `isAdmin`):
- PUT `/api/admin/doctors/verification/:verificationId/approve`
- PUT `/api/admin/doctors/verification/:verificationId/reject` — body: `{ "rejectionReason": "...", "adminNotes": "optional" }`
- PUT `/api/admin/doctors/verification/:verificationId/status` — body: `{ "status": "approved" }` (allowed: pending, under_review, approved, rejected)
- GET `/api/admin/doctors/verification/:verificationId` — get full review details

---

## Appointments

### GET /api/appointments/doctors/available
Search for available doctors for a date.

Query params (required/optional):
- `date` (required, `YYYY-MM-DD`)
- `specialization` (optional)
- `city` (optional)

Example:
```
GET /api/appointments/doctors/available?date=2025-11-30&specialization=Cardiology
```

### POST /api/appointments/book
Protected. Book an available slot.

Request (JSON):
```json
{
  "doctorId": "6123...",
  "startTime": "2025-11-30T09:00:00.000Z",
  "reason": "Consultation about chest pain",
  "mode": "online"
}
```
- `startTime` must match an available slot `startUtc` returned by the availability schedule.

Response: 201 Created — appointment object.

---

### GET /api/appointments/my-appointments
Protected. Query: `status`, `page`, `limit`.

### PUT /api/appointments/:appointmentId/cancel
Protected. Cancel appointment (patient who booked it).

### Doctor dashboard (protected; requires that the authenticated user is the verified doctor)
- GET `/api/doctors/dashboard/overview`
- GET `/api/doctors/dashboard/appointments` — query `status`, `range`, `date`, `page`, `limit`
- GET `/api/doctors/dashboard/patients` — query `page`, `limit`, `search`
- PUT `/api/doctors/appointments/:appointmentId/status` — body: `{ "status": "completed" }` or `{ "status": "cancelled" }` (doctor only)

---

## Pharmacy

### POST /api/pharmacy/products
Protected + Admin. Create a product (multipart; images)

- Content-Type: `multipart/form-data`
- Fields (form):
  - `name` (required), `price` (required), `stock` (int), `sku`, `description`, `category`, `brand`, `mrp`, `discountPercent`, `dosageForm`, `strength`, `tags` (array or JSON or comma-separated), `isPrescriptionRequired` (boolean)
  - `images[]` or `images` — files (route expects `pharmacyProductUpload.array("images", 5)`)

Example (curl):
```bash
curl -X POST "https://doorspital-backend.onrender.com/api/pharmacy/products" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "name=Paracetamol" \
  -F "price=50" \
  -F "stock=100" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

### GET /api/pharmacy/products
Public. Query filters: `search`, `category`, `isPrescriptionRequired`, `minPrice`, `maxPrice`, `status`, `page`, `limit`, `sortBy`, `sortOrder`.

### GET /api/pharmacy/products/:productId
Get product details.

### PUT /api/pharmacy/products/:productId
Protected + Admin. Update product fields and add/remove images. Send `multipart/form-data` when uploading images.
- To remove images: include `removeImageFilenames` (comma-separated or JSON array)

### DELETE /api/pharmacy/products/:productId
Protected + Admin. Archives the product (soft delete).

---

## Pharmacy Orders

### POST /api/pharmacy/orders
Protected. Place an order.

Request (JSON):
```json
{
  "items": [ { "productId": "6123...", "quantity": 2 } ],
  "shippingAddress": {
    "fullName": "John Doe",
    "phone": "+911234567890",
    "addressLine1": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001"
  },
  "paymentMethod": "cod",
  "notes": "Please deliver between 9am-5pm"
}
```

Response: 201 Created — returns order object (items, totals, status).

---

### GET /api/pharmacy/orders/me
Protected. List user's orders.

### GET /api/pharmacy/orders/:orderId
Protected. Owner or admin may view.

### GET /api/pharmacy/orders
Protected + Admin. List all orders (query: status, paymentStatus, page, limit).

### PATCH /api/pharmacy/orders/:orderId/status
Protected + Admin. Update `status` and/or `paymentStatus`.

---

## Files & Uploads

- Uploaded files are served from `/uploads` (public). Example file URL: `https://doorspital-backend.onrender.com/uploads/pharmacy-products/<filename>`.
- For sensitive documents you may want to move to private storage (S3/GCS) or generate signed URLs.

---

## Errors & Validation

- Validation errors return `422` with `errors` describing fields.
- Authentication/authorization errors return `401` or `403`.
- Server errors return `500`.

---

## Quick Postman Notes

- Create an environment variable `baseUrl` = `https://doorspital-backend.onrender.com`.
- For protected requests set `Authorization` header value to `{{token}}` where `{{token}}` is the JWT obtained from sign-in.
- For file uploads set body type to `form-data` and choose `File` for file fields.

---

If you want, I can now:
- 1) Add example Postman collection JSON (ready-to-import) with the main flows (auth, doctor signup, verification, booking, product create/order).
- 2) Patch the small code fixes I previously suggested (app port default, send_mail MAIL_FROM, reset_otp_expires type, etc.).

Which would you like next? 
