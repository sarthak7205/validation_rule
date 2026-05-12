const express = require('express');
const cors = require('cors');
const jsforce = require('jsforce');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const oauth2 = new jsforce.OAuth2({
    loginUrl: process.env.LOGIN_URL,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI
});

const sessions = new Map();
const port = process.env.PORT || 5000;

function getSessionId(req) {

    const cookie = req.headers.cookie || '';
    const match = cookie.match(/(?:^|;\s*)sf_session=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;
}

function getCookieOptions(req) {

    const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';

    return [
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        isSecure ? 'Secure' : ''
    ].filter(Boolean).join('; ');
}

function setSessionCookie(req, res, sessionId) {

    res.setHeader(
        'Set-Cookie',
        `sf_session=${encodeURIComponent(sessionId)}; ${getCookieOptions(req)}`
    );
}

function clearSessionCookie(req, res) {

    res.setHeader(
        'Set-Cookie',
        `sf_session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${getCookieOptions(req)}`
    );
}

function getConnection(req) {

    const sessionId = getSessionId(req);
    const session = sessionId ? sessions.get(sessionId) : null;

    return session ? session.conn : null;
}

function getAppUrl(req) {

    return `${req.protocol}://${req.get('host')}`;
}

app.get('/login', (req, res) => {

    const sessionId = crypto.randomUUID();
    setSessionCookie(req, res, sessionId);

    const authUrl = oauth2.getAuthorizationUrl({
        scope: 'api refresh_token',
        state: sessionId,
        prompt: 'login'
    });

    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {

    const conn = new jsforce.Connection({ oauth2 });

    const code = req.query.code;
    const sessionId = req.query.state;

    try {

        if (!sessionId || sessionId !== getSessionId(req)) {
            throw new Error('Invalid OAuth session state');
        }

        await conn.authorize(code);
        sessions.set(sessionId, {
            conn,
            createdAt: Date.now()
        });

        res.redirect('/?connected=true');

    } catch (err) {

        console.log(err);

        res.redirect('/?connected=false');
    }
});
app.get('/status', (req, res) => {

    res.setHeader('Cache-Control', 'no-store');

    res.json({
        connected: Boolean(getConnection(req))
    });
});
app.post('/logout', (req, res) => {

    const sessionId = getSessionId(req);

    if (sessionId) {
        sessions.delete(sessionId);
    }

    clearSessionCookie(req, res);
    res.setHeader('Cache-Control', 'no-store');

    res.json({
        message: 'Logged out successfully',
        logoutUrl: `${process.env.LOGIN_URL}/secur/logout.jsp?retUrl=${encodeURIComponent(getAppUrl(req))}`
    });
});
app.get('/rules', async (req, res) => {

    try {

        res.setHeader('Cache-Control', 'no-store');

        const salesforceConnection = getConnection(req);

        if (!salesforceConnection) {
            return res.status(401).json({
                message: 'Please login with Salesforce first'
            });
        }

        const result = await salesforceConnection.tooling.query(
            "SELECT Id, ValidationName, Active, ErrorMessage, EntityDefinitionId FROM ValidationRule"
        );

        res.json(result.records);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: 'Error fetching rules'
        });
    }
});

app.post('/toggle/:id', async (req, res) => {

    try {

        const salesforceConnection = getConnection(req);

        if (!salesforceConnection) {
            return res.status(401).json({
                message: 'Please login with Salesforce first'
            });
        }

        const ruleId = req.params.id;

        const active = req.body.active;

        // Get existing validation rule

        const rule =
            await salesforceConnection.tooling
            .sobject('ValidationRule')
            .retrieve(ruleId);

        const metadata = rule.Metadata || {
            active: rule.Active,
            errorConditionFormula: rule.ValidationFormula,
            errorMessage: rule.ErrorMessage
        };

        if (!metadata.errorConditionFormula) {
            return res.status(400).json({
                message: 'Could not find the validation rule formula'
            });
        }

        // Update validation rule metadata

        await salesforceConnection.tooling
            .sobject('ValidationRule')
            .update({

                Id: ruleId,

                Metadata: {
                    ...metadata,
                    active
                }
            });

        res.json({
            message:
                'Validation Rule Updated Successfully'
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message:
                'Error Updating Validation Rule'
        });
    }
});
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
