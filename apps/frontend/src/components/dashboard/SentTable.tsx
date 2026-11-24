import React from 'react';
import { Email } from '../../types';
import { CheckCircle2, AlertOctagon, ExternalLink, Mail } from 'lucide-react';

interface SentTableProps {
  emails: Email[];
  loading: boolean;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange: (newPage: number) => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  pagination,
  onPageChange,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <p className="mt-3 text-sm text-gray-500">Loading sent email history...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-gray-900">No sent emails recorded yet</h4>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          Delivered emails will appear here along with live Ethereal SMTP delivery previews.
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
                Sent At
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Message ID
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Preview
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
                  {email.error && (
                    <div className="text-xs text-red-600 mt-0.5 truncate max-w-xs">Error: {email.error}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {email.status === 'sent' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                      Delivered
                    </span>
                  ) : email.status === 'cancelled' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      Cancelled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                      <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-600" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-xs">
                  {email.sentAt ? (
                    <>
                      <div>{new Date(email.sentAt).toLocaleDateString()}</div>
                      <div className="text-gray-400 font-mono">{new Date(email.sentAt).toLocaleTimeString()}</div>
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                  {email.providerMessageId ? (
                    <span className="truncate block max-w-[140px]" title={email.providerMessageId}>
                      {email.providerMessageId}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                  {email.status === 'sent' && (
                    <a
                      href={`https://ethereal.email/messages`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1 rounded transition-colors font-medium border border-blue-200"
                    >
                      <span>Ethereal Inbox</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
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
