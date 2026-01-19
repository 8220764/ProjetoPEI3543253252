const mongoose = require('mongoose');

const meteorologiaSchema = new mongoose.Schema({
    IdEstacao: { type: Number, required: true, index: true }, 
    
    Data: { type: Date, required: true, index: true },        
    Mes: { type: Number, index: true }, 

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
    
    Precipitacao: Number,       
    PressaoAtmosferica: Number, 
    Radiacao: Number,           
    Insolacao: Number         

}, { 
    collection: 'meteorologia' 
});

meteorologiaSchema.index({ IdEstacao: 1, Data: 1 }, { unique: true });

module.exports = mongoose.model('Meteorologia', meteorologiaSchema);