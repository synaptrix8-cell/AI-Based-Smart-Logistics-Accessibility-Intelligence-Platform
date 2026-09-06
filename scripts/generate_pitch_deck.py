import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    BG_DARK = RGBColor(15, 23, 42)       # #0F172A
    CARD_BG = RGBColor(30, 41, 59)       # #1E293B
    BORDER_COLOR = RGBColor(51, 65, 85)  # #334155
    WHITE = RGBColor(248, 250, 252)      # #F8FAFC
    GRAY = RGBColor(148, 163, 184)       # #94A3B8
    CYAN = RGBColor(56, 189, 248)        # #38BDF8
    EMERALD = RGBColor(52, 211, 153)     # #34D399
    AMBER = RGBColor(251, 191, 36)       # #FBBF24

    slides_data = [
        {
            "slide_num": "01",
            "speaker": "PERSON 1: THE PRESENTER",
            "role": "Executive Pitch, Problem Statement & National Impact",
            "title": "Setu: AI-Based Smart Logistics & Accessibility Intelligence",
            "subtitle": "Proactive Geotechnical Risk Forecasting & Resilient Mountain Supply Chains",
            "cards": [
                {
                    "title": "The Himalayan Vulnerability (The Blind Spot)",
                    "color": AMBER,
                    "bullets": [
                        ("Speed vs. Geotechnical Risk:", "Standard GPS engines (Google Maps) optimize purely for speed, treating an empty mountain highway as 'clear' right until a convoy hits an active mudslide."),
                        ("The Dead-Zone Crisis:", "Monsoon precipitation collapses cellular towers, leaving logistics drivers stranded in 4G blackouts unable to report road hazards."),
                        ("Economic Disruption:", "Supply bottlenecks across NH-6 (Assam-Meghalaya gateway) cause ₹100Cr+ in freight delays, isolating critical valley populations.")
                    ]
                },
                {
                    "title": "Setu Solution & End-to-End Data Pipeline",
                    "color": CYAN,
                    "bullets": [
                        ("Step 1 - Environmental Ingestion:", "Live precipitation from OpenWeatherMap + 30m Digital Elevation Models (DEM) + Geological Survey of India (GSI) baseline models."),
                        ("Step 2 - Risk Intelligence Engine:", "Deterministic Road Risk Index (RRI) computing real-time slope shear failure probabilities."),
                        ("Step 3 - Autonomous AI Router:", "Risk-penalized Dijkstra pathfinder routing convoys around unstable corridors via verified safe bypasses."),
                        ("Step 4 - Multi-Channel Dispatch:", "Real-time Next.js GIS Operations Map + 2G SMS & WhatsApp alert broadcasts for emergency logistics.")
                    ]
                },
                {
                    "title": "Full-Stack Technology Architecture",
                    "color": EMERALD,
                    "bullets": [
                        ("Frontend & GIS UI:", "Next.js 16 App Router, React 19, Leaflet.js Vector GIS, Modular CSS, HTML5 Canvas."),
                        ("Routing & AI Microservice:", "Python 3.11, FastAPI, NetworkX Mathematical Graph Library, OSRM Engine."),
                        ("Database & Geometries:", "Supabase PostgreSQL 15, PostGIS Spatial Extension (ST_LineString, ST_Point)."),
                        ("Edge & Inbound Telephony:", "Progressive Web App (PWA), ServiceWorkers, IndexedDB, Twilio SMS/WhatsApp Webhooks.")
                    ]
                }
            ],
            "footer_title": "🎯 Executive Pitch Focus:",
            "footer_text": "Setu bridges the blind spot between traffic speed and geotechnical survival. By fusing environmental telemetry with spatial graph routing, we deliver a zero-downtime logistics command center for disaster relief.",
            "notes": (
                "Good morning judges. We are tackling a critical blind spot in national logistics. "
                "Today, standard GPS apps route freight trucks purely based on traffic speed. In Himalayan corridors, an empty highway shows as 'green and clear' right until a 10-wheel truck drives straight into a newly triggered landslide. "
                "They cannot calculate that 150mm of rain has liquefied the mountain slope above. Furthermore, when storms knock out 4G towers, drivers are completely cut off. "
                "Our solution is Setu—a proactive logistics intelligence platform that predicts road failures before they occur, dynamically reroutes freight around hazardous ridges, and survives total network collapse through an offline-first architecture."
            )
        },
        {
            "slide_num": "02",
            "speaker": "PERSON 2: EXPERT 1 (FRONTEND & GIS)",
            "role": "Next.js 16 App Router, Leaflet Vector GIS & Zero-Latency State",
            "title": "Frontend Architecture, GIS Vector Mapping & UI State",
            "subtitle": "High-Density Curved Geometries, Client-Side Rendering & Real-Time Sync",
            "cards": [
                {
                    "title": "Technology Stack & Framework Choices",
                    "color": CYAN,
                    "bullets": [
                        ("Next.js 16 App Router (Turbopack):", "Edge-optimized React 19 architecture providing instantaneous page loads and minimal JavaScript bundle footprint."),
                        ("Bypassing SSR via next/dynamic:", "Leaflet strictly requires the browser DOM window object. We wrap the GIS map in next/dynamic({ ssr: false }) to eliminate server-side hydration mismatches."),
                        ("Modular CSS Architecture:", "Strict .module.css scoping prevents style leakage and keeps CSS footprint below 40KB for rapid 2G mobile loading.")
                    ]
                },
                {
                    "title": "Data Pipeline: Raw PostGIS to Spline Curves",
                    "color": EMERALD,
                    "bullets": [
                        ("PostGIS Vector Ingestion:", "Highways (NH-6, SH-5, NH-40) are streamed as PostGIS ST_LineString GeoJSON coordinates from our PostgreSQL backend."),
                        ("Catmull-Rom Spline Densification:", "Generic maps draw coarse diagonal lines across mountains. Our engine inserts 15-20 spline subdivision points per corridor so routes visually hug the true asphalt curves."),
                        ("Dynamic Color Quantization:", "Polylines reactively recolor in real-time: Green (RRI < 0.40), Yellow (0.40 - 0.70), Red Hazard (> 0.70), and Blue (AI Safe Detour).")
                    ]
                },
                {
                    "title": "Zero-Latency UI State Synchronization",
                    "color": AMBER,
                    "bullets": [
                        ("Supabase WebSocket Listeners:", "Live database mutations (hazard alerts & official road clearances) push to the client over WebSockets in < 100ms."),
                        ("Optimistic UI Updates:", "When an official clicks 'Mark Hazard Fixed', the UI immediately unblocks the road locally, recalculates the path, and updates without page reloads."),
                        ("Clean Single-Layer Pin Markers:", "Emoji pin badges (🚚 Origin, 🏁 Destination) with offset tooltips prevent double-label clutter on small displays.")
                    ]
                }
            ],
            "footer_title": "❓ Judge Defense (GIS Architecture):",
            "footer_text": "Why Leaflet over Google Maps API? Google Maps is a closed black box optimizing for city traffic. Leaflet + PostGIS gives us direct mathematical control over vector layers, custom spline curvature, and offline tile caching.",
            "notes": (
                "Judges, I lead the Frontend and GIS Architecture. We rejected standard Google Maps embeds because they are closed-source and optimize for traffic, not geological safety. "
                "We engineered our GIS interface using Next.js 16 and custom Leaflet vector overlays. Each highway corridor is streamed as PostGIS LineStrings and passed through a Catmull-Rom spline algorithm that inserts 20 points per curve, ensuring routes hug the exact mountain contours. "
                "Our UI state orchestrates Supabase Realtime WebSockets: when a hazard is verified or cleared, the map recolors and reroutes reactively in under 100 milliseconds without refreshing the browser."
            )
        },
        {
            "slide_num": "03",
            "speaker": "PERSON 3: EXPERT 2 (ROUTING & AI)",
            "role": "Risk-Penalized Dijkstra Algorithm, Graph Modeling & Detours",
            "title": "AI Routing Engine: Risk-Penalized Graph Navigation",
            "subtitle": "NetworkX Mathematical Modeling, OSRM Highway Engine & Dynamic Waypoints",
            "cards": [
                {
                    "title": "Graph Mathematical Modeling (NetworkX)",
                    "color": CYAN,
                    "bullets": [
                        ("Directed Network Graph G = (V, E):", "Intersections and logistics hubs are vertices (V); highway segments are weighted directional edges (E)."),
                        ("Dual Routing Engines:", "Primary intelligence is our Python FastAPI graph engine; secondary fallback is the OpenStreetMap OSRM driving router with dynamic waypoint injection."),
                        ("Junction Link Healing:", "Adjacent highway endpoints within 250 meters are automatically linked in memory to guarantee 100% connected graph topology across state boundaries.")
                    ]
                },
                {
                    "title": "The Exponential Risk-Penalty Formulation",
                    "color": EMERALD,
                    "bullets": [
                        ("Traditional GPS Formula:", "Cost = Distance (Fails catastrophically during natural disasters)."),
                        ("Setu Risk Cost Equation:", "Edge Cost = Distance × [ 1.0 + ( RRI / (1.001 - Tolerance) )² ]"),
                        ("The Tolerance Slider (40% - 90%):", "Allows convoy commanders to tune risk appetite. As a road's RRI approaches the tolerance limit, the denominator approaches zero, causing edge cost to spike exponentially toward infinity."),
                        ("Algorithmic Divergence:", "Dijkstra mathematically abandons the high-risk shortcut and selects a longer, verified stable bypass corridor in < 20ms.")
                    ]
                },
                {
                    "title": "Destination-Aware Detour Geometry",
                    "color": AMBER,
                    "bullets": [
                        ("The Overshooting Prevention Engine:", "Generic detour waypoints often force vehicles south of their destination, creating wasteful U-turns."),
                        ("Bounding Box Traversal Check:", "Our algorithm evaluates geographic bounds (minLat, maxLat). A trip from Nongpoh to Umiam never traverses southern descent corridors."),
                        ("Corridor-Specific Bypass Waypoints:", "Bypasses Umsning blockades via Umroi Pass (25.710°N) for northern targets, and Shillong East Bypass (25.640°N) for southern convoys.")
                    ]
                }
            ],
            "footer_title": "❓ Judge Defense (AI Routing):",
            "footer_text": "What if the shortest route is high-risk? Our exponential penalty forces the Dijkstra cost to infinity, guaranteeing heavy freight is automatically diverted to all-weather bypasses.",
            "notes": (
                "Judges, I oversee the AI Routing Algorithm. Standard GPS algorithms optimize for travel time, which is dangerous in disaster terrain. "
                "We modeled the road network as a mathematical graph using Python NetworkX. Instead of using distance as the only edge weight, we multiply distance by an exponential risk penalty formula. "
                "When a driver sets their risk tolerance—say, 70%—any corridor whose live Risk Index nears that threshold causes the cost denominator to approach zero. The cost spikes to infinity, forcing Dijkstra to find an alternate route in under 20 milliseconds. "
                "Furthermore, our destination-aware engine ensures detours never overshoot endpoints, providing clean, direct routing."
            )
        },
        {
            "slide_num": "04",
            "speaker": "PERSON 4: EXPERT 3 (DATA SCIENCE & RISK)",
            "role": "Road Risk Index (RRI), Environmental Telemetry & Geotechnical Fusion",
            "title": "Geotechnical Risk Formulation & Live Data Pipelines",
            "subtitle": "Deterministic Physics Modeling, OpenWeather API & GSI Geological Baselines",
            "cards": [
                {
                    "title": "Multi-Factor Road Risk Index (RRI) Equation",
                    "color": CYAN,
                    "bullets": [
                        ("Deterministic Formulation:", "RRI = (0.25 × Slope) + (0.35 × Rain) + (0.20 × GSI_History) + (0.20 × Reports)"),
                        ("Continuous Normalization:", "Produces a deterministic risk coefficient bounded between 0.00 (optimal) and 1.00 (impassable catastrophe)."),
                        ("Physics Basis:", "Water pore pressure reduces soil shear strength on steep inclines, triggering sudden translational debris flows.")
                    ]
                },
                {
                    "title": "Live Environmental Data Pipeline & Origins",
                    "color": EMERALD,
                    "bullets": [
                        ("Slope Gradient (25% Weight):", "Derived from 30-meter NASA SRTM Digital Elevation Models (DEM). Road inclines > 25° trigger critical gravitational shear multipliers."),
                        ("Weather Telemetry (35% Weight):", "Polled via OpenWeatherMap OneCall API every 30s. Sustained precipitation > 20 mm/hr acts as a critical triggering threshold."),
                        ("Geological Baseline (20% Weight):", "Seeded from Geological Survey of India (GSI) 1:50,000 National Landslide Susceptibility Mapping (NLSM) shapefiles."),
                        ("Corroborated Telemetry (20% Weight):", "Dynamic weight adjustments from verified field incident reports.")
                    ]
                },
                {
                    "title": "Data Pipeline Cadence & Fault-Tolerant Caching",
                    "color": AMBER,
                    "bullets": [
                        ("30-Second API Polling Worker:", "A background cron pipeline ingests atmospheric data across East Khasi Hills weather stations (Cherrapunji, Shillong, Nongpoh)."),
                        ("In-Memory Risk Cache:", "Environmental factors are cached in Redis / PostgreSQL to eliminate external API rate-limiting during emergency traffic surges."),
                        ("Hydrological River Sensors:", "Central Water Commission (CWC) ultrasonic sensors stream river height to detect low-lying bridge flooding (e.g. Umngot River at Dawki).")
                    ]
                }
            ],
            "footer_title": "❓ Judge Defense (Risk Formulation):",
            "footer_text": "How do you mathematically predict road collapse? By fusing static shear strength baselines from GSI with live pore-pressure telemetry from OpenWeatherMap and DEM slope vectors.",
            "notes": (
                "Judges, I lead Data Science and Risk Formulation. We don't guess whether a road is safe; we calculate it using our deterministic Road Risk Index equation. "
                "Landslides are physical events caused by water pore pressure overcoming soil shear strength on steep angles. "
                "Our pipeline fuses 30-meter DEM slope gradients (25% weight) with live precipitation polled every 30 seconds from OpenWeatherMap (35% weight), historical susceptibility maps from the Geological Survey of India (20% weight), and verified field reports (20% weight). "
                "When rain saturates a steep slope, the RRI spikes above our 0.70 threshold, proactively alerting drivers before the asphalt collapses."
            )
        },
        {
            "slide_num": "05",
            "speaker": "PERSON 5: EXPERT 4 (OFFLINE & EDGE)",
            "role": "PWA Architecture, 2G SMS Webhook Parser & Canvas Compression",
            "title": "Edge Resilience: Offline-First PWA & 2G Telemetry",
            "subtitle": "IndexedDB Tile Caching, Background Sync & Inbound SMS NLP Fallback",
            "cards": [
                {
                    "title": "Zero-Signal PWA Architecture",
                    "color": CYAN,
                    "bullets": [
                        ("Progressive Web App (PWA):", "Installable on mobile devices with zero app-store dependency; runs natively on Android & iOS."),
                        ("ServiceWorker Interception:", "Every fetch request is intercepted by our custom ServiceWorker cache strategy (Cache-First for map tiles; Network-First for alerts)."),
                        ("IndexedDB Vector Storage:", "Map geometries, routing graphs, and offline hub coordinates are serialized in browser IndexedDB, keeping navigation active in 100% dead-zones.")
                    ]
                },
                {
                    "title": "Offline Reporting Queue & Background Sync",
                    "color": EMERALD,
                    "bullets": [
                        ("Client Storage Queue (offline-queue.ts):", "When a driver reports a hazard without internet, the payload is persisted locally in localStorage/IndexedDB."),
                        ("Cell Tower Auto-Reconnection:", "The window online event triggers an autonomous queue flush, posting stored reports the exact millisecond connectivity returns."),
                        ("Canvas Photo Compression:", "Heavy 5MB smartphone photos are drawn onto an HTML5 Canvas and re-encoded as 60KB JPEGs locally, transmitting over fragile 2G EDGE networks in seconds.")
                    ]
                },
                {
                    "title": "2G SMS & WhatsApp NLP Telemetry Gateway",
                    "color": AMBER,
                    "bullets": [
                        ("The 2G Dumb-Phone Reality:", "Most rural truck drivers use basic feature phones without mobile internet."),
                        ("Twilio Inbound SMS Webhook (/api/alerts/inbound-sms):", "Drivers send a 160-character plain text message (e.g. 'HAZARD LANDSLIDE UMSNING')."),
                        ("Python Regex NLP Tokenizer:", "Extracts hazard category, corridor name, and severity; automatically converts it into a structured PostGIS point in the database."),
                        ("1-Tap GPS SMS Dispatch:", "Our web UI auto-encodes device coordinates into pre-formatted SMS links (sms:+91...?body=...) for instant 1-tap SOS transmission.")
                    ]
                }
            ],
            "footer_title": "❓ Judge Defense (Edge Systems):",
            "footer_text": "What happens when 4G completely collapses in a storm? The PWA continues navigating from IndexedDB, and drivers submit hazard intelligence via 160-character 2G SMS text messages.",
            "notes": (
                "Judges, I lead Edge Systems and Offline Resilience. In disaster logistics, assuming stable 4G internet is a fatal flaw. "
                "Setu is built as an Offline-First Progressive Web App. Our ServiceWorker caches map tiles, JavaScript, and routing networks in the device's IndexedDB. If a convoy enters a mountain canyon with zero signal, navigation continues uninterrupted. "
                "If a driver spots a hazard, our local queue stores the report and auto-syncs the moment a signal bar appears. "
                "For drivers with 2G basic feature phones, we built an SMS webhook backed by an NLP tokenizer that parses 160-character text messages into structured PostGIS hazard markers."
            )
        },
        {
            "slide_num": "06",
            "speaker": "PERSON 6: EXPERT 5 (DATABASE & SECURITY)",
            "role": "PostGIS Spatial Engine, Row-Level Security & Anti-Fraud Triage",
            "title": "Database Architecture, Security & Anti-Fraud Verification",
            "subtitle": "PostGIS Spatial Geometry, AES-GCM Encryption & Dual-Trust Human Triage",
            "cards": [
                {
                    "title": "Database Architecture & Spatial Primitives",
                    "color": CYAN,
                    "bullets": [
                        ("Supabase PostgreSQL 15 + PostGIS:", "Enterprise spatial database storing exact vector geometry rather than loose text strings."),
                        ("Spatial Primitives:", "Highway segments stored as ST_LineString geometries; incident reports stored as ST_Point coordinates with spatial spatial indexing (GIST)."),
                        ("National Scalability:", "Scaling Setu to Sikkim or Ladakh requires zero code rewrites—simply executing an SQL INSERT with new state OSM geometries.")
                    ]
                },
                {
                    "title": "Anti-Fraud & Spam Protection Engine",
                    "color": EMERALD,
                    "bullets": [
                        ("Spatial Proximity Verification (ST_DWithin):", "When a driver reports a hazard, PostGIS executes an ST_DWithin query proving the driver's GPS coordinate is within 200m of the claimed road."),
                        ("Multi-Source Consensus Clustering:", "A single lone report never shuts down a highway. Our DBSCAN clustering engine requires 3 independent reports within 500m / 20min to escalate severity."),
                        ("Telemetry Deceleration Verification:", "The system checks if subsequent vehicles on that corridor decelerated to < 5 km/h. If traffic flows at 50 km/h, the report is penalized as fraudulent."),
                        ("Driver Phone Hashing & Trust Index:", "Phone numbers are hashed (SHA-256); malicious spammers have their trust score revoked and numbers blacklisted.")
                    ]
                },
                {
                    "title": "Dual-Trust Triage Queue & Cryptography",
                    "color": AMBER,
                    "bullets": [
                        ("Two-Tier Lifecycle (Unverified vs. Verified):", "Crowdsourced reports enter as 'unverified' advisory pins. Mandatory convoy reroutes are ONLY triggered once officially verified."),
                        ("Human-in-the-Loop Triage Console (/dashboard/reports):", "District Duty Officers review encrypted photos and telemetry before executing authoritative database mutations."),
                        ("Row-Level Security (RLS):", "Public users have INSERT-only permissions. Only JWT-authenticated users with role='official' can clear corridors or trigger reroutes."),
                        ("AES-GCM 256-Bit Cryptography:", "Sensitive citizen identity hashes and convoy payloads are encrypted client-side using Web Crypto AES-GCM.")
                    ]
                }
            ],
            "footer_title": "❓ Judge Defense (Security & Anti-Fraud):",
            "footer_text": "How do you prevent rogue drivers from faking landslides to disrupt supply chains? ST_DWithin GPS validation, multi-vehicle consensus, and strict Human-in-the-Loop RLS authorization.",
            "notes": (
                "Judges, I lead Database Architecture and Security. In an emergency platform, data integrity is a matter of national security. "
                "Our backend runs on Supabase PostgreSQL 15 with the PostGIS spatial engine. We protect the system against fake hazard reporting through a three-layer defense: "
                "First, spatial verification: PostGIS runs an ST_DWithin query ensuring the reporter's GPS is physically within 200 meters of the road. "
                "Second, multi-vehicle consensus: 3 independent reports and traffic slowdown telemetry are required before an incident escalates. "
                "Third, strict Row-Level Security: public reports enter a quarantined 'unverified' queue. A district duty officer must visually audit the photo and click 'Verify' before the AI is legally permitted to reroute national highway traffic."
            )
        }
    ]

    for data in slides_data:
        slide = prs.slides.add_slide(blank_layout)

        # 1. Dark Background Shape
        bg_shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5)
        )
        bg_shape.fill.solid()
        bg_shape.fill.fore_color.rgb = BG_DARK
        bg_shape.line.fill.background()

        # 2. Top Header Container
        # Slide Number Badge
        num_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(0.8), Inches(0.8))
        tf_num = num_box.text_frame
        tf_num.word_wrap = True
        p_num = tf_num.paragraphs[0]
        p_num.text = data["slide_num"]
        p_num.font.size = Pt(28)
        p_num.font.bold = True
        p_num.font.color.rgb = CYAN

        # Speaker & Role Badge
        badge_box = slide.shapes.add_textbox(Inches(1.7), Inches(0.35), Inches(10.5), Inches(0.35))
        tf_badge = badge_box.text_frame
        p_badge = tf_badge.paragraphs[0]
        p_badge.text = f"🎯 {data['speaker']}  |  {data['role']}"
        p_badge.font.size = Pt(11)
        p_badge.font.bold = True
        p_badge.font.color.rgb = EMERALD

        # Title
        title_box = slide.shapes.add_textbox(Inches(1.7), Inches(0.65), Inches(10.8), Inches(0.6))
        tf_title = title_box.text_frame
        p_title = tf_title.paragraphs[0]
        p_title.text = data["title"]
        p_title.font.size = Pt(20)
        p_title.font.bold = True
        p_title.font.color.rgb = WHITE

        # Subtitle
        sub_box = slide.shapes.add_textbox(Inches(1.7), Inches(1.22), Inches(10.8), Inches(0.35))
        tf_sub = sub_box.text_frame
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = data["subtitle"]
        p_sub.font.size = Pt(11.5)
        p_sub.font.color.rgb = GRAY

        # 3. Three Main Content Cards
        card_width = Inches(3.68)
        card_height = Inches(4.35)
        card_y = Inches(1.72)
        card_gap = Inches(0.33)
        left_margin = Inches(0.8)

        for i, card in enumerate(data["cards"]):
            card_x = left_margin + i * (card_width + card_gap)

            # Card background shape
            c_shape = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE, card_x, card_y, card_width, card_height
            )
            c_shape.fill.solid()
            c_shape.fill.fore_color.rgb = CARD_BG
            c_shape.line.color.rgb = BORDER_COLOR
            c_shape.line.width = Pt(1.2)

            # Card Content Textbox
            c_box = slide.shapes.add_textbox(card_x + Inches(0.18), card_y + Inches(0.18), card_width - Inches(0.36), card_height - Inches(0.36))
            tf_c = c_box.text_frame
            tf_c.word_wrap = True

            # Card Title
            p_ct = tf_c.paragraphs[0]
            p_ct.text = card["title"]
            p_ct.font.size = Pt(13)
            p_ct.font.bold = True
            p_ct.font.color.rgb = card["color"]
            p_ct.space_after = Pt(10)

            # Card Bullets
            for heading, body in card["bullets"]:
                p_b = tf_c.add_paragraph()
                p_b.space_after = Pt(7)

                r_head = p_b.add_run()
                r_head.text = f"• {heading} "
                r_head.font.size = Pt(9.5)
                r_head.font.bold = True
                r_head.font.color.rgb = WHITE

                r_body = p_b.add_run()
                r_body.text = body
                r_body.font.size = Pt(9)
                r_body.font.color.rgb = GRAY

        # 4. Footer Callout Bar (Judge Q&A / Key Focus)
        foot_shape = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.25), Inches(11.733), Inches(0.85)
        )
        foot_shape.fill.solid()
        foot_shape.fill.fore_color.rgb = CARD_BG
        foot_shape.line.color.rgb = CYAN
        foot_shape.line.width = Pt(1)

        foot_box = slide.shapes.add_textbox(Inches(0.95), Inches(6.28), Inches(11.4), Inches(0.78))
        tf_foot = foot_box.text_frame
        tf_foot.word_wrap = True
        p_foot = tf_foot.paragraphs[0]

        r_ftitle = p_foot.add_run()
        r_ftitle.text = f"{data['footer_title']} "
        r_ftitle.font.size = Pt(10)
        r_ftitle.font.bold = True
        r_ftitle.font.color.rgb = CYAN

        r_ftext = p_foot.add_run()
        r_ftext.text = data["footer_text"]
        r_ftext.font.size = Pt(9.5)
        r_ftext.font.color.rgb = WHITE

        # 5. Embedded Speaker Notes
        notes_slide = slide.notes_slide
        text_frame = notes_slide.notes_text_frame
        text_frame.text = f"SPEAKER: {data['speaker']}\nROLE: {data['role']}\n\nTALKING POINTS (50 SECONDS):\n{data['notes']}"

    output_path = "Setu_SIH_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    create_presentation()
