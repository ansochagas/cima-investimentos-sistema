// CIMA Investimentos - Sistema de Gestão
// Arquivo de Dados do Sistema

const DEMO_SYSTEM_DATA = {
  clients: [
    {
      id: 1,
      name: "João Silva",
      email: "joao@email.com",
      initialInvestment: 15000,
      currentBalance: 17610.34,
      startDate: "2026-03-09",
      password: "hashed_password_here", // Will be replaced by hashPassword
      createdAt: "2024-01-01T00:00:00.000Z",
      status: "active",
    },
  ],
  operations: [
    {
      date: "2025-10-11",
      description: "Botafogo x Flamengo - Over 2.5 gols",
      result: 1.4,
      totalCapital: 15000,
    },
    {
      date: "2025-10-24",
      description: "Real Madrid x Barcelona - Ambas marcam",
      result: 0.9,
      totalCapital: 15210,
    },
    {
      date: "2025-11-05",
      description: "Palmeiras x Atlético-MG - Handicap asiático",
      result: 1.7,
      totalCapital: 15346.89,
    },
    {
      date: "2025-11-19",
      description: "Internacional x Grêmio - Under 2.5",
      result: -0.8,
      totalCapital: 15607.78,
    },
    {
      date: "2025-11-30",
      description: "Liverpool x Chelsea - Over 3.5",
      result: 2.2,
      totalCapital: 15482.92,
    },
    {
      date: "2025-12-12",
      description: "PSG x Monaco - Vitória PSG",
      result: 1.1,
      totalCapital: 15823.54,
    },
    {
      date: "2025-12-26",
      description: "Juventus x Napoli - Empate anula",
      result: -1.3,
      totalCapital: 15997.6,
    },
    {
      date: "2026-01-08",
      description: "Corinthians x São Paulo - Over 1.5",
      result: 1.9,
      totalCapital: 15789.63,
    },
    {
      date: "2026-01-23",
      description: "Arsenal x Tottenham - Ambas marcam",
      result: 1.5,
      totalCapital: 16089.63,
    },
    {
      date: "2026-02-04",
      description: "Palmeiras x Santos - Vitória Palmeiras",
      result: 2.4,
      totalCapital: 16331.0,
    },
    {
      date: "2026-02-18",
      description: "Bayern x Leverkusen - Over 2.5",
      result: -0.7,
      totalCapital: 16722.95,
    },
    {
      date: "2026-03-02",
      description: "Palmeiras x Corinthians - WIN de 1.5%",
      result: 1.5,
      totalCapital: 16605.89,
    },
    {
      date: "2026-03-06",
      description: "Flamengo x Fluminense - WIN de 2.1%",
      result: 2.1,
      totalCapital: 16854.98,
    },
    {
      date: "2026-03-09",
      description: "Real Sociedad x Sevilla - LOSS de -0.9%",
      result: -0.9,
      totalCapital: 17208.93,
    },
    {
      date: "2026-03-12",
      description: "Manchester City x Liverpool - WIN de 1.8%",
      result: 1.8,
      totalCapital: 17053.05,
    },
    {
      date: "2026-03-14",
      description: "Botafogo x Vasco - WIN de 1.2%",
      result: 1.2,
      totalCapital: 17359.01,
    },
  ],
  currentUser: null,
  userType: null,
  auditLog: [],
};

let systemData = JSON.parse(JSON.stringify(DEMO_SYSTEM_DATA));

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
    const params = new URLSearchParams(window.location.search);
    const demoMode = params.get("demo") === "1";

    if (demoMode) {
      localStorage.removeItem("cimaInvestmentData");
      localStorage.removeItem("cimaActiveSession");
      systemData = JSON.parse(JSON.stringify(DEMO_SYSTEM_DATA));
      saveData();
      return;
    }

    const savedData = localStorage.getItem("cimaInvestmentData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      systemData = { ...systemData, ...parsedData };
    }
  } catch (error) {
    console.log("Erro ao carregar dados salvos, usando dados padrão");
  }
}
