const Causa = require('../models/causa');

exports.listarTodas = async (req, res) => {
    try {
        const { tipo, grupo, page = 1, limit = 100 } = req.query;
        const filtro = {};

        if (tipo) filtro.Tipo = new RegExp(tipo, 'i');
        if (grupo) filtro.Grupo = new RegExp(grupo, 'i');

        const lista = await Causa.find(filtro)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Causa.countDocuments(filtro);

        res.json({ total, dados: lista });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
};