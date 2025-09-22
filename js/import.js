// CIMA Investimentos - Importação de Planilhas (CSV/Excel)

let _importSelectedFile = null;

function initializeImportUI() {
  try {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('csvFileInput');
    const templateEl = document.getElementById('csvTemplate');

    if (templateEl && typeof dataMigrator !== 'undefined' && dataMigrator.getCSVTemplate) {
      templateEl.textContent = dataMigrator.getCSVTemplate();
    }

    if (!uploadArea || !fileInput) return;

    // Clique abre seletor de arquivos
    uploadArea.addEventListener('click', () => fileInput.click());
    // Drag & drop
    ;['dragenter','dragover'].forEach(evt => {
      uploadArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.add('dragover'); });
    });
    ;['dragleave','drop'].forEach(evt => {
      uploadArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('dragover'); });
    });
    uploadArea.addEventListener('drop', e => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    });

    // Seletor de arquivo
    fileInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) onFileSelected(file);
    });
  } catch (err) {
    console.error('Erro ao inicializar UI de importação:', err);
  }
}

function onFileSelected(file) {
  _importSelectedFile = file;
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  // Lê cabeçalhos e popula mapeamento
  if (ext === 'csv') {
    readCSVHeaders(file).then(headers => setupFieldMapping(headers)).catch(err => showAlert('Erro ao ler CSV: ' + err.message, 'danger'));
  } else if (ext === 'xlsx' || ext === 'xls') {
    readExcelHeaders(file).then(headers => setupFieldMapping(headers)).catch(err => showAlert('Erro ao ler Excel: ' + err.message, 'danger'));
  } else {
    showAlert('Formato não suportado. Use CSV ou Excel.', 'warning');
  }
}

function readCSVHeaders(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const firstLine = text.split('\n').find(l => l.trim());
        if (!firstLine) return reject(new Error('Arquivo vazio'));
        const headers = dataMigrator.parseCSVLine(firstLine).map(h => h.trim());
        resolve(headers);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

function readExcelHeaders(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          return reject(new Error('Biblioteca XLSX não carregada.'));
        }
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const headerSet = new Set();
        workbook.SheetNames.forEach(name => {
          const ws = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          // Detecta a melhor linha de cabeçalho nas 5 primeiras linhas
          let bestRow = 0, bestCount = -1;
          for (let r = 0; r < Math.min(5, rows.length); r++) {
            const count = (rows[r] || []).filter(v => String(v).trim() !== '').length;
            if (count > bestCount) { bestCount = count; bestRow = r; }
          }
          (rows[bestRow] || []).forEach(h => headerSet.add(String(h).trim()));
        });
        resolve(Array.from(headerSet));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo Excel'));
    reader.readAsArrayBuffer(file);
  });
}

function setupFieldMapping(headers) {
  const fieldMapping = document.getElementById('fieldMapping');
  if (!fieldMapping) return;

  const mapSelect = (id) => document.getElementById(id);
  const selects = {
    date: mapSelect('dateFieldMapping'),
    description: mapSelect('descriptionFieldMapping'),
    result: mapSelect('resultFieldMapping'),
    capital: mapSelect('capitalFieldMapping')
  };

  Object.values(selects).forEach(sel => { if (sel) sel.innerHTML = '<option value="">Selecione...</option>'; });

  headers.forEach(h => {
    Object.values(selects).forEach(sel => {
      if (!sel) return;
      const opt = document.createElement('option');
      opt.value = h; opt.textContent = h;
      sel.appendChild(opt);
    });
  });

  // Auto-seleção por palavras-chave
  const autoPick = (sel, keywords) => {
    if (!sel) return;
    const lowerOptions = Array.from(sel.options).map(o => o.value);
    const found = lowerOptions.find(v => keywords.some(k => v.toLowerCase() === k));
    if (found) sel.value = found;
  };

  autoPick(selects.date, ['data','date']);
  autoPick(selects.description, ['descrição','descricao','description','desc']);
  autoPick(selects.result, ['resultado','result','lucro','profit']);
  autoPick(selects.capital, ['capital','total']);

  // Exibe seção de mapeamento
  fieldMapping.style.display = 'block';
  showAlert('Arquivo carregado. Configure o mapeamento e inicie a importação.', 'info');
}

async function processImport() {
  if (!_importSelectedFile) {
    showAlert('Selecione um arquivo primeiro.', 'warning');
    return;
  }

  const mapping = {
    date: document.getElementById('dateFieldMapping').value,
    description: document.getElementById('descriptionFieldMapping').value,
    result: document.getElementById('resultFieldMapping').value,
    totalCapital: document.getElementById('capitalFieldMapping').value
  };

  if (!mapping.date || !mapping.description || !mapping.result) {
    showAlert('Mapeie Data, Descrição e Resultado (%). Capital é opcional.', 'danger');
    return;
  }

  // UI de progresso
  const progress = document.getElementById('importProgress');
  const status = document.getElementById('importStatus');
  const bar = document.getElementById('progressBarFill');
  if (progress) progress.style.display = 'block';
  if (status) status.textContent = 'Lendo arquivo...';
  if (bar) bar.style.width = '20%';

  const ext = (_importSelectedFile.name.split('.').pop() || '').toLowerCase();

  try {
    let success = false;
    if (ext === 'csv') {
      success = await dataMigrator.importFromFile(_importSelectedFile, mapping);
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Lê todas as abas do Excel, concatena e processa
      if (status) status.textContent = 'Lendo planilhas (todas as abas)...';
      const rows = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            let all = [];
            wb.SheetNames.forEach(name => {
              const ws = wb.Sheets[name];
              const rowsA1 = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
              if (!rowsA1 || rowsA1.length === 0) return;
              // Detecta a melhor linha de cabeçalho nas 5 primeiras
              let bestRow = 0, bestCount = -1;
              for (let r = 0; r < Math.min(5, rowsA1.length); r++) {
                const count = (rowsA1[r] || []).filter(v => String(v).trim() !== '').length;
                if (count > bestCount) { bestCount = count; bestRow = r; }
              }
              const headers = (rowsA1[bestRow] || []).map(h => String(h).trim());
              // Constrói objetos a partir das linhas seguintes
              for (let r = bestRow + 1; r < rowsA1.length; r++) {
                const row = rowsA1[r];
                if (!row || row.every(v => String(v).trim() === '')) continue;
                const obj = {};
                headers.forEach((h, idx) => { if (h) obj[h] = row[idx]; });
                obj.__sheet = name;
                all.push(obj);
              }
            });
            resolve(all);
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo Excel'));
        reader.readAsArrayBuffer(_importSelectedFile);
      });
      if (bar) bar.style.width = '50%';
      success = await dataMigrator.processData(rows, mapping);
    } else {
      showAlert('Formato não suportado.', 'danger');
      return;
    }

    if (bar) bar.style.width = '70%';
    if (status) status.textContent = 'Recalculando saldos por cliente...';

    // Recalcula saldos por data de entrada
    recalculateBalancesAndTotals();
    saveData();

    if (bar) bar.style.width = '100%';
    if (status) status.textContent = 'Concluído!';

    showImportResults(success);
    logAction('IMPORT_COMPLETED', { success });
  } catch (error) {
    showAlert('Falha na importação: ' + error.message, 'danger');
    logAction('IMPORT_FAILED', { error: error.message });
  } finally {
    setTimeout(() => { if (document.getElementById('importProgress')) document.getElementById('importProgress').style.display = 'none'; }, 500);
  }
}

function showImportResults(success) {
  const results = document.getElementById('importResults');
  const summary = document.getElementById('importSummary');
  if (!results || !summary) return;

  const ok = success && !dataMigrator.hasErrors();
  const totalOps = systemData.operations.length;
  const totalClients = systemData.clients.length;
  const totalCapital = systemData.clients.reduce((s, c) => s + c.currentBalance, 0);

  summary.innerHTML = `
    <p>${ok ? '✅ Importação concluída com sucesso.' : '⚠️ Importação concluída com avisos/erros.'}</p>
    <ul>
      <li><strong>Sucessos:</strong> ${dataMigrator.successCount}</li>
      <li><strong>Erros:</strong> ${dataMigrator.errorCount}</li>
      <li><strong>Total de Operações:</strong> ${totalOps}</li>
      <li><strong>Clientes:</strong> ${totalClients}</li>
      <li><strong>Capital Atual:</strong> ${formatCurrency(totalCapital)}</li>
    </ul>
  `;

  results.style.display = 'block';
}

function viewImportLog() {
  try {
    const logText = dataMigrator.getImportLog();
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cima-import-log-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(dataMigrator.getImportLog());
  }
}

function cancelImport() {
  _importSelectedFile = null;
  const fm = document.getElementById('fieldMapping');
  const res = document.getElementById('importResults');
  if (fm) fm.style.display = 'none';
  if (res) res.style.display = 'none';
}

function refreshDashboard() {
  if (typeof updateAdminOverview === 'function') updateAdminOverview();
  if (typeof updateClientsTable === 'function') updateClientsTable();
  if (typeof updateOperationsTable === 'function') updateOperationsTable();
  if (typeof createPerformanceChart === 'function') setTimeout(createPerformanceChart, 50);
}

function downloadTemplate() {
  const tpl = dataMigrator.getCSVTemplate();
  const blob = new Blob([tpl], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = 'modelo-importacao-cima.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function showMappingHelp() {
  showAlert('Mapeie Data, Descrição, Resultado (%) e Capital Total conforme os cabeçalhos do seu arquivo. Suportamos CSV e Excel.', 'info');
}

// Inicializa quando a página estiver pronta
document.addEventListener('DOMContentLoaded', initializeImportUI);
