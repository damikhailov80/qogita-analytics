import { EntityItem } from './entity-item';
import { EntityListHeader } from './entity-list-header';
import type { Entity } from './types';

interface EntityListProps {
    title: string;
    entities: Entity[];
    selectedEntities: Set<string>;
    searchValue: string;
    onSearchChange: (value: string) => void;
    onToggle: (entityName: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onRemove?: (entityName: string) => void;
    variant?: 'default' | 'blacklist' | 'whitelist';
    color?: 'gray' | 'red' | 'green';
    searchPlaceholder?: string;
    emptyMessage?: string;
    emptySearchMessage?: string;
}

export function EntityList({
    title,
    entities,
    selectedEntities,
    searchValue,
    onSearchChange,
    onToggle,
    onSelectAll,
    onClearSelection,
    onRemove,
    variant = 'default',
    color = 'gray',
    searchPlaceholder = 'Поиск...',
    emptyMessage = 'Пусто',
    emptySearchMessage = 'Нет результатов поиска',
}: EntityListProps) {
    const ringColor = color === 'red' ? 'focus:ring-red-500' : color === 'green' ? 'focus:ring-green-500' : 'focus:ring-blue-500';

    return (
        <div className="lg:col-span-2">
            <EntityListHeader
                title={title}
                count={entities.length}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                hasItems={entities.length > 0}
                hasSelection={selectedEntities.size > 0}
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
                {entities.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        {searchValue ? emptySearchMessage : emptyMessage}
                    </p>
                ) : (
                    <div className="space-y-1">
                        {entities.map((entity) => (
                            <EntityItem
                                key={entity.name}
                                entity={entity}
                                isSelected={selectedEntities.has(entity.name)}
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
