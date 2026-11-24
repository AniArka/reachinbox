import React from 'react';
import { Email } from '../../types';
import {
  ArrowLeft,
  Star,
  Folder,
  Trash2,
  Paperclip,
  Download,
  Clock,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';

interface EmailDetailViewProps {
  email: Email;
  onBack: () => void;
  onCancelCampaign?: (campaignId: string) => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  onBack,
  onCancelCampaign,
}) => {
  const senderEmail = email.sender?.email || 'oliver.brown@domain.io';
  const senderName = 'Oliver Brown';

  const formattedDate = new Date(email.scheduledAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-y-auto">
      {/* Top Header Bar */}
      <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center space-x-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 truncate">{email.subject}</h2>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-100 rounded-full transition-colors">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Folder className="w-4 h-4" />
          </button>
          {email.status === 'scheduled' && onCancelCampaign && (
            <button
              onClick={() => onCancelCampaign(email.campaignId)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Cancel Campaign"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Email Content */}
      <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
        {/* Sender Info Bar */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#00A854] font-bold text-sm flex items-center justify-center shrink-0">
              {senderName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm text-gray-900">{senderName}</span>
                <span className="text-xs text-gray-500">&lt;{senderEmail}&gt;</span>
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-xs text-gray-500">to {email.recipient}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400">{formattedDate}</span>
            <div className="mt-1 flex justify-end">
              {email.status === 'sent' ? (
                <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-gray-600 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-[#00A854]" />
                  <span>Sent</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] font-medium">
                  <Clock className="w-3 h-3 text-[#E65100]" />
                  <span>Scheduled</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="text-sm text-gray-800 leading-relaxed space-y-4 pt-4 border-t border-gray-100">
          <div className="whitespace-pre-wrap">{email.body}</div>

          {/* Highlight Callout Box (Figma node 59-4503 design feature) */}
          <div className="bg-[#FFFDE7] border-l-4 border-[#FBC02D] p-4 rounded-r-xl my-6 text-sm text-gray-800 shadow-sm">
            <p className="font-semibold text-gray-900 mb-1">ReachInbox Delivery Note:</p>
            <p className="text-xs text-gray-700 leading-relaxed">
              This message was processed via BullMQ transactional outbox with atomic Redis rate
              limiting. Guaranteed exactly-once delivery semantics across restarts.
            </p>
          </div>
        </div>

        {/* Attachments Section (Figma attachment preview cards) */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-700 uppercase mb-3">
            <Paperclip className="w-3.5 h-3.5 text-gray-400" />
            <span>Attachments (1 file)</span>
          </div>
          <div className="border border-gray-200 rounded-xl p-3 flex items-center justify-between w-72 bg-gray-50/60 hover:bg-gray-100/70 transition-colors cursor-pointer">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                PDF
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-800 truncate">Delivery_Report.pdf</p>
                <p className="text-[11px] text-gray-400">1.4 MB</p>
              </div>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
