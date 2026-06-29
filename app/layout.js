import './globals.css';
import { CompanyProvider } from './providers/CompanyContext';

export const metadata = {
    title: 'DART 손익계산서 조회',
    description: '금융감독원 전자공시시스템 Open API 기반 손익계산서 조회',
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko">
            <body>
                <CompanyProvider>
                    {children}
                </CompanyProvider>
            </body>
        </html>
    );
}
