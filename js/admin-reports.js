// CIMA Investimentos - Módulo de Relatórios Administrativos

function generateReport() {
  const month = document.getElementById("reportMonth").value;
  if (!month) {
    showAlert("Selecione um mês para gerar o relatório!", "danger");
    return;
  }

  const [year, monthNum] = month.split("-");
  const monthName = new Date(year, monthNum - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const monthOperations = systemData.operations.filter((op) =>
    op.date.startsWith(month)
  );
  const totalReturn = monthOperations.reduce((sum, op) => sum + op.result, 0);
  const positiveOps = monthOperations.filter((op) => op.result > 0).length;
  const negativeOps = monthOperations.filter((op) => op.result < 0).length;
  const successRate =
    monthOperations.length > 0
      ? ((positiveOps / monthOperations.length) * 100).toFixed(1)
      : 0;

  const bestOp =
    monthOperations.length > 0
      ? monthOperations.reduce((max, op) => (op.result > max.result ? op : max))
      : null;
  const worstOp =
    monthOperations.length > 0
      ? monthOperations.reduce((min, op) => (op.result < min.result ? op : min))
      : null;

  const reportHTML = `
        <div style="margin-top: 40px; padding: 30px; background: var(--white); border-radius: 20px; box-shadow: 0 10px 40px var(--shadow); border: 1px solid rgba(212, 175, 55, 0.2);">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: var(--primary-blue); margin-bottom: 10px;">
                    <i class="fas fa-chart-bar"></i> Relatório Executivo
                </h2>
                <h3 style="color: var(--accent-gold); text-transform: capitalize;">${monthName}</h3>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${monthOperations.length}</div>
                    <div class="stat-label">
                        <i class="fas fa-calculator"></i> Total de Operações
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value ${
                      totalReturn >= 0 ? "positive" : "negative"
                    }">
                        ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%
                    </div>
                    <div class="stat-label">
                        <i class="fas fa-chart-line"></i> Retorno Total
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${successRate}%</div>
                    <div class="stat-label">
                        <i class="fas fa-target"></i> Taxa de Sucesso
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value positive">${positiveOps}</div>
                    <div class="stat-label">
                        <i class="fas fa-arrow-up"></i> Operações Positivas
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value negative">${negativeOps}</div>
                    <div class="stat-label">
                        <i class="fas fa-arrow-down"></i> Operações Negativas
                    </div>
                </div>
            </div>

            ${
              bestOp && worstOp
                ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                <div style="background: rgba(40, 167, 69, 0.1); padding: 20px; border-radius: 15px; border-left: 4px solid var(--success-green);">
                    <h4 style="color: var(--success-green); margin-bottom: 10px;">
                        <i class="fas fa-trophy"></i> Melhor Operação
                    </h4>
                    <strong>${bestOp.description}</strong><br>
                    <span style="color: var(--success-green); font-weight: bold;">+${bestOp.result.toFixed(
                      2
                    )}%</span> em ${formatDate(bestOp.date)}
                </div>
                <div style="background: rgba(220, 53, 69, 0.1); padding: 20px; border-radius: 15px; border-left: 4px solid var(--danger-red);">
                    <h4 style="color: var(--danger-red); margin-bottom: 10px;">
                        <i class="fas fa-chart-line-down"></i> Pior Operação
                    </h4>
                    <strong>${worstOp.description}</strong><br>
                    <span style="color: var(--danger-red); font-weight: bold;">${worstOp.result.toFixed(
                      2
                    )}%</span> em ${formatDate(worstOp.date)}
                </div>
            </div>
            `
                : ""
            }

            <h4 style="margin: 40px 0 20px 0; color: var(--primary-blue);">
                <i class="fas fa-list-alt"></i> Detalhes das Operações do Período:
            </h4>
            <table class="table">
                <thead>
                    <tr>
                        <th><i class="fas fa-calendar"></i> Data</th>
                        <th><i class="fas fa-info-circle"></i> Descrição</th>
                        <th><i class="fas fa-percentage"></i> Resultado</th>
                        <th><i class="fas fa-money-bill"></i> Impacto</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      monthOperations.length > 0
                        ? monthOperations
                            .map((op) => {
                              const impact =
                                (op.result / 100) * op.totalCapital;
                              return `
                            <tr>
                                <td><strong>${formatDate(op.date)}</strong></td>
                                <td>${op.description}</td>
                                <td style="color: ${
                                  op.result >= 0
                                    ? "var(--success-green)"
                                    : "var(--danger-red)"
                                };">
                                    <strong>${
                                      op.result >= 0 ? "+" : ""
                                    }${op.result.toFixed(2)}%</strong>
                                </td>
                                <td style="color: ${
                                  impact >= 0
                                    ? "var(--success-green)"
                                    : "var(--danger-red)"
                                };">
                                    <strong>${formatCurrency(impact)}</strong>
                                </td>
                            </tr>
                        `;
                            })
                            .join("")
                        : '<tr><td colspan="4" style="text-align: center; color: var(--medium-gray); padding: 40px;">Nenhuma operação encontrada neste período</td></tr>'
                    }
                </tbody>
            </table>
        </div>
    `;

  document.getElementById("reportContent").innerHTML = reportHTML;
  showAlert("Relatório gerado com sucesso!", "success");
}
