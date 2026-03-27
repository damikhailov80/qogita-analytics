import { configureStore } from '@reduxjs/toolkit';
import filterReducer from './filterSlice';
import columnVisibilityReducer from './columnVisibilitySlice';
import sellersReducer from './sellersSlice';
import { loadState, saveState } from './localStorage';

const rootReducer = {
    filters: filterReducer,
    columnVisibility: columnVisibilityReducer,
    sellers: sellersReducer,
};

const persistedState = loadState();

// Миграция старого состояния: добавляем global.onlyAllegro если его нет
const migratedState = persistedState ? {
    ...persistedState,
    filters: {
        ...persistedState.filters,
        global: persistedState.filters?.global || { onlyAllegro: false },
    },
} : undefined;

export const store = configureStore({
    reducer: rootReducer,
    ...(migratedState && { preloadedState: migratedState }),
});

// Сохраняем состояние в localStorage при каждом изменении
store.subscribe(() => {
    saveState(store.getState());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
