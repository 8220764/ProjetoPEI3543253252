const express = require('express');
const router = express.Router();
const causaController = require('../controllers/causaController');

router.get('/', causaController.listarTodas);
router.post('/', causaController.criar);

module.exports = router;