'use client';

import { useState, useRef, useEffect } from 'react';
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
    const wrapRef  = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setShowDrop(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function handleSearch() {
        const q = query.trim();
        if (!q) { inputRef.current?.focus(); return; }

        setBusy(true);
        setDropMsg('');
        setResults([]);
        setShowDrop(true);

        try {
            const res  = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
            const data = await res.json();

            if (data.status && data.status !== '000') {
                setDropMsg(data.message ?? '검색 오류');
                return;
            }

            const list: SelectedCompany[] = data.list ?? [];
            setResults(list);
            if (list.length === 0) setDropMsg('검색 결과가 없습니다.');
        } catch {
            setDropMsg('검색 중 오류가 발생했습니다.');
        } finally {
            setBusy(false);
        }
    }

    function handleSelect(co: SelectedCompany) {
        addCompany(co);
        setShowDrop(false);
        setQuery('');
    }

    const maxed = selected.length >= 3;

    return (
        <div className="co-selector">
            <div className="selector-label">회사 선택 (최대 3개)</div>

            <div className="co-selector-row" ref={wrapRef}>
                <div className="selector-input-group">
                    <input
                        ref={inputRef}
                        type="text"
                        className="selector-input"
                        placeholder={maxed ? '최대 3개 선택됨 — × 버튼으로 제거 후 추가' : '회사명 입력 후 검색 (예: 삼성전자)'}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !maxed && handleSearch()}
                        disabled={maxed}
                    />
                    <button
                        className="btn-search-co"
                        onClick={handleSearch}
                        disabled={busy || maxed}
                    >
                        {busy ? '…' : '검색'}
                    </button>
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
                            >×</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
