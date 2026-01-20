const Meteorologia = require('../models/meteorologia');

exports.listarTodos = async (req, res) => {
    try {
        // Agora recebemos 'distrito' ou 'concelho' em vez de idEstacao
        const { data, estacao, distrito, concelho, page = 1, limit = 50 } = req.query;
        const filtro = {};
        
        // Novos Filtros de Localização
        if (distrito) filtro['Localizacao.Distrito'] = new RegExp(distrito, 'i');
        if (concelho) filtro['Localizacao.Concelho'] = new RegExp(concelho, 'i');

        if (estacao) filtro.EstacaoDoAno = new RegExp(estacao, 'i');
        
        if (data) {
            const diaInicio = new Date(data);
            const diaFim = new Date(data);
            diaFim.setDate(diaFim.getDate() + 1);
            filtro.Data = { $gte: diaInicio, $lt: diaFim };
        }

        const lista = await Meteorologia.find(filtro)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ Data: -1 });

        const total = await Meteorologia.countDocuments(filtro);

        res.json({ total, paginas: Math.ceil(total / limit), paginaAtual: page, dados: lista });

    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar meteorologia", detalhe: error.message });
    }
};

exports.statsPorEstacao = async (req, res) => {
    try {
        const stats = await Meteorologia.aggregate([
            {
                $group: {
                    _id: "$EstacaoDoAno",
                    tempMedia: { $avg: "$Temperatura.Media" },
                    chuvaTotal: { $sum: "$Atmosfera.Precipitacao" },
                    diasRegistados: { $sum: 1 }
                }
            },
            { $sort: { tempMedia: -1 } }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro nas estatísticas", detalhe: error.message });
    }
};