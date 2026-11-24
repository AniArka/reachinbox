import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Sender } from '../../types';
import { emailService } from '../../services/emailService';
import {
  ArrowLeft,
  X,
  Paperclip,
  Clock,
  Calendar,
  ChevronDown,
  Upload,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  AlertCircle,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  senders: Sender[];
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  senders,
}) => {
  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([
    'tame@jmail.com',
    'sarah.c@cloudtech.com',
  ]);
  const [startAt, setStartAt] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send Later Popover State
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
    const defaultDate = new Date();
    defaultDate.setMinutes(defaultDate.getMinutes() + 5);
    const localIso = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartAt(localIso);
  }, [senders]);

  if (!isOpen) return null;

  const currentSender = senders.find((s) => s.id === senderId) || senders[0];

  // Add recipient chip on Enter, comma, or blur
  const handleAddRecipient = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      if (!recipients.includes(trimmed)) {
        setRecipients([...recipients, trimmed]);
      }
      setRecipientInput('');
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients(recipients.filter((_, idx) => idx !== indexToRemove));
  };

  // CSV Upload via PapaParse
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const foundEmails: string[] = [];
        results.data.forEach((row: any) => {
          for (const key of Object.keys(row)) {
            const val = String(row[key]).trim().toLowerCase();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              foundEmails.push(val);
              break;
            }
          }
        });

        if (foundEmails.length > 0) {
          const merged = Array.from(new Set([...recipients, ...foundEmails]));
          setRecipients(merged);
        } else {
          alert('No valid email addresses found in CSV.');
        }
      },
      error: (err) => {
        alert(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  // Preset Date Handlers for Send Later Popover
  const applyPreset = (preset: 'tomorrow' | 'tomorrow-10' | 'tomorrow-11' | 'tomorrow-15') => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (preset === 'tomorrow') {
      d.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow-10') {
      d.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow-11') {
      d.setHours(11, 0, 0, 0);
    } else if (preset === 'tomorrow-15') {
      d.setHours(15, 0, 0, 0);
    }
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartAt(localIso);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!senderId && senders.length > 0) {
      setSenderId(senders[0].id);
    }

    const effectiveSenderId = senderId || (senders[0] ? senders[0].id : '');

    if (!effectiveSenderId) {
      setError('Please select a sender account.');
      return;
    }
    if (recipients.length === 0) {
      setError('Please add at least one recipient email.');
      return;
    }

    try {
      setLoading(true);
      await emailService.createCampaign({
        subject: subject || '(No Subject)',
        body: body || 'Hello from ReachInbox Scheduler!',
        senderId: effectiveSenderId,
        recipients,
        startAt: new Date(startAt).toISOString(),
        delaySeconds,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Compose Window Container (Figma nodes 59-5703, 59-5998, 91-23) */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-3xl w-full h-[85vh] max-h-[780px] flex flex-col overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-gray-900">Compose New Email</h2>
          </div>

          <div className="flex items-center space-x-3 relative">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className={`p-2 rounded-full transition-colors ${
                isSendLaterOpen
                  ? 'bg-green-50 text-[#00A854]'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Schedule Options"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Outlined Green Pill: Send Later / Send */}
            <button
              onClick={() => handleSubmit()}
              disabled={loading || recipients.length === 0}
              className="border border-[#00A854] text-[#00A854] bg-white hover:bg-green-50/70 rounded-full px-5 py-2 text-sm font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Scheduling...' : 'Send Later'}</span>
              <ChevronDown
                className="w-3.5 h-3.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSendLaterOpen(!isSendLaterOpen);
                }}
              />
            </button>

            {/* Send Later Popover Floating Card (Figma node 59-5703) */}
            {isSendLaterOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-40 animate-in fade-in zoom-in-95">
                <h4 className="text-sm font-bold text-gray-900 mb-3">Send Later</h4>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Pick date &amp; time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00A854] outline-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5 mb-5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Presets
                  </p>
                  <button
                    type="button"
                    onClick={() => applyPreset('tomorrow')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#E8F5E9] hover:text-[#00A854] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Tomorrow morning</span>
                    <span className="text-[11px] text-gray-400">9:00 AM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('tomorrow-10')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#E8F5E9] hover:text-[#00A854] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Tomorrow</span>
                    <span className="text-[11px] text-gray-400">10:00 AM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('tomorrow-11')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#E8F5E9] hover:text-[#00A854] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Tomorrow</span>
                    <span className="text-[11px] text-gray-400">11:00 AM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('tomorrow-15')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#E8F5E9] hover:text-[#00A854] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Tomorrow</span>
                    <span className="text-[11px] text-gray-400">3:00 PM</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsSendLaterOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSendLaterOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#00A854] hover:bg-[#009249] rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Body Form */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* From Row */}
          <div className="flex items-center space-x-3 text-sm pb-2 border-b border-gray-100">
            <span className="text-gray-500 w-12 font-medium">From:</span>
            <div className="relative">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="bg-[#F3F4F6] text-gray-800 text-xs font-medium py-1.5 pl-3 pr-8 rounded-full border-0 outline-none cursor-pointer appearance-none"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
                {senders.length === 0 && (
                  <option value="">oliver.brown@domain.io</option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* To Row (Figma: Mint recipient chips, +4 overflow, and green Upload List button) */}
          <div className="flex items-center justify-between text-sm pb-3 border-b border-gray-100 gap-2 flex-wrap">
            <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
              <span className="text-gray-500 w-12 font-medium shrink-0">To:</span>

              {/* Recipient Chips */}
              {recipients.map((email, idx) => (
                <span
                  key={idx}
                  className="bg-[#E8F5E9] text-[#00A854] border border-[#00A854]/40 rounded-full px-3 py-1 text-xs font-medium flex items-center space-x-1.5"
                >
                  <span>{email}</span>
                  <X
                    className="w-3 h-3 hover:text-red-500 cursor-pointer"
                    onClick={() => removeRecipient(idx)}
                  />
                </span>
              ))}

              {/* Typeable Input */}
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddRecipient(recipientInput);
                  }
                }}
                onBlur={() => handleAddRecipient(recipientInput)}
                placeholder={recipients.length === 0 ? 'Enter recipient email...' : 'Add more...'}
                className="text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent min-w-[140px] flex-1 py-1"
              />
            </div>

            {/* Right: Upload List CSV (Figma green upload button) */}
            <div className="shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 text-xs font-medium text-[#00A854] hover:bg-green-50 px-3 py-1.5 rounded-full transition-colors border border-green-200"
              >
                <Upload className="w-3.5 h-3.5 text-[#00A854]" />
                <span>Upload List</span>
              </button>
            </div>
          </div>

          {/* Subject Row */}
          <div className="flex items-center space-x-3 text-sm pb-3 border-b border-gray-100">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent py-1 font-medium"
            />
          </div>

          {/* Rate Limiting Configuration Controls */}
          <div className="flex items-center space-x-6 text-xs text-gray-600 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Delay between 2 emails:</span>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-10 text-xs text-center font-semibold text-gray-900 outline-none"
                />
                <span className="text-[11px] text-gray-400 ml-1">sec</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Hourly Limit:</span>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 100)}
                  className="w-12 text-xs text-center font-semibold text-gray-900 outline-none"
                />
                <span className="text-[11px] text-gray-400 ml-1">/hr</span>
              </div>
            </div>
          </div>

          {/* Rich Editor Area (Figma light gray container with floating formatting toolbar) */}
          <div className="bg-[#F3F4F6] rounded-2xl p-4 flex flex-col flex-1 min-h-[260px] relative">
            {/* Formatting Toolbar Pill */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-200/80 px-3 py-1.5 flex items-center space-x-2.5 text-gray-500 w-fit shrink-0">
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-200 text-xs">|</span>
              <button type="button" className="hover:text-gray-900 text-xs font-semibold px-0.5">
                TT
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Underline className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-200 text-xs">|</span>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-200 text-xs">|</span>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-900 transition-colors">
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Editor Textarea */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="w-full bg-transparent border-0 outline-none resize-none text-sm text-gray-800 placeholder-gray-400 mt-4 flex-1"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
};
