import type { Entity } from './types';

interface EntityItemProps {
    entity: Entity;
    isSelected: boolean;
    onToggle: (entityName: string) => void;
    onRemove?: (entityName: string) => void;
    variant?: 'default' | 'blacklist' | 'whitelist';
}

export function EntityItem({ entity, isSelected, onToggle, onRemove, variant = 'default' }: EntityItemProps) {
    const getStyles = () => {
        if (variant === 'blacklist') {
            return {
                container: `border border-red-200 ${isSelected ? 'bg-blue-100 border-blue-300' : 'bg-red-100 hover:bg-red-200'}`,
                text: 'text-red-700 line-through',
            };
        }
        if (variant === 'whitelist') {
            return {
                container: `border border-green-200 ${isSelected ? 'bg-blue-100 border-blue-300' : 'bg-green-100 hover:bg-green-200'}`,
                text: 'text-green-700 font-medium',
            };
        }
        return {
            container: isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100',
            text: '',
        };
    };

    const styles = getStyles();

    return (
        <div
            className={`cursor-pointer p-2 rounded text-sm transition-colors ${styles.container}`}
            onClick={() => onToggle(entity.name)}
        >
            <div className="flex items-center justify-between">
                <span className={styles.text}>
                    {entity.name} ({entity.product_count})
                </span>
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(entity.name);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
