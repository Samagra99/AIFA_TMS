# Software Requirements Document

This document is derived from the supplied SRD React prototype and contains the detailed functional specification.

## AI Integration
- **AI Agent:** Google Gemini (`gemini-2.5-flash`) — exclusive AI provider
- Server-side only — API key stored in environment variable `GEMINI_API_KEY`
- Client never directly calls AI APIs; all requests proxied through backend

## Breath Analyzer (BA) Module
- **Doctor Role:** New `doctor` user role for medical officers
- **BA Equipment Management:** Doctors save and select equipment (equipment number, serial number, model, calibration dates)
- **BA Test Entry:** Doctor selects person (searchable students/instructors), records test serial number, test time, result (pass/fail), alcohol level
- **Dispatch Hard Constraint:** Valid negative BA test within 12-hour window required for all crew before flight dispatch clearance. Does NOT affect flight planning or rostering.

## Weather & Runway Module
- **Runway Model:** Multiple runways per base, managed via Django admin
- **Active Runway Selection:** Dispatcher sets active runway for crosswind calculations
- **Manual METAR/TAF:** Fallback entry when API is unreachable or data unavailable
- **Unified Storage:** Auto-fetched and manual weather entries stored in same table with source field
- **True Crosswind:** Calculated using `|wind_speed × sin(wind_dir - runway_heading)|`

## Module Requirements
- Project overview
- Technology stack
- Module requirements (Users, Infrastructure, Scheduling, Dispatch, Maintenance, Compliance, Rostering, Weather, Finance, Inventory, Syllabus)
- Data models
- API integrations
- Non-functional requirements
- MVP phases

> The original React SRD should be treated as the authoritative detailed specification.