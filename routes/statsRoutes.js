const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ mensagem: "Endpoint de estatísticas gerais (statsRoutes) a funcionar!" });
});

module.exports = router;