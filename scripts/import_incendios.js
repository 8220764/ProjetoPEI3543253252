const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db'); 
const Incendio = require('../models/incendio');

const DATA_DIR = path.join(__dirname, '../dados');
const CSV_INCENDIOS = path.join(DATA_DIR, 'incendios.csv');
const CSV_LOCALIZACAO = path.join(DATA_DIR, 'localizacao.csv');
const CSV_CAUSA = path.join(DATA_DIR, 'causa.csv');

async function carregarLocalizacoes() {
    const mapa = new Map();
    console.log("A carregar localizacoes...");
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_LOCALIZACAO)
            .pipe(csv())
            .on('data', (row) => {
                mapa.set(row.id_localizacao, {
                    Distrito: row.distrito,
                    Concelho: row.concelho,
                    Freguesia: row.freguesia
                });
            })
            .on('end', () => resolve(mapa))
            .on('error', reject);
    });
}

async function carregarCausas() {
    const mapa = new Map();
    console.log("A carregar causas...");
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_CAUSA)
            .pipe(csv())
            .on('data', (row) => {
                mapa.set(row.id_causa, {
                    Tipo: row.tipo_causa,
                    Grupo: row.grupo_causa,
                    Descricao: row.descricao_causa
                });
            })
            .on('end', () => resolve(mapa))
            .on('error', reject);
    });
}

async function importarIncendios() {
    try {
        await mongoose.connect(config.uri, {
            dbName: config.dbName
        });
        console.log("Ligado ao MongoDB. Base de dados: " + config.dbName);

        const [locMap, causaMap] = await Promise.all([
            carregarLocalizacoes(),
            carregarCausas()
        ]);
        
        const listaParaInserir = [];
        let contagemErros = 0;

        console.log("A processar incendios com Computed Pattern...");

        fs.createReadStream(CSV_INCENDIOS)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const loc = locMap.get(row.id_localizacao);
                    const causa = causaMap.get(row.id_causa);

                    const dataBase = new Date(row.data);
                    if (row.hora) {
                        dataBase.setHours(parseInt(row.hora, 10));
                    }

                    const anoCalc = dataBase.getFullYear();
                    const mesCalc = dataBase.getMonth() + 1;
                    const duracao = parseFloat(row.duracao_hours || 0);
                    const areaTotal = parseFloat(row.areaTotal_ha || 0);
                    
                    let eficiencia = 0;
                    if (duracao > 0) {
                        eficiencia = parseFloat((areaTotal / duracao).toFixed(4));
                    }

                    const novoIncendio = {
                        Codigo: row.id_incendio,
                        Estado: 'Concluido', 
                        DataHoraInicio: dataBase,
                        DuracaoHoras: duracao,
                        Ano: anoCalc,
                        Mes: mesCalc,
                        EficienciaCombate: eficiencia,
                        Localizacao: {
                            Distrito: loc ? loc.Distrito : 'Desconhecido',
                            Concelho: loc ? loc.Concelho : 'Desconhecido',
                            Freguesia: loc ? loc.Freguesia : 'Desconhecido'
                        },
                        Areas: {
                            Total: areaTotal,
                            Povoamento: parseFloat(row.areaPov_ha || 0),
                            Mato: parseFloat(row.areaMato_ha || 0),
                            Agricola: parseFloat(row.areaAgric_ha || 0)
                        },
                        Causa: causa ? {
                            Tipo: causa.Tipo,
                            Grupo: causa.Grupo,
                            Descricao: causa.Descricao
                        } : null 
                    };

                    listaParaInserir.push(novoIncendio);
                } catch (err) {
                    contagemErros++;
                }
            })
            .on('end', async () => {
                if (listaParaInserir.length > 0) {
                    const lote = 1000;
                    for (let i = 0; i < listaParaInserir.length; i += lote) {
                        const chunk = listaParaInserir.slice(i, i + lote);
                        await Incendio.insertMany(chunk);
                        console.log("Inseridos " + Math.min(i + lote, listaParaInserir.length) + " / " + listaParaInserir.length);
                    }
                    console.log("Sucesso! Total importado: " + listaParaInserir.length + ". Erros: " + contagemErros);
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error("Erro fatal:", error);
        mongoose.connection.close();
    }
}

importarIncendios();