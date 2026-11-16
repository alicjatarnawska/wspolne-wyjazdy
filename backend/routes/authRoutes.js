//import biblioteki express
const express = require('express');
//instancja routera do grupowania tras
const router = express.Router();
//import kontrolera
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);

//eksport skonfigurowanego routera
module.exports = router;
