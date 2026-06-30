'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface SelectedCompany {
    corp_code:  string;
    corp_name:  string;
    corp_cls:   string;
    stock_code: string;
}

interface CompanyContextValue {
    selected:      SelectedCompany[];
    addCompany:    (co: SelectedCompany) => void;
    removeCompany: (corp_code: string) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [selected, setSelected] = useState<SelectedCompany[]>([]);

    function addCompany(co: SelectedCompany) {
        setSelected(prev => {
            if (prev.length >= 3) return prev;
            if (prev.some(s => s.corp_code === co.corp_code)) return prev;
            return [...prev, co];
        });
    }

    function removeCompany(corp_code: string) {
        setSelected(prev => prev.filter(s => s.corp_code !== corp_code));
    }

    return (
        <CompanyContext.Provider value={{ selected, addCompany, removeCompany }}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompanies(): CompanyContextValue {
    const ctx = useContext(CompanyContext);
    if (!ctx) throw new Error('useCompanies must be inside CompanyProvider');
    return ctx;
}
