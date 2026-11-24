import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Sender } from '../../types';
import { emailService } from '../../services/emailService';
import { X, Upload, Users, Clock, Send, ShieldAlert, Sparkles } from 'lucide-react';

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
  const [recipientsText, setRecipientsText] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
    // Set default start time to now formatted for datetime-local input
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartAt(localIso);
  }, [senders]);

  // Parse typed/pasted recipients
  useEffect(() => {
    const lines = recipientsText
      .split(/[\n,;]+/)
      .map((r) => r.trim().toLowerCase())
      .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
    setRecipients(Array.from(new Set(lines)));
  }, [recipientsText]);

  // Handle CSV Upload via PapaParse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const foundEmails: string[] = [];
        results.data.forEach((row: any) => {
          // Look for any key containing "email" or first column
          for (const key of Object.keys(row)) {
            const val = String(row[key]).trim().toLowerCase();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              foundEmails.push(val);
              break;
            }
          }
        });

        if (foundEmails.length > 0) {
          const combined = Array.from(new Set([...recipients, ...foundEmails]));
          setRecipients(combined);
          setRecipientsText(combined.join('\n'));
        } else {
          alert('No valid email addresses detected in CSV.');
        }
      },
      error: (err) => {
        alert(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!senderId) {
      setError('Please select a sender account.');
      return;
    }
    if (recipients.length === 0) {
      setError('Please provide at least one valid recipient email.');
      return;
    }

    try {
      setLoading(true);
      await emailService.createCampaign({
        subject,
        body,
        senderId,
        recipients,
        startAt: new Date(startAt).toISOString(),
        delaySeconds,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Schedule Email Campaign</h3>
              <p className="text-xs text-gray-500">Atomic persistence with distributed rate limiting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Select */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Sender Account
            </label>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              required
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email} (Limit: {s.hourlyLimit}/hr, Pacing: {s.minDelayMs}ms)
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exploring Collaboration Opportunities"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Email Body
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email template here..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            ></textarea>
          </div>

          {/* Recipients & CSV Upload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 uppercase">
                Recipients (Emails)
              </label>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <Users className="w-3 h-3" />
                  <span>{recipients.length} valid recipient{recipients.length === 1 ? '' : 's'}</span>
                </span>
                <label className="cursor-pointer inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                  <Upload className="w-3 h-3" />
                  <span>Upload CSV</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
            <textarea
              rows={3}
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder="Paste email addresses separated by commas or line breaks, or upload a CSV..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
            ></textarea>
          </div>

          {/* Scheduling & Interval Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            {/* Start At */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
            </div>

            {/* Delay Interval */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center space-x-1">
                <span>Delay Between (sec)</span>
              </label>
              <input
                type="number"
                min="0"
                max="3600"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center space-x-1">
                <span>Hourly Limit</span>
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 100)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || recipients.length === 0}
              className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Scheduling...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
