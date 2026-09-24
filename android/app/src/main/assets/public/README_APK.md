# 📱 MAX DRIVE - Guia de Geração do Aplicativo Android (APK)

Esta pasta (`aplicativo/`) contém **100% dos arquivos necessários** para gerar o aplicativo Android (APK) e iOS do **MAX DRIVE**.

Tudo referente à interface móvel (telas de passageiro, motorista, mapa interativo, chat, pagamentos, solicitações e perfil) está isolado aqui.

---

## 📁 Estrutura de Arquivos do Aplicativo

```
MAXDRIVE/
└── aplicativo/
    ├── assets/              # Ícones SVG, imagens e sons do app
    │   ├── icons/           # 69 ícones SVG nativos
    │   ├── images/          # Avatares padrão de passageiro e motorista
    │   └── sounds/          # Sons de notificação e chamada
    ├── css/
    │   └── style.css        # Folha de estilo completa (design responsivo escuro)
    ├── js/
    │   ├── config.js        # Configuração de conexão e IP do servidor
    │   ├── map.js           # Mecanismo de geolocalização e rotas (Leaflet)
    │   └── app.js           # Lógica completa do passageiro e motorista
    ├── lib/
    │   └── leaflet/         # Biblioteca de mapas offline/local
    ├── index.html           # Ponto de entrada do aplicativo móvel
    ├── manifest.json        # Manifesto PWA / WebApp
    └── README_APK.md        # Este manual
```

---

## ⚙️ 1. Como Conectar o APK ao seu Servidor

No arquivo [`js/config.js`](js/config.js):

```javascript
window.MAXDRIVE_CONFIG = {
  // Altere para o IP ou domínio onde o seu servidor MAX DRIVE está rodando:
  API_BASE: 'http://192.168.1.100:3000', // Exemplo com IP da sua máquina na rede local
  // Em produção na nuvem: 'https://meu-servidor-maxdrive.com.br'
};
```

> **Dica**: Quando você abre o aplicativo pelo navegador no computador (`http://localhost:3000`), ele conecta automaticamente ao mesmo servidor sem precisar mudar nada.

---

## 🚀 2. Opções para Gerar o APK

### 🥇 Método A: Capacitor (Recomendado - Padrão Profissional)

O Capacitor é o método oficial moderno para converter projetos HTML/JS em aplicativos Android nativos:

1. **Abra o terminal** na pasta `aplicativo`:
   ```bash
   cd aplicativo
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "MAX DRIVE" com.maxdrive.app --web-dir .
   ```

2. **Adicionar plataforma Android**:
   ```bash
   npx cap add android
   ```

3. **Abrir no Android Studio e Gerar APK**:
   ```bash
   npx cap open android
   ```
   No Android Studio, clique em **Build > Build Bundle(s) / APK(s) > Build APK(s)**. O arquivo `.apk` será gerado na pasta `android/app/build/outputs/apk/debug/app-debug.apk`.

---

### 🥈 Método B: Website 2 APK Builder (Sem Código - Visual no Windows)

Se você não quer instalar o Android Studio, pode usar uma ferramenta de conversão direta:

1. Baixe o **Website 2 APK Builder** (ou similar) no seu Windows.
2. Escolha o tipo de modo: **Local Website Folder**.
3. Selecione a pasta `aplicativo`.
4. Defina o nome do aplicativo como `MAX DRIVE`, pacote `com.maxdrive.app`.
5. Em **Icon**, selecione o ícone em `assets/icons/MAXDRIVE.svg` (ou converta para PNG 512x512).
6. Clique em **Generate APK**!

---

### 🥉 Método C: Apache Cordova

1. Instale o Cordova globalmente:
   ```bash
   npm install -g cordova
   ```
2. Crie o projeto:
   ```bash
   cordova create maxdrive-app com.maxdrive.app "MAX DRIVE"
   ```
3. Copie todo o conteúdo da pasta `aplicativo/` para dentro da pasta `maxdrive-app/www/`.
4. Adicione o Android e compile:
   ```bash
   cd maxdrive-app
   cordova platform add android
   cordova build android
   ```

---

## 📶 3. Testando no Celular via Wi-Fi antes do APK

1. Inicie o servidor no seu computador executando `servidor.bat`.
2. Descubra o IP da sua máquina no Windows (abra o Prompt de Comando e digite `ipconfig`, veja o campo `IPv4`, por exemplo `192.168.1.15`).
3. No navegador do seu celular (Chrome/Safari), acesse:
   ```
   http://192.168.1.15:3000
   ```
4. O aplicativo abrirá perfeitamente na tela do celular como se fosse o app nativo!
5. No Chrome do celular, você pode tocar no menu de 3 pontos e escolher **"Adicionar à tela inicial"** para instalar como PWA instantaneamente.
