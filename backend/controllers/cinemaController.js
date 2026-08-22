const { getConnection } = require('../config/database');

// ============================================================
// GET ALL CINEMAS
// ============================================================

async function getCinemas(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(`
            SELECT
                CINEMA_ID,
                CINEMA_NAME,
                DESCRIPTION,
                ADDRESS,
                CITY,
                REGION,
                PHONE_NUMBER,
                EMAIL,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            FROM CINEMAS
            WHERE IS_ACTIVE = 'Y'
            ORDER BY CINEMA_NAME
        `);

        const cinemas = result.rows.map(row => ({
            cinemaId: row[0],
            cinemaName: row[1],
            description: row[2],
            address: row[3],
            city: row[4],
            region: row[5],
            phoneNumber: row[6],
            email: row[7],
            isActive: row[8] === 'Y',
            createdAt: row[9],
            updatedAt: row[10]
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

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing cinema connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET SINGLE CINEMA
// ============================================================

async function getCinemaById(req, res) {

    let connection;

    try {

        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                CINEMA_ID,
                CINEMA_NAME,
                DESCRIPTION,
                ADDRESS,
                CITY,
                REGION,
                PHONE_NUMBER,
                EMAIL,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            FROM CINEMAS
            WHERE CINEMA_ID = :cinemaId
            `,
            {
                cinemaId
            }
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
                cinemaId: row[0],
                cinemaName: row[1],
                description: row[2],
                address: row[3],
                city: row[4],
                region: row[5],
                phoneNumber: row[6],
                email: row[7],
                isActive: row[8] === 'Y',
                createdAt: row[9],
                updatedAt: row[10]
            }
        });

    } catch (error) {

        console.error('❌ Get cinema error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching cinema',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing cinema connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET SCREENS FOR CINEMA
// ============================================================

async function getCinemaScreens(req, res) {

    let connection;

    try {

        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                SCREEN_ID,
                CINEMA_ID,
                SCREEN_NAME,
                SCREEN_NUMBER,
                CAPACITY,
                SCREEN_TYPE,
                SOUND_SYSTEM,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            FROM SCREENS
            WHERE CINEMA_ID = :cinemaId
              AND IS_ACTIVE = 'Y'
            ORDER BY SCREEN_NUMBER
            `,
            {
                cinemaId
            }
        );

        const screens = result.rows.map(row => ({
            screenId: row[0],
            cinemaId: row[1],
            screenName: row[2],
            screenNumber: row[3],
            capacity: row[4],
            screenType: row[5],
            soundSystem: row[6],
            isActive: row[7] === 'Y',
            createdAt: row[8],
            updatedAt: row[9]
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

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing screen connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET SINGLE SCREEN
// ============================================================

async function getScreenById(req, res) {

    let connection;

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

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                SCREEN_ID,
                CINEMA_ID,
                SCREEN_NAME,
                SCREEN_NUMBER,
                CAPACITY,
                SCREEN_TYPE,
                SOUND_SYSTEM,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT
            FROM SCREENS
            WHERE SCREEN_ID = :screenId
              AND CINEMA_ID = :cinemaId
            `,
            {
                screenId,
                cinemaId
            }
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
                screenId: row[0],
                cinemaId: row[1],
                screenName: row[2],
                screenNumber: row[3],
                capacity: row[4],
                screenType: row[5],
                soundSystem: row[6],
                isActive: row[7] === 'Y',
                createdAt: row[8],
                updatedAt: row[9]
            }
        });

    } catch (error) {

        console.error('❌ Get screen error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching screen',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing screen connection:',
                    error.message
                );
            }
        }
    }
}

// ============================================================
// GET SEATS FOR SCREEN
// ============================================================

async function getScreenSeats(req, res) {

    let connection;

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

        connection = await getConnection();

        // ----------------------------------------------------
        // VERIFY SCREEN BELONGS TO CINEMA
        // ----------------------------------------------------

        const screenResult = await connection.execute(
            `
            SELECT
                SCREEN_ID,
                CINEMA_ID,
                SCREEN_NAME,
                CAPACITY
            FROM SCREENS
            WHERE SCREEN_ID = :screenId
              AND CINEMA_ID = :cinemaId
            `,
            {
                screenId,
                cinemaId
            }
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

        const result = await connection.execute(
            `
            SELECT
                SEAT_ID,
                SCREEN_ID,
                ROW_LABEL,
                SEAT_NUMBER,
                SEAT_LABEL,
                SEAT_TYPE,
                IS_ACTIVE,
                CREATED_AT
            FROM SEATS
            WHERE SCREEN_ID = :screenId
            ORDER BY
                ROW_LABEL,
                SEAT_NUMBER
            `,
            {
                screenId
            }
        );

        const seats = result.rows.map(row => ({
            seatId: row[0],
            screenId: row[1],
            rowLabel: row[2],
            seatNumber: row[3],
            seatLabel: row[4],
            seatType: row[5],
            isActive: row[6] === 'Y',
            createdAt: row[7]
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

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing seat connection:',
                    error.message
                );
            }
        }
    }
}


module.exports = {
    getCinemas,
    getCinemaById,
    getCinemaScreens,
    getScreenById,
    getScreenSeats
};