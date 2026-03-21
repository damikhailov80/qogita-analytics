import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FilterState {
    whiteList: string[];
    blackList: string[];
    productRange: [number, number];
    searchAvailable: string;
    searchList: string;
}

export interface GlobalFiltersState {
    onlyAllegro: boolean;
}

export type FilterEntity = 'brands' | 'categories';

export interface FiltersState {
    brands: FilterState;
    categories: FilterState;
    global: GlobalFiltersState;
}

const initialFilterState: FilterState = {
    whiteList: [],
    blackList: [],
    productRange: [0, 100],
    searchAvailable: '',
    searchList: '',
};

const initialState: FiltersState = {
    brands: initialFilterState,
    categories: initialFilterState,
    global: {
        onlyAllegro: false,
    },
};

const filterSlice = createSlice({
    name: 'filters',
    initialState,
    reducers: {
        setWhiteList: (state, action: PayloadAction<{ entity: FilterEntity; list: string[] }>) => {
            state[action.payload.entity].whiteList = action.payload.list;
        },
        setBlackList: (state, action: PayloadAction<{ entity: FilterEntity; list: string[] }>) => {
            state[action.payload.entity].blackList = action.payload.list;
        },
        setProductRange: (state, action: PayloadAction<{ entity: FilterEntity; range: [number, number] }>) => {
            state[action.payload.entity].productRange = action.payload.range;
        },
        setSearchAvailable: (state, action: PayloadAction<{ entity: FilterEntity; search: string }>) => {
            state[action.payload.entity].searchAvailable = action.payload.search;
        },
        setSearchList: (state, action: PayloadAction<{ entity: FilterEntity; search: string }>) => {
            state[action.payload.entity].searchList = action.payload.search;
        },
        clearFilters: (state, action: PayloadAction<FilterEntity>) => {
            state[action.payload] = initialFilterState;
        },
        clearAllFilters: (state) => {
            state.brands = initialFilterState;
            state.categories = initialFilterState;
            state.global.onlyAllegro = false;
        },
        setOnlyAllegro: (state, action: PayloadAction<boolean>) => {
            state.global.onlyAllegro = action.payload;
        },
    },
});

export const {
    setWhiteList,
    setBlackList,
    setProductRange,
    setSearchAvailable,
    setSearchList,
    clearFilters,
    clearAllFilters,
    setOnlyAllegro,
} = filterSlice.actions;

export default filterSlice.reducer;
