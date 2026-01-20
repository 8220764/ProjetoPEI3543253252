const mongoose = require('mongoose');

const causaSchema = new mongoose.Schema({
    // ID original do CSV (ex: 123)
    Id: { type: Number, required: true, unique: true, index: true },

    // Dados descritivos
    Tipo: { type: String, required: true },      // tipo_causa
    Grupo: { type: String, required: true },     // grupo_causa
    Descricao: { type: String, required: true }  // descricao_causa

}, { 
    collection: 'causas' 
});

module.exports = mongoose.model('Causa', causaSchema);