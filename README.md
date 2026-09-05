# Setu: AI-Based Smart Logistics and Accessibility Intelligence Platform

Smart India Hackathon 2024: Problem ID SIH26002  
Ministry: Ministry of Development of North Eastern Region (MDoNER)  
Pilot Region: East Khasi Hills District, Meghalaya (Shillong, Cherrapunji, Dawki, Mawsynram, Nongpoh)  

Live Application: https://frontend-ecru-seven-70.vercel.app  
Demo Dashboard: https://frontend-ecru-seven-70.vercel.app/dashboard?demo=true  
Reports Queue: https://frontend-ecru-seven-70.vercel.app/dashboard/reports?demo=true  
Alerts Console: https://frontend-ecru-seven-70.vercel.app/dashboard/alerts?demo=true  

## 1. Problem Overview

During monsoon seasons, India's North Eastern Region faces severe logistical disruptions. High rainfall in areas like Cherrapunji and Mawsynram causes frequent landslides, road subsidence, and flooding. When major arterial highways like NH-6 are blocked, critical shipments of food, medicines, and relief materials are delayed or cut off.

Standard consumer navigation tools optimize for flat terrain traffic speed and do not evaluate geotechnical risks, mountain slope angles, or real-time soil saturation. Setu solves this by providing hazard-aware route planning and accessibility intelligence for mountain transport corridors.

## 2. How the Platform Works

The platform monitors critical logistics corridors and helps drivers and government authorities plan safe travel:

* Real-Time GIS Risk Map: Displays road corridors across East Khasi Hills color-coded by current safety level (Green for low risk, Amber for moderate risk, Red for high hazard or road closure).
* Corridor Inspection: Users can click any corridor to inspect its slope angle, current rainfall rate, and verified field incident reports.
* AI Safe-Route Finder: Uses a risk-weighted Dijkstra pathfinding algorithm. Drivers choose their start hub and destination hub, set their risk tolerance, and the system finds a safe path that avoids hazardous segments.
* Offline Operation: Built as a Progressive Web App (PWA). If mobile data drops in mountain valleys, the app remains responsive, queues hazard reports locally in the browser, and supports emergency SMS fallback reporting.
* Authority Command View: District officials can review incoming field reports, verify road blockages, and push rerouting alerts across the active network.

## 3. Where the Data Comes From

The platform brings together data across multiple sources:

* Road Networks and Geometry: OpenStreetMap (OSM) highway polylines for East Khasi Hills stored as PostGIS LineString geometry objects in the database.
* Topography and Slope Gradient: Calculated terrain steepness angles derived from Digital Elevation Model (DEM) data, stored per road segment.
* Weather and Rainfall Feeds: Live precipitation and rainfall intensity fetched from weather API feeds and cached in PostgreSQL.
* Historical Incident Records: Baseline landslide and flood vulnerability data seeded from regional geological surveys.
* Field Reports and Crowdsourcing: Real-time incident reports submitted by drivers and field observers with GPS coordinates and photos.

## 4. System Architecture

The platform uses a three-tier architecture:

```
[ Web & Mobile PWA Client ]
      |
      v
[ Next.js 16 Web Application ]
      |
      +---> [ PostgreSQL 15 + PostGIS via Supabase ]
      |         - Spatial geometry tables
      |         - Real-time WebSocket subscriptions
      |         - Row Level Security (RLS) policies
      |
      +---> [ Python FastAPI Risk Engine ]
                - NetworkX Dijkstra safe routing service
                - Multi-factor Road Risk Index calculator
                - Weather API polling service
```

* Frontend: Next.js 16 App Router, React 19, TypeScript, and Leaflet for GIS rendering.
* Backend & Database: Supabase PostgreSQL 15 with PostGIS extension for spatial queries and real-time data replication.
* Intelligence Engine: Python FastAPI microservice running NetworkX for graph pathfinding and risk calculations.
* Hosting: Deployed on Vercel Edge platform.

## 5. Database Structure

The database consists of 10 structured tables:

* districts: Administrative district boundaries with PostGIS polygons.
* road_segments: 15 monitored road corridors with geometry, slope, and risk scores.
* risk_scores: Historical and computed risk index records per corridor.
* risk_alerts: System-generated hazard alerts by severity level.
* reports: Field hazard reports with GPS coordinates and incident categories.
* report_verifications: Verification logs by authorized personnel.
* notifications: User notification and dispatch logs.
* audit_logs: Administrative audit trail for status overrides.
* weather_cache: Cached rainfall telemetry.
* users: User profiles with role-based access (official, driver, reporter, admin).

## 6. How to Run the Project Locally

### Prerequisites
* Node.js 20 or higher
* Python 3.12 or higher
* A Supabase project with PostGIS enabled

### Step 1: Clone the Repository
```bash
git clone https://github.com/synaptrix8-cell/AI-Based-Smart-Logistics-Accessibility-Intelligence-Platform.git
cd AI-Based-Smart-Logistics-Accessibility-Intelligence-Platform
```

### Step 2: Set Up Database Schema
Open your Supabase SQL Editor and run the script:
`infra/supabase/full_schema_setup.sql`

This sets up all required tables, spatial indexes, and seeds the 15 East Khasi Hills corridors.

### Step 3: Run the Frontend
```bash
cd frontend
npm install
node node_modules/next/dist/bin/next dev
```
Open http://localhost:3000 in your browser.

### Step 4: Run the Risk Engine (Optional for local routing microservice)
```bash
cd services/risk-engine
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API documentation is available at http://localhost:8000/docs.

## 7. Security and Privacy

* Credentials and secrets are kept strictly in private environment files and are never committed to the repository.
* Database access is secured via PostgreSQL Row Level Security (RLS) policies.
* This repository is private and confidential to the development team and project evaluators.
