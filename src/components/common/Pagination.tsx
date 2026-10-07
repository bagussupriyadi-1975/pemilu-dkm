import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  idPrefix?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  idPrefix = 'pagination',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div
      id={`${idPrefix}-container`}
      className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-center gap-3 text-slate-500">
        <span>
          Menampilkan <strong className="font-semibold text-slate-800">{startItem}</strong> -{' '}
          <strong className="font-semibold text-slate-800">{endItem}</strong> dari{' '}
          <strong className="font-semibold text-slate-800">{totalItems}</strong> data
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400">| Per hal:</span>
            <select
              id={`${idPrefix}-pagesize-select`}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer text-xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          id={`${idPrefix}-prev-btn`}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-xs font-medium transition-colors ${
            currentPage <= 1
              ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer'
          }`}
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 text-xs">
                  &hellip;
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                id={`${idPrefix}-page-${pageNum}`}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[30px] h-[30px] px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          id={`${idPrefix}-next-btn`}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-xs font-medium transition-colors ${
            currentPage >= totalPages
              ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer'
          }`}
          title="Halaman Berikutnya"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
