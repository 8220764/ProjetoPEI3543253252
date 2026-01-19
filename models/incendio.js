const mongoose = require('mongoose');

const incendioSchema = new mongoose.Schema({
    Codigo: { type: String, required: true, unique: true, index: true, trim: true }, 
    Estado: { type: String, default: 'Concluido', trim: true },
    DataHoraInicio: { type: Date, required: true, index: true }, 
    DuracaoHoras: { type: Number },

    Ano: { type: Number, index: true }, 
    Mes: { type: Number, index: true }, 
    EficienciaCombate: { type: Number }, 

    Localizacao: {
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
    timestamps: true 
});

module.exports = mongoose.model('Incendio', incendioSchema);