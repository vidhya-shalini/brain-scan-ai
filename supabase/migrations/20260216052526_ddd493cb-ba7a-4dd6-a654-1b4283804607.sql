-- Add baseline_probabilities column for comparison graph feature
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS baseline_probabilities jsonb DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.predictions.baseline_probabilities IS 'Baseline model probabilities for comparison with current model output';