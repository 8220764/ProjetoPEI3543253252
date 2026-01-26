const mongoose = require('mongoose');

const causaSchema = new mongoose.Schema({
    Id: { type: Number, required: true, unique: true, index: true },

    Tipo: { type: String, required: true },      
    Grupo: { type: String, required: true },     
    Descricao: { type: String, required: true }  

}, { 
    collection: 'causas' 
});

module.exports = mongoose.model('Causa', causaSchema);