-- ============================================================================
-- MAX DRIVE - Esquema Relacional PostgreSQL
-- Compatível com PostgreSQL 12+ (Local, Docker, Supabase, Neon, Render, RDS)
-- ============================================================================

-- 1. TABELA DE USUÁRIOS (Passageiros, Motoristas e Administradores)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'passenger', -- 'passenger', 'driver', 'admin'
    is_admin BOOLEAN DEFAULT FALSE,
    phone VARCHAR(64),
    cpf VARCHAR(32),
    cnh VARCHAR(64),
    birth_date VARCHAR(32),
    security_code VARCHAR(32),
    city VARCHAR(128) DEFAULT 'Ituiutaba',
    rating NUMERIC(4,2) DEFAULT 5.0,
    rating_count INT DEFAULT 0,
    total_rides INT DEFAULT 0,
    registered_years INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'banned'
    ban_reason TEXT,
    approved BOOLEAN DEFAULT FALSE,
    avatar TEXT,
    vehicle JSONB, -- { type, model, plate, color, year, photos: { front, side, rear, seats, cnh, doc }, cnhMessage, docMessage }
    weekly_payment_status VARCHAR(32) DEFAULT 'REGULAR', -- 'REGULAR', 'PASSE_GRATIS', 'BLOQUEADO', 'PENDENTE'
    paid_until TIMESTAMPTZ,
    payment_blocked BOOLEAN DEFAULT FALSE,
    last_approved_by VARCHAR(255),
    last_approved_at TIMESTAMPTZ,
    latest_receipt_url TEXT,
    session_token TEXT,
    raw_data JSONB, -- Para compatibilidade com propriedades adicionais futuras
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

-- 2. TABELA DE CORRIDAS (Rides)
CREATE TABLE IF NOT EXISTS rides (
    id VARCHAR(64) PRIMARY KEY,
    passenger_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    passenger_name VARCHAR(255),
    passenger_phone VARCHAR(64),
    passenger_avatar TEXT,
    passenger_rating NUMERIC(4,2) DEFAULT 5.0,
    driver_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    driver_name VARCHAR(255),
    driver_phone VARCHAR(64),
    driver_avatar TEXT,
    driver_rating NUMERIC(4,2),
    driver_vehicle JSONB,
    driver_location JSONB, -- { lat, lng }
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    origin_coords JSONB, -- { lat, lng }
    destination_coords JSONB, -- { lat, lng }
    route_points JSONB, -- Array de coordenadas da rota [ [lat, lng], ... ]
    city VARCHAR(128) DEFAULT 'Ituiutaba',
    vehicle_type VARCHAR(32) DEFAULT 'car', -- 'car', 'moto'
    distance_km NUMERIC(8,2) DEFAULT 0,
    duration_min NUMERIC(8,1) DEFAULT 0,
    price NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(64) DEFAULT 'dinheiro',
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
    cancelled_by VARCHAR(32),
    cancel_reason TEXT,
    rating NUMERIC(3,2),
    comment TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_city ON rides(city);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at DESC);

-- 3. TABELA DE CIDADES E TARIFAS (Cities)
CREATE TABLE IF NOT EXISTS cities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    state VARCHAR(8) NOT NULL DEFAULT 'MG',
    active BOOLEAN DEFAULT TRUE,
    base_fare_car NUMERIC(10,2) NOT NULL DEFAULT 7.00,
    km_rate_car NUMERIC(10,2) NOT NULL DEFAULT 2.00,
    base_fare_moto NUMERIC(10,2) NOT NULL DEFAULT 6.00,
    km_rate_moto NUMERIC(10,2) NOT NULL DEFAULT 1.50,
    locations JSONB, -- Pontos de referência pré-cadastrados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(active);

-- 4. TABELA DE RUAS POR CIDADE (City Streets)
CREATE TABLE IF NOT EXISTS city_streets (
    city_key VARCHAR(64) NOT NULL,
    street_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (city_key, street_name)
);

CREATE INDEX IF NOT EXISTS idx_city_streets_city ON city_streets(city_key);

-- 5. TABELA DE COORDENADAS GEOESPACIAIS DE RUAS (Street Coordinates)
CREATE TABLE IF NOT EXISTS street_coordinates (
    city_key VARCHAR(64) NOT NULL,
    street_name VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    min_lat DOUBLE PRECISION,
    max_lat DOUBLE PRECISION,
    min_lng DOUBLE PRECISION,
    max_lng DOUBLE PRECISION,
    min_num INT,
    max_num INT,
    bairro VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (city_key, street_name)
);

CREATE INDEX IF NOT EXISTS idx_street_coords_city ON street_coordinates(city_key);

-- 6. TABELA DE REPORTES E RECLAMAÇÕES (Reports)
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    reporter_id VARCHAR(64),
    reporter_name VARCHAR(255),
    reporter_role VARCHAR(32), -- 'passenger', 'driver', 'admin'
    target_id VARCHAR(64),
    target_name VARCHAR(255),
    target_role VARCHAR(32),
    category VARCHAR(128),
    ride_id VARCHAR(64),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Resolvido'
    admin_response TEXT,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);

-- 7. TABELA DE CONTROLE FINANCEIRO E PAGAMENTOS SEMANAIS (Payments)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    driver_id VARCHAR(64) NOT NULL,
    driver_name VARCHAR(255),
    driver_phone VARCHAR(64),
    vehicle_type VARCHAR(32) DEFAULT 'car',
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    week_start_date VARCHAR(32),
    week_end_date VARCHAR(32),
    paid_until TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'REGULAR', -- 'REGULAR', 'PASSE_GRATIS', 'BLOQUEADO', 'PENDENTE'
    payment_method VARCHAR(64) DEFAULT 'PIX',
    receipt_url TEXT,
    notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_driver_id ON payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 8. TABELA DE MENSAGENS EM CORRIDAS (Messages)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(32) NOT NULL,
    sender_name VARCHAR(255),
    text TEXT NOT NULL,
    timestamp VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_ride_id ON messages(ride_id);

-- 9. TABELA DE MENSAGENS DIRETAS ADMIN <-> USUÁRIOS (Admin Messages)
CREATE TABLE IF NOT EXISTS admin_messages (
    id VARCHAR(64) PRIMARY KEY,
    sender_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(32) NOT NULL, -- 'admin', 'driver', 'passenger'
    sender_name VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(64) NOT NULL,
    recipient_role VARCHAR(32) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_msgs_recipient ON admin_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_admin_msgs_sender ON admin_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_admin_msgs_read ON admin_messages(read);
CREATE INDEX IF NOT EXISTS idx_admin_msgs_created ON admin_messages(created_at);

-- 10. TABELA DE TOKENS DE NOTIFICAÇÃO PUSH (FCM & Web Push)
CREATE TABLE IF NOT EXISTS push_tokens (
    token TEXT PRIMARY KEY,
    user_id VARCHAR(64),
    role VARCHAR(32),
    city VARCHAR(64),
    platform VARCHAR(32), -- 'android', 'web', 'ios'
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_role_city ON push_tokens(role, city);

