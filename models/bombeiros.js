const mongoose = require('mongoose');

const bombeirosSchema = new mongoose.Schema({
    Ano: { type: Number, required: true },

    Regiao: {
        Distrito: { type: String, required: true }, 
        
        Concelho: { type: String, required: true },
        Freguesia: { type: String } 
    },
    
    CapacidadeOperacional: { type: Number, required: true }
}, { 
    collection: 'bombeiros' 
});

module.exports = mongoose.model('Bombeiros', bombeirosSchema);