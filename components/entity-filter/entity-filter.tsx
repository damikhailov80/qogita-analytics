'use client';

import { useEntityFilterWithRedux } from './use-entity-filter-with-redux';
import { EntityListSection } from './entity-list-section';
import type { EntityFilterConfig } from './types';

interface EntityFilterProps {
    config: EntityFilterConfig;
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
    className?: string;
}

export function EntityFilter({ config, onFilterChange, className }: EntityFilterProps) {
    const { entities, loading, maxProductCount, blacklist, whitelist } = useEntityFilterWithRedux(
        config.apiEndpoint,
        config.entityKey,
        onFilterChange
    );

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

    const filteredEntitiesForBlacklist = entities.filter(
        entity => entity.product_count >= blacklist.productRange[0] &&
            entity.product_count <= blacklist.productRange[1] &&
            !blacklist.list.has(entity.name) &&
            !whitelist.list.has(entity.name) &&
            entity.name.toLowerCase().includes(blacklist.searchAvailable.toLowerCase())
    );

    const filteredEntitiesForWhitelist = entities.filter(
        entity => entity.product_count >= whitelist.productRange[0] &&
            entity.product_count <= whitelist.productRange[1] &&
            !blacklist.list.has(entity.name) &&
            !whitelist.list.has(entity.name) &&
            entity.name.toLowerCase().includes(whitelist.searchAvailable.toLowerCase())
    );

    const handleToggleAvailableForBlacklist = (entityName: string) => {
        const newSelected = new Set(blacklist.selectedFromAvailable);
        if (newSelected.has(entityName)) {
            newSelected.delete(entityName);
        } else {
            newSelected.add(entityName);
        }
        blacklist.setSelectedFromAvailable(newSelected);
    };

    const handleToggleBlackList = (entityName: string) => {
        const newSelected = new Set(blacklist.selectedFromList);
        if (newSelected.has(entityName)) {
            newSelected.delete(entityName);
        } else {
            newSelected.add(entityName);
        }
        blacklist.setSelectedFromList(newSelected);
    };

    const handleToggleAvailableForWhitelist = (entityName: string) => {
        const newSelected = new Set(whitelist.selectedFromAvailable);
        if (newSelected.has(entityName)) {
            newSelected.delete(entityName);
        } else {
            newSelected.add(entityName);
        }
        whitelist.setSelectedFromAvailable(newSelected);
    };

    const handleToggleWhiteList = (entityName: string) => {
        const newSelected = new Set(whitelist.selectedFromList);
        if (newSelected.has(entityName)) {
            newSelected.delete(entityName);
        } else {
            newSelected.add(entityName);
        }
        whitelist.setSelectedFromList(newSelected);
    };

    const handleSelectAllForBlacklist = () => {
        blacklist.setSelectedFromAvailable(new Set(filteredEntitiesForBlacklist.map(e => e.name)));
    };

    const handleSelectAllInBlackList = () => {
        const filtered = Array.from(blacklist.list).filter(name =>
            name.toLowerCase().includes(blacklist.searchList.toLowerCase())
        );
        blacklist.setSelectedFromList(new Set(filtered));
    };

    const handleSelectAllForWhitelist = () => {
        whitelist.setSelectedFromAvailable(new Set(filteredEntitiesForWhitelist.map(e => e.name)));
    };

    const handleSelectAllInWhiteList = () => {
        const filtered = Array.from(whitelist.list).filter(name =>
            name.toLowerCase().includes(whitelist.searchList.toLowerCase())
        );
        whitelist.setSelectedFromList(new Set(filtered));
    };

    return (
        <div className={`p-4 border rounded-lg bg-white ${className}`}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <EntityListSection
                    title={config.blacklistTitle}
                    bgColor="bg-red-50"
                    buttonColor="bg-red-600 hover:bg-red-700"
                    entities={entities}
                    availableEntities={filteredEntitiesForBlacklist}
                    targetList={blacklist.list}
                    selectedFromAvailable={blacklist.selectedFromAvailable}
                    selectedFromList={blacklist.selectedFromList}
                    productRange={blacklist.productRange}
                    maxProductCount={maxProductCount}
                    searchAvailable={blacklist.searchAvailable}
                    searchList={blacklist.searchList}
                    onProductRangeChange={blacklist.setProductRange}
                    onSearchAvailableChange={blacklist.setSearchAvailable}
                    onSearchListChange={blacklist.setSearchList}
                    onToggleAvailable={handleToggleAvailableForBlacklist}
                    onToggleList={handleToggleBlackList}
                    onSelectAllAvailable={handleSelectAllForBlacklist}
                    onClearSelectionAvailable={() => blacklist.setSelectedFromAvailable(new Set())}
                    onSelectAllList={handleSelectAllInBlackList}
                    onClearSelectionList={() => blacklist.setSelectedFromList(new Set())}
                    onAddToList={blacklist.addTo}
                    onRemoveFromList={blacklist.removeFrom}
                    onRemoveSingle={blacklist.removeSingle}
                    onClearList={blacklist.clear}
                    variant="blacklist"
                    entityNamePlural={config.entityNamePlural}
                />

                <EntityListSection
                    title={config.whitelistTitle}
                    bgColor="bg-green-50"
                    buttonColor="bg-green-600 hover:bg-green-700"
                    entities={entities}
                    availableEntities={filteredEntitiesForWhitelist}
                    targetList={whitelist.list}
                    selectedFromAvailable={whitelist.selectedFromAvailable}
                    selectedFromList={whitelist.selectedFromList}
                    productRange={whitelist.productRange}
                    maxProductCount={maxProductCount}
                    searchAvailable={whitelist.searchAvailable}
                    searchList={whitelist.searchList}
                    onProductRangeChange={whitelist.setProductRange}
                    onSearchAvailableChange={whitelist.setSearchAvailable}
                    onSearchListChange={whitelist.setSearchList}
                    onToggleAvailable={handleToggleAvailableForWhitelist}
                    onToggleList={handleToggleWhiteList}
                    onSelectAllAvailable={handleSelectAllForWhitelist}
                    onClearSelectionAvailable={() => whitelist.setSelectedFromAvailable(new Set())}
                    onSelectAllList={handleSelectAllInWhiteList}
                    onClearSelectionList={() => whitelist.setSelectedFromList(new Set())}
                    onAddToList={whitelist.addTo}
                    onRemoveFromList={whitelist.removeFrom}
                    onRemoveSingle={whitelist.removeSingle}
                    onClearList={whitelist.clear}
                    variant="whitelist"
                    entityNamePlural={config.entityNamePlural}
                />
            </div>

            <div className="mt-6 pt-4 border-t h-8 flex items-center">
                {(whitelist.list.size > 0 || blacklist.list.size > 0) ? (
                    <p className="text-sm text-gray-600">
                        {whitelist.list.size > 0 && `Включить только: ${whitelist.list.size} ${config.entityNamePlural}`}
                        {whitelist.list.size > 0 && blacklist.list.size > 0 && ' | '}
                        {blacklist.list.size > 0 && `Исключить: ${blacklist.list.size} ${config.entityNamePlural}`}
                    </p>
                ) : (
                    <p className="text-sm text-gray-400">Фильтры не применены</p>
                )}
            </div>
        </div>
    );
}
