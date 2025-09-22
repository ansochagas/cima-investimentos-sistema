// CIMA Investimentos - Sistema de Relatórios PDF
// Geração de relatórios profissionais em PDF

// ==================== INICIALIZAÇÃO ====================
function initializePDF() {
    // Verifica se jsPDF está disponível
    if (typeof window.jsPDF === 'undefined') {
        console.warn('jsPDF não encontrado. Funcionalidade de PDF desabilitada.');
        return;
    }
    logAction('PDF_SYSTEM_INITIALIZED');
}

// ==================== RELATÓRIO EXECUTIVO ====================
function generateExecutiveReport(month = null) {
    try {
        showLoading('Gerando relatório executivo...');

        const { jsPDF } = window;
        const pdf = new jsPDF('p', 'mm', 'a4');

        // Configurações de cores
        const colors = {
            primary: [30, 58, 95],    // Azul CIMA
            gold: [212, 175, 55],     // Dourado
            success: [40, 167, 69],   // Verde
            danger: [220, 53, 69],    // Vermelho
            dark: [33, 37, 41],       // Texto escuro
            light: [248, 249, 250]    // Fundo claro
        };

        let yPosition = 20;

        // ===== CABEÇALHO =====
        pdf.setFillColor(...colors.primary);
        pdf.rect(0, 0, 210, 40, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CIMA INVESTIMENTOS', 20, 25);

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Sistema Profissional de Gestão de Investimentos Esportivos', 20, 32);

        yPosition = 55;

        // ===== TÍTULO DO RELATÓRIO =====
        const reportDate = month || new Date().toISOString().substr(0, 7);
        const monthName = new Date(reportDate + '-01').toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        });

        pdf.setTextColor(...colors.dark);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`RELATÓRIO EXECUTIVO - ${monthName.toUpperCase()}`, 20, yPosition);

        yPosition += 15;

        // ===== DADOS GERAIS =====
        const totalCapital = systemData.clients.reduce((sum, c) => sum + c.currentBalance, 0);
        const totalInitial = systemData.clients.reduce((sum, c) => sum + c.initialInvestment, 0);
        const totalProfit = totalCapital - totalInitial;
        const profitability = totalInitial > 0 ? ((totalProfit / totalInitial) * 100) : 0;

        // Filtra operações do mês
        const monthOperations = month
            ? systemData.operations.filter(op => op.date.startsWith(month))
            : systemData.operations.filter(op => op.date.startsWith(new Date().toISOString().substr(0, 7)));

        const monthlyReturn = monthOperations.reduce((sum, op) => sum + op.result, 0);
        const positiveOps = monthOperations.filter(op => op.result > 0).length;
        const negativeOps = monthOperations.filter(op => op.result < 0).length;
        const successRate = monthOperations.length > 0 ? (positiveOps / monthOperations.length) * 100 : 0;

        // ===== RESUMO EXECUTIVO =====
        pdf.setFillColor(...colors.light);
        pdf.rect(15, yPosition, 180, 50, 'F');
        pdf.setDrawColor(...colors.primary);
        pdf.rect(15, yPosition, 180, 50, 'S');

        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RESUMO EXECUTIVO', 20, yPosition + 10);

        pdf.setTextColor(...colors.dark);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        const summaryData = [
            { label: 'Capital Total Gerenciado:', value: formatCurrency(totalCapital) },
            { label: 'Total de Clientes Ativos:', value: systemData.clients.length.toString() },
            { label: 'Operações no Período:', value: monthOperations.length.toString() },
            { label: 'Taxa de Sucesso:', value: `${successRate.toFixed(1)}%` },
            { label: 'Rentabilidade Total:', value: `${profitability >= 0 ? '+' : ''}${profitability.toFixed(2)}%` }
        ];

        let summaryY = yPosition + 18;
        summaryData.forEach(item => {
            pdf.text(item.label, 20, summaryY);
            pdf.setFont('helvetica', 'bold');
            pdf.text(item.value, 120, summaryY);
            pdf.setFont('helvetica', 'normal');
            summaryY += 6;
        });

        yPosition += 65;

        // ===== PERFORMANCE MENSAL =====
        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PERFORMANCE DO PERÍODO', 20, yPosition);

        yPosition += 10;

        // Tabela de performance
        const tableData = monthOperations.map(op => [
            formatDate(op.date),
            op.description.length > 40 ? op.description.substr(0, 37) + '...' : op.description,
            `${op.result >= 0 ? '+' : ''}${op.result.toFixed(2)}%`,
            formatCurrency((op.result / 100) * op.totalCapital)
        ]);

        if (tableData.length > 0) {
            // Cabeçalho da tabela
            pdf.setFillColor(...colors.primary);
            pdf.rect(15, yPosition, 180, 8, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('DATA', 17, yPosition + 5);
            pdf.text('DESCRIÇÃO', 35, yPosition + 5);
            pdf.text('RESULTADO', 130, yPosition + 5);
            pdf.text('IMPACTO', 160, yPosition + 5);

            yPosition += 8;

            // Dados da tabela
            pdf.setTextColor(...colors.dark);
            pdf.setFont('helvetica', 'normal');

            tableData.slice(0, 15).forEach((row, index) => { // Máximo 15 operações
                if (yPosition > 250) { // Nova página se necessário
                    pdf.addPage();
                    yPosition = 20;
                }

                const bgColor = index % 2 === 0 ? [255, 255, 255] : colors.light;
                pdf.setFillColor(...bgColor);
                pdf.rect(15, yPosition, 180, 6, 'F');

                pdf.setTextColor(...colors.dark);
                pdf.text(row[0], 17, yPosition + 4);
                pdf.text(row[1], 35, yPosition + 4);

                // Colorir resultado
                const result = parseFloat(row[2]);
                pdf.setTextColor(result >= 0 ? ...colors.success : ...colors.danger);
                pdf.text(row[2], 130, yPosition + 4);

                pdf.setTextColor(result >= 0 ? ...colors.success : ...colors.danger);
                pdf.text(row[3], 160, yPosition + 4);

                yPosition += 6;
            });
        } else {
            pdf.setTextColor(...colors.dark);
            pdf.setFontSize(10);
            pdf.text('Nenhuma operação encontrada neste período.', 20, yPosition + 10);
        }

        yPosition += 20;

        // ===== ANÁLISE DE CLIENTES =====
        if (yPosition > 220) {
            pdf.addPage();
            yPosition = 20;
        }

        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CARTEIRA DE CLIENTES', 20, yPosition);

        yPosition += 10;

        // Top 5 clientes
        const topClients = systemData.clients
            .sort((a, b) => b.currentBalance - a.currentBalance)
            .slice(0, 5);

        pdf.setFillColor(...colors.primary);
        pdf.rect(15, yPosition, 180, 8, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CLIENTE', 17, yPosition + 5);
        pdf.text('APORTE INICIAL', 90, yPosition + 5);
        pdf.text('SALDO ATUAL', 130, yPosition + 5);
        pdf.text('RENTABILIDADE', 165, yPosition + 5);

        yPosition += 8;

        topClients.forEach((client, index) => {
            const profit = client.currentBalance - client.initialInvestment;
            const clientProfitability = ((profit / client.initialInvestment) * 100);

            const bgColor = index % 2 === 0 ? [255, 255, 255] : colors.light;
            pdf.setFillColor(...bgColor);
            pdf.rect(15, yPosition, 180, 6, 'F');

            pdf.setTextColor(...colors.dark);
            pdf.setFont('helvetica', 'normal');
            pdf.text(client.name.length > 20 ? client.name.substr(0, 17) + '...' : client.name, 17, yPosition + 4);
            pdf.text(formatCurrency(client.initialInvestment), 90, yPosition + 4);
            pdf.text(formatCurrency(client.currentBalance), 130, yPosition + 4);

            pdf.setTextColor(clientProfitability >= 0 ? ...colors.success : ...colors.danger);
            pdf.text(`${clientProfitability >= 0 ? '+' : ''}${clientProfitability.toFixed(2)}%`, 165, yPosition + 4);

            yPosition += 6;
        });

        // ===== RODAPÉ =====
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);

            pdf.setDrawColor(...colors.primary);
            pdf.line(15, 280, 195, 280);

            pdf.setTextColor(...colors.primary);
            pdf.setFontSize(8);
            pdf.text('CIMA Investimentos - Sistema de Gestão', 15, 285);
            pdf.text(`Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 290);
            pdf.text(`Página ${i} de ${pageCount}`, 175, 290);
        }

        // ===== SALVAR PDF =====
        const fileName = `CIMA-Relatorio-Executivo-${reportDate}.pdf`;
        pdf.save(fileName);

        logAction('EXECUTIVE_REPORT_GENERATED', {
            month: reportDate,
            operations: monthOperations.length,
            clients: systemData.clients.length,
            fileName: fileName
        });

        hideLoading();
        showAlert('Relatório executivo gerado com sucesso!', 'success');

        return pdf;

    } catch (error) {
        hideLoading();
        console.error('Erro ao gerar relatório:', error);
        showAlert('Erro ao gerar relatório PDF. Verifique o console.', 'danger');
        logAction('REPORT_GENERATION_FAILED', { error: error.message });
    }
}

// ==================== RELATÓRIO DO CLIENTE ====================
function generateClientReport(clientId) {
    try {
        const client = systemData.clients.find(c => c.id === clientId);
        if (!client) {
            showAlert('Cliente não encontrado!', 'danger');
            return;
        }

        showLoading(`Gerando relatório de ${client.name}...`);

        const { jsPDF } = window;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const colors = {
            primary: [30, 58, 95],
            gold: [212, 175, 55],
            success: [40, 167, 69],
            danger: [220, 53, 69],
            dark: [33, 37, 41],
            light: [248, 249, 250]
        };

        let yPosition = 20;

        // ===== CABEÇALHO =====
        pdf.setFillColor(...colors.primary);
        pdf.rect(0, 0, 210, 35, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RELATÓRIO INDIVIDUAL', 20, 20);

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('CIMA Investimentos - Portal do Investidor', 20, 28);

        yPosition = 50;

        // ===== DADOS DO CLIENTE =====
        pdf.setTextColor(...colors.dark);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`INVESTIDOR: ${client.name.toUpperCase()}`, 20, yPosition);

        yPosition += 15;

        const profit = client.currentBalance - client.initialInvestment;
        const profitability = ((profit / client.initialInvestment) * 100);

        const clientData = [
            { label: 'Data de Início:', value: formatDate(client.startDate) },
            { label: 'Aporte Inicial:', value: formatCurrency(client.initialInvestment) },
            { label: 'Saldo Atual:', value: formatCurrency(client.currentBalance) },
            { label: 'Lucro Total:', value: formatCurrency(profit) },
            { label: 'Rentabilidade:', value: `${profitability >= 0 ? '+' : ''}${profitability.toFixed(2)}%` }
        ];

        pdf.setFillColor(...colors.light);
        pdf.rect(15, yPosition, 180, 35, 'F');
        pdf.setDrawColor(...colors.primary);
        pdf.rect(15, yPosition, 180, 35, 'S');

        pdf.setTextColor(...colors.dark);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        let dataY = yPosition + 8;
        clientData.forEach(item => {
            pdf.text(item.label, 20, dataY);

            if (item.label.includes('Lucro') || item.label.includes('Rentabilidade')) {
                pdf.setTextColor(profitability >= 0 ? ...colors.success : ...colors.danger);
            }

            pdf.setFont('helvetica', 'bold');
            pdf.text(item.value, 120, dataY);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...colors.dark);
            dataY += 6;
        });

        yPosition += 50;

        // ===== HISTÓRICO DE OPERAÇÕES =====
        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('HISTÓRICO DE OPERAÇÕES (ÚLTIMAS 20)', 20, yPosition);

        yPosition += 10;

        // Calcula impacto das operações no cliente
        const totalCapital = systemData.clients.reduce((sum, c) => sum + c.currentBalance, 0);
        const clientProportion = client.currentBalance / totalCapital;

        const clientOperations = systemData.operations
            .slice(-20)
            .map(op => ({
                ...op,
                clientImpact: (op.result / 100) * (op.totalCapital * clientProportion)
            }))
            .reverse();

        if (clientOperations.length > 0) {
            // Cabeçalho da tabela
            pdf.setFillColor(...colors.primary);
            pdf.rect(15, yPosition, 180, 8, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('DATA', 17, yPosition + 5);
            pdf.text('OPERAÇÃO', 35, yPosition + 5);
            pdf.text('RESULTADO', 125, yPosition + 5);
            pdf.text('SEU GANHO/PERDA', 155, yPosition + 5);

            yPosition += 8;

            clientOperations.forEach((op, index) => {
                if (yPosition > 250) {
                    pdf.addPage();
                    yPosition = 20;
                }

                const bgColor = index % 2 === 0 ? [255, 255, 255] : colors.light;
                pdf.setFillColor(...bgColor);
                pdf.rect(15, yPosition, 180, 6, 'F');

                pdf.setTextColor(...colors.dark);
                pdf.setFont('helvetica', 'normal');
                pdf.text(formatDate(op.date), 17, yPosition + 4);

                const description = op.description.length > 35 ? op.description.substr(0, 32) + '...' : op.description;
                pdf.text(description, 35, yPosition + 4);

                // Resultado colorido
                pdf.setTextColor(op.result >= 0 ? ...colors.success : ...colors.danger);
                pdf.text(`${op.result >= 0 ? '+' : ''}${op.result.toFixed(2)}%`, 125, yPosition + 4);
                pdf.text(formatCurrency(op.clientImpact), 155, yPosition + 4);

                yPosition += 6;
            });
        }

        // ===== RODAPÉ =====
        pdf.setDrawColor(...colors.primary);
        pdf.line(15, 280, 195, 280);

        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(8);
        pdf.text('CIMA Investimentos - Relatório Confidencial', 15, 285);
        pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} para ${client.name}`, 15, 290);

        // ===== SALVAR PDF =====
        const fileName = `CIMA-Relatorio-${client.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        logAction('CLIENT_REPORT_GENERATED', {
            clientId: client.id,
            clientName: client.name,
            fileName: fileName
        });

        hideLoading();
        showAlert(`Relatório de ${client.name} gerado com sucesso!`, 'success');

        return pdf;

    } catch (error) {
        hideLoading();
        console.error('Erro ao gerar relatório do cliente:', error);
        showAlert('Erro ao gerar relatório do cliente.', 'danger');
        logAction('CLIENT_REPORT_FAILED', { clientId, error: error.message });
    }
}

// ==================== RELATÓRIO COMPLETO DE OPERAÇÕES ====================
function generateOperationsReport() {
    try {
        showLoading('Gerando relatório completo de operações...');

        const { jsPDF } = window;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const colors = {
            primary: [30, 58, 95],
            gold: [212, 175, 55],
            success: [40, 167, 69],
            danger: [220, 53, 69],
            dark: [33, 37, 41],
            light: [248, 249, 250]
        };

        let yPosition = 20;

        // ===== CABEÇALHO =====
        pdf.setFillColor(...colors.primary);
        pdf.rect(0, 0, 210, 35, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RELATÓRIO COMPLETO DE OPERAÇÕES', 20, 20);

        pdf.setFontSize(10);
        pdf.text(`Total de ${systemData.operations.length} operações registradas`, 20, 28);

        yPosition = 50;

        // ===== ESTATÍSTICAS GERAIS =====
        const totalReturn = systemData.operations.reduce((sum, op) => sum + op.result, 0);
        const positiveOps = systemData.operations.filter(op => op.result > 0).length;
        const negativeOps = systemData.operations.filter(op => op.result < 0).length;
        const avgReturn = totalReturn / systemData.operations.length;
        const successRate = (positiveOps / systemData.operations.length) * 100;

        const bestOp = systemData.operations.reduce((max, op) => op.result > max.result ? op : max);
        const worstOp = systemData.operations.reduce((min, op) => op.result < min.result ? op : min);

        const statsData = [
            { label: 'Retorno Total Acumulado:', value: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%` },
            { label: 'Retorno Médio por Operação:', value: `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%` },
            { label: 'Taxa de Sucesso:', value: `${successRate.toFixed(1)}%` },
            { label: 'Operações Positivas:', value: positiveOps.toString() },
            { label: 'Operações Negativas:', value: negativeOps.toString() },
            { label: 'Melhor Resultado:', value: `+${bestOp.result.toFixed(2)}%` },
            { label: 'Pior Resultado:', value: `${worstOp.result.toFixed(2)}%` }
        ];

        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ESTATÍSTICAS GERAIS', 20, yPosition);

        yPosition += 10;

        pdf.setFillColor(...colors.light);
        pdf.rect(15, yPosition, 180, 50, 'F');
        pdf.setDrawColor(...colors.primary);
        pdf.rect(15, yPosition, 180, 50, 'S');

        pdf.setTextColor(...colors.dark);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        let statsY = yPosition + 8;
        statsData.forEach(stat => {
            pdf.text(stat.label, 20, statsY);
            pdf.setFont('helvetica', 'bold');

            if (stat.label.includes('Retorno') && parseFloat(stat.value) < 0) {
                pdf.setTextColor(...colors.danger);
            } else if (stat.label.includes('Retorno') && parseFloat(stat.value) > 0) {
                pdf.setTextColor(...colors.success);
            }

            pdf.text(stat.value, 120, statsY);
            pdf.setTextColor(...colors.dark);
            pdf.setFont('helvetica', 'normal');
            statsY += 6;
        });

        yPosition += 65;

        // ===== TODAS AS OPERAÇÕES =====
        pdf.setTextColor(...colors.primary);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('HISTÓRICO COMPLETO', 20, yPosition);

        yPosition += 10;

        let operationCount = 0;
        const operationsPerPage = 25;

        systemData.operations.slice().reverse().forEach((op, index) => {
            if (operationCount % operationsPerPage === 0) {
                if (operationCount > 0) {
                    pdf.addPage();
                }

                yPosition = 20;

                // Cabeçalho da tabela
                pdf.setFillColor(...colors.primary);
                pdf.rect(15, yPosition, 180, 8, 'F');

                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.text('DATA', 17, yPosition + 5);
                pdf.text('DESCRIÇÃO', 35, yPosition + 5);
                pdf.text('RESULTADO', 130, yPosition + 5);
                pdf.text('IMPACTO', 160, yPosition + 5);

                yPosition += 8;
            }

            const bgColor = operationCount % 2 === 0 ? [255, 255, 255] : colors.light;
            pdf.setFillColor(...bgColor);
            pdf.rect(15, yPosition, 180, 6, 'F');

            pdf.setTextColor(...colors.dark);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(formatDate(op.date), 17, yPosition + 4);

            const description = op.description.length > 40 ? op.description.substr(0, 37) + '...' : op.description;
            pdf.text(description, 35, yPosition + 4);

            pdf.setTextColor(op.result >= 0 ? ...colors.success : ...colors.danger);
            pdf.text(`${op.result >= 0 ? '+' : ''}${op.result.toFixed(2)}%`, 130, yPosition + 4);
            pdf.text(formatCurrency((op.result / 100) * op.totalCapital), 160, yPosition + 4);

            yPosition += 6;
            operationCount++;
        });

        // ===== RODAPÉ EM TODAS AS PÁGINAS =====
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);

            pdf.setDrawColor(...colors.primary);
            pdf.line(15, 280, 195, 280);

            pdf.setTextColor(...colors.primary);
            pdf.setFontSize(8);
            pdf.text('CIMA Investimentos - Relatório de Operações', 15, 285);
            pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 290);
            pdf.text(`Página ${i} de ${pageCount}`, 175, 290);
        }

        const fileName = `CIMA-Operacoes-Completo-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        logAction('OPERATIONS_REPORT_GENERATED', {
            totalOperations: systemData.operations.length,
            fileName: fileName
        });

        hideLoading();
        showAlert('Relatório completo de operações gerado com sucesso!', 'success');

        return pdf;

    } catch (error) {
        hideLoading();
        console.error('Erro ao gerar relatório de operações:', error);
        showAlert('Erro ao gerar relatório de operações.', 'danger');
        logAction('OPERATIONS_REPORT_FAILED', { error: error.message });
    }
}

// ==================== FUNÇÕES AUXILIARES ====================
function checkPDFAvailability() {
    return typeof window.jsPDF !== 'undefined';
}

function showPDFWarning() {
    if (!checkPDFAvailability()) {
        showAlert('Biblioteca jsPDF não encontrada. Funcionalidade de PDF indisponível.', 'warning');
        return false;
    }
    return true;
}