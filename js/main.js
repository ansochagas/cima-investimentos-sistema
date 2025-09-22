// CIMA Investimentos - Arquivo Principal
// Sistema de Gestão de Investimentos Esportivos

// ==================== INICIALIZAÇÃO DO SISTEMA ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
});

async function initializeSystem() {
    try {
        showLoading('Inicializando sistema...');

        // Carrega dados salvos
        loadData();

        // Migra senhas antigas para hash (apenas uma vez)
        await migratePasswordsToHash();

        // Inicializa módulos
        initializeAuth();
        initializeUtils();
        initializePDF();

        // Configura data padrão para operações
        const today = new Date().toISOString().split('T')[0];
        const operationDateInput = document.getElementById('operationDate');
        if (operationDateInput) {
            operationDateInput.value = today;
        }

        // Auto-login se houver sessão ativa
        checkActiveSession();

        // Configura listeners globais
        setupGlobalListeners();

        hideLoading();
        logAction('SYSTEM_INITIALIZED');

    } catch (error) {
        hideLoading();
        console.error('Erro na inicialização:', error);
        showAlert('Erro ao inicializar o sistema. Recarregue a página.', 'danger');
        logAction('SYSTEM_INIT_FAILED', { error: error.message });
    }
}

// ==================== MIGRAÇÃO DE SENHAS ====================
async function migratePasswordsToHash() {
    const migrationKey = 'passwordMigrationComplete';

    if (localStorage.getItem(migrationKey)) {
        return; // Migração já foi feita
    }

    try {
        // Migra senha do admin
        if (systemData.adminPassword && systemData.adminPassword === 'admin123') {
            systemData.adminPassword = await hashPassword('admin123');
        } else if (!systemData.adminPassword) {
            systemData.adminPassword = await hashPassword('CimaInvest2024!');
        }

        // Migra senhas dos clientes
        for (let client of systemData.clients) {
            if (client.password && client.password.length < 20) { // Senhas não hasheadas são curtas
                client.password = await hashPassword(client.password);
            }
        }

        saveData();
        localStorage.setItem(migrationKey, 'true');
        logAction('PASSWORD_MIGRATION_COMPLETED');

    } catch (error) {
        console.error('Erro na migração de senhas:', error);
        logAction('PASSWORD_MIGRATION_FAILED', { error: error.message });
    }
}

// ==================== SESSÃO ATIVA ====================
function checkActiveSession() {
    const activeSession = localStorage.getItem('cimaActiveSession');

    if (activeSession) {
        try {
            const session = JSON.parse(activeSession);
            const now = new Date().getTime();

            // Sessão expira em 8 horas
            if (now - session.timestamp < 8 * 60 * 60 * 1000) {
                if (session.userType === 'admin') {
                    systemData.currentUser = 'admin';
                    systemData.userType = 'admin';
                    showAdminDashboard();
                } else if (session.userType === 'client') {
                    const client = systemData.clients.find(c => c.id === session.userId);
                    if (client) {
                        systemData.currentUser = client;
                        systemData.userType = 'client';
                        showClientDashboard(client);
                    }
                }
                return;
            } else {
                // Sessão expirou
                localStorage.removeItem('cimaActiveSession');
            }
        } catch (error) {
            localStorage.removeItem('cimaActiveSession');
        }
    }
}

function saveActiveSession() {
    const session = {
        timestamp: new Date().getTime(),
        userType: systemData.userType,
        userId: systemData.userType === 'client' ? systemData.currentUser.id : null
    };

    localStorage.setItem('cimaActiveSession', JSON.stringify(session));
}

// ==================== LISTENERS GLOBAIS ====================
function setupGlobalListeners() {
    // Listener para tecla Enter em campos de login
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen && loginScreen.style.display !== 'none') {
                login();
            }
        }
    });

    // Listener para formulários (previne submit padrão)
    document.addEventListener('submit', function(e) {
        e.preventDefault();
    });

    // Listener para mudanças de foco (auto-save)
    let autoSaveTimeout;
    document.addEventListener('input', function(e) {
        if (e.target.matches('input, textarea, select')) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                if (systemData.currentUser) {
                    saveData();
                }
            }, 2000);
        }
    });

    // Listener para upload de arquivos
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', handleFileUpload);
    });

    // Listener para redimensionamento da janela
    window.addEventListener('resize', debounce(() => {
        refreshCharts();
    }, 250));

    // Listener para mudança de visibilidade da página
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && systemData.currentUser) {
            // Atualiza dados quando usuário volta à página
            refreshCurrentView();
        }
    });
}

// ==================== GESTÃO DE ARQUIVOS ====================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showAlert('Arquivo muito grande. Máximo 5MB permitido.', 'danger');
        event.target.value = '';
        return;
    }

    const allowedTypes = ['application/json', 'text/csv', 'application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('Tipo de arquivo não permitido.', 'danger');
        event.target.value = '';
        return;
    }

    // Se for backup JSON
    if (file.type === 'application/json' && file.name.includes('backup')) {
        restoreBackup(file);
    }

    logAction('FILE_UPLOADED', {
        name: file.name,
        size: file.size,
        type: file.type
    });
}

// ==================== ATUALIZAÇÃO DE VIEWS ====================
function refreshCurrentView() {
    if (systemData.userType === 'admin') {
        updateAdminOverview();
        updateClientsTable();
        updateOperationsTable();
        refreshCharts();
    } else if (systemData.userType === 'client' && systemData.currentUser) {
        showClientDashboard(systemData.currentUser);
    }
}

function refreshCharts() {
    // Refresh admin chart
    if (document.getElementById('performanceChart') && window.performanceChartInstance) {
        createPerformanceChart();
    }

    // Refresh client chart
    if (document.getElementById('clientChart') && window.clientChartInstance) {
        createClientChart(systemData.currentUser);
    }
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== NOTIFICAÇÕES PUSH ====================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            logAction('NOTIFICATION_PERMISSION', { permission });
        });
    }
}

function showNotification(title, message, type = 'info') {
    // Notificação no sistema
    showAlert(message, type);

    // Notificação push (se permitida)
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
        });

        setTimeout(() => notification.close(), 5000);

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }

    logAction('NOTIFICATION_SENT', { title, message, type });
}

// ==================== EXPORTAÇÃO DE DADOS ====================
function exportSystemData(format = 'json') {
    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
        case 'json':
            exportToJSON(timestamp);
            break;
        case 'csv':
            exportToCSV(systemData.operations, `cima-operacoes-${timestamp}.csv`);
            break;
        case 'excel':
            exportToExcel(timestamp);
            break;
        default:
            showAlert('Formato de exportação não suportado', 'danger');
    }
}

function exportToJSON(timestamp) {
    const exportData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        summary: {
            totalClients: systemData.clients.length,
            totalOperations: systemData.operations.length,
            totalCapital: systemData.clients.reduce((sum, c) => sum + c.currentBalance, 0)
        },
        clients: systemData.clients.map(client => ({
            id: client.id,
            name: client.name,
            email: client.email,
            initialInvestment: client.initialInvestment,
            currentBalance: client.currentBalance,
            startDate: client.startDate
        })),
        operations: systemData.operations
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cima-dados-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logAction('DATA_EXPORTED', { format: 'json', size: dataStr.length });
    showAlert('Dados exportados com sucesso!', 'success');
}

// ==================== VERIFICAÇÃO DE INTEGRIDADE ====================
function verifyDataIntegrity() {
    const issues = [];

    // Verifica clientes
    systemData.clients.forEach((client, index) => {
        if (!client.id || !client.name || !client.email) {
            issues.push(`Cliente ${index + 1}: Dados incompletos`);
        }
        if (client.currentBalance < 0) {
            issues.push(`Cliente ${client.name}: Saldo negativo`);
        }
        if (!validateEmail(client.email)) {
            issues.push(`Cliente ${client.name}: Email inválido`);
        }
    });

    // Verifica operações
    systemData.operations.forEach((operation, index) => {
        if (!operation.date || !operation.description || operation.result === undefined) {
            issues.push(`Operação ${index + 1}: Dados incompletos`);
        }
        if (Math.abs(operation.result) > 100) {
            issues.push(`Operação ${index + 1}: Resultado improvável (${operation.result}%)`);
        }
    });

    // Verifica duplicatas de email
    const emails = systemData.clients.map(c => c.email);
    const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicateEmails.length > 0) {
        issues.push(`Emails duplicados: ${duplicateEmails.join(', ')}`);
    }

    if (issues.length > 0) {
        logAction('DATA_INTEGRITY_ISSUES', { issues });
        console.warn('Problemas de integridade encontrados:', issues);
        return false;
    }

    logAction('DATA_INTEGRITY_OK');
    return true;
}

// ==================== PERFORMANCE MONITORING ====================
let performanceMetrics = {
    loadTime: 0,
    renderTime: 0,
    apiCalls: 0
};

function measurePerformance(action, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    performanceMetrics[action] = (performanceMetrics[action] || 0) + (end - start);

    if (end - start > 1000) { // Log operações lentas (>1s)
        logAction('SLOW_OPERATION', {
            action,
            duration: end - start
        });
    }

    return result;
}

// ==================== CLEANUP E OTIMIZAÇÃO ====================
function cleanupOldData() {
    // Remove logs antigos (mais de 30 dias)
    if (systemData.auditLog) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const originalCount = systemData.auditLog.length;
        systemData.auditLog = systemData.auditLog.filter(log =>
            new Date(log.timestamp) > thirtyDaysAgo
        );

        if (originalCount > systemData.auditLog.length) {
            logAction('OLD_LOGS_CLEANED', {
                removed: originalCount - systemData.auditLog.length
            });
        }
    }

    // Compacta operações antigas (mais de 1 ano)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const oldOperations = systemData.operations.filter(op =>
        new Date(op.date) < oneYearAgo
    );

    if (oldOperations.length > 0) {
        // Mantém apenas sumário das operações antigas
        const monthlySum = {};
        oldOperations.forEach(op => {
            const monthKey = op.date.substring(0, 7); // YYYY-MM
            if (!monthlySum[monthKey]) {
                monthlySum[monthKey] = {
                    date: monthKey + '-01',
                    description: `Sumário do mês ${monthKey}`,
                    result: 0,
                    totalCapital: op.totalCapital,
                    isCompacted: true
                };
            }
            monthlySum[monthKey].result += op.result;
        });

        // Remove operações antigas e adiciona sumários
        systemData.operations = systemData.operations.filter(op =>
            new Date(op.date) >= oneYearAgo
        );

        Object.values(monthlySum).forEach(summary => {
            systemData.operations.push(summary);
        });

        logAction('OLD_OPERATIONS_COMPACTED', {
            compacted: oldOperations.length,
            summaries: Object.keys(monthlySum).length
        });
    }

    saveData();
}

// ==================== ERROR HANDLING ====================
window.addEventListener('error', function(e) {
    logAction('JAVASCRIPT_ERROR', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno
    });
});

window.addEventListener('unhandledrejection', function(e) {
    logAction('UNHANDLED_PROMISE_REJECTION', {
        reason: e.reason?.toString() || 'Unknown reason'
    });
});

// ==================== INICIALIZAÇÃO FINAL ====================
// Executa limpeza de dados uma vez por dia
const lastCleanup = localStorage.getItem('lastDataCleanup');
const today = new Date().toDateString();

if (lastCleanup !== today) {
    setTimeout(() => {
        cleanupOldData();
        localStorage.setItem('lastDataCleanup', today);
    }, 60000); // 1 minuto após carregar
}

// Verifica integridade dos dados na inicialização
setTimeout(() => {
    verifyDataIntegrity();
}, 5000); // 5 segundos após carregar