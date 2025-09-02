import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NewMembershipBookingWizard from '@/components/NewMembershipBookingWizard';
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
  Crown,
  Armchair
} from 'lucide-react';
import { format } from 'date-fns';
import { RulesModal } from '@/components/RulesModal';

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

interface RecentBooking {
  id: string;
  seat_number: number;
  type: string;
  slot?: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  created_at: string;
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
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
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

      // Fetch recent bookings for this user
      if (profile) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            id,
            type,
            slot,
            start_time,
            end_time,
            status,
            payment_status,
            created_at,
            seat_category,
            seats (seat_number)
          `)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);
        console.log(bookings);
        const formattedBookings: RecentBooking[] = bookings?.map(booking => ({
          id: booking.id,
          seat_number: booking.seats?.seat_number || 0,
          type: booking.type,
          slot: booking.slot,
          start_time: booking.start_time,
          end_time: booking.end_time,
          seat_category: booking.seat_category,
          status: booking.status,
          payment_status: booking.payment_status,
          created_at: booking.created_at,
        })) || [];

        setRecentBookings(formattedBookings);
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
    return <Navigate to="/" replace />;
  }

  return (
    <div className="bg-background p-4 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Welcome to Adhyan Library</h1>
        <p className="text-muted-foreground">
          Hello, {userProfile?.name || 'Loading...'}!
        </p>
      </div>

      {userProfile && !userProfile.approved && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-800 text-sm">
              Your account is pending approval. You can browse but cannot book seats yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Membership Plans */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Our Membership Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="relative">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Floating Seat
                </CardTitle>
                <Badge variant="secondary">Flexible</Badge>
              </div>
              <div className="text-3xl font-bold">₹2,200<span className="text-sm font-normal">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  24×7 access anytime
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Any available seat (1-50)
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  First come, first served
                </li>
                 <li className="flex items-center gap-2">
                   <Lock className="h-4 w-4 text-muted-foreground" />
                   <span className="line-through text-muted-foreground">Personal Locker</span>
                 </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="relative border-primary">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Fixed Seat
                </CardTitle>
                <Badge>Premium</Badge>
              </div>
              <div className="text-3xl font-bold">₹3,300<span className="text-sm font-normal">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  24×7 access anytime
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Dedicated seat (1-50)
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Your personal seat
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Personal locker included
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


      <div className="text-center space-y-3">
        <Button 
          size="lg" 
          onClick={() => setShowBookingWizard(true)}
          className="w-full"
        >
          <Calendar className="mr-2 h-5 w-5" />
          Book a Seat
        </Button>
        
        <RulesModal />
      </div>

{/* Recent Bookings */}
{recentBookings.length > 0 && (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Recent Bookings</h2>
    <div className="space-y-3">
      {recentBookings.map((booking) => (
        <Card key={booking.id} className="w-full">
          <CardContent className="pt-4">
            <div className="flex justify-between items-start">
              {/* Booking Info */}
              <div className="space-y-2">
                {/* Seat Details */}
                <div className="font-medium text-base">
                  {booking.type?.toLowerCase() === "floating"
                    ? "Any Available Seat"
                    : `Seat ${booking.seat_number || "-"}`}
                </div>

                {/* Category + Duration + Slot */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      booking.type?.toLowerCase() === "floating"
                        ? "bg-blue-500 text-white"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    {booking.type?.toLowerCase() === "floating"
                      ? "Floating Seat"
                      : "Fixed Seat"}
                  </Badge>

                </div>

                {/* Dates */}
                <div className="text-sm text-muted-foreground">
                  {format(new Date(booking.start_time), "MMM d, yyyy")} –{" "}
                  {format(new Date(booking.end_time), "MMM d, yyyy")}
                </div>

                {/* Created At */}
                <div className="text-xs text-muted-foreground">
                  Booked on{" "}
                  {format(new Date(booking.created_at), "MMM d, yyyy")}
                </div>
              </div>

              {/* Status + Payment */}
              <div className="flex flex-col gap-2 items-end">
                <Badge
                  variant={
                    booking.status === "confirmed"
                      ? "default"
                      : booking.status === "pending"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {booking.payment_status === "paid"
                    ? "Paid"
                    : booking.payment_status === "pending"
                    ? "Payment Pending"
                    : "Payment Failed"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)}


      {showBookingWizard && (
        <NewMembershipBookingWizard
          isOpen={showBookingWizard}
          onClose={() => setShowBookingWizard(false)}
          onBookingComplete={fetchData}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
