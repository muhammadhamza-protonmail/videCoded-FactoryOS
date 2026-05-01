const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const {
    getUsers, getUserById, createUser,
    updateUserPermissions, deleteUser, resetPassword
} = require('../controllers/usersController');

router.put('/:id/reset-password', protect, adminOnly, resetPassword);
router.get('/', protect, adminOnly, getUsers);
router.get('/:id', protect, adminOnly, getUserById);
router.post('/', protect, adminOnly, createUser);
router.put('/:id', protect, adminOnly, updateUserPermissions);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;