import { Group, Pagination, Select, Text } from '@mantine/core';
import { PAGE_SIZE_OPTIONS } from '../hooks/useTablePaging';

export function TablePager({
  total,
  from,
  to,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  from: number;
  to: number;
  page: number;
  pageCount: number;
  pageSize: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (value: string | null) => void;
}) {
  return (
    <div className="table-pager">
      <Group gap={8} wrap="nowrap">
        <Text size="sm" c="dimmed">
          Show
        </Text>
        <Select
          aria-label="Rows per page"
          w={88}
          size="xs"
          allowDeselect={false}
          data={PAGE_SIZE_OPTIONS.map((value) => ({
            value,
            label: value === 'all' ? 'All' : value,
          }))}
          value={pageSize}
          onChange={onPageSizeChange}
        />
        <Text size="sm" c="dimmed">
          entries
        </Text>
      </Group>
      <Group gap="md" wrap="wrap" justify="flex-end">
        <Text size="sm" c="dimmed">
          {total ? `Showing ${from} to ${to} of ${total}` : 'No entries'}
        </Text>
        {pageSize !== 'all' && pageCount > 1 && (
          <Pagination size="sm" total={pageCount} value={page} onChange={onPageChange} siblings={1} boundaries={1} />
        )}
      </Group>
    </div>
  );
}
