import { useState, useEffect } from 'react';
import type { Entity } from './types';

export function useEntityFilter(
    apiEndpoint: string,
    onFilterChange?: (whiteList: string[], blackList: string[]) => void
) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFromAvailableForBlacklist, setSelectedFromAvailableForBlacklist] = useState<Set<string>>(new Set());
    const [selectedFromBlackList, setSelectedFromBlackList] = useState<Set<string>>(new Set());
    const [blackList, setBlackList] = useState<Set<string>>(new Set());
    const [blacklistProductRange, setBlacklistProductRange] = useState<[number, number]>([0, 100]);

    const [selectedFromAvailableForWhitelist, setSelectedFromAvailableForWhitelist] = useState<Set<string>>(new Set());
    const [selectedFromWhiteList, setSelectedFromWhiteList] = useState<Set<string>>(new Set());
    const [whiteList, setWhiteList] = useState<Set<string>>(new Set());
    const [whitelistProductRange, setWhitelistProductRange] = useState<[number, number]>([0, 100]);

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
                setBlacklistProductRange([0, maxCount]);
                setWhitelistProductRange([0, maxCount]);
            } catch (error) {
                console.error('Error fetching entities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEntities();
    }, [apiEndpoint]);

    const addToBlackList = () => {
        const newBlackList = new Set([...blackList, ...selectedFromAvailableForBlacklist]);
        const newWhiteList = new Set([...whiteList].filter(entity => !selectedFromAvailableForBlacklist.has(entity)));

        setBlackList(newBlackList);
        setWhiteList(newWhiteList);
        setSelectedFromAvailableForBlacklist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromBlackList = () => {
        const newBlackList = new Set([...blackList].filter(entity => !selectedFromBlackList.has(entity)));
        setBlackList(newBlackList);
        setSelectedFromBlackList(new Set());

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    const addToWhiteList = () => {
        const newWhiteList = new Set([...whiteList, ...selectedFromAvailableForWhitelist]);
        const newBlackList = new Set([...blackList].filter(entity => !selectedFromAvailableForWhitelist.has(entity)));

        setWhiteList(newWhiteList);
        setBlackList(newBlackList);
        setSelectedFromAvailableForWhitelist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromWhiteList = () => {
        const newWhiteList = new Set([...whiteList].filter(entity => !selectedFromWhiteList.has(entity)));
        setWhiteList(newWhiteList);
        setSelectedFromWhiteList(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(blackList));
    };

    const removeSingleFromBlackList = (entityName: string) => {
        const newBlackList = new Set(blackList);
        newBlackList.delete(entityName);
        setBlackList(newBlackList);

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    const removeSingleFromWhiteList = (entityName: string) => {
        const newWhiteList = new Set(whiteList);
        newWhiteList.delete(entityName);
        setWhiteList(newWhiteList);

        onFilterChange?.(Array.from(newWhiteList), Array.from(blackList));
    };

    const clearWhiteList = () => {
        setSelectedFromAvailableForWhitelist(new Set());
        setSelectedFromWhiteList(new Set());
        setWhiteList(new Set());
        onFilterChange?.([], Array.from(blackList));
    };

    const clearBlackList = () => {
        setSelectedFromAvailableForBlacklist(new Set());
        setSelectedFromBlackList(new Set());
        setBlackList(new Set());
        onFilterChange?.(Array.from(whiteList), []);
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
