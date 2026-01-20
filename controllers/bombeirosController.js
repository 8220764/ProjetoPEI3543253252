const Bombeiros = require('../models/bombeiros');

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

        res.json({
            total,
            paginas: Math.ceil(total / limit),
            paginaAtual: page,
            dados: lista
        });

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
                    totalMeios: { $sum: 1 }  
                }
            },
            { $sort: { totalMeios: -1 } } 
        ]);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ erro: "Erro nas estatísticas", detalhe: error.message });
    }
};