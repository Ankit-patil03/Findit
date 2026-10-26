import { ClipboardList, ImageOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { imageUrl } from '../../api';
import { EmptyState, ListSkeleton } from '../../components/Feedback';
import StatusBadge from '../../components/StatusBadge';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils';
import AdminNav from './AdminNav';

// Every report in the system, with who reported it (Objective 8: complete history for admins).
export default function AdminItems() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  const { data, loading, error } = useApi(`/api/admin/items?${params}`);

  return (
    <div className="space-y-5">
      <AdminNav />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips value={type} onChange={setType}
          options={[['', 'All types'], ['lost', 'Lost'], ['found', 'Found']]} />
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <FilterChips value={status} onChange={setStatus}
          options={[['', 'Any status'], ['pending', 'Pending'], ['matched', 'Matched'], ['resolved', 'Resolved']]} />
      </div>

      {loading && <ListSkeleton rows={4} />}
      {error && <p className="error-box">{error}</p>}
      {data?.length === 0 && <EmptyState icon={ClipboardList} title="No reports match these filters" />}

      {data?.length > 0 && (
        <>
          <p className="text-sm font-medium text-slate-500">{data.length} report{data.length === 1 ? '' : 's'}</p>
          {/* Wide table; scrolls sideways on small screens instead of squashing */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Where / when</th>
                  <th className="px-4 py-3 font-semibold">Reported by</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link to={`/items/${item.id}`} className="flex items-start gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                          {item.image_url
                            ? <img src={imageUrl(item.image_url)} alt="" className="h-full w-full object-cover" />
                            : <ImageOff className="h-5 w-5" />}
                        </span>
                        <span>
                          <span className="block font-semibold text-slate-900 hover:text-brand-700">{item.name}</span>
                          <span className="block text-xs text-slate-500">{item.category}</span>
                          {item.proof_details && (
                            <span className="mt-1 flex items-start gap-1 text-xs text-amber-700" title="Private details (admin only)">
                              <Lock className="mt-0.5 h-3 w-3 shrink-0" /> {item.proof_details}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={item.type} /></td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.location}
                      <span className="block text-xs text-slate-500">{formatDate(item.date_occurred)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.reporter_name}
                      <span className="block text-xs text-slate-500">{item.reporter_email}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChips({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={label} type="button" className={`chip ${value === v ? 'chip-active' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
