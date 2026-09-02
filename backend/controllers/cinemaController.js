const pool = require('../config/database');

// ============================================================
// GET ALL CINEMAS
// ============================================================

async function getCinemas(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                cinema_id,
                cinema_name,
                description,
                address,
                city,
                region,
                phone_number,
                email,
                is_active,
                created_at,
                updated_at
            FROM cinemas
            WHERE is_active = 'Y'
            ORDER BY cinema_name
        `);

        const cinemas = result.rows.map(row => ({
            cinemaId: row.cinema_id,
            cinemaName: row.cinema_name,
            description: row.description,
            address: row.address,
            city: row.city,
            region: row.region,
            phoneNumber: row.phone_number,
            email: row.email,
            isActive: row.is_active === 'Y',
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            success: true,
            count: cinemas.length,
            cinemas
        });

    } catch (error) {
        console.error('❌ Get cinemas error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching cinemas',
            error: error.message
        });
    }
}


// ============================================================
// GET SINGLE CINEMA
// ============================================================

async function getCinemaById(req, res) {
    try {
        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        const result = await pool.query(
            `
            SELECT
                cinema_id,
                cinema_name,
                description,
                address,
                city,
                region,
                phone_number,
                email,
                is_active,
                created_at,
                updated_at
            FROM cinemas
            WHERE cinema_id = $1
            `,
            [cinemaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cinema not found'
            });
        }

        const row = result.rows[0];

        res.json({
            success: true,
            cinema: {
                cinemaId: row.cinema_id,
                cinemaName: row.cinema_name,
                description: row.description,
                address: row.address,
                city: row.city,
                region: row.region,
                phoneNumber: row.phone_number,
                email: row.email,
                isActive: row.is_active === 'Y',
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Get cinema error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching cinema',
            error: error.message
        });
    }
}


// ============================================================
// GET SCREENS FOR CINEMA
// ============================================================

async function getCinemaScreens(req, res) {
    try {
        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        const result = await pool.query(
            `
            SELECT
                screen_id,
                cinema_id,
                screen_name,
                screen_number,
                capacity,
                screen_type,
                sound_system,
                is_active,
                created_at,
                updated_at
            FROM screens
            WHERE cinema_id = $1
              AND is_active = 'Y'
            ORDER BY screen_number
            `,
            [cinemaId]
        );

        const screens = result.rows.map(row => ({
            screenId: row.screen_id,
            cinemaId: row.cinema_id,
            screenName: row.screen_name,
            screenNumber: row.screen_number,
            capacity: row.capacity,
            screenType: row.screen_type,
            soundSystem: row.sound_system,
            isActive: row.is_active === 'Y',
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            success: true,
            cinemaId,
            count: screens.length,
            screens
        });

    } catch (error) {
        console.error('❌ Get cinema screens error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching cinema screens',
            error: error.message
        });
    }
}


// ============================================================
// GET SINGLE SCREEN
// ============================================================

async function getScreenById(req, res) {
    try {
        const cinemaId = Number(req.params.cinemaId);
        const screenId = Number(req.params.screenId);

        if (
            !Number.isInteger(cinemaId) ||
            !Number.isInteger(screenId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema or screen ID'
            });
        }

        const result = await pool.query(
            `
            SELECT
                screen_id,
                cinema_id,
                screen_name,
                screen_number,
                capacity,
                screen_type,
                sound_system,
                is_active,
                created_at,
                updated_at
            FROM screens
            WHERE screen_id = $1
              AND cinema_id = $2
            `,
            [screenId, cinemaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Screen not found for this cinema'
            });
        }

        const row = result.rows[0];

        res.json({
            success: true,
            screen: {
                screenId: row.screen_id,
                cinemaId: row.cinema_id,
                screenName: row.screen_name,
                screenNumber: row.screen_number,
                capacity: row.capacity,
                screenType: row.screen_type,
                soundSystem: row.sound_system,
                isActive: row.is_active === 'Y',
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Get screen error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching screen',
            error: error.message
        });
    }
}


// ============================================================
// GET SEATS FOR SCREEN
// ============================================================

async function getScreenSeats(req, res) {
    try {
        const cinemaId = Number(req.params.cinemaId);
        const screenId = Number(req.params.screenId);

        if (
            !Number.isInteger(cinemaId) ||
            !Number.isInteger(screenId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema or screen ID'
            });
        }

        // ----------------------------------------------------
        // VERIFY SCREEN BELONGS TO CINEMA
        // ----------------------------------------------------

        const screenResult = await pool.query(
            `
            SELECT
                screen_id,
                cinema_id,
                screen_name,
                capacity
            FROM screens
            WHERE screen_id = $1
              AND cinema_id = $2
            `,
            [screenId, cinemaId]
        );

        if (screenResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Screen not found for this cinema'
            });
        }

        // ----------------------------------------------------
        // GET SEATS
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                seat_id,
                screen_id,
                row_label,
                seat_number,
                seat_label,
                seat_type,
                is_active,
                created_at
            FROM seats
            WHERE screen_id = $1
              AND is_active = 'Y'
            ORDER BY
                row_label,
                seat_number
            `,
            [screenId]
        );

        const seats = result.rows.map(row => ({
            seatId: row.seat_id,
            screenId: row.screen_id,
            rowLabel: row.row_label,
            seatNumber: row.seat_number,
            seatLabel: row.seat_label,
            seatType: row.seat_type,
            isActive: row.is_active === 'Y',
            createdAt: row.created_at
        }));

        res.json({
            success: true,
            cinemaId,
            screenId,
            count: seats.length,
            seats
        });

    } catch (error) {
        console.error('❌ Get screen seats error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching seats',
            error: error.message
        });
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getCinemas,
    getCinemaById,
    getCinemaScreens,
    getScreenById,
    getScreenSeats
};