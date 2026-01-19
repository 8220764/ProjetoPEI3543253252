const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: "API de Estatísticas pronta a receber código!" });
});

module.exports = router;