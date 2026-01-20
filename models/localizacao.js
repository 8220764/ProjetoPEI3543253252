const mongoose = require('mongoose');

const localizacaoSchema = new mongoose.Schema({
    // ID original do CSV (ex: 1001)
    Id: { type: Number, required: true, unique: true, index: true },

    // Dados geográficos
    Distrito: { type: String, required: true, index: true },
    Concelho: { type: String, required: true, index: true },
    Freguesia: { type: String } // Opcional (alguns registos podem não ter)

}, { 
    collection: 'localizacoes' 
});

module.exports = mongoose.model('Localizacao', localizacaoSchema);