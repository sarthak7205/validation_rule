document
.getElementById('loginBtn')
.addEventListener('click', () => {

    window.location.href =
        'http://localhost:5000/login';
});

const message = document.getElementById('message');
const ruleCount = document.getElementById('ruleCount');
const rulesBody = document.getElementById('rulesBody');
const connectionBadge = document.getElementById('connectionBadge');

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

async function loadRules() {

    setLoading(true);
    showMessage('Loading validation rules...', 'info');

    try {

        const response = await fetch(
            'http://localhost:5000/rules'
        );

        const data = await response.json();

        if (!response.ok) {
            setConnected(false);
            showMessage(data.message || 'Error fetching rules', 'error');
            return;
        }

        setConnected(true);
        renderRules(data);
        showMessage('Validation rules loaded successfully.', 'success');

    } catch (err) {
        showMessage('Could not reach the server. Make sure Node is running on port 5000.', 'error');
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

            `http://localhost:5000/toggle/${id}`,

            {
                method: 'POST',

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

function showMessage(text, type) {

    message.textContent = text;
    message.className = `message message-${type}`;
}

function setConnected(isConnected) {

    connectionBadge.textContent = isConnected ? 'Connected' : 'Not connected';
    connectionBadge.className = `status-badge ${isConnected ? 'status-connected' : 'status-neutral'}`;
}

function setLoading(isLoading) {

    document.getElementById('fetchBtn').disabled = isLoading;
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
