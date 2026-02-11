-- ==========================================
-- Toshkent Viloyati Driver Stats Check
-- Route: Viloyat (9) ↔ Shahar (2)
-- Sana: 2026-01-26 dan boshlab
-- ==========================================

-- 1. STATUS BREAKDOWN
SELECT
  c.status,
  COUNT(*) as count
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
WHERE c.role_id = '2'
  AND c.created_at >= '2026-01-26'
  AND (
    (di.departure_region_id = '9' AND di.arrival_region_id = '2')
    OR
    (di.departure_region_id = '2' AND di.arrival_region_id = '9')
  )
GROUP BY c.status
ORDER BY count DESC;


-- 2. BARCHA DRIVERLAR (26.01 dan boshlab, region filtersiz)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.phone_number,
  c.status,
  DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') as sana,
  dep_r.name->>'uz' as departure_region,
  dep_sr.name->>'uz' as departure_tuman,
  arr_r.name->>'uz' as arrival_region,
  arr_sr.name->>'uz' as arrival_tuman
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
LEFT JOIN sub_regions dep_sr ON di.departure_sub_region_id = dep_sr.id
LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
LEFT JOIN sub_regions arr_sr ON di.arrival_sub_region_id = arr_sr.id
WHERE c.role_id = '2'
  AND c.created_at >= '2026-01-26'
ORDER BY c.created_at DESC;


-- 3. TUMAN BO'YICHA BREAKDOWN
SELECT
  COALESCE(sr.name->>'uz', 'Nomalum') as tuman,
  COUNT(*) FILTER (WHERE c.status = 'pending') as pending,
  COUNT(*) FILTER (WHERE c.status = 'active') as active,
  COUNT(*) FILTER (WHERE c.status = 'inactive') as inactive,
  COUNT(*) FILTER (WHERE c.status = 'blocked') as blocked,
  COUNT(*) as total
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
LEFT JOIN sub_regions sr ON di.departure_sub_region_id = sr.id
WHERE c.role_id = '2'
  AND c.created_at >= '2026-01-26'
  AND (
    (di.departure_region_id = '9' AND di.arrival_region_id = '2')
    OR
    (di.departure_region_id = '2' AND di.arrival_region_id = '9')
  )
GROUP BY sr.name
ORDER BY total DESC;


-- 4. KUNLIK BREAKDOWN
SELECT
  DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') as sana,
  COUNT(*) FILTER (WHERE c.status = 'pending') as pending,
  COUNT(*) FILTER (WHERE c.status = 'active') as active,
  COUNT(*) FILTER (WHERE c.status = 'inactive') as inactive,
  COUNT(*) FILTER (WHERE c.status = 'blocked') as blocked,
  COUNT(*) as total
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
WHERE c.role_id = '2'
  AND c.created_at >= '2026-01-26'
  AND (
    (di.departure_region_id = '9' AND di.arrival_region_id = '2')
    OR
    (di.departure_region_id = '2' AND di.arrival_region_id = '9')
  )
GROUP BY DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')
ORDER BY sana;


-- 5. INACTIVE SABABLARI
SELECT
  r.id as reason_id,
  r.title->>'uz' as sabab,
  COUNT(DISTINCT c.id) as soni
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
JOIN reasons r ON cmr.reason_id = r.id
WHERE c.role_id = '2'
  AND c.status = 'inactive'
  AND c.created_at >= '2026-01-26'
  AND r.id IN ('59', '60', '65')
  AND (
    (di.departure_region_id = '9' AND di.arrival_region_id = '2')
    OR
    (di.departure_region_id = '2' AND di.arrival_region_id = '9')
  )
GROUP BY r.id, r.title
ORDER BY soni DESC;


-- 6. REACTIVATED (eski driverlar, hozir active)
SELECT COUNT(*) as reactivated_count
FROM customers c
JOIN driver_infos di ON c.id = di.customer_id
WHERE c.role_id = '2'
  AND c.status = 'active'
  AND c.created_at < '2026-01-26'
  AND (
    (di.departure_region_id = '9' AND di.arrival_region_id = '2')
    OR
    (di.departure_region_id = '2' AND di.arrival_region_id = '9')
    OR
    di.region_id = '9'
  );
