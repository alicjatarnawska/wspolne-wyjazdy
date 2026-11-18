const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Wszystkie trasy w tym routerze wymagają zalogowania
router.use(authMiddleware);

router.get('/profile', userController.getMe);
router.patch('/profile/email', userController.updateEmail);
router.patch('/profile/display-name', userController.updateDisplayName);
router.patch('/profile/password', userController.changePassword);
router.delete('/profile', userController.deleteAccount);

module.exports = router;