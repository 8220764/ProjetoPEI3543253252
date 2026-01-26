const mongoose = require('mongoose');

const localizacaoSchema = new mongoose.Schema({
    Id: { type: Number, required: true, unique: true, index: true },

    Distrito: { type: String, required: true, index: true },
    Concelho: { type: String, required: true, index: true },
    Freguesia: { type: String } 

}, { 
    collection: 'localizacoes' 
});

module.exports = mongoose.model('Localizacao', localizacaoSchema);