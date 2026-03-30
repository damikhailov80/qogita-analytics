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
    type VisibilityState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { BrandFilterModal } from '@/components/filters/brand-filter-modal';
import { CategoryFilterModal } from '@/components/filters/category-filter-modal';
import { ColumnVisibilityModal } from '@/components/filters/column-visibility-modal';
import { useAppSelector, useAppDispatch } from '@/lib/store/hooks';
import { setColumnVisibility } from '@/lib/store/columnVisibilitySlice';
import { setOnlyAllegro } from '@/lib/store/filterSlice';

type ProductItem = {
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
    data: ProductItem[];
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
    const dispatch = useAppDispatch();
    const [data, setData] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [showBrandFilter, setShowBrandFilter] = useState(false);
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 20,
    });
    const [totalPages, setTotalPages] = useState(0);
    const [isMounted, setIsMounted] = useState(false);

    // Читаем фильтры из Redux
    const whiteListBrands = useAppSelector((state) => state.filters.brands.whiteList);
    const blackListBrands = useAppSelector((state) => state.filters.brands.blackList);
    const whiteListCategories = useAppSelector((state) => state.filters.categories.whiteList);
    const blackListCategories = useAppSelector((state) => state.filters.categories.blackList);
    const onlyAllegro = useAppSelector((state) => state.filters.global?.onlyAllegro ?? false);

    // Читаем видимость колонок из Redux
    const columnVisibility = useAppSelector((state) => state.columnVisibility.products);

    // Ensure component is mounted before showing Redux-dependent content
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Обработчик изменения видимости колонок
    const handleColumnVisibilityChange = (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
        const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
        dispatch(setColumnVisibility({ table: 'products', visibility: newVisibility }));
    };

    const columns: ColumnDef<ProductItem>[] = [
        {
            accessorKey: 'imageUrl',
            header: 'Image',
            size: 80,
            minSize: 60,
            maxSize: 150,
            enableResizing: true,
            enableHiding: true,
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
            enableHiding: true,
            cell: ({ row }) => <div className="font-mono text-sm truncate" title={row.getValue('gtin')}>{row.getValue('gtin')}</div>,
        },
        {
            accessorKey: 'name',
            header: 'Name',
            size: 250,
            minSize: 150,
            enableResizing: true,
            enableHiding: false, // Всегда показываем название
            cell: ({ row }) => <div className="font-medium truncate" title={row.getValue('name')}>{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'brand',
            header: 'Brand',
            size: 120,
            minSize: 80,
            enableResizing: true,
            enableHiding: true,
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
            enableHiding: true,
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
            enableHiding: true,
            cell: ({ row }) => {
                const price = row.getValue('lowestPriceIncShipping') as number | string | null;
                return price ? (
                    <div className="text-right font-medium">€{Number(price).toFixed(2)}</div>
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
            enableHiding: true,
            cell: ({ row }) => <div className="text-sm truncate">{row.getValue('unit') || '-'}</div>,
        },
        {
            accessorKey: 'lowestPricedOfferInventory',
            header: 'Lowest Priced Inv',
            size: 120,
            minSize: 100,
            enableResizing: true,
            enableHiding: true,
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
            enableHiding: true,
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
            enableHiding: true,
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
            enableHiding: true,
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
            enableHiding: true,
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
            enableHiding: true,
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

                // Отправляем все параметры в теле POST запроса
                const response = await fetch('/api/products/qogita/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        page: page.toString(),
                        pageSize: pagination.pageSize.toString(),
                        sortField,
                        sortOrder,
                        whitelist: whiteListBrands,
                        blacklist: blackListBrands,
                        categoryWhitelist: whiteListCategories,
                        categoryBlacklist: blackListCategories,
                        onlyAllegro,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

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
    }, [pagination.pageIndex, pagination.pageSize, sorting, whiteListBrands, blackListBrands, whiteListCategories, blackListCategories, onlyAllegro]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: handleColumnVisibilityChange,
        columnResizeMode: 'onChange',
        manualPagination: true,
        manualSorting: true,
        pageCount: totalPages,
        state: {
            sorting,
            pagination,
            columnSizing,
            columnVisibility,
        },
    });

    const handleExportCSV = async () => {
        try {
            const response = await fetch('/api/products/qogita/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    whitelist: whiteListBrands,
                    blacklist: blackListBrands,
                    categoryWhitelist: whiteListCategories,
                    categoryBlacklist: blackListCategories,
                    onlyAllegro,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Получаем blob из ответа
            const blob = await response.blob();

            // Создаем ссылку для скачивания
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `products-export-${new Date().toISOString().replace(/:/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();

            // Очищаем
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Ошибка при экспорте CSV');
        }
    };

    // Don't render table until mounted to avoid hydration mismatch
    if (!isMounted) {
        return (
            <div className="w-full py-10 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold">Products</h1>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled>
                            Фильтр брендов
                        </Button>
                        <Button variant="outline" disabled>
                            Фильтр категорий
                        </Button>
                        <Button variant="outline" disabled>
                            Показать колонки
                        </Button>
                        <Button variant="outline" disabled>
                            Экспорт CSV
                        </Button>
                    </div>
                </div>
                <div className="rounded-md border w-full overflow-hidden">
                    <div className="h-24 flex items-center justify-center">
                        Loading...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Products</h1>
                    {(whiteListBrands.length > 0 || blackListBrands.length > 0 || whiteListCategories.length > 0 || blackListCategories.length > 0 || onlyAllegro) && (
                        <p className="text-sm text-gray-600 mt-1">
                            {whiteListBrands.length > 0 && `Бренды (белый): ${whiteListBrands.length}`}
                            {whiteListBrands.length > 0 && blackListBrands.length > 0 && ' | '}
                            {blackListBrands.length > 0 && `Бренды (черный): ${blackListBrands.length}`}
                            {(whiteListBrands.length > 0 || blackListBrands.length > 0) && (whiteListCategories.length > 0 || blackListCategories.length > 0) && ' | '}
                            {whiteListCategories.length > 0 && `Категории (белый): ${whiteListCategories.length}`}
                            {whiteListCategories.length > 0 && blackListCategories.length > 0 && ' | '}
                            {blackListCategories.length > 0 && `Категории (черный): ${blackListCategories.length}`}
                            {(whiteListBrands.length > 0 || blackListBrands.length > 0 || whiteListCategories.length > 0 || blackListCategories.length > 0) && onlyAllegro && ' | '}
                            {onlyAllegro && 'Только Allegro'}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={onlyAllegro}
                            onChange={(e) => {
                                dispatch(setOnlyAllegro(e.target.checked));
                                setPagination(prev => ({ ...prev, pageIndex: 0 }));
                            }}
                            className="w-4 h-4"
                        />
                        <span className="text-sm">Только Allegro</span>
                    </label>
                    <Button
                        variant="outline"
                        onClick={() => setShowBrandFilter(true)}
                    >
                        Фильтр брендов
                        {(whiteListBrands.length > 0 || blackListBrands.length > 0) && (
                            <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                {whiteListBrands.length + blackListBrands.length}
                            </span>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowCategoryFilter(true)}
                    >
                        Фильтр категорий
                        {(whiteListCategories.length > 0 || blackListCategories.length > 0) && (
                            <span className="ml-1 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                                {whiteListCategories.length + blackListCategories.length}
                            </span>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowColumnModal(true)}
                    >
                        Показать колонки
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                    >
                        Экспорт CSV
                    </Button>
                </div>
            </div>

            {/* Фильтр по брендам в модальном окне */}
            <BrandFilterModal
                isOpen={showBrandFilter}
                onClose={() => setShowBrandFilter(false)}
                onFilterChange={() => {
                    // Сбрасываем пагинацию при изменении фильтра
                    setPagination(prev => ({ ...prev, pageIndex: 0 }));
                }}
            />

            {/* Фильтр по категориям в модальном окне */}
            <CategoryFilterModal
                isOpen={showCategoryFilter}
                onClose={() => setShowCategoryFilter(false)}
                onFilterChange={() => {
                    // Сбрасываем пагинацию при изменении фильтра
                    setPagination(prev => ({ ...prev, pageIndex: 0 }));
                }}
            />

            {/* Модальное окно для показа/скрытия колонок */}
            <ColumnVisibilityModal
                isOpen={showColumnModal}
                onClose={() => setShowColumnModal(false)}
                table={table}
            />

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
