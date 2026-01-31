'use client';

import { Region, SubRegion } from '@/types';

interface FiltersProps {
  status: string;
  regionId: string;
  subRegionId: string;
  dateFrom: string;
  dateTo: string;
  routeRegionId: string;
  regions: Region[];
  subRegions: SubRegion[];
  onStatusChange: (status: string) => void;
  onRegionChange: (regionId: string) => void;
  onSubRegionChange: (subRegionId: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onRouteRegionChange: (regionId: string) => void;
  onReset: () => void;
}

export default function Filters({
  status,
  regionId,
  subRegionId,
  dateFrom,
  dateTo,
  routeRegionId,
  regions,
  subRegions,
  onStatusChange,
  onRegionChange,
  onSubRegionChange,
  onDateFromChange,
  onDateToChange,
  onRouteRegionChange,
  onReset,
}: FiltersProps) {
  // Filter out Tashkent from route regions (since all routes are to/from Tashkent)
  const routeRegions = regions.filter(r => r.id !== '2');

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h3 className="text-base font-bold text-gray-900 mb-3">Filters</h3>

      {/* First Row - Basic Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Status Filter */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {/* Home Region Filter */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Home Region
          </label>
          <select
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="">All</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        {/* Home Sub Region Filter */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Home District
          </label>
          <select
            value={subRegionId}
            onChange={(e) => onSubRegionChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            disabled={!regionId}
          >
            <option value="">All</option>
            {subRegions.map((subRegion) => (
              <option key={subRegion.id} value={subRegion.id}>
                {subRegion.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Second Row - Date Range & Route */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Created From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Created To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
        </div>

        {/* Base Route Filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Base Route
          </label>
          <div className="flex items-center gap-2">
            <select
              value={routeRegionId}
              onChange={(e) => onRouteRegionChange(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
              <option value="">All Routes</option>
              {routeRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ↔ Toshkent
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset Button */}
        <div>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
