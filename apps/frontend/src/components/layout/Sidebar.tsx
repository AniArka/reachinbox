import React, { useState } from 'react';
import { User, Stats } from '../../types';
import { Clock, Send, Edit3, MessageSquare, ChevronDown, LogOut, ExternalLink } from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: 'scheduled' | 'sent' | 'slack';
  onTabChange: (tab: 'scheduled' | 'sent' | 'slack') => void;
  onComposeClick: () => void;
  onLogout: () => void;
  stats: Stats | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onComposeClick,
  onLogout,
  stats,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const displayName = user?.name || 'Oliver Brown';
  const displayEmail = user?.email || 'oliver.brown@domain.io';

  return (
    <aside className="w-64 border-r border-gray-100 bg-white h-screen flex flex-col p-5 shrink-0 select-none">
      {/* Brand Wordmark (Figma: ONB) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="text-2xl font-black tracking-tight text-gray-900 font-sans">
            ONB
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00A854]"></span>
        </div>
      </div>

      {/* User Card (Figma: rounded light gray card with avatar, name, email & chevron) */}
      <div className="relative mb-4">
        <div
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="bg-[#F3F4F6] hover:bg-[#eaecee] transition-colors rounded-xl p-2.5 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#E8F5E9] text-[#00A854] font-bold text-xs flex items-center justify-center shrink-0">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-500 truncate">{displayEmail}</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-1" />
        </div>

        {/* User Dropdown Menu */}
        {showUserDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-1.5 z-30">
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-between"
            >
              <span>Bull Board Queues</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
            <button
              onClick={() => {
                setShowUserDropdown(false);
                onLogout();
              }}
              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Compose Button (Figma: Green outlined pill button) */}
      <button
        onClick={onComposeClick}
        className="w-full border border-[#00A854] text-[#00A854] bg-white hover:bg-green-50/70 rounded-full py-2.5 px-4 font-medium text-sm transition-all flex items-center justify-center space-x-2 shadow-none"
      >
        <Edit3 className="w-4 h-4" />
        <span>Compose</span>
      </button>

      {/* Navigation Sections */}
      <div className="mt-6 flex-1">
        <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase px-2 mb-2">
          CORE
        </p>

        <nav className="space-y-1">
          {/* Scheduled Nav Item */}
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-[#E8F5E9] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Clock
                className={`w-4 h-4 ${
                  activeTab === 'scheduled' ? 'text-[#00A854]' : 'text-gray-400'
                }`}
              />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'scheduled' ? 'text-gray-900 font-semibold' : 'text-gray-400'
              }`}
            >
              {stats?.scheduled ?? 0}
            </span>
          </button>

          {/* Sent Nav Item */}
          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'sent'
                ? 'bg-[#E8F5E9] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send
                className={`w-4 h-4 ${
                  activeTab === 'sent' ? 'text-[#00A854]' : 'text-gray-400'
                }`}
              />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs ${
                activeTab === 'sent' ? 'text-gray-900 font-semibold' : 'text-gray-400'
              }`}
            >
              {stats?.sent ?? 0}
            </span>
          </button>

          {/* Slack Integration Item */}
          <button
            onClick={() => onTabChange('slack')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'slack'
                ? 'bg-[#E8F5E9] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <MessageSquare
                className={`w-4 h-4 ${
                  activeTab === 'slack' ? 'text-[#00A854]' : 'text-gray-400'
                }`}
              />
              <span>Slack</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Footer / Queue Status */}
      <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
        <span>ReachInbox Engine</span>
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>Live</span>
        </span>
      </div>
    </aside>
  );
};
