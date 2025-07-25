import { v4 as uuidv4 } from 'uuid';
import { formatDate, formatDateWithoutZ } from './utile/date.utils';

export function generateICalEvent(event = {}) {
  const domain = process.env.DOMAIN || 'stagholme.com';
  const emailFrom = event.organizer?.email || process.env.EMAIL_FROM || 'no-reply@showcase.education';
  const uid = `${uuidv4()}@${domain}`;

  const timezoneBlock = `BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:20241103T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20240310T020000
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//stagholme.com//Calendar API//EN
METHOD:REQUEST
${timezoneBlock}
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART;TZID=America/New_York:${formatDateWithoutZ(event.startTime)}
DTEND;TZID=America/New_York:${formatDateWithoutZ(event.endTime)}
SUMMARY:${event.summary || 'Untitled Event'}
DESCRIPTION:${event.description || 'No description provided.'}
LOCATION:${event.location || ''}
ORGANIZER;CN=${event.organizer?.name || 'Event Organizer'}:mailto:${emailFrom}
ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${event.to?.name || event.to?.email || 'Recipient'}:mailto:${event.to?.email || emailFrom}
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
CLASS:PUBLIC
END:VEVENT
END:VCALENDAR`;
}


// const { v4: uuidv4 } = require('uuid');

// const formatDate = (date) => {
//   if (!date || isNaN(new Date(date).getTime())) return '';
//   return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
// };

// const formatDateWithoutZ = (date) => {
//   if (!date || isNaN(new Date(date).getTime())) return '';
//   return new Date(date).toISOString().replace(/\.\d{3}Z$/, '').replace(/[-:]/g, '');
// };

// function generateICalEvent(event = {}) {
//   const domain = process.env.DOMAIN || 'stagholme.com';
//   const emailFrom = event.organizer?.email || process.env.EMAIL_FROM || 'no-reply@stagholme.com';

//   return `BEGIN:VCALENDAR
// VERSION:2.0
// PRODID:-//stagholme.com//Calendar API//EN
// METHOD:REQUEST
// BEGIN:VEVENT
// UID:${uuidv4()}@${domain}
// DTSTAMP:${formatDate(new Date())}
// DTSTART;TZID=America/New_York:${formatDateWithoutZ(event.startTime)}
// DTEND;TZID=America/New_York:${formatDateWithoutZ(event.endTime)}
// SUMMARY:${event.summary || 'Untitled Event'}
// DESCRIPTION:${event.description || 'No description provided.'}
// LOCATION:${event.location || ''}
// ORGANIZER;CN=${event.organizer?.name || 'Event Organizer'}:mailto:${emailFrom}
// ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${event.to?.name || event.to?.email || 'Recipient'}:mailto:${event.to?.email || emailFrom}
// SEQUENCE:0
// STATUS:CONFIRMED
// TRANSP:OPAQUE
// END:VEVENT
// END:VCALENDAR`;
// }

// module.exports = {
//   generateICalEvent,
//   formatDate
// };
