import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface SeatStatus {
  id: string;
  seat_number: number;
  status: string;
  updated_at: string;
  seat_id: string | null;
  booking_id: string | null;
}

export default function UpdateSeatsStatus() {
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchSeats = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('seats_status')
      .select('*')
      .order('seat_number');

    if (error) {
      toast.error('Failed to load seats status');
      console.error(error);
    } else {
      setSeats(data || []);
    }
    setLoading(false);
  };

  const syncSeatsStatus = async () => {
    setSyncing(true);
    const { error } = await supabase.rpc('sync_seats_status');

    if (error) {
      toast.error('Failed to sync seats status');
      console.error(error);
    } else {
      toast.success('Seats status synced successfully');
      await fetchSeats();
    }
    setSyncing(false);
  };

  const toggleSeatStatus = async (seat: SeatStatus) => {
    const newStatus = seat.status === 'available' ? 'occupied' : 'available';
    
    const { error } = await supabase
      .from('seats_status')
      .update({ status: newStatus })
      .eq('id', seat.id);

    if (error) {
      toast.error('Failed to update seat status');
      console.error(error);
    } else {
      toast.success(`Seat ${seat.seat_number} updated to ${newStatus}`);
      await fetchSeats();
    }
  };

  useEffect(() => {
    fetchSeats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Seats Status Management</CardTitle>
                <CardDescription>
                  View and manage all seat statuses (1-50)
                </CardDescription>
              </div>
              <Button 
                onClick={syncSeatsStatus} 
                disabled={syncing}
                variant="outline"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync with Bookings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {seats.map((seat) => (
                <button
                  key={seat.id}
                  onClick={() => toggleSeatStatus(seat)}
                  className="relative aspect-square rounded-lg border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{
                    backgroundColor: seat.status === 'occupied' 
                      ? 'hsl(var(--destructive))' 
                      : 'hsl(var(--primary))',
                    borderColor: seat.status === 'occupied'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--primary))',
                  }}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-lg font-bold">{seat.seat_number}</span>
                    <Badge 
                      variant="secondary" 
                      className="mt-1 text-xs"
                    >
                      {seat.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-destructive"></div>
                <span>Occupied</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
