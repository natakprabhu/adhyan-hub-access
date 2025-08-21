import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BookingWizard } from '@/components/BookingWizard';
import { Clock, MapPin, Plus, Users, Armchair } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  approved: boolean;
}

interface SeatStats {
  total: number;
  available: number;
  occupied: number;
  waitlisted: number;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [seatStats, setSeatStats] = useState<SeatStats>({
    total: 0,
    available: 0,
    occupied: 0,
    waitlisted: 0
  });
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();
      
      setUserProfile(profile);

      // Fetch seat statistics
      const { data: allSeats } = await supabase
        .from('seats')
        .select('id, seat_number, type');

      if (allSeats) {
        const total = allSeats.length;
        let occupied = 0;
        let waitlisted = 0;

        // Check current occupancy
        const today = new Date().toISOString();
        
        for (const seat of allSeats) {
          // Check if seat is currently booked
          const { data: currentBooking } = await supabase
            .from('bookings')
            .select('id')
            .eq('seat_id', seat.id)
            .eq('status', 'confirmed')
            .lte('start_time', today)
            .gte('end_time', today)
            .limit(1);

          if (currentBooking && currentBooking.length > 0) {
            occupied++;
          }

          // Check if seat has waitlist
          const { data: waitlist } = await supabase
            .from('waitlist')
            .select('id')
            .eq('seat_id', seat.id)
            .limit(1);

          if (waitlist && waitlist.length > 0) {
            waitlisted++;
          }
        }

        const available = total - occupied;
        setSeatStats({ total, available, occupied, waitlisted });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
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

      {/* Seat Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Seats</CardTitle>
            <Armchair className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{seatStats.total}</div>
            <p className="text-xs text-muted-foreground">Library capacity</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{seatStats.available}</div>
            <p className="text-xs text-muted-foreground">Ready to book</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{seatStats.occupied}</div>
            <p className="text-xs text-muted-foreground">Currently booked</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waitlisted</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{seatStats.waitlisted}</div>
            <p className="text-xs text-muted-foreground">In queue</p>
          </CardContent>
        </Card>
      </div>

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
          onBookingComplete={fetchData}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}