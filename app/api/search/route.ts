import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';

interface Company {
    corp_code:  string;
    corp_name:  string;
    stock_code: string;
    corp_cls:   string;
}

// 서버 메모리 캐시 (1시간)
let cachedList: Company[] | null = null;
let cacheTime  = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function loadCompanyList(apiKey: string): Promise<Company[]> {
    const now = Date.now();
    if (cachedList && (now - cacheTime) < CACHE_TTL) return cachedList;

    const res = await fetch(
        `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
        { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`기업 목록 다운로드 실패 (HTTP ${res.status})`);

    const zipBuf = Buffer.from(await res.arrayBuffer());

    // adm-zip으로 압축 해제
    const zip  = new AdmZip(zipBuf);
    const entry = zip.getEntries()[0];
    if (!entry) throw new Error('ZIP 내 파일 없음');
    const xmlBuf = entry.getData();

    // EUC-KR 인코딩 처리
    const head = xmlBuf.slice(0, 200).toString('latin1');
    const xml  = /encoding=["']euc-kr["']/i.test(head)
        ? new TextDecoder('euc-kr').decode(xmlBuf)
        : xmlBuf.toString('utf-8');

    // xml2js로 파싱
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items: any[] = parsed?.result?.list ?? [];

    cachedList = items.map((item: any) => ({
        corp_code:  item.corp_code  ?? '',
        corp_name:  item.corp_name  ?? '',
        stock_code: item.stock_code ?? '',
        corp_cls:   item.corp_cls   ?? '',
    }));
    cacheTime = now;
    return cachedList;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query) return NextResponse.json({ list: [] });

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ status: '500', message: 'API 키 미설정' }, { status: 500 });
    }

    try {
        const all  = await loadCompanyList(apiKey);
        // 상장사(stock_code가 실제 6자리 코드인 것)만 필터링 후 검색어 매칭, 최대 20개
        const list = all
            .filter(co => co.stock_code.trim() && co.corp_name.includes(query))
            .slice(0, 20);
        return NextResponse.json({ list });
    } catch (e: any) {
        return NextResponse.json({ status: '502', message: e.message }, { status: 502 });
    }
}
