import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CTG VLMS — Sàn vật liệu xây dựng',
    template: '%s · CTG VLMS',
  },
  description:
    'Sàn thương mại vật liệu xây dựng B2B theo chuẩn CTG BuildHub: đề nghị mua, hỏi giá, đơn hàng, nhận hàng và đối chiếu ba chiều.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
