document
.getElementById('loginBtn')
.addEventListener('click', () => {

    window.location.href =
        '/login';
});

const message = document.getElementById('message');
const ruleCount = document.getElementById('ruleCount');
const rulesBody = document.getElementById('rulesBody');
const connectionBadge = document.getElementById('connectionBadge');
const loginBtn = document.getElementById('loginBtn');
const fetchBtn = document.getElementById('fetchBtn');
const logoutBtn = document.getElementById('logoutBtn');
let authRequestVersion = 0;

const params = new URLSearchParams(window.location.search);

if (params.get('connected') === 'true') {
    setConnected(true);
    showMessage('Connected to Salesforce. Loading validation rules...', 'success');
    loadRules();
}

if (params.get('connected') === 'false') {
    showMessage('Salesforce login failed. Check the server console for details.', 'error');
}

document
.getElementById('fetchBtn')
.addEventListener('click', loadRules);

logoutBtn.addEventListener('click', logout);

checkStatus();

async function loadRules() {

    const requestVersion = authRequestVersion;

    setLoading(true);
    showMessage('Loading validation rules...', 'info');

    try {

        const response = await fetch(
            '/rules',
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (requestVersion !== authRequestVersion) {
            return;
        }

        if (!response.ok) {
            setConnected(false);
            showMessage(data.message || 'Error fetching rules', 'error');
            return;
        }

        setConnected(true);
        renderRules(data);
        showMessage('Validation rules loaded successfully.', 'success');

    } catch (err) {
        showMessage('Could not reach the server. Please try again in a moment.', 'error');
    } finally {
        setLoading(false);
    }
}

function renderRules(rules) {

    ruleCount.textContent = `${rules.length} rule${rules.length === 1 ? '' : 's'} loaded`;
    rulesBody.innerHTML = '';

    if (rules.length === 0) {
        rulesBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">No validation rules found.</td>
            </tr>
        `;
        return;
    }

    rules.forEach(rule => {

       const row = `
    <tr>
        <td>
            <div class="rule-name">${escapeHtml(rule.ValidationName)}</div>
        </td>

        <td>
            <span class="pill ${rule.Active ? 'pill-active' : 'pill-inactive'}">
                ${rule.Active ? 'Active' : 'Inactive'}
            </span>
        </td>

        <td>
            <button class="btn btn-small ${rule.Active ? 'btn-danger' : 'btn-success'}" onclick="toggleRule(
                '${rule.Id}',
                ${rule.Active}
            )">

                ${rule.Active ? 'Disable' : 'Enable'}

            </button>
        </td>
    </tr>
`;

        rulesBody.innerHTML += row;
    });
}
async function toggleRule(id, active) {

    showMessage(`${active ? 'Disabling' : 'Enabling'} validation rule...`, 'info');

    try {

        const response = await fetch(

            `/toggle/${id}`,

            {
                method: 'POST',
                credentials: 'same-origin',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    active: !active
                })
            }
        );

        const result = await response.json();

        showMessage(result.message, response.ok ? 'success' : 'error');

        if (response.ok) {
            loadRules();
        }

    } catch (err) {
        showMessage('Could not update the rule. Check the server terminal for details.', 'error');
    }
}

async function checkStatus() {

    try {

        const response = await fetch('/status', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await response.json();

        setConnected(data.connected);

        if (!data.connected && !params.get('connected')) {
            clearRules();
        }

    } catch (err) {
        setConnected(false);
    }
}

async function logout() {

    try {

        authRequestVersion += 1;

        const response = await fetch('/logout', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await response.json();

        window.history.replaceState({}, '', '/');
        setConnected(false);
        clearRules();
        showMessage(data.message || 'Logged out successfully', response.ok ? 'success' : 'error');

        if (response.ok && data.logoutUrl) {
            window.location.href = data.logoutUrl;
        }

    } catch (err) {
        showMessage('Could not logout. Please try again.', 'error');
    }
}

function clearRules() {

    ruleCount.textContent = 'No rules loaded';
    rulesBody.innerHTML = `
        <tr>
            <td colspan="3" class="empty-state">
                Connect to Salesforce and refresh rules to begin.
            </td>
        </tr>
    `;
}

function showMessage(text, type) {

    message.textContent = text;
    message.className = `message message-${type}`;
}

function setConnected(isConnected) {

    connectionBadge.textContent = isConnected ? 'Connected' : 'Not connected';
    connectionBadge.className = `status-badge ${isConnected ? 'status-connected' : 'status-neutral'}`;
    loginBtn.hidden = isConnected;
    logoutBtn.hidden = !isConnected;
}

function setLoading(isLoading) {

    fetchBtn.disabled = isLoading;
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
