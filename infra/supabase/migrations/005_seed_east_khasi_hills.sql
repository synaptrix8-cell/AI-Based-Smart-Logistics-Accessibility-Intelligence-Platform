-- ============================================
-- Migration 005: Seed Data — East Khasi Hills
-- Setu — AI-Based Smart Logistics Platform
-- ============================================
-- Real road data from the Shillong corridor (NH6/NH40).
-- Geometries are simplified from OpenStreetMap.
-- Risk scores are realistic baselines for demo purposes.

-- -----------------------------------------------
-- 1. Insert East Khasi Hills District
-- -----------------------------------------------
INSERT INTO public.districts (id, name, state, geometry)
SELECT
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'East Khasi Hills',
    'Meghalaya',
    ST_GeomFromText('MULTIPOLYGON(((91.6 25.1, 92.1 25.1, 92.1 25.7, 91.6 25.7, 91.6 25.1)))', 4326)
WHERE NOT EXISTS (
    SELECT 1 FROM public.districts WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
);

-- -----------------------------------------------
-- 2. Insert Road Segments along NH6 and NH40
-- -----------------------------------------------
INSERT INTO public.road_segments (id, district_id, geometry, name, highway_ref, base_risk, length_km)
SELECT v.id, v.district_id, v.geometry, v.name, v.highway_ref, v.base_risk, v.length_km
FROM (VALUES
    ('b0000001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.765 25.891, 91.780 25.870, 91.795 25.848)', 4326),
     'Nongpoh – Umiam Approach', 'NH6', 0.35::real, 6.2::real),

    ('b0000002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.795 25.848, 91.830 25.830, 91.860 25.815)', 4326),
     'Umiam Lake Bypass', 'NH6', 0.25::real, 7.8::real),

    ('b0000003-0000-0000-0000-000000000003'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.860 25.815, 91.875 25.795, 91.882 25.780)', 4326),
     'Umiam – Upper Shillong Descent', 'NH6', 0.65::real, 4.5::real),

    ('b0000004-0000-0000-0000-000000000004'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.882 25.780, 91.876 25.572, 91.884 25.565)', 4326),
     'Upper Shillong – Laitumkhrah', 'NH6', 0.30::real, 5.1::real),

    ('b0000005-0000-0000-0000-000000000005'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.884 25.565, 91.893 25.555, 91.900 25.548)', 4326),
     'Shillong Police Bazaar Bypass', 'NH6', 0.20::real, 3.0::real),

    ('b0000006-0000-0000-0000-000000000006'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.900 25.548, 91.920 25.530, 91.945 25.510)', 4326),
     'Shillong – Laitlyngkot', 'NH40', 0.45::real, 8.3::real),

    ('b0000007-0000-0000-0000-000000000007'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.945 25.510, 91.980 25.480, 92.010 25.450)', 4326),
     'Laitlyngkot – Pynursla', 'NH40', 0.55::real, 10.2::real),

    ('b0000008-0000-0000-0000-000000000008'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(92.010 25.450, 92.040 25.430, 92.060 25.410)', 4326),
     'Pynursla – Mawsynram Approach', 'NH40', 0.75::real, 9.1::real),

    ('b0000009-0000-0000-0000-000000000009'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.720 25.300, 91.735 25.290, 91.750 25.280)', 4326),
     'Mawsynram – Cherrapunji Road', 'NH40', 0.85::real, 7.6::real),

    ('b0000010-0000-0000-0000-000000000010'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.750 25.280, 91.765 25.265, 91.780 25.250)', 4326),
     'Cherrapunji – Nongriat Descent', 'NH40', 0.80::real, 5.4::real),

    ('b0000011-0000-0000-0000-000000000011'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.850 25.590, 91.865 25.580, 91.875 25.572)', 4326),
     'Mawlai – Nongthymmai Link', NULL, 0.40::real, 3.8::real),

    ('b0000012-0000-0000-0000-000000000012'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.880 25.560, 91.870 25.575, 91.860 25.585)', 4326),
     'Laban – Mawprem Road', NULL, 0.35::real, 3.2::real),

    ('b0000013-0000-0000-0000-000000000013'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.900 25.548, 91.930 25.550, 91.960 25.555)', 4326),
     'Shillong – Jowai Road Start', 'NH44', 0.40::real, 6.9::real),

    ('b0000014-0000-0000-0000-000000000014'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.840 25.600, 91.830 25.615, 91.820 25.630)', 4326),
     'Smit – Nongkrem Sacred Grove Road', NULL, 0.50::real, 4.5::real),

    ('b0000015-0000-0000-0000-000000000015'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.780 25.250, 91.800 25.230, 91.820 25.210)', 4326),
     'Sohra – Border Approach Road', NULL, 0.70::real, 6.3::real)
) AS v(id, district_id, geometry, name, highway_ref, base_risk, length_km)
WHERE NOT EXISTS (
    SELECT 1 FROM public.road_segments WHERE id = v.id
);

-- -----------------------------------------------
-- 3. Insert Initial Risk Scores
-- -----------------------------------------------
INSERT INTO public.risk_scores (segment_id, score, factors)
SELECT v.segment_id, v.score, v.factors::jsonb
FROM (VALUES
    ('b0000001-0000-0000-0000-000000000001'::uuid, 0.35::real, '{"rainfall_mm": 45, "slope_deg": 8, "report_count": 0, "historical_incidents": 2}'),
    ('b0000002-0000-0000-0000-000000000002'::uuid, 0.25::real, '{"rainfall_mm": 40, "slope_deg": 5, "report_count": 0, "historical_incidents": 1}'),
    ('b0000003-0000-0000-0000-000000000003'::uuid, 0.65::real, '{"rainfall_mm": 55, "slope_deg": 18, "report_count": 1, "historical_incidents": 8}'),
    ('b0000004-0000-0000-0000-000000000004'::uuid, 0.30::real, '{"rainfall_mm": 50, "slope_deg": 6, "report_count": 0, "historical_incidents": 1}'),
    ('b0000005-0000-0000-0000-000000000005'::uuid, 0.20::real, '{"rainfall_mm": 48, "slope_deg": 3, "report_count": 0, "historical_incidents": 0}'),
    ('b0000006-0000-0000-0000-000000000006'::uuid, 0.45::real, '{"rainfall_mm": 60, "slope_deg": 12, "report_count": 0, "historical_incidents": 4}'),
    ('b0000007-0000-0000-0000-000000000007'::uuid, 0.55::real, '{"rainfall_mm": 70, "slope_deg": 15, "report_count": 1, "historical_incidents": 6}'),
    ('b0000008-0000-0000-0000-000000000008'::uuid, 0.75::real, '{"rainfall_mm": 95, "slope_deg": 20, "report_count": 2, "historical_incidents": 12}'),
    ('b0000009-0000-0000-0000-000000000009'::uuid, 0.85::real, '{"rainfall_mm": 110, "slope_deg": 25, "report_count": 3, "historical_incidents": 18}'),
    ('b0000010-0000-0000-0000-000000000010'::uuid, 0.80::real, '{"rainfall_mm": 100, "slope_deg": 22, "report_count": 2, "historical_incidents": 15}'),
    ('b0000011-0000-0000-0000-000000000011'::uuid, 0.40::real, '{"rainfall_mm": 50, "slope_deg": 10, "report_count": 0, "historical_incidents": 3}'),
    ('b0000012-0000-0000-0000-000000000012'::uuid, 0.35::real, '{"rainfall_mm": 48, "slope_deg": 7, "report_count": 0, "historical_incidents": 2}'),
    ('b0000013-0000-0000-0000-000000000013'::uuid, 0.40::real, '{"rainfall_mm": 55, "slope_deg": 8, "report_count": 0, "historical_incidents": 3}'),
    ('b0000014-0000-0000-0000-000000000014'::uuid, 0.50::real, '{"rainfall_mm": 60, "slope_deg": 14, "report_count": 1, "historical_incidents": 5}'),
    ('b0000015-0000-0000-0000-000000000015'::uuid, 0.70::real, '{"rainfall_mm": 85, "slope_deg": 19, "report_count": 1, "historical_incidents": 10}')
) AS v(segment_id, score, factors)
WHERE NOT EXISTS (
    SELECT 1 FROM public.risk_scores WHERE segment_id = v.segment_id
);
