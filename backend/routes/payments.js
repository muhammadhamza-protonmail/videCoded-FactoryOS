const express = require('express');
const router = express.Router();
const {
    getAllPayments,
    getPaymentById,
    getPaymentsByInvoice,
    getPaymentsByCustomer,
    createPayment,
    allocatePayment,
    deletePayment,
} = require('../controllers/paymentController');

router.get('/', getAllPayments);
router.get('/invoice/:invoiceId', getPaymentsByInvoice);
router.get('/customer/:customerId', getPaymentsByCustomer);
router.get('/:id', getPaymentById);
router.post('/', createPayment);
router.post('/allocate', allocatePayment);
router.delete('/:id', deletePayment);

module.exports = router;