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

//QUERY: Análise de Temperaturas por Região (Média, Máxima, Mínima)
exports.statsTemperaturaPorRegiao = async (req, res) => {
    try {
        const { dataInicio, dataFim, agruparPor } = req.query;

        const matchStage = {};
        if (dataInicio && dataFim) {
            matchStage.Data = {
                $gte: new Date(dataInicio),
                $lte: new Date(dataFim)
            };
        }

        let groupField = "$Localizacao.Distrito";
        if (agruparPor && agruparPor.toLowerCase() === 'concelho') {
            groupField = "$Localizacao.Concelho";
        }

        const stats = await Meteorologia.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: groupField,
                    tempMediaGeral: { $avg: "$Temperatura.Media" },
                    tempMaximaAbsoluta: { $max: "$Temperatura.Maxima" },
                    tempMinimaAbsoluta: { $min: "$Temperatura.Minima" },
                    totalRegistos: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    Regiao: "$_id",
                    TempMedia: { $round: ["$tempMediaGeral", 1] }, 
                    TempMaxima: "$tempMaximaAbsoluta",
                    TempMinima: "$tempMinimaAbsoluta",
                    TotalDias: "$totalRegistos"
                }
            },
            { $sort: { TempMedia: -1 } } 
        ]);

        res.json({
            periodo: {
                inicio: dataInicio || "Inicio dos Tempos",
                fim: dataFim || "Hoje"
            },
            agrupamento: agruparPor || "Distrito",
            resultados: stats
        });

    } catch (error) {
        res.status(500).json({ erro: "Erro na análise de temperaturas", detalhe: error.message });
    }
};