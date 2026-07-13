import { Button } from '../../components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '../../components/ui/pagination';
import { FilterSelect } from '../../components/common/filter-select';

export function CatalogPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: 25 | 50 | 100;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 25 | 50 | 100) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <footer className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-sm text-muted-foreground">
      <span className="whitespace-nowrap tabular-nums">共 {total} 条，第 {page} / {totalPages} 页</span>
      <div className="flex items-center gap-3">
        <FilterSelect
          value={String(pageSize)}
          placeholder="每页"
          options={[25, 50, 100].map((value) => ({ value: String(value), label: `${value} 条/页` }))}
          onChange={(value) => onPageSizeChange(Number(value) as 25 | 50 | 100)}
          className="w-28"
        />
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</Button>
            </PaginationItem>
            <PaginationItem>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </footer>
  );
}
