// View — renders the UI based on model state.

export function renderConnectionScreen(onConnect) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="connection-screen">
            <h1>Gremlin Viewer</h1>
            <p>Connect to a Gremlin Server</p>
            <div class="connection-form">
                <input
                    type="text"
                    id="server-url"
                    placeholder="ws://localhost:8182/gremlin"
                    value="ws://localhost:8182/gremlin"
                    autofocus
                />
                <button id="connect-btn">Connect</button>
            </div>
            <div id="error-msg" class="error hidden"></div>
        </div>
    `;

    const input = document.getElementById('server-url');
    const btn = document.getElementById('connect-btn');

    btn.addEventListener('click', () => onConnect(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onConnect(input.value);
    });
}

export function renderMainScreen(labels, selectedLabel, propertyKeys, vertices, callbacks) {
    const { onSelectLabel, onReloadLabels, onReloadTable, onOpenQuery } = callbacks;
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="main-screen">
            <nav class="sidebar">
                <div class="sidebar-header">
                    <h2>Labels</h2>
                    <div class="sidebar-actions">
                        <button class="icon-btn" id="query-btn" title="Raw Gremlin Query">&#x276F;_</button>
                        <button class="icon-btn" id="reload-labels-btn" title="Reload labels">&#x21bb;</button>
                    </div>
                </div>
                <ul id="label-list">
                    ${labels.map(l => `
                        <li class="label-item ${l === selectedLabel ? 'active' : ''}" data-label="${l}">
                            ${l}
                        </li>
                    `).join('')}
                </ul>
            </nav>
            <main class="content">
                ${selectedLabel ? renderTable(selectedLabel, propertyKeys, vertices, onReloadTable) : '<p class="placeholder">Select a label to view data</p>'}
            </main>
        </div>
    `;

    document.querySelectorAll('.label-item').forEach(item => {
        item.addEventListener('click', () => onSelectLabel(item.dataset.label));
    });
    document.getElementById('reload-labels-btn').addEventListener('click', onReloadLabels);
    document.getElementById('query-btn').addEventListener('click', onOpenQuery);
    const reloadTableBtn = document.getElementById('reload-table-btn');
    if (reloadTableBtn) reloadTableBtn.addEventListener('click', onReloadTable);
}

function renderTable(label, propertyKeys, vertices, onReloadTable) {
    if (vertices.length === 0) {
        return `<h2>${label}</h2><p>No vertices found.</p>`;
    }

    return `
        <div class="content-header">
            <h2>${label} <span class="count">(${vertices.length})</span></h2>
            <button class="icon-btn" id="reload-table-btn" title="Reload data">&#x21bb;</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        ${propertyKeys.map(k => `<th>${k}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${vertices.map(v => `
                        <tr>
                            ${propertyKeys.map(k => `<td>${v.Properties[k] !== undefined ? v.Properties[k] : ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export function showError(message) {
    const el = document.getElementById('error-msg');
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

export function showLoading(show) {
    const btn = document.getElementById('connect-btn');
    if (btn) {
        btn.disabled = show;
        btn.textContent = show ? 'Connecting...' : 'Connect';
    }
}

export function renderQueryPanel(onExecute, onClose) {
    const existing = document.getElementById('query-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'query-overlay';
    overlay.id = 'query-overlay';
    overlay.innerHTML = `
        <div class="query-panel">
            <div class="query-toolbar">
                <h3>Raw Gremlin Query</h3>
                <div class="query-actions">
                    <button id="execute-query-btn" class="btn-primary">Execute</button>
                    <button id="close-query-btn" class="icon-btn">&times;</button>
                </div>
            </div>
            <div class="query-body">
                <div class="query-input-section">
                    <textarea id="query-input" placeholder="g.V().limit(10)" spellcheck="false"></textarea>
                </div>
                <div class="query-result-section">
                    <pre id="query-result"><code>Results will appear here...</code></pre>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea = document.getElementById('query-input');
    textarea.focus();

    document.getElementById('execute-query-btn').addEventListener('click', () => {
        onExecute(textarea.value);
    });
    document.getElementById('close-query-btn').addEventListener('click', onClose);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) onClose();
    });

    textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            onExecute(textarea.value);
        }
    });
}

export function showQueryResult(data) {
    const el = document.getElementById('query-result');
    if (el) {
        el.className = '';
        el.innerHTML = `<code>${escapeHtml(JSON.stringify(data, null, 2))}</code>`;
    }
}

export function showQueryError(message) {
    const el = document.getElementById('query-result');
    if (el) {
        el.className = 'error-text';
        el.innerHTML = `<code>${escapeHtml(message)}</code>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
