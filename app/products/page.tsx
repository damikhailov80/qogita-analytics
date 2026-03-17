'use client';

import { useEffect, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type ColumnSizingState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

type Product = {
    id: number;
    gtin: string;
    name: string;
    category: string | null;
    brand: string | null;
    lowestPriceIncShipping: number | string | null;
    unit: string | null;
    lowestPricedOfferInventory: number | null;
    isPreOrder: boolean;
    estimatedDeliveryTimeWeeks: number | null;
    numberOfOffers: number | null;
    totalInventoryAllOffers: number | null;
    productUrl: string | null;
    imageUrl: string | null;
};

type ApiResponse = {
    data: Product[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
};

export default function ProductsPage() {
    const [data, setData] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 20,
    });
    const [totalPages, setTotalPages] = useState(0);

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: 'imageUrl',
            header: 'Image',
            size: 80,
            minSize: 60,
            maxSize: 150,
            enableResizing: true,
            cell: ({ row }) => {
                const imageUrl = row.getValue('imageUrl') as string | null;
                return imageUrl ? (
                    <img src={imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded" />
                );
            },
        },
        {
            accessorKey: 'gtin',
            header: 'GTIN',
            size: 140,
            minSize: 100,
            enableResizing: true,
            cell: ({ row }) => <div className="font-mono text-sm truncate" title={row.getValue('gtin')}>{row.getValue('gtin')}</div>,
        },
        {
            accessorKey: 'name',
            header: 'Name',
            size: 250,
            minSize: 150,
            enableResizing: true,
            cell: ({ row }) => <div className="font-medium truncate" title={row.getValue('name')}>{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'brand',
            header: 'Brand',
            size: 120,
            minSize: 80,
            enableResizing: true,
            cell: ({ row }) => {
                const brand = row.getValue('brand') as string | null;
                return <div className="truncate" title={brand || '-'}>{brand || '-'}</div>;
            },
        },
        {
            accessorKey: 'category',
            header: 'Category',
            size: 150,
            minSize: 100,
            enableResizing: true,
            cell: ({ row }) => {
                const category = row.getValue('category') as string | null;
                return <div className="truncate" title={category || '-'}>{category || '-'}</div>;
            },
        },
        {
            accessorKey: 'lowestPriceIncShipping',
            header: 'Price',
            size: 100,
            minSize: 80,
            enableResizing: true,
            cell: ({ row }) => {
                const price = row.getValue('lowestPriceIncShipping') as number | string | null;
                return price ? (
                    <div className="text-right font-medium">${Number(price).toFixed(2)}</div>
                ) : (
                    <div className="text-right text-gray-400">-</div>
                );
            },
        },
        {
            accessorKey: 'unit',
            header: 'Unit',
            size: 80,
            minSize: 60,
            enableResizing: true,
            cell: ({ row }) => <div className="text-sm truncate">{row.getValue('unit') || '-'}</div>,
        },
        {
            accessorKey: 'lowestPricedOfferInventory',
            header: 'Lowest Priced Inv',
            size: 120,
            minSize: 100,
            enableResizing: true,
            cell: ({ row }) => {
                const inventory = row.getValue('lowestPricedOfferInventory') as number | null;
                return <div className="text-right">{inventory ?? '-'}</div>;
            },
        },
        {
            accessorKey: 'totalInventoryAllOffers',
            header: 'Total Inventory',
            size: 120,
            minSize: 100,
            enableResizing: true,
            cell: ({ row }) => {
                const inventory = row.getValue('totalInventoryAllOffers') as number | null;
                return <div className="text-right">{inventory ?? '-'}</div>;
            },
        },
        {
            accessorKey: 'numberOfOffers',
            header: 'Offers',
            size: 80,
            minSize: 60,
            enableResizing: true,
            cell: ({ row }) => {
                const offers = row.getValue('numberOfOffers') as number | null;
                return <div className="text-right">{offers ?? '-'}</div>;
            },
        },
        {
            accessorKey: 'isPreOrder',
            header: 'Pre-order',
            size: 90,
            minSize: 70,
            enableResizing: true,
            cell: ({ row }) => {
                const isPreOrder = row.getValue('isPreOrder') as boolean;
                return (
                    <div className="text-sm">
                        {isPreOrder ? (
                            <span className="text-orange-600">Yes</span>
                        ) : (
                            <span className="text-gray-400">No</span>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'estimatedDeliveryTimeWeeks',
            header: 'Delivery (weeks)',
            size: 120,
            minSize: 100,
            enableResizing: true,
            cell: ({ row }) => {
                const weeks = row.getValue('estimatedDeliveryTimeWeeks') as number | null;
                return <div className="text-sm">{weeks ? `${weeks}` : '-'}</div>;
            },
        },
        {
            accessorKey: 'productUrl',
            header: 'URL',
            size: 80,
            minSize: 60,
            enableResizing: true,
            cell: ({ row }) => {
                const url = row.getValue('productUrl') as string | null;
                return url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        Link
                    </a>
                ) : (
                    <div className="text-gray-400">-</div>
                );
            },
        },
    ];

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const sortField = sorting[0]?.id || 'id';
                const sortOrder = sorting[0]?.desc ? 'desc' : 'asc';
                const page = pagination.pageIndex + 1;

                const response = await fetch(
                    `/api/products?page=${page}&pageSize=${pagination.pageSize}&sortField=${sortField}&sortOrder=${sortOrder}`
                );
                const result: ApiResponse = await response.json();

                setData(result.data);
                setTotalPages(result.pagination.totalPages);
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [pagination.pageIndex, pagination.pageSize, sorting]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        onColumnSizingChange: setColumnSizing,
        columnResizeMode: 'onChange',
        manualPagination: true,
        manualSorting: true,
        pageCount: totalPages,
        state: {
            sorting,
            pagination,
            columnSizing,
        },
    });

    return (
        <div className="w-full py-10 px-4">
            <h1 className="text-3xl font-bold mb-6">Products</h1>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-muted/50">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b relative"
                                            style={{ width: header.getSize() }}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={
                                                        header.column.getCanSort()
                                                            ? 'cursor-pointer select-none flex items-center gap-2'
                                                            : 'flex items-center gap-2'
                                                    }
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {{
                                                        asc: ' ↑',
                                                        desc: ' ↓',
                                                    }[header.column.getIsSorted() as string] ?? null}
                                                </div>
                                            )}
                                            {header.column.getCanResize() && (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-500 ${header.column.getIsResizing() ? 'bg-blue-500' : ''
                                                        }`}
                                                />
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className="p-4 align-middle overflow-hidden"
                                                style={{ width: cell.column.getSize() }}
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of {totalPages}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
