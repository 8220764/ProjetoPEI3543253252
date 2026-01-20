const Incendio = require('../models/incendio');

exports.listarTodos = async (req, res) => {
    try {
        const { ano, distrito, concelho, page = 1, limit = 20 } = req.query;
        
        const filtro = {};
        if (ano) filtro.Ano = parseInt(ano);
        if (distrito) filtro['Localizacao.Distrito'] = new RegExp(distrito, 'i'); 
        if (concelho) filtro['Localizacao.Concelho'] = new RegExp(concelho, 'i');

        const incendios = await Incendio.find(filtro)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ DataHoraInicio: -1 }); 

        const total = await Incendio.countDocuments(filtro);

        res.json({
            total,
            paginas: Math.ceil(total / limit),
            paginaAtual: page,
            dados: incendios
        });

    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar incêndios", detalhe: error.message });
    }
};

exports.obterPorId = async (req, res) => {
    try {
        const incendio = await Incendio.findOne({ Codigo: req.params.codigo });
        if (!incendio) return res.status(404).json({ erro: "Incêndio não encontrado" });
        
        res.json(incendio);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar detalhe", detalhe: error.message });
    }
};

exports.statsPorDistrito = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            {
                $group: {
                    _id: "$Localizacao.Distrito", 
                    totalIncendios: { $sum: 1 },  
                    areaTotalQueimada: { $sum: "$Areas.Total" } 
                }
            },
            { $sort: { totalIncendios: -1 } } 
        ]);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro nas estatísticas", detalhe: error.message });
    }
};