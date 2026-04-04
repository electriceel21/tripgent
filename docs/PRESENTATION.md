<!--
  How to use this file
  --------------------
  • Marp (VS Code extension / CLI): keep the frontmatter below; `---` = new slide.
  • Slidev: copy slides into slides.md or split on `---`.
  • Gamma / Beautiful.ai / Google Slides: paste sections into the tool or ask another model:
    "Turn the following markdown into a 10-slide deck with titles and bullets."
  • Remove the `marp: true` block if your tool does not support Marp.
-->

---
marp: true
theme: default
paginate: true
header: Tripgent
footer: Confidential · draft
---

# Tripgent
## AI travel concierge + sponsored rewards

**One line:** Travelers chat with an expert agent; brands sponsor destinations; users earn USDC for real engagement—not ad impressions.

---

## The problem today

- Travel discovery is **ads and SEO**, not intent
- Users give **attention for free**; value flows to intermediaries
- Brands pay for **clicks and impressions**, not verified interest

---

## Our flip on the model

| Old (search/ads) | Tripgent |
|------------------|----------|
| Brands pay platforms | Brands **sponsor the agent** for a destination |
| Users see ads | Users **earn crypto** when they engage with sponsored value |
| Opaque funnel | **Per-intent** signals, not vanity metrics |

---

## What the product is

- **AI travel advisor** — neighborhoods, food, day trips, local tips (not a booking engine)
- **B2B:** airlines, DMOs, hotel groups buy **destination programs**
- **B2C:** travelers use the agent **free** and **earn** while planning

---

## How rewards work (concept)

1. User asks the agent about a place or trip
2. **Sponsored** answers are natural, not banner spam
3. **Confirmed actions** (e.g. completed offers) drive **reputation & tiers**
4. Payouts in **USDC** — **Circle Gateway / nanopayments** (ARC Mini Pay) for instant, spendable value

---

## Tech stack (high level)

| Layer | Choice |
|-------|--------|
| **AI inference** | **0G Compute** — decentralized, TEE-verified; `processResponse` for settlement |
| **Auth (mobile)** | **Dynamic** — embedded wallets, RN client + WebView |
| **Data** | **Supabase** — sponsors, locations, pools, offers, purchases, tiers |
| **Admin** | **Next.js** web app |
| **Consumer** | **Expo** mobile chat → Tripgent API |

---

## Why 0G for the agent

- Open **chat completions** against marketplace **providers**
- **TEE-attested** inference (verify provider when needed)
- Server-side broker + **`processResponse(provider, chatId, usage)`** for correct billing

---

## Why Dynamic + Circle

- **Dynamic:** travelers sign in and get a **wallet** without leaving the mobile flow (RN SDK)
- **Circle nanopayments:** **gas-free USDC** at sub-cent granularity — fits **high-frequency micro-rewards**

---

## Tiers & reputation (product logic)

- Users **level up** (e.g. bronze → silver → gold → platinum) from **confirmed purchases** and **reputation score**
- **Reward pools** per sponsor/location cap **budget**; **spent** tracked on confirmation
- Admin defines **sponsors, locations, pools, offers**; ops **confirm purchases** to advance users

---

## Go-to-market

- **Sell:** destination sponsorship packages + performance reporting
- **Measure:** intent and conversions, not raw impressions
- **Differentiate:** user-owned upside (USDC) vs. ad-fed search

---

## Roadmap (talk track)

1. Ship **chat + auth + admin CRUD** on Supabase  
2. Wire **Circle** buyer/seller paths for real payouts  
3. Harden **Dynamic JWT** verification on the API  
4. Pilot with **one DMO + one airline** on a single corridor  

---

## Closing

**Tripgent** — *Where travelers earn for real engagement, and brands pay for intent.*

**Contact / next step:** _add your email, calendar link, or demo URL here_

---

## Appendix — Demo script (speaker notes)

- Open **admin**: create sponsor → location → pool → offer  
- Open **mobile**: sign in with Dynamic, ask about that destination  
- Record a **purchase** in admin → show **tier** and **pool spent** update  
- Mention **0G** only if the audience cares about infra; lead with **traveler + brand** story
