// Model — holds the application state.
const model = {
    connected: false,
    serverUrl: '',
    labels: [],
    selectedLabel: null,
    vertices: [],
    propertyKeys: [],
    error: null,
    loading: false,
    queryPanelOpen: false,
    queryResult: null,
};

export default model;
