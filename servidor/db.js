/**
 * MAX DRIVE - Camada Unificada de Acesso a Dados (PostgreSQL / JSON Fallback)
 * 
 * Fornece métodos assíncronos para todas as operações do banco de dados.
 * Conecta automaticamente ao PostgreSQL quando DATABASE_URL estiver configurada.
 * Possui modo de resiliência com fallback para JSON local quando o PostgreSQL estiver indisponível.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Carregar configurações de ambiente (CONFIGURACAO_DO_SERVIDOR.env ou .env)
try {
  const envPath = fs.existsSync(path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env'))
    ? path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env')
    : path.join(__dirname, '.env');
  require('dotenv').config({ path: envPath });
} catch (e) {}

const DB_DIR = fs.existsSync(path.join(__dirname, 'database'))
  ? path.join(__dirname, 'database')
  : path.join(__dirname, '..', 'database');

const DATABASE_URL = process.env.DATABASE_URL || null;

let pool = null;
let isPostgresReady = false;
let initPromise = null;

// Helper para arquivos JSON (Fallback seguro)
function readJson(filename) {
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) return filename.endsWith('streets.json') || filename.endsWith('coordinates.json') ? {} : [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[JSON DB] Erro ao ler ${filename}:`, err.message);
    return filename.endsWith('streets.json') || filename.endsWith('coordinates.json') ? {} : [];
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DB_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[JSON DB] Erro ao salvar ${filename}:`, err.message);
    return false;
  }
}

// Helpers para sanitização numérica de distâncias e durações (evita NaN no PostgreSQL)
function parseKm(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const match = String(val).match(/([\d\.,]+)/);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function parseMinutes(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const match = String(val).match(/([\d\.,]+)/);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

// Inicializar conexão PostgreSQL
async function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!DATABASE_URL) {
      console.warn('⚠️ [DB Engine] DATABASE_URL não definida. Utilizando modo de resiliência local (JSON Fallback).');
      return false;
    }

    try {
      const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
      pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        max: 20
      });

      pool.on('error', (err) => {
        console.warn('⚠️ [PG Pool] Conexão ociosa com banco:', err.message);
      });

      // Testar conexão
      const client = await pool.connect();
      const res = await client.query('SELECT NOW() as now, current_database() as db_name');
      client.release();

      // Ensure all schema tables and indexes exist automatically
      try {
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(schemaSql);
        }
      } catch (sErr) {
        console.warn('⚠️ [DB Engine] Aviso ao inicializar schema.sql:', sErr.message);
      }

      isPostgresReady = true;
      console.log(`✅ [DB Engine] PostgreSQL CONECTADO com sucesso! Banco: ${res.rows[0].db_name} (${isLocal ? 'Local' : 'Nuvem/SSL'})`);
      return true;
    } catch (err) {
      console.warn('⚠️ [DB Engine] Aviso ao conectar ao PostgreSQL:', err.message);
      console.warn('⚠️ [DB Engine] Utilizando modo de resiliência local (JSON Fallback).');
      isPostgresReady = false;
      return false;
    }
  })();

  return initPromise;
}

// Inicialização em background
initDB().catch(() => {});

// ============================================================================
// REPOSITÓRIO DE USUÁRIOS
// ============================================================================

async function getUsers() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, name, email, password, role, is_admin AS "isAdmin", phone, cpf, cnh,
          birth_date AS "birthDate", security_code AS "securityCode", city,
          rating::float, rating_count AS "ratingCount", total_rides AS "totalRides",
          registered_years AS "registeredYears", status, ban_reason AS "banReason",
          approved, avatar, vehicle, weekly_payment_status AS "weeklyPaymentStatus",
          paid_until AS "paidUntil", payment_blocked AS "paymentBlocked",
          last_approved_by AS "lastApprovedBy", last_approved_at AS "lastApprovedAt",
          latest_receipt_url AS "latestReceiptUrl", session_token AS "sessionToken", created_at AS "createdAt"
        FROM users
        ORDER BY created_at DESC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getUsers Postgres, usando fallback:', err.message);
    }
  }
  return readJson('users.json');
}

async function getUserById(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, name, email, password, role, is_admin AS "isAdmin", phone, cpf, cnh,
          birth_date AS "birthDate", security_code AS "securityCode", city,
          rating::float, rating_count AS "ratingCount", total_rides AS "totalRides",
          registered_years AS "registeredYears", status, ban_reason AS "banReason",
          approved, avatar, vehicle, weekly_payment_status AS "weeklyPaymentStatus",
          paid_until AS "paidUntil", payment_blocked AS "paymentBlocked",
          last_approved_by AS "lastApprovedBy", last_approved_at AS "lastApprovedAt",
          latest_receipt_url AS "latestReceiptUrl", session_token AS "sessionToken", created_at AS "createdAt"
        FROM users WHERE id = $1
      `, [id]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[DB] Erro getUserById Postgres:', err.message);
    }
  }
  const users = readJson('users.json');
  return users.find(u => u.id === id) || null;
}

async function getUserByEmail(email) {
  if (!email) return null;
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, name, email, password, role, is_admin AS "isAdmin", phone, cpf, cnh,
          birth_date AS "birthDate", security_code AS "securityCode", city,
          rating::float, rating_count AS "ratingCount", total_rides AS "totalRides",
          registered_years AS "registeredYears", status, ban_reason AS "banReason",
          approved, avatar, vehicle, weekly_payment_status AS "weeklyPaymentStatus",
          paid_until AS "paidUntil", payment_blocked AS "paymentBlocked",
          last_approved_by AS "lastApprovedBy", last_approved_at AS "lastApprovedAt",
          latest_receipt_url AS "latestReceiptUrl", session_token AS "sessionToken", created_at AS "createdAt"
        FROM users WHERE LOWER(email) = LOWER($1)
      `, [email]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[DB] Erro getUserByEmail Postgres:', err.message);
    }
  }
  const users = readJson('users.json');
  return users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase()) || null;
}

async function saveUser(user) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
        INSERT INTO users (
          id, name, email, password, role, is_admin, phone, cpf, cnh, birth_date,
          security_code, city, rating, rating_count, total_rides, registered_years,
          status, ban_reason, approved, avatar, vehicle, weekly_payment_status,
          paid_until, payment_blocked, last_approved_by, last_approved_at, latest_receipt_url,
          session_token, raw_data, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27,
          $28, $29, $30, NOW()
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
          session_token = COALESCE(EXCLUDED.session_token, users.session_token),
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        user.id,
        user.name,
        user.email,
        user.password,
        user.role || 'passenger',
        Boolean(user.isAdmin || user.role === 'admin'),
        user.phone || null,
        user.cpf || null,
        user.cnh || null,
        user.birthDate || null,
        user.securityCode || null,
        user.city || 'Ituiutaba',
        (user.rating !== null && user.rating !== undefined && Number(user.rating) > 0) ? Number(user.rating) : null,
        Number(user.ratingCount || 0),
        Number(user.totalRides || 0),
        Number(user.registeredYears || 0),
        user.status || 'active',
        user.banReason || '',
        user.approved !== false,
        user.avatar || null,
        user.vehicle ? JSON.stringify(user.vehicle) : null,
        user.weeklyPaymentStatus || 'REGULAR',
        user.paidUntil ? new Date(user.paidUntil) : null,
        Boolean(user.paymentBlocked),
        user.lastApprovedBy || null,
        user.lastApprovedAt ? new Date(user.lastApprovedAt) : null,
        user.latestReceiptUrl || null,
        user.sessionToken || user.session_token || null,
        JSON.stringify(user),
        user.createdAt ? new Date(user.createdAt) : new Date()
      ]);
    } catch (err) {
      console.error('[DB] Erro saveUser Postgres, sincronizando com fallback:', err.message);
    }
  }

  // Sempre sincroniza também com JSON para garantir integridade local redundante
  const users = readJson('users.json');
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }
  writeJson('users.json', users);
  return user;
}

// ============================================================================
// REPOSITÓRIO DE CORRIDAS (Rides)
// ============================================================================

async function getRides() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, passenger_id AS "passengerId", passenger_name AS "passengerName",
          passenger_phone AS "passengerPhone", passenger_avatar AS "passengerAvatar",
          passenger_rating::float AS "passengerRating", driver_id AS "driverId",
          driver_name AS "driverName", driver_phone AS "driverPhone",
          driver_avatar AS "driverAvatar", driver_rating::float AS "driverRating",
          driver_vehicle AS "vehicle", driver_location AS "driverLocation",
          origin, destination, origin_coords AS "originCoords",
          destination_coords AS "destinationCoords", route_points AS "routePoints",
          city, vehicle_type AS "vehicleType", distance_km::float AS "distanceKm",
          duration_min::float AS "durationMin", price::float AS "price",
          payment_method AS "paymentMethod", status, cancelled_by AS "cancelledBy",
          cancel_reason AS "cancelReason", rating::float, comment,
          created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt"
        FROM rides
        ORDER BY created_at DESC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getRides Postgres:', err.message);
    }
  }
  return readJson('rides.json');
}

async function getRideById(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, passenger_id AS "passengerId", passenger_name AS "passengerName",
          passenger_phone AS "passengerPhone", passenger_avatar AS "passengerAvatar",
          passenger_rating::float AS "passengerRating", driver_id AS "driverId",
          driver_name AS "driverName", driver_phone AS "driverPhone",
          driver_avatar AS "driverAvatar", driver_rating::float AS "driverRating",
          driver_vehicle AS "vehicle", driver_location AS "driverLocation",
          origin, destination, origin_coords AS "originCoords",
          destination_coords AS "destinationCoords", route_points AS "routePoints",
          city, vehicle_type AS "vehicleType", distance_km::float AS "distanceKm",
          duration_min::float AS "durationMin", price::float AS "price",
          payment_method AS "paymentMethod", status, cancelled_by AS "cancelledBy",
          cancel_reason AS "cancelReason", rating::float, comment,
          created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt"
        FROM rides WHERE id = $1
      `, [id]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[DB] Erro getRideById Postgres:', err.message);
    }
  }
  const rides = readJson('rides.json');
  return rides.find(r => r.id === id) || null;
}

async function saveRide(ride) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
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
          passenger_id = COALESCE(EXCLUDED.passenger_id, rides.passenger_id),
          passenger_name = COALESCE(EXCLUDED.passenger_name, rides.passenger_name),
          passenger_phone = COALESCE(EXCLUDED.passenger_phone, rides.passenger_phone),
          passenger_avatar = COALESCE(EXCLUDED.passenger_avatar, rides.passenger_avatar),
          passenger_rating = COALESCE(EXCLUDED.passenger_rating, rides.passenger_rating),
          status = EXCLUDED.status,
          driver_id = COALESCE(EXCLUDED.driver_id, rides.driver_id),
          driver_name = COALESCE(EXCLUDED.driver_name, rides.driver_name),
          driver_phone = COALESCE(EXCLUDED.driver_phone, rides.driver_phone),
          driver_avatar = COALESCE(EXCLUDED.driver_avatar, rides.driver_avatar),
          driver_rating = COALESCE(EXCLUDED.driver_rating, rides.driver_rating),
          driver_vehicle = COALESCE(EXCLUDED.driver_vehicle, rides.driver_vehicle),
          driver_location = COALESCE(EXCLUDED.driver_location, rides.driver_location),
          origin = EXCLUDED.origin,
          destination = EXCLUDED.destination,
          origin_coords = EXCLUDED.origin_coords,
          destination_coords = EXCLUDED.destination_coords,
          route_points = EXCLUDED.route_points,
          city = EXCLUDED.city,
          vehicle_type = EXCLUDED.vehicle_type,
          distance_km = EXCLUDED.distance_km,
          duration_min = EXCLUDED.duration_min,
          price = EXCLUDED.price,
          payment_method = EXCLUDED.payment_method,
          cancelled_by = EXCLUDED.cancelled_by,
          cancel_reason = EXCLUDED.cancel_reason,
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          accepted_at = COALESCE(EXCLUDED.accepted_at, rides.accepted_at),
          completed_at = COALESCE(EXCLUDED.completed_at, rides.completed_at),
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        ride.id,
        ride.passengerId || null,
        ride.passengerName || null,
        ride.passengerPhone || null,
        ride.passengerAvatar || null,
        ride.passengerRating ? Number(ride.passengerRating) : 5.0,
        ride.driverId || null,
        ride.driverName || null,
        ride.driverPhone || null,
        ride.driverAvatar || null,
        ride.driverRating ? Number(ride.driverRating) : null,
        ride.vehicle || ride.driverVehicle ? JSON.stringify(ride.vehicle || ride.driverVehicle) : null,
        ride.driverLocation ? JSON.stringify(ride.driverLocation) : null,
        ride.origin || 'Origem',
        ride.destination || 'Destino',
        ride.originCoords ? JSON.stringify(ride.originCoords) : null,
        ride.destinationCoords ? JSON.stringify(ride.destinationCoords) : null,
        ride.routePoints ? JSON.stringify(ride.routePoints) : null,
        ride.city || 'Ituiutaba',
        ride.vehicleType || 'car',
        parseKm(ride.distanceKm || ride.distance),
        parseMinutes(ride.durationMin || ride.duration),
        Number(ride.price || 0),
        ride.paymentMethod || 'dinheiro',
        ride.status || 'pending',
        ride.cancelledBy || null,
        ride.cancelReason || null,
        ride.rating ? Number(ride.rating) : null,
        ride.comment || null,
        JSON.stringify(ride),
        ride.createdAt ? new Date(ride.createdAt) : new Date(),
        ride.acceptedAt ? new Date(ride.acceptedAt) : null,
        ride.completedAt ? new Date(ride.completedAt) : null
      ]);
    } catch (err) {
      console.error('[DB] Erro saveRide Postgres:', err.message);
    }
  }

  const rides = readJson('rides.json');
  const idx = rides.findIndex(r => r.id === ride.id);
  if (idx >= 0) {
    rides[idx] = { ...rides[idx], ...ride };
  } else {
    rides.push(ride);
  }
  writeJson('rides.json', rides);
  return ride;
}

// ============================================================================
// REPOSITÓRIO DE CIDADES (Cities)
// ============================================================================

async function getCities() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, name, state, active, base_fare_car::float AS "baseFareCar",
          km_rate_car::float AS "kmRateCar", base_fare_moto::float AS "baseFareMoto",
          km_rate_moto::float AS "kmRateMoto", locations
        FROM cities
        ORDER BY name ASC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getCities Postgres:', err.message);
    }
  }
  return readJson('cities.json');
}

async function saveCity(city) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
        INSERT INTO cities (id, name, state, active, base_fare_car, km_rate_car, base_fare_moto, km_rate_moto, locations, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
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
        city.id,
        city.name,
        city.state || 'MG',
        city.active !== false,
        Number(city.baseFareCar || 7.00),
        Number(city.kmRateCar || 2.00),
        Number(city.baseFareMoto || 6.00),
        Number(city.kmRateMoto || 1.50),
        JSON.stringify(city.locations || [])
      ]);
    } catch (err) {
      console.error('[DB] Erro saveCity Postgres:', err.message);
    }
  }

  const cities = readJson('cities.json');
  const idx = cities.findIndex(c => c.id === city.id);
  if (idx >= 0) {
    cities[idx] = { ...cities[idx], ...city };
  } else {
    cities.push(city);
  }
  writeJson('cities.json', cities);
  return city;
}

async function deleteCity(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM cities WHERE id = $1', [id]);
    } catch (err) {
      console.error('[DB] Erro deleteCity Postgres:', err.message);
    }
  }

  const cities = readJson('cities.json');
  const filtered = cities.filter(c => c.id !== id);
  writeJson('cities.json', filtered);
  return true;
}

// ============================================================================
// REPOSITÓRIO DE REPORTES (Reports)
// ============================================================================

async function getReports() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, reporter_id AS "reporterId", reporter_name AS "reporterName",
          reporter_role AS "reporterRole", target_id AS "targetId", target_name AS "targetName",
          target_role AS "targetRole", category, ride_id AS "rideId", reason, status,
          admin_response AS "adminResponse", resolved_by AS "resolvedBy",
          resolved_at AS "resolvedAt", created_at AS "createdAt"
        FROM reports
        ORDER BY created_at DESC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getReports Postgres:', err.message);
    }
  }
  return readJson('reports.json');
}

async function saveReport(report) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
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
        report.id,
        report.reporterId || null,
        report.reporterName || null,
        report.reporterRole || 'passenger',
        report.targetId || null,
        report.targetName || null,
        report.targetRole || null,
        report.category || null,
        report.rideId || null,
        report.reason || '',
        report.status || 'Pendente',
        report.adminResponse || null,
        report.resolvedBy || null,
        report.resolvedAt ? new Date(report.resolvedAt) : null,
        report.createdAt ? new Date(report.createdAt) : new Date()
      ]);
    } catch (err) {
      console.error('[DB] Erro saveReport Postgres:', err.message);
    }
  }

  const reports = readJson('reports.json');
  const idx = reports.findIndex(r => r.id === report.id);
  if (idx >= 0) {
    reports[idx] = { ...reports[idx], ...report };
  } else {
    reports.push(report);
  }
  writeJson('reports.json', reports);
  return report;
}

// ============================================================================
// REPOSITÓRIO DE PAGAMENTOS (Payments)
// ============================================================================

async function getPayments() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, driver_id AS "driverId", driver_name AS "driverName",
          driver_phone AS "driverPhone", vehicle_type AS "vehicleType",
          amount::float AS "amount", week_start_date AS "weekStartDate",
          week_end_date AS "weekEndDate", paid_until AS "paidUntil",
          status, payment_method AS "paymentMethod", receipt_url AS "receiptUrl",
          notes, approved_by AS "approvedBy", approved_at AS "approvedAt",
          created_at AS "createdAt"
        FROM payments
        ORDER BY created_at DESC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getPayments Postgres:', err.message);
    }
  }
  return readJson('payments.json');
}

async function savePayment(payment) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
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
          approved_at = EXCLUDED.approved_at,
          amount = EXCLUDED.amount,
          notes = EXCLUDED.notes
      `, [
        payment.id,
        payment.driverId,
        payment.driverName || null,
        payment.driverPhone || null,
        payment.vehicleType || 'car',
        Number(payment.amount || 0),
        payment.weekStartDate || null,
        payment.weekEndDate || null,
        payment.paidUntil ? new Date(payment.paidUntil) : null,
        payment.status || 'REGULAR',
        payment.paymentMethod || 'PIX',
        payment.receiptUrl || null,
        payment.notes || null,
        payment.approvedBy || null,
        payment.approvedAt ? new Date(payment.approvedAt) : null
      ]);
    } catch (err) {
      console.error('[DB] Erro savePayment Postgres:', err.message);
    }
  }

  const payments = readJson('payments.json');
  const idx = payments.findIndex(p => p.id === payment.id);
  if (idx >= 0) {
    payments[idx] = { ...payments[idx], ...payment };
  } else {
    payments.push(payment);
  }
  writeJson('payments.json', payments);
  return payment;
}

// ============================================================================
// REPOSITÓRIO DE MENSAGENS DE CORRIDA (Messages)
// ============================================================================

async function getMessages(rideId) {
  await initDB();
  if (isPostgresReady) {
    try {
      if (rideId) {
        const res = await pool.query(`
          SELECT 
            id, ride_id AS "rideId", sender_id AS "senderId",
            sender_role AS "senderRole", sender_name AS "senderName",
            text, timestamp, created_at AS "createdAt"
          FROM messages
          WHERE ride_id = $1
          ORDER BY created_at ASC
        `, [rideId]);
        return res.rows;
      } else {
        const res = await pool.query(`
          SELECT 
            id, ride_id AS "rideId", sender_id AS "senderId",
            sender_role AS "senderRole", sender_name AS "senderName",
            text, timestamp, created_at AS "createdAt"
          FROM messages
          ORDER BY created_at ASC
        `);
        return res.rows;
      }
    } catch (err) {
      console.error('[DB] Erro getMessages Postgres:', err.message);
    }
  }
  const messages = readJson('messages.json') || [];
  return rideId ? messages.filter(m => m.rideId === rideId) : messages;
}

async function saveMessage(msg) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
        INSERT INTO messages (id, ride_id, sender_id, sender_role, sender_name, text, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        msg.id,
        msg.rideId,
        msg.senderId,
        msg.senderRole,
        msg.senderName || null,
        msg.text,
        msg.timestamp || null
      ]);
    } catch (err) {
      console.error('[DB] Erro saveMessage Postgres:', err.message);
    }
  }

  const messages = readJson('messages.json') || [];
  const idx = messages.findIndex(m => m.id === msg.id);
  if (idx !== -1) {
    messages[idx] = msg;
  } else {
    messages.push(msg);
  }
  writeJson('messages.json', messages);
  return msg;
}

// ============================================================================
// REPOSITÓRIO DE MENSAGENS DIRETAS ADMIN (Admin Messages)
// ============================================================================

async function getAdminMessages(userId) {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, sender_id AS "senderId", sender_role AS "senderRole",
          sender_name AS "senderName", recipient_id AS "recipientId",
          recipient_role AS "recipientRole", recipient_name AS "recipientName",
          text, read, timestamp, created_at AS "createdAt"
        FROM admin_messages
        WHERE sender_id = $1 OR recipient_id = $1
        ORDER BY created_at ASC
      `, [userId]);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getAdminMessages Postgres:', err.message);
    }
  }
  const all = readJson('admin_messages.json');
  return all.filter(m => m.senderId === userId || m.recipientId === userId);
}

async function getAllAdminMessages() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT 
          id, sender_id AS "senderId", sender_role AS "senderRole",
          sender_name AS "senderName", recipient_id AS "recipientId",
          recipient_role AS "recipientRole", recipient_name AS "recipientName",
          text, read, timestamp, created_at AS "createdAt"
        FROM admin_messages
        ORDER BY created_at ASC
      `);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getAllAdminMessages Postgres:', err.message);
    }
  }
  return readJson('admin_messages.json');
}

async function saveAdminMessage(msg) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query(`
        INSERT INTO admin_messages (
          id, sender_id, sender_role, sender_name, recipient_id, recipient_role,
          recipient_name, text, read, timestamp, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          read = EXCLUDED.read
      `, [
        msg.id,
        msg.senderId,
        msg.senderRole,
        msg.senderName,
        msg.recipientId,
        msg.recipientRole,
        msg.recipientName,
        msg.text,
        Boolean(msg.read),
        msg.timestamp || null,
        msg.createdAt ? new Date(msg.createdAt) : new Date()
      ]);
    } catch (err) {
      console.error('[DB] Erro saveAdminMessage Postgres:', err.message);
    }
  }

  const all = readJson('admin_messages.json') || [];
  const idx = all.findIndex(m => m.id === msg.id);
  if (idx !== -1) {
    all[idx] = msg;
  } else {
    all.push(msg);
  }
  writeJson('admin_messages.json', all);
  return msg;
}

async function markAdminMessagesRead(userId, readerRole) {
  await initDB();
  if (isPostgresReady) {
    try {
      if (readerRole === 'admin') {
        await pool.query(`
          UPDATE admin_messages
          SET read = TRUE
          WHERE (sender_id = $1 OR recipient_id = $1) AND sender_role != 'admin' AND read = FALSE
        `, [userId]);
      } else {
        await pool.query(`
          UPDATE admin_messages
          SET read = TRUE
          WHERE (recipient_id = $1 OR sender_id = $1) AND sender_role = 'admin' AND read = FALSE
        `, [userId]);
      }
    } catch (err) {
      console.error('[DB] Erro markAdminMessagesRead Postgres:', err.message);
    }
  }

  const all = readJson('admin_messages.json');
  let changed = false;
  all.forEach(m => {
    if (readerRole === 'admin') {
      if ((m.senderId === userId || m.recipientId === userId) && m.senderRole !== 'admin' && !m.read) {
        m.read = true;
        changed = true;
      }
    } else {
      if ((m.recipientId === userId || m.senderId === userId) && m.senderRole === 'admin' && !m.read) {
        m.read = true;
        changed = true;
      }
    }
  });
  if (changed) writeJson('admin_messages.json', all);
  return true;
}

// ============================================================================
// TOKENS DE NOTIFICAÇÃO PUSH (Push Tokens - FCM & Web)
// ============================================================================

async function getPushTokens(filters = {}) {
  await initDB();
  if (isPostgresReady) {
    try {
      let query = `SELECT token, user_id AS "userId", role, city, platform, updated_at AS "updatedAt" FROM push_tokens WHERE 1=1`;
      const params = [];
      if (filters.userId) {
        params.push(filters.userId);
        query += ` AND user_id = $${params.length}`;
      }
      if (Array.isArray(filters.userIds) && filters.userIds.length > 0) {
        params.push(filters.userIds);
        query += ` AND user_id = ANY($${params.length})`;
      }
      if (filters.role) {
        params.push(filters.role);
        query += ` AND role = $${params.length}`;
      }
      if (filters.city) {
        params.push(filters.city.toLowerCase());
        query += ` AND LOWER(city) = $${params.length}`;
      }
      const res = await pool.query(query, params);
      return res.rows;
    } catch (err) {
      console.error('[DB] Erro getPushTokens Postgres:', err.message);
    }
  }

  const all = readJson('push_tokens.json') || [];
  return all.filter(t => {
    if (filters.userId && t.userId !== filters.userId) return false;
    if (Array.isArray(filters.userIds) && !filters.userIds.includes(t.userId)) return false;
    if (filters.role && t.role !== filters.role) return false;
    if (filters.city && (t.city || '').toLowerCase() !== filters.city.toLowerCase()) return false;
    return true;
  });
}

async function savePushToken(tokenData) {
  if (!tokenData || !tokenData.token) return null;
  await initDB();
  const tokenRecord = {
    token: String(tokenData.token).trim(),
    userId: tokenData.userId || null,
    role: tokenData.role || 'passenger',
    city: (tokenData.city || 'ituiutaba').toLowerCase(),
    platform: tokenData.platform || 'android',
    updatedAt: new Date().toISOString()
  };

  if (isPostgresReady) {
    try {
      await pool.query(`
        INSERT INTO push_tokens (token, user_id, role, city, platform, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          role = EXCLUDED.role,
          city = EXCLUDED.city,
          platform = EXCLUDED.platform,
          updated_at = NOW()
      `, [
        tokenRecord.token,
        tokenRecord.userId,
        tokenRecord.role,
        tokenRecord.city,
        tokenRecord.platform
      ]);
    } catch (err) {
      console.error('[DB] Erro savePushToken Postgres:', err.message);
    }
  }

  const all = readJson('push_tokens.json') || [];
  const idx = all.findIndex(t => t.token === tokenRecord.token);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...tokenRecord };
  } else {
    all.push(tokenRecord);
  }
  writeJson('push_tokens.json', all);
  return tokenRecord;
}

async function deletePushToken(token) {
  if (!token) return false;
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM push_tokens WHERE token = $1', [token]);
    } catch (err) {
      console.error('[DB] Erro deletePushToken Postgres:', err.message);
    }
  }
  const all = readJson('push_tokens.json') || [];
  const filtered = all.filter(t => t.token !== token);
  writeJson('push_tokens.json', filtered);
  return true;
}

// ============================================================================
// COORDENADAS GEOESPACIAIS E RUAS (Street Coordinates)
// ============================================================================

async function getStreetCoordinates() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query(`
        SELECT city_key, street_name, lat, lng, min_lat, max_lat, min_lng, max_lng, min_num, max_num, bairro
        FROM street_coordinates
      `);
      if (res.rows.length > 0) {
        const result = {};
        res.rows.forEach(r => {
          if (!result[r.city_key]) result[r.city_key] = {};
          result[r.city_key][r.street_name] = {
            lat: r.lat,
            lng: r.lng,
            minLat: r.min_lat,
            maxLat: r.max_lat,
            minLng: r.min_lng,
            maxLng: r.max_lng,
            minNum: r.min_num,
            maxNum: r.max_num,
            bairro: r.bairro || ''
          };
        });
        return result;
      }
    } catch (err) {
      console.error('[DB] Erro getStreetCoordinates Postgres:', err.message);
    }
  }
  return readJson('street_coordinates.json');
}

async function getCityStreets() {
  await initDB();
  if (isPostgresReady) {
    try {
      const res = await pool.query('SELECT city_key, street_name FROM city_streets ORDER BY street_name ASC');
      if (res.rows.length > 0) {
        const result = {};
        res.rows.forEach(r => {
          if (!result[r.city_key]) result[r.city_key] = [];
          result[r.city_key].push(r.street_name);
        });
        return result;
      }
    } catch (err) {
      console.error('[DB] Erro getCityStreets Postgres:', err.message);
    }
  }
  return readJson('city_streets.json');
}

// ============================================================================
// DIAGNÓSTICO E STATUS DO BANCO
// ============================================================================

async function getDBStatus() {
  await initDB();
  let latencyMs = null;
  let dbName = null;
  let serverTime = null;

  if (isPostgresReady && pool) {
    try {
      const start = Date.now();
      const res = await pool.query('SELECT NOW() as now, current_database() as db');
      latencyMs = Date.now() - start;
      dbName = res.rows[0].db;
      serverTime = res.rows[0].now;
    } catch (e) {
      latencyMs = null;
    }
  }

  // Mascarar URL para privacidade
  let maskedUrl = null;
  if (DATABASE_URL) {
    try {
      const u = new URL(DATABASE_URL);
      maskedUrl = `${u.protocol}//${u.username}:****@${u.host}${u.pathname}`;
    } catch (e) {
      maskedUrl = 'postgresql://[configurado]';
    }
  }

  return {
    engine: isPostgresReady ? 'PostgreSQL' : 'JSON_Local_Fallback',
    isPostgres: isPostgresReady,
    databaseName: dbName || (isPostgresReady ? 'maxdrive' : 'local_json_files'),
    latencyMs,
    serverTime,
    configuredUrl: maskedUrl,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// SINCRONIZAÇÃO BIDIRECIONAL (PostgreSQL <-> Cache JSON)
// ============================================================================

async function syncJsonWithPostgres(filename, data) {
  if (!isPostgresReady || !pool) return;
  try {
    switch (filename) {
      case 'users.json': {
        if (!Array.isArray(data)) return;
        for (const user of data) {
          await saveUser(user);
        }
        break;
      }
      case 'rides.json': {
        if (!Array.isArray(data)) return;
        const toSync = data.slice(0, 100);
        for (const ride of toSync) {
          await saveRide(ride);
        }
        break;
      }
      case 'cities.json': {
        if (!Array.isArray(data)) return;
        for (const city of data) {
          await saveCity(city);
        }
        break;
      }
      case 'reports.json': {
        if (!Array.isArray(data)) return;
        const toSync = data.slice(0, 100);
        for (const report of toSync) {
          await saveReport(report);
        }
        break;
      }
      case 'payments.json': {
        if (!Array.isArray(data)) return;
        const toSync = data.slice(0, 100);
        for (const payment of toSync) {
          await savePayment(payment);
        }
        break;
      }
      case 'messages.json': {
        if (!Array.isArray(data)) return;
        const toSync = data.slice(-100);
        for (const msg of toSync) {
          await saveMessage(msg);
        }
        break;
      }
      case 'admin_messages.json': {
        if (!Array.isArray(data)) return;
        const toSync = data.slice(-100);
        for (const msg of toSync) {
          await saveAdminMessage(msg);
        }
        break;
      }
      case 'push_tokens.json': {
        if (!Array.isArray(data)) return;
        for (const pt of data) {
          await savePushToken(pt);
        }
        break;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [DB Sync] Erro ao sincronizar ${filename} com PostgreSQL:`, err.message);
  }
}

async function hydrateJsonFromPostgres() {
  await initDB();
  if (!isPostgresReady || !pool) return false;
  try {
    console.log('🔄 [DB Hydrate] Sincronizando dados do PostgreSQL para o cache local...');
    
    // Verificar se existem registros no Postgres
    const countRes = await pool.query('SELECT count(*) FROM users');
    const totalUsers = parseInt(countRes.rows[0].count, 10);
    if (totalUsers === 0) {
      console.log('ℹ️  [DB Hydrate] O PostgreSQL está vazio na nuvem. Executando carga inicial automática...');
      try {
        const migrate = require('./database/migrate.js');
        if (typeof migrate.runMigration === 'function') {
          await migrate.runMigration();
        }
      } catch (mErr) {
        console.warn('⚠️ [DB Hydrate] Aviso durante carga inicial automática:', mErr.message);
      }
    }

    const existingJsonUsers = readJson('users.json') || [];
    const users = await getUsers();
    if (users && users.length > 0) {
      users.forEach(u => {
        const jsonMatch = existingJsonUsers.find(ju => ju.id === u.id || (ju.email && u.email && ju.email.toLowerCase() === u.email.toLowerCase()));
        if (jsonMatch && (jsonMatch.role === 'admin' || jsonMatch.isAdmin === true)) {
          u.role = 'admin';
          u.isAdmin = true;
          pool.query("UPDATE users SET role = 'admin', is_admin = TRUE WHERE id = $1", [u.id]).catch(() => {});
        }
      });
      writeJson('users.json', users);
    }

    const rides = await getRides();
    if (rides && rides.length > 0) writeJson('rides.json', rides);

    const cities = await getCities();
    if (cities && cities.length > 0) writeJson('cities.json', cities);

    const reports = await getReports();
    if (reports && reports.length > 0) writeJson('reports.json', reports);

    const payments = await getPayments();
    if (payments && payments.length > 0) writeJson('payments.json', payments);

    const messages = await getMessages();
    if (messages && messages.length > 0) writeJson('messages.json', messages);

    const adminMessages = await getAllAdminMessages();
    if (adminMessages && adminMessages.length > 0) writeJson('admin_messages.json', adminMessages);

    const pushTokens = await getPushTokens();
    if (pushTokens && pushTokens.length > 0) writeJson('push_tokens.json', pushTokens);

    console.log(`✅ [DB Hydrate] Cache local sincronizado com sucesso (${users.length} usuários, ${rides.length} corridas)!`);
    return true;
  } catch (err) {
    console.warn('⚠️ [DB Hydrate] Aviso durante sincronização inicial:', err.message);
    return false;
  }
}

async function query(text, params) {
  await initDB();
  if (isPostgresReady && pool) {
    return await pool.query(text, params);
  }
  return { rows: [], rowCount: 0 };
}

async function deleteUser(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    } catch (err) {
      console.error('[DB] Erro deleteUser Postgres:', err.message);
    }
  }
  const users = readJson('users.json') || [];
  const filtered = users.filter(u => u.id !== id);
  writeJson('users.json', filtered);
  return true;
}

async function deleteReport(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM reports WHERE id = $1', [id]);
    } catch (err) {
      console.error('[DB] Erro deleteReport Postgres:', err.message);
    }
  }
  const reports = readJson('reports.json') || [];
  const filtered = reports.filter(r => r.id !== id);
  writeJson('reports.json', filtered);
  return true;
}

async function deleteAdminMessage(id) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM admin_messages WHERE id = $1', [id]);
    } catch (err) {
      console.error('[DB] Erro deleteAdminMessage Postgres:', err.message);
    }
  }
  const msgs = readJson('admin_messages.json') || [];
  const filtered = msgs.filter(m => m.id !== id);
  writeJson('admin_messages.json', filtered);
  return true;
}

async function deleteAdminMessagesForUser(userId) {
  await initDB();
  if (isPostgresReady) {
    try {
      await pool.query('DELETE FROM admin_messages WHERE sender_id = $1 OR recipient_id = $1', [userId]);
    } catch (err) {
      console.error('[DB] Erro deleteAdminMessagesForUser Postgres:', err.message);
    }
  }
  const msgs = readJson('admin_messages.json') || [];
  const filtered = msgs.filter(m => m.senderId !== userId && m.recipientId !== userId);
  writeJson('admin_messages.json', filtered);
  return true;
}

module.exports = {
  initDB,
  query,
  getUsers,
  getUserById,
  getUserByEmail,
  saveUser,
  deleteUser,
  getRides,
  getRideById,
  saveRide,
  getCities,
  saveCity,
  deleteCity,
  getReports,
  saveReport,
  deleteReport,
  getPayments,
  savePayment,
  getMessages,
  saveMessage,
  getAdminMessages,
  getAllAdminMessages,
  saveAdminMessage,
  deleteAdminMessage,
  deleteAdminMessagesForUser,
  markAdminMessagesRead,
  getPushTokens,
  savePushToken,
  deletePushToken,
  getStreetCoordinates,
  getCityStreets,
  getDBStatus,
  syncJsonWithPostgres,
  hydrateJsonFromPostgres,
  readJson,
  writeJson
};

