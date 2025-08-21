import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BookingWizard } from '@/components/BookingWizard';
import { 
  Users, 
  MapPin, 
  Clock, 
  Calendar, 
  Wifi, 
  Shield, 
  Snowflake, 
  Droplets, 
  Volume2, 
  Lock, 
  Moon,
  Armchair
} from 'lucide-react';

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
    setIsLoading(true);
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();
      
      setUserProfile(profile);

      // Fetch seat statistics more efficiently
      const { data: seats } = await supabase
        .from('seats')
        .select('*');

      // Check how many seats are occupied
      const { data: bookings } = await supabase
        .from('bookings')
        .select('seat_id')
        .in('status', ['confirmed', 'pending']);

      const occupiedSeats = new Set(bookings?.map(b => b.seat_id) || []);

      const stats = {
        total: seats?.length || 0,
        available: (seats?.length || 0) - occupiedSeats.size,
        occupied: occupiedSeats.size,
        waitlisted: 0
      };

      setSeatStats(stats);
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
    <div className="min-h-screen bg-background p-4 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Welcome to Adhyan Library</h1>
          <p className="text-muted-foreground">
            Hello, {userProfile?.name || 'Loading...'}!
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </header>

      {userProfile && !userProfile.approved && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-800 text-sm">
              Your account is pending approval. You can browse but cannot book seats yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing Plans */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Our Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="relative">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>12 Hour Plan</CardTitle>
                <Badge variant="secondary">Popular</Badge>
              </div>
              <div className="text-3xl font-bold">₹2,300<span className="text-sm font-normal">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Choose Day (9 AM - 9 PM) or Night (9 PM - 9 AM)
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Seats 14-50 available
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Flexible timing options
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="relative border-primary">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>24 Hour Plan</CardTitle>
                <Badge>Premium</Badge>
              </div>
              <div className="text-3xl font-bold">₹3,800<span className="text-sm font-normal">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-primary" />
                  24/7 access anytime
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Premium seats 1-13
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Unlimited study hours
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Library Features */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Library Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="text-center p-4">
            <Armchair className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Spacious Desks</h3>
          </Card>
          <Card className="text-center p-4">
            <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Comfortable Seats with Headrest</h3>
          </Card>
          <Card className="text-center p-4">
            <Wifi className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Free WiFi</h3>
          </Card>
          <Card className="text-center p-4">
            <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">CCTV Surveillance</h3>
          </Card>
          <Card className="text-center p-4">
            <Snowflake className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Fully Air Conditioned</h3>
          </Card>
          <Card className="text-center p-4">
            <Droplets className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">RO Drinking Water</h3>
          </Card>
          <Card className="text-center p-4">
            <Volume2 className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Peaceful Study Environment</h3>
          </Card>
          <Card className="text-center p-4">
            <Lock className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">Locker</h3>
          </Card>
          <Card className="text-center p-4">
            <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-sm">24 x 7 Facility</h3>
          </Card>
        </div>
      </div>

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
            <div className="text-2xl font-bold text-seat-available">{seatStats.available}</div>
            <p className="text-xs text-muted-foreground">Ready to book</p>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Button 
          size="lg" 
          onClick={() => setShowBookingWizard(true)}
          disabled={!userProfile?.approved}
          className="w-full"
        >
          <Calendar className="mr-2 h-5 w-5" />
          Book a Seat
        </Button>
      </div>

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