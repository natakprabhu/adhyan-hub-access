import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Upload, Send } from 'lucide-react';
import { UsersManagement } from './UsersManagement';
import { BiometricManagement } from './BiometricManagement';

interface Booking {
  id: string;
  status: string;
  payment_status: string;
  type: string;
  slot?: string;
  start_time: string;
  end_time: string;
  admin_notes?: string;
  payment_screenshot_url?: string;
  receipt_sent: boolean;
  seat_id: string;
  user_id: string;
  users: {
    name: string;
    email: string;
  };
  seats: {
    seat_number: number;
  };
}

export const AdminDashboard = () => {
  const { adminUser, logout } = useAdminAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          users (name, email),
          seats (seat_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bookings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ [field]: value })
        .eq('id', bookingId);

      if (error) throw error;
      
      await fetchBookings();
      toast({
        title: "Success",
        description: `Booking ${field} updated successfully.`,
      });
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking.",
        variant: "destructive",
      });
    }
  };

  const uploadPaymentScreenshot = async (bookingId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${bookingId}.${fileExt}`;
      const filePath = `payment-screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin-uploads')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('admin-uploads')
        .getPublicUrl(filePath);

      await updateBookingStatus(bookingId, 'payment_screenshot_url', publicUrl);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      toast({
        title: "Error",
        description: "Failed to upload screenshot.",
        variant: "destructive",
      });
    }
  };

  const sendReceipt = async (booking: Booking) => {
    try {
      const { error } = await supabase.functions.invoke('send-receipt', {
        body: { bookingId: booking.id }
      });

      if (error) throw error;

      await updateBookingStatus(booking.id, 'receipt_sent', 'true');
      toast({
        title: "Success",
        description: "Receipt sent successfully.",
      });
    } catch (error) {
      console.error('Error sending receipt:', error);
      toast({
        title: "Error",
        description: "Failed to send receipt.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {adminUser?.username}</p>
          </div>
          <Button onClick={logout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="bookings">Manage Bookings</TabsTrigger>
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="biometric">Biometric Management</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <Card key={booking.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {booking.users.name} - Seat {booking.seats.seat_number}
                        </CardTitle>
                        <CardDescription>
                          {booking.type} {booking.slot && `(${booking.slot})`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                          {booking.status}
                        </Badge>
                        <Badge variant={booking.payment_status === 'paid' ? 'default' : 'destructive'}>
                          {booking.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Booking Status</Label>
                        <Select
                          value={booking.status}
                          onValueChange={(value) => updateBookingStatus(booking.id, 'status', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="timeout">Timeout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Payment Status</Label>
                        <Select
                          value={booking.payment_status}
                          onValueChange={(value) => updateBookingStatus(booking.id, 'payment_status', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="timeout">Timeout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Upload Payment Screenshot</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadPaymentScreenshot(booking.id, file);
                          }
                        }}
                      />
                      {booking.payment_screenshot_url && (
                        <p className="text-sm text-green-600 mt-1">✓ Screenshot uploaded</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => sendReceipt(booking)}
                        disabled={booking.receipt_sent}
                        variant="outline"
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {booking.receipt_sent ? 'Receipt Sent' : 'Send Receipt'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="biometric">
            <BiometricManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};