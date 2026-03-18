interface BrandListHeaderProps {
    title: string;
    count: number;
    onSelectAll: () => void;
    onClearSelection: () => void;
    hasItems: boolean;
    hasSelection: boolean;
    color?: 'gray' | 'red' | 'green';
}

export function BrandListHeader({
    title,
    count,
    onSelectAll,
    onClearSelection,
    hasItems,
    hasSelection,
    color = 'gray'
}: BrandListHeaderProps) {
    const colorClass = color === 'red' ? 'text-red-700' : color === 'green' ? 'text-green-700' : 'text-gray-700';

    return (
        <div className="flex justify-between items-center mb-2">
            <h5 className={`text-sm font-medium ${colorClass}`}>
                {title} ({count})
            </h5>
            <div className="flex gap-1">
                <button
                    onClick={onSelectAll}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    disabled={!hasItems}
                    title="Выбрать все"
                >
                    Все
                </button>
                <button
                    onClick={onClearSelection}
                    className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    disabled={!hasSelection}
                    title="Снять выбор"
                >
                    Снять
                </button>
            </div>
        </div>
    );
}
