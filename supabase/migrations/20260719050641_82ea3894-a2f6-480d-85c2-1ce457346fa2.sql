
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
CREATE POLICY "edit own messages" ON public.messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
