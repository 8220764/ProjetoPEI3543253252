const mongoose = require('mongoose');

const incendioSchema = new mongoose.Schema({
    // index: true acelera as pesquisas por código
    Codigo: { type: String, required: true, unique: true, index: true, trim: true }, 

    Estado: { 
        type: String, 
        enum: ['Em Curso', 'Em Resolução', 'Concluido', 'Vigilância'],
        default: 'Concluido',
        trim: true
    },

    // index: true é CRÍTICO para filtrar por ano/mês nas estatísticas
    DataHoraInicio: { type: Date, required: true, index: true }, 
    
    DuracaoHoras: { type: Number },
    
    Localizacao: {
        // Índices aqui ajudam na query "Top N Regiões Críticas"
        Distrito: { type: String, trim: true, index: true }, 
        Concelho: { type: String, trim: true, index: true },
        Freguesia: { type: String, trim: true }
    },
    
    Areas: {
        Total: Number,      
        Povoamento: Number, 
        Mato: Number,       
        Agricola: Number    
    },
    
    Causa: {
        Tipo: { type: String, trim: true },
        Grupo: { type: String, trim: true },
        Descricao: { type: String, trim: true }
    }
}, { 
    collection: 'incendios',
    timestamps: true // Adiciona automaticamente createdAt e updatedAt
});

module.exports = mongoose.model('Incendio', incendioSchema);