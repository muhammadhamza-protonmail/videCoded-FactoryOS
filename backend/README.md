# Factory Management System - Backend API

This is the Node.js/Express backend for the Multi-Tenant Factory Management System. It provides a robust REST API for managing multiple factories, user permissions, inventory, and financial records with strict data isolation.

## 🚀 Features

- **Multi-Tenancy**: Complete data isolation using `factory_id`. Administrators only see data relevant to their assigned factory.
- **Role-Based Access Control (RBAC)**: 
  - **Superadmin**: Global system management, factory creation, white-labeling.
  - **Admin**: Full control over a specific factory's users and data.
  - **User**: Restricted access based on custom module permissions (View, Add, Edit, Delete).
- **Inventory Engine**: Automatic stock updates for raw materials and finished products upon production logging.
- **Financial Tracking**: 
  - Customer Ledgers with running balances.
  - Credit limit enforcement for invoicing.
  - Payment allocation and balance tracking.
- **Production Analytics**: Shift-wise production logs with automated cost and net profit calculations.
- **Reporting Support**: Optimized endpoints for professional PDF generation.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (via `sqlite3` and `sqlite` wrapper)
- **Authentication**: JWT (JSON Web Tokens)
- **File Handling**: Multer (for logo/image uploads)
- **Security**: CORS, Environment-based configuration.

## 📁 Project Structure

```text
backend/
├── config/             # Database connection & query processor
├── controllers/        # Business logic for all modules
├── middleware/         # Auth & Permission verification
├── routes/             # API endpoint definitions
├── uploads/            # Local storage for uploaded assets
├── database.sqlite     # SQLite database file
├── schema.sql          # Initial database schema
├── server.js           # Entry point
└── .env                # Environment variables
```

## ⚙️ Installation & Setup

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Install Dependencies**:
   ```powershell
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file with the following:
   ```env
   PORT=5000
   JWT_SECRET=your_super_secret_key
   ```

4. **Initialize Database**:
   Run the migration script to ensure the schema is up to date:
   ```powershell
   node migrate_multi_tenant.js
   ```

5. **Start the Server**:
   ```powershell
   node server.js
   ```
   The API will be available at `http://localhost:5000/api`.

## 🔒 Authentication

All protected routes require a Bearer token in the `Authorization` header:
`Authorization: Bearer <your_jwt_token>`

## 📊 Main API Modules

- `/auth`: Login, Logout, Session check.
- `/users`: User management and permission settings.
- `/customers`: CRM, Ledgers, and Credit tracking.
- `/vendors`: Supplier management.
- `/products`: Finished goods and pricing.
- `/rawmaterials`: Material inventory and reorder alerts.
- `/production`: Daily production logging and profit analysis.
- `/invoices`: Billing and professional invoicing.
- `/payments`: Payment recording and balance reconciliation.
- `/inventory`: Global stock movements and summaries.
- `/superadmin`: System-wide settings and factory management.
