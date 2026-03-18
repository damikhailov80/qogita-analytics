'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface RangeSliderProps {
    min: number;
    max: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    step?: number;
    className?: string;
}

export function RangeSlider({
    min,
    max,
    value,
    onChange,
    step = 1,
    className,
}: RangeSliderProps) {
    const [isDragging, setIsDragging] = React.useState<'min' | 'max' | null>(null);
    const sliderRef = React.useRef<HTMLDivElement>(null);

    const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

    const handleMouseDown = (type: 'min' | 'max') => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(type);
    };

    const handleMouseMove = React.useCallback(
        (e: MouseEvent) => {
            if (!isDragging || !sliderRef.current) return;

            const rect = sliderRef.current.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const newValue = Math.round((percentage / 100) * (max - min) + min);

            if (isDragging === 'min') {
                const newMin = Math.min(newValue, value[1] - step);
                onChange([Math.max(min, newMin), value[1]]);
            } else {
                const newMax = Math.max(newValue, value[0] + step);
                onChange([value[0], Math.min(max, newMax)]);
            }
        },
        [isDragging, min, max, value, step, onChange]
    );

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(null);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div className={cn('relative w-full', className)}>
            <div
                ref={sliderRef}
                className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
            >
                {/* Track between thumbs */}
                <div
                    className="absolute h-2 bg-blue-500 rounded-full"
                    style={{
                        left: `${getPercentage(value[0])}%`,
                        width: `${getPercentage(value[1]) - getPercentage(value[0])}%`,
                    }}
                />

                {/* Min thumb */}
                <div
                    className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 top-1/2 hover:scale-110 transition-transform"
                    style={{ left: `${getPercentage(value[0])}%` }}
                    onMouseDown={handleMouseDown('min')}
                />

                {/* Max thumb */}
                <div
                    className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 top-1/2 hover:scale-110 transition-transform"
                    style={{ left: `${getPercentage(value[1])}%` }}
                    onMouseDown={handleMouseDown('max')}
                />
            </div>

            {/* Value display */}
            <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>{value[0]}</span>
                <span>{value[1]}</span>
            </div>
        </div>
    );
}