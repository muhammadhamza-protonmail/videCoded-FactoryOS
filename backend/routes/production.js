const express = require('express');
const router = express.Router();
const {
    getAllLogs,
    getLogById,
    createLog,
    updateLog,
    deleteLog,
    getDailySummary,
} = require('../controllers/productionController');

router.get('/', getAllLogs);
router.get('/summary', getDailySummary);
router.get('/:id', getLogById);
router.post('/', createLog);
router.put('/:id', updateLog);
router.delete('/:id', deleteLog);

module.exports = router;