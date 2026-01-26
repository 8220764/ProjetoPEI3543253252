const Incendio = require('../models/incendio');

const Localizacao = require('../models/localizacao'); 
const Causa = require('../models/causa');


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

// Queries

// Stats Gerais por Distrito (Contagem)
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

// Top 5 Distritos com mais Área Ardida
exports.top5DistritosArea = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            {
                $group: {
                    _id: "$Localizacao.Distrito",
                    totalArea: { $sum: "$Areas.Total" }
                }
            },
            { $sort: { totalArea: -1 } },
            { $limit: 5 }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
};

// Evolução Temporal (Por Ano)
exports.incendiosPorAno = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            {
                $group: {
                    _id: "$Ano",
                    totalIncendios: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
};

// Top Causas
exports.topCausas = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            { $match: { "Causa.Grupo": { $ne: null } } },
            {
                $group: {
                    _id: "$Causa.Grupo",
                    total: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } },
            { $limit: 5 }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
};

// Média de Área Ardida
exports.mediaAreaArdida = async (req, res) => {
    try {
        const { estacao, mes } = req.query;
        const pipeline = [];

        const match = {};

        if (estacao) {
            const nomeEstacao = estacao.toLowerCase();
            let mesesAlvo = [];

            if (nomeEstacao.includes('ver')) mesesAlvo = [6, 7, 8, 9];      
            else if (nomeEstacao.includes('inv')) mesesAlvo = [12, 1, 2, 3]; 
            else if (nomeEstacao.includes('prim')) mesesAlvo = [3, 4, 5, 6]; 
            else if (nomeEstacao.includes('out')) mesesAlvo = [9, 10, 11, 12]; 

            if (mesesAlvo.length > 0) {
                match.Mes = { $in: mesesAlvo }; 
            }
        }

       
        if (mes) {
            match.Mes = parseInt(mes);
        }

        
        if (Object.keys(match).length > 0) {
            pipeline.push({ $match: match });
        }

       
        pipeline.push({
            $group: {
                _id: "$Localizacao.Distrito", 
                mediaTotal: { $avg: "$Areas.Total" },
                mediaFloresta: { $avg: "$Areas.Povoamento" }, // Já corrigido
                mediaMato: { $avg: "$Areas.Mato" },
                mediaAgricola: { $avg: "$Areas.Agricola" }
            }
        });

        pipeline.push({ $sort: { mediaTotal: -1 } });

        const stats = await Incendio.aggregate(pipeline);
        res.json(stats);

    } catch (error) {
        res.status(500).json({ erro: "Erro ao calcular médias", detalhe: error.message });
    }
};

// QUERY: Correlação Fogo vs Vento 
exports.correlacaoFogoVento = async (req, res) => {
    try {
        const minHectares = req.query.hectares ? parseFloat(req.query.hectares) : 1000;

        const stats = await Incendio.aggregate([
            { 
                $match: { "Areas.Total": { $gte: minHectares } } 
            },

            {
                $addFields: {
                    diaDoFogo: { 
                        $dateToString: { format: "%Y-%m-%d", date: "$DataHoraInicio" } 
                    }
                }
            },

            {
                $lookup: {
                    from: "meteorologia", 
                    let: { dataFogo: "$diaDoFogo" },
                    pipeline: [
                        {
                            $addFields: {
                                diaMeteo: { 
                                    $dateToString: { format: "%Y-%m-%d", date: "$Data" } 
                                }
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: ["$diaMeteo", "$$dataFogo"] } 
                            }
                        },
                        { $project: { "Vento.VelocidadeMaxima": 1, _id: 0 } }
                    ],
                    as: "dadosMeteo"
                }
            },

            
            {
                $project: {
                    _id: 0,
                    Codigo: 1,
                    Distrito: "$Localizacao.Distrito",
                    Concelho: "$Localizacao.Concelho",
                    Data: "$diaDoFogo",
                    AreaArdida: "$Areas.Total",
                    
                    VentoMaximoDia: { $avg: "$dadosMeteo.Vento.VelocidadeMaxima" } 
                }
            },

            // ORDENAR: Do maior incêndio para o menor
            { $sort: { AreaArdida: -1 } }
        ]);

        res.json(stats);

    } catch (error) {
        res.status(500).json({ erro: "Erro na correlação", detalhe: error.message });
    }
};

// Sazonalidade (Área Ardida Média: Verão vs Inverno)
exports.eficienciaCombate = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            {
                $group: {
                    _id: "$Localizacao.Distrito", 
                    mediaVerao: {
                        $avg: {
                            $cond: [
                                { $in: ["$Mes", [6, 7, 8, 9]] }, 
                                "$Areas.Total",                   
                                null
                            ]
                        }
                    },

                    
                    mediaInverno: {
                        $avg: {
                            $cond: [
                                { $in: ["$Mes", [12, 1, 2, 3]] }, 
                                "$Areas.Total",                   
                                null
                            ]
                        }
                    }
                }
            },
           
            {
                $match: {
                    $or: [
                        { mediaVerao: { $gt: 0 } },
                        { mediaInverno: { $gt: 0 } }
                    ]
                }
            },
           
            { $sort: { mediaVerao: -1 } }
        ]);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro na estatística", detalhe: error.message });
    }
};

// QUERY: Top N Regiões Críticas (Via Dias Quentes)
exports.topRegioesCriticas = async (req, res) => {
    try {
        const tempRef = req.query.temp ? parseFloat(req.query.temp) : 30;
        const limite = req.query.n ? parseInt(req.query.n) : 5;

        
        const diasQuentesDocs = await Incendio.db.collection('meteorologia')
            .find({ "Temperatura.Maxima": { $gte: tempRef } })
            .project({ Data: 1, _id: 0 }) 
            .toArray();

       
        if (diasQuentesDocs.length === 0) {
            return res.json([]);
        }

       
        const listaDiasQuentes = diasQuentesDocs.map(doc => {
            return new Date(doc.Data).toISOString().split('T')[0];
        });

        
        const stats = await Incendio.aggregate([
           
            {
                $addFields: {
                    diaFogo: { 
                        $dateToString: { format: "%Y-%m-%d", date: "$DataHoraInicio" } 
                    }
                }
            },

            {
                $match: {
                    diaFogo: { $in: listaDiasQuentes }
                }
            },
         
            {
                $group: {
                    _id: "$Localizacao.Distrito",
                    totalOcorrencias: { $sum: 1 }
                }
            },
            { $sort: { totalOcorrencias: -1 } },
            { $limit: limite }
        ]);

        res.json(stats);

    } catch (error) {
        res.status(500).json({ erro: "Erro ao processar regiões", detalhe: error.message });
    }
};
// QUERY: Análise de Recursos (Incêndios vs Bombeiros por Concelho)
exports.analiseRecursos = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            
            {
                $group: {
                    _id: "$Localizacao.Concelho",
                    totalIncendios: { $sum: 1 }
                }
            },
            
            {
                $addFields: {
                    concelhoUpper: { $toUpper: "$_id" }
                }
            },
            {
                $lookup: {
                    from: "bombeiros", 
                    let: { concelhoAlvo: "$concelhoUpper" }, 
                    pipeline: [
                        {
                            $addFields: {
                                
                                concelhoBombeiroUpper: { $toUpper: "$Regiao.Concelho" }
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: ["$concelhoBombeiroUpper", "$$concelhoAlvo"] }
                            }
                        }
                    ],
                    as: "quarteis"
                }
            },
            
            {
                $project: {
                    _id: 0,
                    Concelho: "$_id",
                    TotalIncendios: "$totalIncendios",
                    
                    TotalBombeiros: { $sum: "$quarteis.CapacidadeOperacional" } 
                }
            },
            
            {
                $addFields: {
                    ratio: { 
                        $cond: [
                            { $gt: ["$TotalBombeiros", 0] },
                            { $divide: ["$TotalIncendios", "$TotalBombeiros"] },
                            "Sem Meios Registados"
                        ]
                    }
                }
            },
            { $sort: { TotalIncendios: -1 } }
        ]);

        res.json(stats);

    } catch (error) {
        res.status(500).json({ erro: "Erro na análise de recursos", detalhe: error.message });
    }
};

// POST: Criar Incêndio 
exports.criarIncendio = async (req, res) => {
    try {
        
        const dadosXML = req.body.DocumentoOcorrencia || req.body;

        console.log("Dados recebidos no Controller:", JSON.stringify(dadosXML, null, 2));

       
        let novoIncendioDados = {
           
            Codigo: dadosXML.CodigoIncidente || dadosXML.Codigo,
            Estado: dadosXML.EstadoOcorrencia || dadosXML.Estado,
            DataHoraInicio: dadosXML.DataHoraInicio,
            DuracaoHoras: dadosXML.DuracaoHoras,
            
           
            Ano: dadosXML.DataHoraInicio ? new Date(dadosXML.DataHoraInicio).getFullYear() : dadosXML.Ano,
            Mes: dadosXML.DataHoraInicio ? new Date(dadosXML.DataHoraInicio).getMonth() + 1 : dadosXML.Mes,
            
            Areas: {},
            Localizacao: {},
            Causa: {}
        };

        
        if (dadosXML.AreasArdidas) {
            novoIncendioDados.Areas = {
                Total: dadosXML.AreasArdidas.AreaTotal_ha,
                Povoamento: dadosXML.AreasArdidas.AreaPovoamento_ha,
                Mato: dadosXML.AreasArdidas.AreaMato_ha,
                Agricola: dadosXML.AreasArdidas.AreaAgricola_ha
            };
        } else if (dadosXML.Areas) {
            novoIncendioDados.Areas = dadosXML.Areas;
        }

        const locId = dadosXML.LocalizacaoId;
        
        if (locId) {
            const local = await Localizacao.findOne({ Id: parseInt(locId) });
            
            if (!local) {
                return res.status(404).json({ erro: `Localização ID ${locId} não encontrada.` });
            }

            novoIncendioDados.Localizacao = {
                Distrito: local.Distrito,
                Concelho: local.Concelho,
                Freguesia: local.Freguesia || "Desconhecida"
            };
        } else if (dadosXML.Localizacao) {
            novoIncendioDados.Localizacao = dadosXML.Localizacao;
        }

        const causaId = dadosXML.CausaId;

        if (causaId) {
            const causa = await Causa.findOne({ Id: parseInt(causaId) });

            if (!causa) {
                return res.status(404).json({ erro: `Causa ID ${causaId} não encontrada.` });
            }

            novoIncendioDados.Causa = {
                Tipo: causa.Tipo,
                Grupo: causa.Grupo,
                Descricao: causa.Descricao
            };
        } else if (dadosXML.Causa) {
            novoIncendioDados.Causa = dadosXML.Causa;
        }

        const novoIncendio = new Incendio(novoIncendioDados);
        
        if (!novoIncendio.Codigo) {
            novoIncendio.Codigo = "AUTO-" + Date.now();
        }

        const incendioSalvo = await novoIncendio.save();

        res.status(201).json({
            mensagem: "Incêndio criado com sucesso!",
            dados: incendioSalvo
        });

    } catch (error) {
        console.error("Erro no controlador:", error);
        res.status(400).json({ erro: "Falha ao registar incêndio", detalhe: error.message });
    }
};