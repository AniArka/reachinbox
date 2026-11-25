import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Stats, Email, Sender, SlackStatus } from '../types';
import { emailService } from '../services/emailService';
import { Sidebar } from '../components/layout/Sidebar';
import { ScheduledTable } from '../components/dashboard/ScheduledTable';
import { SentTable } from '../components/dashboard/SentTable';
import { EmailDetailView } from '../components/dashboard/EmailDetailView';
import { SlackPanel } from '../components/dashboard/SlackPanel';
import { ComposeModal } from '../components/compose/ComposeModal';
import { Search, Filter, RefreshCw, Star } from 'lucide-react';

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

  // Starred emails state (stored in localStorage)
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('reachinbox_starred_emails');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleToggleStar = (emailId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      try {
        localStorage.setItem('reachinbox_starred_emails', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Filter states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSenderId, setFilterSenderId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters =
    filterStarredOnly ||
    filterStatus !== 'all' ||
    filterSenderId !== 'all' ||
    sortOrder !== 'desc';

  const handleResetFilters = () => {
    setFilterStarredOnly(false);
    setFilterStatus('all');
    setFilterSenderId('all');
    setSortOrder('desc');
  };

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
    handleResetFilters();
  };

  // Filter & Sort Logic applied to current table list
  const filterAndSortEmails = useCallback(
    (list: Email[]) => {
      let filtered = [...list];

      // 1. Starred only
      if (filterStarredOnly) {
        filtered = filtered.filter((e) => starredIds.has(e.id));
      }

      // 2. Status filter
      if (filterStatus !== 'all') {
        filtered = filtered.filter((e) => e.status === filterStatus);
      }

      // 3. Sender filter
      if (filterSenderId !== 'all') {
        filtered = filtered.filter(
          (e) => e.senderId === filterSenderId || e.sender?.email === filterSenderId
        );
      }

      // 4. Sort order
      if (sortOrder === 'asc') {
        filtered.sort(
          (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      } else {
        filtered.sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
      }

      return filtered;
    },
    [filterStarredOnly, filterStatus, filterSenderId, sortOrder, starredIds]
  );

  const displayedScheduled = useMemo(
    () => filterAndSortEmails(scheduledEmails),
    [scheduledEmails, filterAndSortEmails]
  );

  const displayedSent = useMemo(
    () => filterAndSortEmails(sentEmails),
    [sentEmails, filterAndSortEmails]
  );

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
            <div className="flex items-center space-x-2 relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-2 rounded-full transition-colors relative ${
                  isFilterOpen || hasActiveFilters
                    ? 'bg-green-50 text-[#00A854]'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Filter and sort emails"
              >
                <Filter className="w-4 h-4" />
                {hasActiveFilters && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00A854] rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {/* Filter Popover Dropdown */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-40 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                    <span className="text-xs font-bold text-gray-900">Filter &amp; Sort</span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[11px] text-[#00A854] hover:underline font-semibold"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* 1. Starred toggle */}
                  <div className="mb-3">
                    <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer select-none hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={filterStarredOnly}
                        onChange={(e) => setFilterStarredOnly(e.target.checked)}
                        className="rounded text-[#00A854] focus:ring-[#00A854] w-3.5 h-3.5 cursor-pointer accent-[#00A854]"
                      />
                      <span className="flex items-center space-x-1.5 font-medium">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>Show starred only</span>
                      </span>
                    </label>
                  </div>

                  {/* 2. Status filter */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 outline-none focus:ring-1 focus:ring-[#00A854]"
                    >
                      <option value="all">All statuses</option>
                      {activeTab === 'scheduled' ? (
                        <>
                          <option value="scheduled">Scheduled</option>
                          <option value="deferred">Deferred</option>
                        </>
                      ) : (
                        <>
                          <option value="sent">Sent (Delivered)</option>
                          <option value="failed">Failed</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* 3. Sender filter */}
                  {senders.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        Sender Account
                      </label>
                      <select
                        value={filterSenderId}
                        onChange={(e) => setFilterSenderId(e.target.value)}
                        className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 outline-none focus:ring-1 focus:ring-[#00A854]"
                      >
                        <option value="all">All Senders</option>
                        {senders.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 4. Sort Order */}
                  <div className="mb-1">
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Order
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSortOrder('desc')}
                        className={`text-xs py-1.5 rounded-lg border text-center transition-colors font-medium ${
                          sortOrder === 'desc'
                            ? 'bg-[#E8F5E9] text-[#00A854] border-[#00A854]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Newest first
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('asc')}
                        className={`text-xs py-1.5 rounded-lg border text-center transition-colors font-medium ${
                          sortOrder === 'asc'
                            ? 'bg-[#E8F5E9] text-[#00A854] border-[#00A854]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Oldest first
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
              isStarred={starredIds.has(selectedEmail.id)}
              onToggleStar={handleToggleStar}
            />
          ) : activeTab === 'scheduled' ? (
            <ScheduledTable
              emails={displayedScheduled}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onCancelCampaign={handleCancelCampaign}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
              starredIds={starredIds}
              onToggleStar={handleToggleStar}
            />
          ) : activeTab === 'sent' ? (
            <SentTable
              emails={displayedSent}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
              starredIds={starredIds}
              onToggleStar={handleToggleStar}
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
