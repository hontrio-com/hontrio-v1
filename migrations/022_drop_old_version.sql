-- 022: șterge versiunea veche a platformei (12.11.2026, la cererea proprietarului, fără copie):
-- imaginile AI, creditele, asistentul de chat, baza de cunoștințe, monitorizarea concurenței,
-- Risk Shield, SEO, produsele vechi sincronizate, blogul și roadmap-ul. Plus coloanele rămase
-- de la marje și costuri (scoase pe 10.11.2026). Codul nu le mai folosește.
-- Atenție: site-ul vechi (ramura main, din aprilie) citea users.credits și users.plan.

drop table if exists
  public.image_bulk_items, public.image_bulk_jobs, public.image_ratings, public.image_style_templates,
  public.generated_images, public.generation_jobs, public.credit_transactions, public.brand_kits,
  public.seo_history, public.product_intelligence, public.product_events, public.review_requests,
  public.products,
  public.agent_messages, public.agent_conversations, public.agent_configs, public.agent_triggers,
  public.visitor_memory, public.visitor_sessions, public.integration_configs,
  public.knowledge_chunks, public.knowledge_documents, public.training_corrections,
  public.escalation_notifications, public.unanswered_questions,
  public.competitor_alerts, public.competitor_snapshots, public.competitor_reports, public.competitor_monitors,
  public.risk_identity_candidates, public.risk_audit_log, public.risk_alerts, public.risk_orders,
  public.risk_customers, public.risk_global_blacklist, public.risk_store_settings,
  public.roadmap_votes,
  public.blog_posts_tags, public.blog_posts, public.blog_tags, public.blog_categories
  cascade;

drop function if exists
  public.deduct_credits(uuid, integer),
  public.deduct_credits_atomic(uuid, integer),
  public.refund_credits(uuid, integer),
  public.increment_bulk_credits(uuid, integer),
  public.increment_job_counter(uuid, text),
  public.increment_template_usage(uuid, uuid),
  public.match_knowledge_chunks(vector, text, double precision, integer),
  public.match_product_intelligence(vector, text, double precision, integer),
  public.match_training_corrections(vector, text, double precision, integer),
  public.update_blog_updated_at(),
  public.update_risk_updated_at(),
  public.commerce_estimate_costs(uuid, numeric, text, text, boolean, boolean),
  public.commerce_import_costs(uuid, jsonb, text);

-- Folosită doar de baza de cunoștințe a asistentului vechi
drop extension if exists vector;

alter table public.users
  drop column if exists credits,
  drop column if exists plan,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists business_name,
  drop column if exists website,
  drop column if exists brand_tone,
  drop column if exists brand_language,
  drop column if exists niche,
  drop column if exists country;

alter table public.stores drop column if exists send_costs_to_google;
alter table public.commerce_offers drop column if exists cost_price, drop column if exists cost_source;
alter table public.ad_campaigns drop column if exists goal;
alter table public.ad_product_groups drop column if exists goal;
alter table public.google_ads_accounts drop column if exists is_selected;

-- Funcțiile rămase își fixează search_path (avertismentul Supabase „search_path mutable”)
alter function public.handle_updated_at() set search_path = '';
alter function public.update_ticket_timestamp() set search_path = '';
