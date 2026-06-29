import { NextResponse } from 'next/server';

const DART_URL = 'https://opendart.fss.or.kr/api/company.json';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query || query.length < 1) {
        return NextResponse.json({ list: [] });
    }

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ status: '500', message: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const params = new URLSearchParams({ crtfc_key: apiKey, corp_name: query });

    try {
        const res = await fetch(`${DART_URL}?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data.status !== '000') {
            return NextResponse.json({ list: [] });
        }

        // API가 list 배열이나 단일 객체를 반환할 수 있으므로 정규화
        const raw: any[] = data.list ?? (data.corp_code ? [data] : []);
        const list = raw.map((c: any) => ({
            corp_code:  c.corp_code  ?? '',
            corp_name:  c.corp_name  ?? '',
            stock_code: c.stock_code ?? '',
            corp_cls:   c.corp_cls   ?? '',
        }));

        return NextResponse.json({ list });
    } catch (e: any) {
        return NextResponse.json({ status: '502', message: e.message }, { status: 502 });
    }
}
