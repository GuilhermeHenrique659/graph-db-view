package main

import (
	"errors"
	"gremlin-viewer/internal/core/domain"
	"testing"
)

type mockGraphService struct {
	connectErr      error
	disconnectErr   error
	labels          []string
	labelsErr       error
	vertexPage      domain.VertexPage
	verticesErr     error
	connectedURL    string
	disconnectCalls int
	queryResult     interface{}
	queryErr        error
	graphData           *domain.GraphData
	graphDataErr        error
	lastOffset          int
	lastFilterKey       string
	lastFilterVal       string
	relationshipsResult []domain.Relationship
	relationshipsErr    error
}

func (m *mockGraphService) Connect(url string) error {
	m.connectedURL = url
	return m.connectErr
}

func (m *mockGraphService) Disconnect() error {
	m.disconnectCalls++
	return m.disconnectErr
}

func (m *mockGraphService) ListLabels() ([]string, error) {
	return m.labels, m.labelsErr
}

func (m *mockGraphService) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	m.lastOffset = offset
	m.lastFilterKey = filterKey
	m.lastFilterVal = filterValue
	return m.vertexPage, m.verticesErr
}

func (m *mockGraphService) ExecuteQuery(query string) (interface{}, error) {
	return m.queryResult, m.queryErr
}

func (m *mockGraphService) GetGraphData(query string) (*domain.GraphData, error) {
	return m.graphData, m.graphDataErr
}

func (m *mockGraphService) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	return m.relationshipsResult, m.relationshipsErr
}

func TestApp_Connect_Success(t *testing.T) {
	mock := &mockGraphService{}
	app := &App{service: mock}

	err := app.Connect("ws://localhost:8182/gremlin")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if mock.connectedURL != "ws://localhost:8182/gremlin" {
		t.Errorf("expected URL 'ws://localhost:8182/gremlin', got '%s'", mock.connectedURL)
	}
}

func TestApp_Connect_Error(t *testing.T) {
	mock := &mockGraphService{connectErr: errors.New("refused")}
	app := &App{service: mock}

	err := app.Connect("ws://bad:9999/gremlin")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_ListLabels_Success(t *testing.T) {
	mock := &mockGraphService{labels: []string{"person", "software"}}
	app := &App{service: mock}

	labels, err := app.ListLabels()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(labels) != 2 {
		t.Fatalf("expected 2 labels, got %d", len(labels))
	}
}

func TestApp_ListLabels_Error(t *testing.T) {
	mock := &mockGraphService{labelsErr: errors.New("fail")}
	app := &App{service: mock}

	_, err := app.ListLabels()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_GetVerticesByLabel_Success(t *testing.T) {
	verts := []domain.Vertex{
		{ID: "1", Label: "person", Properties: map[string]interface{}{"name": "Alice"}},
	}
	mock := &mockGraphService{vertexPage: domain.VertexPage{Vertices: verts, HasMore: false}}
	app := &App{service: mock}

	result, err := app.GetVerticesByLabel("person", 0, "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result.Vertices) != 1 {
		t.Fatalf("expected 1 vertex, got %d", len(result.Vertices))
	}
	if result.Vertices[0].Properties["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", result.Vertices[0].Properties["name"])
	}
}

func TestApp_GetVerticesByLabel_Error(t *testing.T) {
	mock := &mockGraphService{verticesErr: errors.New("fail")}
	app := &App{service: mock}

	_, err := app.GetVerticesByLabel("person", 0, "", "")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_GetVerticesByLabel_PassesParams(t *testing.T) {
	mock := &mockGraphService{vertexPage: domain.VertexPage{}}
	app := &App{service: mock}

	_, _ = app.GetVerticesByLabel("person", 200, "name", "Alice")
	if mock.lastOffset != 200 {
		t.Errorf("expected offset 200, got %d", mock.lastOffset)
	}
	if mock.lastFilterKey != "name" {
		t.Errorf("expected filterKey 'name', got '%s'", mock.lastFilterKey)
	}
	if mock.lastFilterVal != "Alice" {
		t.Errorf("expected filterValue 'Alice', got '%s'", mock.lastFilterVal)
	}
}

func TestApp_ExecuteQuery_Success(t *testing.T) {
	expected := []interface{}{map[string]interface{}{"name": "Alice"}}
	mock := &mockGraphService{queryResult: expected}
	app := &App{service: mock}

	result, err := app.ExecuteQuery("g.V().limit(1)")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	items, ok := result.([]interface{})
	if !ok {
		t.Fatalf("expected []interface{}, got %T", result)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
}

func TestApp_ExecuteQuery_Error(t *testing.T) {
	mock := &mockGraphService{queryErr: errors.New("query failed")}
	app := &App{service: mock}

	_, err := app.ExecuteQuery("g.V()")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_GetGraphData_Success(t *testing.T) {
	gd := &domain.GraphData{
		Vertices: []domain.Vertex{{ID: "1", Label: "person"}},
		Edges:    []domain.Edge{{ID: "e1", Label: "knows"}},
	}
	mock := &mockGraphService{graphData: gd}
	app := &App{service: mock}

	result, err := app.GetGraphData("g.V().path()")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result.Vertices) != 1 {
		t.Fatalf("expected 1 vertex, got %d", len(result.Vertices))
	}
	if len(result.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(result.Edges))
	}
}

func TestApp_GetGraphData_Error(t *testing.T) {
	mock := &mockGraphService{graphDataErr: errors.New("fail")}
	app := &App{service: mock}

	_, err := app.GetGraphData("g.V().path()")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_Disconnect_Success(t *testing.T) {
	mock := &mockGraphService{}
	app := &App{service: mock}

	err := app.Disconnect()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if mock.disconnectCalls != 1 {
		t.Errorf("expected 1 disconnect call, got %d", mock.disconnectCalls)
	}
}

func TestApp_Disconnect_Error(t *testing.T) {
	mock := &mockGraphService{disconnectErr: errors.New("disconnect failed")}
	app := &App{service: mock}

	err := app.Disconnect()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestApp_GetVertexRelationships_Success(t *testing.T) {
	rels := []domain.Relationship{
		{Direction: "OUT", EdgeLabel: "knows", TargetLabel: "person", TargetID: "2"},
		{Direction: "IN", EdgeLabel: "created", TargetLabel: "software", TargetID: "3"},
	}
	mock := &mockGraphService{relationshipsResult: rels}
	app := &App{service: mock}

	result, err := app.GetVertexRelationships("1", 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 relationships, got %d", len(result))
	}
	if result[0].Direction != "OUT" {
		t.Errorf("expected Direction 'OUT', got '%s'", result[0].Direction)
	}
	if result[0].EdgeLabel != "knows" {
		t.Errorf("expected EdgeLabel 'knows', got '%s'", result[0].EdgeLabel)
	}
	if result[1].TargetID != "3" {
		t.Errorf("expected TargetID '3', got '%s'", result[1].TargetID)
	}
}

func TestApp_GetVertexRelationships_Error(t *testing.T) {
	mock := &mockGraphService{relationshipsErr: errors.New("relationships failed")}
	app := &App{service: mock}

	_, err := app.GetVertexRelationships("1", 10, 0)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
