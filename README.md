# 👑 AURA GOLD & JEWELRY - FULL STACK WEB APPLICATION

A luxury full-stack web application for a Gold Shop featuring client-side gold reservation storefront, custom gold price calculator, live metal rate ticker, address confirmation workflow (no online payment required), and server-side admin management dashboard.

---

## 🌟 Key Features

### 🛍️ Client Side Storefront
- **Live Gold Price Ticker**: Real-time rate display per gram for 24K (999.9 Fine), 22K (Crown Jewelry), and 18K gold.
- **Dynamic Price Computation**: Prices automatically calculated based on live gold market metal rate + weight in grams + making charges + state luxury tax (3% GST).
- **Custom Gold Calculator**: Instant weight and karat gold valuation tool.
- **Cart & Reservation Booking**: Add items to reservation cart without requiring online payments.
- **Address Confirmation**: Save and confirm delivery addresses with pin code validation, delivery preference, and special instructions.
- **Order Tracking & Receipt**: Instant booking receipt generation with print capability and status tracking (Pending -> Confirmed -> Processing -> Dispatched -> Completed).

### 🛡️ Server Side Admin Dashboard
- **Live Gold Rate Broadcast**: Update metal rates per gram (24K, 22K, 18K) in real-time.
- **Product Inventory Management**: Add, edit, or archive gold products with custom karat ratings, weights, making charge percentages, and images.
- **Order Booking Audit**: Review incoming customer orders with verified shipping address details.
- **Order Lifecycle Status Changer**: Transition order status from Pending Verification to Address Confirmed, Dispatched, or Delivered.
- **Analytics Overview**: View total gold reserved in grams, total bookings count, and revenue metrics.

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+)

### Steps
1. Navigate to the project directory:
   ```bash
   cd C:\Users\ranga\.gemini\antigravity-ide\scratch\gold-shop-app
   ```
2. Start the local backend server (SQLite database will initialize automatically):
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

## 🔑 Demo Test Accounts

| Role | Email | Password |
|---|---|---|
| **Client** | `eleanor@example.com` | `client123` |
| **Server Admin** | `admin@auragold.com` | `admin123` |

---

## 📁 Tech Stack
- **Backend**: Node.js, Express.js, JWT Authentication, bcryptjs
- **Database**: SQLite3 (`gold_shop.db` with auto-migration and pre-seeded catalog)
- **Frontend**: HTML5, Modern Vanilla CSS3 (Obsidian & Metallic Gold design system, Glassmorphism, animations), Modular JavaScript
