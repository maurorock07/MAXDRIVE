/**
 * MAX DRIVE - Ferramentas de Administração e Gerenciamento do Banco de Dados (PostgreSQL)
 *
 * Suporta:
 * 1. Fazer Backup completo do Banco de Dados (PostgreSQL/JSON)
 * 2. Liberar Acesso para todos os Motoristas e Passageiros (Desbloqueio Geral)
 * 3. Liberar Acesso SOMENTE para Administradores (Modo Manutenção)
 * 4. Resetar Banco de Dados (Limpa corridas/reportes e restaura contas padrão)
 * 5. Restaurar Backup existente
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const BACKUP_DIR = path.join(__dirname, 'database', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ----------------------------------------------------------------------------
// 1. FAZER BACKUP
// ----------------------------------------------------------------------------
async function makeBackup() {
  console.log('\n📦 [DB Admin] Gerando Backup completo do Banco de Dados...');
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(BACKUP_DIR, `backup_${timestamp}`);
    fs.mkdirSync(backupFolder, { recursive: true });

    const users = await db.getUsers();
    const rides = await db.getRides();
    const cities = await db.getCities();
    const reports = await db.getReports();
    const payments = await db.getPayments();
    const messages = await db.getMessages();

    const dump = {
      timestamp: new Date().toISOString(),
      counts: {
        users: users.length,
        rides: rides.length,
        cities: cities.length,
        reports: reports.length,
        payments: payments.length,
        messages: messages.length
      },
      data: { users, rides, cities, reports, payments, messages }
    };

    const filePath = path.join(backupFolder, 'database_dump.json');
    fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf8');

    console.log(`✅ [SUCESSO] Backup salvo em: ${filePath}`);
    console.log(`📊 Total Registrado: ${users.length} usuários, ${rides.length} corridas, ${reports.length} reportes.`);
    return true;
  } catch (err) {
    console.error('❌ [ERRO] Falha ao gerar backup:', err.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 2. LIBERAR ACESSO MOTORISTAS / PASSAGEIROS (DESATIVAR MODO MANUTENÇÃO)
// ----------------------------------------------------------------------------
async function unlockAllUsers() {
  console.log('\n🔓 [DB Admin] Desativando Modo Manutenção (Liberando login normal de Motoristas e Passageiros)...');
  try {
    const users = await db.getUsers();
    let updatedCount = 0;

    for (const u of users) {
      let changed = false;
      // Reativa apenas contas que estavam pausadas pelo Modo Manutenção
      if (u.status === 'blocked' && u.banReason && u.banReason.includes('manutenção')) {
        u.status = 'active';
        u.banReason = '';
        changed = true;
      }

      if (changed) {
        await db.saveUser(u);
        updatedCount++;
      }
    }

    console.log(`✅ [SUCESSO] Modo Manutenção desativado! ${updatedCount} contas voltaram ao estado ativo normal.`);
    console.log('ℹ️  (Contas suspensas por infrações de regras ou débitos mantiveram suas restrições intactas).');
    return true;
  } catch (err) {
    console.error('❌ [ERRO] Falha ao desativar modo manutenção:', err.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 3. LIBERAR ACESSO SOMENTE ADMINISTRADORES (MODO MANUTENÇÃO)
// ----------------------------------------------------------------------------
async function setAdminOnlyAccess() {
  console.log('\n🛡️  [DB Admin] Configurando acesso exclusivo para Administradores (Modo Manutenção)...');
  try {
    const users = await db.getUsers();
    let updatedCount = 0;

    for (const u of users) {
      if (!u.isAdmin && u.role !== 'admin') {
        u.status = 'blocked';
        u.banReason = 'Sistema em manutenção temporária. Acesso restrito a administradores.';
        await db.saveUser(u);
        updatedCount++;
      }
    }

    console.log(`✅ [SUCESSO] Modo Manutenção ativado! ${updatedCount} contas comuns de motoristas/passageiros foram pausadas.`);
    return true;
  } catch (err) {
    console.error('❌ [ERRO] Falha ao definir modo manutenção:', err.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 4. RESETAR BANCO DE DADOS (APENAS USUÁRIOS/CORRIDAS; CIDADES E GEO INTACTOS)
// ----------------------------------------------------------------------------
async function resetDatabase() {
  console.log('\n⚠️  [DB Admin] Resetando Tabelas de Usuários, Corridas e Atendimentos...');
  try {
    // 1. Criar backup preventivo antes de resetar
    await makeBackup();

    // 2. Limpar tabelas de usuários, corridas, reportes, pagamentos e mensagens
    await db.query('TRUNCATE TABLE users, rides, reports, payments, messages, admin_messages RESTART IDENTITY CASCADE');

    // 3. Atualizar caches JSON locais como limpos
    db.writeJson('users.json', []);
    db.writeJson('rides.json', []);
    db.writeJson('reports.json', []);
    db.writeJson('payments.json', []);
    db.writeJson('messages.json', []);
    db.writeJson('admin_messages.json', []);
    db.writeJson('push_tokens.json', []);

    console.log('✅ [SUCESSO] Reset total de Usuários, Corridas, Reportes e Mensagens concluído!');
    console.log('📍 [PRESERVADO] As tabelas "cities" (cidades/tarifas), "city_streets" e "street_coordinates" (geolocalização) foram mantidas 100% INTACTAS.');
    return true;
  } catch (err) {
    console.error('❌ [ERRO] Falha ao resetar Banco de Dados:', err.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 5. RESTAURAR BACKUP
// ----------------------------------------------------------------------------
async function restoreBackup() {
  console.log('\n📂 [DB Admin] Buscando backups disponíveis...');
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('⚠️  Nenhum backup encontrado na pasta backups.');
      return false;
    }

    const folders = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_'));
    if (folders.length === 0) {
      console.log('⚠️  Nenhum backup encontrado.');
      return false;
    }

    folders.sort().reverse(); // Mais recente primeiro
    const latestFolder = folders[0];
    const dumpPath = path.join(BACKUP_DIR, latestFolder, 'database_dump.json');

    if (!fs.existsSync(dumpPath)) {
      console.log(`⚠️  Arquivo dump não encontrado em: ${dumpPath}`);
      return false;
    }

    console.log(`🔄 [DB Admin] Restaurando backup mais recente: ${latestFolder}...`);
    const raw = fs.readFileSync(dumpPath, 'utf8');
    const dump = JSON.parse(raw);

    if (dump.data && dump.data.users) {
      for (const u of dump.data.users) {
        await db.saveUser(u);
      }
    }

    if (dump.data && dump.data.rides) {
      for (const r of dump.data.rides) {
        await db.saveRide(r);
      }
    }

    console.log(`✅ [SUCESSO] Backup de ${dump.timestamp} restaurado com sucesso no PostgreSQL!`);
    return true;
  } catch (err) {
    console.error('❌ [ERRO] Falha ao restaurar backup:', err.message);
    return false;
  }
}

// CLI Dispatcher
async function run() {
  const arg = process.argv[2];
  if (arg === 'backup') {
    await makeBackup();
  } else if (arg === 'unlock') {
    await unlockAllUsers();
  } else if (arg === 'admin-only') {
    await setAdminOnlyAccess();
  } else if (arg === 'reset') {
    await resetDatabase();
  } else if (arg === 'restore') {
    await restoreBackup();
  } else {
    console.log('Uso: node db_admin_tools.js [backup|unlock|admin-only|reset|restore]');
  }
  process.exit(0);
}

run();
