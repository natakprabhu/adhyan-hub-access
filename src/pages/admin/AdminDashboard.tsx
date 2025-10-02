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
import { GanttChart } from './GanttChart';
import { PasswordManager } from './PasswordManager';

interface Booking {
  id: string;
  status: string;
  payment_status: string;
  type: string;
  slot?: string;
  start_time: string;
  end_time: string;
  admin_notes?: string;
  description?: string;
  payment_screenshot_url?: string;
  receipt_sent: boolean;
  seat_id: string;
  user_id: string;
  seat_number?: number;
  users: {
    name: string;
    email: string;
    validity_from?: string;
    validity_to?: string;
  };
  seats?: {
    seat_number: number;
  } | null;
}

export const AdminDashboard = () => {
  const { adminUser, logout } = useAdminAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          users (name, email, validity_from, validity_to),
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

  const submitBookingChanges = async (bookingId: string, updates: any) => {
    try {
      // Get the current booking to check if we need to create a transaction
      const { data: currentBooking } = await supabase
        .from('bookings')
        .select('*, users(*)')
        .eq('id', bookingId)
        .single();

      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId);

      if (error) throw error;

      // If the booking was just confirmed and payment was just marked as paid, create a transaction
      if (updates.status === 'confirmed' && updates.payment_status === 'paid' && currentBooking) {
        // Check if transaction already exists
        const { data: existingTransaction } = await supabase
          .from('transactions')
          .select('id')
          .eq('booking_id', bookingId)
          .single();

        if (!existingTransaction) {
          // Calculate amount based on seat type and booking duration
          const startTime = new Date(currentBooking.start_time);
          const endTime = new Date(currentBooking.end_time);
          const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
          
          // Basic pricing logic - you can adjust this
          let amount = 0;
          if (currentBooking.type === '24hr') {
            amount = hours * 50; // ₹50 per hour for 24hr seats
          } else {
            amount = hours * 30; // ₹30 per hour for 12hr seats
          }

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert([{
              user_id: currentBooking.user_id,
              booking_id: bookingId,
              amount: amount,
              status: 'completed'
            }] as any);

          if (transactionError) {
            console.error('Error creating transaction:', transactionError);
          }
        }
      }

      // Update user validity period if booking is confirmed
      if (updates.status === 'confirmed' && currentBooking?.users) {
        const startDate = new Date(currentBooking.start_time);
        const endDate = new Date(currentBooking.end_time);
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            validity_from: startDate.toISOString().split('T')[0],
            validity_to: endDate.toISOString().split('T')[0]
          })
          .eq('id', currentBooking.user_id);

        if (userUpdateError) {
          console.error('Error updating user validity:', userUpdateError);
        }
      }
      
      await fetchBookings();
      setEditingBooking(null);
      toast({
        title: "Success",
        description: "Booking updated successfully.",
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
            <TabsTrigger value="gantt">Seat Schedule</TabsTrigger>
            <TabsTrigger value="password">Password Manager</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            <div className="grid gap-3">
              {bookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking) => (
                <Card key={booking.id} className="transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {booking.users.name} - Seat {booking.seats?.seat_number || booking.seat_number || 'N/A'}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {booking.type} {booking.slot && `(${booking.slot})`}
                        </CardDescription>
                        {booking.users.validity_from && booking.users.validity_to && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Valid: {new Date(booking.users.validity_from).toLocaleDateString()} - {new Date(booking.users.validity_to).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-col">
                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                          {booking.status}
                        </Badge>
                        <Badge variant={booking.payment_status === 'paid' ? 'default' : 'destructive'} className="text-xs">
                          {booking.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    {editingBooking === booking.id ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const updates = {
                          status: formData.get('status'),
                          payment_status: formData.get('payment_status'),
                          admin_notes: formData.get('admin_notes'),
                          description: formData.get('description'),
                          start_time: formData.get('start_time'),
                          end_time: formData.get('end_time'),
                        };
                        submitBookingChanges(booking.id, updates);
                      }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select name="status" defaultValue={booking.status}>
                              <SelectTrigger className="h-8">
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
                            <Label className="text-xs">Payment</Label>
                            <Select name="payment_status" defaultValue={booking.payment_status}>
                              <SelectTrigger className="h-8">
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
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Start Time</Label>
                            <Input 
                              name="start_time" 
                              type="datetime-local" 
                              defaultValue={new Date(booking.start_time).toISOString().slice(0, 16)}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">End Time</Label>
                            <Input 
                              name="end_time" 
                              type="datetime-local" 
                              defaultValue={new Date(booking.end_time).toISOString().slice(0, 16)}
                              className="h-8"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea 
                            name="description" 
                            defaultValue={booking.description || ''} 
                            placeholder="Add transaction description"
                            className="h-16 text-sm"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Admin Notes</Label>
                          <Textarea 
                            name="admin_notes" 
                            defaultValue={booking.admin_notes || ''} 
                            className="h-16 text-sm"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" size="sm" className="h-7 text-xs">Save Changes</Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setEditingBooking(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Upload Screenshot</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              className="h-8 text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadPaymentScreenshot(booking.id, file);
                                }
                              }}
                            />
                            {booking.payment_screenshot_url && (
                              <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              onClick={() => sendReceipt(booking)}
                              disabled={booking.receipt_sent}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {booking.receipt_sent ? 'Sent' : 'Receipt'}
                            </Button>
                            <Button
                              onClick={() => setEditingBooking(booking.id)}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                        
                        {booking.description && (
                          <div>
                            <Label className="text-xs">Description</Label>
                            <p className="text-xs text-muted-foreground mt-1">{booking.description}</p>
                          </div>
                        )}
                        
                        {booking.admin_notes && (
                          <div>
                            <Label className="text-xs">Admin Notes</Label>
                            <p className="text-xs text-muted-foreground mt-1">{booking.admin_notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Pagination */}
            {bookings.length > itemsPerPage && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm flex items-center px-3">
                  Page {currentPage} of {Math.ceil(bookings.length / itemsPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(bookings.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(bookings.length / itemsPerPage)}
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="biometric">
            <BiometricManagement />
          </TabsContent>

          <TabsContent value="gantt">
            <GanttChart />
          </TabsContent>

          <TabsContent value="password">
            <PasswordManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};