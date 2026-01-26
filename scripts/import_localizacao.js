const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Localizacao = require('../models/localizacao');

const CSV_FILE = path.join(__dirname, '../dados/localizacao.csv');

async function importarLocalizacoes() {
    try {
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log(" Ligado ao MongoDB (Localizações).");

        const lista = [];

        console.log(" A ler o catálogo de Localizações...");

        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (row) => {
                if (row.id_localizacao) {
                    lista.push({
                        Id: parseInt(row.id_localizacao, 10),
                        Distrito: row.distrito,
                        Concelho: row.concelho,
                        Freguesia: row.freguesia || "" 
                    });
                }
            })
            .on('end', async () => {
                if (lista.length > 0) {
                    
                    const lote = 2000;
                    let inseridos = 0;
                    
                    for (let i = 0; i < lista.length; i += lote) {
                        const chunk = lista.slice(i, i + lote);
                        try {
                            await Localizacao.insertMany(chunk, { ordered: false });
                            inseridos += chunk.length;
                            console.log(` Guardados ${Math.min(i + lote, lista.length)} / ${lista.length}`);
                        } catch (e) {
                            console.log(" Lote com duplicados (ignorados).");
                        }
                    }
                    console.log(` Importação de Localizações concluída!`);
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error(" Erro:", error);
        mongoose.connection.close();
    }
}

importarLocalizacoes();