/**
 * Radiosonde Configuration
 * All settings loaded from environment variables
 */

export const CONFIG = {
  tempest: {
    token: process.env.TEMPEST_TOKEN || '',
    stationId: process.env.TEMPEST_STATION_ID || '36763',
    baseUrl: 'https://swd.weatherflow.com/swd/rest'
  },
  nws: {
    lat: process.env.NWS_LAT || '42.9054',
    lon: process.env.NWS_LON || '-78.6923',
    office: process.env.NWS_OFFICE || 'BUF',

    get afdUrl() {
      return `https://forecast.weather.gov/product.php?site=${this.office}&issuedby=${this.office}&product=AFD&format=TXT&version=1`;
    },
    get hwoUrl() {
      return `https://forecast.weather.gov/product.php?site=NWS&issuedby=${this.office}&product=HWO&format=TXT&version=1`;
    },
    get pointsUrl() {
      return `https://api.weather.gov/points/${this.lat},${this.lon}`;
    },
    get alertsUrl() {
      return `https://api.weather.gov/alerts/active?point=${this.lat},${this.lon}`;
    }
  },
  location: {
    name: process.env.LOCATION_NAME || 'Buffalo, NY',
    description: 'Southern border of Lancaster, NY at Transit Rd & Michael Anthony Lane',
    nearbyAreas: ['Lancaster', 'Alden', 'East Aurora', 'Depew', 'Cheektowaga']
  },
  family: {
    // Michelle works at a school in Alden - school schedule (weekdays, follows school calendar)
    michelle: {
      workplace: 'School in Alden, NY',
      schedule: 'Weekdays during school year (follows school calendar, off holidays/breaks)'
    },
    // Scott works in East Aurora only on Thursdays
    scott: {
      workplace: 'East Aurora, NY',
      schedule: 'Thursdays only'
    }
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-5-haiku-20241022'
  },
  email: {
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    to: process.env.EMAIL_TO || '',
    from: process.env.SMTP_USER || ''
  }
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!CONFIG.tempest.token) errors.push('TEMPEST_TOKEN not set');
  if (!CONFIG.claude.apiKey) errors.push('ANTHROPIC_API_KEY not set');
  if (!CONFIG.email.smtpUser) errors.push('SMTP_USER not set');
  if (!CONFIG.email.smtpPass) errors.push('SMTP_PASS not set');
  if (!CONFIG.email.to) errors.push('EMAIL_TO not set');

  return { valid: errors.length === 0, errors };
}
