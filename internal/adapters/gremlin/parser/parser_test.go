package parser

import (
	"testing"

	"gremlin-viewer/internal/core/domain"

	gremlingo "github.com/apache/tinkerpop/gremlin-go/v3/driver"
)

func TestVertex_BasicProperties(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		"name": "Alice",
		"age":  30,
	}

	v := Vertex("test-id", "person", elemMap)

	if v.ID != "test-id" {
		t.Errorf("expected ID 'test-id', got '%s'", v.ID)
	}
	if v.Label != "person" {
		t.Errorf("expected Label 'person', got '%s'", v.Label)
	}
	if v.Properties["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", v.Properties["name"])
	}
	if v.Properties["age"] != 30 {
		t.Errorf("expected 30, got '%v'", v.Properties["age"])
	}
}

func TestVertex_EmptyMap(t *testing.T) {
	v := Vertex("1", "empty", map[interface{}]interface{}{})

	if len(v.Properties) != 0 {
		t.Errorf("expected 0 properties, got %d", len(v.Properties))
	}
}

func TestVertex_FiltersReservedStringKeys(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:    "should-be-filtered",
		TLabel: "should-be-filtered",
		"id":   "also-filtered",
		"label": "also-filtered",
		"name": "Alice",
	}

	v := Vertex("1", "person", elemMap)

	if _, ok := v.Properties[string(TId)]; ok {
		t.Error("TId should be filtered from properties")
	}
	if _, ok := v.Properties[string(TLabel)]; ok {
		t.Error("TLabel should be filtered from properties")
	}
	if _, ok := v.Properties["id"]; ok {
		t.Error("'id' string key should be filtered")
	}
	if _, ok := v.Properties["label"]; ok {
		t.Error("'label' string key should be filtered")
	}
	if v.Properties["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", v.Properties["name"])
	}
}

func TestVertex_FiltersGremlingoTKeys(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		gremlingo.T.Id:    "filtered",
		gremlingo.T.Label: "filtered",
		"name":            "Bob",
	}

	v := Vertex("1", "person", elemMap)

	if len(v.Properties) != 1 {
		t.Errorf("expected 1 property, got %d", len(v.Properties))
	}
	if v.Properties["name"] != "Bob" {
		t.Errorf("expected 'Bob', got '%v'", v.Properties["name"])
	}
}

func TestVertex_MixedKeyTypes(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		"name": "Bob",
		42:     "numeric-key",
	}

	v := Vertex("2", "person", elemMap)

	if v.Properties["name"] != "Bob" {
		t.Errorf("expected 'Bob', got '%v'", v.Properties["name"])
	}
	if v.Properties["42"] != "numeric-key" {
		t.Errorf("expected 'numeric-key', got '%v'", v.Properties["42"])
	}
}

func TestNormalizeResult_Nil(t *testing.T) {
	if NormalizeResult(nil) != nil {
		t.Error("expected nil")
	}
}

func TestNormalizeResult_Primitives(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
	}{
		{"string", "hello"},
		{"int", 42},
		{"float", 3.14},
		{"bool", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if NormalizeResult(tt.input) != tt.input {
				t.Errorf("expected %v pass through", tt.input)
			}
		})
	}
}

func TestNormalizeResult_MapWithInterfaceKeys(t *testing.T) {
	input := map[interface{}]interface{}{
		"name": "Alice",
		42:     "numeric",
	}
	result := NormalizeResult(input)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map[string]interface{}, got %T", result)
	}
	if m["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", m["name"])
	}
	if m["42"] != "numeric" {
		t.Errorf("expected 'numeric', got '%v'", m["42"])
	}
}

func TestNormalizeResult_NestedMap(t *testing.T) {
	input := map[interface{}]interface{}{
		"outer": map[interface{}]interface{}{
			"inner": "value",
		},
	}
	result := NormalizeResult(input)
	m := result.(map[string]interface{})
	inner, ok := m["outer"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected nested map, got %T", m["outer"])
	}
	if inner["inner"] != "value" {
		t.Errorf("expected 'value', got '%v'", inner["inner"])
	}
}

func TestNormalizeResult_Slice(t *testing.T) {
	input := []interface{}{"a", 1, map[interface{}]interface{}{"k": "v"}}
	result := NormalizeResult(input)
	s, ok := result.([]interface{})
	if !ok {
		t.Fatalf("expected []interface{}, got %T", result)
	}
	if len(s) != 3 {
		t.Fatalf("expected 3 items, got %d", len(s))
	}
	nested, ok := s[2].(map[string]interface{})
	if !ok {
		t.Fatalf("expected nested map, got %T", s[2])
	}
	if nested["k"] != "v" {
		t.Errorf("expected 'v', got '%v'", nested["k"])
	}
}

func TestNormalizeResult_EmptySlice(t *testing.T) {
	result := NormalizeResult([]interface{}{})
	s, ok := result.([]interface{})
	if !ok {
		t.Fatalf("expected []interface{}, got %T", result)
	}
	if len(s) != 0 {
		t.Errorf("expected empty slice, got %d items", len(s))
	}
}

func TestNormalizeResult_GremlinVertex(t *testing.T) {
	v := &gremlingo.Vertex{Element: gremlingo.Element{Id: int64(1), Label: "person"}}
	result := NormalizeResult(v)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}
	if m["type"] != "vertex" {
		t.Errorf("expected 'vertex', got '%v'", m["type"])
	}
	if m["id"] != "1" {
		t.Errorf("expected '1', got '%v'", m["id"])
	}
	if m["label"] != "person" {
		t.Errorf("expected 'person', got '%v'", m["label"])
	}
}

func TestNormalizeResult_GremlinEdge(t *testing.T) {
	e := &gremlingo.Edge{
		Element: gremlingo.Element{Id: int64(10), Label: "knows"},
		OutV:    gremlingo.Vertex{Element: gremlingo.Element{Id: int64(1), Label: "person"}},
		InV:     gremlingo.Vertex{Element: gremlingo.Element{Id: int64(2), Label: "person"}},
	}
	result := NormalizeResult(e)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}
	if m["type"] != "edge" {
		t.Errorf("expected 'edge', got '%v'", m["type"])
	}
	if m["label"] != "knows" {
		t.Errorf("expected 'knows', got '%v'", m["label"])
	}
	if m["outV"] != "1" {
		t.Errorf("expected outV '1', got '%v'", m["outV"])
	}
	if m["inV"] != "2" {
		t.Errorf("expected inV '2', got '%v'", m["inV"])
	}
}

func TestNormalizeResult_GremlinPath(t *testing.T) {
	p := &gremlingo.Path{
		Labels:  []gremlingo.Set{gremlingo.NewSimpleSet("a")},
		Objects: []interface{}{"hello", int64(42)},
	}
	result := NormalizeResult(p)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}
	if m["type"] != "path" {
		t.Errorf("expected 'path', got '%v'", m["type"])
	}
	objects := m["objects"].([]interface{})
	if len(objects) != 2 {
		t.Errorf("expected 2 objects, got %d", len(objects))
	}
}

func TestNormalizeResult_GremlinVertexProperty(t *testing.T) {
	vp := &gremlingo.VertexProperty{Key: "name", Value: "Alice"}
	result := NormalizeResult(vp)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}
	if m["key"] != "name" {
		t.Errorf("expected 'name', got '%v'", m["key"])
	}
	if m["value"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", m["value"])
	}
}

func TestNormalizeResult_GremlinProperty(t *testing.T) {
	p := &gremlingo.Property{Key: "weight", Value: 0.5}
	result := NormalizeResult(p)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}
	if m["key"] != "weight" {
		t.Errorf("expected 'weight', got '%v'", m["key"])
	}
	if m["value"] != 0.5 {
		t.Errorf("expected 0.5, got '%v'", m["value"])
	}
}

func TestHasDirectionKeys_StringKeys(t *testing.T) {
	tests := []struct {
		name     string
		elemMap  map[interface{}]interface{}
		expected bool
	}{
		{"Direction.IN", map[interface{}]interface{}{"Direction.IN": "x", "name": "test"}, true},
		{"Direction.OUT", map[interface{}]interface{}{"Direction.OUT": "x"}, true},
		{"IN", map[interface{}]interface{}{"IN": "x"}, true},
		{"OUT", map[interface{}]interface{}{"OUT": "x"}, true},
		{"no direction keys", map[interface{}]interface{}{"name": "Alice", "age": 30}, false},
		{"empty map", map[interface{}]interface{}{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := HasDirectionKeys(tt.elemMap); got != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, got)
			}
		})
	}
}

func TestEdgeFromElementMap_WithProperties(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:            "e1",
		TLabel:         "knows",
		"Direction.IN":  map[interface{}]interface{}{TId: "2", TLabel: "person"},
		"Direction.OUT": map[interface{}]interface{}{TId: "1", TLabel: "person"},
		"since":         2020,
	}

	e := EdgeFromElementMap(elemMap)

	if e.ID != "e1" {
		t.Errorf("expected ID 'e1', got '%s'", e.ID)
	}
	if e.Label != "knows" {
		t.Errorf("expected Label 'knows', got '%s'", e.Label)
	}
	if e.InV != "2" {
		t.Errorf("expected InV '2', got '%s'", e.InV)
	}
	if e.InVLabel != "person" {
		t.Errorf("expected InVLabel 'person', got '%s'", e.InVLabel)
	}
	if e.OutV != "1" {
		t.Errorf("expected OutV '1', got '%s'", e.OutV)
	}
	if e.OutVLabel != "person" {
		t.Errorf("expected OutVLabel 'person', got '%s'", e.OutVLabel)
	}
	if e.Properties["since"] != 2020 {
		t.Errorf("expected since 2020, got '%v'", e.Properties["since"])
	}
}

func TestEdgeFromElementMap_NoProperties(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:            "e1",
		TLabel:         "knows",
		"Direction.IN":  map[interface{}]interface{}{TId: "2", TLabel: "person"},
		"Direction.OUT": map[interface{}]interface{}{TId: "1", TLabel: "person"},
	}

	e := EdgeFromElementMap(elemMap)

	if len(e.Properties) != 0 {
		t.Errorf("expected 0 properties, got %d", len(e.Properties))
	}
}

func TestEdgeFromElementMap_FiltersReservedKeys(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:            "e1",
		TLabel:         "knows",
		"Direction.IN":  map[interface{}]interface{}{TId: "2", TLabel: "person"},
		"Direction.OUT": map[interface{}]interface{}{TId: "1", TLabel: "person"},
		"weight":        0.5,
	}

	e := EdgeFromElementMap(elemMap)

	if _, ok := e.Properties[string(TId)]; ok {
		t.Error("TId should be filtered")
	}
	if _, ok := e.Properties[string(TLabel)]; ok {
		t.Error("TLabel should be filtered")
	}
	if _, ok := e.Properties["Direction.IN"]; ok {
		t.Error("Direction.IN should be filtered")
	}
	if _, ok := e.Properties["Direction.OUT"]; ok {
		t.Error("Direction.OUT should be filtered")
	}
	if e.Properties["weight"] != 0.5 {
		t.Errorf("expected 0.5, got '%v'", e.Properties["weight"])
	}
}

func TestEdgeFromElementMap_PlainStringIdLabel(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		"id":            "e2",
		"label":         "created",
		"Direction.IN":  map[interface{}]interface{}{"id": "3", "label": "software"},
		"Direction.OUT": map[interface{}]interface{}{"id": "1", "label": "person"},
	}

	e := EdgeFromElementMap(elemMap)

	if e.ID != "e2" {
		t.Errorf("expected ID 'e2', got '%s'", e.ID)
	}
	if e.Label != "created" {
		t.Errorf("expected Label 'created', got '%s'", e.Label)
	}
}

func TestExtractMapField_DirectKey(t *testing.T) {
	m := map[interface{}]interface{}{
		gremlingo.T.Id: "direct-id",
		TId:            "fallback-id",
	}
	got := ExtractMapField(m, gremlingo.T.Id, TId)
	if got != "direct-id" {
		t.Errorf("expected 'direct-id', got '%s'", got)
	}
}

func TestExtractMapField_FallbackKey(t *testing.T) {
	m := map[interface{}]interface{}{
		TId: "fallback-id",
	}
	got := ExtractMapField(m, gremlingo.T.Id, TId)
	if got != "fallback-id" {
		t.Errorf("expected 'fallback-id', got '%s'", got)
	}
}

func TestExtractMapField_PlainKey(t *testing.T) {
	m := map[interface{}]interface{}{
		"id": "plain-id",
	}
	got := ExtractMapField(m, gremlingo.T.Id, TId)
	if got != "plain-id" {
		t.Errorf("expected 'plain-id', got '%s'", got)
	}
}

func TestExtractMapField_Missing(t *testing.T) {
	m := map[interface{}]interface{}{
		"name": "Alice",
	}
	got := ExtractMapField(m, gremlingo.T.Id, TId)
	if got != "" {
		t.Errorf("expected empty string, got '%s'", got)
	}
}

func TestExtractVertexRef_FromMap(t *testing.T) {
	ref := map[interface{}]interface{}{
		TId:    "v1",
		TLabel: "person",
	}
	id, label := ExtractVertexRef(ref)
	if id != "v1" {
		t.Errorf("expected id 'v1', got '%s'", id)
	}
	if label != "person" {
		t.Errorf("expected label 'person', got '%s'", label)
	}
}

func TestExtractVertexRef_FromGremlinVertex(t *testing.T) {
	v := &gremlingo.Vertex{Element: gremlingo.Element{Id: int64(99), Label: "software"}}
	id, label := ExtractVertexRef(v)
	if id != "99" {
		t.Errorf("expected id '99', got '%s'", id)
	}
	if label != "software" {
		t.Errorf("expected label 'software', got '%s'", label)
	}
}

func TestExtractVertexRef_UnsupportedType(t *testing.T) {
	id, label := ExtractVertexRef("not a vertex")
	if id != "" || label != "" {
		t.Errorf("expected empty strings, got id='%s' label='%s'", id, label)
	}
}

func TestPathObject_VertexMap(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:    "1",
		TLabel: "person",
		"name": "Alice",
	}

	result := PathObject(elemMap)
	v, ok := result.(domain.Vertex)
	if !ok {
		t.Fatalf("expected domain.Vertex, got %T", result)
	}
	if v.ID != "1" {
		t.Errorf("expected ID '1', got '%s'", v.ID)
	}
	if v.Label != "person" {
		t.Errorf("expected Label 'person', got '%s'", v.Label)
	}
	if v.Properties["name"] != "Alice" {
		t.Errorf("expected 'Alice', got '%v'", v.Properties["name"])
	}
}

func TestPathObject_EdgeMap(t *testing.T) {
	elemMap := map[interface{}]interface{}{
		TId:            "e1",
		TLabel:         "knows",
		"Direction.IN":  map[interface{}]interface{}{TId: "2", TLabel: "person"},
		"Direction.OUT": map[interface{}]interface{}{TId: "1", TLabel: "person"},
	}

	result := PathObject(elemMap)
	e, ok := result.(domain.Edge)
	if !ok {
		t.Fatalf("expected domain.Edge, got %T", result)
	}
	if e.ID != "e1" {
		t.Errorf("expected ID 'e1', got '%s'", e.ID)
	}
	if e.Label != "knows" {
		t.Errorf("expected Label 'knows', got '%s'", e.Label)
	}
}

func TestPathObject_GremlinVertex(t *testing.T) {
	gv := &gremlingo.Vertex{
		Element: gremlingo.Element{Id: int64(5), Label: "software"},
	}

	result := PathObject(gv)
	v, ok := result.(domain.Vertex)
	if !ok {
		t.Fatalf("expected domain.Vertex, got %T", result)
	}
	if v.ID != "5" {
		t.Errorf("expected ID '5', got '%s'", v.ID)
	}
	if v.Label != "software" {
		t.Errorf("expected Label 'software', got '%s'", v.Label)
	}
}

func TestPathObject_GremlinVertexWithProperties(t *testing.T) {
	gv := &gremlingo.Vertex{
		Element: gremlingo.Element{
			Id:    int64(5),
			Label: "software",
			Properties: map[interface{}]interface{}{
				"name": "lop",
				"lang": "java",
			},
		},
	}

	result := PathObject(gv)
	v := result.(domain.Vertex)
	if v.Properties["name"] != "lop" {
		t.Errorf("expected 'lop', got '%v'", v.Properties["name"])
	}
}

func TestPathObject_GremlinEdge(t *testing.T) {
	ge := &gremlingo.Edge{
		Element: gremlingo.Element{Id: int64(10), Label: "knows"},
		OutV:    gremlingo.Vertex{Element: gremlingo.Element{Id: int64(1), Label: "person"}},
		InV:     gremlingo.Vertex{Element: gremlingo.Element{Id: int64(2), Label: "person"}},
	}

	result := PathObject(ge)
	e, ok := result.(domain.Edge)
	if !ok {
		t.Fatalf("expected domain.Edge, got %T", result)
	}
	if e.OutV != "1" || e.InV != "2" {
		t.Errorf("expected outV=1 inV=2, got outV=%s inV=%s", e.OutV, e.InV)
	}
}

func TestPathObject_InvalidInputs(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
	}{
		{"string", "not a map"},
		{"int", 42},
		{"nil", nil},
		{"bool", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if PathObject(tt.input) != nil {
				t.Errorf("expected nil for %s input", tt.name)
			}
		})
	}
}
