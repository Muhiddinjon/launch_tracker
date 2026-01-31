import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id');

    let query = "SELECT id, name->>'uz' as name, region_id FROM sub_regions";
    const params: string[] = [];

    if (regionId) {
      query += ' WHERE region_id = $1';
      params.push(regionId);
    }

    query += " ORDER BY name->>'uz'";

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-regions' },
      { status: 500 }
    );
  }
}
