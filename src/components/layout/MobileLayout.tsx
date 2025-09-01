import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { Header } from '../Header';

interface MobileLayoutProps {
  children: ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pb-16 pt-4">
        {children}
      </div>
      <BottomNavigation />
    </div>
  );
};