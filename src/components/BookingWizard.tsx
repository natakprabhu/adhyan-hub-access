import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Clock, Calendar, MapPin } from 'lucide-react';

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
  const [bookingType, setBookingType] = useState<'12hr' | '24hr'>('12hr');
  const [slot, setSlot] = useState<'day' | 'night' | 'full'>('day');
  const [selectedSeat, setSelectedSeat] = useState<string>('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatStatuses, setSeatStatuses] = useState<SeatStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSeats();
    }
  }, [isOpen, bookingType, slot]);

  const fetchSeats = async () => {
    try {
      const { data: seatsData } = await supabase
        .from('seats')
        .select('*')
        .eq('type', bookingType)
        .order('seat_number');

      setSeats(seatsData || []);

      // Check seat availability
      const statuses: SeatStatus[] = [];
      
      for (const seat of seatsData || []) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let startTime, endTime;
        
        if (bookingType === '24hr') {
          startTime = today.toISOString();
          endTime = tomorrow.toISOString();
        } else {
          const todayStr = today.toISOString().split('T')[0];
          if (slot === 'day') {
            startTime = `${todayStr}T09:00:00.000Z`;
            endTime = `${todayStr}T21:00:00.000Z`;
          } else {
            startTime = `${todayStr}T21:00:00.000Z`;
            const nextDay = new Date(today);
            nextDay.setDate(nextDay.getDate() + 1);
            endTime = `${nextDay.toISOString().split('T')[0]}T09:00:00.000Z`;
          }
        }

        // Check for existing bookings
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select(`
            *,
            users (name)
          `)
          .eq('seat_id', seat.id)
          .eq('status', 'confirmed')
          .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`);

        // Check waitlist
        const { data: waitlistCount } = await supabase
          .from('waitlist')
          .select('id')
          .eq('seat_id', seat.id)
          .eq('slot', bookingType === '24hr' ? 'full' : slot);

        const available = !existingBooking || existingBooking.length === 0;
        const waitlisted = waitlistCount && waitlistCount.length > 0;

        statuses.push({
          seat_id: seat.id,
          seat_number: seat.seat_number,
          available,
          waitlisted,
          occupant: existingBooking?.[0]?.users?.name,
        });
      }

      setSeatStatuses(statuses);
    } catch (error) {
      console.error('Error fetching seats:', error);
    }
  };

  const handleBooking = async () => {
    if (!selectedSeat) return;

    setIsLoading(true);
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let startTime, endTime;
      
      if (bookingType === '24hr') {
        startTime = today.toISOString();
        endTime = tomorrow.toISOString();
      } else {
        const todayStr = today.toISOString().split('T')[0];
        if (slot === 'day') {
          startTime = `${todayStr}T09:00:00.000Z`;
          endTime = `${todayStr}T21:00:00.000Z`;
        } else {
          startTime = `${todayStr}T21:00:00.000Z`;
          const nextDay = new Date(today);
          nextDay.setDate(nextDay.getDate() + 1);
          endTime = `${nextDay.toISOString().split('T')[0]}T09:00:00.000Z`;
        }
      }

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
        // Create booking
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: userProfile.id,
            seat_id: selectedSeat,
            type: bookingType,
            slot: bookingType === '24hr' ? 'full' : slot,
            start_time: startTime,
            end_time: endTime,
            status: userProfile.approved ? 'pending' : 'request',
          });

        if (bookingError) throw bookingError;

        toast({
          title: 'Booking Submitted',
          description: userProfile.approved 
            ? 'Your booking is pending payment confirmation.'
            : 'Your booking request has been submitted for admin review.',
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
    if (step === 1 && bookingType === '24hr') {
      setSlot('full');
      setStep(3);
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step === 3 && bookingType === '24hr') {
      setStep(1);
    } else {
      setStep(step - 1);
    }
  };

  const getSeatColor = (seatStatus: SeatStatus) => {
    if (!seatStatus.available) return 'bg-seat-occupied text-white';
    if (seatStatus.waitlisted) return 'bg-seat-waitlisted text-black';
    return 'bg-seat-available text-black';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Book a Seat - Step {step} of {bookingType === '24hr' ? 2 : 3}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Booking Type</h3>
              <RadioGroup
                value={bookingType}
                onValueChange={(value) => setBookingType(value as '12hr' | '24hr')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12hr" id="12hr" />
                  <Label htmlFor="12hr" className="flex-1">
                    <div>
                      <div className="font-medium">12 Hour Booking</div>
                      <div className="text-sm text-muted-foreground">
                        Choose day or night slot
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24hr" id="24hr" />
                  <Label htmlFor="24hr" className="flex-1">
                    <div>
                      <div className="font-medium">24 Hour Booking</div>
                      <div className="text-sm text-muted-foreground">
                        Full day access
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 2 && bookingType === '12hr' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Time Slot</h3>
              <RadioGroup value={slot} onValueChange={(value) => setSlot(value as 'day' | 'night')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="day" id="day" />
                  <Label htmlFor="day" className="flex-1">
                    <div>
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
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="night" id="night" />
                  <Label htmlFor="night" className="flex-1">
                    <div>
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
              </RadioGroup>
            </div>
          )}

          {((step === 3 && bookingType === '12hr') || (step === 2 && bookingType === '24hr')) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Seat</h3>
              <div className="grid grid-cols-5 gap-2">
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
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-seat-available rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-seat-occupied rounded"></div>
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
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
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            {((step === 3 && bookingType === '12hr') || (step === 2 && bookingType === '24hr')) ? (
              <Button
                onClick={handleBooking}
                disabled={!selectedSeat || isLoading}
              >
                {isLoading ? 'Submitting...' : 'Submit Booking'}
              </Button>
            ) : (
              <Button onClick={nextStep}>
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