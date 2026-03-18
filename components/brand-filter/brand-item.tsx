import type { Brand } from './types';

interface BrandItemProps {
    brand: Brand;
    isSelected: boolean;
    onToggle: (brandName: string) => void;
    onRemove?: (brandName: string) => void;
    variant?: 'default' | 'blacklist' | 'whitelist';
}

export function BrandItem({ brand, isSelected, onToggle, onRemove, variant = 'default' }: BrandItemProps) {
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
            onClick={() => onToggle(brand.name)}
        >
            <div className="flex items-center justify-between">
                <span className={styles.text}>
                    {brand.name} ({brand.product_count})
                </span>
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(brand.name);
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
