const express = require('express');
const router = express.Router();
const localizacaoController = require('../controllers/localizacaoController');

// GET /api/localizacoes
router.get('/', localizacaoController.listarTodas);

module.exports = router;