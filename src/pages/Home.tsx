import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BookingWizard } from '@/components/BookingWizard';
import { CalendarDays, Clock, MapPin, Plus } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  approved: boolean;
}

interface CurrentBooking {
  id: string;
  seat_number: number;
  type: string;
  slot?: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentBooking, setCurrentBooking] = useState<CurrentBooking | null>(null);
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();
      
      setUserProfile(profile);

      // Fetch current booking
      if (profile) {
        const { data: booking } = await supabase
          .from('bookings')
          .select(`
            *,
            seats (seat_number)
          `)
          .eq('user_id', profile.id)
          .eq('status', 'confirmed')
          .gte('end_time', new Date().toISOString())
          .single();

        if (booking) {
          setCurrentBooking({
            ...booking,
            seat_number: booking.seats.seat_number
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Welcome back!</h1>
          <p className="text-muted-foreground">
            {userProfile?.name || 'Loading...'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </header>

      {!userProfile?.approved && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-800 text-sm">
              Your account is pending approval. You can browse seats but cannot make bookings yet.
            </p>
          </CardContent>
        </Card>
      )}

      {currentBooking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Current Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Seat Number:</span>
              <span className="text-2xl font-bold text-primary">
                {currentBooking.seat_number}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDateTime(currentBooking.start_time)} - {formatDateTime(currentBooking.end_time)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" />
              <span className="capitalize">
                {currentBooking.type}
                {currentBooking.slot && ` - ${currentBooking.slot}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            {userProfile?.approved 
              ? 'Book a new seat or manage your current booking'
              : 'Browse available seats (booking requires approval)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowBookingWizard(true)}
            className="w-full h-12"
            disabled={!userProfile?.approved}
          >
            <Plus className="h-5 w-5 mr-2" />
            {userProfile?.approved ? 'Book a Seat' : 'Request Seat (Pending Approval)'}
          </Button>
        </CardContent>
      </Card>

      {showBookingWizard && (
        <BookingWizard
          isOpen={showBookingWizard}
          onClose={() => setShowBookingWizard(false)}
          onBookingComplete={fetchUserData}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}