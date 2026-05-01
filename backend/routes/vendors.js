const express = require('express');
const router = express.Router();
const {
    getAllVendors,
    getVendorById,
    createVendor,
    updateVendor,
    deleteVendor,
} = require('../controllers/vendorController');

router.get('/', getAllVendors);
router.get('/:id', getVendorById);
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;