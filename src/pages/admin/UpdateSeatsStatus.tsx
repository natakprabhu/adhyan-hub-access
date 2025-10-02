import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

interface SeatStatus {
  id: string;
  seat_number: number;
  status: string;
  seat_id: string | null;
  booking_id: string | null;
  updated_at: string;
}

export default function UpdateSeatsStatus() {
  const [seatsStatus, setSeatsStatus] = useState<SeatStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const fetchSeatsStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('seats_status')
        .select('*')
        .order('seat_number');

      if (error) throw error;
      setSeatsStatus(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWithBookings = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('sync_seats_status');
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Seats status synced with bookings',
      });
      
      await fetchSeatsStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateSeatStatus = async (seatId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('seats_status')
        .update({ status: newStatus })
        .eq('id', seatId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Seat status updated',
      });

      await fetchSeatsStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchSeatsStatus();
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Update Seats Status</h1>
          <Button onClick={syncWithBookings} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync with Bookings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Seats (1-50)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seat Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seatsStatus.map((seat) => (
                    <TableRow key={seat.id}>
                      <TableCell className="font-medium">
                        Seat {seat.seat_number}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            seat.status === 'available'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {seat.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {seat.booking_id ? seat.booking_id.slice(0, 8) + '...' : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(seat.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={seat.status}
                          onValueChange={(value) => updateSeatStatus(seat.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="occupied">Occupied</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Note:</strong> This page is accessible without login for public viewing.</p>
              <p><strong>Sync with Bookings:</strong> Updates all seat statuses based on current paid bookings.</p>
              <p><strong>Manual Update:</strong> Admins can manually change seat status using the dropdown.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
