import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface SeatBooking {
  id: string;
  seat_id: string;
  seat_number: number;
  user_name: string;
  type: string;
  slot?: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
}

export const GanttChart = () => {
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get seats
      const { data: seatsData } = await supabase
        .from('seats')
        .select('*')
        .order('seat_number');

      setSeats(seatsData || []);

      // Get bookings for the selected month
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          *,
          users (name),
          seats (seat_number)
        `)
        .gte('start_time', startOfMonth.toISOString())
        .lte('end_time', endOfMonth.toISOString())
        .in('status', ['confirmed', 'pending'])
        .order('start_time');

      const formattedBookings = bookingsData?.map(booking => ({
        id: booking.id,
        seat_id: booking.seat_id,
        seat_number: booking.seats.seat_number,
        user_name: booking.users?.name || 'Unknown',
        type: booking.type,
        slot: booking.slot,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: booking.status,
        payment_status: booking.payment_status,
      })) || [];

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch schedule data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const getBookingsForSeatAndDate = (seatId: string, date: Date, slot?: string) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return bookings.filter(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      const isInTimeRange = bookingStart <= endOfDay && bookingEnd >= startOfDay;
      const matchesSlot = !slot || booking.slot === slot || booking.type === 'full_day';
      return booking.seat_id === seatId && isInTimeRange && matchesSlot;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getBookingColor = (booking: SeatBooking) => {
    if (booking.payment_status === 'paid' && booking.status === 'confirmed') {
      return 'bg-green-200 text-green-800 border-green-300';
    } else if (booking.status === 'pending') {
      return 'bg-yellow-200 text-yellow-800 border-yellow-300';
    } else {
      return 'bg-red-200 text-red-800 border-red-300';
    }
  };

  const formatBookingText = (booking: SeatBooking) => {
    const name = booking.user_name.split(' ')[0]; // First name only
    const slot = booking.slot && booking.slot !== 'full' ? booking.slot.charAt(0).toUpperCase() : 'F';
    return `${name} (${slot})`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const days = getDaysInMonth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Seat Schedule - Gantt View
              </CardTitle>
              <CardDescription>
                View seat bookings across time periods. Green = Confirmed & Paid, Yellow = Pending, Red = Issues
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-32 text-center">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Header with dates */}
              <div className="grid grid-cols-[100px_1fr] gap-0 mb-2">
                <div className="p-2 border-b font-medium text-sm">Seat</div>
                <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                  {days.map((day, index) => (
                    <div key={index} className="p-1 border-b border-l text-xs text-center font-medium min-w-16">
                      {day.getDate()}
                      <br />
                      <span className="text-muted-foreground text-xs">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seat rows */}
              {seats.map((seat) => (
                <div key={seat.id}>
                  {/* Full day bookings row */}
                  <div className="grid grid-cols-[100px_1fr] gap-0 border-b">
                    <div className="p-2 border-r text-sm font-medium bg-gray-50">
                      Seat {seat.seat_number}
                      <br />
                      <span className="text-xs text-muted-foreground">Full Day</span>
                    </div>
                    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                      {days.map((day, dayIndex) => {
                        const dayBookings = getBookingsForSeatAndDate(seat.id, day).filter(b => 
                          b.type === 'full_day' || (b.slot === 'full' || !b.slot)
                        );
                        return (
                          <div key={dayIndex} className="border-l min-h-12 p-1 relative">
                            {dayBookings.map((booking, bookingIndex) => (
                              <div
                                key={bookingIndex}
                                className={`text-xs p-1 rounded border mb-1 ${getBookingColor(booking)}`}
                                title={`${booking.user_name} - ${booking.type} - ${booking.status}`}
                              >
                                {formatBookingText(booking)}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Day slot row */}
                  <div className="grid grid-cols-[100px_1fr] gap-0 border-b">
                    <div className="p-2 border-r text-sm font-medium bg-blue-50">
                      <span className="text-xs text-muted-foreground">Day Slot</span>
                    </div>
                    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                      {days.map((day, dayIndex) => {
                        const dayBookings = getBookingsForSeatAndDate(seat.id, day, 'day');
                        return (
                          <div key={dayIndex} className="border-l min-h-10 p-1">
                            {dayBookings.map((booking, bookingIndex) => (
                              <div
                                key={bookingIndex}
                                className={`text-xs p-1 rounded border mb-1 ${getBookingColor(booking)}`}
                                title={`${booking.user_name} - Day slot - ${booking.status}`}
                              >
                                {formatBookingText(booking)}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Night slot row */}
                  <div className="grid grid-cols-[100px_1fr] gap-0 border-b">
                    <div className="p-2 border-r text-sm font-medium bg-purple-50">
                      <span className="text-xs text-muted-foreground">Night Slot</span>
                    </div>
                    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                      {days.map((day, dayIndex) => {
                        const nightBookings = getBookingsForSeatAndDate(seat.id, day, 'night');
                        return (
                          <div key={dayIndex} className="border-l min-h-10 p-1">
                            {nightBookings.map((booking, bookingIndex) => (
                              <div
                                key={bookingIndex}
                                className={`text-xs p-1 rounded border mb-1 ${getBookingColor(booking)}`}
                                title={`${booking.user_name} - Night slot - ${booking.status}`}
                              >
                                {formatBookingText(booking)}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 border border-green-300 rounded"></div>
              <span>Confirmed & Paid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-200 border border-yellow-300 rounded"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 border border-red-300 rounded"></div>
              <span>Issues</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};