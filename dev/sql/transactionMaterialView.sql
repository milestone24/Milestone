-- Create a function that only refreshes affected partitions
CREATE OR REPLACE FUNCTION refresh_accumulated_partial(affected_security_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete affected rows
  DELETE FROM security_transactions_accumulated 
  WHERE security_id = affected_security_id;
  
  -- Re-insert with fresh calculations
  INSERT INTO security_transactions_accumulated
  SELECT 
    id, security_id, value, currency_value, fees, currency, value_date, recorded_at, created_at, updated_at,
    (sum(value) over (partition by security_id order by value_date rows unbounded preceding)) as accumulated_value,
    (sum(currency_value) over (partition by security_id order by value_date rows unbounded preceding)) as accumulated_currency_value,
    (sum(fees) over (partition by security_id order by value_date rows unbounded preceding)) as accumulated_fees
  FROM security_transactions
  WHERE security_id = affected_security_id
  ORDER BY value_date;
END;
$$ LANGUAGE plpgsql;

-- Updated trigger function
CREATE OR REPLACE FUNCTION trigger_refresh_accumulated_partial()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_accumulated_partial(OLD.security_id);
  ELSE
    PERFORM refresh_accumulated_partial(NEW.security_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Now your queries are super fast
SELECT 
  currency_value,
  value_date,
  security_id,
  accumulated_currency_value
FROM security_transactions_accumulated
WHERE security_id = $1 
  AND value_date BETWEEN $2 AND $3
ORDER BY value_date;