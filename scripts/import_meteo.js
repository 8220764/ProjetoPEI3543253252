const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Meteorologia = require('../models/meteorologia');

const CSV_METEO = path.join(__dirname, '../dados/metereologia.csv');

const parseDataCSV = (dataStr) => {
    // O teu novo CSV usa o formato YYYYMMDD (ex: 20240102)
    if (!dataStr || dataStr.length !== 8) return null;
    const ano = dataStr.substring(0, 4);
    const mes = dataStr.substring(4, 6);
    const dia = dataStr.substring(6, 8);
    return new Date(`${ano}-${mes}-${dia}`);
};

function getEstacaoDoAno(mes) {
    if (mes >= 3 && mes <= 5) return 'Primavera';
    if (mes >= 6 && mes <= 8) return 'Verão';
    if (mes >= 9 && mes <= 11) return 'Outono';
    return 'Inverno';
}

async function importarMeteo() {
    try {
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log("🔌 Ligado ao MongoDB.");

        const listaParaInserir = [];
        console.log("🌦️ A ler NOVO CSV de meteorologia...");

        fs.createReadStream(CSV_METEO)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const dataFormatada = parseDataCSV(row.data);

                    if (dataFormatada) {
                        const mesAtual = dataFormatada.getMonth() + 1;

                        listaParaInserir.push({
                            // --- LOCALIZAÇÃO (Novo mapeamento) ---
                            Localizacao: {
                                Distrito: row.district,
                                Concelho: row.municipality,
                                Freguesia: row.parish
                            },

                            Data: dataFormatada,
                            Mes: mesAtual,
                            EstacaoDoAno: getEstacaoDoAno(mesAtual),

                            // --- INDICADORES (Novos campos) ---
                            Indicadores: {
                                DiaSeco: row.is_dry_day === 'true',
                                VentoForte: row.is_high_wind_day === 'true'
                            },
                            
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
                            Atmosfera: {
                                Precipitacao: parseFloat(row.precip_sum || 0),
                                Pressao: parseFloat(row.pressure_msl || 0),
                                Radiacao: parseFloat(row.radiation || 0),
                                Insolacao: parseFloat(row.sunshine || 0)
                            }
                        });
                    }
                } catch (err) { }
            })
            .on('end', async () => {
                if (listaParaInserir.length > 0) {
                    // IMPORTANTE: Como a estrutura mudou radicalmente, apaga a coleção antiga!
                    // await Meteorologia.deleteMany({}); 
                    
                    const lote = 2000;
                    for (let i = 0; i < listaParaInserir.length; i += lote) {
                        const chunk = listaParaInserir.slice(i, i + lote);
                        try {
                            await Meteorologia.insertMany(chunk, { ordered: false }); 
                        } catch (e) {
                            // Ignora duplicados
                        }
                        console.log(`💾 Processados ${Math.min(i + lote, listaParaInserir.length)} / ${listaParaInserir.length}`);
                    }
                    console.log("✅ Importação da NOVA Meteorologia concluída!");
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error("❌ Erro:", error);
        mongoose.connection.close();
    }
}

importarMeteo();