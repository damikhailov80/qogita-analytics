import { BrandItem } from './brand-item';
import { BrandListHeader } from './brand-list-header';
import type { Brand } from './types';

interface BrandListProps {
    title: string;
    brands: Brand[];
    selectedBrands: Set<string>;
    searchValue: string;
    onSearchChange: (value: string) => void;
    onToggle: (brandName: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onRemove?: (brandName: string) => void;
    variant?: 'default' | 'blacklist' | 'whitelist';
    color?: 'gray' | 'red' | 'green';
    searchPlaceholder?: string;
    emptyMessage?: string;
    emptySearchMessage?: string;
}

export function BrandList({
    title,
    brands,
    selectedBrands,
    searchValue,
    onSearchChange,
    onToggle,
    onSelectAll,
    onClearSelection,
    onRemove,
    variant = 'default',
    color = 'gray',
    searchPlaceholder = 'Поиск брендов...',
    emptyMessage = 'Пусто',
    emptySearchMessage = 'Нет результатов поиска',
}: BrandListProps) {
    const ringColor = color === 'red' ? 'focus:ring-red-500' : color === 'green' ? 'focus:ring-green-500' : 'focus:ring-blue-500';

    return (
        <div className="lg:col-span-2">
            <BrandListHeader
                title={title}
                count={brands.length}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                hasItems={brands.length > 0}
                hasSelection={selectedBrands.size > 0}
                color={color}
            />
            <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className={`w-full px-3 py-1 text-sm border rounded mb-2 focus:outline-none focus:ring-2 ${ringColor}`}
            />
            <div className="h-64 overflow-y-auto border rounded p-2 bg-white">
                {brands.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        {searchValue ? emptySearchMessage : emptyMessage}
                    </p>
                ) : (
                    <div className="space-y-1">
                        {brands.map((brand) => (
                            <BrandItem
                                key={brand.name}
                                brand={brand}
                                isSelected={selectedBrands.has(brand.name)}
                                onToggle={onToggle}
                                onRemove={onRemove}
                                variant={variant}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
