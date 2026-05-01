const express = require('express');
const router = express.Router();
const {
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    getLowStockMaterials,
} = require('../controllers/rawMaterialController');

router.get('/', getAllMaterials);
router.get('/lowstock', getLowStockMaterials);
router.get('/:id', getMaterialById);
router.post('/', createMaterial);
router.put('/:id', updateMaterial);
router.delete('/:id', deleteMaterial);

module.exports = router;