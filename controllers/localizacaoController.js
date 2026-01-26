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
// POST: Criar nova Localização
exports.criar = async (req, res) => {
    try {
        let dadosRecebidos = req.body;

       
        if (req.body.CatalogoLocalizacoes && req.body.CatalogoLocalizacoes.Localizacao) {
            dadosRecebidos = req.body.CatalogoLocalizacoes.Localizacao;
        }

       
        if (Array.isArray(dadosRecebidos)) {
            dadosRecebidos = dadosRecebidos[0];
        }

       
        const novaLocalizacaoDados = {
          
            Id: dadosRecebidos.id_localizacao || dadosRecebidos.Id,
            Distrito: dadosRecebidos.distrito || dadosRecebidos.Distrito,
            Concelho: dadosRecebidos.concelho || dadosRecebidos.Concelho,
            Freguesia: dadosRecebidos.freguesia || dadosRecebidos.Freguesia
        };

        const novaLocalizacao = new Localizacao(novaLocalizacaoDados);
        await novaLocalizacao.save();

        res.status(201).json({
            mensagem: "Localização criada com sucesso!",
            dados: novaLocalizacao
        });

    } catch (error) {
        console.error("Erro Localizacao:", error);
        res.status(400).json({ erro: "Erro ao criar localização", detalhe: error.message });
    }
};