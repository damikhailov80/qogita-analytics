import { configureStore } from '@reduxjs/toolkit';
import filterReducer from './filterSlice';
import columnVisibilityReducer from './columnVisibilitySlice';
import { loadState, saveState } from './localStorage';

const preloadedState = loadState();

export const store = configureStore({
    reducer: {
        filters: filterReducer,
        columnVisibility: columnVisibilityReducer,
    },
    preloadedState,
});

// Сохраняем состояние в localStorage при каждом изменении
store.subscribe(() => {
    saveState(store.getState());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
