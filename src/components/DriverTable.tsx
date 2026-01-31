'use client';

import { Driver, SortField, SortOrder } from '@/types';

interface DriverTableProps {
  drivers: Driver[];
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  blocked: 'Blocked',
};

function SortIcon({ field, sortBy, sortOrder }: { field: SortField; sortBy: SortField; sortOrder: SortOrder }) {
  if (sortBy !== field) {
    return <span className="ml-1 text-gray-400">↕</span>;
  }
  return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

export default function DriverTable({ drivers, sortBy, sortOrder, onSort, loading }: DriverTableProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No drivers found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('first_name')}
            >
              Name
              <SortIcon field="first_name" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('status')}
            >
              Status
              <SortIcon field="status" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('region_name')}
            >
              Home Region
              <SortIcon field="region_name" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Route
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('created_at')}
            >
              Created At
              <SortIcon field="created_at" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {drivers.map((driver, index) => (
            <tr key={driver.id} className="hover:bg-gray-50">
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                {index + 1}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {driver.first_name || driver.last_name
                    ? `${driver.first_name} ${driver.last_name}`.trim()
                    : '-'}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                {driver.phone_number}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[driver.status]}`}>
                  {statusLabels[driver.status]}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                <div>{driver.region_name || '-'}</div>
                {driver.sub_region_name && (
                  <div className="text-xs text-gray-400">{driver.sub_region_name}</div>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                {driver.departure_region_name && driver.arrival_region_name ? (
                  <div className="flex items-center gap-1">
                    <span className="text-blue-600">{driver.departure_region_name}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600">{driver.arrival_region_name}</span>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(driver.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
