import { BaseView } from './base-view.js';
import { escapeHtml, vertexToJson } from '../utils.js';

export class TableView extends BaseView {
    constructor(dataModel, graphModel, controller) {
        super(controller);
        this.dataModel = dataModel;
        this.graphModel = graphModel;
        this.subscribeTo(this.dataModel, 'selectedLabel', () => this.update());
        this.subscribeTo(this.dataModel, 'vertices', () => this.update());
        this.subscribeTo(this.dataModel, 'propertyKeys', () => this.update());
        this.subscribeTo(this.dataModel, 'currentPage', () => this.update());
        this.subscribeTo(this.dataModel, 'hasNextPage', () => this.update());
        this.subscribeTo(this.dataModel, 'vertexRelationships', () => this.update());
        this.subscribeTo(this.dataModel, 'expandingVertex', () => this.update());
        this.subscribeTo(this.graphModel, 'activeTab', () => this.updateVisibility());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'table-container';
        container.appendChild(this.el);
        this.updateVisibility();
        this.update();
    }

    updateVisibility() {
        if (!this.el) return;
        this.el.style.display = this.graphModel.get('activeTab') === 'table' ? '' : 'none';
    }

    update() {
        if (!this.el) return;
        if (this.graphModel.get('activeTab') !== 'table') return;

        const label = this.dataModel.get('selectedLabel');
        if (!label) {
            this.el.innerHTML = '<p class="placeholder">Select a label to view data</p>';
            return;
        }

        const allVertices = this.dataModel.get('vertices');
        const propertyKeys = this.dataModel.get('propertyKeys');
        const currentPage = this.dataModel.get('currentPage');
        const hasNextPage = this.dataModel.get('hasNextPage');
        const filterKey = this.dataModel.get('filterKey');
        const filterValue = this.dataModel.get('filterValue');
        const filterDisplay = filterKey ? `${filterKey}=${filterValue}` : '';
        const vertexRelationships = this.dataModel.get('vertexRelationships') || {};
        const expandingVertex = this.dataModel.get('expandingVertex');

        const vertices = allVertices;

        const relationshipColumns = this._collectRelationshipColumns(vertices, vertexRelationships);

        this.el.innerHTML = `
            <div class="content-header">
                <h2>${escapeHtml(label)} <span class="count">(${vertices.length})</span></h2>
                <button class="icon-btn reload-table-btn" title="Reload data">&#x21bb;</button>
            </div>
            <div class="table-filter">
                <input type="text" class="filter-input table-filter-input"
                    placeholder="Filter: property=value (Enter to apply)"
                    value="${escapeHtml(filterDisplay)}">
            </div>
            ${vertices.length === 0
                ? '<p class="placeholder">No vertices found.</p>'
                : `<div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="col-expand"></th>
                                <th class="col-actions"></th>
                                ${propertyKeys.map(k => `<th>${escapeHtml(k)}</th>`).join('')}
                                ${relationshipColumns.map(col => `<th class="rel-col-header">${escapeHtml(col.display)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${vertices.map((v, i) => {
                                const vid = v.ID;
                                const isExpanded = vertexRelationships.hasOwnProperty(vid);
                                const isExpanding = expandingVertex === vid;
                                return `
                                <tr data-vertex-id="${escapeHtml(String(vid))}">
                                    <td class="col-expand">
                                        ${isExpanding
                                            ? '<span class="expand-spinner"></span>'
                                            : `<button class="expand-btn" data-vertex-id="${escapeHtml(String(vid))}" title="Expand relationships">${isExpanded ? '\u25BC' : '\u25B6'}</button>`
                                        }
                                    </td>
                                    <td class="col-actions"><button class="icon-btn copy-row-btn" data-row="${i}" title="Copy as JSON">&#x2398;</button></td>
                                    ${propertyKeys.map(k => {
                                        let val;
                                        if (k === 'ID') val = v.ID;
                                        else if (k === 'Label') val = v.Label;
                                        else val = v.Properties?.[k];
                                        return `<td>${val !== undefined ? escapeHtml(String(val)) : ''}</td>`;
                                    }).join('')}
                                    ${relationshipColumns.map(col => {
                                        const rels = vertexRelationships[vid];
                                        if (!rels) return '<td class="relationship-cell"></td>';
                                        const matching = rels.filter(r => this._relColumnKey(r) === col.key);
                                        return `<td class="relationship-cell">${this._renderRelationshipCell(matching, vid)}</td>`;
                                    }).join('')}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>`
            }
            <div class="table-pagination">
                <button class="btn-secondary prev-page-btn" ${currentPage === 0 ? 'disabled' : ''}>Previous</button>
                <span class="page-info">Page ${currentPage + 1}</span>
                <button class="btn-secondary next-page-btn" ${!hasNextPage ? 'disabled' : ''}>Next</button>
            </div>
        `;
        this._vertices = vertices;
        this._bindEvents();
    }

    _collectRelationshipColumns(vertices, vertexRelationships) {
        const columnMap = new Map();
        for (const v of vertices) {
            const rels = vertexRelationships[v.ID];
            if (!rels) continue;
            for (const r of rels) {
                const key = this._relColumnKey(r);
                if (!columnMap.has(key)) {
                    const arrow = r.Direction === 'OUT' ? '\u2192' : '\u2190';
                    columnMap.set(key, {
                        key,
                        display: `${arrow} ${r.EdgeLabel} ${r.TargetLabel}`,
                    });
                }
            }
        }
        return Array.from(columnMap.values());
    }

    _relColumnKey(r) {
        return `${r.Direction} ${r.EdgeLabel} ${r.TargetLabel}`;
    }

    _renderRelationshipCell(relationships, vertexId) {
        if (relationships.length === 0) return '';
        const maxVisible = 5;
        const visible = relationships.slice(0, maxVisible);
        const hasMore = relationships.length > maxVisible;
        let html = visible.map(r =>
            `<span class="relationship-id">${escapeHtml(String(r.TargetID))}<button class="relationship-navigate-btn" data-target-label="${escapeHtml(r.TargetLabel)}" data-target-id="${escapeHtml(String(r.TargetID))}" title="Navigate to ${escapeHtml(r.TargetLabel)} ${escapeHtml(String(r.TargetID))}">&#x1F517;</button></span>`
        ).join(' ');
        if (hasMore) {
            html += `<button class="load-more-btn" data-vertex-id="${escapeHtml(String(vertexId))}" title="Load more relationships">&hellip;</button>`;
        }
        return html;
    }

    _bindEvents() {
        const reloadBtn = this.el?.querySelector('.reload-table-btn');
        if (reloadBtn) reloadBtn.addEventListener('click', () => this.controller.handleReloadTable());

        const filterInput = this.el?.querySelector('.table-filter-input');
        if (filterInput) {
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.controller.handleApplyFilter(e.target.value);
            });
        }

        const prevBtn = this.el?.querySelector('.prev-page-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.controller.handlePrevPage());

        const nextBtn = this.el?.querySelector('.next-page-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.controller.handleNextPage());

        this.el?.querySelectorAll('.copy-row-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vertex = this._vertices[Number(btn.dataset.row)];
                if (!vertex) return;
                const json = vertexToJson(vertex);
                navigator.clipboard.writeText(json).then(() => {
                    btn.textContent = '\u2713';
                    setTimeout(() => { btn.innerHTML = '&#x2398;'; }, 1500);
                });
            });
        });

        this.el?.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.controller.handleExpandRelationships(btn.dataset.vertexId);
            });
        });

        this.el?.querySelectorAll('.relationship-navigate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.controller.handleNavigateToRelated(btn.dataset.targetLabel, btn.dataset.targetId);
            });
        });

        this.el?.querySelectorAll('.load-more-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.controller.handleLoadMoreRelationships(btn.dataset.vertexId);
            });
        });
    }
}
