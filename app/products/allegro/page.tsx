'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

type AllegroProduct = {
    id: number;
    gtin: string;
    salesQuantity: number;
    price: string;
    product: {
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
    };
    changes: {
        id: number;
        manualPrice: string | null;
        isDisabled: boolean;
    } | null;
};

type ApiResponse = {
    data: AllegroProduct[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
};

export default function AllegroProductsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [data, setData] = useState<AllegroProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState(searchParams.get('gtin') || '');
    const [editingGtin, setEditingGtin] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        manualPrice: string;
        isDisabled: boolean;
    }>({ manualPrice: '', isDisabled: false });
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [plnToEurRate, setPlnToEurRate] = useState<number>(4.5);

    const currentPage = parseInt(searchParams.get('page') || '1');
    const currentGtin = searchParams.get('gtin') || '';
    const currentSortField = searchParams.get('sortField') || 'gtin';
    const currentSortOrder = searchParams.get('sortOrder') || 'asc';
    const pageSize = 20;

    const updateURL = (page: number, gtin: string, sortField?: string, sortOrder?: string) => {
        const params = new URLSearchParams();
        if (page > 1) params.set('page', page.toString());
        if (gtin) params.set('gtin', gtin);
        if (sortField && sortField !== 'gtin') params.set('sortField', sortField);
        if (sortOrder && sortOrder !== 'asc') params.set('sortOrder', sortOrder);

        const query = params.toString();
        router.push(query ? `?${query}` : '/products/allegro');
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                pageSize: pageSize.toString(),
                sortField: currentSortField,
                sortOrder: currentSortOrder,
            });

            if (currentGtin) {
                params.append('gtin', currentGtin);
            }

            const response = await fetch(`/api/products/allegro?${params}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result: ApiResponse = await response.json();
            setData(result.data);
            setTotalPages(result.pagination.totalPages);
            setTotalCount(result.pagination.totalCount);

            // Получаем курс валюты из API
            if (result.data.length > 0) {
                try {
                    const configResponse = await fetch('/api/config');
                    if (configResponse.ok) {
                        const config = await configResponse.json();
                        if (config.plnToEurRate) {
                            setPlnToEurRate(config.plnToEurRate);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching config:', error);
                }
            }
        } catch (error) {
            console.error('Error fetching allegro products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [currentPage, currentGtin, currentSortField, currentSortOrder]);

    const handleSearch = () => {
        updateURL(1, searchInput, currentSortField, currentSortOrder);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        updateURL(1, '', currentSortField, currentSortOrder);
    };

    const handleSort = (field: string) => {
        const newOrder = currentSortField === field && currentSortOrder === 'asc' ? 'desc' : 'asc';
        updateURL(1, currentGtin, field, newOrder);
    };

    const handleEdit = (item: AllegroProduct) => {
        setEditingGtin(item.gtin);
        // Конвертируем цену из EUR в PLN для редактирования
        const priceInEur = item.changes?.manualPrice ? parseFloat(item.changes.manualPrice) : 0;
        const priceInPln = priceInEur > 0 ? (priceInEur * plnToEurRate).toFixed(2) : '';

        setEditValues({
            manualPrice: priceInPln,
            isDisabled: item.changes?.isDisabled || false,
        });
    };

    const handleSave = async (gtin: string) => {
        try {
            // Конвертируем цену из PLN в EUR для сохранения в базу
            const priceInPln = editValues.manualPrice ? parseFloat(editValues.manualPrice) : 0;
            const priceInEur = priceInPln > 0 ? priceInPln / plnToEurRate : null;

            const body = {
                manualPrice: priceInEur,
                isDisabled: editValues.isDisabled,
            };

            const response = await fetch(`/api/products/allegro/changes/${gtin}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error('Failed to save');

            setEditingGtin(null);
            await fetchProducts();
        } catch (error) {
            console.error('Error saving:', error);
            alert('Ошибка при сохранении');
        }
    };

    const handleDelete = async (gtin: string) => {
        if (!confirm('Удалить изменения для этого продукта?')) return;

        try {
            const response = await fetch(`/api/products/allegro/changes/${gtin}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete');

            await fetchProducts();
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Ошибка при удалении');
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            updateURL(currentPage - 1, currentGtin, currentSortField, currentSortOrder);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            updateURL(currentPage + 1, currentGtin, currentSortField, currentSortOrder);
        }
    };

    return (
        <div className="w-full py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Allegro Products</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Total: {totalCount} products
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Поиск по GTIN..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="px-4 py-2 border rounded-md w-64"
                    />
                    <Button onClick={handleSearch}>
                        Поиск
                    </Button>
                    {currentGtin && (
                        <Button
                            variant="outline"
                            onClick={handleClearSearch}
                        >
                            Сбросить
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: '80px' }}>
                                    Image
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: '140px' }}>
                                    <div
                                        className="cursor-pointer select-none flex items-center gap-1"
                                        onClick={() => handleSort('gtin')}
                                    >
                                        GTIN
                                        {currentSortField === 'gtin' && (
                                            <span>{currentSortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: '250px' }}>
                                    Name
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: '120px' }}>
                                    Brand
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: '150px' }}>
                                    Category
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b" style={{ width: '80px' }}>
                                    Link
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b" style={{ width: '120px' }}>
                                    Allegro Price
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b" style={{ width: '100px' }}>
                                    Sales Qty
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b" style={{ width: '130px' }}>
                                    <div
                                        className="cursor-pointer select-none flex items-center justify-end gap-1"
                                        onClick={() => handleSort('manualPrice')}
                                    >
                                        Manual Price
                                        {currentSortField === 'manualPrice' && (
                                            <span>{currentSortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b" style={{ width: '100px' }}>
                                    <div
                                        className="cursor-pointer select-none flex items-center justify-center gap-1"
                                        onClick={() => handleSort('isDisabled')}
                                    >
                                        Disabled
                                        {currentSortField === 'isDisabled' && (
                                            <span>{currentSortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b" style={{ width: '150px' }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : data.length ? (
                                data.map((item) => {
                                    const isEditing = editingGtin === item.gtin;
                                    return (
                                        <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-200 rounded" />
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="font-mono text-sm">{item.gtin}</div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="font-medium max-w-xs truncate" title={item.product.name}>
                                                    {item.product.name}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {item.product.brand || '-'}
                                            </td>
                                            <td className="p-4 align-middle">
                                                {item.product.category || '-'}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                <a
                                                    href={`https://business.allegro.pl/listing?string=${item.gtin}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-orange-600 hover:underline text-sm"
                                                >
                                                    Allegro
                                                </a>
                                            </td>
                                            <td className="p-4 align-middle text-right font-medium">
                                                €{Number(item.price).toFixed(2)}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                {item.salesQuantity}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                {isEditing ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={editValues.manualPrice}
                                                            onChange={(e) => setEditValues(prev => ({ ...prev, manualPrice: e.target.value }))}
                                                            className="w-24 px-2 py-1 border rounded text-right"
                                                            placeholder="PLN"
                                                        />
                                                        <span className="text-xs text-gray-500">PLN</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={item.changes?.manualPrice ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                                            {item.changes?.manualPrice ? `€${Number(item.changes.manualPrice).toFixed(2)}` : '-'}
                                                        </span>
                                                        {item.changes?.manualPrice && (
                                                            <span className="text-xs text-gray-500">
                                                                {(Number(item.changes.manualPrice) * plnToEurRate).toFixed(2)} PLN
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {isEditing ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={editValues.isDisabled}
                                                        onChange={(e) => setEditValues(prev => ({ ...prev, isDisabled: e.target.checked }))}
                                                        className="w-4 h-4"
                                                    />
                                                ) : (
                                                    <span className={item.changes?.isDisabled ? 'text-red-600' : 'text-gray-400'}>
                                                        {item.changes?.isDisabled ? 'Yes' : 'No'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(item.gtin)}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setEditingGtin(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleEdit(item)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        {item.changes && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(item.gtin)}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={11} className="h-24 text-center">
                                        {currentGtin ? 'Нет результатов' : 'No products'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
