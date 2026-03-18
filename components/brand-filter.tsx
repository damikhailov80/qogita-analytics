'use client';

import { EntityFilter } from './entity-filter/entity-filter';
import type { EntityFilterConfig } from './entity-filter/types';

interface BrandFilterProps {
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
    className?: string;
}

const brandFilterConfig: EntityFilterConfig = {
    apiEndpoint: '/api/brands',
    entityName: 'бренд',
    entityNamePlural: 'брендов',
    blacklistTitle: 'Черный список (исключить из поиска)',
    whitelistTitle: 'Белый список (включить в поиск)',
    entityKey: 'brands',
};

export function BrandFilter({ onFilterChange, className }: BrandFilterProps) {
    return <EntityFilter config={brandFilterConfig} onFilterChange={onFilterChange} className={className} />;
}
