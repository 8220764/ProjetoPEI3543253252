const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');

const config = require('./config/db'); 

const xmlValidator = require('./middleware/xmlValidator');

const app = express();
const port = 3000;

app.use(cors());

app.use(express.json());

// Permitir XML como texto para validar
app.use(express.text({ type: ['application/xml', 'text/xml'] }));

// Ativar Validador XML
app.use(xmlValidator);

let db;

async function connectToMongo() {
    try {
        // 1. Ligação Nativa (Para o req.db e statsRoutes)
        const client = new MongoClient(config.uri); 
        await client.connect();
        db = client.db(config.dbName); 
        console.log(`🔌 [Native] Ligado à base de dados: ${config.dbName}`);

        // 2. Ligação Mongoose (OBRIGATÓRIO para os Models/Controllers funcionarem)
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log(`🔌 [Mongoose] Ligado com sucesso.`);

    } catch (error) {
        console.error("❌ Erro ao ligar à BD:", error);
    }
}

app.listen(port, async () => {
    await connectToMongo();
    console.log(`🚀 Servidor a correr em http://localhost:${port}`);
});

// Middleware para injetar a conexão nativa em todos os pedidos
app.use((req, res, next) => {
    req.db = db;
    next();
});

// --- ROTAS DA API ---

// 1. Estatísticas Gerais
const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);

// 2. Incêndios
const incendioRoutes = require('./routes/incendioRoutes');
app.use('/api/incendios', incendioRoutes);

// 3. Bombeiros
const bombeirosRoutes = require('./routes/bombeirosRoutes');
app.use('/api/bombeiros', bombeirosRoutes);

// 4. Meteorologia
const meteorologiaRoutes = require('./routes/meteorologiaRoutes');
app.use('/api/meteorologia', meteorologiaRoutes);

// 5. Causas (NOVO)
const causaRoutes = require('./routes/causaRoutes');
app.use('/api/causas', causaRoutes);

// 6. Localizações (NOVO)
const localizacaoRoutes = require('./routes/localizacaoRoutes');
app.use('/api/localizacoes', localizacaoRoutes);