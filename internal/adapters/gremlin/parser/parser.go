package parser

import (
	"fmt"
	"strings"

	"gremlin-viewer/internal/core/domain"

	gremlingo "github.com/apache/tinkerpop/gremlin-go/v3/driver"
)

type ReservedKey string

const (
	TId    ReservedKey = "T.id"
	TLabel ReservedKey = "T.label"
)

func Vertex(id, label string, elemMap map[interface{}]interface{}) domain.Vertex {
	props := make(map[string]interface{})
	for k, v := range elemMap {
		keyStr := fmt.Sprintf("%v", k)
		if keyStr == string(TId) || keyStr == string(TLabel) || keyStr == "id" || keyStr == "label" {
			continue
		}
		if k == gremlingo.T.Id || k == gremlingo.T.Label {
			continue
		}
		props[keyStr] = v
	}
	return domain.Vertex{
		ID:         id,
		Label:      label,
		Properties: props,
	}
}

func NormalizeResult(val interface{}) interface{} {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case *gremlingo.Vertex:
		return map[string]interface{}{
			"type":       "vertex",
			"id":         fmt.Sprintf("%v", v.Id),
			"label":      v.Label,
			"properties": NormalizeResult(v.Properties),
		}
	case *gremlingo.Edge:
		return map[string]interface{}{
			"type":       "edge",
			"id":         fmt.Sprintf("%v", v.Id),
			"label":      v.Label,
			"inV":        fmt.Sprintf("%v", v.InV.Id),
			"inVLabel":   v.InV.Label,
			"outV":       fmt.Sprintf("%v", v.OutV.Id),
			"outVLabel":  v.OutV.Label,
			"properties": NormalizeResult(v.Properties),
		}
	case *gremlingo.Path:
		objects := make([]interface{}, len(v.Objects))
		for i, obj := range v.Objects {
			objects[i] = NormalizeResult(obj)
		}
		labels := make([]interface{}, len(v.Labels))
		for i, l := range v.Labels {
			labels[i] = fmt.Sprintf("%v", l)
		}
		return map[string]interface{}{
			"type":    "path",
			"labels":  labels,
			"objects": objects,
		}
	case *gremlingo.VertexProperty:
		return map[string]interface{}{
			"key":   v.Key,
			"value": NormalizeResult(v.Value),
		}
	case *gremlingo.Property:
		return map[string]interface{}{
			"key":   v.Key,
			"value": NormalizeResult(v.Value),
		}
	case map[interface{}]interface{}:
		m := make(map[string]interface{}, len(v))
		for key, value := range v {
			m[fmt.Sprintf("%v", key)] = NormalizeResult(value)
		}
		return m
	case []interface{}:
		s := make([]interface{}, len(v))
		for i, item := range v {
			s[i] = NormalizeResult(item)
		}
		return s
	default:
		return val
	}
}

func PathObject(obj interface{}) interface{} {
	switch v := obj.(type) {
	case *gremlingo.Vertex:
		props := make(map[string]interface{})
		if v.Properties != nil {
			if pmap, ok := v.Properties.(map[interface{}]interface{}); ok {
				for k, val := range pmap {
					props[fmt.Sprintf("%v", k)] = val
				}
			}
		}
		return domain.Vertex{
			ID:         fmt.Sprintf("%v", v.Id),
			Label:      v.Label,
			Properties: props,
		}
	case *gremlingo.Edge:
		props := make(map[string]interface{})
		if v.Properties != nil {
			if pmap, ok := v.Properties.(map[interface{}]interface{}); ok {
				for k, val := range pmap {
					props[fmt.Sprintf("%v", k)] = val
				}
			}
		}
		return domain.Edge{
			ID:         fmt.Sprintf("%v", v.Id),
			Label:      v.Label,
			InV:        fmt.Sprintf("%v", v.InV.Id),
			InVLabel:   v.InV.Label,
			OutV:       fmt.Sprintf("%v", v.OutV.Id),
			OutVLabel:  v.OutV.Label,
			Properties: props,
		}
	case map[interface{}]interface{}:
		if HasDirectionKeys(v) {
			return EdgeFromElementMap(v)
		}
		id := ExtractMapField(v, gremlingo.T.Id, TId)
		label := ExtractMapField(v, gremlingo.T.Label, TLabel)
		return Vertex(id, label, v)
	default:
		return nil
	}
}

func ExtractMapField(m map[interface{}]interface{}, directKey interface{}, fallbackKey ReservedKey) string {
	if val, ok := m[directKey]; ok {
		return fmt.Sprintf("%v", val)
	}
	plainKey := strings.TrimPrefix(string(fallbackKey), "T.")
	for k, val := range m {
		keyStr := fmt.Sprintf("%v", k)
		if keyStr == string(fallbackKey) || keyStr == plainKey {
			return fmt.Sprintf("%v", val)
		}
	}
	return ""
}

func HasDirectionKeys(elemMap map[interface{}]interface{}) bool {
	for k := range elemMap {
		if k == gremlingo.Direction.In || k == gremlingo.Direction.Out {
			return true
		}
		keyStr := fmt.Sprintf("%v", k)
		if keyStr == "Direction.IN" || keyStr == "Direction.OUT" || keyStr == "IN" || keyStr == "OUT" {
			return true
		}
	}
	return false
}

func EdgeFromElementMap(elemMap map[interface{}]interface{}) domain.Edge {
	id := ExtractMapField(elemMap, gremlingo.T.Id, TId)
	label := ExtractMapField(elemMap, gremlingo.T.Label, TLabel)
	var inV, inVLabel, outV, outVLabel string
	props := make(map[string]interface{})

	for k, v := range elemMap {
		keyStr := fmt.Sprintf("%v", k)
		switch {
		case k == gremlingo.Direction.In || keyStr == "Direction.IN" || keyStr == "IN":
			inV, inVLabel = ExtractVertexRef(v)
		case k == gremlingo.Direction.Out || keyStr == "Direction.OUT" || keyStr == "OUT":
			outV, outVLabel = ExtractVertexRef(v)
		case k == gremlingo.T.Id || keyStr == string(TId) || keyStr == "id":
			continue
		case k == gremlingo.T.Label || keyStr == string(TLabel) || keyStr == "label":
			continue
		default:
			props[keyStr] = v
		}
	}

	return domain.Edge{
		ID: id, Label: label,
		InV: inV, InVLabel: inVLabel,
		OutV: outV, OutVLabel: outVLabel,
		Properties: props,
	}
}

func ExtractVertexRef(v interface{}) (id, label string) {
	if ref, ok := v.(*gremlingo.Vertex); ok {
		return fmt.Sprintf("%v", ref.Id), ref.Label
	}
	if ref, ok := v.(map[interface{}]interface{}); ok {
		id = ExtractMapField(ref, gremlingo.T.Id, TId)
		label = ExtractMapField(ref, gremlingo.T.Label, TLabel)
	}
	return
}
