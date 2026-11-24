import React from 'react';
import { Email } from '../../types';
import { Clock, AlertCircle, XCircle } from 'lucide-react';

interface ScheduledTableProps {
  emails: Email[];
  loading: boolean;
  onCancelCampaign?: (campaignId: string) => void;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange: (newPage: number) => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancelCampaign,
  pagination,
  onPageChange,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deferred':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
            Deferred (Rate Limit)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-spin"></span>
            Sending...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3 h-3 mr-1 text-indigo-500" />
            Scheduled
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-3 text-sm text-gray-500">Loading scheduled emails from PostgreSQL...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-gray-900">No scheduled emails in queue</h4>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          All campaigns have been processed or no emails are currently waiting for dispatch.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recipient
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Scheduled For
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sender
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white text-sm">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{email.recipient}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-gray-900 truncate max-w-xs font-medium">{email.subject}</div>
                  <div className="text-xs text-gray-500 truncate max-w-xs">{email.body}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(email.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-xs">
                  <div>{new Date(email.scheduledAt).toLocaleDateString()}</div>
                  <div className="text-gray-400 font-mono">{new Date(email.scheduledAt).toLocaleTimeString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                  {email.sender?.email || 'Default Sender'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                  {onCancelCampaign && email.campaignId && (
                    <button
                      onClick={() => onCancelCampaign(email.campaignId)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center space-x-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      title="Cancel Campaign"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            Showing <span className="font-medium">{(pagination.page - 1) * 15 + 1}</span> to{' '}
            <span className="font-medium">{Math.min(pagination.page * 15, pagination.total)}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> emails
          </div>
          <div className="flex space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
