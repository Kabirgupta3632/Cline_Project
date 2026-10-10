-- dispatch_events table for tracking anti-ghosting sweeps and cancellations
-- Feature: Dispatch (Person 4)

CREATE TABLE IF NOT EXISTS public.dispatch_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sos_id uuid NOT NULL REFERENCES public.sos_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- e.g. 'ghosted', 'cancelled', 'rematched'
  message text NOT NULL,    -- Human readable message to show in timeline
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_events ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users / anon depending on setup
-- In hackathon we allow public read for demo simplicity, similar to others
CREATE POLICY "Allow public read for dispatch_events" ON public.dispatch_events FOR SELECT USING (true);
CREATE POLICY "Allow service role write for dispatch_events" ON public.dispatch_events FOR ALL USING (true) WITH CHECK (true);
