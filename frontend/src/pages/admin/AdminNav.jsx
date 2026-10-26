import { ClipboardList, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

// Title + switcher shared by the admin pages
export default function AdminNav() {
  const tab = ({ isActive }) => `chip ${isActive ? 'chip-active' : ''}`;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="text-slate-500">Verify matches and keep track of every report.</p>
      </div>
      <div className="flex gap-2">
        <NavLink to="/admin" end className={tab}>
          <ShieldCheck className="h-4 w-4" /> Match review
        </NavLink>
        <NavLink to="/admin/items" className={tab}>
          <ClipboardList className="h-4 w-4" /> All reports
        </NavLink>
      </div>
    </div>
  );
}
