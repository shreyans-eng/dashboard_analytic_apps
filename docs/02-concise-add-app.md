# Analytics — Concise: add a new app

Same 10 MVP KPIs, own BigQuery dataset, own sidebar tab, included in Compare.

## Steps

1. **Credentials** — SA JSON in `secrets/` (Data Viewer min; Data Editor if you want views).

2. **`.env`**
```bash
PRODUCTS=banknote,coinzy,YOURAPP

PRODUCT_YOURAPP_LABEL=YourApp
PRODUCT_YOURAPP_GCP_PROJECT=gcp-project-id
PRODUCT_YOURAPP_BQ_DATASET=analytics_XXXXXXXXX
PRODUCT_YOURAPP_GOOGLE_APPLICATION_CREDENTIALS=../secrets/yourapp-sa.json
PRODUCT_YOURAPP_PREFER_RAW=true
PRODUCT_YOURAPP_COLOR=#a78bfa
```

3. **Optional UI** — add entry in `banknote-analytics-dashboard/src/lib/product.tsx` → `PRODUCT_CATALOG`.

4. **Restart** — `cd banknote-analytics-dashboard && npm run dev`

5. **Verify** — switcher shows YourApp · open MVP tabs · Compare includes it.

## Rules

- Prefer **raw** (`PREFER_RAW=true`) until views are deployed.
- Log the same event contract as Banknote/Coinzy (`docs/03-full-queries-and-events.md`).
- Entity param: e.g. `stamp_id` instead of `banknote_id` / `coin_id`.

Full checklist: `docs/04-full-remaining-work.md` · Full env detail: `docs/adding-a-new-app.md`
