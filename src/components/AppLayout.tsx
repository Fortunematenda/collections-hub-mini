import { useState } from 'react';
import { ActionIcon, Button, Checkbox, Group, Menu, Select, Tooltip } from '@mantine/core';
import {
  Bell,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  Home,
  LogOut,
  Mail,
  Menu as MenuIcon,
  MessageCircle,
  MessagesSquare,
  Settings,
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { NavKey } from '../types';
import { initials } from '../utils';

const navItems: { key: NavKey; label: string; icon: typeof Home; group?: string; path: string; permission?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Home, group: 'Workspace', path: '/' },
  { key: 'companies', label: 'Companies', icon: Building2, path: '/companies' },
  { key: 'accounts', label: 'Outstanding Accounts', icon: Users, path: '/accounts' },
  { key: 'followups', label: 'Follow-ups', icon: MessageCircle, path: '/followups' },
  { key: 'promises', label: 'Promises to Pay', icon: CalendarClock, path: '/promises' },
  { key: 'recovery', label: 'Equipment Recovery', icon: Truck, group: 'Operations', path: '/recovery' },
  { key: 'imports', label: 'Excel Imports', icon: FileSpreadsheet, path: '/imports' },
  { key: 'templates', label: 'Message Templates', icon: Mail, path: '/templates' },
  { key: 'communications', label: 'Communication Centre', icon: MessagesSquare, path: '/communications' },
  { key: 'users', label: 'Users', icon: Users, group: 'System', path: '/users', permission: 'users.manage' },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield, path: '/roles', permission: 'roles.manage' },
  { key: 'settings', label: 'Company Settings', icon: Settings, path: '/settings' },
];

function titleFromPath(pathname: string) {
  if (pathname.startsWith('/companies/') && pathname !== '/companies') return 'Company details';
  if (pathname.startsWith('/customers/')) return 'Customer details';
  return navItems.find((i) => i.path === pathname)?.label || 'Dashboard';
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const {
    company,
    companyId,
    activeCompanies,
    companies,
    switchCompany,
    showArchivedCompanies,
    setShowArchivedCompanies,
  } = useApp();

  const companyOptions = activeCompanies.map((c) => ({ value: c.id, label: c.name }));
  const title = titleFromPath(location.pathname);
  const visibleNav = navItems.filter((item) => !item.permission || hasPermission(item.permission));
  const selectCompanyId = companyId || null;

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">CH</div>
          <div>
            <div className="brand-title">Collections Hub</div>
            <div className="brand-sub">Multi-company recovery desk</div>
          </div>
        </div>
        <div className="company-switcher">
          <div className="switcher-label">Active company</div>
          <Select
            data={companyOptions}
            value={selectCompanyId}
            onChange={switchCompany}
            size="xs"
            leftSection={<Building2 size={13} />}
            searchable
            placeholder={companyOptions.length ? 'Select company' : 'Add a company first'}
          />
          <Checkbox
            mt={8}
            size="xs"
            label="Show archived"
            checked={showArchivedCompanies}
            onChange={(e) => setShowArchivedCompanies(e.currentTarget.checked)}
            styles={{ label: { color: '#9caac0', fontSize: 10 } }}
          />
        </div>
        <nav className="nav">
          {visibleNav.map((item, i) => (
            <div key={item.key}>
              {(i === 0 || item.group) && <div className="nav-label">{item.group}</div>}
              <NavLink
                to={item.path}
                className={({ isActive }) => `nav-button ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
                end={item.path === '/'}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile">
            <div className="avatar">{initials(user?.name || 'Admin')}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="profile-name">{user?.name || 'Admin'}</div>
              <div className="profile-role">
                {user?.roleName || user?.role || 'admin'} · {companies.filter((c) => c.status !== 'Archived').length} portfolios
              </div>
            </div>
          </div>
          <Button
            mt="sm"
            fullWidth
            size="xs"
            variant="light"
            color="gray"
            leftSection={<LogOut size={13} />}
            loading={loggingOut}
            onClick={handleLogout}
          >
            Log out
          </Button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <Group gap="sm" wrap="nowrap">
            <ActionIcon className="mobile-menu" variant="subtle" color="gray" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon size={18} />
            </ActionIcon>
            <div>
              <div className="page-title">{title}</div>
              <div className="mobile-company-name">{company.id ? company.name : 'No company selected'}</div>
            </div>
          </Group>
          <div className="top-actions">
            <Select
              className="desktop-company-select"
              data={companyOptions}
              value={selectCompanyId}
              onChange={switchCompany}
              size="sm"
              leftSection={<Building2 size={14} />}
              placeholder={companyOptions.length ? 'Select company' : 'Add a company first'}
            />
            <Tooltip label="Notifications">
              <ActionIcon variant="default" size="lg" radius="md" aria-label="Notifications">
                <Bell size={16} />
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" radius="md" aria-label="Account menu">
                  <LogOut size={15} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.email}</Menu.Label>
                <Menu.Item color="red" leftSection={<LogOut size={14} />} onClick={handleLogout}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
