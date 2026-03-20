'use client';

import { EntityFilter } from './entity-filter/entity-filter';
import type { EntityFilterConfig } from './entity-filter/types';

interface CategoryFilterProps {
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
    className?: string;
}

const categoryFilterConfig: EntityFilterConfig = {
    apiEndpoint: '/api/categories',
    entityName: 'категория',
    entityNamePlural: 'категорий',
    blacklistTitle: 'Черный список (исключить из поиска)',
    whitelistTitle: 'Белый список (включить в поиск)',
    entityKey: 'categories',
};

export function CategoryFilter({ onFilterChange, className }: CategoryFilterProps) {
    return <EntityFilter config={categoryFilterConfig} onFilterChange={onFilterChange} className={className} />;
}
