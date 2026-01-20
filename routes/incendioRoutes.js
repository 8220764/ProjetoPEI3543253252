const express = require('express');
const router = express.Router();
const incendioController = require('../controllers/incendioController');

router.get('/', incendioController.listarTodos);

router.get('/stats/distritos', incendioController.statsPorDistrito);

router.get('/:codigo', incendioController.obterPorId);

module.exports = router;