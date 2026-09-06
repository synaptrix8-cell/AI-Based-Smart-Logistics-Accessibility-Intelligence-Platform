# Setu: AI-Based Smart Logistics & Accessibility Intelligence
**SIH 2024 Pitch Deck - 5 Minute Format**

> **Pitch Strategy (5 Minutes / 6 Slides)**
> You have roughly **45 to 50 seconds** per slide. Do not read the slides word-for-word. Let the judges read the technical bullet points while you say the *Speaker Notes* out loud.

---

## Slide 1: The Blind Spot (The Problem)
**Visual Idea:** A split-screen showing a standard Google Maps route looking "Green/Fast" vs a real-life photo of a massive Himalayan landslide blocking that exact same road.

**Content:**
* **The Vulnerability:** Standard GPS apps optimize purely for traffic speed, completely ignoring geographical danger.
* **The Danger:** Heavy rainfall + steep slopes = unexpected landslides. Supply chains and emergency logistics break down because they route trucks straight into newly formed disaster zones.
* **The Communication Gap:** Drivers in these zones often have zero 4G internet, leaving them stranded and unable to report the hazard.

> 🗣️ **Speaker Notes (45 sec):**
> *"Good morning judges. We are tackling a massive blind spot in national logistics. Today, standard GPS apps route trucks purely based on traffic speed. In the mountains, an empty road shows up as 'green and fast' right until a truck drives into a landslide. They cannot calculate that the road is soaked by 150mm of rain and about to collapse. Furthermore, when disaster strikes, 4G towers go down, leaving drivers completely cut off from reporting the hazard."*

---

## Slide 2: Setu - The Intelligence Platform (The Solution)
**Visual Idea:** High-quality screenshot of the dynamic dashboard showing the GIS Map, the blue detour line, and the "0 Active Hazards" KPI.

**Content:**
* **Real-Time Risk Engine:** A proactive logistics platform that predicts hazards before they happen using environmental telemetry.
* **Dynamic GIS Rerouting:** Automatically calculating safe detours for logistics convoys based on geological safety, not just speed.
* **Dual-Trust Verification:** A system where citizen reports are verified by officials before traffic is rerouted.
* **Zero-Signal Survival:** An offline-first architecture that functions even when cell towers collapse.

> 🗣️ **Speaker Notes (45 sec):**
> *"Our solution is Setu—an AI-Based Smart Logistics Intelligence Platform. Setu proactively predicts road hazards using live environmental data and mathematically reroutes logistics convoys based on geological safety, not just speed. We built a system with a 'human-in-the-loop' verification queue and an offline-first architecture that guarantees critical supply chains survive even when communication networks completely fail."*

---

## Slide 3: The Tech Stack (Frontend & Backend)
**Visual Idea:** A clean architectural diagram or logos of the tech stack (Next.js, Python, Supabase, PostGIS, Leaflet).

**Content:**
* **Frontend UI:** Next.js 16 (App Router), React 19, modular CSS for ultra-fast, lightweight loading.
* **GIS Mapping Engine:** Custom vector Leaflet overlays utilizing raw OpenStreetMap (OSM) coordinates for hyper-accurate mountain curves.
* **Backend Microservices:** Python FastAPI utilizing `NetworkX` for deep mathematical graph routing.
* **Database & Security:** Supabase (PostgreSQL 15), spatial PostGIS queries, Row-Level Security (RLS), and AES-GCM 256-bit Web Crypto encryption.

> 🗣️ **Speaker Notes (45 sec):**
> *"Our architecture is heavily optimized. The frontend is built on Next.js 16 and custom Leaflet vector maps, avoiding heavy Google Maps APIs. Our backend utilizes Python FastAPI for our routing algorithms. For our database, we use a serverless Supabase PostgreSQL cluster equipped with PostGIS for complex spatial geometry queries, wrapped in strict Row-Level Security and AES-GCM encryption to protect sensitive logistics data."*

---

## Slide 4: Data Sources & The AI Engine
**Visual Idea:** A flow chart showing Data (Weather, Elevation, GSI) -> The Math Equation -> The Blue Safe Route.

**Content:**
* **Geological Baseline:** Sourced from the Geological Survey of India (GSI) susceptibility maps (20% weight).
* **Live Telemetry:** Polling OpenWeatherMap API every 30s for rainfall triggers (35% weight).
* **Topography Data:** Digital Elevation Models (DEM) evaluating slope gradients (25% weight).
* **The AI Algorithm:** A custom **Risk-Weighted Dijkstra Router**. It multiplies geographic distance by an exponential risk penalty, forcing the algorithm to bypass highly dangerous roads even if they are shorter.

> 🗣️ **Speaker Notes (50 sec):**
> *"How do we know a road is dangerous? We don't guess. We pull live telemetry from OpenWeatherMap, static slope gradients from Elevation Models, and historical susceptibility data from the Geological Survey of India. We feed this into a custom Risk-Weighted Dijkstra algorithm. If a road's risk score breaches the driver's safety tolerance, our algorithm mathematically penalizes that route to infinity, forcing it to find a longer, but infinitely safer bypass."*

---

## Slide 5: Extreme Offline Resilience
**Visual Idea:** Icons for "No Signal", "SMS Text Message", and "Local Caching". 

**Content:**
* **Progressive Web App (PWA):** ServiceWorkers cache map tiles and routing JSONs into browser `IndexedDB`. The app survives airplane mode.
* **Local Queuing:** Reports submitted without internet are queued in `localStorage` and auto-sync the millisecond a cell tower is detected.
* **SMS Webhook Fallback:** A Python Natural Language Processing (NLP) parser that extracts hazard locations from basic 160-character 2G text messages.
* **Canvas Image Compression:** Compressing 5MB photos locally to 60KB before uploading to survive 2G EDGE networks.

> 🗣️ **Speaker Notes (50 sec):**
> *"Mountain valleys are notorious dead-zones. Setu is an Offline-First Progressive Web App. Our ServiceWorkers cache map data directly into the device's IndexedDB so navigation survives complete signal loss. For hazard reporting, we built an offline queue that auto-syncs the moment you get a bar of signal, and an SMS Webhook fallback that allows truck drivers on 2G dumb-phones to update the central database via text message."*

---

## Slide 6: The Impact
**Visual Idea:** The final, bold mission statement.

**Content:**
* **Zero Downtime:** Proactive routing ensures national supply chains never drive blindly into blockades.
* **Scalable Nationwide:** PostGIS architecture allows instant scaling to any mountainous state simply by importing new highway geometries.
* **Actionable Intelligence:** Gives government officials a verified, real-time command center to coordinate disaster relief instantly.

> 🗣️ **Speaker Notes (35 sec):**
> *"Ultimately, Setu ensures zero downtime for emergency logistics. Because we rely on PostGIS geometries instead of hardcoded maps, we can scale this to any mountainous state in India instantly. We are providing a centralized, verified command center that saves lives, secures supply chains, and prevents convoys from driving blindly into disaster. Thank you."*
