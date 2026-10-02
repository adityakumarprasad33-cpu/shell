import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Runix Console — Developer Terminal & Workspace',
  description:
    'Terminal, workspace, and code editor in one developer console. Cloud sandboxes, persistent sessions, cross-platform clients.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/logo-v2.png',
  },
  metadataBase: new URL('https://console.runix.in'),
  openGraph: {
    title: 'Runix Console — Developer Terminal & Workspace',
    description:
      'Terminal, workspace, and code editor in one developer console. Cloud sandboxes, persistent sessions, cross-platform clients.',
    url: 'https://console.runix.in',
    siteName: 'Runix Console',
    images: [
      {
        url: '/logo-v2.png',
        width: 1200,
        height: 630,
        alt: 'Runix Console',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#09090B] text-[#FAFAFA] min-h-screen flex flex-col antialiased selection:bg-[#315EF7]/20 selection:text-white" style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
