# SIH 2024: Distributed Team Knowledge Base (Expanded Edition)
**Project: Setu - AI-Based Smart Logistics & Accessibility Intelligence**

> [!TIP]
> **Strategy for the 6-Person Team**
> - **Person 1 (The Presenter)**: Focuses entirely on the pitch, flow, business impact, and guiding the presentation. No deep technical load required.
> - **Persons 2 through 6 (The Experts)**: You are the technical backbone. Read your designated section deeply. When a judge asks a technical question, the Presenter will hand the floor to you. Answer confidently using the exact points below.

---

## 🗺️ Expert 1: Frontend, GIS Architecture & UI State
**Focus:** Next.js UI, React State, Leaflet Mapping, and Real-Time Rendering.

### In-Depth Technical Reading
- **Tech Stack Choices**: The frontend is built on **Next.js 16 (App Router)** utilizing React 19 and the Turbopack build engine. We chose Next.js for its robust edge-rendering capabilities, but for the map itself, we enforce client-side rendering using `next/dynamic({ ssr: false })` because Leaflet.js strictly requires the browser's `window` object to manipulate the DOM.
- **High-Fidelity GIS Mapping (`RiskMap.tsx`)**: We completely bypassed generic Google Maps embeds. Instead, we use custom vector Leaflet overlays. Every highway segment (like NH-6 or SH-5) is rendered as a PostGIS `LineString` array of coordinates. We generate 15-20 spline subdivision points per corridor so the route visually hugs the exact asphalt curves of the mountain, rather than drawing coarse, straight lines.
- **Zero-Latency State Synchronization**: The app orchestrates state between the `LiveDashboardView` (which holds the `blockedSegmentIds` and `clearedCorridors` arrays) and the `RiskMap` component. When an official clicks "Mark Hazard Fixed", the state updates locally *first*. The UI instantly strips the `⚠️` pin and returns the road to green without waiting for a database reload, making the app feel incredibly fast.
- **Dynamic CSS Modules**: Instead of relying on heavy CSS frameworks that bloat the app, we utilize modular CSS (`.module.css`). This ensures styles are scoped locally to components, preventing CSS bleed while keeping the bundle size ultra-lightweight for low-bandwidth mountain networks.

### ❓ Anticipated Judge Q&A
**Q: How does the map update in real-time if a landslide happens?**
*A: "Our dashboard leverages Supabase Realtime WebSockets. When a new hazard hits the database via our API, the payload is pushed to our Next.js frontend instantly. Our React state manager updates the `blockedSegmentIds` array. This triggers a reactive re-render in the Leaflet map, dynamically recalculating the polyline colors from green to red and dropping a new warning pin—all under 100 milliseconds without refreshing the page."*

**Q: Why didn't you just use Google Maps Directions API?**
*A: "Google Maps APIs optimize for traffic speed, not geotechnical safety, and their vector styling is closed-source. By using Leaflet and OpenStreetMap data, we gain full mathematical control over the polyline layers. We can inject our own color-coding algorithms and render our AI-calculated 'Blue Detour Line' exactly where we want it."*

---

## 🧠 Expert 2: Routing Algorithm & AI Engine
**Focus:** Dijkstra Graph Routing, Penalty Math, and Route Overrides.

### In-Depth Technical Reading
- **The Core Flaw in Existing Navigation**: Standard navigation apps optimize purely for *traffic speed*. In the mountains, an empty highway shows as "green/fast" on a standard GPS right until a truck drives into a landslide. They do not calculate that the road is soaked by 150mm of rain.
- **Setu's Risk-Weighted Dijkstra Algorithm (`graph_router.py`)**: The backend intelligence is a Python FastAPI microservice utilizing `NetworkX`. We modeled the entire East Khasi Hills highway network as a mathematical graph where intersections are nodes and roads are edges.
- **The Penalty Mathematics**: Standard routing calculates cost as `Cost = Distance`. Our algorithm mathematically penalizes dangerous roads:
  $$Edge Cost = Distance \times \left(1.0 + \left(\frac{Risk Score}{1.001 - Tolerance}\right)^2\right)$$
- **The 'Risk Tolerance' Slider**: We built a slider in the UI that allows drivers to set their risk tolerance (default is 70%). As a corridor's physical Risk Score approaches the driver's Tolerance limit, the denominator in our equation shrinks towards zero. This causes the edge cost to spike exponentially toward infinity. The Dijkstra algorithm mathematically "gives up" on that route and searches for a longer, but infinitely safer, bypass ridge.

### ❓ Anticipated Judge Q&A
**Q: What if the fastest route is extremely dangerous? Will your app still send them there?**
*A: "No, that's exactly what we engineered our algorithm to prevent. Our custom Dijkstra router multiplies the geographic distance by an exponential risk penalty. If the risk score breaches the driver's safety tolerance threshold, the algorithmic cost becomes nearly infinite, forcing the system to output a longer but infinitely safer detour."*

**Q: How fast does the algorithm recalculate routes when a road is blocked?**
*A: "Instantly. When an official flags a corridor as blocked, the edge weight for that segment in our NetworkX graph is forcefully set to infinity. The next time the frontend polls the `/api/routing/safe-route` endpoint, the Dijkstra algorithm avoids that edge completely, returning the new safe path coordinates in under 20 milliseconds."*

---

## 📊 Expert 3: Data Science & Risk Formulation
**Focus:** The RRI Formula, Weather APIs, and Geological Baseline.

### In-Depth Technical Reading
- **The Road Risk Index (RRI)**: We calculate real-time geotechnical risk using a dynamic, multi-factor deterministic equation:
  $$RRI = (0.25 \times Slope) + (0.35 \times Rainfall) + (0.20 \times History) + (0.20 \times Reports)$$
- **Slope Data (25% Weight)**: Derived from Digital Elevation Models (DEM). Any highway slope exceeding 25° triggers a massive gravitational instability multiplier. We mapped this data directly onto the segments.
- **Weather Telemetry (35% Weight)**: Water pore pressure is the #1 triggering factor for Himalayan landslides. Our Python engine polls the OpenWeatherMap API every 30 seconds. Precipitation above 20 mm/hr acts as a critical threshold multiplier in the algorithm.
- **Geological Baseline (20% Weight)**: We didn't guess the risk; we seeded our PostGIS database with historical susceptibility models (NLSM) from the Geological Survey of India (GSI). We know which mountains are structurally weak before rain even falls.
- **Crowd Reports (20% Weight)**: Verified reports from citizens dynamically push the risk score higher.

### ❓ Anticipated Judge Q&A
**Q: How do you mathematically determine if a road is going to collapse?**
*A: "We use a deterministic geotechnical model we call the Road Risk Index. We don't just look at rain; we multiply live rainfall telemetry from OpenWeatherMap by the static slope gradient of that specific highway curve, and weight it against GSI's historical shear failure zones. If that combined matrix breaches our 0.70 threshold, we flag the road as critical."*

**Q: Where exactly are you getting your data from, and is it reliable?**
*A: "Every data point comes from a reliable pipeline. Our road geometries are exact OpenStreetMap vectors. Our historical baselines are taken directly from the Geological Survey of India's 1:50,000 scale susceptibility mapping. And our live weather is polled via OpenWeatherMap APIs, which we cache in our own database to prevent rate-limiting."*

---

## 📡 Expert 4: Offline Resilience & Edge Systems
**Focus:** Zero-Internet operations, PWA, Caching, and SMS Webhooks.

### In-Depth Technical Reading
- **The Zero-Signal Problem**: Mountain valleys like Cherrapunji frequently lose 4G/5G signals due to topography and heavy cloud cover. A logistics app that requires internet is useless in a disaster.
- **PWA & IndexedDB Caching**: Setu is an Offline-First Progressive Web App (PWA). Our ServiceWorker intercepts all network requests. It caches the Leaflet map tiles, Javascript bundles, and JSON routing data in the browser's `IndexedDB`. If the driver loses signal, the app continues to display the map and their route seamlessly.
- **Local Queuing (`offline-queue.ts`)**: If a driver reports a flood with zero internet, the report does not fail. It saves to an array in `localStorage`. The exact millisecond the phone detects a cell tower connection, the ServiceWorker auto-syncs the payload to the Supabase backend.
- **SMS Fallback NLP Parser**: For drivers on 2G dumb-phones without internet, we built an inbound SMS webhook. A driver texts "HAZARD LANDSLIDE SOHRA". Our Python parser uses Regex and NLP tokens to extract the hazard type and location, maps it to the highway, and updates the database via the API without requiring a smartphone.
- **Bandwidth Optimization**: Taking a 5MB photo in the mountains takes too long to upload. We use the HTML5 Canvas API to locally downscale and compress camera photos to ~60KB JPEGs *before* uploading, ensuring they transmit reliably over weak 2G EDGE networks.

### ❓ Anticipated Judge Q&A
**Q: Your app looks great, but what happens when the driver has no internet in a storm?**
*A: "We built Setu to be a lifesaver in dead-zones. The app is a PWA that caches map tiles and geodata locally. If a driver loses signal, their routing map remains fully functional. Furthermore, emergency hazard reporting utilizes local storage queuing, and falls back to a 160-character SMS webhook parser, guaranteeing that critical intelligence reaches our servers even if 4G networks completely collapse."*

**Q: How do you handle large photo uploads on 2G networks?**
*A: "We utilize the device's own hardware. Before an image ever touches the network, our app draws the photo onto a hidden HTML5 Canvas element, downscales the resolution, and compresses it to a 60-kilobyte JPEG. This allows high-value visual proof to be transmitted over extremely degraded networks in seconds."*

---

## 🔐 Expert 5: Database, Backend Architecture & Security
**Focus:** Supabase, PostgreSQL, PostGIS, RLS, and Encryption.

### In-Depth Technical Reading
- **Architecture**: We use a Serverless architecture powered by Supabase (PostgreSQL 15), utilizing PostGIS for spatial mathematics, and FastAPI for the intelligence layer. 
- **Spatial Database (PostGIS)**: We don't just store text strings; we store exact geographic geometries. Road corridors are stored in the `road_segments` table as `ST_LineString`. Hazard reports are stored in the `reports` table as `ST_Point`.
- **Spatial Queries for Spam Prevention**: To verify a report, we run an `ST_DWithin()` SQL query to mathematically ensure the driver's GPS coordinate is actually within 200 meters of the highway they claim is blocked. If they are sitting in their house miles away, the system ignores it.
- **Row-Level Security (RLS)**: We utilize strict Supabase Row-Level Security. A standard user can `INSERT` a report into the database, but they absolutely cannot `UPDATE` the highway status. Only authenticated users carrying the `official` JWT role claim can execute broadcast alerts or declare a road blocked.
- **AES-GCM Encryption**: Citizen hazard reports (like photo evidence and locations) are encrypted on the client side using AES-GCM 256-bit Web Crypto API before hitting the database. This prevents interception of sensitive convoy data.
- **The 'Human-in-the-Loop' Pipeline**: The database utilizes a `report_verifications` table. Public users submit to a quarantined queue. A human official must visually audit the payload in the dashboard and execute a trusted database mutation (clicking 'Verify') before the algorithm is legally allowed to reroute traffic.

### ❓ Anticipated Judge Q&A
**Q: How do you prevent malicious users from spamming fake landslides and shutting down national highways?**
*A: "We implemented a dual-trust architecture. First, at the database level, PostGIS runs a spatial `ST_DWithin` query to mathematically prove the reporter's GPS is actually on the highway. Second, we use Row-Level Security: public users can only submit to a quarantined 'verification queue'. A human official must visually audit the photo and click 'Verify' before the algorithm is legally allowed to reroute traffic."*

**Q: Is your database scalable to the rest of India?**
*A: "Infinitely scalable. Because our backend is built on PostGIS and standard OpenStreetMap GeoJSON files, scaling to Sikkim or Arunachal Pradesh simply requires running an SQL `INSERT` script with the new state's road geometries. The Python routing engine and the spatial queries will automatically adapt without writing a single new line of core code."*
