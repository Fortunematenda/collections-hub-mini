import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, Group, Menu, ScrollArea, Select, Text } from '@mantine/core';
import {
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
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
  Cable,
  Workflow,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getStoredToken, logoutRequest } from '../api/auth';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { NavKey } from '../types';
import { initials, isUnreadCommunication, safeDate, splitEmailThread, todayIso } from '../utils';

const navItems: { key: NavKey; label: string; icon: typeof Home; group?: string; path: string; permission?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Home, group: 'Workspace', path: '/' },
  { key: 'companies', label: 'Companies', icon: Building2, path: '/companies' },
  { key: 'accounts', label: 'Outstanding Accounts', icon: Users, path: '/accounts' },
  { key: 'followups', label: 'Follow-ups', icon: MessageCircle, path: '/followups' },
  { key: 'mywork', label: 'My Work', icon: ClipboardList, path: '/my-work' },
  { key: 'promises', label: 'Promises to Pay', icon: CalendarClock, path: '/promises' },
  { key: 'recovery', label: 'Equipment Recovery', icon: Truck, group: 'Operations', path: '/recovery', permission: 'recovery.manage' },
  { key: 'imports', label: 'Excel Imports', icon: FileSpreadsheet, path: '/imports', permission: 'imports.manage' },
  { key: 'templates', label: 'Message Templates', icon: Mail, path: '/templates', permission: 'templates.manage' },
  { key: 'communications', label: 'Communication Centre', icon: MessagesSquare, path: '/communications' },
  { key: 'automations', label: 'Automations', icon: Workflow, group: 'Automation', path: '/automations', permission: 'collections.manage' },
  { key: 'integrations', label: 'Integrations', icon: Cable, path: '/integrations', permission: 'settings.manage' },
  { key: 'users', label: 'Users', icon: Users, group: 'System', path: '/users', permission: 'users.manage' },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield, path: '/roles', permission: 'roles.manage' },
  { key: 'settings', label: 'Company Settings', icon: Settings, path: '/settings', permission: 'settings.manage' },
];

function titleFromPath(pathname: string) {
  if (pathname.startsWith('/companies/') && pathname !== '/companies') return 'Company details';
  if (pathname.startsWith('/customers/')) return 'Customer details';
  return navItems.find((i) => i.path === pathname)?.label || 'Dashboard';
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const {
    company,
    companyId,
    activeCompanies,
    companies,
    switchCompany,
    showArchivedCompanies,
    setShowArchivedCompanies,
    companyCommunications,
    companyFollowUps,
    companyPromises,
    getCustomer,
    markCommunicationRead,
  } = useApp();

  const companyOptions = activeCompanies.map((c) => ({ value: c.id, label: c.name }));
  const title = titleFromPath(location.pathname);
  const visibleNav = navItems.filter((item) => !item.permission || hasPermission(item.permission));
  const selectCompanyId = companyId || null;
  const unreadMail = companyCommunications().filter(isUnreadCommunication);
  const unreadInbox = unreadMail.length;
  const notices = useMemo(() => {
    const today = todayIso();
    const items: {
      id: string;
      title: string;
      detail: string;
      time: string;
      href: string;
      unread?: boolean;
      onOpen?: () => void;
    }[] = [];

    for (const mail of unreadMail) {
      const customer = getCustomer(mail.customerId);
      items.push({
        id: `mail-${mail.id}`,
        title: customer?.name || 'Customer reply',
        detail: splitEmailThread(mail.message).body || mail.subject || 'New email',
        time: safeDate(mail.createdAt),
        href: `/customers/${mail.customerId}?tab=communications`,
        unread: true,
        onOpen: () => markCommunicationRead(mail.id),
      });
    }

    for (const follow of companyFollowUps().filter((f) => !f.completed && String(f.followUpDate || '') <= today)) {
      const customer = getCustomer(follow.customerId);
      items.push({
        id: `fu-${follow.id}`,
        title: 'Follow-up due',
        detail: `${customer?.name || 'Customer'} · ${follow.channel}${follow.notes ? ` · ${follow.notes}` : ''}`,
        time: safeDate(follow.followUpDate),
        href: `/customers/${follow.customerId}?tab=communications`,
      });
    }

    for (const promise of companyPromises().filter((p) => p.status === 'Pending' && String(p.promiseDate || '') <= today)) {
      const customer = getCustomer(promise.customerId);
      items.push({
        id: `pr-${promise.id}`,
        title: 'Promise due',
        detail: `${customer?.name || 'Customer'} · promised payment`,
        time: safeDate(promise.promiseDate),
        href: `/customers/${promise.customerId}?tab=promises`,
      });
    }

    return items.slice(0, 20);
  }, [unreadMail, companyFollowUps, companyPromises, getCustomer, markCommunicationRead]);

  function handleLogout() {
    const current = getStoredToken();
    clearSession();
    if (current) void logoutRequest(current);
    window.location.assign('/login');
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
                {item.key === 'communications' && unreadInbox > 0 ? (
                  <span className="nav-unread">{unreadInbox}</span>
                ) : null}
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
            <Menu shadow="md" width={360} position="bottom-end">
              <Menu.Target>
                <div className="topbar-bell">
                  <ActionIcon variant="default" size="lg" radius="md" aria-label="Notifications">
                    <Bell size={16} />
                  </ActionIcon>
                  {notices.length > 0 ? <span className="nav-unread topbar-bell-count">{notices.length}</span> : null}
                </div>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  <Group justify="space-between">
                    <span>Notifications</span>
                    {unreadInbox > 0 ? (
                      <Badge size="xs" color="orange" variant="filled">
                        {unreadInbox} new
                      </Badge>
                    ) : null}
                  </Group>
                </Menu.Label>
                {notices.length === 0 ? (
                  <Text size="xs" c="dimmed" px="sm" py="md">
                    No new emails, follow-ups or promises due.
                  </Text>
                ) : (
                  <ScrollArea.Autosize mah={360}>
                    {notices.map((notice) => (
                      <Menu.Item
                        key={notice.id}
                        className={notice.unread ? 'notice-item-unread' : undefined}
                        onClick={() => {
                          notice.onOpen?.();
                          navigate(notice.href);
                        }}
                      >
                        <Text size="xs" fw={700}>
                          {notice.title}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                          {notice.detail}
                        </Text>
                        <Text size="10px" c="dimmed" mt={4}>
                          {notice.time}
                        </Text>
                      </Menu.Item>
                    ))}
                  </ScrollArea.Autosize>
                )}
                {unreadInbox > 0 ? (
                  <Menu.Item
                    onClick={() => {
                      unreadMail.forEach((mail) => markCommunicationRead(mail.id));
                    }}
                  >
                    Mark emails as read
                  </Menu.Item>
                ) : null}
              </Menu.Dropdown>
            </Menu>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              aria-label="Log out"
              title="Log out"
              onClick={handleLogout}
            >
              <LogOut size={15} />
            </ActionIcon>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
