'use client';

import { useEffect, useState } from 'react';
import { RangeSlider } from '@/components/ui/range-slider';

type Brand = {
    name: string;
    product_count: number;
};

interface BrandFilterProps {
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
    className?: string;
}

export function BrandFilter({ onFilterChange, className }: BrandFilterProps) {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);

    // Состояние для черного списка
    const [selectedForBlacklist, setSelectedForBlacklist] = useState<Set<string>>(new Set());
    const [blackList, setBlackList] = useState<Set<string>>(new Set());
    const [blacklistProductRange, setBlacklistProductRange] = useState<[number, number]>([0, 100]);

    // Состояние для белого списка
    const [selectedForWhitelist, setSelectedForWhitelist] = useState<Set<string>>(new Set());
    const [whiteList, setWhiteList] = useState<Set<string>>(new Set());
    const [whitelistProductRange, setWhitelistProductRange] = useState<[number, number]>([0, 100]);

    const [maxProductCount, setMaxProductCount] = useState(100);

    // Загружаем данные о брендах
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const response = await fetch('/api/brands');
                const data: Brand[] = await response.json();
                setBrands(data);

                // Устанавливаем максимальное количество продуктов для ползунков
                const maxCount = Math.max(...data.map(brand => brand.product_count));
                setMaxProductCount(maxCount);
                setBlacklistProductRange([0, maxCount]);
                setWhitelistProductRange([0, maxCount]);
            } catch (error) {
                console.error('Error fetching brands:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, []);

    // Фильтруем бренды для черного списка (исключаем уже добавленные в любой список)
    const filteredBrandsForBlacklist = brands.filter(
        brand => brand.product_count >= blacklistProductRange[0] &&
            brand.product_count <= blacklistProductRange[1] &&
            !blackList.has(brand.name) &&
            !whiteList.has(brand.name)
    );

    // Фильтруем бренды для белого списка (исключаем уже добавленные в любой список)
    const filteredBrandsForWhitelist = brands.filter(
        brand => brand.product_count >= whitelistProductRange[0] &&
            brand.product_count <= whitelistProductRange[1] &&
            !blackList.has(brand.name) &&
            !whiteList.has(brand.name)
    );

    // Обработка выбора брендов для черного списка
    const handleBlacklistBrandToggle = (brandName: string) => {
        const newSelected = new Set(selectedForBlacklist);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedForBlacklist(newSelected);
    };

    // Обработка выбора брендов для белого списка
    const handleWhitelistBrandToggle = (brandName: string) => {
        const newSelected = new Set(selectedForWhitelist);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedForWhitelist(newSelected);
    };

    // Добавление выбранных брендов в черный список
    const handleAddToBlackList = () => {
        const newBlackList = new Set([...blackList, ...selectedForBlacklist]);
        // Удаляем из белого списка если есть
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedForBlacklist.has(brand)));

        setBlackList(newBlackList);
        setWhiteList(newWhiteList);
        setSelectedForBlacklist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    // Удаление выбранных брендов из черного списка
    const handleRemoveFromBlackList = () => {
        const newBlackList = new Set([...blackList].filter(brand => !selectedForBlacklist.has(brand)));
        setBlackList(newBlackList);
        setSelectedForBlacklist(new Set());

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    // Добавление выбранных брендов в белый список
    const handleAddToWhiteList = () => {
        const newWhiteList = new Set([...whiteList, ...selectedForWhitelist]);
        // Удаляем из черного списка если есть
        const newBlackList = new Set([...blackList].filter(brand => !selectedForWhitelist.has(brand)));

        setWhiteList(newWhiteList);
        setBlackList(newBlackList);
        setSelectedForWhitelist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    // Удаление выбранных брендов из белого списка
    const handleRemoveFromWhiteList = () => {
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedForWhitelist.has(brand)));
        setWhiteList(newWhiteList);
        setSelectedForWhitelist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(blackList));
    };

    // Удаление одного бренда из черного списка
    const handleRemoveSingleFromBlackList = (brandName: string) => {
        const newBlackList = new Set(blackList);
        newBlackList.delete(brandName);
        setBlackList(newBlackList);

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    // Удаление одного бренда из белого списка
    const handleRemoveSingleFromWhiteList = (brandName: string) => {
        const newWhiteList = new Set(whiteList);
        newWhiteList.delete(brandName);
        setWhiteList(newWhiteList);

        onFilterChange?.(Array.from(newWhiteList), Array.from(blackList));
    };

    // Очистка всех фильтров
    const handleClearAll = () => {
        setSelectedForBlacklist(new Set());
        setSelectedForWhitelist(new Set());
        setWhiteList(new Set());
        setBlackList(new Set());
        onFilterChange?.([], []);
    };

    // Выбор всех брендов для черного списка
    const handleSelectAllForBlacklist = () => {
        const allFiltered = new Set(filteredBrandsForBlacklist.map(brand => brand.name));
        setSelectedForBlacklist(allFiltered);
    };

    // Выбор всех брендов для белого списка
    const handleSelectAllForWhitelist = () => {
        const allFiltered = new Set(filteredBrandsForWhitelist.map(brand => brand.name));
        setSelectedForWhitelist(allFiltered);
    };

    // Выбор всех брендов в черном списке
    const handleSelectAllInBlackList = () => {
        const allInBlackList = new Set(Array.from(blackList));
        setSelectedForBlacklist(allInBlackList);
    };

    // Выбор всех брендов в белом списке
    const handleSelectAllInWhiteList = () => {
        const allInWhiteList = new Set(Array.from(whiteList));
        setSelectedForWhitelist(allInWhiteList);
    };

    if (loading) {
        return (
            <div className={`p-4 border rounded-lg bg-white ${className}`}>
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-4 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-4 border rounded-lg bg-white ${className}`}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Фильтр по брендам</h3>

                {/* Кнопка очистки всех фильтров */}
                <div className="mb-4">
                    <button
                        onClick={handleClearAll}
                        className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors"
                    >
                        Очистить все фильтры
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* ГРУППА 1: Черный список */}
                <div className="border rounded-lg p-4 bg-red-50">
                    <h4 className="text-lg font-medium text-red-700 mb-4">
                        Черный список (исключить из поиска)
                    </h4>

                    {/* Ползунок для черного списка */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Количество продуктов: {blacklistProductRange[0]} - {blacklistProductRange[1]}
                        </label>
                        <RangeSlider
                            min={0}
                            max={maxProductCount}
                            value={blacklistProductRange}
                            onChange={setBlacklistProductRange}
                            step={1}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 items-start">
                        {/* Список всех брендов для черного списка */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-gray-700">Все бренды</h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllForBlacklist}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={filteredBrandsForBlacklist.length === 0}
                                        title="Выбрать все доступные бренды"
                                    >
                                        Все ({filteredBrandsForBlacklist.length})
                                    </button>
                                    <button
                                        onClick={() => setSelectedForBlacklist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedForBlacklist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять ({selectedForBlacklist.size})
                                    </button>
                                </div>
                            </div>
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {filteredBrandsForBlacklist.length === 0 ? (
                                    <p className="text-gray-500 text-sm">
                                        Нет брендов в выбранном диапазоне
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredBrandsForBlacklist.map((brand) => (
                                            <div
                                                key={brand.name}
                                                className={`cursor-pointer p-2 rounded text-sm transition-colors ${selectedForBlacklist.has(brand.name)
                                                    ? 'bg-blue-100 border border-blue-300'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                                onClick={() => handleBlacklistBrandToggle(brand.name)}
                                            >
                                                {brand.name} ({brand.product_count})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Кнопки между списками */}
                        <div className="flex flex-col justify-center items-center gap-2 py-8">
                            <button
                                onClick={handleAddToBlackList}
                                className="px-4 py-2 text-lg bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled={selectedForBlacklist.size === 0}
                                title="Добавить выбранные в черный список"
                            >
                                ⇒
                            </button>
                            <button
                                onClick={handleRemoveFromBlackList}
                                className="px-4 py-2 text-lg bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled={selectedForBlacklist.size === 0}
                                title="Удалить выбранные из черного списка"
                            >
                                ⇐
                            </button>
                        </div>

                        {/* Черный список */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-red-700">
                                    Черный список ({blackList.size})
                                </h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllInBlackList}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={blackList.size === 0}
                                        title="Выбрать все в черном списке"
                                    >
                                        Все
                                    </button>
                                    <button
                                        onClick={() => setSelectedForBlacklist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedForBlacklist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {blackList.size === 0 ? (
                                    <p className="text-gray-500 text-sm">Пусто</p>
                                ) : (
                                    <div className="space-y-1">
                                        {Array.from(blackList).map((brandName) => {
                                            const brand = brands.find(b => b.name === brandName);
                                            return (
                                                <div
                                                    key={brandName}
                                                    className={`cursor-pointer p-2 rounded text-sm transition-colors border border-red-200 ${selectedForBlacklist.has(brandName)
                                                        ? 'bg-blue-100 border-blue-300'
                                                        : 'bg-red-100 hover:bg-red-200'
                                                        }`}
                                                    onClick={() => handleBlacklistBrandToggle(brandName)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-red-700 line-through">
                                                            {brandName} ({brand?.product_count || 0})
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveSingleFromBlackList(brandName);
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ГРУППА 2: Белый список */}
                <div className="border rounded-lg p-4 bg-green-50">
                    <h4 className="text-lg font-medium text-green-700 mb-4">
                        Белый список (включить в поиск)
                    </h4>

                    {/* Ползунок для белого списка */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Количество продуктов: {whitelistProductRange[0]} - {whitelistProductRange[1]}
                        </label>
                        <RangeSlider
                            min={0}
                            max={maxProductCount}
                            value={whitelistProductRange}
                            onChange={setWhitelistProductRange}
                            step={1}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 items-start">
                        {/* Список всех брендов для белого списка */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-gray-700">Все бренды</h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllForWhitelist}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={filteredBrandsForWhitelist.length === 0}
                                        title="Выбрать все доступные бренды"
                                    >
                                        Все ({filteredBrandsForWhitelist.length})
                                    </button>
                                    <button
                                        onClick={() => setSelectedForWhitelist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedForWhitelist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять ({selectedForWhitelist.size})
                                    </button>
                                </div>
                            </div>
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {filteredBrandsForWhitelist.length === 0 ? (
                                    <p className="text-gray-500 text-sm">
                                        Нет брендов в выбранном диапазоне
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredBrandsForWhitelist.map((brand) => (
                                            <div
                                                key={brand.name}
                                                className={`cursor-pointer p-2 rounded text-sm transition-colors ${selectedForWhitelist.has(brand.name)
                                                    ? 'bg-blue-100 border border-blue-300'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                                onClick={() => handleWhitelistBrandToggle(brand.name)}
                                            >
                                                {brand.name} ({brand.product_count})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Кнопки между списками */}
                        <div className="flex flex-col justify-center items-center gap-2 py-8">
                            <button
                                onClick={handleAddToWhiteList}
                                className="px-4 py-2 text-lg bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled={selectedForWhitelist.size === 0}
                                title="Добавить выбранные в белый список"
                            >
                                ⇒
                            </button>
                            <button
                                onClick={handleRemoveFromWhiteList}
                                className="px-4 py-2 text-lg bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled={selectedForWhitelist.size === 0}
                                title="Удалить выбранные из белого списка"
                            >
                                ⇐
                            </button>
                        </div>

                        {/* Белый список */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-green-700">
                                    Белый список ({whiteList.size})
                                </h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllInWhiteList}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={whiteList.size === 0}
                                        title="Выбрать все в белом списке"
                                    >
                                        Все
                                    </button>
                                    <button
                                        onClick={() => setSelectedForWhitelist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedForWhitelist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {whiteList.size === 0 ? (
                                    <p className="text-gray-500 text-sm">Пусто</p>
                                ) : (
                                    <div className="space-y-1">
                                        {Array.from(whiteList).map((brandName) => {
                                            const brand = brands.find(b => b.name === brandName);
                                            return (
                                                <div
                                                    key={brandName}
                                                    className={`cursor-pointer p-2 rounded text-sm transition-colors border border-green-200 ${selectedForWhitelist.has(brandName)
                                                        ? 'bg-blue-100 border-blue-300'
                                                        : 'bg-green-100 hover:bg-green-200'
                                                        }`}
                                                    onClick={() => handleWhitelistBrandToggle(brandName)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-green-700 font-medium">
                                                            {brandName} ({brand?.product_count || 0})
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveSingleFromWhiteList(brandName);
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Информация о фильтрах */}
            {(whiteList.size > 0 || blackList.size > 0) && (
                <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                        {whiteList.size > 0 && `Включить только: ${whiteList.size} брендов`}
                        {whiteList.size > 0 && blackList.size > 0 && ' | '}
                        {blackList.size > 0 && `Исключить: ${blackList.size} брендов`}
                    </p>
                </div>
            )}
        </div>
    );
}