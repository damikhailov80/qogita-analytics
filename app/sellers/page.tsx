'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { setSortBy, toggleSortOrder, type SortField } from '@/lib/store/sellersSlice';

type Seller = {
    seller_code: string;
    positive_items_count: number;
    max_cumulative_profit: number;
    min_order_value: number | null;
    total_positive_sales: number;
};

type ApiResponse = {
    sellers: Seller[];
    sortBy: string;
    count: number;
};

export default function SellersPage() {
    const dispatch = useAppDispatch();
    const { sortBy, sortOrder } = useAppSelector((state) => state.sellers);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const fetchSellers = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/profitable-sellers?sortBy=${sortBy}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result: ApiResponse = await response.json();
                setSellers(result.sellers);
            } catch (error) {
                console.error('Error fetching sellers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSellers();
    }, [sortBy, mounted]);

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            dispatch(toggleSortOrder());
        } else {
            dispatch(setSortBy(field));
        }
    };

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

            // Обновляем данные через небольшой таймаут
            setTimeout(async () => {
                try {
                    const response = await fetch(`/api/profitable-sellers?sortBy=${sortBy}`);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result: ApiResponse = await response.json();
                    setSellers(result.sellers);
                } catch (error) {
                    console.error('Error fetching sellers:', error);
                } finally {
                    setUpdating(false);
                }
            }, 1000);
        } catch (error) {
            console.error('Error refreshing data:', error);
            alert('Ошибка при обновлении данных');
            setUpdating(false);
        }
    };

    const sortedSellers = [...sellers].sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortBy === 'positive_items_count') {
            aValue = a.positive_items_count;
            bValue = b.positive_items_count;
        } else if (sortBy === 'total_positive_sales') {
            aValue = a.total_positive_sales;
            bValue = b.total_positive_sales;
        } else {
            aValue = a.max_cumulative_profit;
            bValue = b.max_cumulative_profit;
        }

        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return (
        <div className="w-full py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Profitable Sellers</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Продавцы с наибольшей прибыльностью из order_candidates
                    </p>
                </div>
                {mounted && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={updating}
                        >
                            {updating ? 'Обновление...' : 'Пересчитать данные'}
                        </Button>
                        <Button
                            variant={sortBy === 'positive_items_count' ? 'default' : 'outline'}
                            onClick={() => handleSort('positive_items_count')}
                        >
                            По количеству товаров
                            {sortBy === 'positive_items_count' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                        </Button>
                        <Button
                            variant={sortBy === 'total_positive_sales' ? 'default' : 'outline'}
                            onClick={() => handleSort('total_positive_sales')}
                        >
                            По продажам
                            {sortBy === 'total_positive_sales' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                        </Button>
                        <Button
                            variant={sortBy === 'max_cumulative_profit' ? 'default' : 'outline'}
                            onClick={() => handleSort('max_cumulative_profit')}
                        >
                            По прибыли
                            {sortBy === 'max_cumulative_profit' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="rounded-md border w-full overflow-hidden">
                <div className="overflow-auto w-full">
                    <table className="w-full border-collapse">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    #
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground border-b">
                                    Seller Code
                                </th>
                                <th
                                    className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('positive_items_count')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Positive Items
                                        {sortBy === 'positive_items_count' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                                    </div>
                                </th>
                                <th
                                    className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('total_positive_sales')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Total Sales Qty
                                        {sortBy === 'total_positive_sales' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                                    </div>
                                </th>
                                <th
                                    className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('max_cumulative_profit')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Max Cumulative Profit
                                        {sortBy === 'max_cumulative_profit' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                                    </div>
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground border-b">
                                    Min Order Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="h-24 text-center">
                                        Loading...
                                    </td>
                                </tr>
                            ) : sellers.length > 0 ? (
                                sortedSellers.map((seller, index) => (
                                    <tr key={seller.seller_code} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">
                                            <div className="text-sm text-gray-500">{index + 1}</div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <a
                                                href={`/sellers/${seller.seller_code}`}
                                                className="font-medium text-blue-600 hover:underline cursor-pointer"
                                            >
                                                {seller.seller_code}
                                            </a>
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="font-medium">{seller.positive_items_count}</div>
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="font-medium text-purple-600">{seller.total_positive_sales}</div>
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="font-medium text-green-600">
                                                €{Number(seller.max_cumulative_profit).toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="font-medium text-blue-600">
                                                {seller.min_order_value ? `€${Number(seller.min_order_value).toFixed(2)}` : '-'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="h-24 text-center">
                                        No sellers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!loading && sellers.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                    Total sellers: {sellers.length}
                </div>
            )}
        </div>
    );
}
