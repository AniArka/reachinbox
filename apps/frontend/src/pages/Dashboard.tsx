import React, { useState, useEffect, useCallback } from 'react';
import { User, Stats, Email, Sender, SlackStatus } from '../types';
import { emailService } from '../services/emailService';
import { Sidebar } from '../components/layout/Sidebar';
import { ScheduledTable } from '../components/dashboard/ScheduledTable';
import { SentTable } from '../components/dashboard/SentTable';
import { EmailDetailView } from '../components/dashboard/EmailDetailView';
import { SlackPanel } from '../components/dashboard/SlackPanel';
import { ComposeModal } from '../components/compose/ComposeModal';
import { Search, Filter, RefreshCw } from 'lucide-react';

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

  // Selected email for detail view (Figma node 59-4503)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Search state (Elasticsearch)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Compose Modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Load stats, senders, slack status
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack')) {
      setActiveTab('slack');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
      if (selectedEmail && selectedEmail.campaignId === campaignId) {
        setSelectedEmail(null);
      }
      loadInitialData();
      loadEmails();
    }
  };

  const handleTabChange = (tab: 'scheduled' | 'sent' | 'slack') => {
    setActiveTab(tab);
    setSelectedEmail(null);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-white flex w-full overflow-hidden">
      {/* Left Sidebar (Figma node 64-2 & 79-2) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onComposeClick={() => setIsComposeOpen(true)}
        onLogout={onLogout}
        stats={stats}
      />

      {/* Main Content Area (Right) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {/* Top Bar with Search & Icons (Figma) */}
        {!selectedEmail && activeTab !== 'slack' && (
          <header className="h-16 px-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
            {/* Pill Search Input */}
            <div className="relative w-80 sm:w-96">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#F3F4F6] text-sm text-gray-800 placeholder-gray-400 rounded-full pl-10 pr-4 py-2 border-0 outline-none focus:ring-1 focus:ring-gray-300 transition-all"
              />
            </div>

            {/* Right Action Icons (Filter & Refresh) */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Filter"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  loadInitialData();
                  loadEmails();
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        {/* Content Body: Email Detail View or Table Views or Slack Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedEmail ? (
            <EmailDetailView
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onCancelCampaign={handleCancelCampaign}
            />
          ) : activeTab === 'scheduled' ? (
            <ScheduledTable
              emails={scheduledEmails}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onCancelCampaign={handleCancelCampaign}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
            />
          ) : activeTab === 'sent' ? (
            <SentTable
              emails={sentEmails}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
            />
          ) : (
            <div className="p-8 max-w-4xl mx-auto">
              <SlackPanel
                status={slackStatus}
                loading={loading}
                onRefresh={loadInitialData}
              />
            </div>
          )}
        </div>
      </div>

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
