import { Metadata } from 'next';
import { ReleaseCmsHub } from '@/components/admin/ReleaseCmsHub';

export const metadata: Metadata = {
  title: 'Runix — System Manager',
  description: 'Internal release distribution management.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminReleasesPage() {
  return <ReleaseCmsHub />;
}
