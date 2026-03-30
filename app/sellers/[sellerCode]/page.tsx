'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type OrderCandidate = {
    rn: number;
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
    reached_min_order: boolean;
    is_unprofitable: boolean;
    image_url: string | null;
    product_url: string | null;
    sales_quantity: number | null;
    manual_price: string | null;
};

type ApiResponse = {
    sellerCode: string;
    orders: OrderCandidate[];
    count: number;
};

export default function SellerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sellerCode = params.sellerCode as string;
    const [orders, setOrders] = useState<OrderCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingGtin, setEditingGtin] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        manualPrice: string;
    }>({ manualPrice: '' });
    const [plnToEurRate, setPlnToEurRate] = useState<number>(4.5);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/profitable-sellers/${sellerCode}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result: ApiResponse = await response.json();
                setOrders(result.orders);

                // Получаем курс валюты из API
                if (result.orders.length > 0) {
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
                console.error('Error fetching seller orders:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [sellerCode]);

    const handleEdit = (order: OrderCandidate) => {
        setEditingGtin(order.gtin);
        // Конвертируем цену из EUR в PLN для редактирования
        const priceInEur = order.manual_price ? parseFloat(order.manual_price) : 0;
        const priceInPln = priceInEur > 0 ? (priceInEur * plnToEurRate).toFixed(2) : '';

        setEditValues({
            manualPrice: priceInPln,
        });

        // Устанавливаем фокус на input после рендера
        setTimeout(() => {
            const input = document.querySelector(`input[data-gtin="${order.gtin}"]`) as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 0);
    };

    const handleSave = async (gtin: string) => {
        try {
            // Конвертируем цену из PLN в EUR для сохранения в базу
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

            // Обновляем данные
            const ordersResponse = await fetch(`/api/profitable-sellers/${sellerCode}`);
            if (ordersResponse.ok) {
                const result: ApiResponse = await ordersResponse.json();
                setOrders(result.orders);
            }
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

            // Обновляем данные
            const ordersResponse = await fetch(`/api/profitable-sellers/${sellerCode}`);
            if (ordersResponse.ok) {
                const result: ApiResponse = await ordersResponse.json();
                setOrders(result.orders);
            }
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Ошибка при удалении');
        }
    };

    return (
        <div className="w-full py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="mb-4"
                    >
                        ← Назад
                    </Button>
                    <h1 className="text-3xl font-bold">Seller: {sellerCode}</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Кандидаты на заказ, отсортированные по рангу
                    </p>
                </div>
            </div>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    RN
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
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Total Cost
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Total Profit
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Cumulative Cost
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Cumulative Profit
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    Min Order
                                </th>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={16} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : orders.length > 0 ? (
                                orders.map((order) => {
                                    const isEditing = editingGtin === order.gtin;
                                    return (
                                        <tr key={order.rn} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                <div className="text-gray-500">{order.rn}</div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {order.image_url ? (
                                                    <img src={order.image_url} alt="" className="w-12 h-12 object-cover rounded" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-200 rounded" />
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="font-mono text-sm">{order.gtin}</div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex gap-2 justify-center">
                                                    {order.product_url && (
                                                        <a
                                                            href={order.product_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-sm"
                                                        >
                                                            Qogita
                                                        </a>
                                                    )}
                                                    <a
                                                        href={`https://business.allegro.pl/listing?string=${order.gtin}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-orange-600 hover:underline text-sm"
                                                    >
                                                        Allegro
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="font-medium">{order.sales_quantity ?? '-'}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div>€{Number(order.buy_price).toFixed(2)}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <a
                                                    href={`/products/allegro?gtin=${order.gtin}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    €{Number(order.sell_price).toFixed(2)}
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
                                                            data-gtin={order.gtin}
                                                        />
                                                        <span className="text-xs text-gray-500">PLN</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={order.manual_price ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                                            {order.manual_price ? `€${Number(order.manual_price).toFixed(2)}` : '-'}
                                                        </span>
                                                        {order.manual_price && (
                                                            <span className="text-xs text-gray-500">
                                                                {(Number(order.manual_price) * plnToEurRate).toFixed(2)} PLN
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className={order.unit_profit > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                    €{Number(order.unit_profit).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className={order.profit_ratio > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                    {Number(order.profit_ratio).toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div>{order.inventory}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div>€{Number(order.total_cost).toFixed(2)}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className={order.total_profit > 0 ? 'text-green-600' : 'text-red-600'}>
                                                    €{Number(order.total_profit).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="font-medium">€{Number(order.cumulative_cost).toFixed(2)}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className={order.cumulative_profit > 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}>
                                                    €{Number(order.cumulative_profit).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {order.reached_min_order ? (
                                                    <span className="text-green-600">✓</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(order.gtin)}
                                                            data-gtin={order.gtin}
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
                                                            onClick={() => handleEdit(order)}
                                                            data-gtin={order.gtin}
                                                        >
                                                            Edit
                                                        </Button>
                                                        {order.manual_price && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(order.gtin)}
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
                                    <td colSpan={16} className="h-24 text-center">
                                        No orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!loading && orders.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                    Total orders: {orders.length}
                </div>
            )}
        </div>
    );
}
