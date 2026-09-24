# 🚀 GUIA DEFINITIVO: COMO INSTALAR NA VPS E GERAR O APK (PASSO A PASSO PARA LEIGOS)

Este guia foi feito para você que **não quer complicação**. Seguindo estes 4 passos simples, o seu servidor vai rodar 24 horas por dia na internet e qualquer pessoa que instalar o seu APK no celular conseguirá pedir corridas e aceitar chamadas em tempo real!

---

## 🧠 Entenda o Raciocínio (Super Simples)

* 🖥️ **A pasta `servidor/`**: É o "cérebro" do sistema. Ela vai para a sua VPS (um computador que fica ligado 24h na nuvem).
* 📱 **A pasta `aplicativo/`**: É a "tela" que vai virar o aplicativo (`.apk`) e ser instalado nos celulares Android dos passageiros e motoristas.
* 🔗 **A Ponte entre eles**: É **apenas 1 linha** no arquivo [`aplicativo/CONFIGURACAO_DO_APP.js`](aplicativo/CONFIGURACAO_DO_APP.js), onde você digita o IP da sua VPS!

---

## 📍 ONDE FICA CADA ARQUIVO DE CONFIGURAÇÃO?

Para você **nunca mais ter que caçar em pastas**:

| O que você quer alterar? | Onde você altera? |
| :--- | :--- |
| **Endereço do Servidor no Aplicativo (APK)** | 👉 [`aplicativo/CONFIGURACAO_DO_APP.js`](aplicativo/CONFIGURACAO_DO_APP.js) |
| **Porta e Banco de Dados do Servidor** | 👉 [`servidor/CONFIGURACAO_DO_SERVIDOR.env`](servidor/CONFIGURACAO_DO_SERVIDOR.env) |

Você abre esses arquivos no **Bloco de Notas**, altera e salva. Só isso!

---

## ☁️ PARTE 1: Instalando o Servidor na sua VPS (Menos de 10 minutos)

### 1. O que você precisa:
Contrate uma VPS simples (Hostinger, Contabo, Hetzner, DigitalOcean, etc.) com **Ubuntu 22.04 ou 24.04**. A VPS mais barata (1 ou 2 GB de RAM) já aguenta o MAX DRIVE tranquilamente.
A empresa vai te dar um **IP** (exemplo: `123.45.67.89`) e uma senha de `root`.

### 2. Conecte na sua VPS:
No seu Windows, abra o **Prompt de Comando (CMD)** ou **PowerShell** e digite:
```bash
ssh root@SEU_IP_DA_VPS
```
*(Digite a senha da VPS quando pedir)*.

### 3. Instale o Node.js na VPS (Copie e cole estes comandos):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```
> **O que é o PM2?** É um gerenciador profissional que garante que o seu servidor nunca pare. Se a VPS reiniciar ou tiver queda de energia, o PM2 religa o servidor sozinho!

### 4. Envie a pasta `servidor` para a VPS:
Você pode usar o programa gratuito **FileZilla** ou **WinSCP**:
1. Conecte pelo protocolo **SFTP** usando o IP da sua VPS, usuário `root` e sua senha.
2. Arraste a pasta `servidor/` do seu computador para dentro da pasta `/var/www/maxdrive/` (ou na raiz `/root/servidor`).

### 5. Inicie o Servidor na VPS para rodar 24h por dia:
No terminal da VPS, entre na pasta do servidor e ligue:
```bash
cd /root/servidor
npm install
pm2 start server.js --name "maxdrive"
pm2 save
pm2 startup
```

Pronto! Seu servidor já está **100% ONLINE na internet**!
* Teste abrindo no navegador do seu celular ou PC: `http://SEU_IP_DA_VPS:3000`
* O Painel Admin fica em: `http://SEU_IP_DA_VPS:3000/admin.html`

---

## 📱 PARTE 2: Conectando o Aplicativo no Servidor da VPS

Agora que o seu servidor está online na nuvem, você só precisa avisar o aplicativo onde o servidor está:

1. No seu computador, abra a pasta **`aplicativo/`**.
2. Abra o arquivo **[`CONFIGURACAO_DO_APP.js`](aplicativo/CONFIGURACAO_DO_APP.js)** com o Bloco de Notas.
3. Na linha que tem `window.SERVIDOR_MAXDRIVE`, troque pelo IP da sua VPS:
   ```javascript
   window.SERVIDOR_MAXDRIVE = 'http://SEU_IP_DA_VPS:3000';
   ```
4. Salve o arquivo (`Ctrl + S`) e feche o Bloco de Notas.

> **Pronto!** O aplicativo agora já sabe que deve conversar com a sua VPS!

---

## 📦 PARTE 3: Transformando a pasta `aplicativo` em APK Android

Você tem duas formas de fazer isso. Escolha a que preferir:

---

### 🥇 OPÇÃO A: O Modo Mais Fácil do Mundo (Sem Código - Visual no Windows)

Use um programa conversor como o **Website 2 APK Builder** (ou **Web2Apk**):

1. Baixe e abra o **Website 2 APK Builder** no seu computador.
2. Em **Web Site Type**, selecione a opção: **Local Website Folder**.
3. No campo **Directory of Local Website**, clique em procurar e escolha a pasta **`MAXDRIVE\aplicativo`**.
4. Em **App Title**, digite: `MAX DRIVE`.
5. Em **Package Name**, digite: `com.maxdrive.app`.
6. Em **App Icon**, clique e escolha o ícone em `aplicativo/assets/icons/MAXDRIVE.svg` (ou converta para PNG).
7. Clique no botão grande: **GENERATE APK**!

Em 30 segundos o arquivo **`MAX DRIVE.apk`** estará pronto na sua área de trabalho!

---

### 🥈 OPÇÃO B: Modo Profissional (Capacitor / Android Studio)

Se você quiser compilar profissionalmente para publicar na Google Play Store:

1. Abra o terminal na pasta `aplicativo`:
   ```bash
   cd c:\Users\mauro\OneDrive\Desktop\MAXDRIVE\aplicativo
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "MAX DRIVE" com.maxdrive.app --web-dir .
   npx cap add android
   npx cap open android
   ```
2. O **Android Studio** vai abrir o projeto automaticamente.
3. Vá no menu do topo: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. O arquivo `.apk` estará pronto na pasta `android/app/build/outputs/apk/debug/`.

---

## 📲 PARTE 4: Testando no Celular

1. Envie o arquivo `.apk` gerado para o seu celular (pelo WhatsApp Web, Telegram, Google Drive ou cabo USB).
2. No celular, toque no arquivo e clique em **Instalar** (se o Android pedir, permita "Instalar aplicativos de fontes desconhecidas").
3. Abra o **MAX DRIVE** no celular:
   * Crie uma conta de passageiro ou motorista.
   * Peça uma corrida.
   * O aplicativo vai conversar direto com a sua VPS pela internet (mesmo usando 4G/5G na rua)!
4. No computador, abra `http://SEU_IP_DA_VPS:3000/admin.html` e você verá a corrida aparecendo no painel em tempo real!

---

## 🎯 RESUMO RELÂMPAGO (Para Lembrar Sempre)

```text
1. Servidor na VPS: Envie a pasta "servidor" e ligue com: pm2 start server.js
2. Conectar App:    Abra aplicativo/CONFIGURACAO_DO_APP.js e coloque o IP da VPS.
3. Gerar APK:       Converta a pasta "aplicativo" em .apk usando o Website 2 APK Builder.
4. Instalar:        Mande o .apk para o celular e use!
```
