import { RangeSlider } from '@/components/ui/range-slider';
import { EntityList } from './entity-list';
import type { Entity } from './types';

interface EntityListSectionProps {
    title: string;
    bgColor: string;
    buttonColor: string;
    entities: Entity[];
    availableEntities: Entity[];
    targetList: Set<string>;
    selectedFromAvailable: Set<string>;
    selectedFromList: Set<string>;
    productRange: [number, number];
    maxProductCount: number;
    searchAvailable: string;
    searchList: string;
    onProductRangeChange: (range: [number, number]) => void;
    onSearchAvailableChange: (value: string) => void;
    onSearchListChange: (value: string) => void;
    onToggleAvailable: (entityName: string) => void;
    onToggleList: (entityName: string) => void;
    onSelectAllAvailable: () => void;
    onClearSelectionAvailable: () => void;
    onSelectAllList: () => void;
    onClearSelectionList: () => void;
    onAddToList: () => void;
    onRemoveFromList: () => void;
    onRemoveSingle: (entityName: string) => void;
    onClearList: () => void;
    variant: 'blacklist' | 'whitelist';
    entityNamePlural: string;
}

export function EntityListSection({
    title,
    bgColor,
    buttonColor,
    entities,
    availableEntities,
    targetList,
    selectedFromAvailable,
    selectedFromList,
    productRange,
    maxProductCount,
    searchAvailable,
    searchList,
    onProductRangeChange,
    onSearchAvailableChange,
    onSearchListChange,
    onToggleAvailable,
    onToggleList,
    onSelectAllAvailable,
    onClearSelectionAvailable,
    onSelectAllList,
    onClearSelectionList,
    onAddToList,
    onRemoveFromList,
    onRemoveSingle,
    onClearList,
    variant,
    entityNamePlural,
}: EntityListSectionProps) {
    const color = variant === 'blacklist' ? 'red' : 'green';
    const listTitle = variant === 'blacklist' ? 'Черный список' : 'Белый список';
    const searchListPlaceholder = variant === 'blacklist' ? 'Поиск в черном списке...' : 'Поиск в белом списке...';

    const filteredTargetList = Array.from(targetList)
        .filter(entityName => entityName.toLowerCase().includes(searchList.toLowerCase()))
        .map(entityName => {
            const entity = entities.find(e => e.name === entityName);
            return entity || { name: entityName, product_count: 0 };
        });

    return (
        <div className={`border rounded-lg p-4 ${bgColor}`}>
            <div className="flex justify-between items-center mb-4">
                <h4 className={`text-lg font-medium text-${color}-700`}>
                    {title}
                </h4>
                <button
                    onClick={onClearList}
                    className={`px-3 py-1 text-sm ${buttonColor} text-white rounded hover:opacity-90 transition-colors`}
                >
                    Очистить {variant === 'blacklist' ? 'черный' : 'белый'} список
                </button>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Количество продуктов: {productRange[0]} - {productRange[1]}
                </label>
                <RangeSlider
                    min={0}
                    max={maxProductCount}
                    value={productRange}
                    onChange={onProductRangeChange}
                    step={1}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 items-start">
                <EntityList
                    title={`Все ${entityNamePlural}`}
                    entities={availableEntities}
                    selectedEntities={selectedFromAvailable}
                    searchValue={searchAvailable}
                    onSearchChange={onSearchAvailableChange}
                    onToggle={onToggleAvailable}
                    onSelectAll={onSelectAllAvailable}
                    onClearSelection={onClearSelectionAvailable}
                    emptyMessage="Нет элементов в выбранном диапазоне"
                    searchPlaceholder={`Поиск ${entityNamePlural}...`}
                />

                <div className="flex flex-col justify-center items-center gap-3 h-64">
                    <button
                        onClick={onAddToList}
                        className={`w-12 h-12 flex items-center justify-center text-xl ${buttonColor} text-white rounded-full hover:opacity-90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
                        disabled={selectedFromAvailable.size === 0}
                        title={`Добавить выбранные в ${variant === 'blacklist' ? 'черный' : 'белый'} список`}
                    >
                        →
                    </button>
                    <button
                        onClick={onRemoveFromList}
                        className="w-12 h-12 flex items-center justify-center text-xl bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        disabled={selectedFromList.size === 0}
                        title={`Удалить выбранные из ${variant === 'blacklist' ? 'черного' : 'белого'} списка`}
                    >
                        ←
                    </button>
                </div>

                <EntityList
                    title={listTitle}
                    entities={filteredTargetList}
                    selectedEntities={selectedFromList}
                    searchValue={searchList}
                    onSearchChange={onSearchListChange}
                    onToggle={onToggleList}
                    onSelectAll={onSelectAllList}
                    onClearSelection={onClearSelectionList}
                    onRemove={onRemoveSingle}
                    variant={variant}
                    color={color}
                    searchPlaceholder={searchListPlaceholder}
                />
            </div>
        </div>
    );
}
