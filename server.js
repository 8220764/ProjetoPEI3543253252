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

app.use(express.text({ type: ['application/xml', 'text/xml'] }));

app.use(xmlValidator);

let db;

async function connectToMongo() {
    try {
        const client = new MongoClient(config.uri); 
        await client.connect();
        db = client.db(config.dbName); 
        console.log(`[Native] Ligado à base de dados: ${config.dbName}`);

        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log(`[Mongoose] Ligado com sucesso.`);

    } catch (error) {
        console.error("Erro ao ligar à BD:", error);
    }
}

app.listen(port, async () => {
    await connectToMongo();
    console.log(`Servidor a correr em http://localhost:${port}`);
});

app.use((req, res, next) => {
    req.db = db;
    next();
});

//  ROTAS DA API 

const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);

const incendioRoutes = require('./routes/incendioRoutes');
app.use('/api/incendios', incendioRoutes);

const bombeirosRoutes = require('./routes/bombeirosRoutes');
app.use('/api/bombeiros', bombeirosRoutes);

const meteorologiaRoutes = require('./routes/meteorologiaRoutes');
app.use('/api/meteorologia', meteorologiaRoutes);

const causaRoutes = require('./routes/causaRoutes');
app.use('/api/causas', causaRoutes);

const localizacaoRoutes = require('./routes/localizacaoRoutes');
app.use('/api/localizacoes', localizacaoRoutes);