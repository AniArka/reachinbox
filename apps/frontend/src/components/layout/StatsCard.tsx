import React from 'react';
import { Stats } from '../../types';
import { Clock, Send, AlertTriangle, Layers } from 'lucide-react';

interface StatsCardProps {
  stats: Stats | null;
  loading?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats, loading }) => {
  const cards = [
    {
      title: 'Scheduled Emails',
      value: stats?.scheduled ?? 0,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      description: 'Waiting in BullMQ queue',
    },
    {
      title: 'Sent Emails',
      value: stats?.sent ?? 0,
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
      description: 'Delivered via Ethereal SMTP',
    },
    {
      title: 'Deferred (Rate Limit)',
      value: stats?.deferred ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      description: 'Rescheduled to next window',
    },
    {
      title: 'Active Campaigns',
      value: stats?.campaigns ?? 0,
      icon: Layers,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100',
      description: 'PostgreSQL durable records',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`bg-white rounded-xl p-5 border ${card.borderColor} shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? (
                    <span className="inline-block w-12 h-6 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    card.value
                  )}
                </h3>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bgColor} ${card.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
};
