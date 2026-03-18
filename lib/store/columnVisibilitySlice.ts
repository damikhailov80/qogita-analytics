import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { VisibilityState } from '@tanstack/react-table';

export interface ColumnVisibilityState {
    catalog: VisibilityState;
}

const initialState: ColumnVisibilityState = {
    catalog: {},
};

const columnVisibilitySlice = createSlice({
    name: 'columnVisibility',
    initialState,
    reducers: {
        setColumnVisibility: (
            state,
            action: PayloadAction<{ table: keyof ColumnVisibilityState; visibility: VisibilityState }>
        ) => {
            state[action.payload.table] = action.payload.visibility;
        },
        toggleColumn: (
            state,
            action: PayloadAction<{ table: keyof ColumnVisibilityState; columnId: string }>
        ) => {
            const { table, columnId } = action.payload;
            const currentVisibility = state[table][columnId];
            state[table][columnId] = currentVisibility === false ? true : false;
        },
        showAllColumns: (state, action: PayloadAction<keyof ColumnVisibilityState>) => {
            state[action.payload] = {};
        },
        hideAllColumns: (
            state,
            action: PayloadAction<{ table: keyof ColumnVisibilityState; columnIds: string[] }>
        ) => {
            const { table, columnIds } = action.payload;
            const newVisibility: VisibilityState = {};
            columnIds.forEach((id) => {
                newVisibility[id] = false;
            });
            state[table] = newVisibility;
        },
    },
});

export const { setColumnVisibility, toggleColumn, showAllColumns, hideAllColumns } =
    columnVisibilitySlice.actions;

export default columnVisibilitySlice.reducer;
