/**
 * Root layout for Draft Board application
 * Handles metadata, theme initialization, and global layout
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Draft Board',
  description: 'Create and manage sports drafts with real-time multiplayer support',
  keywords: ['draft', 'sports', 'team', 'multiplayer', 'realtime'],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme initialization script to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('draft-board-theme') || 'system';
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  // Fallback if localStorage is unavailable
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
        <div className="flex flex-col min-h-screen">{children}</div>
      </body>
    </html>
  );
}
