package services

import (
	"errors"
	"gremlin-viewer/internal/core/domain"
	"testing"
)

type mockRepo struct {
	connectErr          error
	closeErr            error
	labels              []string
	labelsErr           error
	vertexPage          domain.VertexPage
	verticesErr         error
	connected           bool
	queryResult         interface{}
	queryErr            error
	graphPaths          []domain.GraphPath
	graphPathsErr       error
	lastGraphQuery      string
	lastOffset          int
	lastFilterKey       string
	lastFilterVal       string
	relationshipsResult []domain.Relationship
	relationshipsErr    error
}

func (m *mockRepo) Connect(url string) error {
	if m.connectErr != nil {
		return m.connectErr
	}
	m.connected = true
	return nil
}

func (m *mockRepo) Close() error {
	m.connected = false
	return m.closeErr
}

func (m *mockRepo) ListLabels() ([]string, error) {
	return m.labels, m.labelsErr
}

func (m *mockRepo) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	m.lastOffset = offset
	m.lastFilterKey = filterKey
	m.lastFilterVal = filterValue
	return m.vertexPage, m.verticesErr
}

func (m *mockRepo) ExecuteQuery(query string) (interface{}, error) {
	return m.queryResult, m.queryErr
}

func (m *mockRepo) GetGraphPaths(query string) ([]domain.GraphPath, error) {
	m.lastGraphQuery = query
	return m.graphPaths, m.graphPathsErr
}

func (m *mockRepo) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	return m.relationshipsResult, m.relationshipsErr
}

func TestConnect_Success(t *testing.T) {
	repo := &mockRepo{}
	svc := NewGraphService(repo)

	err := svc.Connect("ws://localhost:8182/gremlin")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestConnect_Error(t *testing.T) {
	repo := &mockRepo{connectErr: errors.New("connection refused")}
	svc := NewGraphService(repo)

	err := svc.Connect("ws://invalid:9999/gremlin")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestDisconnect(t *testing.T) {
	repo := &mockRepo{}
	svc := NewGraphService(repo)

	_ = svc.Connect("ws://localhost:8182/gremlin")
	err := svc.Disconnect()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestListLabels_Success(t *testing.T) {
	repo := &mockRepo{labels: []string{"person", "software"}}
	svc := NewGraphService(repo)

	labels, err := svc.ListLabels()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(labels) != 2 {
		t.Fatalf("expected 2 labels, got %d", len(labels))
	}
	if labels[0] != "person" || labels[1] != "software" {
		t.Errorf("unexpected labels: %v", labels)
	}
}

func TestListLabels_Error(t *testing.T) {
	repo := &mockRepo{labelsErr: errors.New("query failed")}
	svc := NewGraphService(repo)

	_, err := svc.ListLabels()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetVerticesByLabel_Success(t *testing.T) {
	vertices := []domain.Vertex{
		{ID: "1", Label: "person", Properties: map[string]interface{}{"name": "Alice"}},
		{ID: "2", Label: "person", Properties: map[string]interface{}{"name": "Bob"}},
	}
	repo := &mockRepo{vertexPage: domain.VertexPage{Vertices: vertices, HasMore: false}}
	svc := NewGraphService(repo)

	result, err := svc.GetVerticesByLabel("person", 0, "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result.Vertices) != 2 {
		t.Fatalf("expected 2 vertices, got %d", len(result.Vertices))
	}
	if result.Vertices[0].Properties["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", result.Vertices[0].Properties["name"])
	}
	if result.HasMore {
		t.Error("expected HasMore=false")
	}
}

func TestGetVerticesByLabel_Error(t *testing.T) {
	repo := &mockRepo{verticesErr: errors.New("query failed")}
	svc := NewGraphService(repo)

	_, err := svc.GetVerticesByLabel("person", 0, "", "")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetVerticesByLabel_PassesOffset(t *testing.T) {
	repo := &mockRepo{vertexPage: domain.VertexPage{}}
	svc := NewGraphService(repo)

	_, _ = svc.GetVerticesByLabel("person", 200, "", "")
	if repo.lastOffset != 200 {
		t.Errorf("expected offset 200, got %d", repo.lastOffset)
	}
}

func TestGetVerticesByLabel_PassesFilter(t *testing.T) {
	repo := &mockRepo{vertexPage: domain.VertexPage{}}
	svc := NewGraphService(repo)

	_, _ = svc.GetVerticesByLabel("person", 0, "name", "Alice")
	if repo.lastFilterKey != "name" {
		t.Errorf("expected filterKey 'name', got '%s'", repo.lastFilterKey)
	}
	if repo.lastFilterVal != "Alice" {
		t.Errorf("expected filterValue 'Alice', got '%s'", repo.lastFilterVal)
	}
}

func TestGetVerticesByLabel_HasMore(t *testing.T) {
	repo := &mockRepo{vertexPage: domain.VertexPage{
		Vertices: make([]domain.Vertex, 100),
		HasMore:  true,
	}}
	svc := NewGraphService(repo)

	result, err := svc.GetVerticesByLabel("person", 0, "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !result.HasMore {
		t.Error("expected HasMore=true")
	}
}

func TestExecuteQuery_Success(t *testing.T) {
	expected := []interface{}{
		map[string]interface{}{"name": "Alice"},
		map[string]interface{}{"name": "Bob"},
	}
	repo := &mockRepo{queryResult: expected}
	svc := NewGraphService(repo)

	result, err := svc.ExecuteQuery("g.V().limit(2)")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	items, ok := result.([]interface{})
	if !ok {
		t.Fatalf("expected []interface{}, got %T", result)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
}

func TestExecuteQuery_Error(t *testing.T) {
	repo := &mockRepo{queryErr: errors.New("query failed")}
	svc := NewGraphService(repo)

	_, err := svc.ExecuteQuery("g.V()")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestExecuteQuery_EmptyQuery(t *testing.T) {
	repo := &mockRepo{}
	svc := NewGraphService(repo)

	_, err := svc.ExecuteQuery("")
	if err == nil {
		t.Fatal("expected error for empty query, got nil")
	}

	_, err = svc.ExecuteQuery("   ")
	if err == nil {
		t.Fatal("expected error for whitespace-only query, got nil")
	}
}

func TestGetGraphData_Success(t *testing.T) {
	v1 := domain.Vertex{ID: "1", Label: "person", Properties: map[string]interface{}{"name": "Alice"}}
	v2 := domain.Vertex{ID: "2", Label: "person", Properties: map[string]interface{}{"name": "Bob"}}
	e1 := domain.Edge{ID: "e1", Label: "knows", OutV: "1", InV: "2"}

	repo := &mockRepo{
		graphPaths: []domain.GraphPath{
			{Objects: []interface{}{v1, e1, v2}},
		},
	}
	svc := NewGraphService(repo)

	gd, err := svc.GetGraphData("g.V().outE().inV().path()")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(gd.Vertices) != 2 {
		t.Fatalf("expected 2 vertices, got %d", len(gd.Vertices))
	}
	if len(gd.Edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(gd.Edges))
	}
}

func TestGetGraphData_Error(t *testing.T) {
	repo := &mockRepo{graphPathsErr: errors.New("query failed")}
	svc := NewGraphService(repo)

	_, err := svc.GetGraphData("g.V().path()")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetGraphData_EmptyQuery_UsesDefault(t *testing.T) {
	repo := &mockRepo{graphPaths: []domain.GraphPath{}}
	svc := NewGraphService(repo)

	_, err := svc.GetGraphData("")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.lastGraphQuery != DefaultGraphQuery {
		t.Errorf("expected default query '%s', got '%s'", DefaultGraphQuery, repo.lastGraphQuery)
	}
}

func TestGetGraphData_WhitespaceQuery_UsesDefault(t *testing.T) {
	repo := &mockRepo{graphPaths: []domain.GraphPath{}}
	svc := NewGraphService(repo)

	_, err := svc.GetGraphData("   ")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.lastGraphQuery != DefaultGraphQuery {
		t.Errorf("expected default query, got '%s'", repo.lastGraphQuery)
	}
}

func TestGetGraphData_DeduplicatesVertices(t *testing.T) {
	v1 := domain.Vertex{ID: "1", Label: "person"}
	v2 := domain.Vertex{ID: "2", Label: "person"}
	e1 := domain.Edge{ID: "e1", Label: "knows", OutV: "1", InV: "2"}
	e2 := domain.Edge{ID: "e2", Label: "likes", OutV: "2", InV: "1"}

	repo := &mockRepo{
		graphPaths: []domain.GraphPath{
			{Objects: []interface{}{v1, e1, v2}},
			{Objects: []interface{}{v2, e2, v1}},
		},
	}
	svc := NewGraphService(repo)

	gd, err := svc.GetGraphData("query")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(gd.Vertices) != 2 {
		t.Errorf("expected 2 deduplicated vertices, got %d", len(gd.Vertices))
	}
}

func TestGetGraphData_DeduplicatesEdges(t *testing.T) {
	v1 := domain.Vertex{ID: "1", Label: "person"}
	v2 := domain.Vertex{ID: "2", Label: "person"}
	v3 := domain.Vertex{ID: "3", Label: "person"}
	e1 := domain.Edge{ID: "e1", Label: "knows", OutV: "1", InV: "2"}

	repo := &mockRepo{
		graphPaths: []domain.GraphPath{
			{Objects: []interface{}{v1, e1, v2}},
			{Objects: []interface{}{v1, e1, v3}},
		},
	}
	svc := NewGraphService(repo)

	gd, err := svc.GetGraphData("query")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(gd.Edges) != 1 {
		t.Errorf("expected 1 deduplicated edge, got %d", len(gd.Edges))
	}
}

func TestGetGraphData_EmptyPaths(t *testing.T) {
	repo := &mockRepo{graphPaths: []domain.GraphPath{}}
	svc := NewGraphService(repo)

	gd, err := svc.GetGraphData("query")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(gd.Vertices) != 0 {
		t.Errorf("expected 0 vertices, got %d", len(gd.Vertices))
	}
	if len(gd.Edges) != 0 {
		t.Errorf("expected 0 edges, got %d", len(gd.Edges))
	}
}

func TestGetVertexRelationships_Success(t *testing.T) {
	rels := []domain.Relationship{
		{Direction: "OUT", EdgeLabel: "knows", TargetLabel: "person", TargetID: "2"},
		{Direction: "IN", EdgeLabel: "created", TargetLabel: "software", TargetID: "3"},
	}
	repo := &mockRepo{relationshipsResult: rels}
	svc := NewGraphService(repo)

	result, err := svc.GetVertexRelationships("1", 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 relationships, got %d", len(result))
	}
	if result[0].Direction != "OUT" {
		t.Errorf("expected direction 'OUT', got '%s'", result[0].Direction)
	}
	if result[1].EdgeLabel != "created" {
		t.Errorf("expected edge label 'created', got '%s'", result[1].EdgeLabel)
	}
}

func TestGetVertexRelationships_Error(t *testing.T) {
	repo := &mockRepo{relationshipsErr: errors.New("query failed")}
	svc := NewGraphService(repo)

	_, err := svc.GetVertexRelationships("1", 10, 0)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetVertexRelationships_EmptyVertexId(t *testing.T) {
	repo := &mockRepo{}
	svc := NewGraphService(repo)

	_, err := svc.GetVertexRelationships("", 10, 0)
	if err == nil {
		t.Fatal("expected error for empty vertex ID, got nil")
	}

	_, err = svc.GetVertexRelationships("   ", 10, 0)
	if err == nil {
		t.Fatal("expected error for whitespace-only vertex ID, got nil")
	}
}

func TestGetVertexRelationships_DefaultLimit(t *testing.T) {
	repo := &mockRepo{relationshipsResult: []domain.Relationship{}}
	svc := NewGraphService(repo)

	// limit <= 0 should default to 5 — no panic, no error
	result, err := svc.GetVertexRelationships("1", 0, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	result, err = svc.GetVertexRelationships("1", -5, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestGetVertexRelationships_DefaultOffset(t *testing.T) {
	repo := &mockRepo{relationshipsResult: []domain.Relationship{}}
	svc := NewGraphService(repo)

	// negative offset should default to 0 — no panic, no error
	result, err := svc.GetVertexRelationships("1", 10, -3)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}
