const express = require('express');
const router = express.Router();
const incendioController = require('../controllers/incendioController');

// 1. ROTAS DE ESTATÍSTICAS 
router.get('/stats/distritos', incendioController.statsPorDistrito);
router.get('/stats/top-area', incendioController.top5DistritosArea);
router.get('/stats/timeline', incendioController.incendiosPorAno);
router.get('/stats/causas', incendioController.topCausas);
router.get('/stats/media-area', incendioController.mediaAreaArdida);
router.get('/stats/fogo-vento', incendioController.correlacaoFogoVento);
router.get('/stats/eficiencia', incendioController.eficienciaCombate);
router.get('/stats/recursos', incendioController.analiseRecursos);
router.get('/stats/regioes-criticas', incendioController.topRegioesCriticas); 

//  ROTAS DA RAIZ 
// GET /api/incendios -> Listar todos
router.get('/', incendioController.listarTodos);

// POST /api/incendios -> Criar novo 
router.post('/', incendioController.criarIncendio);
//  ROTA POR CÓDIGO/ID 
router.get('/:codigo', incendioController.obterPorId);
module.exports = router;