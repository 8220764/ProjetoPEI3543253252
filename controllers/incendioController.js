const Incendio = require('../models/incendio');

// --- FUNÇÕES DE LISTAGEM ---

// 1. Listar Todos (com filtros)
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

// 2. Obter por ID
exports.obterPorId = async (req, res) => {
    try {
        const incendio = await Incendio.findOne({ Codigo: req.params.codigo });
        if (!incendio) return res.status(404).json({ erro: "Incêndio não encontrado" });
        res.json(incendio);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar detalhe", detalhe: error.message });
    }
};

// --- FUNÇÕES DE ESTATÍSTICA (QUERIES) ---

// 3. Stats Gerais por Distrito (Contagem)
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

// 4. Top 5 Distritos com mais Área Ardida
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

// 5. Evolução Temporal (Por Ano)
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

// 6. Top Causas
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

// QUERY: Média de Área Ardida (Por Distrito e Tipo de Povoamento)
exports.mediaAreaArdida = async (req, res) => {
    try {
        const { estacao, mes } = req.query;
        const pipeline = [];

        // 1. FASE DE FILTRAGEM (MATCH)
        const match = {};

        // Lógica para traduzir Estação -> Lista de Meses
        if (estacao) {
            const nomeEstacao = estacao.toLowerCase();
            let mesesAlvo = [];

            // Definição aproximada das estações em Portugal
            if (nomeEstacao.includes('ver')) mesesAlvo = [6, 7, 8, 9];      // Jun a Set
            else if (nomeEstacao.includes('inv')) mesesAlvo = [12, 1, 2, 3]; // Dez a Mar
            else if (nomeEstacao.includes('prim')) mesesAlvo = [3, 4, 5, 6]; // Mar a Jun
            else if (nomeEstacao.includes('out')) mesesAlvo = [9, 10, 11, 12]; // Set a Dez

            if (mesesAlvo.length > 0) {
                match.Mes = { $in: mesesAlvo }; // Procura se o Mês está nesta lista
            }
        }

        // Se o utilizador pediu um mês específico
        if (mes) {
            match.Mes = parseInt(mes);
        }

        // Adiciona o filtro se existir
        if (Object.keys(match).length > 0) {
            pipeline.push({ $match: match });
        }

        // 2. FASE DE AGRUPAMENTO
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

// QUERY: Correlação Fogo vs Vento (Filtra por área e busca o vento desse dia)
exports.correlacaoFogoVento = async (req, res) => {
    try {
        const minHectares = req.query.hectares ? parseFloat(req.query.hectares) : 1000;

        const stats = await Incendio.aggregate([
            // 1. FILTRO: Apanhar apenas os incêndios grandes
            { 
                $match: { "Areas.Total": { $gte: minHectares } } 
            },

            // 2. PREPARAÇÃO: Extrair a data (YYYY-MM-DD) do incêndio
            {
                $addFields: {
                    diaDoFogo: { 
                        $dateToString: { format: "%Y-%m-%d", date: "$DataHoraInicio" } 
                    }
                }
            },

            // 3. JUNÇÃO: Ir à coleção 'meteorologia' (SINGULAR, como na tua imagem!)
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
                                $expr: { $eq: ["$diaMeteo", "$$dataFogo"] } // Compara as datas
                            }
                        },
                        // Vamos buscar a VelocidadeMaxima já que não tens Média
                        { $project: { "Vento.VelocidadeMaxima": 1, _id: 0 } }
                    ],
                    as: "dadosMeteo"
                }
            },

            // 4. LIMPEZA E CÁLCULO
            {
                $project: {
                    _id: 0,
                    Codigo: 1,
                    Distrito: "$Localizacao.Distrito",
                    Concelho: "$Localizacao.Concelho",
                    Data: "$diaDoFogo",
                    AreaArdida: "$Areas.Total",
                    // Faz a média das velocidades máximas registadas nas estações nesse dia
                    VentoMaximoDia: { $avg: "$dadosMeteo.Vento.VelocidadeMaxima" } 
                }
            },

            // 5. ORDENAR: Do maior incêndio para o menor
            { $sort: { AreaArdida: -1 } }
        ]);

        res.json(stats);

    } catch (error) {
        res.status(500).json({ erro: "Erro na correlação", detalhe: error.message });
    }
};

// QUERY ADAPTADA: Sazonalidade (Área Ardida Média: Verão vs Inverno)
// Como não temos duração, comparamos a severidade (área) entre estações.
exports.eficienciaCombate = async (req, res) => {
    try {
        const stats = await Incendio.aggregate([
            {
                $group: {
                    _id: "$Localizacao.Distrito", // Agrupar por Distrito
                    
                    // Coluna 1: Média de Área no Verão (Jun-Set)
                    mediaVerao: {
                        $avg: {
                            $cond: [
                                { $in: ["$Mes", [6, 7, 8, 9]] }, // Se for Verão
                                "$Areas.Total",                   // Usa a Área Total
                                null
                            ]
                        }
                    },

                    // Coluna 2: Média de Área no Inverno (Dez-Mar)
                    mediaInverno: {
                        $avg: {
                            $cond: [
                                { $in: ["$Mes", [12, 1, 2, 3]] }, // Se for Inverno
                                "$Areas.Total",                   // Usa a Área Total
                                null
                            ]
                        }
                    }
                }
            },
            // Filtro: Remover distritos onde não houve incêndios em nenhuma das épocas
            {
                $match: {
                    $or: [
                        { mediaVerao: { $gt: 0 } },
                        { mediaInverno: { $gt: 0 } }
                    ]
                }
            },
            // Ordenar por quem tem piores incêndios no Verão
            { $sort: { mediaVerao: -1 } }
        ]);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro na estatística", detalhe: error.message });
    }
};

// QUERY OTIMIZADA: Top N Regiões Críticas (Via Dias Quentes)
exports.topRegioesCriticas = async (req, res) => {
    try {
        const tempRef = req.query.temp ? parseFloat(req.query.temp) : 30;
        const limite = req.query.n ? parseInt(req.query.n) : 5;

        // PASSO 1: Ir à Meteorologia buscar APENAS os dias quentes (Muito Rápido)
        // Usamos o acesso direto à coleção para não precisares de importar outro Model
        const diasQuentesDocs = await Incendio.db.collection('meteorologia')
            .find({ "Temperatura.Maxima": { $gte: tempRef } })
            .project({ Data: 1, _id: 0 }) // Só queremos a data
            .toArray();

        // Se não houver dias quentes, paramos já
        if (diasQuentesDocs.length === 0) {
            return res.json([]);
        }

        // Criar uma lista de textos "YYYY-MM-DD" desses dias
        const listaDiasQuentes = diasQuentesDocs.map(doc => {
            return new Date(doc.Data).toISOString().split('T')[0];
        });

        // PASSO 2: Buscar Incêndios que estejam nessa lista de dias
        const stats = await Incendio.aggregate([
            // Cria o campo data string (YYYY-MM-DD) no incêndio
            {
                $addFields: {
                    diaFogo: { 
                        $dateToString: { format: "%Y-%m-%d", date: "$DataHoraInicio" } 
                    }
                }
            },
            // O GRANDE TRUQUE: Filtrar apenas se a data estiver na lista que já temos!
            // Isto evita o $lookup pesado.
            {
                $match: {
                    diaFogo: { $in: listaDiasQuentes }
                }
            },
            // Agrupar por Distrito
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
            // 1. Agrupar Incêndios por Concelho
            {
                $group: {
                    _id: "$Localizacao.Concelho",
                    totalIncendios: { $sum: 1 }
                }
            },
            // 2. Preparar o nome para comparação (Converter para MAIÚSCULAS)
            // Isto garante que "Abrantes" (Incêndio) bate certo com "ABRANTES" (Bombeiros)
            {
                $addFields: {
                    concelhoUpper: { $toUpper: "$_id" }
                }
            },
            // 3. Lookup Inteligente (Compara Maiúsculas com Maiúsculas)
            {
                $lookup: {
                    from: "bombeiros", 
                    let: { concelhoAlvo: "$concelhoUpper" }, // Passa o nome em maiúsculas
                    pipeline: [
                        {
                            $addFields: {
                                // Converte o concelho do quartel também para maiúsculas (por segurança)
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
            // 4. Somar a CapacidadeOperacional (Nome CORRIGIDO!)
            {
                $project: {
                    _id: 0,
                    Concelho: "$_id",
                    TotalIncendios: "$totalIncendios",
                    // Aqui usamos o nome que vimos no teu JSON:
                    TotalBombeiros: { $sum: "$quarteis.CapacidadeOperacional" } 
                }
            },
            // 5. Calcular Risco e Ordenar
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