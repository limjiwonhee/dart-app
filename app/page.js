'use client';

import { useState } from 'react';

/* ===== 상수 ===== */
const COMPANIES = [
    { name: '삼성전자',     corp_code: '00126380', cls: 'c-samsung' },
    { name: 'SK하이닉스',   corp_code: '00164779', cls: 'c-skhynix' },
    { name: '두산로보틱스', corp_code: '01569603', cls: 'c-doosan'  },
];

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

// 계정과목 검색: ord 오름차순 → 정확 매칭 → 부분 매칭
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

// IS(손익계산서) 또는 CIS(포괄손익계산서) 항목 추출
function extractIsItems(list) {
    const is  = (list || []).filter(i => i.sj_div === 'IS');
    if (is.length)  return is;
    const cis = (list || []).filter(i => i.sj_div === 'CIS');
    return cis.length ? cis : null;
}

/* ===== API 호출: 클라이언트 → Next.js API Route ===== */
// API 키는 서버(route.js)에서 붙임 — 브라우저 네트워크 탭에 키가 안 보임
async function callApi(corpCode, year, reprtCode, fsDiv) {
    const params = new URLSearchParams({
        corp_code:  corpCode,
        bsns_year:  year,
        reprt_code: reprtCode,
        fs_div:     fsDiv,
    });
    const res = await fetch(`/api/financial?${params}`);
    if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
    return res.json();
}

/* ===== 서브 컴포넌트 ===== */

// 금액 셀: 억원 변환 + 음수 처리
function AmountCell({ rawAmt }) {
    const n = parseAmt(rawAmt);
    if (n === null) return <td className="na">-</td>;
    return <td className={`num${n < 0 ? ' neg' : ''}`}>{fmtNum(n)}</td>;
}

// 손익계산서 테이블
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
                        <th>
                            {thNm}
                            <span className="th-period">당기</span>
                        </th>
                        <th>
                            {frNm}
                            <span className="th-period">전기</span>
                        </th>
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

// 회사 카드
function CompanyCard({ company, state }) {
    const badgeText =
        state.status === 'ok'
            ? (state.fsDiv === 'CFS' ? '연결재무제표' : '개별재무제표')
            : '-';

    return (
        <div className="co-card">
            <div className={`co-head ${company.cls}`}>
                <span className="co-name">{company.name}</span>
                <span className="fs-tag">{badgeText}</span>
            </div>
            <div className="co-body">
                {state.status === 'idle' && (
                    <div className="state-box">
                        <div className="state-text">
                            조회 버튼을 눌러<br />데이터를 불러오세요.
                        </div>
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
                {state.status === 'ok' && (
                    <FinancialTable items={state.items} />
                )}
            </div>
        </div>
    );
}

/* ===== 메인 페이지 ===== */
export default function Page() {
    const [year,       setYear]       = useState('2023');
    const [reprtCode,  setReprtCode]  = useState('11011');
    const [busy,       setBusy]       = useState(false);

    // 카드 상태: idle | loading | ok | err
    const [results, setResults] = useState(
        Object.fromEntries(COMPANIES.map(co => [co.corp_code, { status: 'idle' }]))
    );

    // 특정 회사 카드 상태만 업데이트
    function patch(corpCode, update) {
        setResults(prev => ({ ...prev, [corpCode]: update }));
    }

    // 한 회사 데이터 조회 (CFS → OFS 자동 폴백)
    async function fetchOne(co) {
        patch(co.corp_code, { status: 'loading' });

        try {
            // 1차: 연결재무제표(CFS)
            let data = await callApi(co.corp_code, year, reprtCode, 'CFS');
            const cfsItems = extractIsItems(data.list);

            if (data.status === '000' && cfsItems) {
                patch(co.corp_code, { status: 'ok', items: cfsItems, fsDiv: 'CFS' });
                return;
            }

            // API 키 오류 등 치명적 에러는 재시도 없이 종료
            const FATAL = ['010', '011', '020', '100', '800'];
            if (FATAL.includes(data.status)) {
                patch(co.corp_code, { status: 'err', msg: `API 오류 (${data.status}): ${data.message}` });
                return;
            }

            // 2차: 개별재무제표(OFS) 폴백
            data = await callApi(co.corp_code, year, reprtCode, 'OFS');
            const ofsItems = extractIsItems(data.list);

            if (data.status !== '000' || !ofsItems) {
                patch(co.corp_code, { status: 'err', msg: data.message || '해당 기간의 데이터가 없습니다.' });
                return;
            }

            patch(co.corp_code, { status: 'ok', items: ofsItems, fsDiv: 'OFS' });

        } catch (e) {
            patch(co.corp_code, { status: 'err', msg: e.message });
        }
    }

    // 전체 조회 (3개사 병렬)
    async function handleSearch() {
        setBusy(true);
        await Promise.all(COMPANIES.map(fetchOne));
        setBusy(false);
    }

    return (
        <>
            <header className="app-header">
                <h1>DART 손익계산서 조회</h1>
                <p>금융감독원 전자공시시스템 Open API &nbsp;·&nbsp; 삼성전자 &nbsp;·&nbsp; SK하이닉스 &nbsp;·&nbsp; 두산로보틱스</p>
            </header>

            <main className="wrap">
                {/* 검색 영역 */}
                <div className="search-card">
                    <div className="search-card-title">조회 조건</div>
                    <div className="search-row">
                        <div className="field">
                            <label htmlFor="year">연도</label>
                            <select
                                id="year"
                                value={year}
                                onChange={e => setYear(e.target.value)}
                            >
                                <option value="2024">2024년</option>
                                <option value="2023">2023년</option>
                                <option value="2022">2022년</option>
                                <option value="2021">2021년</option>
                                <option value="2020">2020년</option>
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="reprtCode">보고서 유형</label>
                            <select
                                id="reprtCode"
                                value={reprtCode}
                                onChange={e => setReprtCode(e.target.value)}
                            >
                                <option value="11011">연간</option>
                                <option value="11012">반기 (2분기)</option>
                                <option value="11013">1분기</option>
                                <option value="11014">3분기</option>
                            </select>
                        </div>
                        <button
                            className="btn-query"
                            onClick={handleSearch}
                            disabled={busy}
                        >
                            {busy ? '조회 중...' : '조회'}
                        </button>
                    </div>
                </div>

                {/* 결과 카드 */}
                <div className="results-grid">
                    {COMPANIES.map(co => (
                        <CompanyCard
                            key={co.corp_code}
                            company={co}
                            state={results[co.corp_code]}
                        />
                    ))}
                </div>
            </main>
        </>
    );
}
