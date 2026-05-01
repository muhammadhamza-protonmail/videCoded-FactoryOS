import './globals.css';
import { AuthProvider } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'FactoryOS',
  description: 'Simple and beautiful factory operations suite',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
