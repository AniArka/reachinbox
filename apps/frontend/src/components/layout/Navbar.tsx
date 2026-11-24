import React from 'react';
import { User } from '../../types';
import { Mail, ExternalLink, LogOut, PlusCircle, Activity } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onComposeClick: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onComposeClick, onLogout }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  ReachInbox
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Scheduler
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                <span>BullMQ & Redis Engine Active</span>
              </p>
            </div>
          </div>

          {/* Action buttons & Profile */}
          <div className="flex items-center space-x-4">
            {/* Bull Board link */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
              title="Open Live Bull Board Dashboard"
            >
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Bull Board</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>

            {/* Compose Button */}
            <button
              onClick={onComposeClick}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Compose Email</span>
            </button>

            {/* User Profile */}
            {user && (
              <div className="flex items-center space-x-3 pl-2 border-l border-gray-200">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                  alt={user.name}
                  className="w-9 h-9 rounded-full ring-2 ring-gray-100 bg-gray-50 object-cover"
                />
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold text-gray-800 leading-tight">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[150px]">{user.email}</div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
