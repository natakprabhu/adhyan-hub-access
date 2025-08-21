import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Clock, Calendar as CalendarIcon, MapPin, User, CreditCard } from 'lucide-react';
import { format, addMonths, differenceInMonths, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';

interface BookingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingComplete: () => void;
  userProfile: any;
}

interface Seat {
  id: string;
  seat_number: number;
  type: string;
}

interface SeatStatus {
  seat_id: string;
  seat_number: number;
  available: boolean;
  waitlisted: boolean;
  occupant?: string;
}

export const BookingWizard = ({
  isOpen,
  onClose,
  onBookingComplete,
  userProfile,
}: BookingWizardProps) => {
  const [step, setStep] = useState(1);
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [bookingType, setBookingType] = useState<'12hr' | '24hr'>('12hr');
  const [slot, setSlot] = useState<'day' | 'night' | 'full'>('day');
  const [selectedSeat, setSelectedSeat] = useState<string>('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatStatuses, setSeatStatuses] = useState<SeatStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reset wizard when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFromDate(undefined);
      setToDate(undefined);
      setBookingType('12hr');
      setSlot('day');
      setSelectedSeat('');
      setSeats([]);
      setSeatStatuses([]);
    }
  }, [isOpen]);

  // Fetch seats when type, dates, or slot changes
  useEffect(() => {
    if (fromDate && toDate && (step === 3 || (step === 4 && bookingType === '12hr'))) {
      fetchSeats();
    }
  }, [fromDate, toDate, bookingType, slot, step]);

  const fetchSeats = async () => {
    if (!fromDate || !toDate) return;
    
    setIsLoading(true);
    try {
      // Determine seat range based on booking type
      const seatFilter = bookingType === '24hr' 
        ? { gte: 1, lte: 13 }
        : { gte: 14, lte: 50 };

      const { data: seatsData } = await supabase
        .from('seats')
        .select('*')
        .gte('seat_number', seatFilter.gte)
        .lte('seat_number', seatFilter.lte)
        .order('seat_number');

      setSeats(seatsData || []);

      // Check seat availability for the selected date range
      const statuses: SeatStatus[] = [];
      
      for (const seat of seatsData || []) {
        // Check for overlapping bookings in the selected date range
        const { data: conflictingBookings } = await supabase
          .from('bookings')
          .select(`
            *,
            users (name)
          `)
          .eq('seat_id', seat.id)
          .in('status', ['confirmed', 'pending'])
          .or(`and(start_time.lt.${toDate.toISOString()},end_time.gt.${fromDate.toISOString()})`);

        // Check waitlist
        const { data: waitlistCount } = await supabase
          .from('waitlist')
          .select('id')
          .eq('seat_id', seat.id);

        const available = !conflictingBookings || conflictingBookings.length === 0;
        const waitlisted = waitlistCount && waitlistCount.length > 0;

        statuses.push({
          seat_id: seat.id,
          seat_number: seat.seat_number,
          available,
          waitlisted,
          occupant: conflictingBookings?.[0]?.users?.name,
        });
      }

      setSeatStatuses(statuses);
    } catch (error) {
      console.error('Error fetching seats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch seat availability.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCost = () => {
    if (!fromDate || !toDate) return 0;
    const months = differenceInMonths(toDate, fromDate) + 1;
    const monthlyRate = bookingType === '24hr' ? 3800 : 2300;
    return months * monthlyRate;
  };

  const getFormattedDateRange = () => {
    if (!fromDate || !toDate) return '';
    return `${format(fromDate, 'MMM yyyy')} – ${format(toDate, 'MMM yyyy')}`;
  };

  const handleBooking = async () => {
    if (!selectedSeat || !fromDate || !toDate) return;

    setIsLoading(true);
    try {
      const selectedSeatStatus = seatStatuses.find(s => s.seat_id === selectedSeat);
      
      if (!selectedSeatStatus?.available) {
        // Add to waitlist
        const { error: waitlistError } = await supabase
          .from('waitlist')
          .insert({
            seat_id: selectedSeat,
            user_id: userProfile.id,
            slot: bookingType === '24hr' ? 'full' : slot,
          });

        if (waitlistError) throw waitlistError;

        toast({
          title: 'Added to Waitlist',
          description: 'You have been added to the waitlist for this seat.',
        });
      } else {
        // Create booking with Pending Payment status
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: userProfile.id,
            seat_id: selectedSeat,
            type: bookingType,
            slot: bookingType === '24hr' ? 'full' : slot,
            start_time: fromDate.toISOString(),
            end_time: toDate.toISOString(),
            status: 'pending',
            payment_status: 'pending'
          });

        if (bookingError) throw bookingError;

        toast({
          title: 'Booking Submitted',
          description: 'Your booking is pending payment. Please complete payment within 30 minutes.',
        });
      }

      onBookingComplete();
      onClose();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!fromDate || !toDate)) {
      toast({
        title: 'Select Dates',
        description: 'Please select both from and to dates.',
        variant: 'destructive',
      });
      return;
    }
    
    if (step === 2 && bookingType === '24hr') {
      setSlot('full');
      setStep(4); // Skip slot selection for 24hr
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step === 4 && bookingType === '24hr') {
      setStep(2);
    } else {
      setStep(step - 1);
    }
  };

  const getSeatColor = (seatStatus: SeatStatus) => {
    if (!seatStatus.available) return 'bg-seat-occupied text-white';
    if (seatStatus.waitlisted) return 'bg-seat-waitlisted text-black';
    return 'bg-seat-available text-black';
  };

  const totalSteps = bookingType === '24hr' ? 5 : 6;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Book a Seat - Step {step} of {totalSteps}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Date Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Select Booking Period
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">From Date</Label>
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    disabled={(date) => isBefore(date, new Date())}
                    className="rounded-md border"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">To Date</Label>
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    disabled={(date) => !fromDate || isBefore(date, fromDate)}
                    className="rounded-md border"
                  />
                </div>
              </div>
              {fromDate && toDate && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">
                      Selected period: <span className="font-medium text-foreground">{getFormattedDateRange()}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Duration: <span className="font-medium text-foreground">{differenceInMonths(toDate, fromDate) + 1} month(s)</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Booking Type Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Booking Type</h3>
              <RadioGroup
                value={bookingType}
                onValueChange={(value) => setBookingType(value as '12hr' | '24hr')}
              >
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="12hr" id="12hr" />
                      <Label htmlFor="12hr" className="flex-1 cursor-pointer">
                        <div className="space-y-1">
                          <div className="font-medium">12 Hour Booking</div>
                          <div className="text-sm text-muted-foreground">
                            Choose day or night slot • Seats 14-50 • ₹2,300/month
                          </div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="24hr" id="24hr" />
                      <Label htmlFor="24hr" className="flex-1 cursor-pointer">
                        <div className="space-y-1">
                          <div className="font-medium">24 Hour Booking</div>
                          <div className="text-sm text-muted-foreground">
                            Full day access • Seats 1-13 • ₹3,800/month
                          </div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>
          )}

          {/* Step 3: Time Slot Selection (only for 12hr bookings) */}
          {step === 3 && bookingType === '12hr' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Time Slot</h3>
              <RadioGroup value={slot} onValueChange={(value) => setSlot(value as 'day' | 'night')}>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="day" id="day" />
                      <Label htmlFor="day" className="flex-1 cursor-pointer">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Day Slot
                          </div>
                          <div className="text-sm text-muted-foreground">
                            9:00 AM - 9:00 PM
                          </div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="night" id="night" />
                      <Label htmlFor="night" className="flex-1 cursor-pointer">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Night Slot
                          </div>
                          <div className="text-sm text-muted-foreground">
                            9:00 PM - 9:00 AM
                          </div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>
          )}

          {/* Step 4: Seat Selection */}
          {((step === 4 && bookingType === '12hr') || (step === 4 && bookingType === '24hr')) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Seat</h3>
              {isLoading ? (
                <div className="text-center py-8">Loading available seats...</div>
              ) : (
                <>
                  <div className="grid grid-cols-6 gap-2">
                    {seatStatuses.map((seatStatus) => (
                      <Button
                        key={seatStatus.seat_id}
                        variant={selectedSeat === seatStatus.seat_id ? 'default' : 'outline'}
                        className={`h-12 text-sm ${
                          selectedSeat === seatStatus.seat_id 
                            ? 'ring-2 ring-primary' 
                            : getSeatColor(seatStatus)
                        }`}
                        onClick={() => setSelectedSeat(seatStatus.seat_id)}
                      >
                        {seatStatus.seat_number}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-seat-available rounded"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-seat-occupied rounded"></div>
                      <span>Occupied</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-seat-waitlisted rounded"></div>
                      <span>Waitlisted</span>
                    </div>
                  </div>

                  {selectedSeat && (
                    <Card>
                      <CardContent className="pt-4">
                        {(() => {
                          const seatStatus = seatStatuses.find(s => s.seat_id === selectedSeat);
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Seat:</span>
                                <span className="font-bold">{seatStatus?.seat_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <Badge variant={seatStatus?.available ? 'default' : 'secondary'}>
                                  {seatStatus?.available ? 'Available' : 'Will join waitlist'}
                                </Badge>
                              </div>
                              {seatStatus?.occupant && (
                                <div className="flex justify-between">
                                  <span>Current occupant:</span>
                                  <span className="text-sm">{seatStatus.occupant}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 5/6: Final Confirmation */}
          {((step === 5 && bookingType === '12hr') || (step === 5 && bookingType === '24hr')) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Final Confirmation
              </h3>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Booking Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Full Name:</span>
                    <span className="font-medium">{userProfile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Booking Period:</span>
                    <span className="font-medium">{getFormattedDateRange()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{differenceInMonths(toDate!, fromDate!) + 1} month(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seat Number:</span>
                    <span className="font-medium">
                      {seatStatuses.find(s => s.seat_id === selectedSeat)?.seat_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Booking Type:</span>
                    <span className="font-medium">
                      {bookingType === '24hr' ? '24 Hour' : `12 Hour (${slot === 'day' ? 'Day' : 'Night'})`}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total Cost:</span>
                    <span>₹{calculateCost().toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Rate: ₹{bookingType === '24hr' ? '3,800' : '2,300'}/month
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            {((step === 5 && bookingType === '12hr') || (step === 5 && bookingType === '24hr')) ? (
              <Button
                onClick={handleBooking}
                disabled={!selectedSeat || isLoading}
              >
                {isLoading ? 'Submitting...' : 'Confirm Booking'}
              </Button>
            ) : (
              <Button onClick={nextStep} disabled={isLoading}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};