const express = require('express');
const cors = require('cors');
const jsforce = require('jsforce');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const oauth2 = new jsforce.OAuth2({
    loginUrl: process.env.LOGIN_URL,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI
});

let salesforceConnection = null;

app.get('/login', (req, res) => {

    const authUrl = oauth2.getAuthorizationUrl({
        scope: 'api refresh_token'
    });

    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {

    const conn = new jsforce.Connection({ oauth2 });

    const code = req.query.code;

    try {

        await conn.authorize(code);
        salesforceConnection = conn;

        res.redirect('/?connected=true');

    } catch (err) {

        console.log(err);

        res.redirect('/?connected=false');
    }
});
app.get('/rules', async (req, res) => {

    try {

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
app.listen(5000, () => {
    console.log('Server started on port 5000');
});
