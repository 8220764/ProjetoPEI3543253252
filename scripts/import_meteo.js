const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db');
const Meteorologia = require('../models/meteorologia');

const CSV_METEO = path.join(__dirname, '../dados/metereologia.csv');

const parseNumber = (val) => {
    if (val === undefined || val === null || val.trim() === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
};

const parseBool = (val) => {
    if (!val) return false;
    return val.toLowerCase() === 'true';
};

const parseDataCSV = (dataStr) => {
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
        console.log(" Ligado ao MongoDB.");

        const listaParaInserir = [];
        console.log(" A ler NOVO CSV de meteorologia...");

        fs.createReadStream(CSV_METEO)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const dataFormatada = parseDataCSV(row.data);

                    if (dataFormatada) {
                        const mesAtual = dataFormatada.getMonth() + 1;

                        listaParaInserir.push({
                            Localizacao: {
                                Distrito: row.district,
                                Concelho: row.municipality,
                                Freguesia: row.parish
                            },

                            Data: dataFormatada,
                            Mes: mesAtual,
                            EstacaoDoAno: getEstacaoDoAno(mesAtual),

                            Indicadores: {
                                DiaSeco: parseBool(row.is_dry_day),
                                VentoForte: parseBool(row.is_high_wind_day)
                            },
                            
                            Temperatura: {
                                Maxima: parseNumber(row.temp_max),
                                Minima: parseNumber(row.temp_min),
                                Media: parseNumber(row.temp_mean)
                            },
                            
                            Vento: {
                                VelocidadeMaxima: parseNumber(row.wind_max),
                                RajadaMaxima: parseNumber(row.gust_max),
                                Direcao: parseInt(row.wind_dir || 0, 10)
                            },
                            
                            Atmosfera: {
                                Precipitacao: parseNumber(row.precip_sum),      
                                PrecipitacaoHoras: parseNumber(row.precip_hours), 
                                Pressao: parseNumber(row.pressure_msl),
                                Radiacao: parseNumber(row.radiation),
                                Insolacao: parseNumber(row.sunshine)
                            }
                        });
                    }
                } catch (err) { 
                    console.error("Erro na linha:", err.message);
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
                            
                        }
                        console.log(` Processados ${Math.min(i + lote, listaParaInserir.length)} / ${listaParaInserir.length}`);
                    }
                    console.log(" Importação da Meteorologia concluída!");
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error(" Erro fatal:", error);
        mongoose.connection.close();
    }
}

importarMeteo();