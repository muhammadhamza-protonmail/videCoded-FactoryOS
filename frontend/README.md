# Factory Management System - Frontend Dashboard

A premium, professional web application built with Next.js for managing factory operations. It features a modern, responsive UI with deep integration for inventory tracking, production analytics, and professional PDF reporting.

## ✨ Key Features

- **Executive Dashboard**: Real-time KPIs for Sales, Collections, and Profitability with visual charts.
- **Smart Inventory**: Color-coded stock levels with low-stock alerts and detailed movement history.
- **Dynamic Invoicing**: Create professional invoices with auto-calculated totals, taxes, and credit limit checks.
- **PDF Reporting Engine**: 
  - **Grand Business Report**: A comprehensive executive summary of the entire factory.
  - **Ledgers**: Professional customer statements.
  - **P&L**: Period-wise Profit and Loss statements.
- **Permission-Driven UI**: The interface dynamically hides or shows buttons and pages based on user permissions.
- **Superadmin Panel**: White-label settings (Logo, App Name) and factory management.
- **Responsive Design**: Optimized for desktop and tablet usage with a sleek "Glassmorphism" aesthetic.

## 🛠 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Vanilla CSS with modern custom properties.
- **Icons**: Lucide React
- **Data Fetching**: Axios
- **PDF Generation**: jsPDF & jsPDF-AutoTable
- **Charts**: Recharts
- **State Management**: React Context API (Auth & Permissions)
- **Notifications**: React Hot Toast

## 📁 Project Structure

```text
frontend/
├── components/         # Reusable UI components (Sidebar, Layout, Modals)
├── context/            # AuthContext for global state
├── lib/                # API client (Axios)
├── src/app/            # Next.js App Router pages
│   ├── customers/      # CRM & Ledgers
│   ├── inventory/      # Stock tracking
│   ├── invoices/       # Billing
│   ├── production/     # Production logs
│   ├── reports/        # PDF generation hub
│   ├── superadmin/     # System settings
│   └── login/          # Auth entry
└── public/             # Static assets
```

## ⚙️ Installation & Setup

1. **Navigate to the frontend directory**:
   ```powershell
   cd frontend
   ```

2. **Install Dependencies**:
   ```powershell
   npm install
   ```

3. **Start the Development Server**:
   ```powershell
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 🎨 UI/UX Philosophy

The system is designed to look like a premium SaaS product:
- **Clean Typography**: Uses Inter/Sans-serif for maximum readability.
- **Micro-animations**: Smooth transitions for modals and hover effects.
- **Contextual Feedback**: Success/Error toasts for every action.
- **Data-Dense but Organized**: Tables and grids are optimized for factory data entry.

## 📄 Reporting

Reports are generated client-side using `jsPDF`. The "Grand Report" automatically aggregates data from 7 different API endpoints to provide a complete snapshot of factory health, including:
- Sales & Receivables
- Purchases & Payables
- Inventory Valuation
- Net Profit Analysis
