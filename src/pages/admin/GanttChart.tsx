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

      // Get bookings for the entire year
      const startOfYear = new Date(selectedMonth.getFullYear(), 0, 1);
      const endOfYear = new Date(selectedMonth.getFullYear(), 11, 31);

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          *,
          users (name),
          seats (seat_number)
        `)
        .gte('start_time', startOfYear.toISOString())
        .lte('end_time', endOfYear.toISOString())
        .eq('status', 'confirmed')
        .eq('payment_status', 'paid')
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

  // Get 15-day periods for the year
  const get15DayPeriods = () => {
    const year = selectedMonth.getFullYear();
    const periods = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      
      // First half (1-15)
      periods.push({
        start: new Date(year, month, 1),
        end: new Date(year, month, 15),
        label: `${monthName} 1-15`
      });
      
      // Second half (16-end)
      const lastDay = new Date(year, month + 1, 0).getDate();
      periods.push({
        start: new Date(year, month, 16),
        end: new Date(year, month, lastDay),
        label: `${monthName} 16-${lastDay}`
      });
    }
    
    return periods;
  };

  const getBookingsForSeatAndPeriod = (seatId: string, periodStart: Date, periodEnd: Date, slot?: string) => {
    return bookings.filter(booking => {
      // Only show confirmed bookings with paid status
      if (booking.status !== 'confirmed' || booking.payment_status !== 'paid') {
        return false;
      }
      
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      const isInTimeRange = bookingStart <= periodEnd && bookingEnd >= periodStart;
      const matchesSlot = !slot || booking.slot === slot || booking.type === 'full_day';
      return booking.seat_id === seatId && isInTimeRange && matchesSlot;
    });
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setFullYear(newDate.getFullYear() - 1);
      } else {
        newDate.setFullYear(newDate.getFullYear() + 1);
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

  const periods = get15DayPeriods();

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
                Yearly overview of confirmed and paid bookings (15-day periods)
              </CardDescription>
            </div>
              <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateYear('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-32 text-center">
                  {selectedMonth.getFullYear()}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateYear('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Header with periods */}
              <div className="grid grid-cols-[100px_1fr] gap-0 mb-2">
                <div className="p-2 border-b font-medium text-sm">Seat</div>
                <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
                  {periods.map((period, index) => (
                    <div key={index} className="p-1 border-b border-l text-xs text-center font-medium min-w-20">
                      {period.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Seat rows */}
              {seats.map((seat) => (
                <div key={seat.id}>
                  {/* 24hr seats - single row with double height */}
                  {seat.type === '24hr' ? (
                    <div className="grid grid-cols-[100px_1fr] gap-0 border-b">
                      <div className="p-2 border-r text-sm font-medium bg-gray-50" style={{ minHeight: '72px' }}>
                        Seat {seat.seat_number}
                        <br />
                        <span className="text-xs text-muted-foreground">24hr</span>
                      </div>
                      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
                        {periods.map((period, periodIndex) => {
                          const periodBookings = getBookingsForSeatAndPeriod(seat.id, period.start, period.end);
                          return (
                            <div key={periodIndex} className="border-l min-h-18 p-1" style={{ minHeight: '72px' }}>
                              {periodBookings.map((booking, bookingIndex) => (
                                <div
                                  key={bookingIndex}
                                  className="text-xs p-1 rounded border mb-1 bg-green-200 text-green-800 border-green-300"
                                  title={`${booking.user_name} - ${booking.type}`}
                                >
                                  {formatBookingText(booking)}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    // 12hr seats - two rows for day and night slots
                    <>
                      {/* Day slot row */}
                      <div className="grid grid-cols-[100px_1fr] gap-0 border-b">
                        <div className="p-2 border-r text-sm font-medium bg-blue-50">
                          Seat {seat.seat_number}
                          <br />
                          <span className="text-xs text-muted-foreground">Day</span>
                        </div>
                        <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
                          {periods.map((period, periodIndex) => {
                            const dayBookings = getBookingsForSeatAndPeriod(seat.id, period.start, period.end, 'day');
                            return (
                              <div key={periodIndex} className="border-l min-h-10 p-1">
                                {dayBookings.map((booking, bookingIndex) => (
                                  <div
                                    key={bookingIndex}
                                    className="text-xs p-1 rounded border mb-1 bg-green-200 text-green-800 border-green-300"
                                    title={`${booking.user_name} - Day slot`}
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
                          <span className="text-xs text-muted-foreground">Night</span>
                        </div>
                        <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
                          {periods.map((period, periodIndex) => {
                            const nightBookings = getBookingsForSeatAndPeriod(seat.id, period.start, period.end, 'night');
                            return (
                              <div key={periodIndex} className="border-l min-h-10 p-1">
                                {nightBookings.map((booking, bookingIndex) => (
                                  <div
                                    key={bookingIndex}
                                    className="text-xs p-1 rounded border mb-1 bg-green-200 text-green-800 border-green-300"
                                    title={`${booking.user_name} - Night slot`}
                                  >
                                    {formatBookingText(booking)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 border border-green-300 rounded"></div>
              <span>Confirmed & Paid Bookings</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};