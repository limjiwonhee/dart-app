import { NextResponse } from 'next/server';
import { inflateRaw } from 'zlib';
import { promisify } from 'util';

const inflate = promisify(inflateRaw);

interface Company {
    corp_code:  string;
    corp_name:  string;
    stock_code: string;
    corp_cls:   string;
}

// 서버 인스턴스 레벨 메모리 캐시 (워밍된 람다에서 재사용)
let cachedList: Company[] | null = null;
let cacheTime  = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12시간

async function loadCompanyList(apiKey: string): Promise<Company[]> {
    const now = Date.now();
    if (cachedList && (now - cacheTime) < CACHE_TTL) return cachedList;

    // corpCode.xml: 전체 상장·비상장 법인 목록 ZIP
    const res = await fetch(
        `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
        { next: { revalidate: 43200 } }, // Next.js Data Cache 12시간
    );
    if (!res.ok) throw new Error(`기업 목록 다운로드 실패 (HTTP ${res.status})`);

    const zipBuf = Buffer.from(await res.arrayBuffer());
    const xmlBuf = await extractFirstFile(zipBuf);
    const xml    = decodeBuffer(xmlBuf);

    cachedList = parseCorpXml(xml);
    cacheTime  = now;
    return cachedList;
}

// ZIP의 첫 번째 파일 데이터를 추출 (DEFLATE 압축 해제)
async function extractFirstFile(zip: Buffer): Promise<Buffer> {
    // PK\x03\x04 = 로컬 파일 헤더 시그니처
    if (zip[0] !== 0x50 || zip[1] !== 0x4b || zip[2] !== 0x03 || zip[3] !== 0x04) {
        throw new Error('ZIP 형식 오류: 올바른 ZIP 파일이 아닙니다.');
    }

    const flags          = zip.readUInt16LE(6);
    const compression    = zip.readUInt16LE(8);
    let   compressedSize = zip.readUInt32LE(18);
    const fileNameLen    = zip.readUInt16LE(26);
    const extraLen       = zip.readUInt16LE(28);
    const dataStart      = 30 + fileNameLen + extraLen;

    // 데이터 디스크립터 플래그(bit 3)가 설정된 경우 로컬 헤더의 사이즈가 0
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
        const nextPk = zip.indexOf(Buffer.from([0x50, 0x4b]), dataStart + 1);
        compressedSize = (nextPk > 0 ? nextPk : zip.length) - dataStart;
    }

    const data = zip.slice(dataStart, dataStart + compressedSize);
    if (compression === 0) return data;                         // 비압축
    if (compression === 8) return await inflate(data) as Buffer; // DEFLATE
    throw new Error(`지원하지 않는 압축 방식: ${compression}`);
}

// XML 선언의 encoding 속성을 보고 EUC-KR / UTF-8 판별
function decodeBuffer(buf: Buffer): string {
    const head = buf.slice(0, 200).toString('latin1');
    if (/encoding=["']euc-kr["']/i.test(head)) {
        try {
            return new TextDecoder('euc-kr').decode(buf);
        } catch {
            return buf.toString('latin1');
        }
    }
    return new TextDecoder('utf-8').decode(buf);
}

// 문자열 인덱스 방식으로 <list> 블록 파싱 (regex보다 빠름)
function parseCorpXml(xml: string): Company[] {
    const result: Company[] = [];
    let pos = 0;

    const getVal = (block: string, tag: string): string => {
        const open  = `<${tag}>`;
        const close = `</${tag}>`;
        const s = block.indexOf(open);
        if (s === -1) return '';
        const e = block.indexOf(close, s + open.length);
        return e === -1 ? '' : block.slice(s + open.length, e).trim();
    };

    while (true) {
        const s = xml.indexOf('<list>', pos);
        if (s === -1) break;
        const e = xml.indexOf('</list>', s + 6);
        if (e === -1) break;
        const b = xml.slice(s + 6, e);
        result.push({
            corp_code:  getVal(b, 'corp_code'),
            corp_name:  getVal(b, 'corp_name'),
            stock_code: getVal(b, 'stock_code'),
            corp_cls:   getVal(b, 'corp_cls'),
        });
        pos = e + 7;
    }
    return result;
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
        const list = all
            .filter(co => co.corp_name.includes(query))
            .slice(0, 20);
        return NextResponse.json({ list });
    } catch (e: any) {
        return NextResponse.json({ status: '502', message: e.message }, { status: 502 });
    }
}
