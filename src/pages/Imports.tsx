import { useRef, useState } from 'react';
import { Badge, Button, Card, Select, Stack, Table, Text } from '@mantine/core';
import { format, parseISO } from 'date-fns';
import {
  Building2,
  CheckCircle2,
  Import,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { ConfirmModal, MoreActionsMenu } from '../components/CustomerTable';
import { EmptyState, PageHero, Rule } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { ImportBatch } from '../types';

const mappingSections: { title: string; fields: [string, string][] }[] = [
  {
    title: 'Account Summary',
    fields: [
      ['accountNo', 'Account number *'],
      ['name', 'Client name *'],
      ['customerReference', 'Customer reference'],
      ['servicePackage', 'Service / package'],
      ['monthlySubscription', 'Monthly subscription'],
      ['originalOutstanding', 'Original outstanding'],
      ['outstanding', 'Current outstanding *'],
      ['dueDate', 'Due date'],
      ['collectionStage', 'Collection status'],
    ],
  },
  {
    title: 'Contact Information',
    fields: [
      ['phone', 'Phone'],
      ['whatsapp', 'WhatsApp'],
      ['email', 'Email'],
      ['preferredContact', 'Preferred contact'],
      ['language', 'Language'],
    ],
  },
  {
    title: 'Installation Address',
    fields: [
      ['address', 'Installation address'],
      ['suburb', 'Suburb'],
      ['city', 'City'],
      ['province', 'Province'],
      ['postalCode', 'Postal code'],
    ],
  },
  {
    title: 'Next Action',
    fields: [
      ['nextFollowUp', 'Next follow-up'],
      ['assignedCollector', 'Assigned collector'],
    ],
  },
  {
    title: 'Equipment Summary',
    fields: [['equipment', 'Equipment']],
  },
];

export default function Imports() {
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    company,
    importRows,
    importFile,
    mapping,
    setMapping,
    commitImport,
    importResult,
    companyImports,
    handleFile,
    deleteImport,
  } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pendingDelete, setPendingDelete] = useState<ImportBatch | null>(null);

  const headers = importRows.length ? Object.keys(importRows[0]) : [];

  const importActions = (batch: ImportBatch) =>
    isAdmin ? (
      <MoreActionsMenu
        items={[
          {
            label: 'Delete file',
            color: 'red',
            icon: <Trash2 size={14} />,
            onClick: () => setPendingDelete(batch),
          },
        ]}
      />
    ) : null;

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Excel imports"
        description="Upload this company's outstanding-client spreadsheet. Existing accounts (matched by account number) only get their balance updated — no duplicates."
      />

      <div className="two-col">
        <Card className="card" radius="lg" p="lg">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <div className="import-drop" onClick={() => fileInput.current?.click()}>
            <div className="import-icon">
              <UploadCloud size={22} />
            </div>
            <Text fw={700} size="sm">
              {importFile || `Upload ${company.name} outstanding file`}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              Excel .xlsx, .xls or CSV
            </Text>
            <Button mt="md" size="xs" variant="light">
              Browse file
            </Button>
          </div>

          {importRows.length > 0 && (
            <>
              {mappingSections.map((section) => (
                <div key={section.title} className="mapping-section">
                  <div className="mapping-section-title">{section.title}</div>
                  <div className="mapping-grid">
                    {section.fields.map(([key, label]) => (
                      <div className="mapping-item" key={key}>
                        <div className="mapping-key">{label}</div>
                        <Select
                          mt={5}
                          size="xs"
                          searchable
                          clearable
                          placeholder="Select column"
                          data={headers}
                          value={mapping[key] || null}
                          onChange={(v) => setMapping((m) => ({ ...m, [key]: v || '' }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="import-commit">
                <Text size="xs" c="dimmed">
                  {importRows.length} data rows found in this file. Required: Account number,
                  Client name, Current outstanding. Days overdue is calculated from due date.
                </Text>
                <Button leftSection={<Import size={14} />} onClick={commitImport}>
                  Import {importRows.length} rows
                </Button>
              </div>
              {importResult && (
                <Text size="xs" mt="md" c={importResult.startsWith('Please') ? 'red' : 'teal'}>
                  {importResult}
                </Text>
              )}
            </>
          )}
        </Card>

        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Company-safe import rules</div>
          <Stack gap="md" mt="lg">
            <Rule icon={Building2} title="Scoped to one company" text={`This batch can update only ${company.name}.`} />
            <Rule icon={ShieldCheck} title="No duplicate customers" text="Matching account numbers update the existing customer — never create a second row." />
            <Rule icon={RefreshCw} title="Mapped fields refresh on match" text="For known accounts, mapped columns such as balance, contact, address and status are refreshed from the file." />
            <Rule
              icon={CheckCircle2}
              title="Missing accounts are reviewed"
              text="Customers absent from a later file are reported, never silently deleted."
            />
          </Stack>
        </Card>
      </div>

      <Card className="card" radius="lg" p="lg" mt="md">
        <div className="card-title-row">
          <div>
            <div className="card-title">Import history</div>
            <div className="card-subtitle">Previous batches for {company.name}</div>
          </div>
        </div>

        <div className="desktop-table table-wrap">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Rows</Table.Th>
                <Table.Th>New</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th>Not present</Table.Th>
                <Table.Th>Errors</Table.Th>
                {isAdmin && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {companyImports.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    <Text size="xs" fw={600}>
                      {i.file}
                    </Text>
                    <Text size="10px" c="dimmed">
                      {i.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {format(parseISO(i.date), 'dd MMM yyyy HH:mm')}
                    </Text>
                  </Table.Td>
                  <Table.Td>{i.rows}</Table.Td>
                  <Table.Td>{i.created}</Table.Td>
                  <Table.Td>{i.updated}</Table.Td>
                  <Table.Td>{i.cleared}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={i.errors ? 'red' : 'green'}>
                      {i.errors}
                    </Badge>
                  </Table.Td>
                  {isAdmin && <Table.Td>{importActions(i)}</Table.Td>}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>

        <div className="mobile-import-list">
          {companyImports.map((i) => (
            <div className="mobile-import-card" key={i.id}>
              <div>
                <strong>{i.file}</strong>
                <span>{format(parseISO(i.date), 'dd MMM yyyy HH:mm')}</span>
              </div>
              <div className="mobile-import-stats">
                <span>{i.rows} rows</span>
                <span>{i.created} new</span>
                <span>{i.updated} updated</span>
                <span>{i.errors} errors</span>
                {importActions(i)}
              </div>
            </div>
          ))}
        </div>

        {companyImports.length === 0 && (
          <EmptyState title="No imports for this company yet" description="Upload an outstanding file to create the first batch." />
        )}
      </Card>

      <ConfirmModal
        opened={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete imported file"
        message={`Remove ${pendingDelete?.file || 'this import'} from history? Customer accounts created or updated by this file will stay in place.`}
        confirmLabel="Delete file"
        onConfirm={() => {
          if (pendingDelete) deleteImport(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
