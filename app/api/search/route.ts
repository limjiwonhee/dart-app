import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

interface Company {
    corp_code:  string;
    corp_name:  string;
    stock_code: string;
    corp_cls:   string;
}

// 서버 메모리 캐시 (1시간)
let cache: Company[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function loadCorpList(apiKey: string): Promise<Company[]> {
    const now = Date.now();
    if (cache && now - cacheTs < CACHE_TTL) {
        console.log('[search] cache hit:', cache.length, '개사');
        return cache;
    }

    console.log('[search] DART corpCode.xml 다운로드 중...');
    const res = await fetch(
        `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
        { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`corpCode.xml 다운로드 실패 HTTP ${res.status}`);

    const zipBuf  = Buffer.from(await res.arrayBuffer());
    const zip     = new AdmZip(zipBuf);
    const entry   = zip.getEntries()[0];
    if (!entry) throw new Error('ZIP 내 파일 없음');

    const xmlBuf = entry.getData();

    // EUC-KR / UTF-8 판별
    const head = xmlBuf.slice(0, 300).toString('latin1');
    let xml: string;
    if (/encoding=["']euc-kr["']/i.test(head)) {
        xml = new TextDecoder('euc-kr').decode(xmlBuf);
    } else {
        xml = xmlBuf.toString('utf-8');
    }

    // <list> 블록 파싱
    const list: Company[] = [];
    let pos = 0;
    while (true) {
        const s = xml.indexOf('<list>', pos);
        if (s === -1) break;
        const e = xml.indexOf('</list>', s);
        if (e === -1) break;
        const block = xml.slice(s + 6, e);

        const get = (tag: string) => {
            const i = block.indexOf(`<${tag}>`);
            const j = block.indexOf(`</${tag}>`, i);
            return i === -1 || j === -1 ? '' : block.slice(i + tag.length + 2, j).trim();
        };

        list.push({
            corp_code:  get('corp_code'),
            corp_name:  get('corp_name'),
            stock_code: get('stock_code'),
            corp_cls:   get('corp_cls'),
        });
        pos = e + 7;
    }

    console.log('[search] 파싱 완료:', list.length, '개사');
    cache   = list;
    cacheTs = now;
    return list;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query) return NextResponse.json({ list: [] });

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ status: '500', message: 'DART_API_KEY 환경변수 미설정' }, { status: 500 });
    }

    try {
        const all  = await loadCorpList(apiKey);
        // 상장사(6자리 종목코드)만, 검색어 매칭, 최대 20개
        const list = all
            .filter(co => co.stock_code.trim() && co.corp_name.includes(query))
            .slice(0, 20);

        console.log(`[search] query="${query}" → ${list.length}건`);
        return NextResponse.json({ list });
    } catch (e: any) {
        console.error('[search] error:', e.message);
        return NextResponse.json({ status: '502', message: e.message }, { status: 502 });
    }
}
