const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const config = require('../config/db'); 
const Incendio = require('../models/incendio');

const DATA_DIR = path.join(__dirname, '../dados');
const CSV_INCENDIOS = path.join(DATA_DIR, 'incendios.csv');
const CSV_LOCALIZACAO = path.join(DATA_DIR, 'localizacao.csv');
const CSV_METEO = path.join(DATA_DIR, 'metereologia.csv');
const CSV_CAUSA = path.join(DATA_DIR, 'causa.csv');

// --- NOVO: Caminho para o ficheiro de Bombeiros ---
const CSV_BOMBEIROS = path.join(DATA_DIR, 'bombeiros.csv'); 

// --- Função Auxiliar: Carregar Localizações ---
async function carregarLocalizacoes() {
    const mapa = new Map();
    console.log("📍 A carregar localizacoes...");
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

// --- Função Auxiliar: Carregar Causas ---
async function carregarCausas() {
    const mapa = new Map();
    console.log("🔥 A carregar causas...");
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

// --- Função Auxiliar: Carregar Meteorologia (Computed Pattern) ---
async function carregarMeteorologia() {
    const mapa = new Map();
    console.log("🌦️ A carregar meteorologia para memória...");
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_METEO)
            .pipe(csv())
            .on('data', (row) => {
                if(row.data && row.municipality) {
                    // Normalizamos a chave para maiúsculas para garantir match
                    const chave = `${row.data}_${row.municipality.toUpperCase()}`;
                    mapa.set(chave, {
                        VelocidadeVento: parseFloat(row.wind_max || 0),
                        Temperatura: parseFloat(row.temp_max || 0),
                        DiaSeco: row.is_dry_day === 'true',
                        VentoForte: row.is_high_wind_day === 'true'
                    });
                }
            })
            .on('end', () => {
                console.log(`✅ ${mapa.size} registos de meteorologia carregados.`);
                resolve(mapa);
            })
            .on('error', reject);
    });
}

// --- NOVO: Carregar Recursos de Bombeiros (Computed Pattern) ---
async function carregarRecursosBombeiros() {
    const mapa = new Map(); // Chave: CONCELHO, Valor: Quantidade de Meios
    console.log("🚒 A contar meios de combate por concelho...");
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_BOMBEIROS)
            .pipe(csv())
            .on('data', (row) => {
                // Ajusta 'Concelho' conforme o nome da coluna no teu CSV de bombeiros
                const concelho = row.Concelho ? row.Concelho.toUpperCase().trim() : null;
                
                if (concelho) {
                    const totalAtual = mapa.get(concelho) || 0;
                    mapa.set(concelho, totalAtual + 1);
                }
            })
            .on('end', () => {
                console.log(`✅ Recursos mapeados para ${mapa.size} concelhos.`);
                resolve(mapa);
            })
            .on('error', reject);
    });
}

async function importarIncendios() {
    try {
        await mongoose.connect(config.uri, { dbName: config.dbName });
        console.log("🔌 Ligado ao MongoDB.");

        // --- ALTERADO: Agora carregamos também os bombeiros ---
        const [locMap, causaMap, meteoMap, bombeirosMap] = await Promise.all([
            carregarLocalizacoes(),
            carregarCausas(),
            carregarMeteorologia(),
            carregarRecursosBombeiros() // <--- Chamada nova
        ]);
        
        const listaParaInserir = [];
        let contagemErros = 0;

        console.log("🚀 A processar incendios e a aplicar Computed Pattern (Meteo + Bombeiros)...");

        fs.createReadStream(CSV_INCENDIOS)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const loc = locMap.get(row.id_localizacao);
                    const causa = causaMap.get(row.id_causa);

                    const dataBase = new Date(row.data);
                    if (row.hora) dataBase.setHours(parseInt(row.hora, 10));

                    // --- Prepara dados Computed ---
                    let dadosMeteo = null;
                    let totalBombeiros = 0; // Default se não houver bombeiros

                    if (loc && loc.Concelho) {
                        const concelhoNormalizado = loc.Concelho.toUpperCase();

                        // 1. Meteorologia
                        const anoStr = dataBase.getFullYear();
                        const mesStr = String(dataBase.getMonth() + 1).padStart(2, '0');
                        const diaStr = String(dataBase.getDate()).padStart(2, '0');
                        
                        const chaveMeteo = `${anoStr}${mesStr}${diaStr}_${concelhoNormalizado}`;
                        dadosMeteo = meteoMap.get(chaveMeteo);

                        // 2. Bombeiros (NOVO)
                        // Vai buscar o total de meios fixos para este concelho
                        totalBombeiros = bombeirosMap.get(concelhoNormalizado) || 0;
                    }
                    // -----------------------------

                    const duracao = parseFloat(row.duracao_hours || 0);
                    const areaTotal = parseFloat(row.areaTotal_ha || 0);
                    
                    const novoIncendio = {
                        Codigo: row.id_incendio,
                        Estado: 'Concluido', 
                        DataHoraInicio: dataBase,
                        DuracaoHoras: duracao,
                        Ano: dataBase.getFullYear(),
                        Mes: dataBase.getMonth() + 1,
                        EficienciaCombate: duracao > 0 ? parseFloat((areaTotal / duracao).toFixed(4)) : 0,
                        
                        Localizacao: {
                            Distrito: loc ? loc.Distrito : 'Desconhecido',
                            Concelho: loc ? loc.Concelho : 'Desconhecido',
                            Freguesia: loc ? loc.Freguesia : 'Desconhecido'
                        },
                        
                        // Computed Pattern: Meteorologia
                        DadosMeteo: dadosMeteo ? {
                            VelocidadeVento: dadosMeteo.VelocidadeVento,
                            Temperatura: dadosMeteo.Temperatura,
                            DiaSeco: dadosMeteo.DiaSeco,
                            VentoForte: dadosMeteo.VentoForte
                        } : null,

                        // --- NOVO: Computed Pattern: Recursos Locais ---
                        RecursosLocais: {
                            TotalMeios: totalBombeiros
                        },
                        // -----------------------------------------------

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
                    // Dica: Limpar coleção antiga antes de inserir
                    // await Incendio.deleteMany({});
                    
                    const lote = 1000;
                    for (let i = 0; i < listaParaInserir.length; i += lote) {
                        const chunk = listaParaInserir.slice(i, i + lote);
                        try {
                            await Incendio.insertMany(chunk, { ordered: false });
                        } catch (e) {}
                        console.log(`💾 Guardados ${Math.min(i + lote, listaParaInserir.length)}`);
                    }
                    console.log("✅ Importação concluída com Sucesso!");
                }
                mongoose.connection.close();
            });

    } catch (error) {
        console.error("❌ Erro fatal:", error);
        mongoose.connection.close();
    }
}

importarIncendios();