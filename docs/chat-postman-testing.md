# Patient ↔ Doctor Chat API – Postman Testing Guide

This guide walks through every endpoint required to let a patient and a doctor chat after an appointment. Import these steps into Postman (or follow manually) to verify the flow end-to-end using the deployed backend `https://doorspital-backend.onrender.com/api`.

---

## 0. Quick Start Checklist (follow in this order)

> Complete these steps if you do **not** already have real users/appointments in the database. Each request below is copy-paste ready for Postman’s raw JSON body tab.

1. **Create a patient account (regular user)**
   ```
   POST https://doorspital-backend.onrender.com/api/auth/sign-up
   Content-Type: application/json
   ```
   ```json
   {
     "userName": "Patient One",
     "email": "patient@example.com",
     "password": "patient@123"
   }
   ```

2. **Create a doctor + linked user account**
   ```
   POST https://doorspital-backend.onrender.com/api/doctors/sign-up
   Content-Type: application/json
   ```
   ```json
   {
     "name": "Dr. Ravindra",
     "email": "doctor@example.com",
     "password": "doctor@123",
     "specialization": "Cardiology",
     "experienceYears": 8,
     "consultationFee": 900,
     "city": "Mumbai",
     "timeZone": "Asia/Kolkata"
   }
   ```
   > This endpoint automatically creates:
   > - a `User` with `role: "doctor"`
   > - a `Doctor` document referencing that user (`doctor.user = userId`)

3. **Sign in as doctor** (step 1 below) and call `GET /doctors/my-doctor-id` to confirm the `doctorId`. If you manually inserted data, ensure `Doctor.user` is set to the doctor’s user `_id` and that user has `role: "doctor"`.

4. **Book an appointment linking patient & doctor**
   - Use the tokens obtained in step 1 below (patient token for booking).
   ```
   POST https://doorspital-backend.onrender.com/api/appointments/book
   Authorization: Bearer {{patientToken}}
   Content-Type: application/json
   ```
   ```json
   {
     "doctorId": "REPLACE_WITH_doctorId",
     "startTime": "2025-12-01T06:00:00.000Z",
     "endTime": "2025-12-01T06:15:00.000Z",
     "mode": "online",
     "reason": "General follow-up"
   }
   ```
   - The response contains the `appointmentId`. The appointment is created as `confirmed`, so it is immediately eligible for chat.

5. **Proceed to the chat steps below** (authenticate → create room → send messages).

---

## 1. Authenticate Patient & Doctor

### Request
```
POST https://doorspital-backend.onrender.com/api/auth/sign-in
Content-Type: application/json
```

#### Raw JSON body
```json
{
  "email": "patient@example.com",
  "password": "patient@123"
}
```

> **Save** the `token` from the response into a Postman variable, e.g. `patientToken`.

Repeat the same request with doctor credentials and store the token as `doctorToken`.

---

## 2. (Optional) Verify Doctor Linkage

Use this to confirm the logged-in doctor has a `Doctor` profile.

```
GET https://doorspital-backend.onrender.com/api/doctors/my-doctor-id
Authorization: Bearer {{doctorToken}}
```

Expected success response includes the `doctorId`.

---

## 3. Create or Fetch the Chat Room

Either participant can call this endpoint. It returns a room if one already exists or creates it on demand.

```
POST https://doorspital-backend.onrender.com/api/chat/rooms
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

#### Raw JSON body
```json
{
  "appointmentId": "66d91edf9c8a5d0012f0ef23"
}
```

Key fields in the `data` object:
- `_id`: The chat room ID (store as `roomId` in Postman).
- `appointment`: Appointment reference.
- `patient` / `doctor` / `doctorUser`: participant IDs.

If you call the same endpoint with the doctor token, it returns the identical room document.

---

## 4. List All Rooms for a User

Patients see their own rooms; doctors see their inbox of patients.

```
GET https://doorspital-backend.onrender.com/api/chat/rooms
Authorization: Bearer {{patientToken}}
```

Response includes `lastMessage`, `patientUnreadCount`, `doctorUnreadCount`, etc. Use this to verify unread behaviour.

---

## 5. Send a Message

```
POST https://doorspital-backend.onrender.com/api/chat/rooms/{{roomId}}/messages
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

#### Raw JSON body
```json
    {
    "body": "Hello Doctor, I have a quick question about my prescription."
    }
```

Expected response: newly created message with populated `sender`. The other participant’s unread counter increments, and a notification document is created (`type: "chat"`).

---

## 6. Fetch Messages (Paginated)

```
GET https://doorspital-backend.onrender.com/api/chat/rooms/{{roomId}}/messages?limit=20
Authorization: Bearer {{doctorToken}}
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "66d920289c8a5d0012f0f045",
      "body": "Hello Doctor...",
      "sender": {
        "_id": "66c80a...",
        "userName": "Jane Doe"
      },
      "createdAt": "2025-01-05T11:50:12.437Z"
    }
  ],
  "nextCursor": null
}
```

Provide the `nextCursor` value in the `cursor` query param to continue paging older messages.

---

## 7. Mark Room as Read

Called by whichever participant just viewed the conversation. Resets their unread counter and updates the `*_LastSeenAt` timestamp.

```
PATCH https://doorspital-backend.onrender.com/api/chat/rooms/{{roomId}}/read
Authorization: Bearer {{doctorToken}}
```

No body required. Response: `{ "success": true }`.

---

## 8. Verify Notification Entry (Optional)

Whenever a message is sent, the recipient gets a notification document. Pull them via the existing endpoint:

```
GET https://doorspital-backend.onrender.com/api/notifications?page=1&limit=10
Authorization: Bearer {{doctorToken}}
```

You should see a `type: "chat"` entry with `data.roomId` referencing the chat room.

---

## Environment Template

Create a Postman environment with the following variables to simplify requests:

| Variable        | Description                                   |
|-----------------|-----------------------------------------------|
| `baseUrl`       | `https://doorspital-backend.onrender.com/api` |
| `patientToken`  | Filled in after step 1                        |
| `doctorToken`   | Filled in after step 1                        |
| `roomId`        | Set after step 3                              |
| `appointmentId` | The confirmed/completed appointment ID        |

Then set request URLs like `{{baseUrl}}/chat/rooms/{{roomId}}/messages`.

---

## Troubleshooting Tips

- **401 Unauthorized**: confirm you’re sending the `Authorization: Bearer {{token}}` header and the token hasn’t expired.
- **403 Forbidden**: the caller is not part of the appointment. Double-check you’re using the correct user token and appointment ID.
- **400 Chat available only for confirmed/completed appointments**: update the appointment status or pick one in the right state.
- **Doctor account is not linked properly**: ensure the doctor’s `Doctor` document has the `user` field set to the doctor user ID.

Once the environment and variables are in place, you can script Postman test tabs (e.g., storing `pm.environment.set("roomId", pm.response.json().data._id);`) to link each step automatically.


