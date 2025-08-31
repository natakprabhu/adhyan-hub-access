import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Calendar, User, Crown, Users, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ActiveBooking {
  id: string;
  seat_category: 'fixed' | 'floating';
  membership_start_date: string;
  membership_end_date: string;
  status: string;
  payment_status: string;
  monthly_cost: number;
  duration_months: number;
  seat?: {
    seat_number: number;
  };
}

export default function MySeat() {
  const { user } = useAuth();
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchActiveBooking();
    }
  }, [user]);

  useEffect(() => {
    if (activeBooking) {
      const interval = setInterval(() => {
        calculateDaysRemaining();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeBooking]);

  const fetchActiveBooking = async () => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user?.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          seat_category,
          membership_start_date,
          membership_end_date,
          status,
          payment_status,
          monthly_cost,
          duration_months,
          seat:seats (seat_number)
        `)
        .eq('user_id', profile.id)
        .eq('status', 'confirmed')
        .eq('payment_status', 'paid')
        .gte('membership_end_date', new Date().toISOString().split('T')[0])
        .order('membership_end_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setActiveBooking(data as ActiveBooking);
      if (data) {
        calculateDaysRemaining();
      }
    } catch (error) {
      console.error('Error fetching active booking:', error);
      toast({
        title: "Error",
        description: "Failed to fetch your seat information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysRemaining = () => {
    if (!activeBooking) return;

    const endDate = new Date(activeBooking.membership_end_date);
    const now = new Date();
    const timeDiff = endDate.getTime() - now.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    setDaysRemaining(Math.max(0, days));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!activeBooking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Active Membership</CardTitle>
            <CardDescription>
              You don't have any active membership. Please book a seat to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = '/home'} className="w-full">
              Book a Seat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">My Seat</h1>
          <p className="text-muted-foreground">Your current membership details</p>
        </div>

        <div className="grid gap-6">
          {/* Membership Type Card */}
          <Card className={cn(
            "border-2 transition-all",
            activeBooking.seat_category === 'fixed' 
              ? "border-primary bg-gradient-to-br from-primary/10 to-background" 
              : "border-secondary bg-gradient-to-br from-secondary/10 to-background"
          )}>
            <CardHeader className="text-center">
              {activeBooking.seat_category === 'fixed' ? (
                <Crown className="h-16 w-16 mx-auto text-primary mb-4" />
              ) : (
                <Users className="h-16 w-16 mx-auto text-secondary mb-4" />
              )}
              <CardTitle className="text-3xl capitalize">
                {activeBooking.seat_category} Seat Membership
              </CardTitle>
              <CardDescription className="text-lg">
                {activeBooking.seat_category === 'fixed' 
                  ? 'Premium membership with dedicated resources'
                  : 'Flexible membership with any available seat'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Seat Number</p>
                      <p className="text-muted-foreground">
                        {activeBooking.seat_category === 'fixed' 
                          ? `Seat ${activeBooking.seat?.seat_number}` 
                          : 'Any Available Seat'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Membership Period</p>
                      <p className="text-muted-foreground">
                        {formatDate(activeBooking.membership_start_date)} - {formatDate(activeBooking.membership_end_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Access Hours</p>
                      <p className="text-muted-foreground">24×7 Access</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Monthly Cost</p>
                      <p className="text-muted-foreground">₹{activeBooking.monthly_cost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Days Remaining Card */}
          <Card className="text-center border-2 border-dashed border-primary/30">
            <CardContent className="pt-8 pb-8">
              <div className="space-y-4">
                <div className="text-6xl font-bold text-primary animate-pulse">
                  {daysRemaining}
                </div>
                <div className="text-2xl font-semibold text-foreground">
                  Days Remaining
                </div>
                <div className="text-muted-foreground">
                  Your membership expires on {formatDate(activeBooking.membership_end_date)}
                </div>
                
                {daysRemaining <= 7 && (
                  <Badge variant="destructive" className="text-sm px-4 py-2">
                    Membership Expiring Soon!
                  </Badge>
                )}
                
                {daysRemaining > 7 && daysRemaining <= 30 && (
                  <Badge variant="secondary" className="text-sm px-4 py-2">
                    Renewal Reminder
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="default" className="h-6 w-6 rounded-full p-0">
                    ✓
                  </Badge>
                  Membership Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment:</span>
                    <Badge variant="default">Paid</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span>{activeBooking.duration_months} month{activeBooking.duration_months > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Membership Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>24×7 facility access</span>
                  </div>
                  {activeBooking.seat_category === 'fixed' && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Personal locker included</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>High-speed WiFi</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Climate controlled environment</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Renewal Notice */}
          {daysRemaining <= 30 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader>
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Renewal Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-yellow-700">
                <p className="mb-3">
                  Your membership will expire in {daysRemaining} days. To avoid interruption in service, 
                  please contact our admin team for renewal.
                </p>
                <Button variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100">
                  Contact Admin for Renewal
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}