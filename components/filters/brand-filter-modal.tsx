'use client';

import { Modal } from '@/components/ui/modal';
import { BrandFilter } from '@/components/brand-filter';

interface BrandFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFilterChange?: (whiteList: string[], blackList: string[]) => void;
}

export function BrandFilterModal({ isOpen, onClose, onFilterChange }: BrandFilterModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Фильтр по брендам"
            size="full"
        >
            <div className="p-6">
                <BrandFilter
                    onFilterChange={onFilterChange}
                    className="w-full"
                />
            </div>
        </Modal>
    );
}