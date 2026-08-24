const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const oracledb = require('oracledb');

const { getConnection } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// REGISTER
// ============================================================

async function register(req, res) {
    let connection;

    try {
        const {
            forenames,
            surname,
            email,
            password,
            phoneNumber
        } = req.body;

        // ----------------------------------------
        // VALIDATION
        // ----------------------------------------

        if (!forenames || !surname || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Forenames, surname, email and password are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (!JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }

        // ----------------------------------------
        // DATABASE CONNECTION
        // ----------------------------------------

        connection = await getConnection();

        // ----------------------------------------
        // CHECK EXISTING USER
        // ----------------------------------------

        const existingUser = await connection.execute(
            `
            SELECT USER_ID
            FROM USERS
            WHERE LOWER(EMAIL) = :email
            `,
            {
                email: normalizedEmail
            }
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account already exists with this email'
            });
        }

        // ----------------------------------------
        // HASH PASSWORD
        // ----------------------------------------

        const passwordHash = await bcrypt.hash(password, 12);

        // ----------------------------------------
        // CREATE USER
        // ----------------------------------------

        const userResult = await connection.execute(
            `
            INSERT INTO USERS (
                EMAIL,
                PASSWORD_HASH,
                FORENAMES,
                SURNAME,
                PHONE_NUMBER,
                IS_ACTIVE,
                CREATED_AT
            )
            VALUES (
                :email,
                :passwordHash,
                :forenames,
                :surname,
                :phoneNumber,
                'Y',
                CURRENT_TIMESTAMP
            )
            RETURNING USER_ID INTO :userId
            `,
            {
                email: normalizedEmail,
                passwordHash,
                forenames: forenames.trim(),
                surname: surname.trim(),
                phoneNumber: phoneNumber
                    ? phoneNumber.trim()
                    : null,

                userId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            }

            
        );

        const userId = userResult.outBinds.userId[0];

        await connection.execute(
            `
            INSERT INTO USER_NOTIFICATION_PREFERENCES (
                USER_ID
            )
            VALUES (
                :userId
            )
            `,
            {
                userId
            }
        );

        // ----------------------------------------
        // CREATE CUSTOMER PROFILE
        // ----------------------------------------

        await connection.execute(
            `
            INSERT INTO CUSTOMER_PROFILES (
                USER_ID,
                CURRENT_LOYALTY_POINTS,
                CREATED_AT
            )
            VALUES (
                :userId,
                0,
                CURRENT_TIMESTAMP
            )
            `,
            {
                userId
            }
        );

        // ----------------------------------------
// ASSIGN CUSTOMER ROLE
// ----------------------------------------

const customerRole = await connection.execute(
    `
    SELECT ROLE_ID
    FROM USER_ROLES
    WHERE ROLE_NAME = 'CUSTOMER'
    `
);

if (customerRole.rows.length === 0) {
    throw new Error('CUSTOMER role does not exist');
}

const customerRoleId = customerRole.rows[0][0];

await connection.execute(
    `
    INSERT INTO USER_ROLE_ASSIGNMENTS (
        USER_ID,
        ROLE_ID,
        ASSIGNED_BY
    )
    VALUES (
        :userId,
        :roleId,
        :assignedBy
    )
    `,
    {
        userId,
        roleId: customerRoleId,
        assignedBy: userId
    }
);

        // ----------------------------------------
        // COMMIT
        // ----------------------------------------

        await connection.commit();

        // ----------------------------------------
        // CREATE JWT
        // ----------------------------------------

        const token = jwt.sign(
            {
                userId,
                email: normalizedEmail
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        // ----------------------------------------
        // RESPONSE
        // ----------------------------------------

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',

            token,

            user: {
                userId,
                email: normalizedEmail,
                forenames: forenames.trim(),
                surname: surname.trim(),
                phoneNumber: phoneNumber
                    ? phoneNumber.trim()
                    : null
            }
        });

    } catch (error) {

        // Rollback if something failed
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback error:',
                    rollbackError
                );
            }
        }

        console.error('Registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    'Error closing registration connection:',
                    error
                );
            }
        }
    }
}


// ============================================================
// LOGIN
// ============================================================

async function login(req, res) {
    let connection;

    try {
        const {
            email,
            password
        } = req.body;

        // ----------------------------------------
        // VALIDATION
        // ----------------------------------------

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }

        // ----------------------------------------
        // DATABASE CONNECTION
        // ----------------------------------------

        connection = await getConnection();

        // ----------------------------------------
        // FIND USER
        // ----------------------------------------

        const result = await connection.execute(
            `
            SELECT
                USER_ID,
                EMAIL,
                PASSWORD_HASH,
                FORENAMES,
                SURNAME,
                PHONE_NUMBER,
                IS_ACTIVE,
                CREATED_AT
            FROM USERS
            WHERE LOWER(EMAIL) = :email
            `,
            {
                email: normalizedEmail
            }
        );

        // ----------------------------------------
        // USER NOT FOUND
        // ----------------------------------------

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // ----------------------------------------
        // EXTRACT USER DATA
        // ----------------------------------------

        const userId = user[0];
        const userEmail = user[1];
        const passwordHash = user[2];
        const forenames = user[3];
        const surname = user[4];
        const phoneNumber = user[5];
        const isActive = user[6];
        const createdAt = user[7];

        // ----------------------------------------
        // CHECK ACCOUNT STATUS
        // ----------------------------------------

        if (isActive !== 'Y') {
            return res.status(403).json({
                success: false,
                message: 'This account is inactive'
            });
        }

        // ----------------------------------------
        // CHECK PASSWORD
        // ----------------------------------------

        const passwordMatch = await bcrypt.compare(
            password,
            passwordHash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // ----------------------------------------
        // CREATE JWT
        // ----------------------------------------

        const token = jwt.sign(
            {
                userId,
                email: userEmail
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        // ----------------------------------------
        // RESPONSE
        // ----------------------------------------

        return res.json({
            success: true,
            message: 'Login successful',

            token,

            user: {
                userId,
                email: userEmail,
                forenames,
                surname,
                phoneNumber,
                memberSince: createdAt
            }
        });

    } catch (error) {

        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error during login'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    'Error closing login connection:',
                    error
                );
            }
        }
    }
}

// ============================================================
// GET CURRENT USER
// ============================================================

async function getCurrentUser(req, res) {
    let connection;

    try {
        const userId = req.user.userId;

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                U.USER_ID,
                U.EMAIL,
                U.FORENAMES,
                U.SURNAME,
                U.PHONE_NUMBER,
                U.IS_ACTIVE,
                U.CREATED_AT,
                CP.CUSTOMER_ID,
                CP.DATE_OF_BIRTH,
                CP.GENDER,
                CP.CURRENT_LOYALTY_POINTS
            FROM USERS U
            LEFT JOIN CUSTOMER_PROFILES CP
                ON CP.USER_ID = U.USER_ID
            WHERE U.USER_ID = :userId
            `,
            {
                userId
            }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        const {
            USER_ID,
            EMAIL,
            FORENAMES,
            SURNAME,
            PHONE_NUMBER,
            IS_ACTIVE,
            CREATED_AT,
            CUSTOMER_ID,
            DATE_OF_BIRTH,
            GENDER,
            CURRENT_LOYALTY_POINTS
        } = result.metaData.reduce((obj, column, index) => {
            obj[column.name] = user[index];
            return obj;
        }, {});

        if (IS_ACTIVE !== 'Y') {
            return res.status(403).json({
                success: false,
                message: 'This account is inactive'
            });
        }

        return res.json({
            success: true,
            user: {
                userId: USER_ID,
                email: EMAIL,
                forenames: FORENAMES,
                surname: SURNAME,
                phoneNumber: PHONE_NUMBER,
                memberSince: CREATED_AT,

                customerProfile: {
                    customerId: CUSTOMER_ID,
                    dateOfBirth: DATE_OF_BIRTH,
                    gender: GENDER,
                    loyaltyPoints: CURRENT_LOYALTY_POINTS
                }
            }
        });

    } catch (error) {

        console.error('Get current user error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error retrieving user'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    'Error closing connection:',
                    error
                );
            }
        }
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    register,
    login,
    getCurrentUser
};