const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const config = require('./config/db'); 

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let db;

async function connectToMongo() {
    try {
        const client = new MongoClient(config.uri); 
        await client.connect();
        db = client.db(config.dbName); 
        console.log(` Ligado com sucesso à base de dados: ${config.dbName}`);
    } catch (error) {
        console.error(" Erro ao ligar à BD:", error);
    }
}

app.listen(port, async () => {
    await connectToMongo();
    console.log(` Servidor a correr em http://localhost:${port}`);
});

app.use((req, res, next) => {
    req.db = db;
    next();
});

const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);