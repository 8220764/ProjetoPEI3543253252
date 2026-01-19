const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Meteorologia = require('../models/meteorologia');

const CSV_METEO = path.join(__dirname, '../dados/metereologia.csv');

const parseDataCSV = (dataStr) => {
    if (!dataStr || dataStr.length !== 8) return null;
    const ano = dataStr.substring(0, 4);
    const mes = dataStr.substring(4, 6);
    const dia = dataStr.substring(6, 8);
    return new Date(`${ano}-${mes}-${dia}`);
};

async function importarMeteo() {
    try {
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log("Ligado ao MongoDB. Base de dados: " + config.dbName);

        const listaParaInserir = [];

        console.log("A ler dados meteorologicos e a calcular datas...");
        
        fs.createReadStream(CSV_METEO)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const dataFormatada = parseDataCSV(row.data);

                    if (dataFormatada) {
                        listaParaInserir.push({
                            IdEstacao: parseInt(row.location_id, 10),
                            Data: dataFormatada,
                            Mes: dataFormatada.getMonth() + 1,
                            Temperatura: {
                                Maxima: parseFloat(row.temp_max || 0),
                                Minima: parseFloat(row.temp_min || 0),
                                Media: parseFloat(row.temp_mean || 0)
                            },
                            Vento: {
                                VelocidadeMaxima: parseFloat(row.wind_max || 0),
                                RajadaMaxima: parseFloat(row.gust_max || 0),
                                Direcao: parseInt(row.wind_dir || 0, 10)
                            },
                            Precipitacao: parseFloat(row.precip_sum || 0),
                            PressaoAtmosferica: parseFloat(row.pressure_msl || 0),
                            Radiacao: parseFloat(row.radiation || 0),
                            Insolacao: parseFloat(row.sunshine || 0)
                        });
                    }
                } catch (err) {
                }
            })
            .on('end', async () => {
                if (listaParaInserir.length > 0) {
                    const lote = 2000;
                    for (let i = 0; i < listaParaInserir.length; i += lote) {
                        const chunk = listaParaInserir.slice(i, i + lote);
                        try {
                            await Meteorologia.insertMany(chunk, { ordered: false }); 
                        } catch (e) {
                            console.log("Aviso: Alguns registos duplicados foram ignorados.");
                        }
                        console.log("Processados " + Math.min(i + lote, listaParaInserir.length) + " / " + listaParaInserir.length);
                    }
                    console.log("Importacao de Meteorologia concluida na base de dados " + config.dbName);
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error("Erro:", error);
        mongoose.connection.close();
    }
}

importarMeteo();