const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Bombeiros = require('../models/bombeiros');

const DATA_DIR = path.join(__dirname, '../dados');
const CSV_BOMBEIROS = path.join(DATA_DIR, 'bombeiros.csv');
const CSV_LOCALIZACAO = path.join(DATA_DIR, 'localizacao.csv');

const ANO_RELATORIO = 2024; 

async function carregarMapaDistritos() {
    const mapa = new Map();
    console.log("A carregar mapa de distritos...");
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_LOCALIZACAO)
            .pipe(csv())
            .on('data', (row) => {
                if (row.concelho && row.distrito) {
                    mapa.set(row.concelho.toUpperCase(), row.distrito.toUpperCase());
                }
            })
            .on('end', () => resolve(mapa))
            .on('error', reject);
    });
}

async function importarBombeiros() {
    try {
        await mongoose.connect(config.uri, { 
            dbName: config.dbName 
        });
        console.log("Ligado ao MongoDB. Base de dados: " + config.dbName);

        const mapaDistritos = await carregarMapaDistritos();
        const listaParaInserir = [];

        console.log("A processar bombeiros e distritos...");

        fs.createReadStream(CSV_BOMBEIROS)
            .pipe(csv())
            .on('data', (row) => {
                const concelhoRaw = row['Concelho/municipio']; 
                const numBombeiros = row['Numero_Bombeiros'];

                if (concelhoRaw) {
                    const distritoEncontrado = mapaDistritos.get(concelhoRaw.toUpperCase()) || 'Desconhecido';

                    listaParaInserir.push({
                        Ano: ANO_RELATORIO,
                        Regiao: {
                            Distrito: distritoEncontrado,
                            Concelho: concelhoRaw
                        },
                        CapacidadeOperacional: parseInt(numBombeiros, 10)
                    });
                }
            })
            .on('end', async () => {
                if (listaParaInserir.length > 0) {
                    await Bombeiros.insertMany(listaParaInserir);
                    console.log("Sucesso! Inseridos " + listaParaInserir.length + " registos de bombeiros na base de dados " + config.dbName);
                } else {
                    console.log("Aviso: Nenhum registo encontrado.");
                }
                mongoose.connection.close();
            });

    } catch (err) {
        console.error("Erro:", err);
        mongoose.connection.close();
    }
}

importarBombeiros();