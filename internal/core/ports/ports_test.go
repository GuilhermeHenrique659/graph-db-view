package ports

import (
	"gremlin-viewer/internal/core/domain"
	"testing"
)

// mockGraphRepository is a compile-time check that the interface is implementable.
type mockGraphRepository struct{}

func (m *mockGraphRepository) Connect(url string) error                          { return nil }
func (m *mockGraphRepository) Close() error                                      { return nil }
func (m *mockGraphRepository) ListLabels() ([]string, error)                     { return nil, nil }
func (m *mockGraphRepository) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	return domain.VertexPage{}, nil
}
func (m *mockGraphRepository) ExecuteQuery(query string) (interface{}, error) { return nil, nil }
func (m *mockGraphRepository) GetGraphPaths(query string) ([]domain.GraphPath, error) {
	return nil, nil
}
func (m *mockGraphRepository) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	return nil, nil
}

// Compile-time interface satisfaction check.
var _ GraphRepository = (*mockGraphRepository)(nil)

func TestGraphRepositoryInterfaceIsSatisfied(t *testing.T) {
	var repo GraphRepository = &mockGraphRepository{}
	if repo == nil {
		t.Error("expected non-nil GraphRepository")
	}
}
