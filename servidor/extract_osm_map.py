# -*- coding: utf-8 -*-
"""
MAX DRIVE - Extrator de Mapa OSM (mapa.osm.xz) para PostgreSQL
Extrai nomes de ruas, avenidas, bairros e pontos de referência das 17 cidades da região
e insere diretamente no banco PostgreSQL na tabela street_coordinates e city_streets.
"""

import os
import sys
import lzma
import xml.etree.ElementTree as ET
import psycopg2
import json

# Conexão PostgreSQL (a partir de CONFIGURACAO_DO_SERVIDOR.env)
DB_URL = "postgresql://postgres:9420@localhost:5432/maxdrive"

# Bounding Boxes para associar cada coordenada à sua cidade exata
CITIES_BOUNDS = {
    'ituiutaba':     {'min_lat': -19.08, 'max_lat': -18.85, 'min_lon': -49.58, 'max_lon': -49.35, 'name': 'Ituiutaba'},
    'araguari':      {'min_lat': -18.75, 'max_lat': -18.52, 'min_lon': -48.30, 'max_lon': -48.05, 'name': 'Araguari'},
    'uberlandia':    {'min_lat': -19.05, 'max_lat': -18.78, 'min_lon': -48.40, 'max_lon': -48.15, 'name': 'Uberlândia'},
    'uberaba':       {'min_lat': -19.85, 'max_lat': -19.62, 'min_lon': -48.05, 'max_lon': -47.80, 'name': 'Uberaba'},
    'santa_vitoria': {'min_lat': -18.95, 'max_lat': -18.72, 'min_lon': -50.25, 'max_lon': -50.00, 'name': 'Santa Vitória'},
    'capinopolis':   {'min_lat': -18.78, 'max_lat': -18.58, 'min_lon': -49.68, 'max_lon': -49.48, 'name': 'Capinópolis'},
    'patos_de_minas':{'min_lat': -18.68, 'max_lat': -18.48, 'min_lon': -46.62, 'max_lon': -46.40, 'name': 'Patos de Minas'},
    'araxa':         {'min_lat': -19.68, 'max_lat': -19.48, 'min_lon': -47.05, 'max_lon': -46.82, 'name': 'Araxá'},
    'patrocinio':    {'min_lat': -19.05, 'max_lat': -18.82, 'min_lon': -47.10, 'max_lon': -46.88, 'name': 'Patrocínio'},
    'frutal':        {'min_lat': -20.12, 'max_lat': -19.92, 'min_lon': -49.05, 'max_lon': -48.82, 'name': 'Frutal'},
    'iturama':       {'min_lat': -19.82, 'max_lat': -19.62, 'min_lon': -50.30, 'max_lon': -50.08, 'name': 'Iturama'},
    'itumbiara':     {'min_lat': -18.52, 'max_lat': -18.32, 'min_lon': -49.32, 'max_lon': -49.10, 'name': 'Itumbiara'},
    'tupaciguara':   {'min_lat': -18.68, 'max_lat': -18.48, 'min_lon': -48.80, 'max_lon': -48.60, 'name': 'Tupaciguara'},
    'prata':         {'min_lat': -19.40, 'max_lat': -19.20, 'min_lon': -49.02, 'max_lon': -48.80, 'name': 'Prata'},
    'canapolis':     {'min_lat': -18.82, 'max_lat': -18.62, 'min_lon': -49.60, 'max_lon': -49.40, 'name': 'Canápolis'},
    'centralina':    {'min_lat': -18.68, 'max_lat': -18.48, 'min_lon': -49.64, 'max_lon': -49.44, 'name': 'Centralina'},
    'monte_carmelo': {'min_lat': -18.82, 'max_lat': -18.62, 'min_lon': -47.60, 'max_lon': -47.40, 'name': 'Monte Carmelo'}
}

def get_city_key(lat, lon):
    for key, b in CITIES_BOUNDS.items():
        if b['min_lat'] <= lat <= b['max_lat'] and b['min_lon'] <= lon <= b['max_lon']:
            return key
    return None

def process_osm_map():
    osm_path = os.path.join(os.path.dirname(__file__), 'database', 'mapa.osm.xz')
    if not os.path.exists(osm_path):
        print(f"❌ Arquivo mapa.osm.xz não encontrado em {osm_path}")
        return

    print("🚀 [OSM Extractor] Iniciando extração e mapeamento do arquivo mapa.osm.xz...")

    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    nodes_cache = {}
    extracted_records = []
    city_streets_dict = {c: set() for c in CITIES_BOUNDS.keys()}

    total_nodes = 0
    total_ways = 0

    with lzma.open(osm_path, 'rt', encoding='utf-8', errors='ignore') as f:
        current_element = None
        current_tags = {}
        current_nodes = []
        element_type = None

        for line in f:
            line_str = line.strip()

            if line_str.startswith('<node '):
                element_type = 'node'
                # Extract lat/lon/id
                parts = line_str.split()
                node_id = None
                lat, lon = None, None
                for p in parts:
                    if p.startswith('id="'): node_id = p.split('"')[1]
                    elif p.startswith('lat="'): lat = float(p.split('"')[1])
                    elif p.startswith('lon="'): lon = float(p.split('"')[1])

                if node_id and lat is not None and lon is not None:
                    nodes_cache[node_id] = (lat, lon)
                    total_nodes += 1

                current_tags = {}
                if line_str.endswith('/>'):
                    element_type = None

            elif line_str.startswith('<way '):
                element_type = 'way'
                current_nodes = []
                current_tags = {}
                if line_str.endswith('/>'):
                    element_type = None

            elif element_type == 'way' and line_str.startswith('<nd ref="'):
                ref_id = line_str.split('"')[1]
                current_nodes.append(ref_id)

            elif element_type in ('node', 'way') and line_str.startswith('<tag '):
                # Extract k/v
                k_val, v_val = None, None
                if 'k="' in line_str and 'v="' in line_str:
                    try:
                        k_val = line_str.split('k="')[1].split('"')[0]
                        v_val = line_str.split('v="')[1].split('"')[0]
                    except: pass
                if k_val and v_val:
                    current_tags[k_val] = v_val

            elif line_str.startswith('</way>'):
                total_ways += 1
                name = current_tags.get('name') or current_tags.get('name:pt')
                highway = current_tags.get('highway')
                amenity = current_tags.get('amenity')
                building = current_tags.get('building')

                if name and (highway or amenity or building or 'place' in current_tags):
                    # Calculate center lat/lon from nodes
                    valid_coords = [nodes_cache[nid] for nid in current_nodes if nid in nodes_cache]
                    if valid_coords:
                        avg_lat = sum(c[0] for c in valid_coords) / len(valid_coords)
                        avg_lon = sum(c[1] for c in valid_coords) / len(valid_coords)
                        city_key = get_city_key(avg_lat, avg_lon)

                        if city_key:
                            bairro = current_tags.get('addr:suburb') or current_tags.get('suburb') or 'Centro'
                            extracted_records.append((city_key, name, bairro, avg_lat, avg_lon))
                            city_streets_dict[city_key].add(name)

                element_type = None

    print(f"📊 [OSM Extractor] Processados {total_nodes} nós e {total_ways} caminhos/ruas.")
    print(f"💾 [OSM Extractor] Gravando {len(extracted_records)} ruas/pontos extraídos no PostgreSQL...")

    # Batch Insert em PostgreSQL
    insert_sql = """
        INSERT INTO street_coordinates (city_key, street_name, bairro, lat, lng, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT DO NOTHING
    """
    for rec in extracted_records:
        cursor.execute(insert_sql, rec)

    conn.commit()

    # Atualizar city_streets.json e tabela de ruas
    city_streets_path = os.path.join(os.path.dirname(__file__), 'database', 'city_streets.json')
    existing_streets = {}
    if os.path.exists(city_streets_path):
        try:
            with open(city_streets_path, 'r', encoding='utf-8') as sf:
                existing_streets = json.load(sf)
        except: pass

    for c_key, s_set in city_streets_dict.items():
        if c_key not in existing_streets:
            existing_streets[c_key] = []
        combined = list(set(existing_streets[c_key]).union(s_set))
        combined.sort()
        existing_streets[c_key] = combined

    with open(city_streets_path, 'w', encoding='utf-8') as sf:
        json.dump(existing_streets, sf, ensure_ascii=False, indent=2)

    cursor.close()
    conn.close()

    print("✅ [SUCESSO] Mapeamento do arquivo mapa.osm.xz finalizado!")
    for c_key, s_list in existing_streets.items():
        print(f"   🏙️  {c_key.upper()}: {len(s_list)} ruas/locais registrados")

if __name__ == '__main__':
    process_osm_map()
