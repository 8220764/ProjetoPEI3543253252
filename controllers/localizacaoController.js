const Localizacao = require('../models/localizacao');

exports.listarTodas = async (req, res) => {
    try {
        const { distrito, concelho, page = 1, limit = 100 } = req.query;
        const filtro = {};

        if (distrito) filtro.Distrito = new RegExp(distrito, 'i');
        if (concelho) filtro.Concelho = new RegExp(concelho, 'i');

        const lista = await Localizacao.find(filtro)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Localizacao.countDocuments(filtro);

        res.json({ total, dados: lista });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
};