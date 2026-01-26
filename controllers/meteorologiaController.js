const Meteorologia = require('../models/meteorologia');
const Localizacao = require('../models/localizacao');

//  Calcular Estação do Ano (Portugal)
function calcularEstacao(dataString) {
    const data = new Date(dataString);
    const mes = data.getMonth() + 1; // 1 a 12
    const dia = data.getDate();

    
    if ((mes === 3 && dia >= 20) || mes === 4 || mes === 5 || (mes === 6 && dia <= 20)) {
        return 'Primavera';
    }
    if ((mes === 6 && dia >= 21) || mes === 7 || mes === 8 || (mes === 9 && dia <= 22)) {
        return 'Verão';
    }
    if ((mes === 9 && dia >= 23) || mes === 10 || mes === 11 || (mes === 12 && dia <= 20)) {
        return 'Outono';
    }
    return 'Inverno';
}

exports.listarTodos = async (req, res) => {
    try {
        const { data, estacao, distrito, concelho, page = 1, limit = 50 } = req.query;
        const filtro = {};
        
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

exports.statsTemperaturaPorRegiao = async (req, res) => {
    try {
        const { dataInicio, dataFim, agruparPor } = req.query;
        const matchStage = {};
        if (dataInicio && dataFim) {
            matchStage.Data = { $gte: new Date(dataInicio), $lte: new Date(dataFim) };
        }

        let groupField = "$Localizacao.Distrito";
        if (agruparPor && agruparPor.toLowerCase() === 'concelho') groupField = "$Localizacao.Concelho";

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
            periodo: { inicio: dataInicio || "Inicio", fim: dataFim || "Hoje" },
            agrupamento: agruparPor || "Distrito",
            resultados: stats
        });

    } catch (error) {
        res.status(500).json({ erro: "Erro na análise de temperaturas", detalhe: error.message });
    }
};

// POST: Criar Meteorologia 
exports.criar = async (req, res) => {
    try {
        let dadosRecebidos = req.body;

        if (req.body.Meteorologia && req.body.Meteorologia.Registo) {
            dadosRecebidos = req.body.Meteorologia.Registo;
        } else if (req.body.Meteorologia) {
            dadosRecebidos = req.body.Meteorologia;
        }

        if (Array.isArray(dadosRecebidos)) dadosRecebidos = dadosRecebidos[0];
        const dadosFinais = {
            Data: dadosRecebidos.Data,
            Mes: new Date(dadosRecebidos.Data).getMonth() + 1,
            
           
            EstacaoDoAno: calcularEstacao(dadosRecebidos.Data), 
            
            Localizacao: {},
            Temperatura: dadosRecebidos.Temperatura,
            Vento: dadosRecebidos.Vento,
            Indicadores: dadosRecebidos.Indicadores,
            
            Atmosfera: {
                Precipitacao: dadosRecebidos.Atmosfera.PrecipitacaoSoma ?? dadosRecebidos.Atmosfera.Precipitacao,
                Pressao: dadosRecebidos.Atmosfera.Pressao,
                Radiacao: dadosRecebidos.Atmosfera.Radiacao,
                Insolacao: dadosRecebidos.Atmosfera.Insolacao 
            }
        };

        if (dadosRecebidos.LocalizacaoId) {
            const local = await Localizacao.findOne({ Id: parseInt(dadosRecebidos.LocalizacaoId) });
            if (!local) return res.status(404).json({ erro: `Localização ID ${dadosRecebidos.LocalizacaoId} não encontrada.` });
            dadosFinais.Localizacao = {
                Distrito: local.Distrito,
                Concelho: local.Concelho,
                Freguesia: local.Freguesia || "Desconhecida"
            };
        } else if (dadosRecebidos.Localizacao) {
            dadosFinais.Localizacao = dadosRecebidos.Localizacao;
        } else {
            return res.status(400).json({ erro: "É obrigatório indicar o LocalizacaoId." });
        }

        const novoRegisto = new Meteorologia(dadosFinais);
        await novoRegisto.save();

        res.status(201).json({
            mensagem: "Dados meteorológicos registados com sucesso!",
            dados: novoRegisto
        });

    } catch (error) {
        console.error("Erro ao criar meteo:", error);
        res.status(400).json({ erro: "Erro ao registar dados", detalhe: error.message });
    }
};