const express  = require('express');
const cors     = require('cors');
const protect  = require('./middleware/auth');
const path = require('path');
const fs = require('fs');

require('dotenv').config({
    path: process.env.DOTENV_PATH || path.join(__dirname, '.env')
});

const db = require('./config/db');
const app = express();
app.use(cors());
app.use(express.json());

// Serve Static Files for Logo Uploads
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Public
app.use('/api/auth',         require('./routes/auth'));

// Protected
app.use('/api/customers',    protect, require('./routes/customers'));
app.use('/api/vendors',      protect, require('./routes/vendors'));
app.use('/api/products',     protect, require('./routes/products'));
app.use('/api/rawmaterials', protect, require('./routes/rawMaterials'));
app.use('/api/production',   protect, require('./routes/production'));
app.use('/api/invoices',     protect, require('./routes/invoices'));
app.use('/api/payments',     protect, require('./routes/payments'));
app.use('/api/inventory',    protect, require('./routes/inventory'));
app.use('/api/users',        protect, require('./routes/users'));
app.use('/api/superadmin',   require('./routes/superadmin'));
app.use('/api/factories',    require('./routes/factories'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
