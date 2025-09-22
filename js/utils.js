// CIMA Investimentos - Funções Utilitárias
// Sistema de Gestão de Investimentos Esportivos

// ==================== FORMATAÇÃO ====================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPercentage(value, decimals = 2) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// ==================== VALIDAÇÕES ====================
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    // Mínimo 6 caracteres, pelo menos 1 letra e 1 número
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
    return passwordRegex.test(password);
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf.charAt(10));
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/[<>]/g, '') // Remove HTML tags básicos
        .trim()
        .substring(0, 1000); // Limita tamanho
}

function validateInvestmentAmount(amount) {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= 1000 && numAmount <= 10000000;
}

// ==================== HASH DE SENHAS ====================
async function hashPassword(password) {
    // Simulação de hash (em produção usar bcrypt no backend)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'CIMA_SALT_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
    const hashedInput = await hashPassword(password);
    return hashedInput === hash;
}

// ==================== UTILITÁRIOS DE SISTEMA ====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function updateValueColor(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.remove('positive', 'negative', 'neutral');

    if (value > 0) {
        element.classList.add('positive');
    } else if (value < 0) {
        element.classList.add('negative');
    } else {
        element.classList.add('neutral');
    }
}

function showAlert(message, type = 'info', duration = 5000) {
    // Remove alertas existentes
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <div class="alert-content">
            <i class="fas ${getAlertIcon(type)}"></i>
            <span>${message}</span>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(alertDiv);

    // Auto remove após duration
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, duration);

    // Log do alerta
    logAction('ALERT', { type, message });
}

function getAlertIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

// ==================== MODAL ====================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Adiciona listener para fechar ao clicar fora
        setTimeout(() => {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeModal(modalId);
                }
            });
        }, 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';

        // Limpa formulários do modal
        const forms = modal.querySelectorAll('input, textarea, select');
        forms.forEach(input => {
            if (input.type !== 'button' && input.type !== 'submit') {
                input.value = '';
            }
        });
    }
}

// ==================== LOGS E AUDITORIA ====================
function logAction(action, details = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: action,
        user: systemData.currentUser?.name || systemData.currentUser || 'Sistema',
        userType: systemData.userType || 'system',
        details: details,
        ip: 'localhost', // Em produção capturar IP real
        userAgent: navigator.userAgent
    };

    // Adiciona ao log do sistema
    if (!systemData.auditLog) {
        systemData.auditLog = [];
    }

    systemData.auditLog.push(logEntry);

    // Mantém apenas os últimos 1000 logs
    if (systemData.auditLog.length > 1000) {
        systemData.auditLog = systemData.auditLog.slice(-1000);
    }

    console.log(`[AUDIT] ${action}:`, details);
    saveData(); // Salva logs
}

// ==================== BACKUP E RECUPERAÇÃO ====================
function createBackup() {
    const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: systemData
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cima-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logAction('BACKUP_CREATED', { size: dataStr.length });
    showAlert('Backup criado e baixado com sucesso!', 'success');
}

function restoreBackup(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);

            if (backupData.data && backupData.version) {
                // Confirma restauração
                if (confirm('Tem certeza que deseja restaurar este backup? Todos os dados atuais serão substituídos!')) {
                    systemData = { ...backupData.data };
                    saveData();
                    logAction('BACKUP_RESTORED', {
                        backupDate: backupData.timestamp,
                        version: backupData.version
                    });
                    showAlert('Backup restaurado com sucesso! Recarregando página...', 'success');
                    setTimeout(() => location.reload(), 2000);
                }
            } else {
                throw new Error('Formato de backup inválido');
            }
        } catch (error) {
            logAction('BACKUP_RESTORE_FAILED', { error: error.message });
            showAlert('Erro ao restaurar backup: Arquivo inválido!', 'danger');
        }
    };
    reader.readAsText(file);
}

// ==================== UTILITÁRIOS DE DADOS ====================
function calculateMonthlyReturn(operations, month) {
    const monthOps = operations.filter(op => op.date.startsWith(month));
    return monthOps.reduce((sum, op) => sum + op.result, 0);
}

function getClientPerformance(clientId, days = 30) {
    const client = systemData.clients.find(c => c.id === clientId);
    if (!client) return null;

    const totalCapital = systemData.clients.reduce((sum, c) => sum + c.currentBalance, 0);
    const clientProportion = client.currentBalance / totalCapital;

    const recentOps = systemData.operations
        .filter(op => {
            const opDate = new Date(op.date);
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - days);
            return opDate >= limitDate;
        })
        .map(op => ({
            ...op,
            clientImpact: (op.result / 100) * (op.totalCapital * clientProportion)
        }));

    return {
        totalReturn: recentOps.reduce((sum, op) => sum + op.result, 0),
        totalImpact: recentOps.reduce((sum, op) => sum + op.clientImpact, 0),
        operations: recentOps.length,
        averageReturn: recentOps.length > 0 ? recentOps.reduce((sum, op) => sum + op.result, 0) / recentOps.length : 0
    };
}

// ==================== ANIMAÇÕES ====================
function fadeIn(element, duration = 300) {
    element.style.opacity = 0;
    element.style.display = 'block';

    const start = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);

        element.style.opacity = progress;

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

function slideDown(element, duration = 300) {
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.style.display = 'block';

    const targetHeight = element.scrollHeight;
    const start = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);

        element.style.height = (targetHeight * progress) + 'px';

        if (progress === 1) {
            element.style.height = 'auto';
            element.style.overflow = 'visible';
        } else {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

// ==================== LOADING ====================
function showLoading(message = 'Carregando...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        </div>
    `;

    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// ==================== EXPORT/IMPORT ====================
function exportToCSV(data, filename) {
    const csvContent = convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function convertToCSV(data) {
    if (!data || !data.length) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row =>
        headers.map(header => {
            const value = row[header];
            return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
}

// ==================== RECÁLCULO DE SALDOS ====================
function recalculateBalancesAndTotals() {
    if (!systemData || !Array.isArray(systemData.clients) || !Array.isArray(systemData.operations)) {
        return;
    }

    // Reseta saldos para o aporte inicial
    systemData.clients.forEach(client => {
        client.currentBalance = client.initialInvestment;
    });

    // Ordena operações em ordem cronológica ascendente
    const ops = systemData.operations
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Reaplica cada operação e atualiza totalCapital da operação
    ops.forEach(op => {
        // Soma do capital elegível (clientes que já tinham entrado)
        const eligibleClients = systemData.clients.filter(c => !c.startDate || new Date(op.date) >= new Date(c.startDate));
        const portfolioBefore = eligibleClients.reduce((sum, c) => sum + c.currentBalance, 0);

        // Só sobrescreve totalCapital se houver clientes elegíveis; caso contrário, preserva o valor vindo do arquivo
        if (eligibleClients.length > 0) {
            op.totalCapital = portfolioBefore;
        }

        // Aplica impacto proporcional em cada cliente elegível
        eligibleClients.forEach(client => {
            const impact = (op.result / 100) * client.currentBalance;
            client.currentBalance += impact;
            if (client.currentBalance < 0) client.currentBalance = 0;
        });
    });
}

// ==================== INICIALIZAÇÃO ====================
function initializeUtils() {
    // Adiciona listeners globais
    document.addEventListener('keydown', function(e) {
        // ESC fecha modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal[style*="block"]');
            modals.forEach(modal => modal.style.display = 'none');
            document.body.style.overflow = 'auto';
        }
    });

    // Auto backup diário
    const lastBackup = localStorage.getItem('lastAutoBackup');
    const today = new Date().toDateString();

    if (lastBackup !== today) {
        setTimeout(() => {
            if (systemData.clients && systemData.clients.length > 0) {
                createAutoBackup();
                localStorage.setItem('lastAutoBackup', today);
            }
        }, 30000); // 30 segundos após carregar
    }

    logAction('UTILS_INITIALIZED');
}

function createAutoBackup() {
    const backupData = {
        timestamp: new Date().toISOString(),
        type: 'auto',
        data: systemData
    };

    try {
        localStorage.setItem('cimaAutoBackup', JSON.stringify(backupData));
        logAction('AUTO_BACKUP_CREATED', { size: JSON.stringify(backupData).length });
    } catch (error) {
        logAction('AUTO_BACKUP_FAILED', { error: error.message });
    }
}

// ==================== RESET LIMPO ====================
function clearLocalDatabase(preserveClients = true) {
    try {
        // Limpa dados em memória
        if (preserveClients) {
            systemData.operations = [];
            systemData.auditLog = [];
        } else {
            systemData.clients = [];
            systemData.operations = [];
            systemData.auditLog = [];
        }
        saveData();

        // Limpa chaves do localStorage
        const keys = [
            'cimaInvestmentData',
            'cimaAutoBackup',
            'lastAutoBackup',
            'cimaActiveSession',
            'passwordMigrationComplete'
        ];
        keys.forEach(k => localStorage.removeItem(k));

        showAlert('Banco local limpo com sucesso. Recarregando...', 'success');
        setTimeout(() => window.location.reload(), 600);
    } catch (e) {
        console.error('Erro ao limpar banco local:', e);
        showAlert('Erro ao limpar banco local.', 'danger');
    }
}
