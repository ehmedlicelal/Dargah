-- ============================================================
-- Nərimanov Digital — Seed Data
-- Run AFTER schema.sql
-- NOTE: Does not insert into auth.users (requires Supabase Auth)
-- ============================================================

-- ============================================================
-- DISTRICT ZONES — Nərimanov rayonunun sektorları
-- ============================================================
INSERT INTO public.district_zones (id, name, name_az, code, population, area_km2) VALUES
    ('11111111-0000-0000-0000-000000000001', 'Heydar Aliyev Avenue Zone', 'Heydər Əliyev pr. sektoru', 'NAR-01', 45200, 3.80),
    ('11111111-0000-0000-0000-000000000002', 'Koroglu Metro Zone',        'Koroğlu m. sektoru',        'NAR-02', 38700, 2.95),
    ('11111111-0000-0000-0000-000000000003', 'Gara Garayev Metro Zone',   'Qara Qarayev m. sektoru',  'NAR-03', 52100, 4.20),
    ('11111111-0000-0000-0000-000000000004', '8 November Avenue Zone',    '8 Noyabr pr. sektoru',      'NAR-04', 31500, 2.60),
    ('11111111-0000-0000-0000-000000000005', 'Lermontov Street Zone',     'Lermontov k. sektoru',      'NAR-05', 27900, 1.85)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- MONITORING DATA — Hava keyfiyyəti (air_quality)
-- ============================================================
INSERT INTO public.monitoring_data (zone_id, type, value, source, recorded_at) VALUES
    ('11111111-0000-0000-0000-000000000001', 'air_quality',
     '{"aqi": 48, "pm25": 12.4, "pm10": 22.1, "co2": 412, "no2": 18.5, "status": "good"}',
     'sensor', now() - interval '5 minutes'),
    ('11111111-0000-0000-0000-000000000002', 'air_quality',
     '{"aqi": 72, "pm25": 24.8, "pm10": 38.6, "co2": 445, "no2": 31.2, "status": "moderate"}',
     'sensor', now() - interval '10 minutes'),
    ('11111111-0000-0000-0000-000000000003', 'air_quality',
     '{"aqi": 95, "pm25": 35.2, "pm10": 52.0, "co2": 478, "no2": 44.7, "status": "unhealthy_sensitive"}',
     'sensor', now() - interval '8 minutes'),
    ('11111111-0000-0000-0000-000000000004', 'air_quality',
     '{"aqi": 55, "pm25": 15.1, "pm10": 27.3, "co2": 418, "no2": 22.0, "status": "moderate"}',
     'sensor', now() - interval '12 minutes'),
    ('11111111-0000-0000-0000-000000000005', 'air_quality',
     '{"aqi": 38, "pm25": 9.2,  "pm10": 16.4, "co2": 405, "no2": 14.3, "status": "good"}',
     'sensor', now() - interval '7 minutes');

-- ============================================================
-- MONITORING DATA — Trafik (traffic)
-- ============================================================
INSERT INTO public.monitoring_data (zone_id, type, value, source, recorded_at) VALUES
    ('11111111-0000-0000-0000-000000000001', 'traffic',
     '{"congestion_pct": 78, "avg_speed_kmh": 18.5, "incident_count": 2, "status": "heavy"}',
     'sensor', now() - interval '3 minutes'),
    ('11111111-0000-0000-0000-000000000002', 'traffic',
     '{"congestion_pct": 45, "avg_speed_kmh": 34.2, "incident_count": 0, "status": "moderate"}',
     'sensor', now() - interval '6 minutes'),
    ('11111111-0000-0000-0000-000000000003', 'traffic',
     '{"congestion_pct": 92, "avg_speed_kmh": 8.1,  "incident_count": 3, "status": "gridlock"}',
     'sensor', now() - interval '4 minutes'),
    ('11111111-0000-0000-0000-000000000004', 'traffic',
     '{"congestion_pct": 30, "avg_speed_kmh": 48.7, "incident_count": 0, "status": "light"}',
     'sensor', now() - interval '9 minutes'),
    ('11111111-0000-0000-0000-000000000005', 'traffic',
     '{"congestion_pct": 55, "avg_speed_kmh": 28.0, "incident_count": 1, "status": "moderate"}',
     'sensor', now() - interval '5 minutes');

-- ============================================================
-- MONITORING DATA — Kommunal (utilities)
-- ============================================================
INSERT INTO public.monitoring_data (zone_id, type, value, source, recorded_at) VALUES
    ('11111111-0000-0000-0000-000000000001', 'utilities',
     '{"water_pressure_bar": 3.2, "power_outages": 0, "gas_pressure_kpa": 18.5, "status": "normal"}',
     'sensor', now() - interval '15 minutes'),
    ('11111111-0000-0000-0000-000000000003', 'utilities',
     '{"water_pressure_bar": 1.8, "power_outages": 1, "gas_pressure_kpa": 16.2, "status": "warning"}',
     'sensor', now() - interval '20 minutes');

-- ============================================================
-- MONITORING DATA — Hadisələr (incidents)
-- ============================================================
INSERT INTO public.monitoring_data (zone_id, type, value, source, recorded_at) VALUES
    ('11111111-0000-0000-0000-000000000001', 'incident',
     '{"type": "road_accident", "severity": "minor", "location": "H.Əliyev pr. 45", "responders_dispatched": true}',
     'operator', now() - interval '45 minutes'),
    ('11111111-0000-0000-0000-000000000003', 'incident',
     '{"type": "water_leak",    "severity": "moderate", "location": "Q.Qarayev m. 12", "responders_dispatched": true}',
     'operator', now() - interval '2 hours'),
    ('11111111-0000-0000-0000-000000000002', 'incident',
     '{"type": "power_outage",  "severity": "minor",    "location": "Koroğlu m. 7-ci blok", "responders_dispatched": false}',
     'sensor', now() - interval '30 minutes');

-- ============================================================
-- SERVICES — Kommunal xidmətlər
-- ============================================================
INSERT INTO public.services (id, name, name_az, description_az, category, contact_phone, contact_email, working_hours) VALUES
    (
        '22222222-0000-0000-0000-000000000001',
        'Water Supply Service',
        'Su Kəməri Xidməti',
        'Nərimanov rayonunda içməli su, kanalizasiya və su kəməri sistemlərinin idarəçiliyi.',
        'utilities',
        '+994 12 441-XX-XX',
        'su@narimanov.gov.az',
        'B.e–C.a: 09:00–18:00'
    ),
    (
        '22222222-0000-0000-0000-000000000002',
        'Road Maintenance Service',
        'Yol Xidməti',
        'Yolların təmiri, asfaltlanması, küçə işıqlandırması və yol nişanlarının bərpası.',
        'roads',
        '+994 12 441-XX-X1',
        'yol@narimanov.gov.az',
        'B.e–C.a: 08:00–17:00'
    ),
    (
        '22222222-0000-0000-0000-000000000003',
        'Environmental Protection',
        'Ətraf Mühit Xidməti',
        'Yaşıl sahələrin baxımı, zibil toplanması və ətraf mühitin mühafizəsi.',
        'environment',
        '+994 12 441-XX-X2',
        'ekologiya@narimanov.gov.az',
        'B.e–C.ş: 08:00–20:00'
    ),
    (
        '22222222-0000-0000-0000-000000000004',
        'Public Safety',
        'İctimai Təhlükəsizlik Xidməti',
        'Rayon ərazisində ictimai qaydanın qorunması, kamera monitorinqi.',
        'safety',
        '+994 12 441-XX-X3',
        'tehlukesizlik@narimanov.gov.az',
        '24/7'
    ),
    (
        '22222222-0000-0000-0000-000000000005',
        'Social Services Center',
        'Sosial Xidmətlər Mərkəzi',
        'Əhaliyə sosial yardım, pensiya, sənəd rəsmiləşdirmə xidmətləri.',
        'social',
        '+994 12 441-XX-X4',
        'sosial@narimanov.gov.az',
        'B.e–C.a: 09:00–17:00'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- OPEN DATA REPORTS
-- ============================================================
INSERT INTO public.open_data_reports (id, title, title_az, type, data, published_at) VALUES
    (
        '33333333-0000-0000-0000-000000000001',
        'Monthly Air Quality Report — May 2025',
        'Aylıq Hava Keyfiyyəti Hesabatı — May 2025',
        'air_quality',
        '{
            "period": "2025-05",
            "avg_aqi": 61,
            "days_good": 18,
            "days_moderate": 9,
            "days_unhealthy": 4,
            "worst_zone": "NAR-03",
            "best_zone": "NAR-05"
        }',
        now() - interval '1 day'
    ),
    (
        '33333333-0000-0000-0000-000000000002',
        'Weekly Complaints Summary — Week 21',
        'Həftəlik Şikayət Xülasəsi — 21-ci Həftə',
        'complaints',
        '{
            "period": "2025-W21",
            "total": 47,
            "resolved": 31,
            "in_progress": 12,
            "open": 4,
            "top_category": "road",
            "avg_resolution_hours": 36
        }',
        now() - interval '3 days'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPLAINTS — user_id is nullable so these can be inserted without auth users
-- Coordinates are within Nərimanov district boundary
-- ============================================================
INSERT INTO public.complaints (zone_id, title, description, category, priority, status, lat, lng) VALUES
    (
        '11111111-0000-0000-0000-000000000001',
        'Su borusu partlayıb',
        'Heydər Əliyev prospekti 42 ünvanında su borusu partlayıb, yol su altındadır',
        'utilities', 'critical', 'open',
        40.4116, 49.8678
    ),
    (
        '11111111-0000-0000-0000-000000000002',
        'Elektrik kəsilməsi',
        'Koroğlu metro stansiyası yaxınlığında 3 saatdır işıq yoxdur',
        'utilities', 'high', 'in_progress',
        40.4316, 49.8784
    ),
    (
        '11111111-0000-0000-0000-000000000003',
        'Yol çuxuru',
        'Qara Qarayev metro girişinin yanında böyük çuxur yaranıb, avtomobillər zərər görür',
        'road', 'high', 'open',
        40.4091, 49.9053
    ),
    (
        '11111111-0000-0000-0000-000000000002',
        'Zibil qutular dolub',
        'Gənclik prospektindəki zibil qutular bir həftədir boşaldılmayıb',
        'environment', 'medium', 'open',
        40.4252, 49.8778
    ),
    (
        '11111111-0000-0000-0000-000000000004',
        'Küçə işığı işləmir',
        '8 Noyabr prospektinin 200 metr uzunluğunda küçə işıqları söndürülüb',
        'road', 'medium', 'in_progress',
        40.4025, 49.8630
    ),
    (
        '11111111-0000-0000-0000-000000000005',
        'Səkilər sınıb',
        'Lermontov küçəsindəki səkilər köhnəlib, yaşlılar üçün təhlükəlidir',
        'road', 'low', 'open',
        40.4188, 49.8510
    ),
    (
        '11111111-0000-0000-0000-000000000001',
        'Qaz iyi gəlir',
        'Vüsal küçəsi 15 sakinlər qaz iyindən şikayətlənir',
        'utilities', 'critical', 'open',
        40.4362, 49.8655
    ),
    (
        '11111111-0000-0000-0000-000000000003',
        'Ağaclar budanmır',
        'Ramana yolunun kənarındakı ağaclar artıq böyüyüb, görünüşü bağlayır',
        'environment', 'low', 'resolved',
        40.3985, 49.8920
    )
ON CONFLICT DO NOTHING;
