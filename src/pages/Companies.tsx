import { useState } from 'react';
import { Badge, Button, Card } from '@mantine/core';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CompanyFormModal } from '../modals/CoreModals';
import { initials, money, safeDate } from '../utils';

export default function Companies() {
  const navigate = useNavigate();
  const { activeCompanies, customers, imports, companyId, switchCompany } = useApp();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <PageHero
        title="Companies"
        description="Manage each business as a separate collections portfolio. Customers, imports, recovery jobs, templates and settings remain isolated by company."
        actions={
          <Button leftSection={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            Add company
          </Button>
        }
      />

      <div className="company-grid">
        {activeCompanies.map((c) => {
          const cs = customers.filter((x) => x.companyId === c.id && !x.archived);
          const outstanding = cs.filter((x) => x.status !== 'Paid').reduce((s, x) => s + x.outstanding, 0);
          const latest = [...imports.filter((i) => i.companyId === c.id)].sort((a, b) =>
            b.date.localeCompare(a.date),
          )[0];
          const isActive = c.id === companyId;
          const archived = c.status === 'Archived';

          return (
            <Card
              key={c.id}
              className={`company-card ${isActive ? 'company-card-active' : ''}`}
              radius="lg"
              p="lg"
            >
              <div className="company-card-head">
                <div className="company-logo">
                  {c.logoUrl ? <img src={c.logoUrl} alt={`${c.name} logo`} /> : initials(c.name)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isActive && (
                    <Badge variant="light" color="indigo">
                      Active
                    </Badge>
                  )}
                  {archived && (
                    <Badge variant="light" color="gray">
                      Archived
                    </Badge>
                  )}
                </div>
              </div>
              <div className="company-card-name">{c.name}</div>
              <div className="company-card-code">
                {c.code} · {cs.length} client accounts
              </div>
              <div className="company-stats">
                <div>
                  <span>Outstanding</span>
                  <strong>{money(outstanding)}</strong>
                </div>
                <div>
                  <span>Last import</span>
                  <strong>{latest ? safeDate(latest.date.slice(0, 10)) : 'Never'}</strong>
                </div>
              </div>
              <Button
                fullWidth
                mt="md"
                variant={isActive ? 'light' : 'default'}
                leftSection={<Building2 size={14} />}
                onClick={() => switchCompany(c.id)}
              >
                {isActive ? 'Current company' : 'Switch to company'}
              </Button>
              <Button
                fullWidth
                mt="xs"
                variant="subtle"
                rightSection={<ChevronRight size={14} />}
                onClick={() => {
                  switchCompany(c.id);
                  navigate('/companies/' + c.id);
                }}
              >
                Open details
              </Button>
            </Card>
          );
        })}
      </div>

      <CompanyFormModal opened={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
