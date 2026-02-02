import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CAMPAIGN_CONFIG, INACTIVE_REASON_CATEGORIES } from '@/config/campaign';

const { TASHKENT_CITY_ID: TASHKENT_REGION_ID } = CAMPAIGN_CONFIG; // For route filter, city is the endpoint

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Filter parameters
    const status = searchParams.get('status');
    const regionId = searchParams.get('region_id');
    const subRegionId = searchParams.get('sub_region_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const routeRegionId = searchParams.get('route_region_id'); // Base route filter

    // Sort parameters
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ["c.role_id = '2'"]; // Only drivers
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (regionId) {
      conditions.push(`di.region_id = $${paramIndex}`);
      params.push(regionId);
      paramIndex++;
    }

    if (subRegionId) {
      conditions.push(`di.sub_region_id = $${paramIndex}`);
      params.push(subRegionId);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(dateTo + ' 23:59:59');
      paramIndex++;
    }

    // Base route filter: Region <-> Tashkent (both directions)
    if (routeRegionId) {
      conditions.push(`(
        (di.departure_region_id = $${paramIndex} AND di.arrival_region_id = '${TASHKENT_REGION_ID}')
        OR
        (di.departure_region_id = '${TASHKENT_REGION_ID}' AND di.arrival_region_id = $${paramIndex})
      )`);
      params.push(routeRegionId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['created_at', 'status', 'first_name', 'last_name', 'region_name', 'sub_region_name'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Main query with inactive reason
    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        c.status,
        c.created_at,
        r.id as region_id,
        r.name->>'uz' as region_name,
        sr.id as sub_region_id,
        sr.name->>'uz' as sub_region_name,
        dep_r.id as departure_region_id,
        dep_r.name->>'uz' as departure_region_name,
        dep_sr.id as departure_sub_region_id,
        dep_sr.name->>'uz' as departure_sub_region_name,
        arr_r.id as arrival_region_id,
        arr_r.name->>'uz' as arrival_region_name,
        arr_sr.id as arrival_sub_region_id,
        arr_sr.name->>'uz' as arrival_sub_region_name,
        (
          SELECT json_agg(json_build_object(
            'reason_id', cmr_r.id,
            'reason_title', cmr_r.title->>'uz'
          ))
          FROM customer_moderation_reasons cmr
          JOIN reasons cmr_r ON cmr.reason_id = cmr_r.id
          WHERE cmr.customer_id = c.id
            AND cmr_r.id IN ('59', '60', '65')
        ) as inactive_reasons
      FROM customers c
      LEFT JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN regions r ON di.region_id = r.id
      LEFT JOIN sub_regions sr ON di.sub_region_id = sr.id
      LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
      LEFT JOIN sub_regions dep_sr ON di.departure_sub_region_id = dep_sr.id
      LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
      LEFT JOIN sub_regions arr_sr ON di.arrival_sub_region_id = arr_sr.id
      ${whereClause}
      ORDER BY ${sortColumn === 'region_name' ? "r.name->>'uz'" : sortColumn === 'sub_region_name' ? "sr.name->>'uz'" : 'c.' + sortColumn} ${sortDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customers c
      LEFT JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN regions r ON di.region_id = r.id
      LEFT JOIN sub_regions sr ON di.sub_region_id = sr.id
      LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
      LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Process data to add isFixable flag for inactive reasons
    const fixableReasonIds = INACTIVE_REASON_CATEGORIES.FIXABLE as readonly string[];
    const processedData = dataResult.rows.map(row => {
      if (row.inactive_reasons && Array.isArray(row.inactive_reasons)) {
        const reasons = row.inactive_reasons.map((r: { reason_id: string; reason_title: string }) => ({
          ...r,
          isFixable: fixableReasonIds.includes(r.reason_id),
        }));
        return { ...row, inactive_reasons: reasons };
      }
      return row;
    });

    return NextResponse.json({
      data: processedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500 }
    );
  }
}
