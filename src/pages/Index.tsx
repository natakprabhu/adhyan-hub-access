import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Header from "@/components/Header";
import Auth from './Auth';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is logged in, redirect to home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  // If not logged in, show login page with header
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center p-6">
        <Auth />
      </div>
    </div>
  );
};

export default Index;
