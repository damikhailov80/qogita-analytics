import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { setWhiteList, setBlackList, type FilterEntity } from '@/lib/store/filterSlice';
import type { Entity } from './types';

export function useEntityFilterWithRedux(
    apiEndpoint: string,
    entityKey: FilterEntity,
    onFilterChange?: (whiteList: string[], blackList: string[]) => void
) {
    const dispatch = useAppDispatch();
    const filterState = useAppSelector((state) => state.filters[entityKey]);

    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFromAvailableForBlacklist, setSelectedFromAvailableForBlacklist] = useState<Set<string>>(new Set());
    const [selectedFromBlackList, setSelectedFromBlackList] = useState<Set<string>>(new Set());
    const [blackList, setBlackListLocal] = useState<Set<string>>(new Set(filterState.blackList));
    const [blacklistProductRange, setBlacklistProductRange] = useState<[number, number]>(filterState.productRange);

    const [selectedFromAvailableForWhitelist, setSelectedFromAvailableForWhitelist] = useState<Set<string>>(new Set());
    const [selectedFromWhiteList, setSelectedFromWhiteList] = useState<Set<string>>(new Set());
    const [whiteList, setWhiteListLocal] = useState<Set<string>>(new Set(filterState.whiteList));
    const [whitelistProductRange, setWhitelistProductRange] = useState<[number, number]>(filterState.productRange);

    const [maxProductCount, setMaxProductCount] = useState(100);

    const [searchAvailableForBlacklist, setSearchAvailableForBlacklist] = useState('');
    const [searchBlackList, setSearchBlackList] = useState('');
    const [searchAvailableForWhitelist, setSearchAvailableForWhitelist] = useState('');
    const [searchWhiteList, setSearchWhiteList] = useState('');

    useEffect(() => {
        const fetchEntities = async () => {
            try {
                const response = await fetch(apiEndpoint);
                const data: Entity[] = await response.json();
                setEntities(data);

                const maxCount = Math.max(...data.map(entity => entity.product_count));
                setMaxProductCount(maxCount);

                // Инициализируем диапазоны из Redux или устанавливаем максимальные
                if (filterState.productRange[1] === 100) {
                    setBlacklistProductRange([0, maxCount]);
                    setWhitelistProductRange([0, maxCount]);
                }
            } catch (error) {
                console.error('Error fetching entities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEntities();
    }, [apiEndpoint, filterState.productRange]);

    // Синхронизируем локальное состояние с Redux при монтировании
    useEffect(() => {
        setBlackListLocal(new Set(filterState.blackList));
        setWhiteListLocal(new Set(filterState.whiteList));
    }, [filterState.blackList, filterState.whiteList]);

    const updateReduxState = (newWhiteList: string[], newBlackList: string[]) => {
        dispatch(setWhiteList({ entity: entityKey, list: newWhiteList }));
        dispatch(setBlackList({ entity: entityKey, list: newBlackList }));
        onFilterChange?.(newWhiteList, newBlackList);
    };

    const addToBlackList = () => {
        const newBlackList = new Set([...blackList, ...selectedFromAvailableForBlacklist]);
        const newWhiteList = new Set([...whiteList].filter(entity => !selectedFromAvailableForBlacklist.has(entity)));

        setBlackListLocal(newBlackList);
        setWhiteListLocal(newWhiteList);
        setSelectedFromAvailableForBlacklist(new Set());

        updateReduxState(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromBlackList = () => {
        const newBlackList = new Set([...blackList].filter(entity => !selectedFromBlackList.has(entity)));
        setBlackListLocal(newBlackList);
        setSelectedFromBlackList(new Set());

        updateReduxState(Array.from(whiteList), Array.from(newBlackList));
    };

    const addToWhiteList = () => {
        const newWhiteList = new Set([...whiteList, ...selectedFromAvailableForWhitelist]);
        const newBlackList = new Set([...blackList].filter(entity => !selectedFromAvailableForWhitelist.has(entity)));

        setWhiteListLocal(newWhiteList);
        setBlackListLocal(newBlackList);
        setSelectedFromAvailableForWhitelist(new Set());

        updateReduxState(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromWhiteList = () => {
        const newWhiteList = new Set([...whiteList].filter(entity => !selectedFromWhiteList.has(entity)));
        setWhiteListLocal(newWhiteList);
        setSelectedFromWhiteList(new Set());

        updateReduxState(Array.from(newWhiteList), Array.from(blackList));
    };

    const removeSingleFromBlackList = (entityName: string) => {
        const newBlackList = new Set(blackList);
        newBlackList.delete(entityName);
        setBlackListLocal(newBlackList);

        updateReduxState(Array.from(whiteList), Array.from(newBlackList));
    };

    const removeSingleFromWhiteList = (entityName: string) => {
        const newWhiteList = new Set(whiteList);
        newWhiteList.delete(entityName);
        setWhiteListLocal(newWhiteList);

        updateReduxState(Array.from(newWhiteList), Array.from(blackList));
    };

    const clearWhiteList = () => {
        setSelectedFromAvailableForWhitelist(new Set());
        setSelectedFromWhiteList(new Set());
        setWhiteListLocal(new Set());
        updateReduxState([], Array.from(blackList));
    };

    const clearBlackList = () => {
        setSelectedFromAvailableForBlacklist(new Set());
        setSelectedFromBlackList(new Set());
        setBlackListLocal(new Set());
        updateReduxState(Array.from(whiteList), []);
    };

    return {
        entities,
        loading,
        maxProductCount,
        blacklist: {
            list: blackList,
            selectedFromAvailable: selectedFromAvailableForBlacklist,
            selectedFromList: selectedFromBlackList,
            productRange: blacklistProductRange,
            searchAvailable: searchAvailableForBlacklist,
            searchList: searchBlackList,
            setSelectedFromAvailable: setSelectedFromAvailableForBlacklist,
            setSelectedFromList: setSelectedFromBlackList,
            setProductRange: setBlacklistProductRange,
            setSearchAvailable: setSearchAvailableForBlacklist,
            setSearchList: setSearchBlackList,
            addTo: addToBlackList,
            removeFrom: removeFromBlackList,
            removeSingle: removeSingleFromBlackList,
            clear: clearBlackList,
        },
        whitelist: {
            list: whiteList,
            selectedFromAvailable: selectedFromAvailableForWhitelist,
            selectedFromList: selectedFromWhiteList,
            productRange: whitelistProductRange,
            searchAvailable: searchAvailableForWhitelist,
            searchList: searchWhiteList,
            setSelectedFromAvailable: setSelectedFromAvailableForWhitelist,
            setSelectedFromList: setSelectedFromWhiteList,
            setProductRange: setWhitelistProductRange,
            setSearchAvailable: setSearchAvailableForWhitelist,
            setSearchList: setSearchWhiteList,
            addTo: addToWhiteList,
            removeFrom: removeFromWhiteList,
            removeSingle: removeSingleFromWhiteList,
            clear: clearWhiteList,
        },
    };
}
