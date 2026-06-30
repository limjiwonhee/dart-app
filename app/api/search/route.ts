import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Company {
    corp_code:  string;
    corp_name:  string;
    stock_code: string;
    corp_cls:   string;
}

// 서버 기동 시 1회만 로드 (메모리 캐시)
let CORP_LIST: Company[] | null = null;

function getCorpList(): Company[] {
    if (CORP_LIST) return CORP_LIST;
    const filePath = join(process.cwd(), 'public', 'corps.json');
    const raw = readFileSync(filePath, 'utf-8');
    CORP_LIST = JSON.parse(raw) as Company[];
    console.log('[search] corps.json 로드:', CORP_LIST.length, '개사');
    return CORP_LIST;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query || query.length < 1) return NextResponse.json({ list: [] });

    try {
        const all  = getCorpList();
        const list = all
            .filter(co => co.corp_name.includes(query))
            .slice(0, 20);

        console.log(`[search] "${query}" → ${list.length}건`);
        return NextResponse.json({ list });
    } catch (e: any) {
        console.error('[search] error:', e.message);
        return NextResponse.json({ status: '502', message: e.message }, { status: 502 });
    }
}
