import { Card, Text, ThemeIcon } from '@mantine/core';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';

export function Metric({
  label,
  value,
  foot,
  icon: Icon,
}: {
  label: string;
  value: string;
  foot: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="metric-card" radius="lg" p="lg">
      <div className="metric-top">
        <div className="metric-label">{label}</div>
        <div className="metric-icon">
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span className="status-dot" style={{ background: '#6c63ff' }} />
        {foot}
      </div>
    </Card>
  );
}

export function ActivityRow({ icon: Icon, text, time }: { icon: LucideIcon; text: string; time: string }) {
  return (
    <div className="activity">
      <div className="activity-icon">
        <Icon size={14} />
      </div>
      <div>
        <div className="activity-text">{text}</div>
        <div className="activity-time">{time}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Search,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={20} />
      </div>
      <Text fw={650} size="sm" c="#4b5568">
        {title}
      </Text>
      {description && (
        <Text size="xs" c="dimmed" mt={6} maw={360} mx="auto">
          {description}
        </Text>
      )}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {Icon && <Icon size={12} color="#8791a2" />}
        <Text size="10px" c="dimmed">
          {label}
        </Text>
      </div>
      <Text size="xs" fw={600} mt={3}>
        {value}
      </Text>
    </div>
  );
}

export function Rule({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <ThemeIcon variant="light" size="lg">
        <Icon size={16} />
      </ThemeIcon>
      <div>
        <Text size="xs" fw={700}>
          {title}
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          {text}
        </Text>
      </div>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="hero">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CustomerIdentity({
  name,
  accountNo,
  size = 'sm',
}: {
  name: string;
  accountNo?: string;
  size?: 'sm' | 'lg';
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="customer-cell">
      <div className="mini-avatar" style={size === 'lg' ? { width: 44, height: 44, fontSize: 13, borderRadius: 12 } : undefined}>
        {initials}
      </div>
      <div>
        <div className="customer-name" style={size === 'lg' ? { fontSize: 16 } : undefined}>
          {name}
        </div>
        {accountNo && <div className="customer-account">{accountNo}</div>}
      </div>
    </div>
  );
}
