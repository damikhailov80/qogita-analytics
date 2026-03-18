'use client';

import { Modal } from '@/components/ui/modal';
import { CategoryFilter } from '@/components/category-filter';

interface CategoryFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
}

export function CategoryFilterModal({ isOpen, onClose, onFilterChange }: CategoryFilterModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Фильтр по категориям"
            size="full"
        >
            <div className="p-6">
                <CategoryFilter
                    onFilterChange={onFilterChange}
                    className="w-full"
                />
            </div>
        </Modal>
    );
}
