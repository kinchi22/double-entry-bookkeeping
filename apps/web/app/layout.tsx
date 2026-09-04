import { type ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Double Entry Bookkeeping',
  description: 'Double-entry bookkeeping.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
