const express = require('express');
const router = express.Router();
const meteorologiaController = require('../controllers/meteorologiaController');

//  ROTAS DE ESTATÍSTICAS 
// GET /api/meteorologia/stats/estacoes
router.get('/stats/estacoes', meteorologiaController.statsPorEstacao);

// GET /api/meteorologia/stats/temperatura-regiao
router.get('/stats/temperatura-regiao', meteorologiaController.statsTemperaturaPorRegiao);

//  ROTAS DA RAIZ 
// GET /api/meteorologia -> Listar todos 
router.get('/', meteorologiaController.listarTodos);

// POST /api/meteorologia -> Criar novo registo
router.post('/', meteorologiaController.criar);

module.exports = router;