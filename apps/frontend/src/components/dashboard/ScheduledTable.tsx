import React from 'react';
import { Email } from '../../types';
import { Clock, Star, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cleanEmailSnippet } from '../../utils/attachmentUtils';

interface ScheduledTableProps {
  emails: Email[];
  loading: boolean;
  onSelectEmail?: (email: Email) => void;
  onCancelCampaign?: (campaignId: string) => void;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange: (newPage: number) => void;
  starredIds?: Set<string>;
  onToggleStar?: (emailId: string) => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onSelectEmail,
  onCancelCampaign,
  pagination,
  onPageChange,
  starredIds,
  onToggleStar,
}) => {
  const formatTimeBadge = (dateString: string) => {
    const d = new Date(dateString);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${time}`;
  };

  if (loading) {
    return (
      <div className="p-16 text-center bg-white flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#00A854] border-t-transparent animate-spin mb-3"></div>
        <p className="text-xs text-gray-500 font-medium">Loading scheduled queue...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-16 text-center bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-gray-900">No scheduled emails in queue</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          All campaigns have been processed or no emails are currently waiting for dispatch.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white flex flex-col h-full">
      {/* Gmail-style Email Rows (Figma node 64-2) */}
      <div className="divide-y divide-gray-100 flex-1">
        {emails.map((email) => {
          const cleanSnippet = cleanEmailSnippet(email.body);

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail?.(email)}
              className="flex items-center px-6 py-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors group text-sm select-none"
            >
              {/* Recipient */}
              <div className="w-48 sm:w-56 shrink-0 font-medium text-gray-900 truncate pr-3">
                <span>To: {email.recipient}</span>
              </div>

              {/* Scheduled Badge (Figma: soft orange pill with clock icon) */}
              <div className="shrink-0 mr-4">
                {email.status === 'deferred' ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Deferred</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                    <Clock className="w-3 h-3 text-[#E65100] shrink-0" />
                    <span>{formatTimeBadge(email.scheduledAt)}</span>
                  </span>
                )}
              </div>

              {/* Subject & Body Snippet Inline */}
              <div className="flex-1 min-w-0 flex items-center truncate mr-4">
                <span className="font-semibold text-gray-900 truncate shrink-0 max-w-xs">
                  {email.subject}
                </span>
                <span className="text-gray-500 truncate ml-2 text-xs">
                  - {cleanSnippet || 'No additional text'}
                </span>
              </div>

              {/* Action / Star */}
              <div className="flex items-center space-x-2 shrink-0">
                {onCancelCampaign && email.status === 'scheduled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelCampaign(email.campaignId);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                    title="Cancel Campaign"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar?.(email.id);
                  }}
                  className="p-1 transition-colors"
                  title={starredIds?.has(email.id) ? 'Unstar' : 'Star'}
                >
                  <Star
                    className={`w-4 h-4 transition-colors ${
                      starredIds?.has(email.id)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300 hover:text-amber-400'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-white text-xs text-gray-500">
          <span>
            Total: <strong className="font-semibold text-gray-800">{pagination.total}</strong> emails
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
