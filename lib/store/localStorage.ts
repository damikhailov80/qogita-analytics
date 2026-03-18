import type { RootState } from './store';

const STORAGE_KEY = 'qogita_filters_state';

export const loadState = () => {
    try {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        return JSON.parse(serializedState);
    } catch (err) {
        console.error('Error loading state from localStorage:', err);
        return undefined;
    }
};

export const saveState = (state: any): void => {
    try {
        if (typeof window === 'undefined') {
            return;
        }

        const serializedState = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (err) {
        console.error('Error saving state to localStorage:', err);
    }
};

export const clearState = (): void => {
    try {
        if (typeof window === 'undefined') {
            return;
        }

        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.error('Error clearing state from localStorage:', err);
    }
};
