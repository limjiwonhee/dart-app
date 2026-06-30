'use client';

import { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import NavTabs from '../components/NavTabs';
import CompanySelector, { COMPANY_COLORS } from '../components/CompanySelector';
import { useCompanies } from '../providers/CompanyContext';

/* ── 상수 ── */
const ACCOUNT_OPTIONS = [
    { label: '매출액',         keys: ['매출액', '수익(매출액)', '영업수익'] },
    { label: '매출총이익',     keys: ['매출총이익', '매출총손실'] },
    { label: '영업이익',       keys: ['영업이익', '영업이익(손실)', '영업손실'] },
    { label: '당기순이익',     keys: ['당기순이익', '당기순이익(손실)', '당기순손실'] },
    { label: '판매비와관리비', keys: ['판매비와관리비', '판매비와일반관리비'] },
    { label: '법인세비용차감전순이익', keys: ['법인세비용차감전순이익', '법인세비용차감전순이익(손실)', '법인세차감전순이익'] },
    { label: '법인세비용',     keys: ['법인세비용'] },
];

const ALL_YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];

/* ── 타입 ── */
interface DartItem {
    account_nm:    string;
    ord:           string;
    sj_div:        string;
    thstrm_amount: string;
}
interface ChartRow {
    year: string;
    [company: string]: number | null | string;
}

/* ── 유틸 ── */
function parseAmt(s?: string): number | null {
    if (!s || s === '-' || s.trim() === '') return null;
    const n = parseInt(s.replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
}

function toEok(n: number): number {
    return Math.round((n / 1e8) * 10) / 10;
}

function fmtEok(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function findAccount(items: DartItem[], keys: readonly string[]): DartItem | undefined {
    const sorted = [...items].sort((a, b) => (parseInt(a.ord) || 999) - (parseInt(b.ord) || 999));
    for (const k of keys) {
        const hit = sorted.find(i => i.account_nm.trim() === k);
        if (hit) return hit;
    }
    for (const k of keys) {
        const hit = sorted.find(i => i.account_nm.trim().includes(k));
        if (hit) return hit;
    }
}

function extractIsItems(list: DartItem[]): DartItem[] | null {
    const is  = list.filter(i => i.sj_div === 'IS');
    if (is.length)  return is;
    const cis = list.filter(i => i.sj_div === 'CIS');
    return cis.length ? cis : null;
}

/* ── CFS → OFS 폴백 단일 금액 조회 ── */
const FATAL = new Set(['010', '011', '020', '100', '800']);

async function fetchAmount(
    corpCode: string,
    year: string,
    reprtCode: string,
    keys: readonly string[],
): Promise<number | null> {
    for (const fsDiv of ['CFS', 'OFS'] as const) {
        try {
            const params = new URLSearchParams({ corp_code: corpCode, bsns_year: year, reprt_code: reprtCode, fs_div: fsDiv });
            const res  = await fetch(`/api/financial?${params}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (FATAL.has(data.status)) return null;
            if (data.status !== '000' || !data.list?.length) continue;
            const items = extractIsItems(data.list);
            if (!items) continue;
            const found = findAccount(items, keys);
            const n = parseAmt(found?.thstrm_amount);
            if (n !== null) return toEok(n);
        } catch {
            continue;
        }
    }
    return null;
}

/* ── 메인 페이지 ── */
export default function ComparePage() {
    const { selected } = useCompanies();
    const [startYear,  setStartYear]  = useState('2020');
    const [endYear,    setEndYear]    = useState('2024');
    const [reprtCode,  setReprtCode]  = useState('11011');
    const [accountIdx, setAccountIdx] = useState(2);
    const [loading,    setLoading]    = useState(false);
    const [chartData,  setChartData]  = useState<ChartRow[]>([]);
    const [fetched,    setFetched]    = useState(false);

    const years = ALL_YEARS.slice(
        ALL_YEARS.indexOf(startYear),
        ALL_YEARS.indexOf(endYear) + 1,
    );

    async function handleSearch() {
        if (selected.length === 0) { alert('회사를 1개 이상 선택해주세요.'); return; }
        if (ALL_YEARS.indexOf(startYear) > ALL_YEARS.indexOf(endYear)) { alert('시작연도가 종료연도보다 클 수 없습니다.'); return; }

        const account = ACCOUNT_OPTIONS[accountIdx];
        setLoading(true);
        setFetched(false);

        const rows: ChartRow[] = await Promise.all(
            years.map(async (year) => {
                const amounts = await Promise.all(
                    selected.map(co => fetchAmount(co.corp_code, year, reprtCode, account.keys))
                );
                const row: ChartRow = { year };
                selected.forEach((co, i) => { row[co.corp_name] = amounts[i]; });
                return row;
            })
        );

        setChartData(rows);
        setLoading(false);
        setFetched(true);
    }

    const selectedLabel = ACCOUNT_OPTIONS[accountIdx].label;
    const headerSub = selected.length > 0
        ? selected.map(co => co.corp_name).join(' · ')
        : '회사를 선택해주세요';

    return (
        <>
            <header className="app-header">
                <h1>DART 손익계산서 조회</h1>
                <p>금융감독원 전자공시시스템 Open API &nbsp;·&nbsp; {headerSub}</p>
                <NavTabs />
            </header>

            <main className="wrap">
                {/* 검색 카드 */}
                <div className="search-card">
                    <CompanySelector />
                    <div className="selector-divider" />
                    <div className="search-card-title">조회 조건</div>
                    <div className="search-row">
                        <div className="field">
                            <label htmlFor="startYear">시작연도</label>
                            <select id="startYear" value={startYear} onChange={e => setStartYear(e.target.value)}>
                                {ALL_YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>
                        </div>
                        <div className="cmp-dash">~</div>
                        <div className="field">
                            <label htmlFor="endYear">종료연도</label>
                            <select id="endYear" value={endYear} onChange={e => setEndYear(e.target.value)}>
                                {ALL_YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="reprtCode">보고서 유형</label>
                            <select id="reprtCode" value={reprtCode} onChange={e => setReprtCode(e.target.value)}>
                                <option value="11011">연간</option>
                                <option value="11012">반기 (2분기)</option>
                                <option value="11013">1분기</option>
                                <option value="11014">3분기</option>
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="accountSel">항목</label>
                            <select id="accountSel" value={accountIdx} onChange={e => setAccountIdx(Number(e.target.value))}>
                                {ACCOUNT_OPTIONS.map((opt, i) => (
                                    <option key={i} value={i}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            className="btn-query"
                            onClick={handleSearch}
                            disabled={loading || selected.length === 0}
                        >
                            {loading ? '조회 중…' : '조회'}
                        </button>
                    </div>
                </div>

                {/* 상태 메시지 */}
                {selected.length === 0 && (
                    <div className="chart-state"><div className="state-text">위 검색창에서 회사를 선택해주세요.</div></div>
                )}
                {selected.length > 0 && loading && (
                    <div className="chart-state">
                        <div className="spinner" />
                        <div className="state-text">{years.length}개 연도 × {selected.length}개사 데이터 조회 중...</div>
                    </div>
                )}
                {selected.length > 0 && !loading && !fetched && (
                    <div className="chart-state"><div className="state-text">연도 범위와 항목을 선택하고 조회 버튼을 누르세요.</div></div>
                )}

                {/* 차트 + 테이블 */}
                {selected.length > 0 && !loading && fetched && (
                    <>
                        <div className="chart-card">
                            <div className="chart-card-title">
                                {selectedLabel} 추이 비교
                                <span className="chart-unit">단위: 억원</span>
                            </div>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="year"
                                        tick={{ fontSize: 13, fill: '#5f6368' }}
                                        tickFormatter={v => `${v}년`}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#5f6368' }}
                                        tickFormatter={(v: number) =>
                                            Math.abs(v) >= 10000
                                                ? `${(v / 10000).toFixed(0)}만`
                                                : v.toLocaleString('ko-KR')
                                        }
                                        width={72}
                                    />
                                    <Tooltip
                                        formatter={(value: any, name: any) => [
                                            value != null
                                                ? `${Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 1 })} 억원`
                                                : '데이터 없음',
                                            name,
                                        ]}
                                        labelFormatter={label => `${label}년`}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: '1px solid #e8eaed',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            fontSize: '0.85rem',
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '0.88rem', paddingTop: '12px' }} />
                                    {selected.map((co, i) => (
                                        <Line
                                            key={co.corp_code}
                                            type="linear"
                                            dataKey={co.corp_name}
                                            stroke={COMPANY_COLORS[i]}
                                            strokeWidth={2.5}
                                            dot={{ r: 5, fill: COMPANY_COLORS[i], strokeWidth: 0 }}
                                            activeDot={{ r: 7 }}
                                            connectNulls={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 수치 테이블 */}
                        <div className="data-table-card">
                            <div className="tbl-wrap">
                                <span className="tbl-unit">단위: 억원</span>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>회사명</th>
                                            {years.map(y => <th key={y}>{y}년</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selected.map((co, i) => (
                                            <tr key={co.corp_code}>
                                                <td className="acc-name">
                                                    <span className="co-dot" style={{ background: COMPANY_COLORS[i] }} />
                                                    {co.corp_name}
                                                </td>
                                                {years.map(y => {
                                                    const row = chartData.find(r => r.year === y);
                                                    const val = row?.[co.corp_name] as number | null | undefined;
                                                    return (
                                                        <td key={y} className={`num${(val ?? 0) < 0 ? ' neg' : ''}`}>
                                                            {fmtEok(val ?? null)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}
