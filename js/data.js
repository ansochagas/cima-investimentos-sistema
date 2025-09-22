// CIMA Investimentos - Sistema de Gestão
// Arquivo de Dados do Sistema

let systemData = {
  clients: [],
  operations: [],
  currentUser: null,
  userType: null,
};

// Função para salvar dados no localStorage (simulação de banco)
function saveData() {
  try {
    localStorage.setItem("cimaInvestmentData", JSON.stringify(systemData));
  } catch (error) {
    console.log("LocalStorage não disponível, dados mantidos em memória");
  }
}

// Função para carregar dados do localStorage
function loadData() {
  try {
    const savedData = localStorage.getItem("cimaInvestmentData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      systemData = { ...systemData, ...parsedData };
    }
  } catch (error) {
    console.log("Erro ao carregar dados salvos, usando dados padrão");
  }
}
