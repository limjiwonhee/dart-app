import { NextResponse } from 'next/server';

const DART_URL = 'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json';

export async function GET(request) {
    // 1. 클라이언트가 보낸 파라미터 (API 키는 없음)
    const { searchParams } = new URL(request.url);
    const corp_code  = searchParams.get('corp_code');
    const bsns_year  = searchParams.get('bsns_year');
    const reprt_code = searchParams.get('reprt_code');
    const fs_div     = searchParams.get('fs_div') ?? 'CFS';

    if (!corp_code || !bsns_year || !reprt_code) {
        return NextResponse.json(
            { status: '400', message: '필수 파라미터 누락 (corp_code, bsns_year, reprt_code)' },
            { status: 400 },
        );
    }

    // 2. API 키는 서버 환경변수에서만 읽음 — 클라이언트에 절대 노출 안 됨
    const apiKey = process.env.DART_API_KEY;
    if (!apiKey || apiKey.startsWith('여기에')) {
        return NextResponse.json(
            { status: '500', message: '.env.local 파일에 DART_API_KEY를 설정해주세요.' },
            { status: 500 },
        );
    }

    // 3. 서버 → DART API 직접 호출 (CORS 프록시 불필요)
    const params = new URLSearchParams({ crtfc_key: apiKey, corp_code, bsns_year, reprt_code, fs_div });

    try {
        const dartRes = await fetch(`${DART_URL}?${params}`, {
            cache: 'no-store', // 항상 최신 데이터 조회
        });

        if (!dartRes.ok) {
            return NextResponse.json(
                { status: '502', message: `DART 서버 오류 (HTTP ${dartRes.status})` },
                { status: 502 },
            );
        }

        const data = await dartRes.json();
        return NextResponse.json(data);

    } catch (e) {
        return NextResponse.json(
            { status: '502', message: `네트워크 오류: ${e.message}` },
            { status: 502 },
        );
    }
}
