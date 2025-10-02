-- Create seats_status table
CREATE TABLE IF NOT EXISTS public.seats_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id uuid REFERENCES public.seats(id),
  seat_number integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available',
  updated_at timestamp with time zone DEFAULT now(),
  booking_id uuid REFERENCES public.bookings(id)
);

-- Enable RLS
ALTER TABLE public.seats_status ENABLE ROW LEVEL SECURITY;

-- Public can read all seats status
CREATE POLICY "Anyone can view seats status"
ON public.seats_status
FOR SELECT
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert seats status"
ON public.seats_status
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update
CREATE POLICY "Admins can update seats status"
ON public.seats_status
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete
CREATE POLICY "Admins can delete seats status"
ON public.seats_status
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
);

-- Initialize all 50 seats
INSERT INTO public.seats_status (seat_number, status)
SELECT 
  s.seat_number,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.seat_number = s.seat_number 
      AND b.payment_status = 'paid' 
      AND b.status = 'confirmed'
      AND b.membership_end_date >= CURRENT_DATE
    ) THEN 'occupied'
    ELSE 'available'
  END as status
FROM public.seats s
ON CONFLICT (seat_number) DO NOTHING;

-- Create trigger to auto-update timestamp
CREATE TRIGGER update_seats_status_updated_at
BEFORE UPDATE ON public.seats_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync seats_status with bookings
CREATE OR REPLACE FUNCTION public.sync_seats_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all seats status based on current bookings
  UPDATE public.seats_status ss
  SET 
    status = CASE 
      WHEN b.id IS NOT NULL THEN 'occupied'
      ELSE 'available'
    END,
    seat_id = b.seat_id,
    booking_id = b.id,
    updated_at = now()
  FROM (
    SELECT DISTINCT ON (seat_number)
      seat_number,
      seat_id,
      id
    FROM public.bookings
    WHERE payment_status = 'paid' 
      AND status = 'confirmed'
      AND membership_end_date >= CURRENT_DATE
    ORDER BY seat_number, membership_end_date DESC
  ) b
  WHERE ss.seat_number = b.seat_number;
  
  -- Set seats as available if no active booking
  UPDATE public.seats_status ss
  SET 
    status = 'available',
    seat_id = NULL,
    booking_id = NULL,
    updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.seat_number = ss.seat_number
      AND b.payment_status = 'paid'
      AND b.status = 'confirmed'
      AND b.membership_end_date >= CURRENT_DATE
  );
END;
$$;