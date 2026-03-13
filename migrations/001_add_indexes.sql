-- ═══════════════════════════════════════════════════════════════════════
-- Hontrio v1 — Database indexes for performance
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Products: user lookups + sorting
CREATE INDEX IF NOT EXISTS idx_products_user_id_created 
  ON products(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_user_id_parent
  ON products(user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id_status
  ON products(user_id, status);

-- Credit transactions: user history
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON credit_transactions(user_id, created_at DESC);

-- Generated images: user + product lookups
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id
  ON generated_images(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_images_product_id
  ON generated_images(product_id);

CREATE INDEX IF NOT EXISTS idx_generated_images_status
  ON generated_images(user_id, status);

-- Agent conversations: user + session lookups
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_last
  ON agent_conversations(user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_session
  ON agent_conversations(session_id);

-- Visitor memory: fast lookup per user+visitor
CREATE INDEX IF NOT EXISTS idx_visitor_memory_user_visitor
  ON visitor_memory(user_id, visitor_id);

-- Visitor sessions: session lookup
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_session
  ON visitor_sessions(session_id);

-- Product intelligence: user + product
CREATE INDEX IF NOT EXISTS idx_product_intelligence_user
  ON product_intelligence(user_id, status);

-- Knowledge chunks: user lookup for RAG
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_user
  ON knowledge_chunks(user_id);

-- Risk orders: store + external
CREATE INDEX IF NOT EXISTS idx_risk_orders_store_external
  ON risk_orders(store_id, external_order_id);

-- Risk orders: customer lookup
CREATE INDEX IF NOT EXISTS idx_risk_orders_customer
  ON risk_orders(customer_id);

-- Unanswered questions: user + resolved
CREATE INDEX IF NOT EXISTS idx_unanswered_user_resolved
  ON unanswered_questions(user_id, resolved);

-- Users: email lookup (for OAuth)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Users: unique constraint on id (should exist but ensure)
-- ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE (id);

-- Escalation notifications: dedup check
CREATE INDEX IF NOT EXISTS idx_escalation_session_intent
  ON escalation_notifications(session_id, trigger_intent);

-- Stores: user lookup
CREATE INDEX IF NOT EXISTS idx_stores_user_id
  ON stores(user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Atomic credit deduction function (prevents race conditions)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE users 
  SET credits = credits - p_amount 
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO v_new_balance;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credite insuficiente';
  END IF;
  
  RETURN v_new_balance;
END;
$$;
