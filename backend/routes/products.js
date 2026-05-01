const express = require('express');
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    getLowStockProducts,
} = require('../controllers/productController');

router.get('/', getAllProducts);
router.get('/lowstock', getLowStockProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);

module.exports = router;