const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const GMAIL_USER =
    process.env.GMAIL_USER;

const GMAIL_APP_PASSWORD =
    process.env.GMAIL_APP_PASSWORD;


// ============================================================
// EMAIL TRANSPORTER
// ============================================================

let transporter = null;

if (
    GMAIL_USER &&
    GMAIL_APP_PASSWORD
) {

    transporter =
        nodemailer.createTransport({

            host:
                'smtp.gmail.com',

            port:
                465,

            secure:
                true,

            auth: {

                user:
                    GMAIL_USER,

                pass:
                    GMAIL_APP_PASSWORD

            }

        });

}


// ============================================================
// SEND BOOKING CONFIRMATION
// ============================================================

async function sendBookingConfirmation({
    to,
    customerName,
    booking
}) {

    // --------------------------------------------------------
    // Check email configuration
    // --------------------------------------------------------

    if (!transporter) {

        console.warn(
            '⚠️ Email service is not configured'
        );

        return {

            sent: false,

            reason:
                'Email service not configured'

        };

    }


    // --------------------------------------------------------
    // Validate booking data
    // --------------------------------------------------------

    if (!booking) {

        console.error(
            '❌ Booking data is missing'
        );

        return {

            sent: false,

            reason:
                'Booking data is missing'

        };

    }


    // --------------------------------------------------------
    // Seats
    // --------------------------------------------------------

    const seats =
        Array.isArray(booking.seats)
            ? booking.seats
            : [];

    const seatList =
        seats.length > 0

            ? seats
                .map(
                    seat =>
                        seat.seatLabel
                )
                .join(', ')

            : 'Seat information unavailable';


    // --------------------------------------------------------
    // Show date
    // --------------------------------------------------------

    const showDate =
        booking.showDate

            ? new Date(
                booking.showDate
            ).toLocaleDateString(
                'en-GH',
                {
                    weekday:
                        'long',

                    year:
                        'numeric',

                    month:
                        'long',

                    day:
                        'numeric'
                }
            )

            : 'Date unavailable';


    // --------------------------------------------------------
    // Show time
    // --------------------------------------------------------

    const showTime =
        booking.startTime

            ? new Date(
                booking.startTime
            ).toLocaleTimeString(
                'en-GH',
                {
                    hour:
                        '2-digit',

                    minute:
                        '2-digit'
                }
            )

            : 'Time unavailable';


    // --------------------------------------------------------
    // Generate QR code
    // --------------------------------------------------------

    let qrCodeImage = null;

    if (
        booking.ticket &&
        booking.ticket.qrCodeData
    ) {

        try {

            qrCodeImage =
                await QRCode.toDataURL(
                    booking.ticket.qrCodeData,
                    {
                        width:
                            300,

                        margin:
                            2
                    }
                );

        } catch (qrError) {

            console.error(
                '❌ QR code generation failed:',
                qrError.message
            );

        }

    }


    // --------------------------------------------------------
    // Ticket information
    // --------------------------------------------------------

    const ticketCode =
        booking.ticket &&
        booking.ticket.ticketCode

            ? booking.ticket.ticketCode

            : 'Ticket information unavailable';


    // --------------------------------------------------------
    // Build QR section
    // --------------------------------------------------------

    const qrSection =
        qrCodeImage

            ? `

                <div style="
                    text-align: center;
                    margin: 30px 0;
                    padding: 25px;
                    background: #252532;
                    border-radius: 12px;
                ">

                    <h2 style="
                        color: #E8B34C;
                        margin-top: 0;
                    ">
                        Your Digital Ticket
                    </h2>

                    <p style="
                        color: #B9B6AC;
                    ">
                        Present this QR code when you
                        arrive at Savannah Cinemas.
                    </p>

                    <img
                        src="${qrCodeImage}"
                        alt="Savannah Cinemas Ticket QR Code"
                        width="300"
                        height="300"
                        style="
                            display: block;
                            margin: 20px auto;
                            background: #FFFFFF;
                            padding: 10px;
                            border-radius: 8px;
                        "
                    />

                    <p style="
                        margin-bottom: 0;
                    ">

                        <strong>
                            Ticket Code:
                        </strong>

                        <br>

                        <span style="
                            color: #E8B34C;
                            letter-spacing: 1px;
                            font-weight: bold;
                        ">
                            ${ticketCode}
                        </span>

                    </p>

                </div>

            `

            : `

                <div style="
                    background: #252532;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 25px 0;
                    text-align: center;
                ">

                    <h3 style="
                        color: #E8B34C;
                    ">
                        Digital Ticket
                    </h3>

                    <p style="
                        color: #B9B6AC;
                    ">
                        Your digital ticket has been created.
                    </p>

                    <p>
                        <strong>
                            Ticket Code:
                        </strong>

                        <br>

                        ${ticketCode}

                    </p>

                </div>

            `;


    // ========================================================
    // EMAIL
    // ========================================================

    const mailOptions = {

        from:
            `"Savannah Cinemas" <${GMAIL_USER}>`,

        to,

        subject:
            `Booking Confirmation — ${booking.bookingRef}`,

        html: `

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width,
                         initial-scale=1.0"
            >

            <title>
                Savannah Cinemas Booking
            </title>

        </head>


        <body style="
            margin: 0;
            padding: 0;
            background: #11111A;
            font-family: Arial, sans-serif;
        ">


            <div style="
                max-width: 600px;
                margin: 30px auto;
                background: #1D1D28;
                color: #F2EFE9;
                border-radius: 16px;
                overflow: hidden;
            ">


                <!-- =========================================
                     HEADER
                ========================================== -->

                <div style="
                    padding: 30px;
                    text-align: center;
                    background: #171720;
                ">

                    <h1 style="
                        margin: 0;
                        color: #E8B34C;
                        letter-spacing: 2px;
                    ">
                        SAVANNAH CINEMAS
                    </h1>

                    <p style="
                        color: #B9B6AC;
                        margin-bottom: 0;
                    ">
                        Your movie experience starts here.
                    </p>

                </div>


                <!-- =========================================
                     CONFIRMATION
                ========================================== -->

                <div style="
                    padding: 30px;
                ">


                    <h2 style="
                        color: #E8B34C;
                    ">
                        Booking Confirmed 🎬
                    </h2>


                    <p>

                        Hello

                        <strong>
                            ${customerName || 'Valued Customer'}
                        </strong>,

                    </p>


                    <p>
                        Your booking has been successfully
                        confirmed. Your digital ticket is
                        included below.
                    </p>


                    <!-- =====================================
                         BOOKING REFERENCE
                    ====================================== -->

                    <div style="
                        background: #252532;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        margin: 25px 0;
                    ">

                        <p style="
                            margin: 0;
                            color: #B9B6AC;
                            font-size: 13px;
                        ">
                            BOOKING REFERENCE
                        </p>


                        <h2 style="
                            margin: 8px 0 0;
                            color: #E8B34C;
                            letter-spacing: 2px;
                        ">
                            ${booking.bookingRef}
                        </h2>

                    </div>


                    <!-- =====================================
                         MOVIE
                    ====================================== -->

                    <h3 style="
                        color: #E8B34C;
                    ">
                        ${booking.movie.title}
                    </h3>


                    <p>

                        <strong>
                            Cinema:
                        </strong>

                        ${booking.cinema.name}

                    </p>


                    <p>

                        <strong>
                            Screen:
                        </strong>

                        ${booking.screen.name}

                    </p>


                    <p>

                        <strong>
                            Date:
                        </strong>

                        ${showDate}

                    </p>


                    <p>

                        <strong>
                            Showtime:
                        </strong>

                        ${showTime}

                    </p>


                    <p>

                        <strong>
                            Seats:
                        </strong>

                        ${seatList}

                    </p>


                    <!-- =====================================
                         SEPARATOR
                    ====================================== -->

                    <hr style="
                        border: 0;
                        border-top: 1px solid #343443;
                        margin: 25px 0;
                    ">


                    <!-- =====================================
                         PAYMENT SUMMARY
                    ====================================== -->

                    <table style="
                        width: 100%;
                        border-collapse: collapse;
                    ">


                        <tr>

                            <td style="
                                padding: 8px 0;
                                color: #B9B6AC;
                            ">
                                Tickets
                            </td>


                            <td style="
                                padding: 8px 0;
                                text-align: right;
                            ">
                                ${booking.ticketQuantity}
                            </td>

                        </tr>


                        <tr>

                            <td style="
                                padding: 8px 0;
                                color: #B9B6AC;
                            ">
                                Ticket Price
                            </td>


                            <td style="
                                padding: 8px 0;
                                text-align: right;
                            ">

                                GH₵ ${Number(
                                    booking.ticketPrice
                                ).toFixed(2)}

                            </td>

                        </tr>


                        <tr>

                            <td style="
                                padding: 15px 0;
                                font-weight: bold;
                                color: #E8B34C;
                            ">
                                Total
                            </td>


                            <td style="
                                padding: 15px 0;
                                text-align: right;
                                font-weight: bold;
                                color: #E8B34C;
                            ">

                                GH₵ ${Number(
                                    booking.totalAmount
                                ).toFixed(2)}

                            </td>

                        </tr>


                    </table>


                    <!-- =====================================
                         DIGITAL TICKET
                    ====================================== -->

                    ${qrSection}


                    <!-- =====================================
                         ARRIVAL INFORMATION
                    ====================================== -->

                    <div style="
                        background: #252532;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 20px;
                    ">

                        <p style="
                            margin: 0;
                            color: #B9B6AC;
                            font-size: 13px;
                        ">

                            Please keep your booking reference
                            and digital ticket available when
                            you arrive at Savannah Cinemas.

                        </p>

                    </div>


                </div>


                <!-- =========================================
                     FOOTER
                ========================================== -->

                <div style="
                    padding: 20px 30px;
                    text-align: center;
                    background: #171720;
                ">

                    <p style="
                        color: #B9B6AC;
                        font-size: 13px;
                        margin: 0;
                    ">

                        Thank you for choosing
                        Savannah Cinemas.

                    </p>

                </div>


            </div>


        </body>

        </html>

        `

    };


    // ========================================================
    // SEND EMAIL
    // ========================================================

    try {

        const info =
            await transporter.sendMail(
                mailOptions
            );


        console.log(
            `✅ Booking email sent: ${info.messageId}`
        );


        return {

            sent:
                true,

            messageId:
                info.messageId

        };

    } catch (error) {

        console.error(
            '❌ Booking email failed:',
            error.message
        );


        return {

            sent:
                false,

            reason:
                error.message

        };

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    sendBookingConfirmation
};

