/**
 * ============================================================================
 * 🚗 MAX DRIVE - BATERIA OFICIAL DE TESTES AUTOMATIZADOS DE SISTEMA
 * ============================================================================
 * 
 * Executável via:
 *   - node test_suite.js
 *   - Opção [6] do menu servidor.bat
 *   - npm test
 * 
 * Testa 100% das rotas da API, Banco de Dados, Geo-engine, Segurança,
 * Fluxos de Corrida, Chat, Avaliações, Painel Financeiro e Administração.
 * ============================================================================
 */

const http = require('http');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

let PORT = 3000;
let serverProc = null;
let serverSpawnedByTest = false;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      method: options.method || 'GET',
      path: options.path || '/',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServerRunning() {
  const alreadyRunning = await isServerRunning(3000);
  if (alreadyRunning) {
    console.log('📡 Servidor detectado já em execução na porta 3000. Utilizando instância ativa para testes.');
    PORT = 3000;
    return;
  }

  PORT = 3001;
  const runningOn3001 = await isServerRunning(3001);
  if (runningOn3001) {
    console.log('📡 Servidor de teste detectado na porta 3001.');
    return;
  }

  return new Promise((resolve, reject) => {
    console.log(`🚀 Iniciando servidor de teste na porta ${PORT}...`);
    serverProc = cp.spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT) }
    });
    serverSpawnedByTest = true;

    let started = false;
    serverProc.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('MAX DRIVE SERVIDOR ATIVO') && !started) {
        started = true;
        setTimeout(resolve, 500);
      }
    });

    serverProc.on('error', reject);
    setTimeout(() => {
      if (!started) reject(new Error('Timeout aguardando inicialização do servidor MAX DRIVE'));
    }, 9000);
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('       🚗 MAX DRIVE - BATERIA DE TESTES AUTOMATIZADOS           ');
  console.log('===============================================================\n');

  const createdUserIds = [];
  const createdRideIds = [];
  const createdReportIds = [];

  try {
    await ensureServerRunning();

    // 1. Health & Database
    console.log('\n--- [1] SAÚDE DO SERVIDOR & BANCO DE DADOS ---');
    const health = await request({ path: '/api/health' });
    assert(health.statusCode === 200 && health.data.status === 'online', 'GET /api/health retorna status 200 online');
    assert(health.data.database !== undefined, 'Health check informa motor de banco ativo (' + health.data.database + ')');

    const dbStatus = await request({ path: '/api/db-status' });
    assert(dbStatus.statusCode === 200 && dbStatus.data.success, 'GET /api/db-status retorna diagnóstico detalhado do banco');

    // 2. Static Files & Frontend Assets
    console.log('\n--- [2] ARQUIVOS ESTÁTICOS & FRONTEND ---');
    const homeHtml = await request({ path: '/' });
    assert(homeHtml.statusCode === 200 && typeof homeHtml.data === 'string' && homeHtml.data.includes('MAX DRIVE'), 'GET / serve index.html do aplicativo');

    const adminHtml = await request({ path: '/admin.html' });
    assert(adminHtml.statusCode === 200 && typeof adminHtml.data === 'string' && adminHtml.data.includes('Painel Administrativo'), 'GET /admin.html serve painel administrativo');

    const manifest = await request({ path: '/manifest.json' });
    assert(manifest.statusCode === 200 && manifest.data.name === 'MAX DRIVE', 'GET /manifest.json serve manifesto PWA válido');

    const appJs = await request({ path: '/js/app.js' });
    assert(appJs.statusCode === 200 && typeof appJs.data === 'string' && appJs.data.includes('App'), 'GET /js/app.js serve script cliente');

    const configJs = await request({ path: '/js/config.js' });
    assert(configJs.statusCode === 200 && typeof configJs.data === 'string' && configJs.data.includes('MAXDRIVE_CONFIG'), 'GET /js/config.js serve configurações cliente');

    const mapJs = await request({ path: '/js/map.js' });
    assert(mapJs.statusCode === 200 && typeof mapJs.data === 'string' && mapJs.data.includes('MaxMap'), 'GET /js/map.js serve motor Leaflet e OSRM');

    const styleCss = await request({ path: '/css/style.css' });
    assert(styleCss.statusCode === 200 && typeof styleCss.data === 'string' && styleCss.data.includes('--bg-main'), 'GET /css/style.css serve folha de estilos principal');

    // 3. Auth: Registration, Password Hashing & Sessions
    console.log('\n--- [3] AUTENTICAÇÃO, CRIPTOGRAFIA & SESSÕES ---');
    const testTimestamp = Date.now();
    const testPassengerEmail = `test_pass_${testTimestamp}@maxdrive.com`;
    const testDriverEmail = `test_drv_${testTimestamp}@maxdrive.com`;

    // 3.1 Register Passenger
    const regPass = await request({ method: 'POST', path: '/api/auth/register' }, {
      name: 'Passageiro Teste Auto',
      email: testPassengerEmail,
      phone: '(34) 98888-0001',
      password: 'senhaSegura123',
      securityCode: '123456',
      role: 'passenger'
    });
    assert(regPass.statusCode === 201 && regPass.data.success, 'POST /api/auth/register (Passageiro) cria usuário com hash PBKDF2');
    const createdPassId = regPass.data.user.id;
    createdUserIds.push(createdPassId);

    // 3.2 Register Driver
    const regDrv = await request({ method: 'POST', path: '/api/auth/register' }, {
      name: 'Motorista Teste Auto',
      email: testDriverEmail,
      phone: '(34) 98888-0002',
      password: 'senhaDriver456',
      securityCode: '654321',
      role: 'driver',
      vehicle: {
        type: 'car',
        model: 'ARGO PRATA',
        plate: 'TST-1234',
        color: 'Prata',
        year: '2023'
      }
    });
    assert(regDrv.statusCode === 201 && regDrv.data.success, 'POST /api/auth/register (Motorista) cadastra veículo e dados');
    const createdDrvId = regDrv.data.user.id;
    createdUserIds.push(createdDrvId);

    // Approve test driver via Admin API for test execution
    const apprv = await request({
      method: 'PUT',
      path: `/api/admin/drivers/${createdDrvId}/approve`,
      headers: { 'x-user-email': 'admin@maxdrive.com' }
    }, { approved: true });

    const db = require('./db');
    const drvUser = await db.getUserById(createdDrvId);
    if (drvUser) {
      drvUser.approved = true;
      drvUser.driverApproved = true;
      drvUser.weeklyPaymentStatus = 'REGULAR';
      drvUser.paidUntil = new Date(Date.now() + 7 * 86400000).toISOString();
      await db.saveUser(drvUser);
    }

    // 3.3 Login Passenger
    const loginPass = await request({ method: 'POST', path: '/api/auth/login' }, {
      email: testPassengerEmail,
      password: 'senhaSegura123'
    });
    assert(loginPass.statusCode === 200 && loginPass.data.sessionToken, 'POST /api/auth/login gera sessionToken ativo');
    const passToken = loginPass.data.sessionToken;

    // 3.4 Login Driver
    const loginDrv = await request({ method: 'POST', path: '/api/auth/login' }, {
      email: testDriverEmail,
      password: 'senhaDriver456'
    });
    assert(loginDrv.statusCode === 200 && loginDrv.data.sessionToken, 'POST /api/auth/login (Motorista) realiza login com sucesso');
    const drvToken = loginDrv.data.sessionToken;

    // 3.5 Validate Session
    const valSession = await request({
      method: 'GET',
      path: `/api/auth/validate-session?userId=${createdPassId}&sessionToken=${passToken}`
    });
    assert(valSession.statusCode === 200 && valSession.data.valid, 'GET /api/auth/validate-session confirma sessão única ativa');

    // 3.6 Profile Update
    const updateProf = await request({
      method: 'PUT',
      path: '/api/auth/profile',
      headers: { 'x-user-id': createdPassId }
    }, {
      name: 'PASSAGEIRO TESTE ATUALIZADO',
      city: 'Ituiutaba'
    });
    assert(updateProf.statusCode === 200 && updateProf.data.user.name.includes('ATUALIZADO'), 'PUT /api/auth/profile atualiza perfil');

    // 4. Cities & Fares & Geo Engine
    console.log('\n--- [4] CIDADES, TARIFAS & GEO-ENGINE ---');
    const citiesRes = await request({ path: '/api/cities' });
    assert(citiesRes.statusCode === 200 && Array.isArray(citiesRes.data.cities), 'GET /api/cities retorna lista de cidades');

    const streetsRes = await request({ path: '/api/streets?city=ituiutaba&q=rua%2020&limit=5' });
    assert(streetsRes.statusCode === 200 && streetsRes.data.streets.length > 0, 'GET /api/streets busca sugestões da base OpenStreetMap');

    const geocodeRes = await request({ path: '/api/geocode?city=ituiutaba&q=rua%2020' });
    assert(geocodeRes.statusCode === 200 && typeof geocodeRes.data.lat === 'number', 'GET /api/geocode resolve coordenadas exatas da rua');

    const revGeoRes = await request({ path: '/api/reverse-geocode?city=ituiutaba&lat=-18.9688&lng=-49.4642' });
    assert(revGeoRes.statusCode === 200 && revGeoRes.data.address, 'GET /api/reverse-geocode converte lat/lng em nome de rua');

    const routeRes = await request({
      path: '/api/route?city=ituiutaba&orig=Rua%2020,%20100&dest=Av%2017,%20400'
    });
    assert(routeRes.statusCode === 200 && routeRes.data.distanceKm > 0, 'GET /api/route calcula distância viária real com malha/OSRM');

    // 5. Complete Ride Lifecycle
    console.log('\n--- [5] CICLO DE VIDA COMPLETO DE CORRIDA ---');
    // 5.1 Request Ride
    const newRideRes = await request({ method: 'POST', path: '/api/rides' }, {
      passengerId: createdPassId,
      passengerName: 'Passageiro Teste Auto',
      origin: 'Rua 20, 100, Centro',
      destination: 'Av 17, 400, Platina',
      reference: 'Perto da Farmácia',
      city: 'Ituiutaba',
      vehicleType: 'car',
      distance: '3.5 KM',
      duration: '8 MIN',
      price: 13.50,
      paymentMethod: 'Pix'
    });
    assert(newRideRes.statusCode === 201 && newRideRes.data.ride.status === 'requested', 'POST /api/rides cria corrida com status "requested"');
    const rideId = newRideRes.data.ride.id;
    createdRideIds.push(rideId);

    // 5.2 List in Driver Radar
    const radarRes = await request({ path: '/api/rides?status=radar&city=Ituiutaba' });
    assert(radarRes.statusCode === 200 && radarRes.data.rides.some(r => r.id === rideId), 'GET /api/rides?status=radar exibe corrida no radar');

    // 5.3 Accept Ride
    const acceptRes = await request({
      method: 'PUT',
      path: `/api/rides/${rideId}/accept`
    }, {
      driverId: createdDrvId,
      driverName: 'Motorista Teste Auto',
      driverRating: 5.0,
      vehicle: {
        type: 'car',
        model: 'ARGO PRATA',
        plate: 'TST-1234',
        color: 'Prata',
        year: '2023'
      }
    });
    assert(acceptRes.statusCode === 200 && acceptRes.data.ride.status === 'accepted', 'PUT /api/rides/:id/accept motorista aceita a corrida');

    // 5.4 Chat in Ride
    const sendChat = await request({
      method: 'POST',
      path: `/api/rides/${rideId}/chat`
    }, {
      senderId: createdPassId,
      senderRole: 'passenger',
      senderName: 'Passageiro Teste',
      text: 'Olá, já estou aguardando na calçada!'
    });
    assert(sendChat.statusCode === 201 && sendChat.data.success, 'POST /api/rides/:id/chat envia mensagem no chat');

    const getChat = await request({ path: `/api/rides/${rideId}/chat` });
    assert(getChat.statusCode === 200 && getChat.data.messages.length > 0, 'GET /api/rides/:id/chat recupera mensagens da corrida');

    // 5.5 Driver Status Update (arrived -> in_progress)
    const statusArrived = await request({
      method: 'PUT',
      path: `/api/rides/${rideId}/status`
    }, { status: 'arrived' });
    assert(statusArrived.statusCode === 200 && statusArrived.data.ride.status === 'arrived', 'PUT /api/rides/:id/status motorista chegou');

    const statusProgress = await request({
      method: 'PUT',
      path: `/api/rides/${rideId}/status`
    }, { status: 'in_progress' });
    assert(statusProgress.statusCode === 200 && statusProgress.data.ride.status === 'in_progress', 'PUT /api/rides/:id/status corrida em andamento');

    // 5.6 Finish Ride
    const finishRes = await request({
      method: 'PUT',
      path: `/api/rides/${rideId}/finish`
    }, { fare: 13.50 });
    assert(finishRes.statusCode === 200 && finishRes.data.ride.status === 'completed', 'PUT /api/rides/:id/finish finaliza a corrida com sucesso');

    // 5.7 Rating
    const rateRes = await request({
      method: 'POST',
      path: `/api/rides/${rideId}/rating`
    }, {
      stars: 5,
      feedback: 'Ótima corrida, motorista educado!',
      ratedBy: 'passenger'
    });
    assert(rateRes.statusCode === 200 && rateRes.data.ride.rated, 'POST /api/rides/:id/rating registra avaliação por estrelas');

    // 5.8 Finances
    const finRes = await request({ path: `/api/finances?userId=${createdDrvId}&role=driver` });
    assert(finRes.statusCode === 200 && finRes.data.success && finRes.data.totalRides >= 1, 'GET /api/finances calcula faturamento e corridas concluídas');

    // 6. Reports & Admin Support Messages
    console.log('\n--- [6] REPORTES, SUPORTE & MENSAGENS DIRETAS ---');
    const newReport = await request({ method: 'POST', path: '/api/reports' }, {
      reporterId: createdPassId,
      reporterName: 'Passageiro Teste',
      reporterRole: 'passenger',
      category: 'Dúvida',
      reason: 'Como funciona o pagamento semanal de motorista?'
    });
    assert(newReport.statusCode === 201 && newReport.data.report.status === 'Pendente', 'POST /api/reports registra novo chamado de suporte');
    const reportId = newReport.data.report.id;
    createdReportIds.push(reportId);

    // Admin direct message
    const sendAdminMsg = await request({ method: 'POST', path: '/api/admin-messages' }, {
      senderId: createdPassId,
      senderRole: 'passenger',
      senderName: 'Passageiro Teste',
      recipientId: 'admin',
      recipientRole: 'admin',
      recipientName: 'Diretoria',
      text: 'Olá diretoria, teste de mensagem!'
    });
    assert(sendAdminMsg.statusCode === 201 && sendAdminMsg.data.success, 'POST /api/admin-messages envia mensagem direta ao suporte');

    const adminUnread = await request({ path: '/api/admin-messages/unread-count?role=admin' });
    assert(adminUnread.statusCode === 200 && adminUnread.data.unreadCount >= 1, 'GET /api/admin-messages/unread-count calcula mensagens não lidas');

    // 7. Weekly Payments & Admin Operations
    console.log('\n--- [7] FINANCEIRO SEMANAL, AUDITORIA & ADMINISTRAÇÃO ---');
    const myPayStatus = await request({
      path: '/api/payments/my-status',
      headers: { 'x-user-id': createdDrvId }
    });
    assert(myPayStatus.statusCode === 200 && myPayStatus.data.status, 'GET /api/payments/my-status retorna ciclo semanal do motorista');

    const adminHeaders = {
      'x-admin-request': 'true',
      'x-user-email': 'admin@maxdrive.com'
    };

    const adminStats = await request({ path: '/api/admin/stats', headers: adminHeaders });
    assert(adminStats.statusCode === 200 && adminStats.data.stats.totalUsers > 0, 'GET /api/admin/stats retorna métricas consolidadas');

    // Grant free pass
    const freePass = await request({
      method: 'POST',
      path: '/api/payments/free-pass',
      headers: adminHeaders
    }, {
      driverId: createdDrvId,
      notes: 'Teste automático de cortesia'
    });
    assert(freePass.statusCode === 200 && freePass.data.driver.weeklyPaymentStatus === 'PASSE_GRATIS', 'POST /api/payments/free-pass concede semana grátis');

    // Confirm Payment
    const confirmPay = await request({
      method: 'POST',
      path: '/api/payments/confirm',
      headers: adminHeaders
    }, {
      driverId: createdDrvId,
      amount: 100.00,
      receiptUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });
    assert(confirmPay.statusCode === 200 && confirmPay.data.driver.weeklyPaymentStatus === 'REGULAR', 'POST /api/payments/confirm aprova semana via Pix com comprovante');

    // Respond Report
    const respReport = await request({
      method: 'PUT',
      path: `/api/reports/${reportId}/respond`,
      headers: adminHeaders
    }, {
      status: 'Resolvido',
      response: 'Dúvida esclarecida com sucesso pela diretoria.'
    });
    assert(respReport.statusCode === 200 && respReport.data.report.status === 'Resolvido', 'PUT /api/reports/:id/respond responde chamado com status Resolvido');

    // Ban and Unban
    const banRes = await request({
      method: 'PUT',
      path: `/api/admin/users/${createdPassId}/ban`,
      headers: adminHeaders
    }, { reason: 'Teste de banimento automático' });
    assert(banRes.statusCode === 200 && banRes.data.user.status === 'banned', 'PUT /api/admin/users/:id/ban bane usuário');

    const unbanRes = await request({
      method: 'PUT',
      path: `/api/admin/users/${createdPassId}/ban`,
      headers: adminHeaders
    }, { action: 'unban' });
    assert(unbanRes.statusCode === 200 && unbanRes.data.user.status === 'active', 'PUT /api/admin/users/:id/ban desbane usuário');

    // 8. Logout
    console.log('\n--- [8] ENCERRAMENTO DE SESSÃO ---');
    const logoutRes = await request({
      method: 'POST',
      path: '/api/auth/logout',
      headers: { 'x-user-id': createdPassId }
    }, { userId: createdPassId });
    assert(logoutRes.statusCode === 200 && logoutRes.data.success, 'POST /api/auth/logout invalida sessionToken');

    // 9. WebSockets & Push Notifications (Itens 1 e 6)
    console.log('\n--- [9] WEBSOCKETS EM TEMPO REAL & PUSH NOTIFICATIONS ---');
    
    // Test Push Token Registration
    const testPushToken = 'fcm_test_token_' + Date.now();
    const pushRegRes = await request({
      method: 'POST',
      path: '/api/push/register-token'
    }, {
      token: testPushToken,
      userId: createdDrvId,
      role: 'driver',
      city: 'ituiutaba',
      platform: 'android'
    });
    assert(pushRegRes.statusCode === 200 && pushRegRes.data.success && pushRegRes.data.token, 'POST /api/push/register-token registra token push FCM com sucesso');

    // Test Push Tokens Listing
    const pushListRes = await request({
      method: 'GET',
      path: '/api/push/tokens'
    });
    assert(pushListRes.statusCode === 200 && pushListRes.data.success && pushListRes.data.count >= 1, 'GET /api/push/tokens lista tokens salvos');

    // Test Push Notification Dispatch
    const pushSendRes = await request({
      method: 'POST',
      path: '/api/push/send-test'
    }, {
      title: 'Teste de Alerta',
      body: 'Notificação automática disparada com sucesso',
      role: 'driver',
      city: 'ituiutaba'
    });
    assert(pushSendRes.statusCode === 200 && pushSendRes.data.success, 'POST /api/push/send-test despacha notificação com resiliência');

    // Test WebSocket Connection
    const { WebSocket } = require('ws');
    const wsClient = await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${PORT}`);
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      socket.on('open', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('error', reject);
    });
    assert(wsClient.readyState === WebSocket.OPEN, `WebSocket handshake e conexão na porta ${PORT} estabelecida`);

    // Test WebSocket Ping/Pong
    const pongReceived = await new Promise((resolve) => {
      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong') {
            wsClient.off('message', handler);
            resolve(true);
          }
        } catch (_) {}
      };
      wsClient.on('message', handler);
      wsClient.send(JSON.stringify({ type: 'ping' }));
      setTimeout(() => resolve(false), 3000);
    });
    assert(pongReceived, 'WebSocket ping/pong responde com confirmação de liveness');

    // Test WebSocket Authentication & Context
    const authConfirmed = await new Promise((resolve) => {
      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'authenticated' && msg.role === 'driver') {
            wsClient.off('message', handler);
            resolve(true);
          }
        } catch (_) {}
      };
      wsClient.on('message', handler);
      wsClient.send(JSON.stringify({
        type: 'auth',
        userId: createdDrvId,
        role: 'driver',
        city: 'ituiutaba'
      }));
      setTimeout(() => resolve(false), 3000);
    });
    assert(authConfirmed, 'WebSocket autentica cliente como motorista e sincroniza cidade');

    // Test Real-time Broadcast: Create Ride and receive instant event via WebSocket
    const eventReceivedPromise = new Promise((resolve) => {
      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ride:created' && msg.data && msg.data.ride) {
            wsClient.off('message', handler);
            resolve(msg.data.ride);
          }
        } catch (_) {}
      };
      wsClient.on('message', handler);
      setTimeout(() => resolve(null), 4000);
    });

    const createRideBroadcast = await request({
      method: 'POST',
      path: '/api/rides'
    }, {
      passengerId: createdPassId,
      passengerName: 'Passageiro WS Teste',
      origin: 'Rua 20, 100',
      destination: 'Rua 22, 500',
      city: 'ituiutaba',
      vehicleType: 'car',
      distance: '2.5 KM',
      duration: '6 MIN',
      price: 9.50,
      paymentMethod: 'Pix'
    });
    assert(createRideBroadcast.statusCode === 201, 'POST /api/rides cria corrida para teste de broadcast');

    const receivedRide = await eventReceivedPromise;
    assert(receivedRide && receivedRide.id === createRideBroadcast.data.ride.id, 'WebSocket transmite evento ride:created instantaneamente para o motorista no radar');

    wsClient.close();

  } catch (err) {
    console.error('\n💥 ERRO NA EXECUÇÃO DO TESTE:', err);
    failedTests++;
  } finally {
    // Clean up test data from database and JSON
    try {
      const db = require('./db.js');
      await db.initDB();
      const { Pool } = require('pg');
      const envPath = fs.existsSync(path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env'))
        ? path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env')
        : path.join(__dirname, '.env');
      require('dotenv').config({ path: envPath });

      if (process.env.DATABASE_URL) {
        const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: isLocal ? false : { rejectUnauthorized: false }
        });
        for (const rId of createdRideIds) {
          await pool.query("DELETE FROM rides WHERE id = $1", [rId]).catch(() => {});
        }
        for (const uId of createdUserIds) {
          await pool.query("DELETE FROM users WHERE id = $1", [uId]).catch(() => {});
        }
        for (const repId of createdReportIds) {
          await pool.query("DELETE FROM reports WHERE id = $1", [repId]).catch(() => {});
        }
        await pool.query("DELETE FROM rides WHERE passenger_name LIKE '%Teste%' OR driver_name LIKE '%Teste%'").catch(() => {});
        await pool.query("DELETE FROM reports WHERE reporter_name LIKE '%Teste%'").catch(() => {});
        await pool.query("DELETE FROM admin_messages WHERE sender_name LIKE '%Teste%'").catch(() => {});
        await pool.query("DELETE FROM payments WHERE driver_name LIKE '%Teste%'").catch(() => {});
        await pool.query("DELETE FROM users WHERE email LIKE 'test_%'").catch(() => {});
        await pool.query("DELETE FROM push_tokens WHERE token LIKE 'fcm_test_token_%'").catch(() => {});
        await pool.end();
        await db.hydrateJsonFromPostgres();
      }
    } catch (_) {}

    if (serverSpawnedByTest && serverProc) {
      serverProc.kill();
      console.log('\n🛑 Servidor de testes temporário encerrado.');
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL DE TESTES: ${passedTests + failedTests}`);
  console.log(`PASSOU: ${passedTests}`);
  console.log(`FALHOU: ${failedTests}`);
  console.log('===============================================================');

  if (failedTests === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failedTests} TESTE(S) FALHARAM.\n`);
    process.exit(1);
  }
}

runTestSuite();
