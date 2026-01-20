const { XMLParser } = require('fast-xml-parser');
const validator = require('xsd-schema-validator');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuração do Parser (XML -> JSON)
const parser = new XMLParser({
    explicitArray: false,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    numberParseOptions: { hex: true, leadingZeros: false }
});

module.exports = async (req, res, next) => {
    // 1. Verificar se é XML e se tem corpo
    const contentType = req.get('Content-Type');
    
    if (contentType && 
       (contentType.includes('xml')) && 
       req.body &&
       typeof req.body === 'string') {

        console.log(`\n--> [XML Validator] A validar pedido XML na rota: ${req.path}`);

        // 2. Mapeamento das Rotas -> Ficheiros XSD
        let xsdFile = '';

        if (req.path.includes('/incendios')) xsdFile = 'ocorrencias.xsd';
        else if (req.path.includes('/bombeiros')) xsdFile = 'bombeiros.xsd';
        else if (req.path.includes('/meteorologia')) xsdFile = 'meteorologia.xsd';
        else if (req.path.includes('/causas')) xsdFile = 'causa.xsd';
        else if (req.path.includes('/localizacoes')) xsdFile = 'localizacao.xsd';
        else return next(); 

        // Caminho ABSOLUTO para o ficheiro XSD na pasta schemas
        const schemaPath = path.resolve(__dirname, '../schemas', xsdFile);

        if (!fs.existsSync(schemaPath)) {
            console.error(`❌ ERRO CRÍTICO: XSD não encontrado em: ${schemaPath}`);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Erro de configuração no servidor (Schema XSD em falta).' 
            });
        }

        // 3. Ficheiro Temporário
        const tempXmlPath = path.join(os.tmpdir(), `temp_req_${Date.now()}.xml`);

        try {
            const cleanXml = req.body.trim().replace(/^\uFEFF/, '');
            fs.writeFileSync(tempXmlPath, cleanXml, { encoding: 'utf8' });

            // 4. VALIDAR
            await validator.validateXML({ file: tempXmlPath }, schemaPath);
            console.log(`✅ [XML Validator] Sucesso! XML válido contra ${xsdFile}.`);

            // 5. Converter para JSON
            const parsed = parser.parse(cleanXml);
            req.body = parsed;
            next();

        } catch (err) {
            console.error("❌ [XML Validator] Falha na validação XSD.");
            return res.status(400).json({
                status: 'error',
                message: "XML inválido segundo o Schema.",
                details: err.message
            });

        } finally {
            if (fs.existsSync(tempXmlPath)) try { fs.unlinkSync(tempXmlPath); } catch(e) {}
        }
    } else {
        next();
    }
};