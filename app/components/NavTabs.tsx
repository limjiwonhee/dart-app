'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavTabs() {
    const pathname = usePathname();
    return (
        <nav className="nav-tabs">
            <Link href="/" className={`nav-tab${pathname === '/' ? ' active' : ''}`}>
                개별 조회
            </Link>
            <Link href="/compare" className={`nav-tab${pathname === '/compare' ? ' active' : ''}`}>
                비교하기
            </Link>
        </nav>
    );
}
