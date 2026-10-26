import { Calendar, Check, CircleCheck, ImageOff, Lock, Mail, MapPin, ShieldCheck, Tag, User, X } from 'lucide-react';
import { useState } from 'react';
import { api, imageUrl } from '../../api';
import { EmptyState, ListSkeleton } from '../../components/Feedback';
import StatusBadge from '../../components/StatusBadge';
import { useApi } from '../../hooks/useApi';
import { formatDate, timeAgo } from '../../utils';
import AdminNav from './AdminNav';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

// Admin match review (flowchart: "Admin verifies match - reviews flagged report").
// Each match shows the lost report next to the found report so the admin can compare them,
// including the private proof-of-ownership details only admins can see.
export default function AdminMatches() {
  const [tab, setTab] = useState('pending');
  const { data, loading, error, reload } = useApi(`/api/admin/matches?status=${tab}`);
  const [message, setMessage] = useState(''); // green "done" message after an action

  function handleDone(text) {
    setMessage(text);
    reload();
  }

  return (
    <div className="space-y-5">
      <AdminNav />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button key={t.value} type="button" className={`chip shrink-0 ${tab === t.value ? 'chip-active' : ''}`}
            onClick={() => { setTab(t.value); setMessage(''); }}>
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <CircleCheck className="h-4 w-4" /> {message}
        </p>
      )}
      {loading && <ListSkeleton rows={2} />}
      {error && <p className="error-box">{error}</p>}
      {data?.length === 0 && (
        <EmptyState icon={ShieldCheck} title={tab === 'pending' ? 'Nothing to review' : 'No matches here'}
          text={tab === 'pending' ? 'New possible matches will appear here (and in your notifications).' : undefined} />
      )}

      <div className="space-y-5">
        {data?.map((match) => (
          <MatchCard key={match.id} match={match} onDone={handleDone} />
        ))}
      </div>
    </div>
  );
}

// ---------- One match: header, the two reports side by side, and the actions ----------
function MatchCard({ match, onDone }) {
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | 'resolve' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lost = match.lost_item;
  const found = match.found_item;
  const dayGap = Math.abs((new Date(lost.date) - new Date(found.date)) / 86400000);
  const handedOver = lost.status === 'resolved' && found.status === 'resolved';

  async function act(action) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/matches/${match.id}/${action}`, { method: 'PATCH' });
      onDone(DONE_MESSAGES[action]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <article className="card overflow-hidden">
      {/* Header: score + status */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4">
        <ScoreBar score={match.match_score} />
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          <span>Match #{match.id} · {timeAgo(match.created_at)}</span>
          <StatusBadge value={match.status} />
        </div>
      </header>

      {/* Quick comparison hints for the admin */}
      <div className="flex flex-wrap gap-2 px-5 pt-4 text-xs">
        <Hint ok={lost.category === found.category} text={lost.category === found.category ? 'Same category' : 'Different category'} />
        <Hint ok={dayGap <= 3} text={dayGap === 0 ? 'Same day' : `Dates ${dayGap} day${dayGap === 1 ? '' : 's'} apart`} />
        <Hint ok={Boolean(lost.proof)} text={lost.proof ? 'Owner gave proof' : 'No proof from owner'} />
      </div>

      {/* The two reports side by side (stacked on phones) */}
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <ReportPanel item={lost} kind="lost" />
        <ReportPanel item={found} kind="found" />
      </div>

      {/* Actions */}
      <footer className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
        {error && <p className="error-box mb-3">{error}</p>}
        <Actions match={match} handedOver={handedOver} confirming={confirming}
          setConfirming={setConfirming} busy={busy} act={act} />
      </footer>
    </article>
  );
}

const DONE_MESSAGES = {
  approve: 'Match approved. Both users have been notified to arrange the handover.',
  reject: 'Match rejected.',
  resolve: 'Marked as resolved. Both reports are now closed.',
};

const CONFIRM_TEXT = {
  approve: 'Approve this match? Both reports become "matched", other pending matches for them are rejected, and both users are notified.',
  reject: 'Reject this match? The two reports stay open for other matches.',
  resolve: 'Has the item been handed back to its owner? Both reports will be closed.',
};

function Actions({ match, handedOver, confirming, setConfirming, busy, act }) {
  // Step 2 of a button press: "are you sure?" (the browser's confirm() popup isn't used, so it looks the same everywhere)
  if (confirming) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-slate-700">{CONFIRM_TEXT[confirming]}</p>
        <div className="flex gap-2">
          <button type="button" className={confirming === 'reject' ? 'btn-secondary text-red-700' : 'btn-primary'}
            disabled={busy} onClick={() => act(confirming)}>
            {busy ? 'Saving...' : 'Yes, ' + confirming}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (match.status === 'pending') {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
          onClick={() => setConfirming('approve')}>
          <Check className="h-4 w-4" /> Approve match
        </button>
        <button type="button" className="btn-secondary text-red-700" onClick={() => setConfirming('reject')}>
          <X className="h-4 w-4" /> Reject
        </button>
      </div>
    );
  }

  if (match.status === 'confirmed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">Approved by {match.verified_by_name || 'an admin'}.</span>
        {handedOver ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
            <CircleCheck className="h-4 w-4" /> Item handed over
          </span>
        ) : (
          <button type="button" className="btn-primary ml-auto" onClick={() => setConfirming('resolve')}>
            <CircleCheck className="h-4 w-4" /> Mark resolved
          </button>
        )}
      </div>
    );
  }

  // rejected: by an admin, or automatically because one of the items was matched elsewhere
  return (
    <p className="text-sm text-slate-600">
      {match.verified_by_name
        ? `Rejected by ${match.verified_by_name}.`
        : 'Closed automatically: one of these items was matched with a different report.'}
    </p>
  );
}

// ---------- Small pieces ----------
function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold text-slate-900">{score}%</span>
      <div>
        <p className="text-xs font-medium text-slate-500">Match score</p>
        <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

function Hint({ ok, text }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {text}
    </span>
  );
}

function ReportPanel({ item, kind }) {
  const isLost = kind === 'lost';
  return (
    <section className={`overflow-hidden rounded-2xl ring-1 ${isLost ? 'ring-rose-200' : 'ring-emerald-200'}`}>
      <p className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${isLost ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {isLost ? 'Lost report (claimed owner)' : 'Found report (finder)'}
      </p>

      <div className="flex aspect-video items-center justify-center bg-slate-100">
        {item.image_url ? (
          <a href={imageUrl(item.image_url)} target="_blank" rel="noreferrer" className="h-full w-full" title="Open full size">
            <img src={imageUrl(item.image_url)} alt={item.name} className="h-full w-full object-contain" />
          </a>
        ) : (
          <span className="flex flex-col items-center gap-1 text-slate-400"><ImageOff className="h-7 w-7" /><span className="text-xs">No photo</span></span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2"><Tag className="h-4 w-4 text-slate-400" /> {item.category}</li>
          <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {item.location}</li>
          <li className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" /> {formatDate(item.date)}</li>
        </ul>
        {item.description && <p className="text-sm text-slate-700">{item.description}</p>}

        {/* Private details - only admins ever see this */}
        <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <Lock className="h-3.5 w-3.5" /> {isLost ? 'Proof of ownership' : 'Private details'}
          </p>
          <p className={`mt-1 ${item.proof ? 'text-slate-800' : 'italic text-slate-500'}`}>
            {item.proof || 'Not provided'}
          </p>
        </div>

        {/* Who reported it - so the admin can contact them for the handover */}
        <div className="flex items-center gap-3 border-t border-slate-100 pt-3 text-sm">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><User className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{item.reporter.name}</p>
            <p className="flex items-center gap-1 truncate text-slate-500">
              <Mail className="h-3.5 w-3.5 shrink-0" /> {item.reporter.email}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
