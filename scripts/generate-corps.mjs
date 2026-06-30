/**
 * DART corpCode.xml을 다운로드하여 상장사 목록을 JSON으로 저장
 * 실행: node scripts/generate-corps.mjs
 */
import AdmZip from 'adm-zip';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.DART_API_KEY || process.argv[2];

if (!API_KEY) {
    console.error('Usage: DART_API_KEY=xxx node scripts/generate-corps.mjs');
    process.exit(1);
}

console.log('DART corpCode.xml 다운로드 중...');
const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${API_KEY}`);
if (!res.ok) throw new Error(`HTTP ${res.status}`);

const zipBuf  = Buffer.from(await res.arrayBuffer());
console.log(`ZIP 크기: ${(zipBuf.length / 1024).toFixed(0)} KB`);

const zip   = new AdmZip(zipBuf);
const entry = zip.getEntries()[0];
const xmlBuf = entry.getData();

const head = xmlBuf.slice(0, 300).toString('latin1');
const xml  = /encoding=["']euc-kr["']/i.test(head)
    ? new TextDecoder('euc-kr').decode(xmlBuf)
    : xmlBuf.toString('utf-8');

const list = [];
let pos = 0;
while (true) {
    const s = xml.indexOf('<list>', pos);
    if (s === -1) break;
    const e = xml.indexOf('</list>', s);
    if (e === -1) break;
    const block = xml.slice(s + 6, e);
    const get = (tag) => {
        const i = block.indexOf(`<${tag}>`);
        const j = block.indexOf(`</${tag}>`, i);
        return i === -1 || j === -1 ? '' : block.slice(i + tag.length + 2, j).trim();
    };
    const stock_code = get('stock_code');
    if (stock_code.trim()) {
        list.push({
            corp_code:  get('corp_code'),
            corp_name:  get('corp_name'),
            stock_code: stock_code.trim(),
            corp_cls:   get('corp_cls') || '',
        });
    }
    pos = e + 7;
}

console.log(`상장사: ${list.length}개`);

const outDir = join(__dir, '../public');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'corps.json');
writeFileSync(outPath, JSON.stringify(list, null, 0), 'utf-8');
console.log(`저장 완료: public/corps.json (${(list.length)} 개사)`);
