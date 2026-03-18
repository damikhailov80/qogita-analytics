import { configureStore } from '@reduxjs/toolkit';
import filterReducer from './filterSlice';
import columnVisibilityReducer from './columnVisibilitySlice';
import { loadState, saveState } from './localStorage';

const rootReducer = {
    filters: filterReducer,
    columnVisibility: columnVisibilityReducer,
};

const persistedState = loadState();

export const store = configureStore({
    reducer: rootReducer,
    ...(persistedState && { preloadedState: persistedState }),
});

// Сохраняем состояние в localStorage при каждом изменении
store.subscribe(() => {
    saveState(store.getState());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
