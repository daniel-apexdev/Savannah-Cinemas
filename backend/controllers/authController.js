const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;


// ============================================================
// REGISTER
// ============================================================
const register = async (req, res) => {
    const {
        forenames,
        surname,
        email,
        password,
        phoneNumber
    } = req.body;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------
    if (!forenames || !surname || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Forenames, surname, email and password are required'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters long'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ----------------------------------------------------
        // Check whether user already exists
        // ----------------------------------------------------
        const existingUser = await client.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            client.release();

            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        // ----------------------------------------------------
        // Hash password
        // ----------------------------------------------------
        const passwordHash = await bcrypt.hash(password, 10);

        // ----------------------------------------------------
        // Create user
        // ----------------------------------------------------
        const userResult = await client.query(
            `INSERT INTO users (
                email,
                password_hash,
                forenames,
                surname,
                phone_number,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                'Y',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING user_id`,
            [
                normalizedEmail,
                passwordHash,
                forenames.trim(),
                surname.trim(),
                phoneNumber || null
            ]
        );

        const userId = userResult.rows[0].user_id;

        // ----------------------------------------------------
        // Create notification preferences
        // ----------------------------------------------------
        await client.query(
            `INSERT INTO user_notification_preferences (
                user_id,
                booking_reminders,
                booking_confirmations,
                movie_releases,
                promotions,
                new_movies,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                'Y',
                'Y',
                'Y',
                'Y',
                'Y',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )`,
            [userId]
        );

        // ----------------------------------------------------
        // Create customer profile
        // ----------------------------------------------------
        await client.query(
            `INSERT INTO customer_profiles (
                user_id,
                current_loyalty_points,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                0,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )`,
            [userId]
        );

        // ----------------------------------------------------
        // Get CUSTOMER role
        // ----------------------------------------------------
        const roleResult = await client.query(
            `SELECT role_id
             FROM user_roles
             WHERE role_name = $1`,
            ['CUSTOMER']
        );

        if (roleResult.rows.length === 0) {
            throw new Error('CUSTOMER role does not exist');
        }

        const roleId = roleResult.rows[0].role_id;

        // ----------------------------------------------------
        // Assign CUSTOMER role
        // ----------------------------------------------------
        await client.query(
            `INSERT INTO user_role_assignments (
                user_id,
                role_id,
                assigned_at
            )
            VALUES (
                $1,
                $2,
                CURRENT_TIMESTAMP
            )`,
            [userId, roleId]
        );

        // ----------------------------------------------------
        // Commit transaction
        // ----------------------------------------------------
        await client.query('COMMIT');

        // ----------------------------------------------------
        // Generate JWT
        // ----------------------------------------------------
        const token = jwt.sign(
            {
                userId: userId,
                email: normalizedEmail,
                role: 'CUSTOMER'
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                userId,
                email: normalizedEmail,
                forenames: forenames.trim(),
                surname: surname.trim(),
                phoneNumber: phoneNumber || null,
                role: 'CUSTOMER'
            }
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Registration failed'
        });

    } finally {
        client.release();
    }
};


// ============================================================
// LOGIN
// ============================================================
const login = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {

        // ----------------------------------------------------
        // Find user
        // ----------------------------------------------------
        const result = await pool.query(
            `SELECT
                user_id,
                email,
                password_hash,
                forenames,
                surname,
                phone_number,
                is_active
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // ----------------------------------------------------
        // Check account status
        // ----------------------------------------------------
        if (user.is_active !== 'Y') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive'
            });
        }

        // ----------------------------------------------------
        // Compare password
        // ----------------------------------------------------
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // ----------------------------------------------------
        // Get user's role
        // ----------------------------------------------------
        const roleResult = await pool.query(
            `SELECT
                ur.role_id,
                ur.role_name
             FROM user_roles ur
             INNER JOIN user_role_assignments ura
                 ON ur.role_id = ura.role_id
             WHERE ura.user_id = $1
             ORDER BY ur.role_id
             LIMIT 1`,
            [user.user_id]
        );

        const role = roleResult.rows.length > 0
            ? roleResult.rows[0].role_name
            : 'CUSTOMER';

        // ----------------------------------------------------
        // Generate JWT
        // ----------------------------------------------------
        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                userId: user.user_id,
                email: user.email,
                forenames: user.forenames,
                surname: user.surname,
                phoneNumber: user.phone_number,
                role
            }
        });

    } catch (error) {

        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};


// ============================================================
// GET CURRENT USER
// ============================================================
const getCurrentUser = async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT
                u.user_id,
                u.email,
                u.forenames,
                u.surname,
                u.phone_number,
                u.is_active,

                cp.customer_id,
                cp.date_of_birth,
                cp.gender,
                cp.current_loyalty_points

             FROM users u

             LEFT JOIN customer_profiles cp
                 ON u.user_id = cp.user_id

             WHERE u.user_id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        // ----------------------------------------------------
        // Check account status
        // ----------------------------------------------------
        if (user.is_active !== 'Y') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive'
            });
        }

        // ----------------------------------------------------
        // Get role
        // ----------------------------------------------------
        const roleResult = await pool.query(
            `SELECT
                ur.role_id,
                ur.role_name
             FROM user_roles ur
             INNER JOIN user_role_assignments ura
                 ON ur.role_id = ura.role_id
             WHERE ura.user_id = $1
             ORDER BY ur.role_id
             LIMIT 1`,
            [user.user_id]
        );

        const role = roleResult.rows.length > 0
            ? roleResult.rows[0].role_name
            : 'CUSTOMER';

        return res.status(200).json({
            success: true,
            user: {
                userId: user.user_id,
                email: user.email,
                forenames: user.forenames,
                surname: user.surname,
                phoneNumber: user.phone_number,
                role,
                customerProfile: {
                    customerId: user.customer_id,
                    dateOfBirth: user.date_of_birth,
                    gender: user.gender,
                    currentLoyaltyPoints: user.current_loyalty_points
                }
            }
        });

    } catch (error) {

        console.error('Get current user error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve current user'
        });
    }
};


module.exports = {
    register,
    login,
    getCurrentUser
};