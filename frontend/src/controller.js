export class Controller {
    constructor(models, backend) {
        this.connection = models.connection;
        this.data = models.data;
        this.graph = models.graph;
        this.query = models.query;
        this.backend = backend;
    }

    async handleConnect(url) {
        this.connection.set('error', null);
        this.connection.set('loading', true);
        try {
            await this.backend.call('Connect', url);
            const labels = await this.backend.call('ListLabels');
            this.connection.set('serverUrl', url);
            this.data.set('labels', labels || []);
            this.data.set('selectedLabel', null);
            this.data.set('vertices', []);
            this.data.set('propertyKeys', []);
            this.data.set('currentPage', 0);
            this.data.set('hasNextPage', false);
            this.data.set('filterKey', '');
            this.data.set('filterValue', '');
            this.connection.set('connected', true);
        } catch (err) {
            this.connection.set('error', typeof err === 'string' ? err : err.message || 'Connection failed');
            this.connection.set('connected', false);
            this.connection.set('loading', false);
        }
    }

    async handleSelectLabel(label) {
        this.data.set('selectedLabel', label);
        this.data.set('filterKey', '');
        this.data.set('filterValue', '');
        await this._fetchVertices(label, 0, '', '');
    }

    async _fetchVertices(label, offset, filterKey, filterValue) {
        this.connection.set('loading', true);
        try {
            const page = await this.backend.call('GetVerticesByLabel', label, offset, filterKey, filterValue);
            const vertices = page?.Vertices || [];
            this.data.set('vertices', vertices);
            this.data.set('currentPage', Math.floor(offset / 100));
            this.data.set('hasNextPage', page?.HasMore || false);

            const keySet = new Set();
            vertices.forEach(v => {
                if (v.Properties) Object.keys(v.Properties).forEach(k => keySet.add(k));
            });
            const propKeys = Array.from(keySet).sort();
            this.data.set('propertyKeys', ['ID', 'Label', ...propKeys]);
            this.connection.set('loading', false);
        } catch (err) {
            this.connection.set('error', typeof err === 'string' ? err : err.message || 'Failed to load vertices');
            this.data.set('vertices', []);
            this.data.set('propertyKeys', []);
            this.connection.set('loading', false);
        }
    }

    async handleApplyFilter(input) {
        const label = this.data.get('selectedLabel');
        if (!label) return;

        let filterKey = '';
        let filterValue = '';
        if (input && input.includes('=')) {
            const eqIndex = input.indexOf('=');
            filterKey = input.substring(0, eqIndex).trim();
            filterValue = input.substring(eqIndex + 1).trim();
        }
        this.data.set('filterKey', filterKey);
        this.data.set('filterValue', filterValue);
        await this._fetchVertices(label, 0, filterKey, filterValue);
    }

    async handleNextPage() {
        const label = this.data.get('selectedLabel');
        if (!label) return;
        const currentPage = this.data.get('currentPage');
        const offset = (currentPage + 1) * 100;
        await this._fetchVertices(label, offset, this.data.get('filterKey'), this.data.get('filterValue'));
    }

    async handlePrevPage() {
        const label = this.data.get('selectedLabel');
        if (!label) return;
        const currentPage = this.data.get('currentPage');
        if (currentPage <= 0) return;
        const offset = (currentPage - 1) * 100;
        await this._fetchVertices(label, offset, this.data.get('filterKey'), this.data.get('filterValue'));
    }

    async handleReloadLabels() {
        try {
            const labels = await this.backend.call('ListLabels');
            this.data.set('labels', labels || []);
            if (this.data.get('selectedLabel') && !(labels || []).includes(this.data.get('selectedLabel'))) {
                this.data.set('selectedLabel', null);
                this.data.set('vertices', []);
                this.data.set('propertyKeys', []);
            }
        } catch (err) {
            this.connection.set('error', typeof err === 'string' ? err : err.message || 'Failed to reload labels');
        }
    }

    async handleReloadTable() {
        const label = this.data.get('selectedLabel');
        if (!label) return;
        const offset = this.data.get('currentPage') * 100;
        await this._fetchVertices(label, offset, this.data.get('filterKey'), this.data.get('filterValue'));
    }

    handleFilterLabels(value) {
        this.data.set('labelFilter', value);
    }

    handleSwitchTab(tab) {
        this.graph.set('selectedElement', null);
        this.graph.set('activeTab', tab);
    }

    async handleExecuteGraphQuery(query) {
        this.graph.set('graphLoading', true);
        this.graph.set('selectedElement', null);
        try {
            const data = await this.backend.call('GetGraphData', query);
            this.graph.set('graphData', data);
            this.graph.set('graphQuery', query);
        } catch (err) {
            this.graph.set('graphData', null);
        } finally {
            this.graph.set('graphLoading', false);
        }
    }

    handleSelectElement(element) {
        this.graph.set('selectedElement', element);
    }

    handleDeselectElement() {
        this.graph.set('selectedElement', null);
    }

    handleOpenQuery() {
        this.query.set('queryPanelOpen', true);
        this.query.set('queryResult', null);
    }

    async handleExecuteQuery(query) {
        this.query.set('queryLoading', true);
        try {
            const result = await this.backend.call('ExecuteQuery', query);
            this.query.set('queryResult', { data: result });
        } catch (err) {
            this.query.set('queryResult', { error: typeof err === 'string' ? err : err.message || 'Query execution failed' });
        } finally {
            this.query.set('queryLoading', false);
        }
    }

    async handleDisconnect() {
        try {
            await this.backend.call('Disconnect');
        } catch (_) {}
        this.data.set('labels', []);
        this.data.set('selectedLabel', null);
        this.data.set('vertices', []);
        this.data.set('propertyKeys', []);
        this.data.set('currentPage', 0);
        this.data.set('hasNextPage', false);
        this.data.set('filterKey', '');
        this.data.set('filterValue', '');
        this.connection.set('serverUrl', '');
        this.connection.set('connected', false);
    }

    handleCloseQuery() {
        this.query.set('queryPanelOpen', false);
        this.query.set('queryResult', null);
    }

    async handleExpandRelationships(vertexId) {
        this.data.set('expandingVertex', vertexId);
        try {
            const result = await this.backend.call('GetVertexRelationships', vertexId, 5, 0);
            const current = this.data.get('vertexRelationships');
            this.data.set('vertexRelationships', { ...current, [vertexId]: result });
        } catch (err) {
            this.connection.set('error', typeof err === 'string' ? err : err.message || 'Failed to load relationships');
        } finally {
            this.data.set('expandingVertex', null);
        }
    }

    async handleLoadMoreRelationships(vertexId) {
        const current = this.data.get('vertexRelationships');
        const existing = current[vertexId] || [];
        const offset = existing.length;
        this.data.set('expandingVertex', vertexId);
        try {
            const result = await this.backend.call('GetVertexRelationships', vertexId, 5, offset);
            this.data.set('vertexRelationships', {
                ...current,
                [vertexId]: [...existing, ...result]
            });
        } catch (err) {
            this.connection.set('error', typeof err === 'string' ? err : err.message || 'Failed to load more relationships');
        } finally {
            this.data.set('expandingVertex', null);
        }
    }

    async handleNavigateToRelated(targetLabel, targetId) {
        this.data.set('selectedLabel', targetLabel);
        this.data.set('filterKey', 'ID');
        this.data.set('filterValue', targetId);
        await this._fetchVertices(targetLabel, 0, 'ID', targetId);
    }
}
