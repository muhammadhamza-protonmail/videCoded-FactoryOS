const express = require('express');
const router = express.Router();
const {
    getAllMovements,
    getMovementById,
    addMovement,
    getStockSummary,
    getProductMovements,
    getMaterialMovements,
} = require('../controllers/inventoryController');

router.get('/', getAllMovements);
router.get('/summary', getStockSummary);
router.get('/product/:id', getProductMovements);
router.get('/material/:id', getMaterialMovements);
router.get('/:id', getMovementById);
router.post('/', addMovement);

module.exports = router;