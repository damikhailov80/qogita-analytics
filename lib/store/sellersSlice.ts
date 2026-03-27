import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SortField = 'positive_items_count' | 'max_cumulative_profit' | 'total_positive_sales';
export type SortOrder = 'asc' | 'desc';

export interface SellersState {
    sortBy: SortField;
    sortOrder: SortOrder;
}

const getInitialState = (): SellersState => {
    if (typeof window === 'undefined') {
        return {
            sortBy: 'positive_items_count',
            sortOrder: 'desc',
        };
    }

    try {
        const savedState = localStorage.getItem('qogita_filters_state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.sellers) {
                return {
                    sortBy: parsed.sellers.sortBy || 'positive_items_count',
                    sortOrder: parsed.sellers.sortOrder || 'desc',
                };
            }
        }
    } catch (err) {
        console.error('Error loading sellers state from localStorage:', err);
    }

    return {
        sortBy: 'positive_items_count',
        sortOrder: 'desc',
    };
};

const initialState: SellersState = getInitialState();

const sellersSlice = createSlice({
    name: 'sellers',
    initialState,
    reducers: {
        setSortBy: (state, action: PayloadAction<SortField>) => {
            state.sortBy = action.payload;
            state.sortOrder = 'desc'; // Сбрасываем на desc при смене поля
        },
        setSortOrder: (state, action: PayloadAction<SortOrder>) => {
            state.sortOrder = action.payload;
        },
        toggleSortOrder: (state) => {
            state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
        },
    },
});

export const { setSortBy, setSortOrder, toggleSortOrder } = sellersSlice.actions;
export default sellersSlice.reducer;
