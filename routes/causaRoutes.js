const express = require('express');
const router = express.Router();
const causaController = require('../controllers/causaController');

// GET /api/causas
router.get('/', causaController.listarTodas);

module.exports = router;