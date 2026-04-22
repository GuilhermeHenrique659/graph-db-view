package domain

import "testing"

func TestNewVertex(t *testing.T) {
	props := map[string]interface{}{
		"name": "Alice",
		"age":  30,
	}

	v := Vertex{
		ID:         "1",
		Label:      "person",
		Properties: props,
	}

	if v.ID != "1" {
		t.Errorf("expected ID '1', got '%s'", v.ID)
	}
	if v.Label != "person" {
		t.Errorf("expected Label 'person', got '%s'", v.Label)
	}
	if v.Properties["name"] != "Alice" {
		t.Errorf("expected property name 'Alice', got '%v'", v.Properties["name"])
	}
	if v.Properties["age"] != 30 {
		t.Errorf("expected property age 30, got '%v'", v.Properties["age"])
	}
}

func TestVertexPropertyKeys(t *testing.T) {
	v := Vertex{
		ID:    "1",
		Label: "person",
		Properties: map[string]interface{}{
			"name": "Alice",
			"age":  30,
			"city": "São Paulo",
		},
	}

	keys := v.PropertyKeys()
	if len(keys) != 3 {
		t.Errorf("expected 3 property keys, got %d", len(keys))
	}

	expected := map[string]bool{"name": true, "age": true, "city": true}
	for _, k := range keys {
		if !expected[k] {
			t.Errorf("unexpected property key: %s", k)
		}
	}
}

func TestVertexEmptyProperties(t *testing.T) {
	v := Vertex{
		ID:         "1",
		Label:      "person",
		Properties: map[string]interface{}{},
	}

	keys := v.PropertyKeys()
	if len(keys) != 0 {
		t.Errorf("expected 0 property keys, got %d", len(keys))
	}
}

func TestNewEdge(t *testing.T) {
	e := Edge{
		ID:       "e1",
		Label:    "knows",
		InV:      "2",
		InVLabel: "person",
		OutV:     "1",
		OutVLabel: "person",
		Properties: map[string]interface{}{
			"since": 2020,
		},
	}

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
		t.Errorf("expected property since 2020, got '%v'", e.Properties["since"])
	}
}

func TestEdgePropertyKeys(t *testing.T) {
	e := Edge{
		ID:    "e1",
		Label: "knows",
		Properties: map[string]interface{}{
			"since":  2020,
			"weight": 0.8,
		},
	}

	keys := e.PropertyKeys()
	if len(keys) != 2 {
		t.Errorf("expected 2 property keys, got %d", len(keys))
	}

	expected := map[string]bool{"since": true, "weight": true}
	for _, k := range keys {
		if !expected[k] {
			t.Errorf("unexpected property key: %s", k)
		}
	}
}

func TestEdgeEmptyProperties(t *testing.T) {
	e := Edge{
		ID:         "e1",
		Label:      "knows",
		Properties: map[string]interface{}{},
	}

	keys := e.PropertyKeys()
	if len(keys) != 0 {
		t.Errorf("expected 0 property keys, got %d", len(keys))
	}
}

func TestNewGraphPath(t *testing.T) {
	v1 := Vertex{ID: "1", Label: "person", Properties: map[string]interface{}{"name": "Alice"}}
	e := Edge{ID: "e1", Label: "knows", InV: "2", OutV: "1"}
	v2 := Vertex{ID: "2", Label: "person", Properties: map[string]interface{}{"name": "Bob"}}

	p := GraphPath{Objects: []interface{}{v1, e, v2}}

	if len(p.Objects) != 3 {
		t.Fatalf("expected 3 objects, got %d", len(p.Objects))
	}
	if _, ok := p.Objects[0].(Vertex); !ok {
		t.Errorf("expected first object to be Vertex, got %T", p.Objects[0])
	}
	if _, ok := p.Objects[1].(Edge); !ok {
		t.Errorf("expected second object to be Edge, got %T", p.Objects[1])
	}
	if _, ok := p.Objects[2].(Vertex); !ok {
		t.Errorf("expected third object to be Vertex, got %T", p.Objects[2])
	}
}

func TestNewGraphData(t *testing.T) {
	gd := GraphData{
		Vertices: []Vertex{
			{ID: "1", Label: "person"},
			{ID: "2", Label: "person"},
		},
		Edges: []Edge{
			{ID: "e1", Label: "knows", OutV: "1", InV: "2"},
		},
	}

	if len(gd.Vertices) != 2 {
		t.Errorf("expected 2 vertices, got %d", len(gd.Vertices))
	}
	if len(gd.Edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(gd.Edges))
	}
}

func TestGraphDataEmpty(t *testing.T) {
	gd := GraphData{}

	if gd.Vertices != nil {
		t.Errorf("expected nil Vertices, got %v", gd.Vertices)
	}
	if gd.Edges != nil {
		t.Errorf("expected nil Edges, got %v", gd.Edges)
	}
}
