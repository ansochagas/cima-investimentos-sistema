// CIMA Investimentos - Migrador de Dados
// Sistema de Importação de Planilhas (CSV/Excel)

class DataMigrator {
  constructor() {
    this.importLog = [];
    this.errors = [];
    this.successCount = 0;
    this.errorCount = 0;
  }

  // Função principal para importar dados de planilha
  async importFromFile(file, mappingConfig = {}) {
    this.resetCounters();

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let data = null;

      if (fileExtension === 'csv') {
        data = await this.parseCSV(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Para Excel, precisaríamos da biblioteca SheetJS
        this.addError('Arquivos Excel não suportados nesta versão. Use CSV por enquanto.');
        return false;
      } else {
        this.addError('Formato de arquivo não suportado. Use CSV ou Excel.');
        return false;
      }

      if (data) {
        return await this.processData(data, mappingConfig);
      }

    } catch (error) {
      this.addError(`Erro ao processar arquivo: ${error.message}`);
      return false;
    }
  }

  // Parser CSV com auto-detecção de delimitador e encoding
  async parseCSV(file) {
    const tryRead = (encoding) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, encoding);
    });

    try {
      let text = await tryRead('UTF-8');

      // Se muitos caracteres substitutos, tenta ISO-8859-1 (latin1)
      const invalidCount = (text.match(/�/g) || []).length;
      if (invalidCount > 5) {
        this.addLog('Muitos caracteres inválidos no CSV. Tentando ISO-8859-1...');
        text = await tryRead('ISO-8859-1');
      }

      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) throw new Error('Arquivo CSV deve ter cabeçalho e ao menos 1 linha');

      // Detecta delimitador por contagem: vírgula ou ponto e vírgula
      const headerLine = lines[0];
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semiCount = (headerLine.match(/;/g) || []).length;
      const delimiter = semiCount > commaCount ? ';' : ',';

      const headers = this.parseCSVLine(headerLine, delimiter);
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i], delimiter);
        if (values.length >= headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[String(header).trim()] = (values[index] ?? '').toString().trim();
          });
          data.push(row);
        }
      }

      this.addLog(`CSV parseado com sucesso: ${data.length} registros (delimitador: '${delimiter}')`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Parse de linha CSV (suporta aspas e delimitador variável)
  parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // Trata aspas duplas escapadas
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // pula a próxima aspas
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // Processa os dados importados
  async processData(data, mappingConfig) {
    const mapping = this.createMapping(data[0], mappingConfig);

    if (!mapping.isValid) {
      this.addError('Mapeamento de campos inválido. Verifique o formato da planilha.');
      return false;
    }

    this.addLog(`Iniciando processamento de ${data.length} registros...`);

    // Backup dos dados atuais
    this.backupCurrentData();

    // Processa cada linha
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const operation = this.mapRowToOperation(row, mapping);

        if (this.validateOperation(operation)) {
          this.addOperation(operation);
          this.successCount++;
          this.addLog(`✅ Linha ${i + 2}: ${operation.description} importada`);
        } else {
          this.errorCount++;
          this.addError(`❌ Linha ${i + 2}: Dados inválidos`);
        }
      } catch (error) {
        this.errorCount++;
        this.addError(`❌ Linha ${i + 2}: ${error.message}`);
      }
    }

    // Salva os dados atualizados
    saveData();

    this.addLog(`\n🎉 IMPORTAÇÃO CONCLUÍDA!`);
    this.addLog(`✅ Sucessos: ${this.successCount}`);
    this.addLog(`❌ Erros: ${this.errorCount}`);
    this.addLog(`📊 Total processado: ${data.length} registros`);

    return true;
  }

  // Cria mapeamento automático de campos
  createMapping(firstRow, customMapping = {}) {
    const headers = Object.keys(firstRow);
    const mapping = {
      date: null,
      description: null,
      result: null,
      totalCapital: null,
      isValid: false
    };

    // Mapeamento automático baseado em palavras-chave
    const dateFields = ['data', 'date', 'Data', 'DATE'];
    const descFields = ['descrição', 'descricao', 'description', 'desc', 'Descrição', 'DESCRIÇÃO'];
    const resultFields = ['resultado', 'result', 'lucro', 'profit', 'Resultado', 'RESULTADO'];
    const capitalFields = ['capital', 'Capital', 'CAPITAL', 'total', 'Total', 'TOTAL'];

    // Procura campos de data
    for (const field of dateFields) {
      if (headers.includes(field)) {
        mapping.date = field;
        break;
      }
    }

    // Procura campos de descrição
    for (const field of descFields) {
      if (headers.includes(field)) {
        mapping.description = field;
        break;
      }
    }

    // Procura campos de resultado
    for (const field of resultFields) {
      if (headers.includes(field)) {
        mapping.result = field;
        break;
      }
    }

    // Procura campos de capital
    for (const field of capitalFields) {
      if (headers.includes(field)) {
        mapping.totalCapital = field;
        break;
      }
    }

    // Aplica mapeamento customizado
    Object.assign(mapping, customMapping);

    // Valida se todos os campos obrigatórios foram mapeados
    mapping.isValid = mapping.date && mapping.description && mapping.result;

    this.addLog(`Mapeamento criado:`);
    this.addLog(`- Data: ${mapping.date}`);
    this.addLog(`- Descrição: ${mapping.description}`);
    this.addLog(`- Resultado: ${mapping.result}`);
    this.addLog(`- Capital: ${mapping.totalCapital || 'N/A'}`);
    this.addLog(`- Válido: ${mapping.isValid ? 'SIM' : 'NÃO'}`);

    return mapping;
  }

  // Mapeia linha da planilha para operação do sistema
  mapRowToOperation(row, mapping) {
    return {
      date: this.parseAnyDate(row[mapping.date]),
      description: row[mapping.description] || '',
      result: this.parseNumber(row[mapping.result]),
      totalCapital: this.parseNumber(row[mapping.totalCapital])
    };
  }

  // Aceita Date, número (serial Excel) ou string e retorna YYYY-MM-DD
  parseAnyDate(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !isNaN(value.valueOf())) {
      const yyyy = value.getFullYear();
      const mm = String(value.getMonth() + 1).padStart(2, '0');
      const dd = String(value.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof value === 'number' && isFinite(value)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + value * 86400000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return this.parseDate(String(value));
  }

  // Converte string para data no formato YYYY-MM-DD
  parseDate(dateString) {
    if (!dateString) return null;

    // Remove espaços
    const cleaned = dateString.trim();

    // Tenta diferentes formatos
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        if (format === formats[0]) {
          // YYYY-MM-DD
          return `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          // DD/MM/YYYY ou DD-MM-YYYY
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        }
      }
    }

    throw new Error(`Formato de data inválido: ${dateString}`);
  }

  // Converte string para número
  parseNumber(numberString) {
    if (!numberString) return 0;

    // Remove espaços e converte vírgulas para pontos
    const cleaned = numberString
      .toString()
      .trim()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const number = parseFloat(cleaned);

    if (isNaN(number)) {
      throw new Error(`Número inválido: ${numberString}`);
    }

    return number;
  }

  // Valida operação antes de adicionar
  validateOperation(operation) {
    if (!operation.date || !operation.description) {
      return false;
    }

    // Valida formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(operation.date)) {
      return false;
    }

    // Valida números
    if (isNaN(operation.result) || isNaN(operation.totalCapital)) {
      return false;
    }

    return true;
  }

  // Adiciona operação ao sistema
  addOperation(operation) {
    // Verifica se a operação já existe (para evitar duplicatas)
    const idx = systemData.operations.findIndex(op =>
      op.date === operation.date && op.description === operation.description
    );

    if (idx === -1) {
      systemData.operations.push(operation);
    } else {
      systemData.operations[idx] = operation;
    }

    systemData.operations.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Backup dos dados atuais
  backupCurrentData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `cimaBackup_${timestamp}`;

    try {
      localStorage.setItem(backupKey, JSON.stringify(systemData));
      this.addLog(`🔒 Backup criado: ${backupKey}`);
    } catch (error) {
      this.addLog(`⚠️ Não foi possível criar backup: ${error.message}`);
    }
  }

  // Funções de controle
  resetCounters() {
    this.importLog = [];
    this.errors = [];
    this.successCount = 0;
    this.errorCount = 0;
  }

  addLog(message) {
    this.importLog.push(`${new Date().toLocaleTimeString()}: ${message}`);
    console.log(message);
  }

  addError(message) {
    this.errors.push(message);
    this.addLog(`❌ ERRO: ${message}`);
  }

  // Getters para relatórios
  getImportLog() {
    return this.importLog.join('\n');
  }

  getErrors() {
    return this.errors;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  // Exemplo de formato esperado de CSV
  getCSVTemplate() {
    return `Data,Descrição,Resultado,Capital Total
2022-03-15,"Liverpool vs Arsenal - Over 2.5 Gols",2.8,70000
2022-03-14,"Barcelona vs Real Madrid",3.2,68500
2022-03-13,"Bayern vs Dortmund",-1.5,66000`;
  }
}

// Instância global do migrador
const dataMigrator = new DataMigrator();



