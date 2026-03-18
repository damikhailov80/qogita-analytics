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
    const [selectedFromAvailableForBlacklist, setSelectedFromAvailableForBlacklist] = useState<Set<string>>(new Set());
    const [selectedFromBlackList, setSelectedFromBlackList] = useState<Set<string>>(new Set());
    const [blackList, setBlackList] = useState<Set<string>>(new Set());
    const [blacklistProductRange, setBlacklistProductRange] = useState<[number, number]>([0, 100]);

    // Состояние для белого списка
    const [selectedFromAvailableForWhitelist, setSelectedFromAvailableForWhitelist] = useState<Set<string>>(new Set());
    const [selectedFromWhiteList, setSelectedFromWhiteList] = useState<Set<string>>(new Set());
    const [whiteList, setWhiteList] = useState<Set<string>>(new Set());
    const [whitelistProductRange, setWhitelistProductRange] = useState<[number, number]>([0, 100]);

    const [maxProductCount, setMaxProductCount] = useState(100);

    // Состояние для поиска по имени
    const [searchAvailableForBlacklist, setSearchAvailableForBlacklist] = useState('');
    const [searchBlackList, setSearchBlackList] = useState('');
    const [searchAvailableForWhitelist, setSearchAvailableForWhitelist] = useState('');
    const [searchWhiteList, setSearchWhiteList] = useState('');

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
            !whiteList.has(brand.name) &&
            brand.name.toLowerCase().includes(searchAvailableForBlacklist.toLowerCase())
    );

    // Фильтруем бренды для белого списка (исключаем уже добавленные в любой список)
    const filteredBrandsForWhitelist = brands.filter(
        brand => brand.product_count >= whitelistProductRange[0] &&
            brand.product_count <= whitelistProductRange[1] &&
            !blackList.has(brand.name) &&
            !whiteList.has(brand.name) &&
            brand.name.toLowerCase().includes(searchAvailableForWhitelist.toLowerCase())
    );

    // Фильтруем черный список по поиску
    const filteredBlackList = Array.from(blackList).filter(brandName =>
        brandName.toLowerCase().includes(searchBlackList.toLowerCase())
    );

    // Фильтруем белый список по поиску
    const filteredWhiteList = Array.from(whiteList).filter(brandName =>
        brandName.toLowerCase().includes(searchWhiteList.toLowerCase())
    );

    // Обработка выбора брендов из доступных для черного списка
    const handleAvailableBrandToggleForBlacklist = (brandName: string) => {
        const newSelected = new Set(selectedFromAvailableForBlacklist);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedFromAvailableForBlacklist(newSelected);
    };

    // Обработка выбора брендов из черного списка
    const handleBlackListBrandToggle = (brandName: string) => {
        const newSelected = new Set(selectedFromBlackList);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedFromBlackList(newSelected);
    };

    // Обработка выбора брендов из доступных для белого списка
    const handleAvailableBrandToggleForWhitelist = (brandName: string) => {
        const newSelected = new Set(selectedFromAvailableForWhitelist);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedFromAvailableForWhitelist(newSelected);
    };

    // Обработка выбора брендов из белого списка
    const handleWhiteListBrandToggle = (brandName: string) => {
        const newSelected = new Set(selectedFromWhiteList);
        if (newSelected.has(brandName)) {
            newSelected.delete(brandName);
        } else {
            newSelected.add(brandName);
        }
        setSelectedFromWhiteList(newSelected);
    };

    // Добавление выбранных брендов в черный список
    const handleAddToBlackList = () => {
        const newBlackList = new Set([...blackList, ...selectedFromAvailableForBlacklist]);
        // Удаляем из белого списка если есть
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedFromAvailableForBlacklist.has(brand)));

        setBlackList(newBlackList);
        setWhiteList(newWhiteList);
        setSelectedFromAvailableForBlacklist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    // Удаление выбранных брендов из черного списка
    const handleRemoveFromBlackList = () => {
        const newBlackList = new Set([...blackList].filter(brand => !selectedFromBlackList.has(brand)));
        setBlackList(newBlackList);
        setSelectedFromBlackList(new Set());

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    // Добавление выбранных брендов в белый список
    const handleAddToWhiteList = () => {
        const newWhiteList = new Set([...whiteList, ...selectedFromAvailableForWhitelist]);
        // Удаляем из черного списка если есть
        const newBlackList = new Set([...blackList].filter(brand => !selectedFromAvailableForWhitelist.has(brand)));

        setWhiteList(newWhiteList);
        setBlackList(newBlackList);
        setSelectedFromAvailableForWhitelist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    // Удаление выбранных брендов из белого списка
    const handleRemoveFromWhiteList = () => {
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedFromWhiteList.has(brand)));
        setWhiteList(newWhiteList);
        setSelectedFromWhiteList(new Set());

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

    // Выбор всех брендов для черного списка
    const handleSelectAllForBlacklist = () => {
        const allFiltered = new Set(filteredBrandsForBlacklist.map(brand => brand.name));
        setSelectedFromAvailableForBlacklist(allFiltered);
    };

    // Выбор всех брендов для белого списка
    const handleSelectAllForWhitelist = () => {
        const allFiltered = new Set(filteredBrandsForWhitelist.map(brand => brand.name));
        setSelectedFromAvailableForWhitelist(allFiltered);
    };

    // Выбор всех брендов в черном списке
    const handleSelectAllInBlackList = () => {
        const allInBlackList = new Set(filteredBlackList);
        setSelectedFromBlackList(allInBlackList);
    };

    // Выбор всех брендов в белом списке
    const handleSelectAllInWhiteList = () => {
        const allInWhiteList = new Set(filteredWhiteList);
        setSelectedFromWhiteList(allInWhiteList);
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

    // Очистка белого списка
    const handleClearWhiteList = () => {
        setSelectedFromAvailableForWhitelist(new Set());
        setSelectedFromWhiteList(new Set());
        setWhiteList(new Set());
        onFilterChange?.([], Array.from(blackList));
    };

    // Очистка черного списка
    const handleClearBlackList = () => {
        setSelectedFromAvailableForBlacklist(new Set());
        setSelectedFromBlackList(new Set());
        setBlackList(new Set());
        onFilterChange?.(Array.from(whiteList), []);
    };

    return (
        <div className={`p-4 border rounded-lg bg-white ${className}`}>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* ГРУППА 1: Черный список */}
                <div className="border rounded-lg p-4 bg-red-50">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-medium text-red-700">
                            Черный список (исключить из поиска)
                        </h4>
                        <button
                            onClick={handleClearBlackList}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                            Очистить черный список
                        </button>
                    </div>

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
                                <h5 className="text-sm font-medium text-gray-700">Все бренды ({filteredBrandsForBlacklist.length})</h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllForBlacklist}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={filteredBrandsForBlacklist.length === 0}
                                        title="Выбрать все доступные бренды"
                                    >
                                        Все
                                    </button>
                                    <button
                                        onClick={() => setSelectedFromAvailableForBlacklist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedFromAvailableForBlacklist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Поиск брендов..."
                                value={searchAvailableForBlacklist}
                                onChange={(e) => setSearchAvailableForBlacklist(e.target.value)}
                                className="w-full px-3 py-1 text-sm border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
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
                                                className={`cursor-pointer p-2 rounded text-sm transition-colors ${selectedFromAvailableForBlacklist.has(brand.name)
                                                    ? 'bg-blue-100 border border-blue-300'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                                onClick={() => handleAvailableBrandToggleForBlacklist(brand.name)}
                                            >
                                                {brand.name} ({brand.product_count})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Кнопки между списками */}
                        <div className="flex flex-col justify-center items-center gap-3 h-64">
                            <button
                                onClick={handleAddToBlackList}
                                className="w-12 h-12 flex items-center justify-center text-xl bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                disabled={selectedFromAvailableForBlacklist.size === 0}
                                title="Добавить выбранные в черный список"
                            >
                                →
                            </button>
                            <button
                                onClick={handleRemoveFromBlackList}
                                className="w-12 h-12 flex items-center justify-center text-xl bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                disabled={selectedFromBlackList.size === 0}
                                title="Удалить выбранные из черного списка"
                            >
                                ←
                            </button>
                        </div>

                        {/* Черный список */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-red-700">
                                    Черный список ({filteredBlackList.length})
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
                                        onClick={() => setSelectedFromBlackList(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedFromBlackList.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Поиск в черном списке..."
                                value={searchBlackList}
                                onChange={(e) => setSearchBlackList(e.target.value)}
                                className="w-full px-3 py-1 text-sm border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {filteredBlackList.length === 0 ? (
                                    <p className="text-gray-500 text-sm">
                                        {blackList.size === 0 ? 'Пусто' : 'Нет результатов поиска'}
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredBlackList.map((brandName) => {
                                            const brand = brands.find(b => b.name === brandName);
                                            return (
                                                <div
                                                    key={brandName}
                                                    className={`cursor-pointer p-2 rounded text-sm transition-colors border border-red-200 ${selectedFromBlackList.has(brandName)
                                                        ? 'bg-blue-100 border-blue-300'
                                                        : 'bg-red-100 hover:bg-red-200'
                                                        }`}
                                                    onClick={() => handleBlackListBrandToggle(brandName)}
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
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-medium text-green-700">
                            Белый список (включить в поиск)
                        </h4>
                        <button
                            onClick={handleClearWhiteList}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                            Очистить белый список
                        </button>
                    </div>

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
                                <h5 className="text-sm font-medium text-gray-700">Все бренды ({filteredBrandsForWhitelist.length})</h5>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleSelectAllForWhitelist}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        disabled={filteredBrandsForWhitelist.length === 0}
                                        title="Выбрать все доступные бренды"
                                    >
                                        Все
                                    </button>
                                    <button
                                        onClick={() => setSelectedFromAvailableForWhitelist(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedFromAvailableForWhitelist.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Поиск брендов..."
                                value={searchAvailableForWhitelist}
                                onChange={(e) => setSearchAvailableForWhitelist(e.target.value)}
                                className="w-full px-3 py-1 text-sm border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
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
                                                className={`cursor-pointer p-2 rounded text-sm transition-colors ${selectedFromAvailableForWhitelist.has(brand.name)
                                                    ? 'bg-blue-100 border border-blue-300'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                                onClick={() => handleAvailableBrandToggleForWhitelist(brand.name)}
                                            >
                                                {brand.name} ({brand.product_count})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Кнопки между списками */}
                        <div className="flex flex-col justify-center items-center gap-3 h-64">
                            <button
                                onClick={handleAddToWhiteList}
                                className="w-12 h-12 flex items-center justify-center text-xl bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                disabled={selectedFromAvailableForWhitelist.size === 0}
                                title="Добавить выбранные в белый список"
                            >
                                →
                            </button>
                            <button
                                onClick={handleRemoveFromWhiteList}
                                className="w-12 h-12 flex items-center justify-center text-xl bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                disabled={selectedFromWhiteList.size === 0}
                                title="Удалить выбранные из белого списка"
                            >
                                ←
                            </button>
                        </div>

                        {/* Белый список */}
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="text-sm font-medium text-green-700">
                                    Белый список ({filteredWhiteList.length})
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
                                        onClick={() => setSelectedFromWhiteList(new Set())}
                                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                        disabled={selectedFromWhiteList.size === 0}
                                        title="Снять выбор"
                                    >
                                        Снять
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Поиск в белом списке..."
                                value={searchWhiteList}
                                onChange={(e) => setSearchWhiteList(e.target.value)}
                                className="w-full px-3 py-1 text-sm border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                                {filteredWhiteList.length === 0 ? (
                                    <p className="text-gray-500 text-sm">
                                        {whiteList.size === 0 ? 'Пусто' : 'Нет результатов поиска'}
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredWhiteList.map((brandName) => {
                                            const brand = brands.find(b => b.name === brandName);
                                            return (
                                                <div
                                                    key={brandName}
                                                    className={`cursor-pointer p-2 rounded text-sm transition-colors border border-green-200 ${selectedFromWhiteList.has(brandName)
                                                        ? 'bg-blue-100 border-blue-300'
                                                        : 'bg-green-100 hover:bg-green-200'
                                                        }`}
                                                    onClick={() => handleWhiteListBrandToggle(brandName)}
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

            {/* Информация о фильтрах - зарезервированное место */}
            <div className="mt-6 pt-4 border-t h-8 flex items-center">
                {(whiteList.size > 0 || blackList.size > 0) ? (
                    <p className="text-sm text-gray-600">
                        {whiteList.size > 0 && `Включить только: ${whiteList.size} брендов`}
                        {whiteList.size > 0 && blackList.size > 0 && ' | '}
                        {blackList.size > 0 && `Исключить: ${blackList.size} брендов`}
                    </p>
                ) : (
                    <p className="text-sm text-gray-400">Фильтры не применены</p>
                )}
            </div>
        </div>
    );
}