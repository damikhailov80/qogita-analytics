import { useState, useEffect } from 'react';
import type { Brand } from './types';

export function useBrandFilter(onFilterChange?: (whiteList: string[], blackList: string[]) => void) {
    const [brands, setBrands] = useState<Brand[]>([]);
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
        const fetchBrands = async () => {
            try {
                const response = await fetch('/api/brands');
                const data: Brand[] = await response.json();
                setBrands(data);

                const maxCount = Math.max(...data.map(brand => brand.product_count));
                setMaxProductCount(maxCount);
                setBlacklistProductRange([0, maxCount]);
                setWhitelistProductRange([0, maxCount]);
            } catch (error) {
                console.error('Error fetching brands:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, []);

    const addToBlackList = () => {
        const newBlackList = new Set([...blackList, ...selectedFromAvailableForBlacklist]);
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedFromAvailableForBlacklist.has(brand)));

        setBlackList(newBlackList);
        setWhiteList(newWhiteList);
        setSelectedFromAvailableForBlacklist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromBlackList = () => {
        const newBlackList = new Set([...blackList].filter(brand => !selectedFromBlackList.has(brand)));
        setBlackList(newBlackList);
        setSelectedFromBlackList(new Set());

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    const addToWhiteList = () => {
        const newWhiteList = new Set([...whiteList, ...selectedFromAvailableForWhitelist]);
        const newBlackList = new Set([...blackList].filter(brand => !selectedFromAvailableForWhitelist.has(brand)));

        setWhiteList(newWhiteList);
        setBlackList(newBlackList);
        setSelectedFromAvailableForWhitelist(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(newBlackList));
    };

    const removeFromWhiteList = () => {
        const newWhiteList = new Set([...whiteList].filter(brand => !selectedFromWhiteList.has(brand)));
        setWhiteList(newWhiteList);
        setSelectedFromWhiteList(new Set());

        onFilterChange?.(Array.from(newWhiteList), Array.from(blackList));
    };

    const removeSingleFromBlackList = (brandName: string) => {
        const newBlackList = new Set(blackList);
        newBlackList.delete(brandName);
        setBlackList(newBlackList);

        onFilterChange?.(Array.from(whiteList), Array.from(newBlackList));
    };

    const removeSingleFromWhiteList = (brandName: string) => {
        const newWhiteList = new Set(whiteList);
        newWhiteList.delete(brandName);
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
        brands,
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
