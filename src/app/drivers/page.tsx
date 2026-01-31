'use client';

import { useState, useEffect, useCallback } from 'react';
import DriverTable from '@/components/DriverTable';
import Filters from '@/components/Filters';
import Pagination from '@/components/Pagination';
import { Driver, Region, SubRegion, Pagination as PaginationType, SortField, SortOrder } from '@/types';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState('');
  const [regionId, setRegionId] = useState('');
  const [subRegionId, setSubRegionId] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-01-26');
  const [dateTo, setDateTo] = useState('');
  const [routeRegionId, setRouteRegionId] = useState('9'); // Default: Toshkent Viloyati

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Fetch regions on mount
  useEffect(() => {
    fetch('/api/regions')
      .then((res) => res.json())
      .then((data) => setRegions(data))
      .catch((err) => console.error('Failed to fetch regions:', err));
  }, []);

  // Fetch sub-regions when region changes
  useEffect(() => {
    if (regionId) {
      fetch(`/api/sub-regions?region_id=${regionId}`)
        .then((res) => res.json())
        .then((data) => setSubRegions(data))
        .catch((err) => console.error('Failed to fetch sub-regions:', err));
    } else {
      setSubRegions([]);
      setSubRegionId('');
    }
  }, [regionId]);

  // Fetch drivers
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (status) params.append('status', status);
    if (regionId) params.append('region_id', regionId);
    if (subRegionId) params.append('sub_region_id', subRegionId);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (routeRegionId) params.append('route_region_id', routeRegionId);

    try {
      const res = await fetch(`/api/drivers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch drivers');

      const data = await res.json();
      setDrivers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder, status, regionId, subRegionId, dateFrom, dateTo, routeRegionId]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleReset = () => {
    setStatus('');
    setRegionId('');
    setSubRegionId('');
    setDateFrom('2026-01-26');
    setDateTo('');
    setRouteRegionId('9');
    setSortBy('created_at');
    setSortOrder('desc');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <p className="text-sm text-gray-600">
          View and filter driver data
        </p>
      </div>

      {/* Filters */}
      <Filters
        status={status}
        regionId={regionId}
        subRegionId={subRegionId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        routeRegionId={routeRegionId}
        regions={regions}
        subRegions={subRegions}
        onStatusChange={(v) => { setStatus(v); setPagination(p => ({ ...p, page: 1 })); }}
        onRegionChange={(v) => { setRegionId(v); setSubRegionId(''); setPagination(p => ({ ...p, page: 1 })); }}
        onSubRegionChange={(v) => { setSubRegionId(v); setPagination(p => ({ ...p, page: 1 })); }}
        onDateFromChange={(v) => { setDateFrom(v); setPagination(p => ({ ...p, page: 1 })); }}
        onDateToChange={(v) => { setDateTo(v); setPagination(p => ({ ...p, page: 1 })); }}
        onRouteRegionChange={(v) => { setRouteRegionId(v); setPagination(p => ({ ...p, page: 1 })); }}
        onReset={handleReset}
      />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <DriverTable
          drivers={drivers}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          loading={loading}
        />
        <Pagination pagination={pagination} onPageChange={handlePageChange} />
      </div>
    </div>
  );
}
