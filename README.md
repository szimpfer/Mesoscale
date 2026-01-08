# Mesoscale

A collection of weather and environmental monitoring projects for the home.

## Projects

### [Radiosonde](./projects/radiosonde/)

AI-powered weather briefings via email. Fetches data from a Tempest personal weather station and NWS, uses Claude AI to generate personalized narratives, and delivers them on a schedule.

**Features:**
- Multi-source weather data (Tempest + National Weather Service)
- Time-aware briefings (morning, midday, evening) at 6 AM, 12 PM, 6 PM
- Drone flying forecast for Part 107 operators (6 AM - Midnight)
- Alert monitoring with smart notifications
- Family-specific context (commute impacts, schedules)

[View Radiosonde Documentation →](./projects/radiosonde/README.md)

---

## About

Mesoscale refers to weather phenomena that occur at intermediate scales - larger than a single storm but smaller than synoptic (continental) patterns. These projects focus on hyperlocal weather monitoring and automation for a single household.

## Deployment

Projects are designed to run as Docker containers in an OrbStack/Docker Compose stack:

```
~/stacks/home/
├── docker-compose.yml
├── .env
└── services/
    └── radiosonde-briefing/
```

## License

MIT
