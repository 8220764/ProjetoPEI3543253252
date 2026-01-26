const Bombeiros = require('../models/bombeiros');
const Localizacao = require('../models/localizacao'); 

exports.listarTodos = async (req, res) => {
    try {
        const { distrito, concelho, page = 1, limit = 50 } = req.query;
        const filtro = {};
        if (distrito) filtro['Regiao.Distrito'] = new RegExp(distrito, 'i');
        if (concelho) filtro['Regiao.Concelho'] = new RegExp(concelho, 'i');

        const lista = await Bombeiros.find(filtro)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Bombeiros.countDocuments(filtro);

        res.json({ total, paginas: Math.ceil(total / limit), paginaAtual: page, dados: lista });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar bombeiros", detalhe: error.message });
    }
};

exports.statsPorDistrito = async (req, res) => {
    try {
        const stats = await Bombeiros.aggregate([
            {
                $group: {
                    _id: "$Regiao.Distrito", 
                    totalMeios: { $sum: 1 },
                    capacidadeTotal: { $sum: "$CapacidadeOperacional" }
                }
            },
            { $sort: { totalMeios: -1 } } 
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro nas estatísticas", detalhe: error.message });
    }
};

// POST: Criar Bombeiros 
exports.criar = async (req, res) => {
    try {
        let dadosRecebidos = req.body;

        if (req.body.Bombeiros) {
            dadosRecebidos = req.body.Bombeiros;
        }

        if (Array.isArray(dadosRecebidos)) {
            dadosRecebidos = dadosRecebidos[0];
        }

        const dadosFinais = {
            Ano: dadosRecebidos.Ano,
            CapacidadeOperacional: dadosRecebidos.CapacidadeOperacional,
            Regiao: {} 
        };

        if (dadosRecebidos.LocalizacaoId) {
            const local = await Localizacao.findOne({ Id: parseInt(dadosRecebidos.LocalizacaoId) });

            if (!local) {
                return res.status(404).json({ erro: `Localização ID ${dadosRecebidos.LocalizacaoId} não encontrada.` });
            }

            dadosFinais.Regiao = {
                Distrito: local.Distrito,
                Concelho: local.Concelho,
                Freguesia: local.Freguesia || "Sede"
            };
        } else {
            return res.status(400).json({ erro: "O campo LocalizacaoId é obrigatório." });
        }

        const novoRegisto = new Bombeiros(dadosFinais);
        await novoRegisto.save();

        res.status(201).json({
            mensagem: "Meios registados com sucesso!",
            dados: novoRegisto
        });

    } catch (error) {
        console.error("Erro ao criar Bombeiros:", error);
        res.status(400).json({ erro: "Erro de validação", detalhe: error.message });
    }
};