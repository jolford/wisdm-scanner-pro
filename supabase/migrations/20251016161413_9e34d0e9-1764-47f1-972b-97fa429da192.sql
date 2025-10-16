-- Create tenant usage tracking table
CREATE TABLE public.tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  
  -- Usage period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Document counts
  documents_processed INTEGER DEFAULT 0,
  documents_failed INTEGER DEFAULT 0,
  
  -- Cost tracking (in USD)
  ai_cost_usd DECIMAL(10, 4) DEFAULT 0,
  storage_cost_usd DECIMAL(10, 4) DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  -- Billing
  budget_limit_usd DECIMAL(10, 2),
  budget_alert_threshold DECIMAL(3, 2) DEFAULT 0.80, -- Alert at 80%
  budget_alert_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(customer_id, period_start, period_end)
);

-- Create indexes
CREATE INDEX idx_tenant_usage_customer ON public.tenant_usage(customer_id);
CREATE INDEX idx_tenant_usage_period ON public.tenant_usage(period_start, period_end);

-- Create cost alerts table
CREATE TABLE public.cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  tenant_usage_id UUID REFERENCES public.tenant_usage(id),
  
  -- Alert details
  alert_type TEXT NOT NULL, -- 'budget_warning', 'budget_exceeded', 'rate_limit'
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  
  -- Alert data
  current_spend_usd DECIMAL(10, 4),
  budget_limit_usd DECIMAL(10, 2),
  usage_percentage DECIMAL(5, 2),
  
  -- Status
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_cost_alerts_customer ON public.cost_alerts(customer_id, created_at DESC);
CREATE INDEX idx_cost_alerts_unacknowledged ON public.cost_alerts(acknowledged) WHERE acknowledged = false;

-- Enable RLS
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_usage
CREATE POLICY "Users can view their customer usage"
  ON public.tenant_usage FOR SELECT
  USING (has_customer(auth.uid(), customer_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage usage"
  ON public.tenant_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cost_alerts
CREATE POLICY "Users can view their customer alerts"
  ON public.cost_alerts FOR SELECT
  USING (has_customer(auth.uid(), customer_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can acknowledge their alerts"
  ON public.cost_alerts FOR UPDATE
  USING (has_customer(auth.uid(), customer_id))
  WITH CHECK (acknowledged = true AND acknowledged_by = auth.uid());

CREATE POLICY "Admins can manage alerts"
  ON public.cost_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to calculate AI cost based on model and tokens
CREATE OR REPLACE FUNCTION calculate_ai_cost(
  _model TEXT,
  _input_tokens INTEGER,
  _output_tokens INTEGER,
  _is_image BOOLEAN DEFAULT false
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cost DECIMAL := 0;
BEGIN
  -- Pricing per 1M tokens (approximate)
  CASE _model
    WHEN 'google/gemini-2.5-pro' THEN
      cost := (_input_tokens * 1.25 / 1000000.0) + (_output_tokens * 5.0 / 1000000.0);
      IF _is_image THEN cost := cost + 0.0025; END IF; -- Image processing fee
    
    WHEN 'google/gemini-2.5-flash' THEN
      cost := (_input_tokens * 0.15 / 1000000.0) + (_output_tokens * 0.60 / 1000000.0);
      IF _is_image THEN cost := cost + 0.0015; END IF;
    
    WHEN 'google/gemini-2.5-flash-lite' THEN
      cost := (_input_tokens * 0.075 / 1000000.0) + (_output_tokens * 0.30 / 1000000.0);
      IF _is_image THEN cost := cost + 0.0008; END IF;
    
    WHEN 'openai/gpt-5' THEN
      cost := (_input_tokens * 2.50 / 1000000.0) + (_output_tokens * 10.0 / 1000000.0);
      IF _is_image THEN cost := cost + 0.005; END IF;
    
    WHEN 'openai/gpt-5-mini' THEN
      cost := (_input_tokens * 0.30 / 1000000.0) + (_output_tokens * 1.20 / 1000000.0);
      IF _is_image THEN cost := cost + 0.002; END IF;
    
    WHEN 'openai/gpt-5-nano' THEN
      cost := (_input_tokens * 0.10 / 1000000.0) + (_output_tokens * 0.40 / 1000000.0);
      IF _is_image THEN cost := cost + 0.001; END IF;
    
    ELSE
      -- Default to gemini-flash pricing
      cost := (_input_tokens * 0.15 / 1000000.0) + (_output_tokens * 0.60 / 1000000.0);
      IF _is_image THEN cost := cost + 0.0015; END IF;
  END CASE;
  
  RETURN cost;
END;
$$;

-- Function to update tenant usage and check budget
CREATE OR REPLACE FUNCTION update_tenant_usage(
  _customer_id UUID,
  _job_type TEXT,
  _cost_usd DECIMAL,
  _documents_count INTEGER DEFAULT 1,
  _failed BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period_start DATE;
  _period_end DATE;
  _current_usage RECORD;
  _budget_limit DECIMAL;
  _usage_pct DECIMAL;
BEGIN
  -- Calculate current billing period (monthly)
  _period_start := DATE_TRUNC('month', CURRENT_DATE);
  _period_end := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Upsert usage record
  INSERT INTO tenant_usage (
    customer_id,
    period_start,
    period_end,
    documents_processed,
    documents_failed,
    ai_cost_usd,
    total_cost_usd
  )
  VALUES (
    _customer_id,
    _period_start,
    _period_end,
    CASE WHEN NOT _failed THEN _documents_count ELSE 0 END,
    CASE WHEN _failed THEN _documents_count ELSE 0 END,
    _cost_usd,
    _cost_usd
  )
  ON CONFLICT (customer_id, period_start, period_end)
  DO UPDATE SET
    documents_processed = tenant_usage.documents_processed + 
      CASE WHEN NOT _failed THEN _documents_count ELSE 0 END,
    documents_failed = tenant_usage.documents_failed + 
      CASE WHEN _failed THEN _documents_count ELSE 0 END,
    ai_cost_usd = tenant_usage.ai_cost_usd + _cost_usd,
    total_cost_usd = tenant_usage.total_cost_usd + _cost_usd,
    updated_at = NOW()
  RETURNING * INTO _current_usage;
  
  -- Check budget alerts
  IF _current_usage.budget_limit_usd IS NOT NULL AND _current_usage.budget_limit_usd > 0 THEN
    _budget_limit := _current_usage.budget_limit_usd;
    _usage_pct := (_current_usage.total_cost_usd / _budget_limit) * 100;
    
    -- Send warning at threshold (default 80%)
    IF _usage_pct >= (_current_usage.budget_alert_threshold * 100) 
       AND NOT _current_usage.budget_alert_sent THEN
      
      INSERT INTO cost_alerts (
        customer_id,
        tenant_usage_id,
        alert_type,
        severity,
        message,
        current_spend_usd,
        budget_limit_usd,
        usage_percentage
      )
      VALUES (
        _customer_id,
        _current_usage.id,
        'budget_warning',
        'warning',
        FORMAT('Budget alert: You have used $%s of your $%s monthly budget (%s%%)',
          ROUND(_current_usage.total_cost_usd, 2),
          ROUND(_budget_limit, 2),
          ROUND(_usage_pct, 1)
        ),
        _current_usage.total_cost_usd,
        _budget_limit,
        _usage_pct
      );
      
      -- Mark alert as sent
      UPDATE tenant_usage
      SET budget_alert_sent = true
      WHERE id = _current_usage.id;
    END IF;
    
    -- Send critical alert when exceeded
    IF _usage_pct >= 100 THEN
      INSERT INTO cost_alerts (
        customer_id,
        tenant_usage_id,
        alert_type,
        severity,
        message,
        current_spend_usd,
        budget_limit_usd,
        usage_percentage
      )
      VALUES (
        _customer_id,
        _current_usage.id,
        'budget_exceeded',
        'critical',
        FORMAT('Budget exceeded: You have spent $%s, exceeding your $%s monthly budget',
          ROUND(_current_usage.total_cost_usd, 2),
          ROUND(_budget_limit, 2)
        ),
        _current_usage.total_cost_usd,
        _budget_limit,
        _usage_pct
      );
    END IF;
  END IF;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_tenant_usage_updated_at
  BEFORE UPDATE ON public.tenant_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add default budgets for existing customers (null = unlimited)
INSERT INTO tenant_usage (customer_id, period_start, period_end)
SELECT 
  id,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
FROM customers
ON CONFLICT DO NOTHING;