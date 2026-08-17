import { useState } from 'react';
import { Badge, Button, Card, Group } from '@mantine/core';
import { Building2, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal, RowActionsMenu } from '../components/CustomerTable';
import { EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CompleteRecoveryModal, CreateRecoveryJobModal } from '../modals/ActionModals';
import type { RecoveryJob } from '../types';
import { actorName, recoveryColor, safeDate, todayIso } from '../utils';

export default function Recovery() {
  const navigate = useNavigate();
  const { company, companyRecoveries, getCustomer, updateRecovery, deleteRecovery } = useApp();
  const [completeJobId, setCompleteJobId] = useState<string | null>(null);
  const [editJob, setEditJob] = useState<RecoveryJob | null>(null);
  const [deleteJob, setDeleteJob] = useState<RecoveryJob | null>(null);

  const openCount = companyRecoveries.filter(
    (r) => !['Recovered', 'Closed', 'Written Off'].includes(r.status),
  ).length;
  const editCustomer = editJob ? getCustomer(editJob.customerId) || null : null;

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Equipment recovery"
        description="Manage antennas, CPEs, routers and other company-owned equipment that needs collection."
        actions={
          <Badge size="lg" variant="light" color="orange">
            {openCount} open
          </Badge>
        }
      />

      <div className="recovery-grid">
        {companyRecoveries.map((r) => {
          const c = getCustomer(r.customerId);
          return (
            <div className="recovery-card" key={r.id}>
              <div className="recovery-head">
                <div>
                  <div
                    className="recovery-client"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/customers/' + r.customerId)}
                  >
                    {c?.name || 'Unknown customer'}
                  </div>
                  <div className="recovery-id">
                    {r.id} · {c?.accountNo}
                  </div>
                </div>
                <Group gap={6} wrap="nowrap">
                  <Badge variant="light" color={recoveryColor[r.status] || 'gray'} size="sm">
                    {r.status}
                  </Badge>
                  <RowActionsMenu
                    onEdit={() => setEditJob(r)}
                    onDelete={() => setDeleteJob(r)}
                  />
                </Group>
              </div>
              <div className="recovery-meta">
                <div>
                  <div className="meta-label">Equipment</div>
                  <div className="meta-value">{r.equipment}</div>
                </div>
                <div>
                  <div className="meta-label">Technician</div>
                  <div className="meta-value">{r.technician}</div>
                </div>
                <div>
                  <div className="meta-label">Address</div>
                  <div className="meta-value">{c?.address || '—'}</div>
                </div>
                <div>
                  <div className="meta-label">Schedule</div>
                  <div className="meta-value">
                    {r.scheduledDate ? safeDate(r.scheduledDate) : 'Not scheduled'}
                  </div>
                </div>
              </div>
              <Group mt="md" grow>
                {(r.status === 'Awaiting assignment' || r.status === 'Recovery Required') && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() =>
                      updateRecovery({
                        ...r,
                        status: 'Scheduled',
                        technician: r.technician === 'Unassigned' ? actorName() : r.technician,
                        scheduledDate: r.scheduledDate || todayIso(),
                      })
                    }
                  >
                    Assign & schedule
                  </Button>
                )}
                {r.status === 'Scheduled' && (
                  <Button size="xs" color="green" variant="light" onClick={() => setCompleteJobId(r.id)}>
                    Mark recovered
                  </Button>
                )}
                {['Recovered', 'Closed', 'Written Off'].includes(r.status) && (
                  <Button size="xs" variant="subtle" disabled>
                    Completed
                  </Button>
                )}
                {!['Awaiting assignment', 'Recovery Required', 'Scheduled', 'Recovered', 'Closed', 'Written Off'].includes(
                  r.status,
                ) && (
                  <Button size="xs" variant="light" onClick={() => setCompleteJobId(r.id)}>
                    Update outcome
                  </Button>
                )}
              </Group>
            </div>
          );
        })}
      </div>

      {companyRecoveries.length === 0 && (
        <Card className="card" radius="lg" p="lg">
          <EmptyState
            icon={Truck}
            title="No recovery jobs for this company"
            description="Recovery cases created from cancelled services or recovery-required accounts will appear here."
          />
        </Card>
      )}

      <CompleteRecoveryModal
        opened={!!completeJobId}
        onClose={() => setCompleteJobId(null)}
        jobId={completeJobId}
      />
      <CreateRecoveryJobModal
        opened={!!editJob}
        onClose={() => setEditJob(null)}
        customer={editCustomer}
        existing={editJob}
      />
      <ConfirmModal
        opened={!!deleteJob}
        onClose={() => setDeleteJob(null)}
        title="Delete recovery job"
        message={
          deleteJob
            ? `Remove recovery job ${deleteJob.id}? This does not delete the linked equipment.`
            : ''
        }
        confirmLabel="Delete job"
        onConfirm={() => {
          if (deleteJob) deleteRecovery(deleteJob.id);
          setDeleteJob(null);
        }}
      />
    </>
  );
}
