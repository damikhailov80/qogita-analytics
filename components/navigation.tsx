'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation() {
    const pathname = usePathname();

    const links = [
        { href: '/', label: 'Home' },
        { href: '/products/qogita', label: 'Qogita Products' },
        { href: '/products/allegro', label: 'Allegro Products' },
        { href: '/sellers', label: 'Sellers' },
    ];

    return (
        <nav className="border-b bg-white dark:bg-zinc-950">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center gap-8">
                    <Link href="/" className="text-xl font-bold">
                        Qogita
                    </Link>
                    <div className="flex gap-6">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium transition-colors hover:text-zinc-900 dark:hover:text-zinc-50 ${pathname === link.href
                                    ? 'text-zinc-900 dark:text-zinc-50'
                                    : 'text-zinc-600 dark:text-zinc-400'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}
