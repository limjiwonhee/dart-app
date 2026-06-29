'use client';

import { useState } from 'react';
import NavTabs from './components/NavTabs';
import CompanySelector, { COMPANY_COLORS } from './components/CompanySelector';
import { useCompanies } from './providers/CompanyContext';

/* ===== 상수 ===== */
const ACCOUNTS = [
    { label: '매출액',              keys: ['매출액', '수익(매출액)', '영업수익'],                                                                   hl: false },
    { label: '매출원가',            keys: ['매출원가'],                                                                                              hl: false },
    { label: '매출총이익',          keys: ['매출총이익', '매출총손실'],                                                                              hl: false },
    { label: '판매비와관리비',      keys: ['판매비와관리비', '판매비와일반관리비'],                                                                  hl: false },
    { label: '영업이익',            keys: ['영업이익', '영업이익(손실)', '영업손실'],                                                               hl: true  },
    { label: '금융수익',            keys: ['금융수익'],                                                                                              hl: false },
    { label: '금융원가',            keys: ['금융원가', '금융비용'],                                                                                  hl: false },
    { label: '법인세차감전순이익',  keys: ['법인세비용차감전순이익', '법인세비용차감전순이익(손실)', '법인세차감전순이익', '법인세비용차감전계속사업이익'], hl: false },
    { label: '법인세비용',          keys: ['법인세비용'],                                                                                            hl: false },
    { label: '당기순이익',          keys: ['당기순이익', '당기순이익(손실)', '당기순손실'],                                                         hl: true  },
];

/* ===== 유틸 함수 ===== */
function parseAmt(s) {
    if (!s || s === '-' || s.trim() === '') return null;
    const n = parseInt(s.replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
}

function fmtNum(n) {
    const eok = n / 1e8;
    const abs = Math.abs(eok).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return n < 0 ? `(${abs})` : abs;
}

function findAccount(items, keys) {
    const sorted = [...items].sort((a, b) => (parseInt(a.ord) || 999) - (parseInt(b.ord) || 999));
    for (const k of keys) {
        const hit = sorted.find(i => i.account_nm.trim() === k);
        if (hit) return hit;
    }
    for (const k of keys) {
        const hit = sorted.find(i => i.account_nm.trim().includes(k));
        if (hit) return hit;
    }
    return null;
}

function extractIsItems(list) {
    const is  = (list || []).filter(i => i.sj_div === 'IS');
    if (is.length)  return is;
    const cis = (list || []).filter(i => i.sj_div === 'CIS');
    return cis.length ? cis : null;
}

function growthRate(cur, prev) {
    if (cur === null || prev === null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
}

/* ===== 시사점 계산 ===== */
function computeInsights(fetchedList) {
    const REV_KEYS  = ACCOUNTS.find(a => a.label === '매출액').keys;
    const OPIN_KEYS = ACCOUNTS.find(a => a.label === '영업이익').keys;
    const NET_KEYS  = ACCOUNTS.find(a => a.label === '당기순이익').keys;

    const companies = fetchedList.map(({ name, items, colorIdx }) => {
        if (!items) return { name, colorIdx, available: false };

        const revAcc  = findAccount(items, REV_KEYS);
        const opinAcc = findAccount(items, OPIN_KEYS);
        const netAcc  = findAccount(items, NET_KEYS);

        const revCur   = parseAmt(revAcc?.thstrm_amount);
        const revPrev  = parseAmt(revAcc?.frmtrm_amount);
        const opinCur  = parseAmt(opinAcc?.thstrm_amount);
        const opinPrev = parseAmt(opinAcc?.frmtrm_amount);
        const netCur   = parseAmt(netAcc?.thstrm_amount);
        const netPrev  = parseAmt(netAcc?.frmtrm_amount);

        const revGrowth  = growthRate(revCur, revPrev);
        const opinGrowth = growthRate(opinCur, opinPrev);
        const netGrowth  = growthRate(netCur, netPrev);
        const opinMargin = (revCur && opinCur !== null) ? (opinCur / revCur) * 100 : null;
        const netMargin  = (revCur && netCur !== null)  ? (netCur  / revCur) * 100 : null;

        const tags = [];
        if (revGrowth !== null) {
            if (revGrowth >= 10)      tags.push({ type: 'up',   text: '매출 큰 폭 성장' });
            else if (revGrowth >= 0)  tags.push({ type: 'up',   text: '매출 소폭 성장' });
            else                      tags.push({ type: 'down', text: '매출 감소' });
        }
        if (opinMargin !== null) {
            if (opinMargin >= 15)     tags.push({ type: 'good', text: '수익성 우수' });
            else if (opinMargin >= 5) tags.push({ type: 'ok',   text: '수익성 양호' });
            else                      tags.push({ type: 'warn', text: '수익성 개선 필요' });
        }
        if (netCur !== null && netPrev !== null) {
            if (netCur > netPrev)     tags.push({ type: 'up',   text: '순이익 개선' });
            else                      tags.push({ type: 'down', text: '순이익 감소' });
        }

        return { name, colorIdx, available: true, revGrowth, opinGrowth, netGrowth, opinMargin, netMargin, tags };
    });

    const withData = companies.filter(c => c.available);
    const opinMarginLeader = [...withData]
        .filter(c => c.opinMargin !== null)
        .sort((a, b) => b.opinMargin - a.opinMargin)[0] ?? null;
    const revGrowthLeader = [...withData]
        .filter(c => c.revGrowth !== null)
        .sort((a, b) => b.revGrowth - a.revGrowth)[0] ?? null;

    return { companies, opinMarginLeader, revGrowthLeader, total: withData.length };
}

/* ===== API 호출 ===== */
async function callApi(corpCode, year, reprtCode, fsDiv) {
    const params = new URLSearchParams({ corp_code: corpCode, bsns_year: year, reprt_code: reprtCode, fs_div: fsDiv });
    const res = await fetch(`/api/financial?${params}`);
    if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
    return res.json();
}

/* ===== 서브 컴포넌트 ===== */
function AmountCell({ rawAmt }) {
    const n = parseAmt(rawAmt);
    if (n === null) return <td className="na">-</td>;
    return <td className={`num${n < 0 ? ' neg' : ''}`}>{fmtNum(n)}</td>;
}

function FinancialTable({ items }) {
    const first = items[0] || {};
    const thNm  = first.thstrm_nm || '당기';
    const frNm  = first.frmtrm_nm || '전기';
    return (
        <div className="tbl-wrap">
            <span className="tbl-unit">단위: 억원</span>
            <table>
                <thead>
                    <tr>
                        <th>항목</th>
                        <th>{thNm}<span className="th-period">당기</span></th>
                        <th>{frNm}<span className="th-period">전기</span></th>
                    </tr>
                </thead>
                <tbody>
                    {ACCOUNTS.map(acc => {
                        const found = findAccount(items, acc.keys);
                        return (
                            <tr key={acc.label} className={acc.hl ? 'hl' : ''}>
                                <td className="acc-name">{acc.label}</td>
                                <AmountCell rawAmt={found?.thstrm_amount} />
                                <AmountCell rawAmt={found?.frmtrm_amount} />
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function CompanyCard({ company, colorIdx, state }) {
    const color = COMPANY_COLORS[colorIdx] || '#1a73e8';
    const badgeText = state.status === 'ok'
        ? (state.fsDiv === 'CFS' ? '연결재무제표' : '개별재무제표')
        : '-';

    return (
        <div className="co-card">
            <div className="co-head" style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}>
                <span className="co-name">{company.corp_name}</span>
                <span className="fs-tag">{badgeText}</span>
            </div>
            <div className="co-body">
                {state.status === 'idle' && (
                    <div className="state-box">
                        <div className="state-text">조회 버튼을 눌러<br />데이터를 불러오세요.</div>
                    </div>
                )}
                {state.status === 'loading' && (
                    <div className="state-box">
                        <div className="spinner" />
                        <div className="state-text">데이터를 불러오는 중...</div>
                    </div>
                )}
                {state.status === 'err' && (
                    <div className="state-box">
                        <div className="state-icon state-error">⚠</div>
                        <div className="state-text state-error">{state.msg}</div>
                    </div>
                )}
                {state.status === 'ok' && <FinancialTable items={state.items} />}
            </div>
        </div>
    );
}

function MetricRow({ label, value }) {
    if (value === null || value === undefined) {
        return (
            <div className="metric-row">
                <span className="metric-label">{label}</span>
                <span className="metric-na">-</span>
            </div>
        );
    }
    const isPos = value > 0;
    const isNeg = value < 0;
    const arrow = isPos ? '▲' : isNeg ? '▼' : '';
    const cls   = isPos ? 'up' : isNeg ? 'down' : 'neutral';
    const text  = `${isPos ? '+' : ''}${value.toFixed(1)}%`;
    return (
        <div className="metric-row">
            <span className="metric-label">{label}</span>
            <span className={`metric-value ${cls}`}>
                {arrow && <span className="metric-arrow">{arrow} </span>}
                {text}
            </span>
        </div>
    );
}

function InsightsPanel({ insights }) {
    return (
        <aside className="insights-panel">
            <div className="insights-header">⚡ 시사점</div>
            {!insights ? (
                <div className="insights-empty">
                    <div className="state-text">조회 후 자동 생성됩니다.</div>
                </div>
            ) : (
                <>
                    {insights.companies.map((co) => (
                        <div key={co.name} className="insight-co">
                            <div
                                className="insight-co-name"
                                style={{ borderLeftColor: COMPANY_COLORS[co.colorIdx] || '#ccc' }}
                            >
                                {co.name}
                            </div>
                            {!co.available ? (
                                <div className="insight-na">데이터 없음</div>
                            ) : (
                                <>
                                    <MetricRow label="매출 증감률"     value={co.revGrowth}  />
                                    <MetricRow label="영업이익 증감률" value={co.opinGrowth} />
                                    <MetricRow label="순이익 증감률"   value={co.netGrowth}  />
                                    <MetricRow label="영업이익률"      value={co.opinMargin} />
                                    <MetricRow label="순이익률"        value={co.netMargin}  />
                                    {co.tags.length > 0 && (
                                        <div className="insight-tags">
                                            {co.tags.map((tag, i) => (
                                                <span key={i} className={`insight-tag i-${tag.type}`}>{tag.text}</span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {(insights.opinMarginLeader || insights.revGrowthLeader) && (
                        <div className="insights-summary">
                            <div className="insights-summary-title">종합</div>
                            {insights.opinMarginLeader && (
                                <p className="summary-item">
                                    <strong className="summary-leader">{insights.opinMarginLeader.name}</strong>가{' '}
                                    영업이익률 <strong>{insights.opinMarginLeader.opinMargin.toFixed(1)}%</strong>로{' '}
                                    {insights.total > 1 ? `${insights.total}개사 중 ` : ''}수익성 최고
                                </p>
                            )}
                            {insights.revGrowthLeader && (
                                <p className="summary-item">
                                    <strong className="summary-leader">{insights.revGrowthLeader.name}</strong>가{' '}
                                    매출 성장률{' '}
                                    <strong>
                                        {insights.revGrowthLeader.revGrowth >= 0 ? '+' : ''}
                                        {insights.revGrowthLeader.revGrowth.toFixed(1)}%
                                    </strong>
                                    로 {insights.total > 1 ? `${insights.total}개사 중 ` : ''}성장률 최고
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </aside>
    );
}

/* ===== 메인 페이지 ===== */
export default function Page() {
    const { selected } = useCompanies();
    const [year,      setYear]      = useState('2025');
    const [reprtCode, setReprtCode] = useState('11011');
    const [busy,      setBusy]      = useState(false);
    const [insights,  setInsights]  = useState(null);
    const [results,   setResults]   = useState({});

    function patch(corpCode, update) {
        setResults(prev => ({ ...prev, [corpCode]: update }));
    }

    async function fetchOne(co, colorIdx) {
        const FATAL = ['010', '011', '020', '100', '800'];
        try {
            let data = await callApi(co.corp_code, year, reprtCode, 'CFS');
            const cfsItems = extractIsItems(data.list);
            if (data.status === '000' && cfsItems) {
                patch(co.corp_code, { status: 'ok', items: cfsItems, fsDiv: 'CFS' });
                return { name: co.corp_name, items: cfsItems, colorIdx };
            }
            if (FATAL.includes(data.status)) {
                patch(co.corp_code, { status: 'err', msg: `API 오류 (${data.status}): ${data.message}` });
                return { name: co.corp_name, items: null, colorIdx };
            }

            data = await callApi(co.corp_code, year, reprtCode, 'OFS');
            const ofsItems = extractIsItems(data.list);
            if (data.status !== '000' || !ofsItems) {
                patch(co.corp_code, { status: 'err', msg: data.message || '해당 기간의 데이터가 없습니다.' });
                return { name: co.corp_name, items: null, colorIdx };
            }
            patch(co.corp_code, { status: 'ok', items: ofsItems, fsDiv: 'OFS' });
            return { name: co.corp_name, items: ofsItems, colorIdx };
        } catch (e) {
            patch(co.corp_code, { status: 'err', msg: e.message });
            return { name: co.corp_name, items: null, colorIdx };
        }
    }

    async function handleSearch() {
        if (selected.length === 0) {
            alert('회사를 1개 이상 선택해주세요.');
            return;
        }
        setBusy(true);
        setInsights(null);
        setResults(Object.fromEntries(selected.map(co => [co.corp_code, { status: 'loading' }])));
        const fetched = await Promise.all(selected.map((co, i) => fetchOne(co, i)));
        setInsights(computeInsights(fetched));
        setBusy(false);
    }

    const gridClass = `results-grid grid-${Math.max(selected.length, 1)}`;
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
                            <label htmlFor="year">연도</label>
                            <select id="year" value={year} onChange={e => setYear(e.target.value)}>
                                <option value="2025">2025년</option>
                                <option value="2024">2024년</option>
                                <option value="2023">2023년</option>
                                <option value="2022">2022년</option>
                                <option value="2021">2021년</option>
                                <option value="2020">2020년</option>
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
                        <button className="btn-query" onClick={handleSearch} disabled={busy || selected.length === 0}>
                            {busy ? '조회 중...' : '조회'}
                        </button>
                    </div>
                </div>

                {/* 빈 선택 상태 */}
                {selected.length === 0 ? (
                    <div className="no-companies-msg">
                        <div className="state-text">위 검색창에서 회사를 선택해주세요.</div>
                    </div>
                ) : (
                    <div className="main-content">
                        <div className={gridClass}>
                            {selected.map((co, i) => (
                                <CompanyCard
                                    key={co.corp_code}
                                    company={co}
                                    colorIdx={i}
                                    state={results[co.corp_code] || { status: 'idle' }}
                                />
                            ))}
                        </div>
                        <InsightsPanel insights={insights} />
                    </div>
                )}
            </main>
        </>
    );
}
