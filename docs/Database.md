# Database Design

## Core Entities

- Base
- Aircraft
- Instructor
- Student
- Flight
- TechLog
- SnagEntry
- MaintenanceRecord
- SortieGrade
- OccurrenceReport
- InventoryItem
- WeatherCache

## Relationships

Aircraft -> Base
Flight -> Aircraft
Flight -> Student
Flight -> Instructor
TechLog -> Flight
Snag -> TechLog
Maintenance -> Aircraft
