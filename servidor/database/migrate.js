/**
 * MAX DRIVE - Script de Migração Automatizada: JSON -> PostgreSQL
 * Executa schema.sql e migra todos os dados dos 9 arquivos JSON para o banco relacional sem perda de dados.
 */

const fs = require('fs');
const path = require('path');

// Carregar dotenv com fallback de caminho (CONFIGURACAO_DO_SERVIDOR.env ou .env)
try {
  const envPath = fs.existsSync(path.join(__dirname, '..', 'CONFIGURACAO_DO_SERVIDOR.env'))
    ? path.join(__dirname, '..', 'CONFIGURACAO_DO_SERVIDOR.env')
    : path.join(__dirname, '..', '.env');
  require('dotenv').config({ path: envPath });
} catch (e) {
  try {
    const dotenv = require(path.join(__dirname, '..', 'node_modules', 'dotenv'));
    const envPath = fs.existsSync(path.join(__dirname, '..', 'CONFIGURACAO_DO_SERVIDOR.env'))
      ? path.join(__dirname, '..', 'CONFIGURACAO_DO_SERVIDOR.env')
      : path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });
  } catch (_) {}
}

// Carregar pg com fallback
let pg;
try {
  pg = require('pg');
} catch (e) {
  try {
    pg = require(path.join(__dirname, '..', 'node_modules', 'pg'));
  } catch (err2) {
    try {
      pg = require(path.join(__dirname, '..', 'servidor', 'node_modules', 'pg'));
    } catch (err3) {
      console.error('❌ Módulo "pg" não encontrado. Execute: cd servidor && npm install');
      process.exit(1);
    }
  }
}
const { Pool } = pg;

const DB_DIR = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('\n❌ ERRO: Nenhuma DATABASE_URL fornecida!');
  console.error('\nUso:');
  console.error('  node APP/database/migrate.js "postgresql://usuario:senha@localhost:5432/maxdrive"');
  console.error('  ou configure a variável DATABASE_URL no arquivo APP/servidor/.env\n');
  process.exit(1);
}

// Configurar pool com suporte a SSL para Supabase / Neon / Render / AWS
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

function readJsonFile(filename) {
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Aviso: falha ao ler ${filename}:`, err.message);
    return null;
  }
}

async function runMigration() {
  console.log('\n==========================================================');
  console.log('🚀 MAX DRIVE - MIGRAÇÃO DE DADOS JSON -> POSTGRESQL');
  console.log('==========================================================');
  console.log(`📡 Conectando ao PostgreSQL... [${isLocal ? 'Local' : 'Nuvem/SSL'}]`);

  const client = await pool.connect();

  try {
    // 1. Executar schema.sql
    console.log('\n[1/10] 📋 Criando tabelas e índices via schema.sql...');
    const schemaPath = path.join(DB_DIR, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('✅ Esquema relacional criado / verificado com sucesso!');

    // 2. Migrar Cidades
    console.log('\n[2/10] 🏙️  Migrando cidades (cities.json)...');
    const cities = readJsonFile('cities.json') || [];
    let citiesCount = 0;
    for (const c of cities) {
      await client.query(`
        INSERT INTO cities (id, name, state, active, base_fare_car, km_rate_car, base_fare_moto, km_rate_moto, locations, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          state = EXCLUDED.state,
          active = EXCLUDED.active,
          base_fare_car = EXCLUDED.base_fare_car,
          km_rate_car = EXCLUDED.km_rate_car,
          base_fare_moto = EXCLUDED.base_fare_moto,
          km_rate_moto = EXCLUDED.km_rate_moto,
          locations = EXCLUDED.locations,
          updated_at = NOW()
      `, [
        c.id,
        c.name,
        c.state || 'MG',
        c.active !== false,
        Number(c.baseFareCar || 7.00),
        Number(c.kmRateCar || 2.00),
        Number(c.baseFareMoto || 6.00),
        Number(c.kmRateMoto || 1.50),
        JSON.stringify(c.locations || [])
      ]);
      citiesCount++;
    }
    console.log(`✅ ${citiesCount} cidades migradas com sucesso.`);

    // 3. Migrar Usuários e Motoristas
    console.log('\n[3/10] 👥 Migrando usuários e motoristas (users.json)...');
    const users = readJsonFile('users.json') || [];
    let usersCount = 0;
    for (const u of users) {
      await client.query(`
        INSERT INTO users (
          id, name, email, password, role, is_admin, phone, cpf, cnh, birth_date,
          security_code, city, rating, rating_count, total_rides, registered_years,
          status, ban_reason, approved, avatar, vehicle, weekly_payment_status,
          paid_until, payment_blocked, last_approved_by, last_approved_at, latest_receipt_url,
          raw_data, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27,
          $28, $29, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          is_admin = EXCLUDED.is_admin,
          phone = EXCLUDED.phone,
          cpf = EXCLUDED.cpf,
          cnh = EXCLUDED.cnh,
          birth_date = EXCLUDED.birth_date,
          city = EXCLUDED.city,
          rating = EXCLUDED.rating,
          rating_count = EXCLUDED.rating_count,
          total_rides = EXCLUDED.total_rides,
          status = EXCLUDED.status,
          ban_reason = EXCLUDED.ban_reason,
          approved = EXCLUDED.approved,
          avatar = EXCLUDED.avatar,
          vehicle = EXCLUDED.vehicle,
          weekly_payment_status = EXCLUDED.weekly_payment_status,
          paid_until = EXCLUDED.paid_until,
          payment_blocked = EXCLUDED.payment_blocked,
          last_approved_by = EXCLUDED.last_approved_by,
          last_approved_at = EXCLUDED.last_approved_at,
          latest_receipt_url = EXCLUDED.latest_receipt_url,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        u.id,
        u.name || 'Usuário',
        u.email,
        u.password || '',
        u.role || 'passenger',
        Boolean(u.isAdmin || u.role === 'admin'),
        u.phone || null,
        u.cpf || null,
        u.cnh || null,
        u.birthDate || null,
        u.securityCode || null,
        u.city || 'Ituiutaba',
        Number(u.rating || 5.0),
        Number(u.ratingCount || 0),
        Number(u.totalRides || 0),
        Number(u.registeredYears || 0),
        u.status || 'active',
        u.banReason || '',
        u.approved !== false,
        u.avatar || null,
        u.vehicle ? JSON.stringify(u.vehicle) : null,
        u.weeklyPaymentStatus || 'REGULAR',
        u.paidUntil ? new Date(u.paidUntil) : null,
        Boolean(u.paymentBlocked),
        u.lastApprovedBy || null,
        u.lastApprovedAt ? new Date(u.lastApprovedAt) : null,
        u.latestReceiptUrl || null,
        JSON.stringify(u),
        u.createdAt ? new Date(u.createdAt) : new Date()
      ]);
      usersCount++;
    }
    console.log(`✅ ${usersCount} usuários/motoristas migrados com sucesso.`);

    // 4. Migrar Corridas
    console.log('\n[4/10] 🚗 Migrando histórico de corridas (rides.json)...');
    const rides = readJsonFile('rides.json') || [];
    let ridesCount = 0;
    for (const r of rides) {
      await client.query(`
        INSERT INTO rides (
          id, passenger_id, passenger_name, passenger_phone, passenger_avatar, passenger_rating,
          driver_id, driver_name, driver_phone, driver_avatar, driver_rating,
          driver_vehicle, driver_location, origin, destination, origin_coords, destination_coords,
          route_points, city, vehicle_type, distance_km, duration_min, price,
          payment_method, status, cancelled_by, cancel_reason, rating, comment,
          raw_data, created_at, accepted_at, completed_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          driver_id = EXCLUDED.driver_id,
          driver_location = EXCLUDED.driver_location,
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        r.id,
        r.passengerId || null,
        r.passengerName || null,
        r.passengerPhone || null,
        r.passengerAvatar || null,
        r.passengerRating ? Number(r.passengerRating) : 5.0,
        r.driverId || null,
        r.driverName || null,
        r.driverPhone || null,
        r.driverAvatar || null,
        r.driverRating ? Number(r.driverRating) : null,
        r.vehicle || r.driverVehicle ? JSON.stringify(r.vehicle || r.driverVehicle) : null,
        r.driverLocation ? JSON.stringify(r.driverLocation) : null,
        r.origin || 'Origem',
        r.destination || 'Destino',
        r.originCoords ? JSON.stringify(r.originCoords) : null,
        r.destinationCoords ? JSON.stringify(r.destinationCoords) : null,
        r.routePoints ? JSON.stringify(r.routePoints) : null,
        r.city || 'Ituiutaba',
        r.vehicleType || 'car',
        Number(r.distanceKm || r.distance || 0),
        Number(r.durationMin || r.duration || 0),
        Number(r.price || 0),
        r.paymentMethod || 'dinheiro',
        r.status || 'completed',
        r.cancelledBy || null,
        r.cancelReason || null,
        r.rating ? Number(r.rating) : null,
        r.comment || null,
        JSON.stringify(r),
        r.createdAt ? new Date(r.createdAt) : new Date(),
        r.acceptedAt ? new Date(r.acceptedAt) : null,
        r.completedAt ? new Date(r.completedAt) : null
      ]);
      ridesCount++;
    }
    console.log(`✅ ${ridesCount} corridas migradas com sucesso.`);

    // 5. Migrar Reportes
    console.log('\n[5/10] 🚨 Migrando reportes e reclamações (reports.json)...');
    const reports = readJsonFile('reports.json') || [];
    let reportsCount = 0;
    for (const rep of reports) {
      await client.query(`
        INSERT INTO reports (
          id, reporter_id, reporter_name, reporter_role, target_id, target_name,
          target_role, category, ride_id, reason, status, admin_response,
          resolved_by, resolved_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          admin_response = EXCLUDED.admin_response,
          resolved_by = EXCLUDED.resolved_by,
          resolved_at = EXCLUDED.resolved_at,
          updated_at = NOW()
      `, [
        rep.id,
        rep.reporterId || null,
        rep.reporterName || null,
        rep.reporterRole || 'passenger',
        rep.targetId || null,
        rep.targetName || null,
        rep.targetRole || null,
        rep.category || null,
        rep.rideId || null,
        rep.reason || '',
        rep.status || 'Pendente',
        rep.adminResponse || null,
        rep.resolvedBy || null,
        rep.resolvedAt ? new Date(rep.resolvedAt) : null,
        rep.createdAt ? new Date(rep.createdAt) : new Date()
      ]);
      reportsCount++;
    }
    console.log(`✅ ${reportsCount} reportes migrados com sucesso.`);

    // 6. Migrar Pagamentos Semanais
    console.log('\n[6/10] 💵 Migrando auditorias de pagamentos (payments.json)...');
    const payments = readJsonFile('payments.json') || [];
    let paymentsCount = 0;
    for (const p of payments) {
      await client.query(`
        INSERT INTO payments (
          id, driver_id, driver_name, driver_phone, vehicle_type, amount,
          week_start_date, week_end_date, paid_until, status, payment_method,
          receipt_url, notes, approved_by, approved_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          receipt_url = EXCLUDED.receipt_url,
          paid_until = EXCLUDED.paid_until,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at
      `, [
        p.id,
        p.driverId,
        p.driverName || null,
        p.driverPhone || null,
        p.vehicleType || 'car',
        Number(p.amount || 0),
        p.weekStartDate || null,
        p.weekEndDate || null,
        p.paidUntil ? new Date(p.paidUntil) : null,
        p.status || 'REGULAR',
        p.paymentMethod || 'PIX',
        p.receiptUrl || null,
        p.notes || null,
        p.approvedBy || null,
        p.approvedAt ? new Date(p.approvedAt) : null
      ]);
      paymentsCount++;
    }
    console.log(`✅ ${paymentsCount} registros de pagamentos migrados com sucesso.`);

    // 7. Migrar Mensagens de Corrida
    console.log('\n[7/10] 💬 Migrando mensagens de corrida (messages.json)...');
    const messages = readJsonFile('messages.json') || [];
    let messagesCount = 0;
    for (const m of messages) {
      await client.query(`
        INSERT INTO messages (id, ride_id, sender_id, sender_role, sender_name, text, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        m.id,
        m.rideId,
        m.senderId,
        m.senderRole,
        m.senderName || null,
        m.text,
        m.timestamp || null
      ]);
      messagesCount++;
    }
    console.log(`✅ ${messagesCount} mensagens de corrida migradas com sucesso.`);

    // 8. Migrar Mensagens Diretas do Admin
    console.log('\n[8/10] 🛡️  Migrando mensagens diretas do Admin (admin_messages.json)...');
    const adminMsgs = readJsonFile('admin_messages.json') || [];
    let adminMsgsCount = 0;
    for (const am of adminMsgs) {
      await client.query(`
        INSERT INTO admin_messages (
          id, sender_id, sender_role, sender_name, recipient_id, recipient_role,
          recipient_name, text, read, timestamp, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          read = EXCLUDED.read
      `, [
        am.id,
        am.senderId,
        am.senderRole,
        am.senderName,
        am.recipientId,
        am.recipientRole,
        am.recipientName,
        am.text,
        Boolean(am.read),
        am.timestamp || null,
        am.createdAt ? new Date(am.createdAt) : new Date()
      ]);
      adminMsgsCount++;
    }
    console.log(`✅ ${adminMsgsCount} mensagens diretas migradas com sucesso.`);

    // 9. Migrar Ruas por Cidade
    console.log('\n[9/10] 🗺️  Migrando índice de nomes de ruas (city_streets.json)...');
    const cityStreetsData = readJsonFile('city_streets.json') || {};
    let cityStreetsCount = 0;
    for (const [cityKey, streetList] of Object.entries(cityStreetsData)) {
      if (Array.isArray(streetList)) {
        for (const streetName of streetList) {
          await client.query(`
            INSERT INTO city_streets (city_key, street_name, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (city_key, street_name) DO NOTHING
          `, [cityKey, streetName]);
          cityStreetsCount++;
        }
      }
    }
    console.log(`✅ ${cityStreetsCount} nomes de ruas migrados.`);

    // 10. Migrar Coordenadas Geoespaciais de Ruas
    console.log('\n[10/10] 📍 Migrando coordenadas geoespaciais reais (street_coordinates.json)...');
    const streetCoordsData = readJsonFile('street_coordinates.json') || {};
    let coordsCount = 0;
    for (const [cityKey, streetsMap] of Object.entries(streetCoordsData)) {
      if (typeof streetsMap === 'object') {
        for (const [streetName, data] of Object.entries(streetsMap)) {
          await client.query(`
            INSERT INTO street_coordinates (
              city_key, street_name, lat, lng, min_lat, max_lat, min_lng, max_lng,
              min_num, max_num, bairro, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (city_key, street_name) DO UPDATE SET
              lat = EXCLUDED.lat,
              lng = EXCLUDED.lng,
              min_lat = EXCLUDED.min_lat,
              max_lat = EXCLUDED.max_lat,
              min_lng = EXCLUDED.min_lng,
              max_lng = EXCLUDED.max_lng,
              bairro = EXCLUDED.bairro
          `, [
            cityKey,
            streetName,
            Number(data.lat || 0),
            Number(data.lng || 0),
            data.minLat !== undefined ? Number(data.minLat) : null,
            data.maxLat !== undefined ? Number(data.maxLat) : null,
            data.minLng !== undefined ? Number(data.minLng) : null,
            data.maxLng !== undefined ? Number(data.maxLng) : null,
            data.minNum !== undefined ? Number(data.minNum) : null,
            data.maxNum !== undefined ? Number(data.maxNum) : null,
            data.bairro || ''
          ]);
          coordsCount++;
        }
      }
    }
    console.log(`✅ ${coordsCount} coordenadas geoespaciais migradas com sucesso.`);

    console.log('\n==========================================================');
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM 100% DE SUCESSO!');
    console.log('==========================================================');
    console.log(`Resumo:`);
    console.log(`- Cidades: ${citiesCount}`);
    console.log(`- Usuários/Motoristas: ${usersCount}`);
    console.log(`- Corridas: ${ridesCount}`);
    console.log(`- Reportes: ${reportsCount}`);
    console.log(`- Pagamentos: ${paymentsCount}`);
    console.log(`- Mensagens Corrida: ${messagesCount}`);
    console.log(`- Mensagens Admin: ${adminMsgsCount}`);
    console.log(`- Ruas: ${cityStreetsCount}`);
    console.log(`- Coordenadas de Ruas: ${coordsCount}`);
    console.log('==========================================================\n');

  } catch (err) {
    console.error('\n❌ Erro durante a migração:', err);
  } finally {
    client.release();
  }
}

module.exports = { runMigration };

if (require.main === module) {
  runMigration().then(() => pool.end());
}
