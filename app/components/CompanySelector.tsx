'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCompanies, SelectedCompany } from '../providers/CompanyContext';

const CLS_LABEL: Record<string, string> = {
    Y: '코스피', K: '코스닥', N: '코넥스', E: '기타',
};

export const COMPANY_COLORS = ['#1a73e8', '#EA0029', '#16a34a'];

export default function CompanySelector() {
    const { selected, addCompany, removeCompany } = useCompanies();
    const [query,    setQuery]    = useState('');
    const [results,  setResults]  = useState<SelectedCompany[]>([]);
    const [busy,     setBusy]     = useState(false);
    const [showDrop, setShowDrop] = useState(false);
    const [dropMsg,  setDropMsg]  = useState('');
    const wrapRef    = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setShowDrop(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // 실시간 검색 (debounce 300ms, 2글자 이상)
    const doSearch = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            setShowDrop(false);
            return;
        }
        setBusy(true);
        setDropMsg('');
        setShowDrop(true);
        try {
            const res  = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
            const data = await res.json();

            if (data.status && data.status !== '000') {
                setDropMsg(data.message ?? '검색 오류');
                setResults([]);
                return;
            }
            const list: SelectedCompany[] = data.list ?? [];
            setResults(list);
            if (list.length === 0) setDropMsg('검색 결과가 없습니다.');
        } catch {
            setDropMsg('검색 중 오류가 발생했습니다.');
            setResults([]);
        } finally {
            setBusy(false);
        }
    }, []);

    // 입력값 변경 시 debounce 트리거
    function handleChange(value: string) {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.trim().length < 2) {
            setResults([]);
            setDropMsg('');
            setShowDrop(false);
            return;
        }
        debounceRef.current = setTimeout(() => doSearch(value.trim()), 300);
    }

    function handleSelect(co: SelectedCompany) {
        addCompany(co);
        setShowDrop(false);
        setQuery('');
        setResults([]);
    }

    const maxed = selected.length >= 3;

    return (
        <div className="co-selector">
            <div className="selector-label">회사 선택 (최대 3개)</div>

            <div className="co-selector-row" ref={wrapRef}>
                <div className="selector-input-group">
                    <input
                        type="text"
                        className="selector-input"
                        placeholder={maxed
                            ? '최대 3개 선택됨 — × 버튼으로 제거 후 추가'
                            : '회사명 2글자 이상 입력 시 자동 검색 (예: 삼성전자)'}
                        value={query}
                        onChange={e => handleChange(e.target.value)}
                        disabled={maxed}
                        autoComplete="off"
                    />
                    {busy && <div className="search-spinner" />}
                </div>

                {showDrop && (
                    <div className="selector-drop">
                        {dropMsg && <div className="selector-drop-msg">{dropMsg}</div>}
                        {results.map(co => {
                            const alreadyIn = selected.some(s => s.corp_code === co.corp_code);
                            return (
                                <button
                                    key={co.corp_code}
                                    className={`selector-drop-item${alreadyIn ? ' sel-in' : ''}`}
                                    onClick={() => !alreadyIn && handleSelect(co)}
                                    disabled={alreadyIn}
                                    type="button"
                                >
                                    <span className="drop-co-name">{co.corp_name}</span>
                                    <div className="drop-co-meta">
                                        {co.corp_cls && (
                                            <span className={`cls-badge cls-${co.corp_cls}`}>
                                                {CLS_LABEL[co.corp_cls] ?? co.corp_cls}
                                            </span>
                                        )}
                                        {alreadyIn && <span className="already-label">선택됨</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 선택된 회사 칩 */}
            {selected.length > 0 && (
                <div className="co-chips">
                    {selected.map((co, i) => (
                        <div
                            key={co.corp_code}
                            className="co-chip"
                            style={{
                                borderColor: COMPANY_COLORS[i],
                                color:       COMPANY_COLORS[i],
                                background:  `${COMPANY_COLORS[i]}14`,
                            }}
                        >
                            <span className="chip-dot" style={{ background: COMPANY_COLORS[i] }} />
                            <span>{co.corp_name}</span>
                            <button
                                className="chip-remove"
                                onClick={() => removeCompany(co.corp_code)}
                                aria-label={`${co.corp_name} 제거`}
                                type="button"
                            >×</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
