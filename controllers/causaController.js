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
exports.criar = async (req, res) => {
    try {
        let dadosRecebidos = req.body;

        if (req.body.CatalogoCausas && req.body.CatalogoCausas.Causa) {
            dadosRecebidos = req.body.CatalogoCausas.Causa;
        } 
        
        if (Array.isArray(dadosRecebidos)) {
            dadosRecebidos = dadosRecebidos[0];
        }

        const novaCausaDados = {
            Id: dadosRecebidos.id_causa || dadosRecebidos.Id,
            Tipo: dadosRecebidos.tipo_causa || dadosRecebidos.Tipo,
            Grupo: dadosRecebidos.grupo_causa || dadosRecebidos.Grupo,
            Descricao: dadosRecebidos.descricao_causa || dadosRecebidos.Descricao
        };

        const novaCausa = new Causa(novaCausaDados);
        await novaCausa.save();

        res.status(201).json({
            mensagem: "Nova causa adicionada com sucesso!",
            dados: novaCausa
        });

    } catch (error) {
        console.error("Erro Causa:", error);
        res.status(400).json({ erro: "Erro ao criar causa", detalhe: error.message });
    }
};