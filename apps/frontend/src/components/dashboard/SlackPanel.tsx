import React, { useState } from 'react';
import { SlackStatus } from '../../types';
import { emailService } from '../../services/emailService';
import { BACKEND_URL } from '../../services/api';
import { MessageSquare, CheckCircle, AlertCircle, Bell, Trash2, ArrowUpRight } from 'lucide-react';

interface SlackPanelProps {
  status: SlackStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SlackPanel: React.FC<SlackPanelProps> = ({ status, loading, onRefresh }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await emailService.testSlackAlert();
      setTestResult(res.message);
    } catch (err: any) {
      setTestResult('Failed to send test alert');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Slack?')) {
      await emailService.disconnectSlack();
      onRefresh();
    }
  };

  const handleConnectSlack = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('reachinbox_token') || '';
    const connectUrl = `${BACKEND_URL}/api/slack/connect?token=${encodeURIComponent(token)}`;
    window.location.href = connectUrl;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isConnected = Boolean(status?.connected);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-3xl">
      <div className="flex items-start justify-between border-b border-gray-100 pb-5 mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Slack Notification Alerts</h3>
            <p className="text-xs text-gray-500">
              Receive live Slack channel alerts when a sender hits their hourly dispatch limit.
            </p>
          </div>
        </div>

        <div>
          {isConnected ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
              <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
              Not Connected
            </span>
          )}
        </div>
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase">Connected Workspace</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {status?.connection?.teamName || 'Active Workspace'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Connected at: {status?.connection?.connectedAt ? new Date(status.connection.connectedAt).toLocaleString() : 'Recently'}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{testing ? 'Sending alert...' : 'Send Test Rate-Limit Alert'}</span>
            </button>

            <button
              onClick={handleDisconnect}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect Slack</span>
            </button>
          </div>

          {testResult && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              {testResult}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Connecting Slack enables automated notifications when sender queues are deferred due to rate limits.
            Alerts include deferred email counts and the exact time the next dispatch window opens.
          </p>

          <a
            href={`${BACKEND_URL}/api/slack/connect`}
            onClick={handleConnectSlack}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <span>Connect Slack Workspace</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
};
