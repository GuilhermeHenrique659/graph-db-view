import './style.css';
import { ConnectionModel } from './model/connection-model.js';
import { DataModel } from './model/data-model.js';
import { GraphModel } from './model/graph-model.js';
import { QueryModel } from './model/query-model.js';
import { Controller } from './controller.js';
import { backend } from './backend.js';
import { ConnectionView } from './view/connection-view.js';
import { SidebarView } from './view/sidebar-view.js';
import { TableView } from './view/table-view.js';
import { GraphView } from './view/graph-view.js';
import { QueryPanelView } from './view/query-panel-view.js';
import { NavbarView } from './view/navbar-view.js';

const connection = new ConnectionModel();
const data = new DataModel();
const graph = new GraphModel();
const query = new QueryModel();
const controller = new Controller({ connection, data, graph, query }, backend);
const app = document.getElementById('app');

let views = [];

function destroyViews() {
    views.forEach(v => v.destroy());
    views = [];
}

function mountConnection() {
    destroyViews();
    app.innerHTML = '';
    const view = new ConnectionView(connection, controller);
    view.mount(app);
    views = [view];
}

function mountMain() {
    destroyViews();
    app.innerHTML = `
        <div class="main-screen">
            <header class="top-navbar"></header>
            <div class="main-body">
                <nav class="sidebar"></nav>
                <main class="content">
                    <div class="tab-bar">
                        <button class="tab-btn tab-active" data-tab="table">Table</button>
                        <button class="tab-btn" data-tab="graph">Graph</button>
                    </div>
                    <div class="tab-content"></div>
                </main>
            </div>
        </div>
    `;

    const navbar = new NavbarView(connection, controller);
    const sidebar = new SidebarView(data, controller);
    const table = new TableView(data, graph, controller);
    const graphView = new GraphView(graph, controller);
    const queryPanel = new QueryPanelView(query, controller);

    navbar.mount(app.querySelector('.top-navbar'));
    sidebar.mount(app.querySelector('.sidebar'));
    table.mount(app.querySelector('.tab-content'));
    graphView.mount(app.querySelector('.tab-content'));
    queryPanel.mount(document.body);

    views = [navbar, sidebar, table, graphView, queryPanel];

    app.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            controller.handleSwitchTab(btn.dataset.tab);
        });
    });

    graph.subscribe('activeTab', (tab) => {
        app.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('tab-active', b.dataset.tab === tab);
        });
    });
}

connection.subscribe('connected', (connected) => {
    connected ? mountMain() : mountConnection();
});

mountConnection();
