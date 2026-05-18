import './globals.css';
import { AuthProvider } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'FactoryOS',
  description: 'Simple and beautiful factory operations suite',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster position="top-center" containerClassName="!top-[max(0.5rem,env(safe-area-inset-top))]" />
        </AuthProvider>
      </body>
    </html>
  );
}
