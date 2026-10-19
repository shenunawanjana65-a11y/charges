'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef, type TableFeatures } from '@tanstack/react-table';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/layout/status-badge';

import useAxiosAuth from '@/hooks/use-axios-auth';
import useErrorStore from '@/stores/errorStore';
import useLoadingtStore from '@/stores/useLoadingStore';

import OtherChargeForm, {
  OtherChargeRowSchema,
  otherChargeCategories,
  otherChargeTypes
} from './other-charge-form';

type ApiResponse = {
  data: any[];
  pagination: {
    total: number;
    count?: number;
    page: number;
    limit: number;
  };
};

type Filters = {
  status: string; // 'all' | '1' | '0'
  charge_type: string; // 'all' | type id
  search: string;
};

const defaultFilters: Filters = { status: 'all', charge_type: 'all', search: '' };

const formatAmount = (amount: number, amountType: string = 'FIXED') => {
  const formatted = Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return amountType === 'PERCENTAGE' ? `${formatted}%` : `Rs. ${formatted}`;
};

type ColumnActions = {
  onView: (charge: OtherChargeRowSchema) => void;
  onEdit: (charge: OtherChargeRowSchema) => void;
  onDelete: (charge: OtherChargeRowSchema) => void;
  onToggleStatus: (charge: OtherChargeRowSchema) => void;
  onSaveAmount: (charge: OtherChargeRowSchema, amount: string) => void;
  onStartAmountEdit: (charge: OtherChargeRowSchema) => void;
  editingAmount: { id: number; value: string } | null;
  onAmountChange: (value: string) => void;
};

const getColumns = ({
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onSaveAmount,
  onStartAmountEdit,
  editingAmount,
  onAmountChange,
  rowNumberOffset
}: ColumnActions & { rowNumberOffset: number }): ColumnDef<
  TableFeatures,
  OtherChargeRowSchema,
  any
>[] => [
  {
    id: 'no',
    header: '#',
    cell: ({ row }) =>
      (Number.isFinite(rowNumberOffset) ? rowNumberOffset : 0) +
      (Number.isFinite(row.index) ? row.index : 0) +
      1
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.is_pre_disburse && (
          <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold">
            Pre Disburse
          </span>
        )}
        {row.original.is_post_disburse && (
          <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold">
            Post Disburse
          </span>
        )}
      </div>
    )
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <div className="font-medium">{row.original.code}</div>
  },
  {
    accessorKey: 'charge_type',
    header: 'Type',
    cell: ({ row }) =>
      otherChargeTypes.find((t) => t.id === row.original.charge_type)?.label ??
      row.original.charge_type
  },
  {
    accessorKey: 'owner_type',
    header: 'Owner Type',
    cell: ({ row }) => row.original.owner_type
  },
  {
    accessorKey: 'is_rmv',
    header: 'RMV',
    cell: ({ row }) => (
      <span
        className={
          row.original.is_rmv
            ? 'rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white'
            : 'rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white'
        }
      >
        {row.original.is_rmv ? 'Yes' : 'No'}
      </span>
    )
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) =>
      editingAmount?.id === row.original.id ? (
        <Input
          aria-label={`Amount for ${row.original.name}`}
          autoFocus
          type="number"
          min="0"
          max={row.original.amount_type === 'PERCENTAGE' ? '100' : '9999999999.99'}
          step="0.01"
          className="h-8 w-36 text-right"
          value={editingAmount.value}
          onChange={(event) => onAmountChange(event.target.value)}
          onBlur={() => onSaveAmount(row.original, editingAmount.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      ) : (
        <button
          type="button"
          className="w-full rounded px-2 py-1 text-right hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Click to edit amount"
          onClick={() => onStartAmountEdit(row.original)}
        >
          {formatAmount(row.original.amount, row.original.amount_type)}
        </button>
      )
  },
  {
    accessorKey: 'record_status',
    header: 'Status',
    cell: ({ row }) => (
      <button
        type="button"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onToggleStatus(row.original)}
        aria-label={`Set ${row.original.name} ${
          String(row.original.record_status) === '1' ? 'inactive' : 'active'
        }`}
      >
        <StatusBadge status={row.original.record_status} />
      </button>
    )
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`View ${row.original.name}`}
          title="View"
          onClick={() => onView(row.original)}
        >
          <Eye />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Edit ${row.original.name}`}
          title="Edit"
          onClick={() => onEdit(row.original)}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          aria-label={`Delete ${row.original.name}`}
          title="Delete"
          onClick={() => onDelete(row.original)}
        >
          <Trash2 />
        </Button>
      </div>
    )
  }
];

export function OtherChargesTable() {
  const axiosAuth = useAxiosAuth();
  const setError = useErrorStore((state) => state.setError);
  const startLoading = useLoadingtStore((state) => state.startLoading);
  const stopLoading = useLoadingtStore((state) => state.stopLoading);

  const [data, setData] = useState<OtherChargeRowSchema[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [editingAmount, setEditingAmount] = useState<{
    id: number;
    value: string;
  } | null>(null);

  // filters: "draft" = what user is typing, "applied" = used for the API call
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);

  // dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharge, setEditingCharge] =
    useState<OtherChargeRowSchema | null>(null);
  const [viewCharge, setViewCharge] = useState<OtherChargeRowSchema | null>(
    null
  );
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(
    null
  );
  const [deleteCharge, setDeleteCharge] =
    useState<OtherChargeRowSchema | null>(null);

  const handleNew = useCallback(() => {
    setEditingCharge(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((charge: OtherChargeRowSchema) => {
    setEditingCharge(charge);
    setIsFormOpen(true);
  }, []);

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setAppliedFilters(draftFilters);
  }, [draftFilters]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      let url = `/api/admin/other-charges/paginated?sort=name&page=${
        pagination.pageIndex + 1
      }&limit=${pagination.pageSize}`;

      if (appliedFilters.status !== 'all') {
        url += `&status=${appliedFilters.status}`;
      }
      if (appliedFilters.charge_type !== 'all') {
        url += `&charge_type=${appliedFilters.charge_type}`;
      }
      if (appliedFilters.search.trim()) {
        url += `&search=${encodeURIComponent(appliedFilters.search.trim())}`;
      }

      const response = await axiosAuth.post<ApiResponse>(url);

      const formatted: OtherChargeRowSchema[] = response.data.data.map(
        (item: any) => ({
          id: item.id ?? 0,
          name: item.name,
          code: item.code,
          charge_type: item.charge_type,
          owner_type: item.owner_type ?? '',
          amount_type: item.amount_type ?? 'FIXED',
          category: item.category ?? '',
          is_rmv: !!item.is_rmv,
          is_pre_disburse: !!item.is_pre_disburse,
          is_post_disburse: !!item.is_post_disburse,
          amount: Number(item.amount ?? 0),
          record_status: item.record_status ?? 0
        })
      );

      setData(formatted);
      const apiTotal =
        response.data.pagination.total ?? response.data.pagination.count ?? 0;
      setTotalCount(
        typeof apiTotal === 'number' ? apiTotal : Number(apiTotal) || 0
      );
    } catch (err: any) {
      setError(
        null,
        err.response?.data?.message ||
          'An error occurred while loading Other Charges.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, axiosAuth, pagination.pageIndex, pagination.pageSize, setError]);

  const handleDelete = useCallback(async (charge: OtherChargeRowSchema) => {
    startLoading();
    try {
      const response = await axiosAuth.delete(
        `/api/admin/other-charges/${charge.id}`
      );
      if (response.data?.success === false) {
        setError(
          null,
          response?.data?.error?.message ||
            response?.data?.message ||
            'An error occurred while deleting the Other Charge.',
          'error'
        );
        return;
      }
      setError(
        null,
        response?.data?.message || 'Other Charge deleted successfully',
        'success'
      );
      setDeleteSuccessMessage(
        response?.data?.message || 'Other Charge deleted successfully'
      );
      void fetchData();
    } catch (err: any) {
      setError(
        null,
        err.response?.data?.message ||
          'An error occurred while deleting the Other Charge.',
        'error'
      );
    } finally {
      stopLoading();
    }
  }, [axiosAuth, fetchData, setError, startLoading, stopLoading]);

  const handleToggleStatus = useCallback(
    async (charge: OtherChargeRowSchema) => {
      const nextStatus = String(charge.record_status) === '1' ? 0 : 1;
      startLoading();
      try {
        const response = await axiosAuth.patch(
          `/api/admin/other-charges/${charge.id}/status`,
          { record_status: nextStatus }
        );
        if (response.data?.success === false) {
          setError(
            null,
            response?.data?.error?.message ||
              response?.data?.message ||
              'An error occurred while updating the status.',
            'error'
          );
          return;
        }
        setError(
          null,
          `Other Charge set to ${nextStatus === 1 ? 'Active' : 'Inactive'}.`,
          'success'
        );
        await fetchData();
      } catch (err: any) {
        setError(
          null,
          err.response?.data?.message ||
            'An error occurred while updating the status.',
          'error'
        );
      } finally {
        stopLoading();
      }
    },
    [axiosAuth, fetchData, setError, startLoading, stopLoading]
  );

  const handleAmountChange = useCallback((value: string) => {
    setEditingAmount((current) =>
      current ? { ...current, value } : current
    );
  }, []);

  const handleStartAmountEdit = useCallback((charge: OtherChargeRowSchema) => {
    setEditingAmount({
      id: charge.id,
      value: String(charge.amount)
    });
  }, []);

  const handleSaveAmount = useCallback(
    async (charge: OtherChargeRowSchema, rawAmount: string) => {
      setEditingAmount(null);
      const amountText = rawAmount.trim();
      const amount = Number(amountText);
      const decimalPlaces = amountText.split('.')[1]?.length ?? 0;
      if (
        !amountText ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 9999999999.99 ||
        decimalPlaces > 2
      ) {
        setError(null, 'Enter an amount between 0 and 9999999999.99 with up to 2 decimal places.', 'error');
        return;
      }
      if (amount === charge.amount) return;

      startLoading();
      try {
        const response = await axiosAuth.patch(
          `/api/admin/other-charges/${charge.id}/amount`,
          { amount }
        );
        if (response.data?.success === false) {
          setError(
            null,
            response?.data?.error?.message ||
              response?.data?.message ||
              'An error occurred while updating the amount.',
            'error'
          );
          return;
        }
        setError(null, 'Other Charge amount updated successfully.', 'success');
        await fetchData();
      } catch (err: any) {
        setError(
          null,
          err.response?.data?.message ||
            'An error occurred while updating the amount.',
          'error'
        );
      } finally {
        stopLoading();
      }
    },
    [axiosAuth, fetchData, setError, startLoading, stopLoading]
  );

  const rowNumberOffset = pagination.pageIndex * pagination.pageSize;

  const columns = useMemo(
    () =>
      getColumns({
        rowNumberOffset,
        onView: setViewCharge,
        onEdit: handleEdit,
        onDelete: setDeleteCharge,
        onToggleStatus: handleToggleStatus,
        onSaveAmount: handleSaveAmount,
        onStartAmountEdit: handleStartAmountEdit,
        editingAmount,
        onAmountChange: handleAmountChange
      }),
    [
      editingAmount,
      handleAmountChange,
      handleEdit,
      handleSaveAmount,
      handleStartAmountEdit,
      handleToggleStatus,
      rowNumberOffset
    ]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const safePageSize = pagination.pageSize || 1;
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : 0;
  const pageCount = Math.max(1, Math.ceil(safeTotalCount / safePageSize));

  return (
    <>
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Other Charges</h2>
            <p className="text-sm text-muted-foreground">
              Manage charge definitions and pricing rules.
            </p>
          </div>

          <Button type="button" onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Other Charge
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="status-filter" className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                value={draftFilters.status}
                onValueChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id="status-filter" className="h-10 w-full bg-background">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="type-filter" className="text-xs font-medium text-muted-foreground">
                Type
              </label>
              <Select
                value={draftFilters.charge_type}
                onValueChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, charge_type: value }))
                }
              >
                <SelectTrigger id="type-filter" className="h-10 w-full bg-background">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {otherChargeTypes.map((t) => (
                    <SelectItem value={t.id} key={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="other-charge-search" className="text-xs font-medium text-muted-foreground">
                Name / Code
              </label>
              <Input
                id="other-charge-search"
                placeholder="Search by Name / Code"
                value={draftFilters.search}
                className="h-10 bg-background"
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    search: event.target.value
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSearch();
                }}
              />
            </div>

            <div className="flex items-end">
              <Button type="button" className="h-10 w-full gap-2" onClick={handleSearch}>
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {columns.map((column, index) => (
                  <TableHead key={String(column.id ?? index)} className="h-11 px-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {typeof column.header === 'string'
                      ? column.header
                      : column.id ?? 'Column'}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <div className="space-y-2 p-3">
                      {[...Array(pagination.pageSize)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-md" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length ? (
                data.map((row, rowIndex) => (
                  <TableRow key={row.id} className="align-middle hover:bg-muted/30">
                    {columns.map((column, index) => {
                      const value =
                        typeof column.cell === 'function'
                          ? (column.cell as any)({
                              row: { original: row, index: rowIndex } as any,
                              getValue: () => (row as any)[column.id ?? ''],
                              column: column as any,
                              cell: undefined,
                              renderValue: () => (row as any)[column.id ?? ''],
                              table: undefined
                            })
                          : typeof column.cell === 'string'
                            ? column.cell
                            : (row as any)[column.id ?? ''];

                      return (
                        <TableCell key={`${row.id}-${String(column.id ?? index)}`} className="px-4 py-3 text-sm">
                          {value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {safeTotalCount > 0 ? (
              <>
                Showing {pagination.pageIndex * safePageSize + 1} to{' '}
                {Math.min(
                  (pagination.pageIndex + 1) * safePageSize,
                  safeTotalCount
                )}{' '}
                of {safeTotalCount} results
              </>
            ) : (
              <>Showing 0 of 0 results</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: Math.max(0, prev.pageIndex - 1)
                }))
              }
              disabled={pagination.pageIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: prev.pageIndex + 1
                }))
              }
              disabled={pagination.pageIndex + 1 >= pageCount}
            >
              Next
            </Button>
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination((prev) => ({
                  ...prev,
                  pageSize: Number(e.target.value),
                  pageIndex: 0
                }))
              }
              className="h-9 rounded-md border bg-background px-2 text-sm text-foreground outline-none ring-0"
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <OtherChargeForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        charge={editingCharge}
        onSaved={fetchData}
      />

      <AlertDialog
        open={!!deleteCharge}
        onOpenChange={(open) => {
          if (!open) setDeleteCharge(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Other Charge?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteCharge?.name}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (deleteCharge) void handleDelete(deleteCharge);
                  setDeleteCharge(null);
                }}
              >
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSuccessMessage}
        onOpenChange={(open) => {
          if (!open) setDeleteSuccessMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Successful</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSuccessMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction asChild>
              <Button type="button">OK</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View dialog */}
      {viewCharge && (
        <Dialog
          open={!!viewCharge}
          onOpenChange={(open) => {
            if (!open) setViewCharge(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">
            <DialogHeader className="gap-3 border-b bg-muted/40 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Eye className="size-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-lg">
                    Other Charge Details
                  </DialogTitle>
                  <DialogDescription className="break-words">
                    {viewCharge.name}
                  </DialogDescription>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium">
                      {viewCharge.code}
                    </span>
                    <StatusBadge status={viewCharge.record_status} />
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-3 p-6 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Charge Type
                </p>
                <p className="mt-1 font-medium">
                  {otherChargeTypes.find((t) => t.id === viewCharge.charge_type)
                    ?.label ?? viewCharge.charge_type}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </p>
                <p className="mt-1 font-medium">
                  {otherChargeCategories.find(
                    (category) => category.id === viewCharge.category
                  )?.label ??
                    (viewCharge.category || '--')}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Owner Type
                </p>
                <p className="mt-1 font-medium">{viewCharge.owner_type || '--'}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  RMV Charge
                </p>
                <p className="mt-1 font-medium">
                  {viewCharge.is_rmv ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stage
                </p>
                <p className="mt-1 font-medium">
                  {viewCharge.is_pre_disburse
                    ? 'Pre Disburse'
                    : viewCharge.is_post_disburse
                      ? 'Post Disburse'
                      : '--'}
                </p>
              </div>
              <div className="rounded-lg border bg-primary/5 p-4 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Amount
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatAmount(viewCharge.amount, viewCharge.amount_type)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={() => {
                  handleEdit(viewCharge);
                  setViewCharge(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Charge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
