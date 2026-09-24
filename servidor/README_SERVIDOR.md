# 🖥️ MAX DRIVE - Servidor Backend & Painel Administrativo

Esta pasta (`servidor/`) contém **todo o ecossistema de retaguarda** do MAX DRIVE:
- Servidor HTTP/API REST nativo em Node.js (`server.js`)
- Camada de dados híbrida com suporte a PostgreSQL e fallback JSON (`db.js`)
- Banco de dados e tabelas locais (`database/`)
- Painel Administrativo completo para desktop (`admin/`)
- Bateria automatizada de testes (`test_suite.js`)

---

## 📁 Estrutura de Arquivos do Servidor

```
MAXDRIVE/
└── servidor/
    ├── admin/               # Painel Administrativo Web Desktop
    │   ├── js/admin.js      # Lógica do painel admin (busca, CSV, gestão, faturamento)
    │   └── admin.html       # Interface completa do painel admin (CSS embutido)
    ├── database/            # Armazenamento e Migrações
    │   ├── *.json           # 10 arquivos JSON de banco local (fallback/dev)
    │   ├── schema.sql       # Esquema relacional PostgreSQL
    │   └── migrate.js       # Script de migração automatizada JSON → PostgreSQL
    ├── assets/              # Ícones e logos para o painel administrativo
    ├── db.js                # Camada unificada de dados (Postgres / JSON fallback)
    ├── server.js            # Servidor HTTP/API/WebSocket e roteador de arquivos estáticos
    ├── test_suite.js        # Bateria completa de 50 testes automatizados
    ├── package.json         # Dependências do servidor (pg, dotenv, ws)
    └── .env                 # Configurações de ambiente (PORT, DATABASE_URL, FCM_SERVER_KEY)
```

---

## ⚡ Como Iniciar o Servidor

Você pode iniciar o servidor de qualquer uma das seguintes formas:

### 1. Pelo arquivo `servidor.bat` (na raiz do projeto):
Dê duplo clique em `servidor.bat` e escolha:
- `[1]` Ligar Servidor
- `[3]` Ligar App (Abre navegador automaticamente)
- `[6]` Executar Testes Automatizados

### 2. Pelo Terminal:
```bash
cd servidor
node server.js
```

O servidor iniciará em `http://localhost:3000`.

---

## 🛡️ Acesso aos Painéis

- **Aplicativo (Cliente/Motorista)**: `http://localhost:3000/`
- **Painel Administrativo**: `http://localhost:3000/admin.html` (ou `/admin`)
  - Login padrão: `admin@maxdrive.com` (ou qualquer admin cadastrado)
  - Gestão de Motoristas, Aprovação de Documentos, Corridas, Faturamento, Relatórios e Exportação CSV.

---

## 🧪 Como Rodar os Testes Automatizados

```bash
cd servidor
node test_suite.js
```
Todos os testes são executados e exibem relatório completo no terminal.
