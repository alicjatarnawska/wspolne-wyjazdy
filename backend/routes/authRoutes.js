//import biblioteki express
const express = require('express');
//instancja routera do grupowania tras
const router = express.Router();
//import kontrolerów
const authController = require('../controllers/authController');

//trasy publiczne (dostępne bez logowania)
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
