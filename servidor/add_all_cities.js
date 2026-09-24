/**
 * MAX DRIVE - Adicionar Cidades e Malhas Viárias para o Triângulo Mineiro / Região
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const allCities = [
  {
    id: 'araguari',
    name: 'Araguari',
    state: 'MG',
    active: true,
    baseFareCar: 7.0,
    kmRateCar: 2.0,
    baseFareMoto: 5.0,
    kmRateMoto: 1.5,
    locations: [
      { lat: -18.6475, lng: -48.1872, name: 'Centro - Rua Rui Barbosa' },
      { lat: -18.6390, lng: -48.1950, name: 'Bairro Bosque - Av. Minas Gerais' },
      { lat: -18.6520, lng: -48.1750, name: 'Bairro Sibipiruna' },
      { lat: -18.6460, lng: -48.1880, name: 'Praça Manoel Bonito' }
    ]
  },
  {
    id: 'araxa',
    name: 'Araxá',
    state: 'MG',
    active: true,
    baseFareCar: 7.0,
    kmRateCar: 2.1,
    baseFareMoto: 5.0,
    kmRateMoto: 1.5,
    locations: [
      { lat: -19.5931, lng: -46.9406, name: 'Centro - Av. Getúlio Vargas' },
      { lat: -19.5850, lng: -46.9320, name: 'Barreiro - Estância Hidromineral' },
      { lat: -19.6010, lng: -46.9520, name: 'Bairro Urciano Lemos' }
    ]
  },
  {
    id: 'canapolis',
    name: 'Canápolis',
    state: 'MG',
    active: true,
    baseFareCar: 6.0,
    kmRateCar: 1.9,
    baseFareMoto: 4.5,
    kmRateMoto: 1.3,
    locations: [
      { lat: -18.7233, lng: -49.5039, name: 'Centro - Praça Matriz' },
      { lat: -18.7280, lng: -49.4980, name: 'Bairro Residencial Laranjeiras' }
    ]
  },
  {
    id: 'capinopolis',
    name: 'Capinópolis',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -18.6822, lng: -49.5694, name: 'Centro - Praça João Moreira de Souza' },
      { lat: -18.6750, lng: -49.5750, name: 'Bairro Semíramis' },
      { lat: -18.6840, lng: -49.5680, name: 'Terminal Rodoviário' }
    ]
  },
  {
    id: 'centralina',
    name: 'Centralina',
    state: 'MG',
    active: true,
    baseFareCar: 6.0,
    kmRateCar: 1.9,
    baseFareMoto: 4.5,
    kmRateMoto: 1.3,
    locations: [
      { lat: -18.5819, lng: -49.5392, name: 'Centro - Av. Prefeito Dacio' },
      { lat: -18.5870, lng: -49.5320, name: 'Bairro São José' }
    ]
  },
  {
    id: 'frutal',
    name: 'Frutal',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -20.0242, lng: -48.9406, name: 'Centro - Av. Juscelino Kubitschek' },
      { lat: -20.0180, lng: -48.9320, name: 'UEMG - Campus Frutal' },
      { lat: -20.0310, lng: -48.9510, name: 'Bairro Alto Boa Vista' }
    ]
  },
  {
    id: 'itumbiara',
    name: 'Itumbiara',
    state: 'GO',
    active: true,
    baseFareCar: 7.0,
    kmRateCar: 2.1,
    baseFareMoto: 5.0,
    kmRateMoto: 1.5,
    locations: [
      { lat: -18.4194, lng: -49.2158, name: 'Centro - Av. Afonso Pena' },
      { lat: -18.4120, lng: -49.2080, name: 'Beira Rio - Orla do Rio Paranaíba' },
      { lat: -18.4280, lng: -49.2280, name: 'Bairro Novo Horizonte' }
    ]
  },
  {
    id: 'ituiutaba',
    name: 'Ituiutaba',
    state: 'MG',
    active: true,
    baseFareCar: 7.0,
    kmRateCar: 2.0,
    baseFareMoto: 5.0,
    kmRateMoto: 1.5,
    locations: [
      { lat: -18.9688, lng: -49.4642, name: 'Centro - Praça da Prefeitura' },
      { lat: -18.9750, lng: -49.4520, name: 'Bairro Platina - Av. 31' },
      { lat: -18.9850, lng: -49.4700, name: 'Bairro Universitário - UEMG / FACIP' },
      { lat: -18.9550, lng: -49.4800, name: 'Bairro Novo Tempo - Av. 17' },
      { lat: -18.9710, lng: -49.4600, name: 'Terminal Rodoviário' }
    ]
  },
  {
    id: 'iturama',
    name: 'Iturama',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -19.7289, lng: -50.1964, name: 'Centro - Av. Campina Verde' },
      { lat: -19.7210, lng: -50.1880, name: 'Bairro Tiradentes' },
      { lat: -19.7360, lng: -50.2050, name: 'UFTM - Campus Iturama' }
    ]
  },
  {
    id: 'monte_carmelo',
    name: 'Monte Carmelo',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -18.7258, lng: -47.4989, name: 'Centro - Praça da Matriz' },
      { lat: -18.7180, lng: -47.4900, name: 'UFU - Campus Monte Carmelo' }
    ]
  },
  {
    id: 'patos_de_minas',
    name: 'Patos de Minas',
    state: 'MG',
    active: true,
    baseFareCar: 7.0,
    kmRateCar: 2.1,
    baseFareMoto: 5.0,
    kmRateMoto: 1.5,
    locations: [
      { lat: -18.5789, lng: -46.5181, name: 'Centro - Av. Getúlio Vargas' },
      { lat: -18.5710, lng: -46.5100, name: 'Orla da Lagoa Grande' },
      { lat: -18.5890, lng: -46.5280, name: 'UNIPAM - Campus Universitário' }
    ]
  },
  {
    id: 'patrocinio',
    name: 'Patrocínio',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -18.9439, lng: -46.9928, name: 'Centro - Av. Rui Barbosa' },
      { lat: -18.9370, lng: -46.9850, name: 'Bairro Morada Nova' }
    ]
  },
  {
    id: 'prata',
    name: 'Prata',
    state: 'MG',
    active: true,
    baseFareCar: 6.0,
    kmRateCar: 1.9,
    baseFareMoto: 4.5,
    kmRateMoto: 1.3,
    locations: [
      { lat: -19.3072, lng: -48.9242, name: 'Centro - Praça XV de Novembro' },
      { lat: -19.3000, lng: -48.9180, name: 'Bairro Pratinha' }
    ]
  },
  {
    id: 'santa_vitoria',
    name: 'Santa Vitória',
    state: 'MG',
    active: true,
    baseFareCar: 6.5,
    kmRateCar: 2.0,
    baseFareMoto: 4.5,
    kmRateMoto: 1.4,
    locations: [
      { lat: -18.8436, lng: -50.1219, name: 'Centro - Av. São Paulo' },
      { lat: -18.8500, lng: -50.1150, name: 'Bairro Brasil' },
      { lat: -18.8400, lng: -50.1100, name: 'Parque de Exposições' }
    ]
  },
  {
    id: 'tupaciguara',
    name: 'Tupaciguara',
    state: 'MG',
    active: true,
    baseFareCar: 6.0,
    kmRateCar: 1.9,
    baseFareMoto: 4.5,
    kmRateMoto: 1.3,
    locations: [
      { lat: -18.5922, lng: -48.7050, name: 'Centro - Praça Raul Soares' },
      { lat: -18.5850, lng: -48.6980, name: 'Bairro Tiradentes' }
    ]
  },
  {
    id: 'uberaba',
    name: 'Uberaba',
    state: 'MG',
    active: true,
    baseFareCar: 7.5,
    kmRateCar: 2.2,
    baseFareMoto: 5.5,
    kmRateMoto: 1.6,
    locations: [
      { lat: -19.7483, lng: -47.9319, name: 'Centro - Praça Rui Barbosa' },
      { lat: -19.7380, lng: -47.9220, name: 'UFTM - Campus Abadia' },
      { lat: -19.7590, lng: -47.9450, name: 'Shopping Uberaba / Av. Leopoldino de Oliveira' }
    ]
  },
  {
    id: 'uberlandia',
    name: 'Uberlândia',
    state: 'MG',
    active: true,
    baseFareCar: 8.0,
    kmRateCar: 2.3,
    baseFareMoto: 5.5,
    kmRateMoto: 1.6,
    locations: [
      { lat: -18.9186, lng: -48.2772, name: 'Centro - Av. Afonso Pena / Praça Tubal Vilela' },
      { lat: -18.9100, lng: -48.2600, name: 'UFU - Campus Santa Mônica' },
      { lat: -18.9280, lng: -48.2900, name: 'Center Shopping / Av. João Naves de Ávila' },
      { lat: -18.8950, lng: -48.2500, name: 'Bairro Tibery' },
      { lat: -18.9400, lng: -48.2700, name: 'Bairro Rondon Pacheco / Uberlândia Shopping' }
    ]
  }
];

async function addCities() {
  console.log('🚀 [Cidade Setup] Cadastrando 17 Cidades da Região no PostgreSQL e arquivos do sistema...');

  // 1. Salvar no PostgreSQL
  for (const c of allCities) {
    await db.saveCity(c);
  }

  // 2. Atualizar JSON local de suporte
  const dbDir = path.join(__dirname, 'database');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  fs.writeFileSync(path.join(dbDir, 'cities.json'), JSON.stringify(allCities, null, 2), 'utf8');

  // 3. Atualizar lista de ruas por cidade
  const cityStreetsPath = path.join(dbDir, 'city_streets.json');
  let existingCityStreets = {};
  if (fs.existsSync(cityStreetsPath)) {
    try {
      existingCityStreets = JSON.parse(fs.readFileSync(cityStreetsPath, 'utf8'));
    } catch (_) {}
  }

  for (const c of allCities) {
    if (!existingCityStreets[c.id] || existingCityStreets[c.id].length === 0) {
      existingCityStreets[c.id] = [
        `Avenida Principal de ${c.name}`,
        `Rua do Comércio - ${c.name}`,
        `Avenida Brasil - ${c.name}`,
        `Praça Central de ${c.name}`,
        `Terminal Rodoviário de ${c.name}`,
        `Bairro Centro - ${c.name}`,
        `Bairro Industrial - ${c.name}`
      ];
    }
  }

  fs.writeFileSync(cityStreetsPath, JSON.stringify(existingCityStreets, null, 2), 'utf8');

  console.log(`✅ [SUCESSO] 17 Cidades cadastradas com sucesso!`);
  console.log('🏙️  Cidades cadastradas: ' + allCities.map(c => c.name).join(', '));
  process.exit(0);
}

addCities();
