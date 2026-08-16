import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE_KEY = 'ch_table_page_size';
export const PAGE_SIZE_OPTIONS = ['10', '25', '50', '100', '250', 'all'] as const;

function readStoredSize(): string {
  try {
    const saved = localStorage.getItem(PAGE_SIZE_KEY);
    if (saved && PAGE_SIZE_OPTIONS.includes(saved as (typeof PAGE_SIZE_OPTIONS)[number])) return saved;
  } catch {
    // private mode
  }
  return '25';
}

export function useTablePaging<T>(items: T[], resetKey = '') {
  const [pageSize, setPageSize] = useState(readStoredSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, items.length]);

  const size = pageSize === 'all' ? Math.max(items.length, 1) : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * size;

  const paged = useMemo(() => (pageSize === 'all' ? items : items.slice(start, start + size)), [items, pageSize, start, size]);

  function changePageSize(value: string | null) {
    const next = value && PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : '25';
    setPageSize(next);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, next);
    } catch {
      // private mode
    }
  }

  return {
    paged,
    page: safePage,
    setPage,
    pageSize,
    changePageSize,
    pageCount,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + paged.length, items.length),
  };
}
