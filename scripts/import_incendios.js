require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const Incendio = require('../models/incendio');

// Caminhos dos ficheiros
const DATA_DIR = path.join(__dirname, '../dados');
const CSV_INCENDIOS = path.join(DATA_DIR, 'incendios.csv');
const CSV_LOCALIZACAO = path.join(DATA_DIR, 'localizacao.csv');
const CSV_CAUSA = path.join(DATA_DIR, 'causa.csv');

// --- FUNÇÕES AUXILIARES PARA CARREGAR OS MAPAS ---

async function carregarLocalizacoes() {
    const mapa = new Map();
    console.log(" A carregar localizações...");
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_LOCALIZACAO)
            .pipe(csv())
            .on('data', (row) => {
                // Mapa: ID -> Objeto Completo
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
    console.log(" A carregar causas...");
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

// --- FUNÇÃO PRINCIPAL ---

async function importarIncendios() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(" Ligado ao MongoDB.");

        // 1. Carregar dados auxiliares para memória
        const [locMap, causaMap] = await Promise.all([
            carregarLocalizacoes(),
            carregarCausas()
        ]);
        console.log(` Auxiliares carregados: ${locMap.size} locais, ${causaMap.size} causas.`);

        const listaParaInserir = [];
        let contagemErros = 0;

        // 2. Processar Incêndios
        console.log(" A processar incêndios...");
        fs.createReadStream(CSV_INCENDIOS)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    // Buscar dados aos mapas usando os IDs
                    const loc = locMap.get(row.id_localizacao);
                    const causa = causaMap.get(row.id_causa);

                    // Construir a data correta (Data + Hora)
                    // O CSV tem data '2024-01-05 00:00:00' e hora '20' separada
                    const dataBase = new Date(row.data);
                    if (row.hora) {
                        dataBase.setHours(parseInt(row.hora, 10));
                    }

                    // Criar o objeto final
                    const novoIncendio = {
                        Codigo: row.id_incendio,
                        Estado: 'Concluido', // Histórico
                        DataHoraInicio: dataBase,
                        DuracaoHoras: parseFloat(row.duracao_horas || 0),
                        
                        Localizacao: {
                            Distrito: loc ? loc.Distrito : 'Desconhecido',
                            Concelho: loc ? loc.Concelho : 'Desconhecido',
                            Freguesia: loc ? loc.Freguesia : 'Desconhecido'
                        },
                        
                        Areas: {
                            Total: parseFloat(row.areaTotal_ha || 0),
                            Povoamento: parseFloat(row.areaPov_ha || 0),
                            Mato: parseFloat(row.areaMato_ha || 0),
                            Agricola: parseFloat(row.areaAgric_ha || 0)
                        },
                        
                        Causa: causa ? {
                            Tipo: causa.Tipo,
                            Grupo: causa.Grupo,
                            Descricao: causa.Descricao
                        } : null // Pode não ter causa apurada
                    };

                    listaParaInserir.push(novoIncendio);

                } catch (err) {
                    contagemErros++;
                }
            })
            .on('end', async () => {
                // 3. Guardar no Mongo
                if (listaParaInserir.length > 0) {
                    // await Incendio.deleteMany({}); // Descomenta se quiseres limpar antes
                    
                    // Inserimos em lotes de 1000 para não entupir a memória
                    const lote = 1000;
                    for (let i = 0; i < listaParaInserir.length; i += lote) {
                        const chunk = listaParaInserir.slice(i, i + lote);
                        await Incendio.insertMany(chunk);
                        console.log(` Inseridos ${Math.min(i + lote, listaParaInserir.length)} / ${listaParaInserir.length}`);
                    }
                    
                    console.log(` SUCESSO! Total importado: ${listaParaInserir.length}. Erros/Ignorados: ${contagemErros}`);
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error(" Erro fatal:", error);
        mongoose.connection.close();
    }
}

importarIncendios();