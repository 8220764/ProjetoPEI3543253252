const express = require('express');
const router = express.Router();
const bombeirosController = require('../controllers/bombeirosController');

router.get('/', bombeirosController.listarTodos);

router.get('/stats/distritos', bombeirosController.statsPorDistrito);

module.exports = router;