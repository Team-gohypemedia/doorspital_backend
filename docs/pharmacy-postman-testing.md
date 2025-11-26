# Pharmacy API – Postman Testing Guide

This guide walks through everything you need to exercise the pharmacy endpoints with Postman: environment setup, authentication, and request-by-request reference for products and orders. Every endpoint now includes concrete payload examples so you can copy/paste directly into Postman.

---

## 1. Quick Start

1. **Base URL**  
   Add an environment variable in Postman called `base_url` that points to your running server, e.g. `http://localhost:3000/api`. (If your `.env` uses another port, change accordingly.)
2. **Authorization token**  
   All protected routes expect a JWT in the `Authorization` header as `Bearer <token>`. Obtain it from the sign-in endpoint (details below) and store it in a `jwt` variable.
3. **Admin vs customer**  
   - Product management routes require both `authenticate` and `isAdmin`.  
   - Order creation and lookups only require authentication, while admin-only order actions also need `isAdmin`.

---

## 2. Authentication Flow (pre-requisite)

| Step | Endpoint | Method | Request Body | Expected Response Snippet |
| --- | --- | --- | --- | --- |
| Sign up (optional) | `/auth/sign-up` | POST | `{ "userName": "John Doe", "email": "john@demo.com", "password": "Secret@123", "phoneNumber": "9999999999" }` | `{ "success": true, "message": "Sign up successful" }` |
| Sign in (customer) | `/auth/sign-in` | POST | `{ "email": "john@demo.com", "password": "Secret@123" }` | `{ "success": true, "token": "<JWT>", "data": {...user info...} }` |
| Sign in (admin) | `/auth/sign-in` | POST | Use an admin email/password that already has `role: "admin"` | Same as above but copy token into `admin_jwt` |

**Postman tip:** add a test script to automatically capture the token after sign-in:
```javascript
const json = pm.response.json();
if (json?.token) {
  pm.environment.set("jwt", json.token);
}
```

---

## 3. Pharmacy Product APIs

Base path for these endpoints: `{{base_url}}/pharmacy/products`.

### 3.1 Create product (Admin)
- **Method:** POST  
- **Headers:** `Authorization: Bearer {{admin_jwt || jwt}}`  
- **Body type:** `form-data`

| Key | Type | Required | Example value (copy directly) |
| --- | --- | --- | --- |
| `name` | Text | ✅ | Dolo 650 |
| `price` | Text/Number | ✅ | 35 |
| `stock` | Text/Number | ➖ | 100 |
| `sku` | Text | ➖ | DOLO-650 |
| `description` | Text | ➖ | Fast-acting fever reducer |
| `category` | Text | ➖ | Pain Relief |
| `brand` | Text | ➖ | Micro Labs |
| `dosageForm` | Text | ➖ | tablet |
| `strength` | Text | ➖ | 650 mg |
| `discountPercent` | Text/Number | ➖ | 10 |
| `mrp` | Text/Number | ➖ | 40 |
| `tags` | Text | ➖ | ["tablet","fever","pain"] |
| `isPrescriptionRequired` | Text | ➖ | false |
| `images` | File | ➖ | Attach up to 5 files (e.g. `sample-image.jpg`) |

**Example cURL**
```
curl -X POST "{{base_url}}/pharmacy/products" ^
  -H "Authorization: Bearer {{admin_jwt}}" ^
  -F "name=Dolo 650" ^
  -F "price=35" ^
  -F "stock=100" ^
  -F "sku=DOLO-650" ^
  -F "category=Pain Relief" ^
  -F "tags=[\"tablet\",\"fever\"]" ^
  -F "isPrescriptionRequired=false" ^
  -F "images=@sample-image.jpg"
```

**Example response (`201`)**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "_id": "66f2a3c40c4f45db7fd5e9a1",
    "name": "Dolo 650",
    "price": 35,
    "stock": 100,
    "category": "Pain Relief",
    "images": [
      { "url": "/uploads/pharmacy-products/sample-image.jpg", "filename": "sample-image.jpg" }
    ],
    "status": "active"
  }
}
```

### 3.2 List products
- **Method:** GET  
- **Auth:** Not required.  
- **Sample URL:** `{{base_url}}/pharmacy/products?category=Pain%20Relief&minPrice=10&maxPrice=60&page=1&limit=10`

**Example response**
```json
{
  "success": true,
  "data": {
    "items": [
      { "_id": "66f2a3c40c4f45db7fd5e9a1", "name": "Dolo 650", "price": 35, "stock": 80 },
      { "_id": "66f2a45c16b5df9c9c7810d3", "name": "Crocin 500", "price": 28, "stock": 120 }
    ],
    "pagination": { "total": 2, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

### 3.3 Get product by ID
- **Method:** GET  
- **URL:** `{{base_url}}/pharmacy/products/66f2a3c40c4f45db7fd5e9a1`  
- **Auth:** Not required.

**Example response**
```json
{
  "success": true,
  "data": {
    "_id": "66f2a3c40c4f45db7fd5e9a1",
    "name": "Dolo 650",
    "description": "Fast-acting fever reducer",
    "images": [
      { "url": "/uploads/pharmacy-products/sample-image.jpg", "filename": "sample-image.jpg" }
    ]
  }
}
```

### 3.4 Update product (Admin)
- **Method:** PUT  
- **URL:** `{{base_url}}/pharmacy/products/66f2a3c40c4f45db7fd5e9a1`  
- **Headers:** `Authorization: Bearer {{admin_jwt}}`  
- **Body:** `form-data` (only send fields you want to change).
- **Useful keys:** `price`, `stock`, `status`, `tags`, `removeImageFilenames`, `images`.

**Example form-data**
| Key | Type | Value |
| --- | --- | --- |
| price | Text | 30 |
| stock | Text | 150 |
| status | Text | active |
| removeImageFilenames | Text | ["sample-image.jpg"] |
| images | File | `new-image.png` |

**Example response**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "_id": "66f2a3c40c4f45db7fd5e9a1",
    "price": 30,
    "stock": 150,
    "images": [
      { "url": "/uploads/pharmacy-products/new-image.png", "filename": "new-image.png" }
    ]
  }
}
```

### 3.5 Archive product (Admin)
- **Method:** DELETE  
- **URL:** `{{base_url}}/pharmacy/products/66f2a3c40c4f45db7fd5e9a1`  
- **Headers:** `Authorization: Bearer {{admin_jwt}}`  
- Sets `isDeleted = true` and `status = inactive`.

**Example response**
```json
{ "success": true, "message": "Product archived" }
```

---

## 4. Pharmacy Order APIs

Base path: `{{base_url}}/pharmacy/orders`.

### 4.1 Create order (Customer)
- **Method:** POST  
- **Headers:** `Authorization: Bearer {{jwt}}`  
- **Body (JSON):**
  ```json
  {
    "items": [
      { "productId": "66f2a3c40c4f45db7fd5e9a1", "quantity": 2 },
      { "productId": "66f2a45c16b5df9c9c7810d3", "quantity": 1 }
    ],
    "discount": 5,
    "paymentMethod": "cod",
    "shippingAddress": {
      "fullName": "John Doe",
      "phone": "9999999999",
      "addressLine1": "221B Baker Street",
      "addressLine2": "Near metro",
      "city": "Mumbai",
      "state": "MH",
      "postalCode": "400001",
      "country": "India"
    },
    "notes": "Call before delivery",
    "metadata": { "source": "mobile-app" }
  }
  ```
- Validation will reject requests without items or missing shipping fields.  
- The controller decreases product stock after confirming availability.

**Example response (`201`)**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "_id": "66f2a7f6186c3e3fd0bc4abc",
    "items": [
      { "product": "66f2a3c40c4f45db7fd5e9a1", "name": "Dolo 650", "quantity": 2, "price": 35 },
      { "product": "66f2a45c16b5df9c9c7810d3", "name": "Crocin 500", "quantity": 1, "price": 28 }
    ],
    "subtotal": 98,
    "discount": 5,
    "total": 93,
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "pending"
  }
}
```

### 4.2 Get my orders (Customer)
- **Method:** GET  
- **URL:** `{{base_url}}/pharmacy/orders/me`  
- **Headers:** `Authorization: Bearer {{jwt}}`

**Example response**
```json
{
  "success": true,
  "data": [
    { "_id": "66f2a7f6186c3e3fd0bc4abc", "total": 93, "status": "pending" }
  ]
}
```

### 4.3 Get order by ID (Owner or Admin)
- **Method:** GET  
- **URL:** `{{base_url}}/pharmacy/orders/66f2a7f6186c3e3fd0bc4abc`  
- **Headers:** `Authorization: Bearer {{jwt}}` (customer) **or** `{{admin_jwt}}`
- **Rules:** Customer must own the order. Admin can fetch any order.

**Example response**
```json
{
  "success": true,
  "data": {
    "_id": "66f2a7f6186c3e3fd0bc4abc",
    "user": { "userName": "John Doe", "email": "john@demo.com" },
    "items": [ { "name": "Dolo 650", "quantity": 2 } ],
    "status": "pending"
  }
}
```

### 4.4 List all orders (Admin)
- **Method:** GET  
- **URL:** `{{base_url}}/pharmacy/orders?status=pending&page=1&limit=20`  
- **Headers:** `Authorization: Bearer {{admin_jwt}}`

**Example response**
```json
{
  "success": true,
  "data": {
    "items": [
      { "_id": "66f2a7f6186c3e3fd0bc4abc", "user": { "userName": "John Doe" }, "total": 93 }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

### 4.5 Update order status (Admin)
- **Method:** PATCH  
- **URL:** `{{base_url}}/pharmacy/orders/66f2a7f6186c3e3fd0bc4abc/status`  
- **Headers:** `Authorization: Bearer {{admin_jwt}}`  
- **Body (JSON):**
  ```json
  {
    "status": "processing",
    "paymentStatus": "paid"
  }
  ```
- Accepts any combination of `status` (`pending`, `processing`, `shipped`, `delivered`, `cancelled`) and `paymentStatus` (`pending`, `paid`, `failed`).

**Example response**
```json
{
  "success": true,
  "message": "Order updated",
  "data": {
    "_id": "66f2a7f6186c3e3fd0bc4abc",
    "status": "processing",
    "paymentStatus": "paid"
  }
}
```

---

## 5. Recommended Postman Collection Setup

1. **Environment variables**
   | Variable | Value | Description |
   | --- | --- | --- |
   | `base_url` | `http://localhost:3000/api` | Match your `.env` port |
   | `jwt` | `<copied customer token>` | Filled after customer sign in |
   | `admin_jwt` | `<copied admin token>` | Optional convenience for admin calls |

2. **Pre-request script (optional)**  
   Use a single header for most requests:  
   ```
   pm.request.headers.upsert({
     key: "Authorization",
     value: "Bearer " + (pm.environment.get("jwt") || "")
   });
   ```
   For admin-only folders, override with `admin_jwt` via folder-level script.

3. **Collections**  
   - Group requests into folders: `Auth`, `Pharmacy Products (Admin)`, `Pharmacy Orders (Customer)`, `Pharmacy Orders (Admin)`.  
   - Duplicate order endpoints within both customer/admin folders but pre-fill the right token variable.

4. **Tests**  
   Add snippets to capture tokens automatically after sign-in (shown earlier) and optionally validate response schemas/status codes.

---

## 6. Manual Testing Checklist

- [ ] Sign in as admin and as a customer; store both tokens.  
- [ ] Create at least one product with images and confirm it appears in `/pharmacy/products`.  
- [ ] Update product stock/status and ensure the listing reflects changes.  
- [ ] Create an order that uses the product; verify stock decreases and totals are correct.  
- [ ] Fetch `/pharmacy/orders/me` and `/pharmacy/orders/:id` as the customer (only owned orders succeed).  
- [ ] Fetch `/pharmacy/orders` and update status as admin; confirm customer token receives `403`.  
- [ ] Archive the product and confirm it disappears from the default listing (`status=active`).  
- [ ] Note any validation or authorization errors you hit in Postman for quick debugging.

With these ready-made payloads and responses you can run through the entire pharmacy workflow in minutes. Adjust IDs (product/order) to match the documents created in your local database. If you need seed data or Postman export files, let me know! 