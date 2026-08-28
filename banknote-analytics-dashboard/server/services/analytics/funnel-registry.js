/**
 * Product funnel step mappings — verified from app code + BigQuery only.
 * Do not add events without evidence. Empty product mapping → insufficient instrumentation.
 */

import { dauEventPredicateSql, resolvedUserIdSql } from './dau-definition.js';

/** @typedef {{ id: string, label: string, events: string[], isDrop?: boolean, core?: boolean }} FunnelStep */
/** @typedef {{ packEvents: string[], confirmEvents: string[], discountEventNames?: string[] }} PackMixDef */
/** @typedef {{ id: string, title: string, description: string, products: Record<string, FunnelStep[]>, cohortEvents?: Record<string, string[]>, packMix?: Record<string, PackMixDef> }} FunnelDef */

/**
 * Combined “got an image” (core) plus separate camera vs gallery rows.
 * Core stays click ∪ upload so the main leak is still “never took a photo”.
 * Side rows answer “did they shoot, or pick from gallery?”
 */
function photoCaptureSteps(index, { click, upload, cropScreen, cropTick }) {
  const nth = index === 1 ? 'First' : 'Second';
  const lower = nth.toLowerCase();
  return [
    {
      id: `photo_${index}`,
      label: `${nth} image (camera or gallery)`,
      events: [click, upload].filter(Boolean),
      core: true,
    },
    {
      id: `photo_click_${index}`,
      label: `${nth} image · camera`,
      events: [click],
    },
    {
      id: `photo_upload_${index}`,
      label: `${nth} image · gallery`,
      events: [upload],
    },
    {
      id: `crop_${index}`,
      label: `Crop ${lower} image`,
      events: [cropScreen],
    },
    {
      id: `crop_confirm_${index}`,
      label: `${nth} crop confirmed`,
      events: [cropTick],
    },
  ];
}

/** Banknote Identify — from Banknote-ai-identification/src/util/analytics.ts + tracking sheet */
const BANKNOTE_IDENTIFY = [
  {
    id: 'entry',
    label: 'Identify entry (nav ∪ home)',
    events: ['Identify_bottom_nav', 'Identify_home'],
    core: true,
  },
  {
    id: 'camera',
    label: 'Camera / photo screen',
    events: ['Identification_screen', 'photo_screen'],
    core: true,
  },
  {
    id: 'permission_popup',
    label: 'Camera permission popup',
    events: ['Camera_permission_popup'],
    core: true,
  },
  {
    id: 'permission_granted',
    label: 'Camera permission granted',
    events: ['camera_permission_granted'],
  },
  {
    id: 'permission_denied',
    label: 'Camera permission denied',
    events: ['camer_permission_denied', 'camera_permission_denied'],
    isDrop: true,
  },
  ...photoCaptureSteps(1, {
    click: 'photo_clicked_1',
    upload: 'photo_uploaded_1',
    cropScreen: 'photo_cropping_screen_1',
    cropTick: 'photo_crop_tick_1',
  }),
  ...photoCaptureSteps(2, {
    click: 'photo_clicked_2',
    upload: 'photo_uploaded_2',
    cropScreen: 'photo_cropping_screen_2',
    cropTick: 'photo_crop_tick_2',
  }),
  {
    id: 'photo_unspecified',
    label: 'Photo (unspecified)',
    events: ['Photo_clicked'],
  },
  {
    id: 'attempt',
    label: 'Scan attempted',
    events: ['Identification_attempted', 'Identification_done'],
    core: true,
  },
  {
    id: 'submit',
    label: 'Submit photos',
    events: ['photo_submit_button', 'photos_submitted'],
    core: true,
  },
  {
    id: 'quota_block',
    label: 'Quota / limit block',
    events: ['Identified_limit_reached', 'identiifcation_limit_exceeded', 'scan_quota_exhausted'],
    isDrop: true,
  },
  {
    id: 'success',
    label: 'Identification success',
    events: ['identification_done_success', 'Identification_done_success'],
    core: true,
  },
  {
    id: 'failure',
    label: 'Identification failure',
    events: ['identification_done_failure', 'Identification_done_failure'],
    isDrop: true,
  },
  {
    id: 'top_matches',
    label: 'Top 5 results displayed',
    events: ['identification_top5_matches'],
    core: true,
  },
  {
    id: 'view_all',
    label: 'View all other options',
    events: ['identification_view_all'],
  },
  {
    id: 'all_options',
    label: 'All options screen',
    events: ['identification_all_options_screen'],
  },
  {
    id: 'option_chosen',
    label: 'Option chosen',
    events: ['idetnification_option_chosen', 'identification_option_chosen'],
  },
  {
    id: 'details',
    label: 'ID / banknote details',
    events: ['identification_details_screen', 'banknote_details_identification'],
    core: true,
  },
  {
    id: 'add_collection',
    label: 'Add to collection after ID',
    events: ['Added_to_collection_identified', 'Added_to_collection_owned'],
    core: true,
  },
];

/**
 * Coinzy Identify — verified from CoinzyAndroid:
 * CameraScreen.kt, IdentifyViewModel.kt, CoinAnalysisScreen.kt, CoinMatchScreen.kt,
 * HomeScreen.kt, BottomNavigationBar.kt, FreeScanLimitUtil.kt
 */
const COINZY_IDENTIFY = [
  {
    id: 'entry',
    label: 'Identify entry (nav ∪ home)',
    events: ['Identify_bottom_nav', 'Identify_home'],
    core: true,
  },
  {
    id: 'camera',
    label: 'Camera / photo screen',
    events: ['Identification_screen', 'photo_screen'],
    core: true,
  },
  {
    id: 'permission_popup',
    label: 'Camera permission popup',
    events: ['Camera_permission_popup'],
    core: true,
  },
  {
    id: 'permission_granted',
    label: 'Camera permission granted',
    events: ['camera_permission_granted'],
  },
  {
    id: 'permission_denied',
    label: 'Camera permission denied',
    events: ['camer_permission_denied', 'camera_permission_denied'],
    isDrop: true,
  },
  ...photoCaptureSteps(1, {
    click: 'photo_clicked_1',
    upload: 'photo_uploaded_1',
    cropScreen: 'photo_cropping_screen_0',
    cropTick: 'photo_crop_tick_0',
  }),
  ...photoCaptureSteps(2, {
    click: 'photo_clicked_2',
    upload: 'photo_uploaded_2',
    cropScreen: 'photo_cropping_screen_1',
    cropTick: 'photo_crop_tick_1',
  }),
  {
    id: 'photo_unspecified',
    label: 'Photo (unspecified)',
    events: ['Photo_clicked'],
  },
  {
    id: 'crop_extra',
    label: 'Crop (slot 3, unused)',
    events: ['photo_cropping_screen_2'],
  },
  {
    id: 'crop_confirm_extra',
    label: 'Crop confirm (slot 3, unused)',
    events: ['photo_crop_tick_2'],
  },
  {
    id: 'attempt',
    label: 'Scan attempted',
    events: ['Identification_attempted'],
    core: true,
  },
  {
    id: 'submit',
    label: 'Submit photos',
    events: ['photo_submit_button', 'photos_submitted', 'Identification_done'],
    core: true,
  },
  {
    id: 'quota_block',
    label: 'Quota / limit block',
    events: [
      'Identified_limit_reached',
      'identiifcation_limit_exceeded',
      'free_scan_limit_exceeded',
      'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached',
    ],
    isDrop: true,
  },
  {
    id: 'success',
    label: 'Identification success',
    events: ['identification_done_success', 'Identification_done_success'],
    core: true,
  },
  {
    id: 'failure',
    label: 'Identification failure',
    events: [
      'identification_done_failure',
      'Identification_done_failure',
      'Identification_failed',
      'Identification_unsuccessful',
    ],
    isDrop: true,
  },
  {
    id: 'top_matches',
    label: 'Top 5 results displayed',
    events: ['identification_top5_matches'],
    core: true,
  },
  {
    id: 'view_all',
    label: 'View all other options',
    events: ['identification_view_all'],
  },
  {
    id: 'all_options',
    label: 'All options / multi-coin match',
    events: ['identification_all_options_screen'],
  },
  {
    id: 'option_chosen',
    label: 'Option chosen (typo event name in app)',
    events: ['idetnification_option_chosen', 'identification_option_chosen'],
  },
  {
    id: 'details',
    label: 'ID / coin details after ID',
    events: ['identification_details_screen', 'Coin_details_identification'],
    core: true,
  },
  {
    id: 'add_collection',
    label: 'Add to collection after ID',
    events: [
      'Added_to_collection_identified',
      'Added_to_collection_owned',
      'Added _to_collection_owned',
    ],
    core: true,
  },
];

const BANKNOTE_CATALOGUE = [
  {
    id: 'collection_tab',
    label: 'Collection bottom nav',
    events: ['private_collection_bottom_nav'],
  },
  {
    id: 'collection_screen',
    label: 'Collection screen',
    events: ['Collection_screen'],
    core: true,
  },
  {
    id: 'collection_clicked',
    label: 'Open collection card',
    events: ['Collection_clicked'],
    core: true,
  },
  {
    id: 'sub_collection',
    label: 'Sub-collection screen',
    events: ['Sub_collection_Screen'],
    core: true,
  },
  {
    id: 'sub_item',
    label: 'Sub-collection item tap',
    events: ['sub_collection_item'],
  },
  {
    id: 'details_collection',
    label: 'Details from collection',
    events: ['banknote_details_collection'],
    core: true,
  },
  {
    id: 'global_cta',
    label: 'Global catalogue CTA',
    events: ['Global_catalogue', 'View_all_button_global'],
  },
  {
    id: 'global_screen',
    label: 'Global catalogue screen',
    events: ['Global_catalogue_screen'],
    core: true,
  },
  {
    id: 'global_item',
    label: 'Global catalogue item',
    events: ['global_catalogue_item'],
    core: true,
  },
  {
    id: 'details_global',
    label: 'Details from global',
    events: ['banknote_details_global'],
    core: true,
  },
  {
    id: 'open_kpi',
    label: 'Catalogue open (KPI union)',
    events: [
      'Collection_screen',
      'Global_catalogue_screen',
      'Collection_open',
      'collection_open',
      'Collection',
      'My_collection',
    ],
  },
];

/**
 * Coinzy catalogue — verified from CoinzyAndroid:
 * CollectionScreen.kt, CollectionGrid.kt, WorldCollectionScreen.kt,
 * OwnedCollectionScreen.kt, CoinDetailsScreen.kt, HomeScreen.kt, BottomNavigationBar.kt
 * Bottom nav fires `{route}_bottom_nav` → collection_bottom_nav
 */
const COINZY_CATALOGUE = [
  {
    id: 'collection_tab',
    label: 'Collection bottom nav',
    events: ['collection_bottom_nav'],
  },
  {
    id: 'collection_screen',
    label: 'Collection screen',
    events: ['Collection_screen'],
    core: true,
  },
  {
    id: 'collection_clicked',
    label: 'Open collection card',
    events: ['Collection_clicked'],
    core: true,
  },
  {
    id: 'sub_collection',
    label: 'Sub-collection screen',
    events: ['Sub_collection_Screen'],
    core: true,
  },
  {
    id: 'sub_item',
    label: 'Sub-collection item tap',
    events: ['sub_collection_item'],
  },
  {
    id: 'details_collection',
    label: 'Coin details from collection',
    events: ['Coin_details_collection', 'Coin_details'],
    core: true,
  },
  {
    id: 'global_cta',
    label: 'Global catalogue CTA',
    events: ['Global_catalogue'],
  },
  {
    id: 'global_screen',
    label: 'Global catalogue screen',
    events: ['Global_catalogue_screen'],
    core: true,
  },
  {
    id: 'global_item',
    label: 'Global catalogue item',
    events: ['global_catalogue_item'],
    core: true,
  },
  {
    id: 'details_global',
    label: 'Coin details from global',
    events: ['Coin_details_global'],
    core: true,
  },
  {
    id: 'open_kpi',
    label: 'Catalogue open (KPI union)',
    events: ['Collection_screen', 'Global_catalogue_screen'],
    core: true,
  },
];

const BANKNOTE_MARKETPLACE = [
  {
    id: 'market_tab',
    label: 'Marketplace bottom nav',
    events: ['Marketplace_bottom_nav', 'marketplace_bottom_nav'],
    core: true,
  },
  {
    id: 'market_screen',
    label: 'Marketplace screen',
    events: ['marketplace_screen'],
    core: true,
  },
  {
    id: 'market_item',
    label: 'Listing tap (market_item_expolre)',
    events: ['market_item_expolre'],
    core: true,
  },
  {
    id: 'sale_details',
    label: 'Sale details screen',
    events: ['sale_Details_screen'],
    core: true,
  },
  {
    id: 'contact',
    label: 'Contact seller',
    events: ['market_contact', 'market_contact_button'],
    core: true,
  },
  {
    id: 'sell_cta',
    label: 'Add for sale CTA',
    events: ['add_for_sale_button_marketplace', 'add_for_sale_details_scr_btn'],
  },
  {
    id: 'listing_created',
    label: 'Listing published',
    events: ['market_add', 'market_contact_Add_for_sale'],
  },
  {
    id: 'feed_tab',
    label: 'Feed bottom nav',
    events: ['feed_bottom_nav'],
  },
  {
    id: 'feed_screen',
    label: 'Feed screen',
    events: ['Feed_screen'],
    core: true,
  },
  {
    id: 'feed_engage',
    label: 'Feed like / comment',
    events: ['feed_like', 'feed_comment'],
  },
  {
    id: 'feed_post',
    label: 'Feed create post',
    events: ['feed_add', 'feed_post'],
  },
];

/**
 * Coinzy Marketplace + Feed — verified from CoinzyAndroid:
 * MarketPlaceScreen.kt, AddForSaleScreen.kt, MarketDetailsScreen.kt,
 * CoinDetailsScreen.kt, FeedScreen.kt, CommunityViewModel.kt, BottomNavigationBar.kt
 * Note: app uses market_item_expolre (typo) — NOT Marketplace_open / contact_seller
 */
const COINZY_MARKETPLACE = [
  {
    id: 'market_tab',
    label: 'Marketplace bottom nav',
    events: ['marketplace_bottom_nav', 'Marketplace_bottom_nav'],
    core: true,
  },
  {
    id: 'market_screen',
    label: 'Marketplace screen',
    events: ['marketplace_screen'],
    core: true,
  },
  {
    id: 'market_item',
    label: 'Listing tap (market_item_expolre)',
    events: ['market_item_expolre'],
    core: true,
  },
  {
    id: 'sale_details',
    label: 'Sale details screen',
    events: ['sale_Details_screen'],
    core: true,
  },
  {
    id: 'contact',
    label: 'Contact seller',
    events: ['market_contact', 'market_contact_button'],
    core: true,
  },
  {
    id: 'sell_cta',
    label: 'Add for sale CTA',
    events: [
      'add_for_sale_button_marketplace',
      'add_for_sale_details_screen_button',
      'add_for_sale_owned_item_button',
    ],
  },
  {
    id: 'listing_created',
    label: 'Listing published',
    events: ['market_add'],
  },
  {
    id: 'feed_tab',
    label: 'Feed bottom nav',
    events: ['feed_bottom_nav'],
  },
  {
    id: 'feed_screen',
    label: 'Feed screen',
    events: ['Feed_screen'],
    core: true,
  },
  {
    id: 'feed_engage',
    label: 'Feed like / comment',
    events: ['feed_like', 'feed_comment'],
  },
  {
    id: 'feed_post',
    label: 'Feed create post',
    events: ['feed_add'],
  },
];

/**
 * Banknote in-app paywall (tracking sheet):
 * pack click (pack_name + discounted/non-discounted) → button → Google native → confirm / cancel / fail.
 * Impression is Subs_page (+ discount / Subscription_screen). Onboarding is a separate funnel.
 */
const BANKNOTE_PAYWALL = [
  {
    id: 'paywall',
    label: 'Paywall shown (standard + discount)',
    events: ['Subs_page', 'Subs_page_discount', 'Subscription_screen'],
    core: true,
  },
  {
    id: 'pack',
    label: 'Pack click',
    events: ['Subs_pack', 'subs_pack'],
    core: true,
  },
  {
    id: 'button',
    label: 'CTA click (trial / subscribe / purchase)',
    events: ['subs_button'],
    core: true,
  },
  {
    id: 'native',
    label: 'Google Play billing sheet opened',
    events: ['subs_native'],
    core: true,
  },
  {
    id: 'confirm',
    label: 'Purchase confirm',
    events: ['Subs_confirm'],
    core: true,
  },
  {
    id: 'cancel',
    label: 'Cancelled Google popup',
    events: ['Subs_cancel', 'subs_cancel'],
    isDrop: true,
  },
  {
    id: 'fail',
    label: 'Purchase failed',
    events: ['Subs_fail', 'subs_fail'],
    isDrop: true,
  },
];

/**
 * Coinzy in-app paywall. Onboarding pages (Subs_page_onboarding / _1/_2/_3) are a separate funnel.
 * Pack click is unique people per pack_name on Funnels → Paywall (pack mix table).
 */
const COINZY_PAYWALL = [
  {
    id: 'paywall',
    label: 'Paywall shown (standard + discount)',
    events: ['Subs_page', 'Subs_page_discount', 'Subscription_screen'],
    core: true,
  },
  {
    id: 'banner',
    label: 'Discount banner (home)',
    events: ['subs_discount_banner'],
  },
  {
    id: 'pack',
    label: 'Pack click',
    events: ['subs_pack', 'subs_pack_discount'],
    core: true,
  },
  {
    id: 'button',
    label: 'CTA click (trial / subscribe / purchase)',
    events: ['subs_button'],
    core: true,
  },
  {
    id: 'confirm',
    label: 'Purchase confirm',
    events: ['subs_confirm', 'subs_confirm_discount', 'paid_purchase', 'trial_purchase'],
    core: true,
  },
  {
    id: 'trial_started',
    label: 'Trial started',
    events: ['Trial_started'],
  },
  {
    id: 'cancel',
    label: 'Cancelled purchase',
    events: ['subs_cancel', 'Subs_cancel'],
    isDrop: true,
  },
  {
    id: 'fail',
    label: 'Purchase failed',
    events: ['subs_fail', 'Subs_fail'],
    isDrop: true,
  },
  {
    id: 'blocked',
    label: 'Already purchased (blocked)',
    events: ['subs_blocked_already_purchased'],
    isDrop: true,
  },
  {
    id: 'duplicate',
    label: 'Duplicate tap ignored',
    events: ['subs_duplicate_tap_ignored'],
  },
];

const BANKNOTE_ONBOARDING_PAYWALL = [
  {
    id: 'onboarding',
    label: 'Onboarding paywall shown',
    events: ['Subs_page_onboarding'],
    core: true,
  },
  {
    id: 'pack',
    label: 'Pack click (from onboarding)',
    events: ['Subs_pack', 'subs_pack'],
    core: true,
  },
  {
    id: 'button',
    label: 'CTA click (from onboarding)',
    events: ['subs_button'],
    core: true,
  },
  {
    id: 'native',
    label: 'Google Play billing sheet opened',
    events: ['subs_native'],
    core: true,
  },
  {
    id: 'confirm',
    label: 'Purchase confirm (from onboarding)',
    events: ['Subs_confirm'],
    core: true,
  },
  {
    id: 'cancel',
    label: 'Cancelled Google popup',
    events: ['Subs_cancel', 'subs_cancel'],
    isDrop: true,
  },
  {
    id: 'fail',
    label: 'Purchase failed',
    events: ['Subs_fail', 'subs_fail'],
    isDrop: true,
  },
];

const COINZY_ONBOARDING_EVENTS = [
  'Subs_page_onboarding',
  'subs_page_onboarding_1',
  'subs_page_onboarding_2',
  'subs_page_onboarding_3',
  'Subs_page_onboarding_skip',
];

/** Coinzy value-flow onboarding → subscription. Later steps count only people who saw onboarding. */
const COINZY_ONBOARDING_PAYWALL = [
  {
    id: 'onboarding',
    label: 'Onboarding started (any page)',
    events: ['Subs_page_onboarding', 'subs_page_onboarding_1', 'subs_page_onboarding_2', 'subs_page_onboarding_3'],
    core: true,
  },
  {
    id: 'onboarding_1',
    label: 'Onboarding page 1',
    events: ['subs_page_onboarding_1'],
  },
  {
    id: 'onboarding_2',
    label: 'Onboarding page 2',
    events: ['subs_page_onboarding_2'],
  },
  {
    id: 'onboarding_3',
    label: 'Onboarding page 3',
    events: ['subs_page_onboarding_3'],
  },
  {
    id: 'onboarding_skip',
    label: 'Skipped onboarding subscription',
    events: ['Subs_page_onboarding_skip'],
    isDrop: true,
  },
  {
    id: 'pack',
    label: 'Pack click (from onboarding)',
    events: ['subs_pack', 'subs_pack_discount'],
    core: true,
  },
  {
    id: 'button',
    label: 'CTA click (from onboarding)',
    events: ['subs_button'],
    core: true,
  },
  {
    id: 'confirm',
    label: 'Subscription taken (from onboarding)',
    events: ['subs_confirm', 'subs_confirm_discount', 'paid_purchase', 'trial_purchase'],
    core: true,
  },
  {
    id: 'trial_started',
    label: 'Trial started',
    events: ['Trial_started'],
  },
  {
    id: 'cancel',
    label: 'Cancelled purchase',
    events: ['subs_cancel', 'Subs_cancel'],
    isDrop: true,
  },
  {
    id: 'fail',
    label: 'Purchase failed',
    events: ['subs_fail', 'Subs_fail'],
    isDrop: true,
  },
];

const BANKNOTE_PACK_MIX = {
  packEvents: ['Subs_pack', 'subs_pack'],
  confirmEvents: ['Subs_confirm'],
};

const COINZY_PACK_MIX = {
  packEvents: ['subs_pack', 'subs_pack_discount'],
  confirmEvents: ['subs_confirm', 'subs_confirm_discount', 'paid_purchase', 'trial_purchase'],
  discountEventNames: ['subs_pack_discount', 'subs_confirm_discount'],
};

/**
 * Coinzy Expert Evaluation — events verified in BigQuery (Jul–Aug 2026).
 * Banknote has no expert_* instrumentation.
 * Core booking: landing → upload → continue (credit ∪ pay) → queued → report.
 * Start / list / status sit beside that path (upload users can exceed start).
 * Core credits: buy credits → continue payment → token received → consumed.
 */
export const COINZY_EXPERT_EVENTS = [
  'expert_evaluation_landing',
  'expert_evaluations_list',
  'expert_evaluation_start',
  'expert_evaluation_buy_credits',
  'expert_evaluation_view_all',
  'expert_evaluation_item_click',
  'expert_upload_photos',
  'expert_upload_continue_with_credit',
  'expert_upload_continue_payment',
  'expert_request_queued',
  'expert_evaluation_status',
  'expert_book_new_evaluation',
  'expert_book_new_evaluation_created',
  'expert_outbox_retry',
  'expert_outbox_retry_after_credits',
  'expert_request_retry_started',
  'expert_refund_requested',
  'expert_status_buy_credits_continue_payment',
  'expert_buy_credits_continue_payment',
  'expert_token_purchase_received',
  'expert_token_purchase_pending',
  'expert_token_purchase_cancelled',
  'expert_token_purchase_failed',
  'expert_token_purchase_consumed',
  'expert_token_verification_failed',
  'expert_evaluation_report',
  'expert_rating_submitted',
  'expert_report_pdf_download',
  'expert_report_pdf_share',
  'expert_report_pdf_failed',
];

const COINZY_EXPERT = [
  {
    id: 'landing',
    label: 'Expert landing',
    events: ['expert_evaluation_landing'],
    core: true,
  },
  {
    id: 'start',
    label: 'Start evaluation',
    events: ['expert_evaluation_start'],
  },
  {
    id: 'list',
    label: 'Evaluations list',
    events: ['expert_evaluations_list'],
  },
  {
    id: 'view_all',
    label: 'View all evaluations',
    events: ['expert_evaluation_view_all'],
  },
  {
    id: 'item_click',
    label: 'Open an evaluation',
    events: ['expert_evaluation_item_click'],
  },
  {
    id: 'upload',
    label: 'Upload photos',
    events: ['expert_upload_photos'],
    core: true,
  },
  {
    id: 'continue',
    label: 'Continue (credit or pay)',
    events: ['expert_upload_continue_with_credit', 'expert_upload_continue_payment'],
    core: true,
  },
  {
    id: 'queued',
    label: 'Request queued',
    events: ['expert_request_queued'],
    core: true,
  },
  {
    id: 'status',
    label: 'Evaluation status',
    events: ['expert_evaluation_status'],
  },
  {
    id: 'report',
    label: 'Expert report',
    events: ['expert_evaluation_report'],
    core: true,
  },
  {
    id: 'rating',
    label: 'Rating submitted',
    events: ['expert_rating_submitted'],
  },
  {
    id: 'pdf_download',
    label: 'Download report PDF',
    events: ['expert_report_pdf_download'],
  },
  {
    id: 'pdf_share',
    label: 'Share report PDF',
    events: ['expert_report_pdf_share'],
  },
  {
    id: 'book_new',
    label: 'Book new evaluation',
    events: ['expert_book_new_evaluation'],
  },
  {
    id: 'book_created',
    label: 'New evaluation created',
    events: ['expert_book_new_evaluation_created'],
  },
  {
    id: 'retry_outbox',
    label: 'Outbox retry',
    events: ['expert_outbox_retry'],
  },
  {
    id: 'retry_after_credits',
    label: 'Retry after credits',
    events: ['expert_outbox_retry_after_credits'],
  },
  {
    id: 'retry_started',
    label: 'Request retry started',
    events: ['expert_request_retry_started'],
  },
  {
    id: 'refund',
    label: 'Refund requested',
    events: ['expert_refund_requested'],
    isDrop: true,
  },
  {
    id: 'pdf_failed',
    label: 'Report PDF failed',
    events: ['expert_report_pdf_failed'],
    isDrop: true,
  },
  {
    id: 'buy_credits',
    label: 'Buy expert credits',
    events: ['expert_evaluation_buy_credits'],
    core: true,
  },
  {
    id: 'credits_continue',
    label: 'Credits → continue payment',
    events: [
      'expert_buy_credits_continue_payment',
      'expert_status_buy_credits_continue_payment',
    ],
    core: true,
  },
  {
    id: 'token_received',
    label: 'Token purchase received',
    events: ['expert_token_purchase_received'],
    core: true,
  },
  {
    id: 'token_consumed',
    label: 'Token consumed',
    events: ['expert_token_purchase_consumed'],
    core: true,
  },
  {
    id: 'token_pending',
    label: 'Token purchase pending',
    events: ['expert_token_purchase_pending'],
  },
  {
    id: 'token_cancelled',
    label: 'Token purchase cancelled',
    events: ['expert_token_purchase_cancelled'],
    isDrop: true,
  },
  {
    id: 'token_failed',
    label: 'Token purchase failed',
    events: ['expert_token_purchase_failed'],
    isDrop: true,
  },
  {
    id: 'token_verify_fail',
    label: 'Token verification failed',
    events: ['expert_token_verification_failed'],
    isDrop: true,
  },
];

function withIdentifyEntry(steps, entryLabel, entryEvents) {
  return steps.map((s) => (
    s.id === 'entry' ? { ...s, label: entryLabel, events: entryEvents } : s
  ));
}

const COLLECTION_STEP_IDS = new Set([
  'collection_tab', 'collection_screen', 'collection_clicked',
  'sub_collection', 'sub_item', 'details_collection',
]);
const GLOBAL_STEP_IDS = new Set([
  'global_cta', 'global_screen', 'global_item', 'details_global',
]);
const MARKET_STEP_IDS = new Set([
  'market_tab', 'market_screen', 'market_item', 'sale_details',
  'contact', 'sell_cta', 'listing_created',
]);
const FEED_STEP_IDS = new Set([
  'feed_tab', 'feed_screen', 'feed_engage', 'feed_post',
]);

function pickSteps(steps, ids, extraCoreIds = []) {
  const extra = new Set(extraCoreIds);
  return steps.filter((s) => ids.has(s.id)).map((s) => (
    extra.has(s.id) ? { ...s, core: true } : s
  ));
}

/** @type {Record<string, FunnelDef>} */
export const FUNNELS = {
  identify: {
    id: 'identify',
    title: 'Identify funnel',
    description: 'All entries → camera → first image (camera or gallery) → second image → submit → success',
    products: {
      banknote: BANKNOTE_IDENTIFY,
      coinzy: COINZY_IDENTIFY,
    },
  },
  'identify-nav': {
    id: 'identify-nav',
    title: 'Scan funnel · bottom nav',
    description: 'Identify_bottom_nav → camera → first image (camera or gallery) → second image → submit → success',
    products: {
      banknote: withIdentifyEntry(BANKNOTE_IDENTIFY, 'Bottom nav Identify', ['Identify_bottom_nav']),
      coinzy: withIdentifyEntry(COINZY_IDENTIFY, 'Bottom nav Identify', ['Identify_bottom_nav']),
    },
  },
  'identify-home': {
    id: 'identify-home',
    title: 'Scan funnel · home / banner',
    description: 'Identify_home (home/banner CTA) → camera → first image (camera or gallery) → second image → submit → success',
    products: {
      banknote: withIdentifyEntry(BANKNOTE_IDENTIFY, 'Home / banner Identify', ['Identify_home']),
      coinzy: withIdentifyEntry(COINZY_IDENTIFY, 'Home / banner Identify', ['Identify_home']),
    },
  },
  catalogue: {
    id: 'catalogue',
    title: 'Catalogue / Collection funnel',
    description: 'Private collection + global catalogue browse paths',
    products: {
      banknote: BANKNOTE_CATALOGUE,
      coinzy: COINZY_CATALOGUE,
    },
  },
  collection: {
    id: 'collection',
    title: 'Private collection funnel',
    description: 'Bottom nav / collection screen → card → sub-collection → details',
    products: {
      banknote: pickSteps(BANKNOTE_CATALOGUE, COLLECTION_STEP_IDS, ['collection_tab']),
      coinzy: pickSteps(COINZY_CATALOGUE, COLLECTION_STEP_IDS, ['collection_tab']),
    },
  },
  global: {
    id: 'global',
    title: 'Global catalogue funnel',
    description: 'Global catalogue screen → item → details',
    products: {
      banknote: pickSteps(BANKNOTE_CATALOGUE, GLOBAL_STEP_IDS),
      coinzy: pickSteps(COINZY_CATALOGUE, GLOBAL_STEP_IDS),
    },
  },
  marketplace: {
    id: 'marketplace',
    title: 'Marketplace funnel',
    description: 'Marketplace nav → listings → sale details → contact seller',
    products: {
      banknote: pickSteps(BANKNOTE_MARKETPLACE, MARKET_STEP_IDS),
      coinzy: pickSteps(COINZY_MARKETPLACE, MARKET_STEP_IDS),
    },
  },
  feed: {
    id: 'feed',
    title: 'Feed funnel',
    description: 'Feed nav → screen → like / comment → create post',
    products: {
      banknote: pickSteps(BANKNOTE_MARKETPLACE, FEED_STEP_IDS, ['feed_tab', 'feed_engage']),
      coinzy: pickSteps(COINZY_MARKETPLACE, FEED_STEP_IDS, ['feed_tab', 'feed_engage']),
    },
  },
  paywall: {
    id: 'paywall',
    title: 'Paywall → purchase funnel',
    description: 'In-app paywall shown → pack → CTA → (Banknote: Google sheet) → confirm. Pack mix is unique people per pack name.',
    products: {
      banknote: BANKNOTE_PAYWALL,
      coinzy: COINZY_PAYWALL,
    },
    packMix: {
      banknote: BANKNOTE_PACK_MIX,
      coinzy: COINZY_PACK_MIX,
    },
  },
  'paywall-onboarding': {
    id: 'paywall-onboarding',
    title: 'Onboarding → subscription funnel',
    description: 'People who saw onboarding, then pack / CTA / confirm. Confirm is only counted among that onboarding cohort.',
    products: {
      banknote: BANKNOTE_ONBOARDING_PAYWALL,
      coinzy: COINZY_ONBOARDING_PAYWALL,
    },
    cohortEvents: {
      banknote: ['Subs_page_onboarding'],
      coinzy: COINZY_ONBOARDING_EVENTS,
    },
    packMix: {
      banknote: BANKNOTE_PACK_MIX,
      coinzy: COINZY_PACK_MIX,
    },
  },
  expert: {
    id: 'expert',
    title: 'Expert evaluation funnel',
    description: 'Landing → upload → continue → queued → report; credits → token consumed',
    products: {
      coinzy: COINZY_EXPERT,
    },
  },
};

export function listFunnels() {
  return Object.values(FUNNELS).map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    products: Object.keys(f.products),
  }));
}

export function getFunnelSteps(funnelId, productId) {
  const funnel = FUNNELS[funnelId];
  if (!funnel) return null;
  const steps = funnel.products[productId];
  const cohortEvents = funnel.cohortEvents?.[productId] || [];
  const packMix = funnel.packMix?.[productId] || null;
  if (!steps || !steps.length) {
    return {
      funnel,
      steps: [],
      status: 'insufficient_instrumentation',
      message: `No verified event mapping for ${funnelId} on ${productId}`,
      cohortEvents,
      packMix,
    };
  }
  return { funnel, steps, status: 'ok', message: null, cohortEvents, packMix };
}

export function sqlStringLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * Cheap identity for interactive raw scans.
 * Skips UNNEST(event_params) so BigQuery does not bill the fat nested column.
 * Logged-in users still resolve via top-level user_id; everyone has user_pseudo_id.
 */
const CHEAP_USER = resolvedUserIdSql({ cheap: true });
const EVENT_BASE = `REGEXP_REPLACE(event_name, r'_(android|ios)$', '')`;
const DAU_EVENT = dauEventPredicateSql('event_name');

/**
 * One events_* scan (event_name + user_id + user_pseudo_id only).
 * Aggregates every step in a single SELECT so BigQuery cannot inline N copies of the CTE.
 */
export function buildFunnelSql(project, dataset, steps, startDate, endDate, options = {}) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const cohortEvents = options.cohortEvents || [];
  const allEvents = [...new Set([
    ...steps.flatMap((s) => s.events || []),
    ...cohortEvents,
  ])];
  const allList = allEvents.map(sqlStringLiteral).join(', ');
  const cohortList = cohortEvents.map(sqlStringLiteral).join(', ');
  const cohortHits = cohortList
    ? `COUNTIF(${EVENT_BASE} IN (${cohortList})) AS cohort_hits,`
    : '';
  const cohortFilter = cohortList ? 'AND cohort_hits > 0' : '';

  const userHits = steps.map((step, i) => {
    const evList = step.events.map(sqlStringLiteral).join(', ');
    return `COUNTIF(${EVENT_BASE} IN (${evList})) AS hits_${i}`;
  }).join(',\n    ');

  const aggCols = steps.map((_, i) => `
    COUNTIF(hits_${i} > 0) AS users_${i},
    COUNTIF(hits_${i} = 1) AS once_${i},
    COUNTIF(hits_${i} >= 2) AS repeat_${i},
    SUM(hits_${i}) AS hits_${i}`).join(',');

  const unpack = steps.map((step, i) => `
  SELECT
    ${i + 1} AS step_order,
    ${sqlStringLiteral(step.id)} AS step_id,
    ${sqlStringLiteral(step.label)} AS step_label,
    ${sqlStringLiteral(step.events.join(', '))} AS event_names,
    ${step.core ? 'TRUE' : 'FALSE'} AS is_core,
    ${step.isDrop ? 'TRUE' : 'FALSE'} AS is_drop,
    users_${i} AS users,
    once_${i} AS once_users,
    repeat_${i} AS repeat_users,
    hits_${i} AS hits,
    dau
  FROM agg`).join('\n  UNION ALL\n');

  return `
WITH per_user AS (
  SELECT
    ${CHEAP_USER} AS uid,
    COUNTIF(${DAU_EVENT}) AS dau_hits,
    ${cohortHits}
    ${userHits}
  FROM \`${project}.${dataset}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
    AND (${DAU_EVENT}${allList ? ` OR ${EVENT_BASE} IN (${allList})` : ''})
  GROUP BY uid
),
agg AS (
  SELECT
    COUNTIF(dau_hits > 0) AS dau,
    ${aggCols.trim()}
  FROM per_user
  WHERE uid IS NOT NULL
    ${cohortFilter}
),
steps AS (
${unpack}
),
core_chain AS (
  SELECT
    step_id,
    users,
    LAG(users) OVER (ORDER BY step_order) AS prev_users
  FROM steps
  WHERE is_core AND NOT is_drop
)
SELECT
  s.step_order,
  s.step_id,
  s.step_label,
  s.event_names,
  s.is_core,
  s.is_drop,
  s.users,
  s.once_users,
  s.repeat_users,
  s.hits,
  s.dau,
  SAFE_DIVIDE(s.users, s.dau) AS pct_of_dau,
  SAFE_DIVIDE(s.hits, NULLIF(s.users, 0)) AS hits_per_user,
  SAFE_DIVIDE(s.repeat_users, NULLIF(s.users, 0)) AS repeat_share,
  c.prev_users,
  SAFE_DIVIDE(s.users, c.prev_users) AS pct_of_previous,
  CASE
    WHEN c.prev_users IS NULL THEN NULL
    ELSE GREATEST(0, c.prev_users - s.users)
  END AS drop_off_users,
  CASE
    WHEN c.prev_users IS NULL THEN NULL
    ELSE 1 - SAFE_DIVIDE(s.users, c.prev_users)
  END AS drop_off_rate
FROM steps s
LEFT JOIN core_chain c ON c.step_id = s.step_id
ORDER BY s.step_order
`.trim();
}

/**
 * Unique people per pack_name × discounted / non-discounted.
 * Banknote Subs_pack params: pack name + discounted/non-discounted.
 * Coinzy uses subs_pack vs subs_pack_discount when the param is missing.
 * If cohortEvents is set, pack/confirm only count people who also saw those events.
 */
export function buildPackMixSql(project, dataset, {
  packEvents = [],
  confirmEvents = [],
  discountEventNames = [],
  cohortEvents = [],
  startDate,
  endDate,
} = {}) {
  const startS = String(startDate).replace(/-/g, '');
  const endS = String(endDate).replace(/-/g, '');
  const packList = packEvents.map(sqlStringLiteral).join(', ');
  const confirmList = confirmEvents.map(sqlStringLiteral).join(', ');
  const discountList = discountEventNames.map(sqlStringLiteral).join(', ');
  const cohortList = cohortEvents.map(sqlStringLiteral).join(', ');
  const allEvents = [...new Set([...packEvents, ...confirmEvents, ...cohortEvents])];
  const allList = allEvents.map(sqlStringLiteral).join(', ');
  const discountWhen = discountList
    ? `WHEN event_name_base IN (${discountList}) THEN 'discounted'`
    : '';
  const cohortCte = cohortList
    ? `,
cohort AS (
  SELECT DISTINCT uid
  FROM base
  WHERE event_name_base IN (${cohortList})
    AND uid IS NOT NULL
)`
    : '';
  const cohortJoin = cohortList
    ? 'INNER JOIN cohort c ON c.uid = b.uid'
    : '';

  return `
WITH base AS (
  SELECT
    ${CHEAP_USER} AS uid,
    ${EVENT_BASE} AS event_name_base,
    COALESCE(
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pack_name'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_name'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
      '(unnamed pack)'
    ) AS pack_name,
    LOWER(COALESCE(
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'discounted_type'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'discount'), ''),
      ''
    )) AS discount_param
  FROM \`${project}.${dataset}.events_*\` e
  WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
    AND ${EVENT_BASE} IN (${allList || "''"})
),
tagged AS (
  SELECT
    uid,
    event_name_base,
    pack_name,
    CASE
      WHEN discount_param IN ('discounted', 'discount', 'true', '1', 'yes') THEN 'discounted'
      WHEN discount_param IN ('non-discounted', 'non_discounted', 'nondiscounted', 'false', '0', 'no') THEN 'non-discounted'
      ${discountWhen}
      ELSE 'non-discounted'
    END AS discount_type
  FROM base
  WHERE uid IS NOT NULL
)${cohortCte},
confirmed AS (
  SELECT DISTINCT b.uid
  FROM tagged b
  ${cohortJoin}
  WHERE b.event_name_base IN (${confirmList || "''"})
)
SELECT
  p.pack_name,
  p.discount_type,
  COUNT(DISTINCT p.uid) AS users,
  COUNT(*) AS hits,
  SAFE_DIVIDE(COUNT(*), COUNT(DISTINCT p.uid)) AS hits_per_user,
  COUNT(DISTINCT CASE WHEN c.uid IS NOT NULL THEN p.uid END) AS confirmed_users,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN c.uid IS NOT NULL THEN p.uid END),
    COUNT(DISTINCT p.uid)
  ) AS confirm_rate
FROM tagged p
${cohortList ? 'INNER JOIN cohort co ON co.uid = p.uid' : ''}
LEFT JOIN confirmed c ON c.uid = p.uid
WHERE p.event_name_base IN (${packList || "''"})
GROUP BY p.pack_name, p.discount_type
ORDER BY users DESC, hits DESC
`.trim();
}

export function buildEventInventoryFromSummarySql(project, summaryDataset, startDate, endDate, search = '') {
  const searchFilter = search
    ? `AND LOWER(event_name_base) LIKE LOWER('%${String(search).replace(/'/g, "''")}%')`
    : '';
  return `
SELECT
  event_name_base AS event_name,
  SUM(event_count) AS hits,
  MAX(unique_users) AS unique_users,
  MIN(event_date) AS first_seen,
  MAX(event_date) AS last_seen,
  SAFE_DIVIDE(SUM(event_count), MAX(unique_users)) AS hits_per_user
FROM \`${project}.${summaryDataset}.top_events\`
WHERE event_date BETWEEN DATE '${startDate}' AND DATE '${endDate}'
  ${searchFilter}
GROUP BY event_name_base
ORDER BY hits DESC
LIMIT 500
`.trim();
}

export function buildEventInventorySql(project, dataset, startDate, endDate, search = '') {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const searchFilter = search
    ? `AND LOWER(${EVENT_BASE}) LIKE LOWER('%${String(search).replace(/'/g, "''")}%')`
    : '';

  return `
SELECT
  ${EVENT_BASE} AS event_name,
  COUNT(*) AS hits,
  COUNT(DISTINCT ${CHEAP_USER}) AS unique_users,
  MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
  MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen,
  SAFE_DIVIDE(COUNT(*), COUNT(DISTINCT ${CHEAP_USER})) AS hits_per_user
FROM \`${project}.${dataset}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  ${searchFilter}
GROUP BY event_name
ORDER BY hits DESC
LIMIT 500
`.trim();
}

/** Daily + range totals in one scan (ROLLUP). event_date IS NULL = range totals. */
export function buildEventDailySql(project, dataset, eventName, startDate, endDate) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const ev = sqlStringLiteral(eventName);

  return `
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  COUNT(*) AS hits,
  COUNT(DISTINCT ${CHEAP_USER}) AS unique_users
FROM \`${project}.${dataset}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  AND ${EVENT_BASE} = ${ev}
GROUP BY ROLLUP(event_date)
ORDER BY event_date
`.trim();
}

export function buildEventParamsSql(project, dataset, eventName, startDate, endDate) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const ev = sqlStringLiteral(eventName);

  return `
SELECT
  ep.key AS parameter_name,
  CASE
    WHEN ep.value.string_value IS NOT NULL THEN 'string'
    WHEN ep.value.int_value IS NOT NULL THEN 'int'
    WHEN ep.value.float_value IS NOT NULL THEN 'float'
    WHEN ep.value.double_value IS NOT NULL THEN 'double'
    ELSE 'other'
  END AS parameter_type,
  ANY_VALUE(COALESCE(
    ep.value.string_value,
    CAST(ep.value.int_value AS STRING),
    CAST(ep.value.float_value AS STRING),
    CAST(ep.value.double_value AS STRING)
  )) AS example_value,
  COUNT(*) AS occurrence_count
FROM \`${project}.${dataset}.events_*\` e, UNNEST(event_params) ep
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  AND REGEXP_REPLACE(e.event_name, r'_(android|ios)$', '') = ${ev}
  AND ep.key NOT IN ('user_id', 'user_pseudo_id', 'ga_session_id')
GROUP BY 1, 2
ORDER BY occurrence_count DESC
LIMIT 40
`.trim();
}
