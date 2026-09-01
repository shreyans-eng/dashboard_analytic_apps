-- =============================================================================
-- v_subscription_metrics
-- Daily subscription funnel and outcome metrics.
-- Depends on: v_events_normalized
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_subscription_metrics` AS

WITH subs_events AS (
  SELECT
    event_date,
    platform,
    country,
    app_version,
    resolved_user_id,
    event_name_base,
    pack_name,
    discounted_type,
    action,
    error
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE event_name_base IN (
      'Subs_page',
      'Subs_page_discount',
      'Subscription_screen',
      'Subs_page_onboarding',
      'Subs_pack',
      'subs_pack',
      'subs_pack_discount',
      'subs_button',
      'Subs_confirm',
      'subs_confirm',
      'subs_confirm_discount',
      'paid_purchase',
      'trial_purchase',
      'Subs_fail',
      'subs_fail',
      'Subs_cancel',
      'subs_cancel',
      'Subs_restore',
      'subs_native',
      'go_pro_button',
      'subs_discount_banner',
      'subscription_shown'
    )
    OR event_name_base IN ('subscription', 'life_time_access', 'subscription_management_opened')
),

daily AS (
  SELECT
    event_date,
    platform,
    country,
    app_version,

    -- Funnel top (in-app paywall only; onboarding is Funnels → Onboarding → subs)
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Subs_page', 'Subs_page_discount', 'Subscription_screen'
      )
      THEN resolved_user_id END) AS users_saw_paywall,

    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen'
    )) AS paywall_impressions,
    COUNTIF(event_name_base = 'Subs_page')                          AS paywall_standard_impressions,
    COUNTIF(event_name_base = 'Subs_page_discount')                 AS paywall_discount_impressions,

    -- Pack selection (Banknote Subs_pack; Coinzy subs_pack)
    COUNTIF(event_name_base IN ('Subs_pack', 'subs_pack', 'subs_pack_discount')) AS pack_clicks,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN ('Subs_pack', 'subs_pack', 'subs_pack_discount')
      THEN resolved_user_id END) AS users_clicked_pack,

    -- Outcomes (Banknote Subs_confirm; Coinzy subs_confirm)
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
      'paid_purchase', 'trial_purchase'
    )) AS purchase_confirms,
    COUNTIF(event_name_base = 'subscription')                       AS direct_subscription_events,
    COUNTIF(event_name_base = 'life_time_access')                   AS lifetime_purchases,
    COUNTIF(event_name_base IN ('Subs_fail', 'subs_fail'))           AS purchase_failures,
    COUNTIF(event_name_base IN ('Subs_cancel', 'subs_cancel'))       AS purchase_cancels,
    COUNTIF(event_name_base = 'Subs_restore')                     AS restore_attempts,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase', 'trial_purchase'
      ) THEN resolved_user_id END) AS paying_users,

    -- Entry points
    COUNTIF(event_name_base = 'go_pro_button')                      AS go_pro_clicks,
    COUNTIF(event_name_base = 'subs_discount_banner')               AS discount_banner_clicks

  FROM subs_events
  GROUP BY event_date, platform, country, app_version
)

SELECT
  *,
  SAFE_DIVIDE(paying_users, users_saw_paywall)            AS paywall_to_confirm_rate,
  SAFE_DIVIDE(users_clicked_pack, users_saw_paywall)      AS paywall_to_pack_click_rate,
  SAFE_DIVIDE(paying_users, users_clicked_pack)           AS pack_click_to_confirm_rate,
  SAFE_DIVIDE(purchase_failures, purchase_failures + purchase_confirms) AS purchase_failure_rate
FROM daily;
