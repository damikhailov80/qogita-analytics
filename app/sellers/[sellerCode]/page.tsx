'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } from 'docx';

type OrderCandidate = {
    rn: number;
    seller_code: string;
    gtin: string;
    brand: string | null;
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
    const [brandFilter, setBrandFilter] = useState<string>('');
    const [mounted, setMounted] = useState(false);
    const [selectedGtins, setSelectedGtins] = useState<Set<string>>(new Set());

    // Инициализация из URL
    useEffect(() => {
        setMounted(true);
        const searchParams = new URLSearchParams(window.location.search);
        const brandParam = searchParams.get('brand');
        if (brandParam) {
            setBrandFilter(brandParam);
        }
    }, []);

    // Обновление URL при изменении фильтра
    useEffect(() => {
        if (!mounted) return;

        const searchParams = new URLSearchParams(window.location.search);
        if (brandFilter) {
            searchParams.set('brand', brandFilter);
        } else {
            searchParams.delete('brand');
        }

        const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
    }, [brandFilter, mounted]);

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

    const filteredOrders = orders.filter((order) => {
        if (!brandFilter) return true;
        return order.brand?.toLowerCase().includes(brandFilter.toLowerCase());
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedGtins(new Set(filteredOrders.map(order => order.gtin)));
        } else {
            setSelectedGtins(new Set());
        }
    };

    const handleSelectRow = (gtin: string, checked: boolean) => {
        const newSelected = new Set(selectedGtins);
        if (checked) {
            newSelected.add(gtin);
        } else {
            newSelected.delete(gtin);
        }
        setSelectedGtins(newSelected);
    };

    const handleExportCSV = async () => {
        const selectedOrders = filteredOrders.filter(order => selectedGtins.has(order.gtin));

        if (selectedOrders.length === 0) {
            alert('Выберите хотя бы одну строку для экспорта');
            return;
        }

        // Группируем по брендам
        const ordersByBrand = selectedOrders.reduce((acc, order) => {
            const brand = order.brand || 'Без бренда';
            if (!acc[brand]) {
                acc[brand] = [];
            }
            acc[brand].push(order);
            return acc;
        }, {} as Record<string, OrderCandidate[]>);

        // Создаем параграфы для документа
        const paragraphs: Paragraph[] = [];

        // Заголовок 1 - Seller
        paragraphs.push(
            new Paragraph({
                text: `Seller: ${sellerCode}`,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 }
            })
        );

        // Для каждого бренда
        const brands = Object.keys(ordersByBrand).sort();
        for (const brand of brands) {
            // Заголовок 2 - Бренд
            paragraphs.push(
                new Paragraph({
                    text: brand,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                })
            );

            // Список товаров с ссылками
            const brandOrders = ordersByBrand[brand];
            for (const order of brandOrders) {
                const qogitaUrl = order.product_url || '';
                const allegroUrl = `https://business.allegro.pl/listing?string=${order.gtin}`;

                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${order.gtin}: `,
                                bold: true
                            }),
                            new ExternalHyperlink({
                                children: [
                                    new TextRun({
                                        text: 'Qogita',
                                        style: 'Hyperlink',
                                        color: '0563C1',
                                        underline: {}
                                    })
                                ],
                                link: qogitaUrl || allegroUrl
                            }),
                            new TextRun({
                                text: ', '
                            }),
                            new ExternalHyperlink({
                                children: [
                                    new TextRun({
                                        text: 'Allegro',
                                        style: 'Hyperlink',
                                        color: 'FF5A00',
                                        underline: {}
                                    })
                                ],
                                link: allegroUrl
                            })
                        ],
                        spacing: { after: 100 }
                    })
                );
            }
        }

        // Создаем документ
        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        // Генерируем blob и открываем в новой вкладке
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);

        // Создаем временную ссылку для скачивания
        const link = document.createElement('a');
        link.href = url;
        link.download = `seller_${sellerCode}_export_${new Date().toISOString().split('T')[0]}.docx`;
        link.click();

        // Также открываем в новой вкладке через Google Docs Viewer
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + url)}`;
        window.open(url, '_blank');

        // Очищаем URL после небольшой задержки
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const allSelected = filteredOrders.length > 0 && filteredOrders.every(order => selectedGtins.has(order.gtin));
    const someSelected = filteredOrders.some(order => selectedGtins.has(order.gtin));

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
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        placeholder="Фильтр по бренду..."
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md text-sm w-64"
                    />
                    {brandFilter && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBrandFilter('')}
                        >
                            Очистить
                        </Button>
                    )}
                    {selectedGtins.size > 0 && (
                        <Button
                            onClick={handleExportCSV}
                            className="ml-2"
                        >
                            Экспорт в DOCX ({selectedGtins.size})
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground border-b">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={(input) => {
                                            if (input) {
                                                input.indeterminate = someSelected && !allSelected;
                                            }
                                        }}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="w-4 h-4 cursor-pointer"
                                    />
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    RN
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    Image
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    GTIN
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    Brand
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
                                    <td colSpan={19} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredOrders.length > 0 ? (
                                filteredOrders.map((order) => {
                                    const isEditing = editingGtin === order.gtin;
                                    const isSelected = selectedGtins.has(order.gtin);
                                    return (
                                        <tr
                                            key={order.rn}
                                            className="border-b transition-colors hover:bg-muted/50"
                                            data-price-manual={order.manual_price ? "true" : undefined}
                                            data-roi-suspicious={order.profit_ratio > 30 ? "true" : undefined}
                                        >
                                            <td className="p-4 align-middle text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectRow(order.gtin, e.target.checked)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                            </td>
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
                                                <div className="text-sm">{order.brand || '-'}</div>
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
                                    <td colSpan={19} className="h-24 text-center">
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
                    {brandFilter ? (
                        <>
                            Показано: {filteredOrders.length} из {orders.length} товаров
                        </>
                    ) : (
                        <>Total orders: {orders.length}</>
                    )}
                </div>
            )}
        </div>
    );
}
