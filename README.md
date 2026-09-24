# MAX DRIVE - Mobilidade Urbana & Corridas a Preço Justo 🚗💨

Plataforma completa, moderna e responsiva para transporte urbano e corridas por aplicativo (Passageiro, Motorista e Painel Administrativo). Construída com foco em alta performance, cartografia interativa estilo Uber/99 sem custos de API (100% gratuita), geolocalização por GPS nativo, motor viário baseado no **OpenStreetMap + OSRM**, arquivamento relacional em **PostgreSQL** com fallback de segurança e suporte nativo para compilação Android via **Capacitor 8**.

---

## 📱 Visão Geral da Plataforma

O **MAX DRIVE** é composto por três módulos principais totalmente integrados em tempo real via WebSockets e APIs REST:

1. **Passageiro**:
   * **Inclusão de Endereços Inteligente:** Digitação de Origem (Partida) e Destino (Chegada) com autocompletar instantâneo de **30.011 ruas e bairros** cadastrados.
   * **Mapa Interativo Estilo Uber/99:** Marcador **A** ciano (`.pin-origin` pulsante) na partida, Marcador **B** amarelo ouro (`.pin-destination`) na chegada e traçado da rota viária com linha amarela e halo ciano.
   * **Card Flutuante Glassmorphic:** Exibição do percurso em KM e tempo estimado diretamente sobre o mapa.
   * **GPS Nativo com 1 Clique:** Botão *"📍 Centrar no meu GPS"* para captura da posição exata do smartphone, geocodificação reversa do endereço e fixação do pino A.
   * **Cálculo Oficial de Tarifas:** Preço calculado com base na tabela da cidade selecionada (Carro Comum x Moto Táxi).
   * **Ciclo da Corrida:** Espera com cronômetro regressivo de **15 minutos** (expiração automática), acompanhamento do deslocamento do motorista no mapa, chat interno, histórico de viagens e avaliação real por estrelas.

2. **Motorista / Moto Táxi**:
   * **Filtro Estrito por Categoria:** Motoristas cadastrados para **Carro** recebem apenas corridas de Carro. Motoristas cadastrados para **Moto Táxi** recebem apenas chamadas de Moto Táxi.
   * **Visualização do Trajeto no Radar:** O card do radar exibe visualmente o mapa com os Pinos A e B e o traçado da rota **antes do motorista aceitar a chamada**.
   * **Navegação GPS em 1 Clique:** Botão dedicado para abrir o trajeto diretamente no Waze.
   * **Rastreamento e Animação em Tempo Real:** Posição do veículo atualizada suavemente ao longo do traçado com ângulo de direção (heading) rotacionado dinamicamente.
   * **Painel Financeiro Detalhado:** Faturamento acumulado Hoje (Diário), Na Semana (Semanal), No Mês (Mensal) e Total Geral, com extrato completo e cálculo de ticket médio.
   * **Controle de Repasse Semanal:** Gestão da assinatura do app (R$ 50 Moto / R$ 100 Carro) com envio de comprovante Pix e liberação de passe grátis.

3. **Painel Administrativo (`/admin.html`)**:
   * **Dashboard Executivo:** Métricas consolidadas em tempo real (corridas no dia, faturamento total, usuários ativos e alertas pendentes).
   * **Aprovação Obrigatória de Motoristas:** Novos cadastros de motoristas ficam pendentes de análise e só são liberados após avaliação documental da diretoria.
   * **Moderação de Incidentes e Suporte:** Atendimento e resposta aos chamados registrados por passageiros ou motoristas.
   * **Gestão de Municípios e Tarifas:** Cadastro e alteração de valores de bandeirada e taxa por KM em tempo real para qualquer município.
   * **Exclusão de Registros:** Opção para remover usuários, chamados ou mensagens com sincronização direta no banco PostgreSQL.

---

## 🎵 Sistema de Áudios e Notificações Sonoras

O aplicativo possui uma sonoplastia nativa para guiar o usuário em cada etapa da corrida:

* 🚗 `acaminho.mp3`: Tocado para o passageiro e motorista quando a corrida é aceita.
* 📍 `cheguei.mp3`: Tocado para o passageiro quando o motorista chega ao ponto de embarque.
* 🛡️ `seguranca.mp3`: Tocado quando o motorista clica em navegar ao destino final / inicia o deslocamento.
* 🏁 `verificar.mp3`: Tocado para o passageiro conferir o valor e avaliar ao finalizar a viagem.
* 💬 `novamensagem.mp3`: Tocado ao enviar ou receber mensagens no chat interno.
* 🔔 `maxdrive.mp3`: Áudio de boas-vindas / alertas gerais do aplicativo.
* ⚠️ `cancel.wav`: Tocado em caso de cancelamento da corrida.
* 🎧 `click.wav`, `online.wav`, `offline.wav`, `success.wav`: Sons de feedback da interface.

---

## 🚀 Como Executar o Projeto

### 🟢 Opção 1: Início Rápido no Windows (1 Clique)
Execute o arquivo **`iniciar.bat`** na raiz do projeto. Ele inicia o servidor Node.js e abre o aplicativo automaticamente no seu navegador padrão (`http://localhost:3000`).

### ⚙️ Opção 2: Gerenciador do Servidor (`servidor/servidor.bat`)
Na pasta `servidor/`, execute o arquivo **`servidor.bat`** para abrir o menu interativo:
* **`[1] Ligar Servidor`**: Inicia o backend em janela dedicada.
* **`[2] Desligar Servidor`**: Finaliza os processos do Node.js.
* **`[3] Ligar App`**: Inicia o servidor e abre o aplicativo no navegador.
* **`[5] Mostrar Status`**: Diagnóstico de portas e banco de dados.
* **`[6] Executar Testes Automatizados`**: Roda a bateria de 50 testes automatizados do sistema.
* **`[10] Resetar Banco de Dados`**: Realiza o reset seguro no PostgreSQL (limpa usuários e corridas de teste, criando backup automático em `servidor/database/backups/` e **mantendo 100% intactos os dados de cidades, ruas e geolocalização**).

### 🌐 Endereços Locais de Acesso:
* **Aplicativo Móvel (Passageiro / Motorista):** [http://localhost:3000](http://localhost:3000)
* **Painel Administrativo:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
* **Status da Camada de Dados:** [http://localhost:3000/api/db-status](http://localhost:3000/api/db-status)

---

## 🏙️ Mapeamento Viário e Geociências (17 Cidades)

A malha viária do MAX DRIVE foi extraída de **11.617.099 nós e 318.390 caminhos** do arquivo OpenStreetMap (`mapa.osm.xz`), totalizando **30.011 vias e pontos de referência geocodificados** armazenados na tabela `street_coordinates` do PostgreSQL:

| Cidade | UF | Locais / Ruas Mapeadas | Suporte Carro | Suporte Moto Táxi |
| :--- | :---: | :---: | :---: | :---: |
| **Uberlândia** | MG | 6.225 vias | Sim | Sim |
| **Uberaba** | MG | 3.259 vias | Sim | Sim |
| **Ituiutaba** | MG | 1.466 vias | Sim | Sim |
| **Araguari** | MG | 1.408 vias | Sim | Sim |
| **Itumbiara** | GO | 1.164 vias | Sim | Sim |
| **Patrocínio** | MG | 643 vias | Sim | Sim |
| **Monte Carmelo** | MG | 519 vias | Sim | Sim |
| **Prata** | MG | 430 vias | Sim | Sim |
| **Santa Vitória** | MG | 400 vias | Sim | Sim |
| **Capinópolis** | MG | 384 vias | Sim | Sim |
| **Tupaciguara** | MG | 257 vias | Sim | Sim |
| **Centralina** | MG | 175 vias | Sim | Sim |
| **Canápolis** | MG | 37 vias | Sim | Sim |
| **Patos de Minas, Araxá, Frutal, Iturama** | MG | Mapeamento Viário Ativo | Sim | Sim |

---

## 🗄️ Arquitetura do Banco de Dados (PostgreSQL + Fallback)

O projeto adota uma camada resiliente no arquivo [`servidor/db.js`](file:///d:/MAXDRIVE/servidor/db.js):

* **PostgreSQL 14+**: Conexão relacional via pool (`pg`).
* **Resiliência Zero Downtime**: Se o banco em nuvem ou local não estiver acessível, o sistema utiliza o armazenamento JSON local sem interromper o funcionamento.
* **Criptografia e Segurança**: Senhas criptografadas com hash PBKDF2 e código de segurança de 6 dígitos.

### Configuração das Variáveis (`servidor/CONFIGURACAO_DO_SERVIDOR.env`):
```env
PORT=3000
DATABASE_URL=postgresql://postgres:9420@localhost:5432/maxdrive
```

---

## 📦 Compilação para Android (APK Nativo)

O aplicativo está estruturado com **Capacitor 8** (`@capacitor/android`):

1. **Configuração de Conexão no APK:** Defina a URL do seu servidor ou IP local no arquivo [`aplicativo/CONFIGURACAO_DO_APP.js`](file:///d:/MAXDRIVE/aplicativo/CONFIGURACAO_DO_APP.js).
2. **Sincronizar Arquivos Web com o Projeto Nativo:**
   ```bash
   cmd /c npx cap copy android
   ```
3. **Gerar o APK Debug pelo Gradle:**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   O arquivo APK gerado estará em:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📁 Estrutura de Pastas do Projeto

```text
MAXDRIVE/
├── aplicativo/                       # Código-fonte do Aplicativo Móvel (Web & APK)
│   ├── assets/
│   │   ├── icons/                    # Ícones vetorizados SVG
│   │   └── sounds/                   # Áudios de notificação (acaminho.mp3, cheguei.mp3, etc.)
│   ├── css/
│   │   └── style.css                 # Estilos visuais, Dark/Light Mode e layouts
│   ├── js/
│   │   ├── app.js                    # Lógica do Passageiro, Motorista e Finanças
│   │   ├── config.js                 # Resolução automática de URL da API (Web/APK)
│   │   ├── map.js                    # Motor cartográfico Leaflet.js e marcadores
│   │   └── realtime.js               # Conexão WebSockets e Notificações Push
│   ├── index.html                    # Interface SPA com todas as telas
│   ├── CONFIGURACAO_DO_APP.js        # IP/URL do servidor para o APK Android
│   └── manifest.json                 # Manifesto PWA
├── android/                          # Projeto Nativo Android (Capacitor 8)
│   └── app/build/outputs/apk/debug/ # Pasta onde o APK compilado é gerado
├── servidor/                         # Backend Node.js e Painel Administrativo
│   ├── admin/                        # Painel Administrativo (/admin.html)
│   ├── database/                     # Malha viária OSM, dumps e backups automáticos
│   ├── db.js                         # Camada de banco de dados PostgreSQL / JSON
│   ├── server.js                     # Servidor HTTP REST e WebSockets
│   ├── test_suite.js                 # Bateria de 50 testes automatizados
│   ├── extract_osm_map.py            # Extrator do arquivo mapa.osm.xz para PostgreSQL
│   ├── servidor.bat                  # Gerenciador interativo do servidor
│   └── CONFIGURACAO_DO_SERVIDOR.env  # Variáveis de ambiente e banco
├── iniciar.bat                       # Launcher com 1 clique para Windows
└── README.md                         # Documentação oficial do projeto
```

---

## 🔮 Atualizações Futuras (Planejadas)

* **Centralização Dinâmica por Cidade:** Manter a expansão contínua do mapeamento viário para novos municípios.
* **Marcadores Duplos Dinâmicos e Animação:** Aprimoramento da interpolação de rotas em tráfego de alta densidade.
* **Captura de GPS Nativo:** Suporte expandido para rastreamento de fundo (background geolocation) no aplicativo Android.

---

## 📄 Licença

Este projeto é desenvolvido para a plataforma **MAX DRIVE**. Todos os direitos reservados.
