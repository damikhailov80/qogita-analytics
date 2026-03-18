export type Entity = {
    name: string;
    product_count: number;
};

export type ListType = 'blacklist' | 'whitelist';

export interface EntityFilterConfig {
    apiEndpoint: string;
    entityName: string;
    entityNamePlural: string;
    blacklistTitle: string;
    whitelistTitle: string;
    entityKey: 'brands' | 'categories';
}
