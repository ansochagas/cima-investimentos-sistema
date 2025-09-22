# 🏆 CIMA Investimentos - Sistema de Gestão

**Sistema Profissional de Gestão de Investimentos Esportivos**

![Versão](https://img.shields.io/badge/vers%C3%A3o-1.0.0-brightgreen)
![Status](https://img.shields.io/badge/status-Ativo-success)
![Licença](https://img.shields.io/badge/licen%C3%A7a-Propriet%C3%A1rio-blue)

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Características](#-características)
- [Tecnologias](#-tecnologias)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Segurança](#-segurança)
- [API/Funcionalidades](#-apifuncionalidades)
- [FAQ](#-faq)
- [Suporte](#-suporte)

## 🎯 Visão Geral

O **CIMA Investimentos** é uma solução completa para gestão de investimentos esportivos, desenvolvido especificamente para gerenciar o capital de múltiplos clientes em apostas esportivas. O sistema oferece transparência total, relatórios detalhados e controle administrativo robusto.

### 🎮 Demo Online
Acesse: **[Sua URL aqui]**

**Credenciais de Teste:**
- **Admin**: `admin` / `CimaInvest2024!`
- **Cliente**: `joao@email.com` / `123456`

## ✨ Características

### 🔐 **Sistema de Autenticação Seguro**
- Hash SHA-256 para senhas
- Controle de tentativas de login (bloqueio após 5 tentativas)
- Sessões com expiração automática (8 horas)
- Logs de auditoria completos

### 👥 **Gestão de Clientes**
- Cadastro com validações robustas
- Acompanhamento individual de performance
- Relatórios personalizados em PDF
- Portal exclusivo para cada investidor

### 📊 **Painel Administrativo**
- Dashboard em tempo real
- Gestão de operações esportivas
- Análise de performance detalhada
- Sistema de relatórios executivos

### 📈 **Sistema de Relatórios**
- **Relatórios PDF Profissionais**: Executivos, por cliente, operações completas
- **Exportação CSV**: Dados para análise externa
- **Gráficos Interativos**: Charts.js com visualizações dinâmicas
- **Backup Automático**: Proteção de dados diária

### 🛡️ **Auditoria e Segurança**
- Logs detalhados de todas as ações
- Monitoramento de integridade de dados
- Ferramentas de diagnóstico do sistema
- Otimização automática de performance

### 📱 **Design Responsivo**
- Interface moderna e intuitiva
- Animações CSS avançadas
- Compatível com todos os dispositivos
- Tema profissional azul/dourado

## 🛠️ Tecnologias

### **Frontend**
- **HTML5**: Estrutura semântica
- **CSS3**: Animações avançadas, Grid/Flexbox
- **JavaScript ES6+**: Lógica de negócio
- **Chart.js**: Visualização de dados
- **Font Awesome**: Ícones profissionais

### **Bibliotecas**
- **jsPDF**: Geração de relatórios PDF
- **Crypto API**: Hash de senhas seguro
- **LocalStorage**: Persistência de dados

### **Arquitetura**
- **SPA (Single Page Application)**: Navegação fluida
- **Modular**: Arquivos separados por responsabilidade
- **Progressive Enhancement**: Funciona sem JavaScript básico

## 🚀 Instalação

### **Método 1: Servidor Web Local**

```bash
# Clone ou baixe os arquivos
git clone [seu-repositorio] cima-investimentos
cd cima-investimentos

# Inicie um servidor local
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve .

# Acesse: http://localhost:8000
```

### **Método 2: Apache/Nginx**

```apache
# Apache .htaccess (opcional)
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [QSA,L]
```

### **Método 3: Hospedagem Online**
Upload todos os arquivos via FTP para seu servidor web.

## 📖 Uso

### **1. Primeiro Acesso**
1. Acesse o sistema pelo navegador
2. Use as credenciais padrão: `admin` / `CimaInvest2024!`
3. **IMPORTANTE**: Altere a senha imediatamente!

### **2. Cadastro de Clientes**
```javascript
// Exemplo de cliente válido
const novoCliente = {\n  nome: \"João Silva\",\n  email: \"joao@email.com\",\n  aporteInicial: 15000.00,\n  senha: \"MinhaSenh@123\"\n};\n```

### **3. Registro de Operações**
```javascript
// Exemplo de operação
const operacao = {\n  data: \"2024-09-19\",\n  descricao: \"Liverpool vs Arsenal - Over 2.5 Gols\",\n  resultado: 2.8, // Porcentagem (positiva ou negativa)\n  observacoes: \"Aposta verde, meta batida\"\n};\n```

### **4. Geração de Relatórios**
- **Relatório Executivo**: Visão geral mensal
- **Relatório por Cliente**: Performance individual
- **Relatório de Operações**: Histórico completo

## 🏗️ Estrutura do Projeto

```
cima/
├── 📁 css/
│   └── styles.css          # Estilos modernos com animações
├── 📁 js/
│   ├── admin.js            # Painel administrativo
│   ├── auth.js             # Sistema de autenticação
│   ├── client.js           # Portal do cliente
│   ├── data.js             # Estrutura de dados
│   ├── main.js             # Inicialização do sistema
│   ├── pdf-reports.js      # Geração de PDFs
│   └── utils.js            # Funções utilitárias
├── 📄 index.html           # Página principal
├── 📄 README.md            # Esta documentação
└── 📄 .gitignore           # Arquivos ignorados (opcional)
```

### **Principais Arquivos**

#### `js/data.js` - Estrutura de Dados
```javascript
let systemData = {\n  clients: [],        // Array de clientes\n  operations: [],     // Histórico de operações\n  auditLog: [],       // Logs de auditoria\n  currentUser: null,  // Usuário atual\n  userType: null      // Tipo: 'admin' | 'client'\n};\n```

#### `js/utils.js` - Funções Essenciais
- `formatCurrency()`: Formatação monetária BRL
- `hashPassword()`: Hash seguro de senhas
- `logAction()`: Sistema de auditoria
- `showAlert()`: Notificações do sistema

## 🔒 Segurança

### **Autenticação**
```javascript
// Hash de senha com salt
const hashedPassword = await hashPassword(password + 'CIMA_SALT_2024');\n\n// Verificação\nconst isValid = await verifyPassword(inputPassword, storedHash);\n```

### **Controle de Acesso**
- Sessões com token seguro
- Logout automático por inatividade
- Validação de permissões por função

### **Auditoria**
Todas as ações são registradas:\n```javascript\nlogAction('CLIENT_CREATED', {\n  clientId: newClient.id,\n  adminUser: currentUser,\n  timestamp: new Date().toISOString()\n});\n```

### **Validações**
- CPF/Email formato válido
- Senhas com critérios de segurança
- Sanitização de inputs
- Prevenção de XSS

## 🔧 API/Funcionalidades

### **Funções Administrativas**

#### Gestão de Clientes
```javascript
// Adicionar cliente
await addClient(nome, email, investimento, senha);\n\n// Editar aporte\neditClient(clientId, novoAporte);\n\n// Listar clientes\nconst clientes = systemData.clients;\n```

#### Gestão de Operações
```javascript\n// Registrar operação\naddOperation(data, resultado, descricao);\n\n// Deletar operação\ndeleteOperation(operationIndex);\n\n// Filtrar por período\nconst operacoesMes = operations.filter(op => \n  op.date.startsWith('2024-09')\n);\n```

### **Funções do Cliente**

#### Visualização de Dados
```javascript\n// Performance do cliente\nconst performance = getClientPerformance(clientId, 30);\n// Retorna: { totalReturn, totalImpact, operations, averageReturn }\n\n// Relatório individual\ngenerateClientReport(clientId);\n```

### **Sistema de Relatórios**

#### PDF Reports
```javascript\n// Relatório executivo\ngenerateExecutiveReport('2024-09');\n\n// Relatório do cliente\ngenerateClientReport(clientId);\n\n// Relatório de operações\ngenerateOperationsReport();\n```

### **Backup e Restore**
```javascript\n// Criar backup\ncreateBackup();\n\n// Restaurar backup\nrestoreBackup(file);\n\n// Auto-backup (diário)\ncreateAutoBackup();\n```

## ❓ FAQ

### **Configuração**

**P: Como alterar a senha de administrador?**
R: Acesse Configurações → Alterar Senha no painel admin.

**P: Posso usar em produção?**
R: Sim, mas recomenda-se um banco de dados real (MySQL/PostgreSQL) para produção.

**P: Como fazer backup dos dados?**
R: Use o botão \"Backup dos Dados\" no painel administrativo ou configure backup automático.

### **Problemas Comuns**

**P: \"LocalStorage não disponível\"**
R: Verifique se o navegador suporta localStorage e se não está em modo privado.

**P: Relatórios PDF não funcionam**
R: Verifique se a biblioteca jsPDF foi carregada corretamente.

**P: Dados perdidos após atualizar página**
R: Verifique se o localStorage tem espaço disponível e não foi limpo.

### **Personalização**

**P: Como alterar as cores do sistema?**
R: Modifique as variáveis CSS em `:root` no arquivo `css/styles.css`:

```css\n:root {\n  --primary-blue: #1e3a5f;    /* Azul principal */\n  --accent-gold: #d4af37;      /* Dourado de destaque */\n  --success-green: #28a745;    /* Verde de sucesso */\n  --danger-red: #dc3545;       /* Vermelho de erro */\n}\n```

## 📞 Suporte

### **Logs de Debug**
Para debugar problemas, abra o Console do Navegador (F12):\n```javascript\n// Ver logs de auditoria\nconsole.log(systemData.auditLog);\n\n// Verificar integridade\nverifyDataIntegrity();\n\n// Informações do sistema\nshowSystemInfo();\n```

### **Resolução de Problemas**

1. **Limpar dados corrompidos**:\n   ```javascript\n   localStorage.clear();\n   location.reload();\n   ```\n\n2. **Verificar dependências**:\n   ```javascript\n   console.log('Chart.js:', typeof Chart !== 'undefined');\n   console.log('jsPDF:', typeof window.jsPDF !== 'undefined');\n   ```\n\n3. **Backup de emergência**:\n   ```javascript\n   const backup = JSON.stringify(systemData, null, 2);\n   console.log(backup); // Copie e salve\n   ```\n\n---\n\n## 📜 Licença\n\n© 2024 CIMA Investimentos. Todos os direitos reservados.\n\nEste sistema foi desenvolvido exclusivamente para CIMA Investimentos e não pode ser reproduzido, distribuído ou modificado sem autorização expressa.\n\n---\n\n## 🚀 Próximas Versões\n\n### **v1.1.0** (Planejado)\n- [ ] API REST com Node.js\n- [ ] Banco de dados MySQL\n- [ ] Sistema de notificações por email\n- [ ] App mobile (React Native)\n- [ ] Dashboard analytics avançado\n\n### **v1.2.0** (Futuro)\n- [ ] Integração com APIs de casas de apostas\n- [ ] Machine Learning para análise de padrões\n- [ ] Sistema de alertas automáticos\n- [ ] Multi-idioma (EN, ES)\n\n---\n\n**Desenvolvido com ❤️ para CIMA Investimentos**\n\n*Sistema em constante evolução - Feedback sempre bem-vindo!*