/** Next Wave Project Lab — authenticated Google Sheets receiver.
 * Configure Script Properties before deployment:
 *   SPREADSHEET_ID = the ID between /d/ and /edit in the spreadsheet URL
 *   SHEETS_WEBAPP_SECRET = a long random secret matching the Supabase function secret
 */
const REGISTRATION_HEADERS = [
  'Timestamp', 'Registration ID', 'Full name', 'Email', 'Workshop ID',
  'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'Referral code',
  'Landing page', 'Registration page', 'Marketing consent', 'Email status',
  'Email provider message ID', 'Sheet synchronization status'
];
const EVENT_HEADERS = [
  'Timestamp', 'Unique event ID', 'Anonymous session ID', 'Event name', 'Source',
  'Medium', 'Campaign', 'Content', 'Referral code', 'Page path', 'Registration ID',
  'Device category', 'Synchronization status'
];
const SUMMARY_HEADERS = [
  'Campaign', 'Source', 'Medium', 'Unique visits', 'Assessment starts',
  'Assessment completions', 'Blog visits', 'Registration page visits',
  'Completed registrations', 'Conversion rate'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty('SHEETS_WEBAPP_SECRET');
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!expectedSecret || !spreadsheetId) return json({ ok: false, error: 'Missing script configuration.' });
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload.secret || !constantTimeEqual(String(payload.secret), expectedSecret)) {
      return json({ ok: false, error: 'Unauthorized.' });
    }
    const tab = String(payload.tab || '');
    if (!['Registrations', 'Campaign Events'].includes(tab)) return json({ ok: false, error: 'Unsupported tab.' });
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ensureSheet(ss, tab, tab === 'Registrations' ? REGISTRATION_HEADERS : EVENT_HEADERS);
    const id = tab === 'Registrations' ? String(payload.registration_id || '') : String(payload.event_id || '');
    if (!id) return json({ ok: false, error: 'Missing unique record ID.' });

    lock.waitLock(10000);
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const idColumn = tab === 'Registrations' ? 2 : 2;
        const existing = sheet.getRange(2, idColumn, lastRow - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
        if (existing) return json({ ok: true, duplicate: true, id: id });
      }
      const row = tab === 'Registrations' ? [
        payload.timestamp || new Date().toISOString(), id, payload.full_name || '', payload.email || '',
        payload.workshop_id || '', payload.utm_source || '', payload.utm_medium || '', payload.utm_campaign || '',
        payload.utm_content || '', payload.referral_code || '', payload.landing_page || '', payload.registration_page || '',
        Boolean(payload.marketing_consent), payload.email_status || 'unknown', payload.email_provider_message_id || '', 'synced'
      ] : [
        payload.timestamp || new Date().toISOString(), id, payload.session_id || '', payload.event_name || '',
        payload.utm_source || '', payload.utm_medium || '', payload.utm_campaign || '', payload.utm_content || '',
        payload.ref || '', payload.page_path || '', payload.registration_id || '', payload.device_category || '', 'synced'
      ];
      sheet.appendRow(row);
      refreshCampaignSummary(ss);
      return json({ ok: true, duplicate: false, id: id });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setupSheets() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Set SPREADSHEET_ID in Script Properties first.');
  const ss = SpreadsheetApp.openById(id);
  ensureSheet(ss, 'Registrations', REGISTRATION_HEADERS);
  ensureSheet(ss, 'Campaign Events', EVENT_HEADERS);
  ensureSheet(ss, 'Campaign Summary', SUMMARY_HEADERS);
  refreshCampaignSummary(ss);
  return 'Sheets initialized.';
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function refreshCampaignSummary(ss) {
  const summary = ensureSheet(ss, 'Campaign Summary', SUMMARY_HEADERS);
  const events = ss.getSheetByName('Campaign Events');
  const regs = ss.getSheetByName('Registrations');
  const buckets = {};
  const keyFor = (campaign, source, medium) => [campaign || '(not set)', source || 'direct', medium || '(not set)'].join('|||');
  const ensure = (campaign, source, medium) => {
    const key = keyFor(campaign, source, medium);
    if (!buckets[key]) buckets[key] = { campaign: campaign || '(not set)', source: source || 'direct', medium: medium || '(not set)', sessions: new Set(), starts: 0, completions: 0, blogs: 0, regPage: 0, registrations: 0 };
    return buckets[key];
  };
  if (events && events.getLastRow() > 1) {
    const rows = events.getRange(2, 1, events.getLastRow() - 1, EVENT_HEADERS.length).getValues();
    rows.forEach(r => {
      const b = ensure(r[6], r[4], r[5]);
      const session = String(r[2] || '');
      const event = String(r[3] || '');
      if (event === 'landing_page_viewed' && session) b.sessions.add(session);
      if (event === 'assessment_started') b.starts += 1;
      if (event === 'assessment_completed') b.completions += 1;
      if (event === 'blog_viewed') b.blogs += 1;
      if (event === 'registration_page_viewed') b.regPage += 1;
    });
  }
  if (regs && regs.getLastRow() > 1) {
    const rows = regs.getRange(2, 1, regs.getLastRow() - 1, REGISTRATION_HEADERS.length).getValues();
    rows.forEach(r => { ensure(r[7], r[5], r[6]).registrations += 1; });
  }
  if (summary.getLastRow() > 1) summary.getRange(2, 1, summary.getLastRow() - 1, SUMMARY_HEADERS.length).clearContent();
  const output = Object.values(buckets).map(b => [
    b.campaign, b.source, b.medium, b.sessions.size, b.starts, b.completions,
    b.blogs, b.regPage, b.registrations,
    b.sessions.size ? b.registrations / b.sessions.size : 0
  ]);
  if (output.length) {
    summary.getRange(2, 1, output.length, SUMMARY_HEADERS.length).setValues(output);
    summary.getRange(2, 10, output.length, 1).setNumberFormat('0.0%');
  }
}
