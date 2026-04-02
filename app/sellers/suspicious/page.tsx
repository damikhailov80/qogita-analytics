'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

type SuspiciousProduct = {
    seller_code: string;
    gtin: string;
    buy_price: number;
    sell_price: number;
    unit_profit: number;
    profit_ratio: number;
    inventory: number;
    total_cost: number;
    total_profit: number;
    cumulative_cost: number;
    cumulative_profit: number;
    min_order_value: number | null;
    seller_min_order_value: number | null;
    image_url: string | null;
    product_url: string | null;
    sales_quantity: number | null;
    manual_price: string | null;
};

type ApiResponse = {
    products: SuspiciousProduct[];
    count: number;
};

export default function SuspiciousSellersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [products, setProducts] = useState<SuspiciousProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [editingGtin, setEditingGtin] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        manualPrice: string;
    }>({ manualPrice: '' });
    const [plnToEurRate, setPlnToEurRate] = useState<number>(4.5);
    const [sellerFilter, setSellerFilter] = useState<string>(searchParams.get('seller') || '');
    const [minOrderFilter, setMinOrderFilter] = useState<'all' | 'ok' | 'not-ok'>(
        (searchParams.get('minOrder') as 'all' | 'ok' | 'not-ok') || 'all'
    );

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sellers/suspicious');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result: ApiResponse = await response.json();
            setProducts(result.products);

            // Получаем курс валюты из API
            if (result.products.length > 0) {
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
            console.error('Error fetching suspicious products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Синхронизация фильтров с URL
    useEffect(() => {
        const params = new URLSearchParams();

        if (sellerFilter) {
            params.set('seller', sellerFilter);
        }

        if (minOrderFilter !== 'all') {
            params.set('minOrder', minOrderFilter);
        }

        const queryString = params.toString();
        const newUrl = queryString ? `/sellers/suspicious?${queryString}` : '/sellers/suspicious';

        router.replace(newUrl, { scroll: false });
    }, [sellerFilter, minOrderFilter, router]);

    const handleRefresh = async () => {
        setUpdating(true);
        try {
            const response = await fetch('/api/profitable-sellers/update', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(result.message);

            setTimeout(async () => {
                await fetchProducts();
                setUpdating(false);
            }, 1000);
        } catch (error) {
            console.error('Error refreshing data:', error);
            alert('Ошибка при обновлении данных');
            setUpdating(false);
        }
    };

    const handleEdit = (product: SuspiciousProduct) => {
        setEditingGtin(product.gtin);
        const priceInEur = product.manual_price ? parseFloat(product.manual_price) : 0;
        const priceInPln = priceInEur > 0 ? (priceInEur * plnToEurRate).toFixed(2) : '';

        setEditValues({
            manualPrice: priceInPln,
        });

        setTimeout(() => {
            const input = document.querySelector(`input[data-gtin="${product.gtin}"]`) as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 0);
    };

    const handleSave = async (gtin: string) => {
        try {
            const priceInPln = editValues.manualPrice ? parseFloat(editValues.manualPrice) : 0;
            const priceInEur = priceInPln > 0 ? priceInPln / plnToEurRate : null;

            const body = {
                manualPrice: priceInEur,
                isDisabled: false,
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

    const filteredProducts = products.filter(product => {
        if (sellerFilter && !product.seller_code.toLowerCase().includes(sellerFilter.toLowerCase())) {
            return false;
        }

        if (minOrderFilter !== 'all') {
            const minOrderValue = product.seller_min_order_value ?? 0;
            const totalProductCost = product.inventory * product.buy_price;
            const hasEnoughStock = minOrderValue > 0 ? totalProductCost >= minOrderValue : true;

            if (minOrderFilter === 'ok' && !hasEnoughStock) return false;
            if (minOrderFilter === 'not-ok' && hasEnoughStock) return false;
        }

        return true;
    });

    return (
        <div className="w-full py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/sellers')}
                        className="mb-4"
                    >
                        ← Назад к продавцам
                    </Button>
                    <h1 className="text-3xl font-bold">Подозрительные товары</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Топ 100 товаров с лучшим абсолютным профитом (Profit Ratio {'>'} 30%)
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={updating}
                >
                    {updating ? 'Обновление...' : 'Пересчитать данные'}
                </Button>
            </div>

            <div className="mb-4 p-4 border rounded-md bg-gray-50">
                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Фильтр по продавцу</label>
                        <input
                            type="text"
                            value={sellerFilter}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            placeholder="Введите код продавца..."
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Min Order OK</label>
                        <select
                            value={minOrderFilter}
                            onChange={(e) => setMinOrderFilter(e.target.value as 'all' | 'ok' | 'not-ok')}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                            <option value="all">Все</option>
                            <option value="ok">✓ Достаточно</option>
                            <option value="not-ok">✗ Недостаточно</option>
                        </select>
                    </div>
                    {(sellerFilter || minOrderFilter !== 'all') && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSellerFilter('');
                                setMinOrderFilter('all');
                            }}
                        >
                            Очистить
                        </Button>
                    )}
                </div>
                {(sellerFilter || minOrderFilter !== 'all') && (
                    <div className="mt-2 text-sm text-gray-600">
                        Найдено товаров: {filteredProducts.length} из {products.length}
                    </div>
                )}
            </div>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    #
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    Seller
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Min Order
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    Image
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    GTIN
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    Links
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Sales Qty
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Buy Price
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Sell Price
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Manual Price
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Unit Profit
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Profit Ratio
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Inventory
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    Min Order OK
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={15} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : products.length > 0 ? (
                                filteredProducts.map((product, index) => {
                                    const isEditing = editingGtin === product.gtin;
                                    const minOrderValue = product.seller_min_order_value ?? 0;
                                    const totalProductCost = product.inventory * product.buy_price;
                                    const hasEnoughStock = minOrderValue > 0 ? totalProductCost >= minOrderValue : true;
                                    return (
                                        <tr
                                            key={`${product.seller_code}-${product.gtin}`}
                                            className="border-b transition-colors hover:bg-muted/50"
                                            data-price-manual={product.manual_price ? "true" : undefined}
                                            data-profit={product.unit_profit != null ? Number(product.unit_profit).toFixed(2) : undefined}
                                        >
                                            <td className="p-4 align-middle">
                                                <div className="text-gray-500">{index + 1}</div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <a
                                                    href={`/sellers/${product.seller_code}`}
                                                    className="font-medium text-blue-600 hover:underline"
                                                >
                                                    {product.seller_code}
                                                </a>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="font-medium">
                                                    {product.seller_min_order_value != null
                                                        ? `€${Number(product.seller_min_order_value).toFixed(2)}`
                                                        : '-'
                                                    }
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt="" className="w-12 h-12 object-cover rounded" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-200 rounded" />
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="font-mono text-sm">{product.gtin}</div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex gap-2 justify-center">
                                                    {product.product_url && (
                                                        <a
                                                            href={product.product_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-sm"
                                                        >
                                                            Qogita
                                                        </a>
                                                    )}
                                                    <a
                                                        href={`https://business.allegro.pl/listing?string=${product.gtin}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-orange-600 hover:underline text-sm"
                                                    >
                                                        Allegro
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="font-medium">{product.sales_quantity ?? '-'}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div>€{Number(product.buy_price).toFixed(2)}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <a
                                                    href={`/products/allegro?gtin=${product.gtin}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    €{Number(product.sell_price).toFixed(2)}
                                                </a>
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
                                                            data-gtin={product.gtin}
                                                        />
                                                        <span className="text-xs text-gray-500">PLN</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={product.manual_price ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                                            {product.manual_price ? `€${Number(product.manual_price).toFixed(2)}` : '-'}
                                                        </span>
                                                        {product.manual_price && (
                                                            <span className="text-xs text-gray-500">
                                                                {(Number(product.manual_price) * plnToEurRate).toFixed(2)} PLN
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="text-green-600 font-medium">
                                                    €{Number(product.unit_profit).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="text-red-600 font-bold">
                                                    {Number(product.profit_ratio).toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div>{product.inventory}</div>
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {minOrderValue > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`text-lg ${hasEnoughStock ? 'text-green-600' : 'text-red-600'}`}>
                                                            {hasEnoughStock ? '✓' : '✗'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            €{totalProductCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(product.gtin)}
                                                            data-gtin={product.gtin}
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
                                                            onClick={() => handleEdit(product)}
                                                            data-gtin={product.gtin}
                                                        >
                                                            Edit
                                                        </Button>
                                                        {product.manual_price && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(product.gtin)}
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
                                    <td colSpan={15} className="h-24 text-center">
                                        {sellerFilter ? 'Товары не найдены по заданному фильтру.' : 'Подозрительных товаров не найдено.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!loading && products.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                    Всего подозрительных товаров: {products.length}
                    {(sellerFilter || minOrderFilter !== 'all') && ` (показано: ${filteredProducts.length})`}
                </div>
            )}
        </div>
    );
}
