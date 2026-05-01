const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const protect = require('../middleware/auth');
const { getDashboardStats, getFactories, getGlobalSettings, updateGlobalSettings, getAllUsers, createFactory, createUserBySuperadmin } = require('../controllers/superadminController');

// Ensure uploads dir exists
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });


// Public route — sidebar needs app name/logo for ALL users
router.get('/settings', getGlobalSettings);

// Superadmin only middleware
const superadminOnly = (req, res, next) => {
    if (req.user.role === 'superadmin') return next();
    res.status(403).json({ error: 'Superadmin access required' });
};

// All routes below require superadmin
router.use(protect, superadminOnly);

router.get('/dashboard', getDashboardStats);
router.get('/factories', getFactories);
router.post('/factories', createFactory);
router.put('/settings', updateGlobalSettings);

// Logo Upload Route
router.post('/upload-logo', upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

router.get('/users', getAllUsers);
router.post('/users', createUserBySuperadmin);

module.exports = router;
