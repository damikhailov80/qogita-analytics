'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { Table } from '@tanstack/react-table';

interface ColumnVisibilityModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    table: Table<T>;
}

export function ColumnVisibilityModal<T>({ isOpen, onClose, table }: ColumnVisibilityModalProps<T>) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Показать колонки"
            size="md"
        >
            <div className="p-6">
                <div className="grid grid-cols-1 gap-2 mb-4">
                    {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                            return (
                                <label
                                    key={column.id}
                                    className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-2 rounded"
                                >
                                    <input
                                        type="checkbox"
                                        checked={column.getIsVisible()}
                                        onChange={(e) =>
                                            column.toggleVisibility(e.target.checked)
                                        }
                                        className="rounded border-gray-300"
                                    />
                                    <span className="capitalize">
                                        {typeof column.columnDef.header === 'string'
                                            ? column.columnDef.header
                                            : column.id}
                                    </span>
                                </label>
                            );
                        })}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.toggleAllColumnsVisible(true)}
                    >
                        Показать все
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.toggleAllColumnsVisible(false)}
                    >
                        Скрыть все
                    </Button>
                </div>
            </div>
        </Modal>
    );
}