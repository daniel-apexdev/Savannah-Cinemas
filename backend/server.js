require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Change port to 500
const PORT = process.env.PORT || 500;

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    },
    requireTLS: true
});

// Test Gmail connection when server starts
transporter.verify()
    .then(() => {
        console.log('✅ Gmail SMTP connection successful');
    })
    .catch((error) => {
        console.error('❌ Gmail SMTP connection failed:', error);
    });

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Savannah Cinemas email server is running'
    });
});

app.post('/api/send-booking-email', async (req, res) => {

    try {

        const {
            to,
            customerName,
            bookingRef,
            film,
            screen,
            showtime,
            seats,
            tickets,
            ticketPrice,
            snacks,
            total,
            venue,
            timestamp
        } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Customer email is required'
            });
        }

        const mailOptions = {
            from: `"Savannah Cinemas" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: `Booking Confirmation — ${bookingRef}`,

            html: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: Oswald, sans-serif; background:#f4f4f4; padding:30px;">

                    <div style="
                        max-width:600px;
                        margin:auto;
                        background:white;
                        padding:30px;
                        border-radius:10px;
                    ">

                        <h1 style="margin-top:0;">
                            Savannah Cinemas
                        </h1>

                        <h2>Booking Confirmed 🎉</h2>

                        <p>
                            Hello ${customerName || 'Valued Customer'},
                        </p>

                        <p>
                            Your cinema booking has been confirmed.
                        </p>

                        <hr>

                        <p><strong>Booking Reference:</strong> ${bookingRef}</p>

                        <p><strong>Film:</strong> ${film}</p>

                        <p><strong>Screen:</strong> ${screen}</p>

                        <p><strong>Showtime:</strong> ${showtime}</p>

                        <p><strong>Seats:</strong> ${seats}</p>

                        <p><strong>Tickets:</strong> ${tickets}</p>

                        <p><strong>Ticket Price:</strong> $${ticketPrice}</p>

                        <p><strong>Snacks:</strong> ${snacks || 'None'}</p>

                        <p><strong>Venue:</strong> ${venue}</p>

                        <hr>

                        <h2>Total: ${total}</h2>

                        <p>
                            <strong>Booking date:</strong> ${timestamp}
                        </p>

                        <br>

                        <p>
                            Please keep this email as your booking confirmation.
                        </p>

                        <p>
                            Thank you for choosing Savannah Cinemas.
                        </p>

                    </div>

                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Booking email sent:', info.messageId);

        res.json({
            success: true,
            message: 'Booking confirmation sent successfully',
            messageId: info.messageId
        });

    } catch (error) {

        console.error('❌ Email sending error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to send booking confirmation'
        });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Email server running on port ${PORT}`);
});