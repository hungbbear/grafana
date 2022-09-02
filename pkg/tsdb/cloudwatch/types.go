package cloudwatch

import (
	"fmt"
)

type queryError struct {
	err   error
	RefID string
}

func (e *queryError) Error() string {
	return fmt.Sprintf("error parsing query %q, %s", e.RefID, e.err)
}

type cloudWatchLink struct {
	View    string        `json:"view"`
	Stacked bool          `json:"stacked"`
	Title   string        `json:"title"`
	Start   string        `json:"start"`
	End     string        `json:"end"`
	Region  string        `json:"region"`
	Metrics []interface{} `json:"metrics"`
}

type metricExpression struct {
	Expression string `json:"expression"`
	Label      string `json:"label,omitempty"`
}

type metricStatMeta struct {
	Stat   string `json:"stat"`
	Period int    `json:"period"`
	Label  string `json:"label,omitempty"`
}

type metricQueryType uint32

const (
	MetricQueryTypeSearch metricQueryType = iota
	MetricQueryTypeQuery
)

func (queryType metricQueryType) String() string {
	switch queryType {
	case MetricQueryTypeSearch:
		return "search"
	case MetricQueryTypeQuery:
		return "query"
	}

	return ""
}

type metricEditorMode uint32

const (
	MetricEditorModeBuilder metricEditorMode = iota
	MetricEditorModeRaw
)

func (editorMode metricEditorMode) String() string {
	switch editorMode {
	case MetricEditorModeBuilder:
		return "builder"
	case MetricEditorModeRaw:
		return "code"
	}

	return ""
}

type gmdApiMode uint32

const (
	GMDApiModeMetricStat gmdApiMode = iota
	GMDApiModeInferredSearchExpression
	GMDApiModeMathExpression
	GMDApiModeSQLExpression
)
