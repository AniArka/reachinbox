import React, { useState, useEffect, useCallback } from 'react';
import { User, Stats, Email, Sender, SlackStatus } from '../types';
import { emailService } from '../services/emailService';
import { Navbar } from '../components/layout/Navbar';
import { StatsCard } from '../components/layout/StatsCard';
import { ScheduledTable } from '../components/dashboard/ScheduledTable';
import { SentTable } from '../components/dashboard/SentTable';
import { SlackPanel } from '../components/dashboard/SlackPanel';
import { ComposeModal } from '../components/compose/ComposeModal';
import { Search, RefreshCw, Clock, Send, MessageSquare } from 'lucide-react';

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'slack'>('scheduled');
  const [stats, setStats] = useState<Stats | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  // Table states
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Search state (Elasticsearch)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Compose Modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Load stats, senders, slack
  const loadInitialData = useCallback(async () => {
    try {
      const [statsData, sendersData, slackData] = await Promise.all([
        emailService.getStats(),
        emailService.getSenders(),
        emailService.getSlackStatus(),
      ]);
      setStats(statsData);
      setSenders(sendersData);
      setSlackStatus(slackData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, []);

  // Load emails based on active tab and search query
  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);

      if (searchQuery.trim().length > 0) {
        setIsSearchActive(true);
        const searchResult = await emailService.searchEmails(
          searchQuery,
          activeTab === 'sent' ? 'sent' : undefined,
          page
        );
        if (activeTab === 'scheduled') {
          setScheduledEmails(searchResult.emails);
        } else {
          setSentEmails(searchResult.emails);
        }
        setPagination(searchResult.pagination);
        return;
      }

      setIsSearchActive(false);
      if (activeTab === 'scheduled') {
        const res = await emailService.getScheduledEmails(page);
        setScheduledEmails(res.emails);
        setPagination(res.pagination);
      } else if (activeTab === 'sent') {
        const res = await emailService.getSentEmails(page);
        setSentEmails(res.emails);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, searchQuery]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Periodic polling for real-time queue updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadInitialData();
      if (!isSearchActive) {
        loadEmails();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loadInitialData, loadEmails, isSearchActive]);

  const handleCancelCampaign = async (campaignId: string) => {
    if (confirm('Cancel this pending campaign? Unsent emails will be marked cancelled.')) {
      await emailService.cancelCampaign(campaignId);
      loadInitialData();
      loadEmails();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar
        user={user}
        onComposeClick={() => setIsComposeOpen(true)}
        onLogout={onLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards */}
        <StatsCard stats={stats} />

        {/* Dashboard Tabs & Search Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('scheduled');
                setPage(1);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              {stats?.scheduled ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">
                  {stats.scheduled}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setActiveTab('sent');
                setPage(1);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sent'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Sent Emails</span>
              {stats?.sent ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">
                  {stats.sent}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setActiveTab('slack');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'slack'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Slack Integration</span>
            </button>
          </div>

          {/* Elasticsearch Search Bar */}
          {activeTab !== 'slack' && (
            <div className="flex items-center space-x-2">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search recipient, subject (Elasticsearch)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white"
                />
              </div>

              <button
                onClick={() => {
                  loadInitialData();
                  loadEmails();
                }}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                title="Refresh Queue State"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Display */}
        {activeTab === 'scheduled' && (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loading}
            onCancelCampaign={handleCancelCampaign}
            pagination={pagination}
            onPageChange={(p) => setPage(p)}
          />
        )}

        {activeTab === 'sent' && (
          <SentTable
            emails={sentEmails}
            loading={loading}
            pagination={pagination}
            onPageChange={(p) => setPage(p)}
          />
        )}

        {activeTab === 'slack' && (
          <SlackPanel
            status={slackStatus}
            loading={loading}
            onRefresh={loadInitialData}
          />
        )}
      </main>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          loadInitialData();
          loadEmails();
        }}
        senders={senders}
      />
    </div>
  );
};
