const mongoose = require('mongoose');

const meteorologiaSchema = new mongoose.Schema({
    Localizacao: {
        Distrito: { type: String, index: true },    
        Concelho: { type: String, index: true },    
        Freguesia: { type: String }                
    },

    Data: { type: Date, required: true, index: true },
    Mes: { type: Number, index: true },
    EstacaoDoAno: { type: String, index: true },

    Indicadores: {
        DiaSeco: Boolean,       
        VentoForte: Boolean     
    },

    Temperatura: {
        Maxima: Number,
        Minima: Number,
        Media: Number
    },
    
    Vento: {
        VelocidadeMaxima: Number,
        RajadaMaxima: Number,
        Direcao: Number
    },
    
    Atmosfera: {
        Precipitacao: Number,
        Pressao: Number,
        Radiacao: Number,
        Insolacao: Number
    }

}, { 
    collection: 'meteorologia' 
});

meteorologiaSchema.index({ Data: 1, 'Localizacao.Concelho': 1, 'Localizacao.Freguesia': 1 });

module.exports = mongoose.model('Meteorologia', meteorologiaSchema);