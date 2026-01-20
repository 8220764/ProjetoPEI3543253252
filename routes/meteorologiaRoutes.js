const express = require('express');
const router = express.Router();
const meteorologiaController = require('../controllers/meteorologiaController');

router.get('/', meteorologiaController.listarTodos);

router.get('/stats/estacoes', meteorologiaController.statsPorEstacao);

module.exports = router;