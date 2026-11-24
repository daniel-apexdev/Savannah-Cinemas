// ============================================================
// SAVANNAH CINEMAS - EMAIL
// utils/emailService.js
//
// Sends through Gmail (GMAIL_USER + GMAIL_APP_PASSWORD), or any
// SMTP server if SMTP_HOST is set:
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for 465),
//   SMTP_USER, SMTP_PASS, MAIL_FROM ("Savannah Cinemas <tickets@...>")
//
// The ticket QR and the logo are attached inline (cid:) rather than
// as data: URLs, because Gmail and Outlook strip data: images.
// The logo file is backend/assets/email/logo-mark.png.
//
// The design follows the app ("Harmattan Marquee"): warm dark page,
// the ticket on bone paper, laterite for the one action, gold for VIP
// seats and special nights.
// ============================================================

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

let transporter = null;
let transportKey = '';

function getTransport() {

    const smtpHost = process.env.SMTP_HOST;
    const key = smtpHost
        ? `smtp:${smtpHost}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`
        : `gmail:${process.env.GMAIL_USER}`;

    if (transporter && key === transportKey) return transporter;

    if (smtpHost) {

        const port = Number(process.env.SMTP_PORT) || 587;

        transporter = nodemailer.createTransport({
            host: smtpHost,
            port,
            secure: String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === 'true',
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
            ...(String(process.env.SMTP_IGNORE_TLS || '').toLowerCase() === 'true' ? { ignoreTLS: true } : {})
        });

    } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {

        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });

    } else {

        transporter = null;

    }

    transportKey = key;
    return transporter;
}

function isEmailConfigured() {
    return !!getTransport();
}

function fromAddress() {
    if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
    const user = process.env.SMTP_HOST ? process.env.SMTP_USER : process.env.GMAIL_USER;
    return `"Savannah Cinemas" <${user || 'no-reply@savannahcinemas.com'}>`;
}


// ------------------------------------------------------------
// Formatting
// ------------------------------------------------------------

const esc = (v) =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const money = (v, currency = 'GHS') => {
    const n = Number(v);
    return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const longDate = (v) =>
    asDate(v).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const clock = (v) =>
    asDate(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const titleCase = (s) =>
    String(s || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bVip\b/, 'VIP');

const METHOD = {
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Card',
    BANK_TRANSFER: 'Bank transfer',
    CASH: 'Cash'
};


// Brand: the app's "Harmattan Marquee" tokens (mobile/src/theme.ts)
const C = {
    night: '#12100D',      // page
    booth: '#1D1A16',      // raised panels
    rule: '#34302A',       // hairlines
    bone: '#F1E8D6',       // text on dark, ticket paper
    boneSoft: '#D6CCB8',   // reading text on dark
    dust: '#A89F8E',       // secondary text on dark
    ink: '#12100D',        // text on bone
    inkSoft: '#4A443B',    // secondary text on bone
    perf: '#B9AE97',       // ticket perforation
    laterite: '#E0562B',   // the one light: primary action, "now"
    lateriteSoft: '#F07A52',
    vip: '#F2C14E'         // VIP seats, special nights
};

const DISPLAY = `'Big Shoulders Display','Arial Narrow','Helvetica Neue',Arial,sans-serif`;
const BODY = `'Hanken Grotesk','Helvetica Neue',Arial,sans-serif`;
const MONO = `'JetBrains Mono',Menlo,Consolas,monospace`;

// The mark (sun behind an acacia), sent inline like the QR code
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'email', 'logo-mark.png');
let logoPng;
function logoBuffer() {
    if (logoPng === undefined) {
        try {
            logoPng = fs.readFileSync(LOGO_PATH);
        } catch (_) {
            // Supabase Edge Function: no files, use the bundled copy
            try {
                logoPng = Buffer.from(require('../assets/email/logo'), 'base64');
            } catch (__) {
                logoPng = null;
            }
        }
    }
    return logoPng;
}

/** "Savannah Cinemas - West Hills Mall" -> "West Hills Mall" */
const placeName = (name) =>
    String(name || '').replace(/^Savannah Cinemas\s*[-–·]\s*/i, '').trim() || 'Savannah Cinemas';

const runtime = (mins) => {
    const m = Number(mins);
    if (!Number.isFinite(m) || m <= 0) return null;
    return m >= 60 ? `${Math.floor(m / 60)}H ${String(m % 60).padStart(2, '0')}M` : `${m} MIN`;
};

/** TMDB images: ask for a sensible size for email */
const tmdbSized = (url, size) =>
    url && /image\.tmdb\.org\/t\/p\//.test(url) ? url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`) : url || null;


/**
 * booking: {
 *   bookingRef, startTime, endTime,
 *   movie: { title, ageRating, runtimeMinutes, posterUrl?, backdropUrl? },
 *   cinema: { name, address, city, phoneNumber, email },
 *   screen: { name },
 *   seats: [{ seatLabel, seatType, ticketPrice }],
 *   special?: { name, discountPercent },
 *   discountAmount, pointsDiscount, pointsRedeemed, totalAmount,
 *   snacks: [{ name, quantity, lineTotal }], snackCodes: [code],
 *   ticket: { ticketCode, qrCodeData },
 *   payment: { method, reference, transactionReference, paidAt }
 * }
 * logoCid / qrCid: content ids of the inline images (or null)
 */
function buildEmail({ customerName, booking, qrCid, logoCid }) {

    const seats = Array.isArray(booking.seats) ? booking.seats : [];
    const snacks = Array.isArray(booking.snacks) ? booking.snacks : [];
    const simulated = /^MOCK/i.test(booking.payment?.transactionReference || '');
    const firstName = String(customerName || '').trim().split(/\s+/)[0] || 'there';
    const place = placeName(booking.cinema?.name);
    const where = [booking.cinema?.address, booking.cinema?.city]
        .filter((x, i, a) => x && a.indexOf(x) === i)
        .join(', ');
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where || booking.cinema?.name || 'Savannah Cinemas')}`;
    const still = tmdbSized(booking.movie?.backdropUrl, 'w780');
    const special = booking.special && booking.special.name ? booking.special : null;
    const isVip = (s) => String(s.seatType || '').toUpperCase() === 'VIP';
    const shortDay = asDate(booking.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const meta = [booking.movie?.ageRating, runtime(booking.movie?.runtimeMinutes)].filter(Boolean).join(' · ');

    // Small type styles
    const label = (color) => `font-family:${MONO};font-size:11px;letter-spacing:1.5px;color:${color};text-transform:uppercase;`;

    const line = (labelHtml, value, opts = {}) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid ${C.rule};font-family:${BODY};font-size:15px;color:${C.boneSoft};">${labelHtml}</td>
          <td align="right" style="padding:11px 0;border-bottom:1px solid ${C.rule};font-family:${MONO};font-size:14px;color:${opts.valueColor || C.bone};white-space:nowrap;">${value}</td>
        </tr>`;

    const seatRows = seats
        .map((s) => line(
            `Seat <span style="font-family:${MONO};font-weight:bold;color:${C.bone};">${esc(s.seatLabel)}</span>&nbsp; <span style="color:${isVip(s) ? C.vip : C.dust};font-size:13px;">${esc(titleCase(s.seatType || 'standard'))}</span>`,
            esc(money(s.ticketPrice))
        ))
        .join('');

    const snackRows = snacks
        .map((s) => line(
            `${esc(s.name)}&nbsp; <span style="color:${C.dust};font-size:13px;">× ${esc(s.quantity)}</span>`,
            esc(money(s.lineTotal))
        ))
        .join('');

    const discountRows = (Number(booking.discountAmount) > 0
        ? line('Promo discount', `−${esc(money(booking.discountAmount))}`, { valueColor: C.lateriteSoft })
        : '') + (Number(booking.pointsDiscount) > 0
        ? line(`Savannah Rewards&nbsp; <span style="color:${C.dust};font-size:13px;">${esc(booking.pointsRedeemed)} points</span>`, `−${esc(money(booking.pointsDiscount))}`, { valueColor: C.lateriteSoft })
        : '');

    // Ticket facts (on bone paper)
    const fact = (k, v, width) => `
        <td valign="top" width="${width}" style="padding:0 10px 16px 0;">
          <div style="${label(C.inkSoft)}">${k}</div>
          <div style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${C.ink};text-transform:uppercase;line-height:1.15;margin-top:2px;">${v}</div>
        </td>`;

    const seatChips = seats
        .map((s) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 9px;border:2px solid ${isVip(s) ? '#C99A1E' : C.ink};${isVip(s) ? `background:${C.vip};` : ''}border-radius:3px;font-family:${MONO};font-size:15px;font-weight:bold;color:${C.ink};">${esc(s.seatLabel)}</span>`)
        .join('');

    // The ticket's perforated edge: a dashed line between two "punched" notches
    const perforation = `
      <tr>
        <td width="14" style="width:14px;padding:0;"><div style="width:14px;height:28px;background:${C.night};border-radius:0 14px 14px 0;"></div></td>
        <td style="padding:0 6px;"><div style="border-top:2px dashed ${C.perf};height:0;line-height:0;font-size:0;">&nbsp;</div></td>
        <td width="14" style="width:14px;padding:0;"><div style="width:14px;height:28px;background:${C.night};border-radius:14px 0 0 14px;"></div></td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Your Savannah Cinemas tickets</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Hanken+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  a { color:${C.lateriteSoft}; }
  @media (max-width:480px) {
    .px { padding-left:16px !important; padding-right:16px !important; }
    .title { font-size:38px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(booking.movie?.title)} · ${esc(shortDay)} at ${esc(clock(booking.startTime))} · ${esc(place)}. Seats ${esc(seats.map((s) => s.seatLabel).join(', '))}.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.night};">
<tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Masthead: mark, wordmark, location -->
  <tr><td class="px" style="padding:0 4px 22px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${logoCid ? `<td width="52" valign="middle" style="width:52px;padding-right:12px;"><img src="cid:${logoCid}" width="44" height="44" alt="" style="display:block;border:0;"></td>` : ''}
        <td valign="middle">
          <div style="font-family:${DISPLAY};font-size:26px;font-weight:900;color:${C.bone};text-transform:uppercase;letter-spacing:0.5px;line-height:1;">Savannah Cinemas</div>
          <div style="${label(C.dust)}margin-top:5px;"><span style="color:${C.laterite};">&#9679;</span>&nbsp; ${esc(place)}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${still ? `
  <!-- Film still -->
  <tr><td style="padding:0 0 18px;">
    <img src="${esc(still)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:4px;">
  </td></tr>` : ''}

  <!-- Headline -->
  <tr><td class="px" style="padding:0 4px;">
    <div style="${label(C.laterite)}font-size:12px;letter-spacing:2px;">You're booked, ${esc(firstName)}</div>
    <div class="title" style="font-family:${DISPLAY};font-size:46px;font-weight:900;color:${C.bone};text-transform:uppercase;line-height:1.05;margin:8px 0 8px;">${esc(booking.movie?.title)}</div>
    ${meta ? `<div style="${label(C.dust)}font-size:12px;">${esc(meta)}</div>` : ''}
    ${special ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
      <td style="background:${C.vip};border-radius:3px;padding:7px 12px;font-family:${MONO};font-size:12px;font-weight:bold;letter-spacing:1px;color:${C.ink};text-transform:uppercase;">${esc(special.name)}${Number(special.discountPercent) > 0 ? ` · ${Math.round(Number(special.discountPercent))}% off every seat` : ''}</td>
    </tr></table>` : ''}
    <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  </td></tr>

  <!-- Ticket (bone paper, like the app's ticket) -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bone};border-radius:6px;">
      <tr><td colspan="3" style="padding:22px 22px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${fact('Date', esc(shortDay), '42%')}
            ${fact('Time', esc(clock(booking.startTime)), '28%')}
            ${fact('Screen', esc(String(booking.screen?.name || '').replace(/^screen\s*/i, '') || '–'), '30%')}
          </tr>
          <tr>
            <td colspan="3" style="padding:0 0 14px;">
              <div style="${label(C.inkSoft)}">Cinema</div>
              <div style="font-family:${DISPLAY};font-size:22px;font-weight:800;color:${C.ink};text-transform:uppercase;line-height:1.2;margin-top:2px;">${esc(place)}</div>
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding:0 0 8px;">
              <div style="${label(C.inkSoft)}margin-bottom:6px;">Seats</div>
              ${seatChips}
            </td>
          </tr>
        </table>
      </td></tr>
      ${perforation}
      <tr><td colspan="3" style="padding:16px 22px 22px;" align="center">
        ${qrCid ? `
        <img src="cid:${qrCid}" width="196" height="196" alt="Ticket QR code" style="display:block;margin:0 auto;background:#FFFFFF;padding:10px;border-radius:4px;border:0;">
        <div style="font-family:${MONO};font-size:14px;font-weight:bold;color:${C.ink};margin-top:12px;letter-spacing:2px;">${esc(booking.ticket?.ticketCode)}</div>
        <div style="font-family:${BODY};font-size:13px;color:${C.inkSoft};margin-top:6px;">Show this at the door. It's also in the app, under Account › Tickets.</div>` : `
        <div style="font-family:${BODY};font-size:14px;color:${C.inkSoft};">Your ticket QR code is in the app, under Account › Tickets.</div>`}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1.5px solid ${C.ink};">
          <tr>
            <td style="padding-top:10px;${label(C.inkSoft)}">Booking ref</td>
            <td align="right" style="padding-top:10px;font-family:${MONO};font-size:16px;font-weight:bold;letter-spacing:1px;color:${C.ink};">${esc(booking.bookingRef)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${booking.snackCodes && booking.snackCodes.length ? `
  <!-- Snacks collection -->
  <tr><td style="padding:16px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.booth};border-radius:6px;border-left:4px solid ${C.laterite};">
      <tr>
        <td style="padding:16px 18px;">
          <div style="${label(C.dust)}">Snacks · collect at the kiosk</div>
          <div style="font-family:${BODY};font-size:14px;color:${C.boneSoft};margin-top:4px;">Show this code at the counter${snacks.length ? ` for ${snacks.reduce((a, s) => a + (Number(s.quantity) || 0), 0)} item${snacks.reduce((a, s) => a + (Number(s.quantity) || 0), 0) === 1 ? '' : 's'}` : ''}.</div>
        </td>
        <td align="right" style="padding:16px 18px;font-family:${MONO};font-size:24px;font-weight:bold;letter-spacing:2px;color:${C.bone};white-space:nowrap;">${booking.snackCodes.map(esc).join('<br>')}</td>
      </tr>
    </table>
  </td></tr>` : ''}

  <!-- Receipt -->
  <tr><td class="px" style="padding:30px 4px 0;">
    <div style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${C.bone};text-transform:uppercase;border-top:1.5px solid ${C.bone};padding-top:12px;">Receipt</div>
    ${special && Number(special.discountPercent) > 0 ? `<div style="font-family:${BODY};font-size:13px;color:${C.dust};margin-top:2px;">Seat prices include the ${esc(special.name)} discount.</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${seatRows}
      ${snackRows}
      ${discountRows}
      <tr>
        <td style="padding:16px 0 6px;font-family:${BODY};font-size:16px;font-weight:bold;color:${C.bone};">Total paid</td>
        <td align="right" style="padding:16px 0 6px;font-family:${MONO};font-size:24px;font-weight:bold;color:${C.bone};white-space:nowrap;">${esc(money(booking.totalAmount))}</td>
      </tr>
    </table>
    <div style="font-family:${MONO};font-size:12px;color:${C.dust};line-height:1.7;">
      ${esc(METHOD[booking.payment?.method] || titleCase(booking.payment?.method || ''))}${booking.payment?.reference ? ` · ${esc(booking.payment.reference)}` : ''}${booking.payment?.paidAt ? ` · ${esc(asDate(booking.payment.paidAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}` : ''}
    </div>
    ${simulated ? `<div style="font-family:${BODY};font-size:12px;color:${C.dust};margin-top:6px;">Test mode: this payment was simulated and no money was taken.</div>` : ''}
  </td></tr>

  <!-- Getting there -->
  <tr><td class="px" style="padding:30px 4px 0;">
    <div style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${C.bone};text-transform:uppercase;border-top:1.5px solid ${C.bone};padding-top:12px;">Getting there</div>
    <div style="font-family:${BODY};font-size:15px;color:${C.bone};font-weight:bold;margin-top:8px;">${esc(booking.cinema?.name)}</div>
    ${where ? `<div style="font-family:${BODY};font-size:14px;color:${C.dust};line-height:1.5;">${esc(where)}</div>` : ''}
    ${booking.cinema?.phoneNumber || booking.cinema?.email ? `
    <div style="font-family:${MONO};font-size:13px;color:${C.dust};margin-top:4px;">
      ${booking.cinema?.phoneNumber ? `<a href="tel:${esc(String(booking.cinema.phoneNumber).replace(/\s+/g, ''))}" style="color:${C.dust};text-decoration:none;">${esc(booking.cinema.phoneNumber)}</a>` : ''}${booking.cinema?.phoneNumber && booking.cinema?.email ? ' · ' : ''}${booking.cinema?.email ? `<a href="mailto:${esc(booking.cinema.email)}" style="color:${C.dust};">${esc(booking.cinema.email)}</a>` : ''}
    </div>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
      <td style="background:${C.laterite};border-radius:3px;">
        <a href="${esc(mapsUrl)}" style="display:inline-block;padding:13px 22px;font-family:${MONO};font-size:13px;font-weight:bold;letter-spacing:1.5px;color:${C.ink};text-decoration:none;text-transform:uppercase;">Directions to ${esc(place)}</a>
      </td>
    </tr></table>
    <div style="font-family:${BODY};font-size:14px;color:${C.boneSoft};margin-top:16px;line-height:1.5;">Please arrive 15 minutes before the film starts.</div>
  </td></tr>

  <!-- Footer -->
  <tr><td class="px" style="padding:34px 4px 0;">
    <div style="border-top:1px solid ${C.rule};padding-top:16px;">
      <div style="${label(C.dust)}">Savannah Cinemas · Accra Mall · West Hills Mall</div>
      <div style="font-family:${BODY};font-size:12px;color:${C.dust};margin-top:8px;line-height:1.5;">You're getting this because a booking was made with this email address. Your tickets, snacks and rewards are always in the Savannah Cinemas app.</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const text = [
        `SAVANNAH CINEMAS · ${place.toUpperCase()}`,
        ``,
        `You're booked, ${firstName}.`,
        ``,
        `${booking.movie?.title}${meta ? ` (${meta})` : ''}`,
        special ? `${special.name}${Number(special.discountPercent) > 0 ? `: ${Math.round(Number(special.discountPercent))}% off every seat` : ''}` : null,
        `${longDate(booking.startTime)} at ${clock(booking.startTime)}`,
        `${booking.screen?.name} · ${booking.cinema?.name}`,
        `Seats: ${seats.map((s) => `${s.seatLabel}${isVip(s) ? ' (VIP)' : ''}`).join(', ')}`,
        `Booking ref: ${booking.bookingRef}`,
        booking.ticket?.ticketCode ? `Ticket code: ${booking.ticket.ticketCode}` : null,
        booking.snackCodes && booking.snackCodes.length ? `Snack collection code: ${booking.snackCodes.join(', ')}` : null,
        ``,
        `RECEIPT`,
        ...seats.map((s) => `  Seat ${s.seatLabel} (${titleCase(s.seatType || 'standard')})  ${money(s.ticketPrice)}`),
        ...snacks.map((s) => `  ${s.name} x ${s.quantity}  ${money(s.lineTotal)}`),
        Number(booking.discountAmount) > 0 ? `  Promo discount  -${money(booking.discountAmount)}` : null,
        Number(booking.pointsDiscount) > 0 ? `  Savannah Rewards (${booking.pointsRedeemed} points)  -${money(booking.pointsDiscount)}` : null,
        `  Total paid  ${money(booking.totalAmount)}`,
        `  ${METHOD[booking.payment?.method] || booking.payment?.method || ''}${booking.payment?.reference ? ` · ${booking.payment.reference}` : ''}`,
        simulated ? `  (Test mode: payment simulated, no money taken.)` : null,
        ``,
        `GETTING THERE`,
        [booking.cinema?.name, where].filter(Boolean).join(', '),
        booking.cinema?.phoneNumber ? booking.cinema.phoneNumber : null,
        `Directions: ${mapsUrl}`,
        `Show the QR code in the app (Account > Tickets) at the door. Please arrive 15 minutes before the film starts.`
    ]
        .filter((l) => l !== null)
        .join('\n');

    return { html, text };
}


// ============================================================
// SEND BOOKING CONFIRMATION
// Returns { sent: boolean, messageId?, reason? }. Never throws.
// ============================================================

async function sendBookingConfirmation({ to, email, customerName, booking }) {

    const recipient = to || email;
    const transport = getTransport();

    if (!transport) {
        console.warn('⚠️ Email is not configured (set GMAIL_USER/GMAIL_APP_PASSWORD or SMTP_HOST)');
        return { sent: false, reason: 'Email is not set up on the server' };
    }

    if (!recipient) {
        return { sent: false, reason: 'No email address' };
    }

    if (!booking) {
        return { sent: false, reason: 'Booking data is missing' };
    }

    const attachments = [];
    let qrCid = null;

    if (booking.ticket && booking.ticket.qrCodeData) {
        try {
            const png = await QRCode.toBuffer(booking.ticket.qrCodeData, { width: 400, margin: 1, errorCorrectionLevel: 'M' });
            qrCid = `ticket-qr-${booking.bookingRef || 'savannah'}@savannahcinemas`;
            attachments.push({ filename: 'ticket-qr.png', content: png, cid: qrCid, contentType: 'image/png' });
        } catch (qrError) {
            console.error('❌ QR code generation failed:', qrError.message);
        }
    }

    let logoCid = null;
    const logo = logoBuffer();
    if (logo) {
        logoCid = 'savannah-logo@savannahcinemas';
        attachments.push({ filename: 'savannah-cinemas.png', content: logo, cid: logoCid, contentType: 'image/png' });
    }

    const { html, text } = buildEmail({ customerName, booking, qrCid, logoCid });

    try {

        const info = await transport.sendMail({
            from: fromAddress(),
            to: recipient,
            subject: `Your tickets: ${booking.movie?.title} · ${asDate(booking.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${clock(booking.startTime)} · ${placeName(booking.cinema?.name)} · ${booking.bookingRef}`,
            html,
            text,
            attachments
        });

        console.log(`📧 Booking confirmation ${booking.bookingRef} sent to ${recipient}`);
        return { sent: true, messageId: info.messageId };

    } catch (error) {

        console.error('❌ Booking email failed:', error.message);
        return { sent: false, reason: error.message };

    }
}


module.exports = {
    sendBookingConfirmation,
    isEmailConfigured,
    // exported for previews/tests
    buildEmail
};
