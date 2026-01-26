const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Causa = require('../models/causa');

const CSV_FILE = path.join(__dirname, '../dados/causa.csv');

async function importarCausas() {
    try {
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log(" Ligado ao MongoDB (Causas).");

        const lista = [];

        console.log(" A ler o catálogo de Causas...");

        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (row) => {

                if (row.id_causa) {
                    lista.push({
                        Id: parseInt(row.id_causa, 10),
                        Tipo: row.tipo_causa,
                        Grupo: row.grupo_causa,
                        Descricao: row.descricao_causa
                    });
                }
            })
            .on('end', async () => {
                if (lista.length > 0) {
                    try {
                        await Causa.insertMany(lista, { ordered: false });
                        console.log(` Sucesso! Importadas ${lista.length} causas para o catálogo.`);
                    } catch (error) {
                        console.log(` Alguns registos podiam já existir (Duplicados ignorados). Total inserido: ${lista.length}`);
                    }
                } else {
                    console.log(" O ficheiro CSV estava vazio ou sem dados válidos.");
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error(" Erro ao ligar ou importar:", error);
        mongoose.connection.close();
    }
}

importarCausas();