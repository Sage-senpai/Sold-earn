import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import AnnouncementBar from '@/components/AnnouncementBar';

export const metadata: Metadata = {
  title: "SOL'D — Sales, on-chain. A decentralized sales guild on Solana.",
  description:
    "SOL'D is a decentralized sales guild on Solana. Vendors lock bounties in escrow, scouts mint a soulbound identity, and verified sales settle on-chain — paid the moment the chain confirms.",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon-512.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Unbounded:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AnnouncementBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
