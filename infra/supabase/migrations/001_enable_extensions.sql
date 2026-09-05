-- ============================================
-- Migration 001: Enable Required Extensions
-- Setu — AI-Based Smart Logistics Platform
-- ============================================

-- PostGIS for geospatial data (road geometries, district boundaries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm for text search (useful for SMS parsing, report search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
