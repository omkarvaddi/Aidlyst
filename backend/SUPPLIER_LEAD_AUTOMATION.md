# Supplier Lead Generation Automation

This automation builds the private Aidlyst supplier pipeline. It is a research,
deal-prep, and outreach-drafting workflow only. It must not publish products,
open checkout, send emails, or claim a supplier is verified without manual
review.

## Backend Storage

Production storage belongs in Postgres/Supabase using `backend/db/schema.sql`.
The supplier automation should write to these private tables:

- `supplier_lead_research_runs`: one row per daily automation run.
- `supplier_lead_records`: one deduplicated manufacturer or medtech company lead.
- `supplier_contact_points`: public business phone, email, contact form, and company profile routes.
- `supplier_deals`: the Aidlyst deal thesis and stage for each qualified company.
- `supplier_outreach_drafts`: email, phone, voicemail, LinkedIn, contact-form, and meeting-question drafts.
- `supplier_meeting_packets`: one-page meeting prep for approved calls.
- `national_healthcare_entities`, `entity_locations`, `entity_external_identifiers`, `manufacturer_profiles`, `supplier_verification_profiles`, and `regulatory_product_records`: normalized entity, location, FDA/GUDID/510(k), and supplier verification records.
- `data_quality_findings`: duplicate, stale-source, missing-identifier, unsupported-claim, and privacy-risk issues.

Local development may keep generated outputs in `backend/data/`, which is
ignored by git. Do not store private pricing, non-public supplier notes, or
buyer/RFQ data in public storefront files, public APIs, screenshots, or
checked-in CSV exports.

## Boston-First Target Scene

Start in the Boston-Cambridge medical device corridor before broad East Coast
coverage. Treat the primary market scene as:

- Boston, Cambridge, Somerville, Medford, Watertown, Waltham, Lexington, Bedford, Burlington, Billerica, Lowell, Lawrence, Andover, Woburn, Framingham, Natick, Marlborough, Worcester, Quincy, Braintree, Norwood, Mansfield, and Providence-adjacent Massachusetts/Rhode Island leads.
- Priority customer context: wound-care clinics, lymphedema/vascular clinics, ASCs, outpatient rehab/PT, home-health/DME buyers, independent provider groups, and smaller facilities that need supplier verification and quote routing.
- Priority supplier/product context: wound care, compression, bracing, rehab, DME, diagnostics, infection control, patient handling, ostomy/urology, respiratory accessories, and clinical supplies.

After Boston produces a working lead/deal loop, expand in this order:

1. East Coast.
2. West Coast.
3. Midwest/South.
4. National backfill.

## Daily Automation Prompt

```text
Run Aidlyst supplier lead generation for the Boston-first medical device and medtech scene.

Business model:
Aidlyst is not buying manufacturer inventory. Aidlyst is building a direct-pipeline marketplace and procurement-routing system. Approved manufacturers or medtech partners can list approved products on Aidlyst, fulfill directly or through an approved route, keep the majority of product revenue, and pay Aidlyst a small transaction percentage on completed sales. The automation must not describe Aidlyst as a distributor buying inventory, a guaranteed sales channel, a GPO, a clinical validator, or a reimbursement guarantor.

Primary geography:
Start with Boston, Cambridge, Somerville, Medford, Watertown, Waltham, Lexington, Bedford, Burlington, Billerica, Lowell, Lawrence, Andover, Woburn, Framingham, Natick, Marlborough, Worcester, Quincy, Braintree, Norwood, Mansfield, and nearby Massachusetts/Rhode Island medtech corridors. Only after the Boston scene has enough qualified leads should the workflow broaden to the East Coast, then West Coast, then Midwest/South.

Daily target:
Find 10-25 new qualified manufacturer, medtech, DME, wound care, compression, rehab, or clinical supply leads. Deduplicate against existing backend records by legal name, domain, phone, FDA owner/operator name, FDA FEI/registration number, address, and normalized company name. Add only leads with enough public source evidence for review.

Source priorities:
- FDA Device Establishment Registration and Listing.
- FDA Product Classification Database.
- FDA 510(k) database.
- AccessGUDID/GUDID device records.
- openFDA medical device recalls.
- CMS DMEPOS and relevant coverage pages.
- Company websites, catalogs, public product pages, contact pages, distributor/dealer pages, trade association directories, public press releases, and Massachusetts/Boston-area medtech ecosystem pages.

Product taxonomy to map:
- Wound care: dressings, foam dressings, hydrocolloid, hydrogel, alginate, collagen, antimicrobial dressings, wound cleansers, skin prep, tapes, wraps, negative pressure wound therapy accessories where appropriate.
- Compression and lymphedema: compression garments, adjustable wraps, bandaging systems, donning/doffing aids, custom garments, nighttime garments.
- Orthotics and bracing: knee, ankle, wrist, back, neck, shoulder, post-op braces, splints.
- Rehab and physical therapy: therapy bands, mobility aids, CPM devices, hot/cold therapy, exercise therapy products.
- DME/home medical equipment: walkers, canes, crutches, wheelchairs, rollators, beds, mattresses, cushions, transfer aids.
- Respiratory: nebulizers, CPAP accessories, oxygen accessories, masks, tubing, humidification accessories, respiratory therapy devices.
- Diabetes/cardiometabolic: glucose meters, lancets, testing supplies, blood-pressure monitors, pulse oximeters, scales.
- Diagnostics: thermometers, stethoscopes, otoscopes, ECG accessories, point-of-care testing devices where compliant.
- Infection control/PPE: gloves, masks, gowns, disinfectant-compatible supplies, sharps containers.
- Urology/incontinence: catheters, drainage bags, briefs, underpads, skin barriers.
- Ostomy: pouches, wafers, seals, belts, adhesives, removers.
- Enteral/nutrition: feeding tubes, syringes, pumps/accessories where compliant.
- Patient handling: lifts, slings, transfer boards, slide sheets.
- Surgical/clinical supplies: instruments, trays, sterile supplies, procedure kits, only if appropriate for marketplace sale.
- Manual review or exclusion: implantables, prescription-only devices, high-risk Class III devices, controlled products, products requiring licensed fitting, biologics/drugs, unverified imported devices, products with unresolved serious recalls, products with aggressive unsupported medical claims.

For each lead, store:
- Legal name, display name, website, headquarters address, metro area, region priority, and company type.
- Public business phone numbers only, public sales/contact email if available, contact form URL, and company LinkedIn/profile URL if publicly listed.
- Product categories and specific product lines that could sell through Aidlyst.
- Current distribution model: direct, distributor, dealer network, hospital/channel-only, DME supplier network, Amazon/retail, or unknown.
- FDA registration/listing evidence when available. Note clearly that FDA registration does not equal FDA approval, clearance, authorization, or certification.
- Product codes, 510(k) numbers, GUDID identifiers, recall evidence, and regulatory class when available.
- Whether products appear OTC, professional-use, prescription, DMEPOS, sterile, implantable, software/device, or restricted.
- Aidlyst model fit: high, medium, low, or exclude.
- Revenue-fit score using AOV, repeat purchase potential, replenishment cadence, margin room, fulfillment complexity, and likely transaction-fee tolerance.
- Compliance risk: low, medium, high, prohibited, or unknown.
- Review status and blockers.
- Source URLs for every material claim.

For every qualified lead, create a deal:
- Deal name: "[Company] x Aidlyst Direct Pipeline".
- Stage: research_ready, outreach_drafted, contacted, meeting_requested, meeting_scheduled, negotiating, compliance_review, approved_supplier, rejected, or blocked.
- Proposed model: manufacturer-direct marketplace listing; Aidlyst does not buy inventory; the manufacturer or approved medtech partner keeps most revenue; Aidlyst takes a small transaction percentage.
- Proposed first product set.
- Boston/local market wedge using current source evidence found during the run.
- Deal thesis with 5-7 company-specific bullets.
- Transaction-fee note: "TBD after margin, fulfillment, return, compliance, and payment-flow review."
- Required diligence and required documents.
- Meeting objective, recommended next action, risk summary, and source URLs.

For each outreach-ready deal, create drafts for review only:
- Initial email with subject line.
- Follow-up email 1.
- Follow-up email 2.
- Phone call script.
- Voicemail script.
- LinkedIn/company-contact-form version.
- Meeting questions.

Outreach rules:
- Do not send anything automatically.
- Do not fabricate names, emails, phone numbers, FDA status, product approvals, reimbursement status, pricing, inventory, or sales claims.
- Do not use scraped private personal contact information.
- Do not imply Aidlyst has buyers, verified suppliers, real-time inventory, savings data, national coverage, or clinical validation unless the backend has evidence records for those claims.
- Keep medical/product claims conservative and source-backed.

Required diligence checklist:
- Product catalog and SKU/feed access.
- FDA/regulatory records or manufacturer labeling evidence where applicable.
- UDI/GUDID or 510(k) evidence where applicable.
- Product images and image-use permission.
- Authorized product descriptions and claims.
- Fulfillment SLA, stock/availability process, lead time, MOQ, shipping regions.
- Returns, warranty, replacements, complaints, adverse-event, and recall process.
- Seller-of-record, tax/payment, ACH/W-9, transaction fee, and payout workflow.
- Insurance/COI and product liability review.
- MAP, wholesale, reseller, dealer, or channel-conflict rules.
- HIPAA/PHI boundary confirmation: Aidlyst should avoid collecting unnecessary health detail.

Output requirements:
- Add or update private backend records only.
- Record data-quality findings for uncertain, duplicate, stale, risky, unsupported, or privacy-sensitive records.
- Produce a short daily summary: leads found, leads added, duplicates skipped, high-fit Boston-area leads, outreach drafts requiring review, compliance blockers, and next recommended calls.
```
