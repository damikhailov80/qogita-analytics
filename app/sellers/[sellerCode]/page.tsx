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
    allegro_price: number | null;
    unit_profit: number;
    profit_ratio: number;
    inventory: number;
    total_cost: number;
    total_profit: number;
    cumulative_cost: number;
    cumulative_profit: number;
    min_order_value: number | null;
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

    // Фильтры для Sales Qty и Sell Price
    const [minSalesQty, setMinSalesQty] = useState<string>('');
    const [maxSalesQty, setMaxSalesQty] = useState<string>('');
    const [minSellPrice, setMinSellPrice] = useState<string>('');
    const [maxSellPrice, setMaxSellPrice] = useState<string>('');

    // Инициализация из URL
    useEffect(() => {
        setMounted(true);
        const searchParams = new URLSearchParams(window.location.search);
        const brandParam = searchParams.get('brand');
        const minSalesQtyParam = searchParams.get('minSalesQty');
        const maxSalesQtyParam = searchParams.get('maxSalesQty');
        const minSellPriceParam = searchParams.get('minSellPrice');
        const maxSellPriceParam = searchParams.get('maxSellPrice');

        if (brandParam) setBrandFilter(brandParam);
        if (minSalesQtyParam) setMinSalesQty(minSalesQtyParam);
        if (maxSalesQtyParam) setMaxSalesQty(maxSalesQtyParam);
        if (minSellPriceParam) setMinSellPrice(minSellPriceParam);
        if (maxSellPriceParam) setMaxSellPrice(maxSellPriceParam);
    }, []);

    // Обновление URL при изменении фильтра
    useEffect(() => {
        if (!mounted) return;

        const searchParams = new URLSearchParams();
        if (brandFilter) searchParams.set('brand', brandFilter);
        if (minSalesQty) searchParams.set('minSalesQty', minSalesQty);
        if (maxSalesQty) searchParams.set('maxSalesQty', maxSalesQty);
        if (minSellPrice) searchParams.set('minSellPrice', minSellPrice);
        if (maxSellPrice) searchParams.set('maxSellPrice', maxSellPrice);

        const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
    }, [brandFilter, minSalesQty, maxSalesQty, minSellPrice, maxSellPrice, mounted]);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (minSalesQty) params.set('minSalesQty', minSalesQty);
                if (maxSalesQty) params.set('maxSalesQty', maxSalesQty);
                if (minSellPrice) params.set('minSellPrice', minSellPrice);
                if (maxSellPrice) params.set('maxSellPrice', maxSellPrice);

                const response = await fetch(`/api/profitable-sellers/${sellerCode}${params.toString() ? '?' + params.toString() : ''}`);

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
    }, [sellerCode, minSalesQty, maxSalesQty, minSellPrice, maxSellPrice]);

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
            const params = new URLSearchParams();
            if (minSalesQty) params.set('minSalesQty', minSalesQty);
            if (maxSalesQty) params.set('maxSalesQty', maxSalesQty);
            if (minSellPrice) params.set('minSellPrice', minSellPrice);
            if (maxSellPrice) params.set('maxSellPrice', maxSellPrice);

            const ordersResponse = await fetch(`/api/profitable-sellers/${sellerCode}${params.toString() ? '?' + params.toString() : ''}`);
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
            const params = new URLSearchParams();
            if (minSalesQty) params.set('minSalesQty', minSalesQty);
            if (maxSalesQty) params.set('maxSalesQty', maxSalesQty);
            if (minSellPrice) params.set('minSellPrice', minSellPrice);
            if (maxSellPrice) params.set('maxSellPrice', maxSellPrice);

            const ordersResponse = await fetch(`/api/profitable-sellers/${sellerCode}${params.toString() ? '?' + params.toString() : ''}`);
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

    const clearFilters = () => {
        setBrandFilter('');
        setMinSalesQty('');
        setMaxSalesQty('');
        setMinSellPrice('');
        setMaxSellPrice('');
    };

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

    const handleExportDOCX = async () => {
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

    const handleExportCSV = () => {
        const selectedOrders = filteredOrders.filter(order => selectedGtins.has(order.gtin));

        if (selectedOrders.length === 0) {
            alert('Выберите хотя бы одну строку для экспорта');
            return;
        }

        // Заголовки CSV
        const headers = [
            'RN',
            'Seller Code',
            'GTIN',
            'Brand',
            'Buy Price (€)',
            'Sell Price (€)',
            'Allegro Price (€)',
            'Manual Price (€)',
            'Unit Profit (€)',
            'Profit Ratio (%)',
            'Inventory',
            'Total Cost (€)',
            'Total Profit (€)',
            'Cumulative Cost (€)',
            'Cumulative Profit (€)',
            'Min Order Value (€)',
            'Sales Quantity',
            'Product URL',
            'Allegro URL',
            'Image URL'
        ];

        // Формируем строки CSV
        const rows = selectedOrders.map(order => [
            order.rn,
            order.seller_code,
            order.gtin,
            order.brand || '',
            Number(order.buy_price).toFixed(2),
            Number(order.sell_price).toFixed(2),
            order.allegro_price ? Number(order.allegro_price).toFixed(2) : '',
            order.manual_price ? Number(order.manual_price).toFixed(2) : '',
            Number(order.unit_profit).toFixed(2),
            Number(order.profit_ratio).toFixed(2),
            order.inventory,
            Number(order.total_cost).toFixed(2),
            Number(order.total_profit).toFixed(2),
            Number(order.cumulative_cost).toFixed(2),
            Number(order.cumulative_profit).toFixed(2),
            order.min_order_value ? Number(order.min_order_value).toFixed(2) : '',
            order.sales_quantity ?? '',
            order.product_url || '',
            `https://business.allegro.pl/listing?string=${order.gtin}`,
            order.image_url || ''
        ]);

        // Экранируем значения для CSV
        const escapeCsvValue = (value: string | number) => {
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Собираем CSV
        const csvContent = [
            headers.map(escapeCsvValue).join(','),
            ...rows.map(row => row.map(escapeCsvValue).join(','))
        ].join('\n');

        // Создаем blob и скачиваем
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `seller_${sellerCode}_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
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
                    {selectedGtins.size > 0 && (
                        <>
                            <Button
                                onClick={handleExportCSV}
                                variant="outline"
                            >
                                Экспорт в CSV ({selectedGtins.size})
                            </Button>
                            <Button
                                onClick={handleExportDOCX}
                            >
                                Экспорт в DOCX ({selectedGtins.size})
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {mounted && (
                <div className="mb-6 p-4 border rounded-md bg-gray-50">
                    <div className="grid grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Фильтр по бренду</label>
                            <input
                                type="text"
                                placeholder="Бренд..."
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Min Sales Qty</label>
                            <input
                                type="number"
                                value={minSalesQty}
                                onChange={(e) => setMinSalesQty(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Max Sales Qty</label>
                            <input
                                type="number"
                                value={maxSalesQty}
                                onChange={(e) => setMaxSalesQty(e.target.value)}
                                placeholder="∞"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Min Sell Price (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={minSellPrice}
                                onChange={(e) => setMinSellPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Max Sell Price (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={maxSellPrice}
                                onChange={(e) => setMaxSellPrice(e.target.value)}
                                placeholder="∞"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                    </div>
                    {(brandFilter || minSalesQty || maxSalesQty || minSellPrice || maxSellPrice) && (
                        <div className="mt-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                            >
                                Очистить все фильтры
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground border-b sticky left-0 bg-muted/50 z-10">
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
                                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    RN
                                </th>
                                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Img
                                </th>
                                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    GTIN
                                </th>
                                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Brand
                                </th>
                                <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Links
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Sales
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Buy €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Sell €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Manual €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Profit €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    ROI %
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Inv
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Total €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    T.Profit €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Cum.Cost €
                                </th>
                                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Cum.Profit €
                                </th>
                                <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground border-b whitespace-nowrap">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={18} className="h-24 text-center">
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
                                            data-roi={order.profit_ratio != null ? Number(order.profit_ratio).toFixed(2) : undefined}
                                        >
                                            <td className="p-2 align-middle text-center sticky left-0 bg-white z-10">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectRow(order.gtin, e.target.checked)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="text-gray-500">{order.rn}</div>
                                            </td>
                                            <td className="p-2 align-middle">
                                                {order.image_url ? (
                                                    <img src={order.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-200 rounded" />
                                                )}
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="font-mono whitespace-nowrap">{order.gtin}</div>
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="max-w-[120px] truncate" title={order.brand || '-'}>{order.brand || '-'}</div>
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="flex gap-1 justify-center">
                                                    {order.product_url && (
                                                        <a
                                                            href={order.product_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            Q
                                                        </a>
                                                    )}
                                                    <a
                                                        href={`https://business.allegro.pl/listing?string=${order.gtin}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-orange-600 hover:underline"
                                                    >
                                                        A
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className="font-medium">{order.sales_quantity ?? '-'}</div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className="whitespace-nowrap">{Number(order.buy_price).toFixed(2)}</div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <a
                                                    href={`/products/allegro?gtin=${order.gtin}`}
                                                    className="text-blue-600 hover:underline whitespace-nowrap"
                                                >
                                                    {order.allegro_price ? Number(order.allegro_price).toFixed(2) : '-'}
                                                </a>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                {isEditing ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={editValues.manualPrice}
                                                            onChange={(e) => setEditValues(prev => ({ ...prev, manualPrice: e.target.value }))}
                                                            className="w-20 px-1 py-1 border rounded text-right"
                                                            placeholder="PLN"
                                                            data-gtin={order.gtin}
                                                        />
                                                        <span className="text-xs text-gray-500">PLN</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`whitespace-nowrap ${order.manual_price ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                                            {order.manual_price ? Number(order.manual_price).toFixed(2) : '-'}
                                                        </span>
                                                        {order.manual_price && (
                                                            <span className="text-xs text-gray-500">
                                                                {(Number(order.manual_price) * plnToEurRate).toFixed(0)}z
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className={`whitespace-nowrap ${order.unit_profit > 0 ? 'text-green-600 font-medium' : 'text-red-600'}`}>
                                                    {Number(order.unit_profit).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className={`whitespace-nowrap ${order.profit_ratio > 0 ? 'text-green-600 font-medium' : 'text-red-600'}`}>
                                                    {Number(order.profit_ratio).toFixed(1)}%
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div>{order.inventory}</div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className="whitespace-nowrap">{Number(order.total_cost).toFixed(0)}</div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className={`whitespace-nowrap ${order.total_profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {Number(order.total_profit).toFixed(0)}
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className="font-medium whitespace-nowrap">{Number(order.cumulative_cost).toFixed(0)}</div>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className={`font-medium whitespace-nowrap ${order.cumulative_profit > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {Number(order.cumulative_profit).toFixed(0)}
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle text-center">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(order.gtin)}
                                                            data-gtin={order.gtin}
                                                            className="px-2 py-1 h-7"
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="px-2 py-1 h-7"
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
                                                            className="px-2 py-1 h-7"
                                                        >
                                                            Edit
                                                        </Button>
                                                        {order.manual_price && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(order.gtin)}
                                                                className="px-2 py-1 h-7"
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
                                    <td colSpan={18} className="h-24 text-center">
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
