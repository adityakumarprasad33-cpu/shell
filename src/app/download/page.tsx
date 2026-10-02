import { Metadata } from 'next';
import { DownloadHub } from '@/components/download/DownloadHub';

export const metadata: Metadata = {
  title: 'Runix Terminal — Download',
  description:
    'Download Runix Terminal for Windows, Linux, macOS and supported platforms.',
  alternates: {
    canonical: 'https://console.runix.in/download',
  },
  openGraph: {
    title: 'Runix Terminal — Download',
    description:
      'Download Runix Terminal for Windows, Linux, macOS and supported platforms.',
    url: 'https://console.runix.in/download',
    siteName: 'Runix Console',
    type: 'website',
  },
};

export default function DownloadPage() {
  return <DownloadHub />;
}
