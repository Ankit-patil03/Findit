import { Bell, BellOff, Check, CheckCheck, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, ListSkeleton } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { notificationsChanged } from '../hooks/useUnreadCount';
import { timeAgo } from '../utils';

// All of the user's notifications, newest first (flowchart: "Notify both users").
export default function Notifications() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/api/notifications');
  const [actionError, setActionError] = useState('');

  const unread = data?.filter((n) => !n.is_read).length || 0;

  // Mark one (or all), then reload the list and update the bell
  async function mark(path) {
    setActionError('');
    try {
      await api(path, { method: 'PATCH' });
      reload();
      notificationsChanged();
    } catch (err) {
      setActionError(err.message);
    }
  }

  // Admins get "needs review" alerts -> review page. Users get "match verified" -> their reports.
  const target = user.role === 'admin'
    ? { to: '/admin', label: 'Review match' }
    : { to: '/my-reports', label: 'View my reports' };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-slate-500">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn-secondary" onClick={() => mark('/api/notifications/read-all')}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {loading && <ListSkeleton rows={4} />}
      {(error || actionError) && <p className="error-box">{error || actionError}</p>}
      {data?.length === 0 && (
        <EmptyState icon={BellOff} title="No notifications yet"
          text="You'll be told here when a match for your item is verified." />
      )}

      <ul className="space-y-2">
        {data?.map((n) => (
          <li key={n.id}
            className={`card flex gap-3 p-4 transition ${n.is_read ? '' : 'border-brand-200 bg-brand-50/60'}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-brand-600 text-white'}`}>
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={n.is_read ? 'text-slate-600' : 'font-medium text-slate-900'}>{n.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">{timeAgo(n.created_at)}</span>
                {n.match_id && (
                  <Link to={target.to} className="inline-flex items-center font-semibold text-brand-600 hover:text-brand-700">
                    {target.label} <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
                {!n.is_read && (
                  <button type="button" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                    onClick={() => mark(`/api/notifications/${n.id}/read`)}>
                    <Check className="h-4 w-4" /> Mark as read
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
