// ============================================================
// SAVANNAH CINEMAS - EMAIL
// utils/emailService.js
//
// Sends through Gmail (GMAIL_USER + GMAIL_APP_PASSWORD), or any
// SMTP server if SMTP_HOST is set:
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for 465),
//   SMTP_USER, SMTP_PASS, MAIL_FROM ("Savannah Cinemas <tickets@...>")
//
// The ticket QR is attached inline (cid:) rather than as a data:
// URL, because Gmail and Outlook strip data: images.
// ============================================================

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


// Brand
const C = {
    night: '#12100D',
    booth: '#1D1A16',
    rule: '#34302A',
    bone: '#F1E8D6',
    dust: '#A89F8E',
    ink: '#12100D',
    inkSoft: '#4A443B',
    laterite: '#E0562B'
};

const DISPLAY = `'Big Shoulders Display','Arial Narrow','Helvetica Neue',Arial,sans-serif`;
const BODY = `'Hanken Grotesk','Helvetica Neue',Arial,sans-serif`;
const MONO = `'JetBrains Mono',Menlo,Consolas,monospace`;


/**
 * booking: {
 *   bookingRef, startTime, endTime,
 *   movie: { title, ageRating, runtimeMinutes },
 *   cinema: { name, address, city, phoneNumber, email },
 *   screen: { name },
 *   seats: [{ seatLabel, seatType, ticketPrice }],
 *   discountAmount, totalAmount,
 *   snacks: [{ name, quantity, lineTotal }], snackCodes: [code],
 *   ticket: { ticketCode, qrCodeData },
 *   payment: { method, reference, transactionReference, paidAt }
 * }
 */
function buildEmail({ customerName, booking, qrCid }) {

    const seats = Array.isArray(booking.seats) ? booking.seats : [];
    const snacks = Array.isArray(booking.snacks) ? booking.snacks : [];
    const simulated = /^MOCK/i.test(booking.payment?.transactionReference || '');
    const firstName = String(customerName || '').trim().split(/\s+/)[0] || 'there';
    const where = [booking.cinema?.address, booking.cinema?.city]
        .filter((x, i, a) => x && a.indexOf(x) === i)
        .join(', ');

    const line = (label, value, opts = {}) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${opts.rule || C.rule};font-family:${BODY};font-size:15px;color:${opts.color || C.bone};">${label}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${opts.rule || C.rule};font-family:${MONO};font-size:14px;color:${opts.valueColor || opts.color || C.bone};white-space:nowrap;">${value}</td>
        </tr>`;

    const seatRows = seats
        .map((s) => line(
            `Seat <span style="font-family:${MONO};font-weight:bold;">${esc(s.seatLabel)}</span> <span style="color:${C.dust};font-size:13px;">&nbsp;${esc(titleCase(s.seatType || 'standard'))}</span>`,
            esc(money(s.ticketPrice))
        ))
        .join('');

    const snackRows = snacks
        .map((s) => line(
            `${esc(s.name)} <span style="color:${C.dust};font-size:13px;">&nbsp;× ${esc(s.quantity)}</span>`,
            esc(money(s.lineTotal))
        ))
        .join('');

    const discountRow = (Number(booking.discountAmount) > 0
        ? line('Promo discount', `−${esc(money(booking.discountAmount))}`, { valueColor: '#F07A52' })
        : '') + (Number(booking.pointsDiscount) > 0
        ? line(`Savannah Rewards <span style="color:${C.dust};font-size:13px;">&nbsp;${esc(booking.pointsRedeemed)} points</span>`, `−${esc(money(booking.pointsDiscount))}`, { valueColor: '#F07A52' })
        : '');

    const fact = (k, v) => `
        <td valign="top" style="padding:0 16px 14px 0;">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:1px;color:${C.inkSoft};text-transform:uppercase;">${k}</div>
          <div style="font-family:${DISPLAY};font-size:22px;font-weight:800;color:${C.ink};text-transform:uppercase;line-height:1.2;">${v}</div>
        </td>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Your Savannah Cinemas tickets</title>
</head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(booking.movie?.title)}, ${esc(longDate(booking.startTime))} at ${esc(clock(booking.startTime))}. Seats ${esc(seats.map((s) => s.seatLabel).join(', '))}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.night};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="padding:0 4px 18px;">
    <div style="font-family:${DISPLAY};font-size:28px;font-weight:900;color:${C.bone};text-transform:uppercase;letter-spacing:0.5px;">Savannah</div>
  </td></tr>

  <tr><td style="padding:0 4px;">
    <div style="font-family:${MONO};font-size:12px;letter-spacing:2px;color:${C.laterite};text-transform:uppercase;">You're booked, ${esc(firstName)}</div>
    <div style="font-family:${DISPLAY};font-size:44px;font-weight:900;color:${C.bone};text-transform:uppercase;line-height:1.2;margin:6px 0 18px;">${esc(booking.movie?.title)}</div>
  </td></tr>

  <!-- Ticket -->
  <tr><td style="background:${C.bone};border-radius:4px;padding:20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${fact('Date', esc(asDate(booking.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })))}
        ${fact('Time', esc(clock(booking.startTime)))}
        ${fact('Screen', esc(String(booking.screen?.name || '').replace(/^screen\s*/i, '') || '–'))}
      </tr>
      <tr>
        <td colspan="3" style="padding:0 0 14px;">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:1px;color:${C.inkSoft};text-transform:uppercase;">Seats</div>
          <div style="font-family:${MONO};font-size:20px;font-weight:bold;color:${C.ink};">${esc(seats.map((s) => s.seatLabel).join('  '))}</div>
        </td>
      </tr>
    </table>
    <div style="border-top:2px dashed #B9AE97;margin:4px 0 18px;"></div>
    ${qrCid ? `
    <div style="text-align:center;">
      <img src="cid:${qrCid}" width="200" height="200" alt="Ticket QR code" style="display:block;margin:0 auto;background:#FFFFFF;padding:8px;border-radius:2px;">
      <div style="font-family:${MONO};font-size:13px;color:${C.ink};margin-top:10px;letter-spacing:1px;">${esc(booking.ticket?.ticketCode)}</div>
      <div style="font-family:${BODY};font-size:13px;color:${C.inkSoft};margin-top:6px;">Show this at the door. It's also in the app under Account.</div>
    </div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="font-family:${MONO};font-size:11px;letter-spacing:1px;color:${C.inkSoft};">BOOKING REF</td>
        <td align="right" style="font-family:${MONO};font-size:15px;font-weight:bold;color:${C.ink};">${esc(booking.bookingRef)}</td>
      </tr>
    </table>
  </td></tr>

  ${booking.snackCodes && booking.snackCodes.length ? `
  <tr><td style="padding:18px 4px 0;">
    <div style="border-left:3px solid ${C.bone};padding:4px 0 4px 12px;font-family:${BODY};font-size:15px;color:${C.bone};">
      Snacks: collect at the kiosk with code <span style="font-family:${MONO};font-weight:bold;">${booking.snackCodes.map(esc).join(', ')}</span>
    </div>
  </td></tr>` : ''}

  <!-- Receipt -->
  <tr><td style="padding:28px 4px 0;">
    <div style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${C.bone};text-transform:uppercase;border-top:1.5px solid ${C.bone};padding-top:12px;">Receipt</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${seatRows}
      ${discountRow}
      ${snackRows}
      <tr>
        <td style="padding:14px 0 6px;font-family:${BODY};font-size:16px;font-weight:bold;color:${C.bone};">Total paid</td>
        <td align="right" style="padding:14px 0 6px;font-family:${MONO};font-size:22px;font-weight:bold;color:${C.bone};">${esc(money(booking.totalAmount))}</td>
      </tr>
    </table>
    <div style="font-family:${MONO};font-size:12px;color:${C.dust};line-height:1.7;">
      ${esc(METHOD[booking.payment?.method] || titleCase(booking.payment?.method || ''))}${booking.payment?.reference ? ` · ${esc(booking.payment.reference)}` : ''}${booking.payment?.paidAt ? ` · ${esc(asDate(booking.payment.paidAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}` : ''}
    </div>
    ${simulated ? `<div style="font-family:${BODY};font-size:12px;color:${C.dust};margin-top:6px;">Test mode: this payment was simulated and no money was taken.</div>` : ''}
  </td></tr>

  <!-- Venue -->
  <tr><td style="padding:28px 4px 0;">
    <div style="font-family:${BODY};font-size:14px;color:${C.bone};font-weight:bold;">${esc(booking.cinema?.name)}</div>
    ${where ? `<div style="font-family:${BODY};font-size:14px;color:${C.dust};">${esc(where)}</div>` : ''}
    <div style="font-family:${BODY};font-size:14px;color:${C.dust};">
      ${booking.cinema?.phoneNumber ? `${esc(booking.cinema.phoneNumber)}` : ''}${booking.cinema?.phoneNumber && booking.cinema?.email ? ' · ' : ''}${booking.cinema?.email ? `<a href="mailto:${esc(booking.cinema.email)}" style="color:${C.dust};">${esc(booking.cinema.email)}</a>` : ''}
    </div>
    <div style="font-family:${BODY};font-size:13px;color:${C.dust};margin-top:12px;">Please arrive 15 minutes before the film starts.</div>
  </td></tr>

  <tr><td style="padding:28px 4px 8px;">
    <div style="border-top:1px solid ${C.rule};padding-top:14px;font-family:${BODY};font-size:12px;color:${C.dust};">
      You're getting this because a booking was made with this email address at Savannah Cinemas.
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const text = [
        `SAVANNAH CINEMAS`,
        ``,
        `You're booked, ${firstName}.`,
        ``,
        `${booking.movie?.title}`,
        `${longDate(booking.startTime)} at ${clock(booking.startTime)}`,
        `${booking.screen?.name} · ${booking.cinema?.name}`,
        `Seats: ${seats.map((s) => s.seatLabel).join(', ')}`,
        `Booking ref: ${booking.bookingRef}`,
        booking.ticket?.ticketCode ? `Ticket code: ${booking.ticket.ticketCode}` : null,
        booking.snackCodes && booking.snackCodes.length ? `Snack collection code: ${booking.snackCodes.join(', ')}` : null,
        ``,
        `RECEIPT`,
        ...seats.map((s) => `  Seat ${s.seatLabel} (${titleCase(s.seatType || 'standard')})  ${money(s.ticketPrice)}`),
        Number(booking.discountAmount) > 0 ? `  Promo discount  -${money(booking.discountAmount)}` : null,
        Number(booking.pointsDiscount) > 0 ? `  Savannah Rewards (${booking.pointsRedeemed} points)  -${money(booking.pointsDiscount)}` : null,
        ...snacks.map((s) => `  ${s.name} x ${s.quantity}  ${money(s.lineTotal)}`),
        `  Total paid  ${money(booking.totalAmount)}`,
        `  ${METHOD[booking.payment?.method] || booking.payment?.method || ''}${booking.payment?.reference ? ` · ${booking.payment.reference}` : ''}`,
        simulated ? `  (Test mode: payment simulated, no money taken.)` : null,
        ``,
        `Show the QR code in the app (Account) at the door. Please arrive 15 minutes early.`,
        [booking.cinema?.name, where, booking.cinema?.phoneNumber].filter(Boolean).join(' · ')
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

    const { html, text } = buildEmail({ customerName, booking, qrCid });

    try {

        const info = await transport.sendMail({
            from: fromAddress(),
            to: recipient,
            subject: `Your tickets: ${booking.movie?.title} · ${asDate(booking.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${clock(booking.startTime)} · ${booking.bookingRef}`,
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
