package llm

import (
	"fmt"
	"regexp"
	"strings"
	"testing"
)

// The rubric is the product. It states how many categories it covers in two
// separate sentences, and the model is told to return one of them verbatim, so
// a category added in the list but not reflected in either count silently
// teaches the model the wrong contract. These tests keep the prompt internally
// consistent so the number quoted elsewhere can be trusted.

var categoryLine = regexp.MustCompile(`(?m)^(\d+)\. ([^—]+) — `)

func categories(t *testing.T) []string {
	t.Helper()
	matches := categoryLine.FindAllStringSubmatch(userPromptTemplate, -1)
	if len(matches) == 0 {
		t.Fatal("no numbered categories found in userPromptTemplate")
	}
	names := make([]string, 0, len(matches))
	for i, m := range matches {
		if want := fmt.Sprintf("%d", i+1); m[1] != want {
			t.Errorf("category %d is numbered %q; the list must be sequential", i+1, m[1])
		}
		names = append(names, strings.TrimSpace(m[2]))
	}
	return names
}

func TestPromptStatesItsOwnCategoryCount(t *testing.T) {
	n := len(categories(t))

	for _, phrase := range []string{
		fmt.Sprintf("issues in these %d categories:", n),
		fmt.Sprintf(`"one of the %d categories above"`, n),
	} {
		if !strings.Contains(userPromptTemplate, phrase) {
			t.Errorf("prompt lists %d categories but does not contain %q", n, phrase)
		}
	}
}

func TestCategoryNamesAreUniqueAndNonEmpty(t *testing.T) {
	seen := map[string]bool{}
	for _, name := range categories(t) {
		if name == "" {
			t.Error("a category has an empty name")
		}
		if seen[name] {
			t.Errorf("category %q is listed twice", name)
		}
		seen[name] = true
	}
}

// The clause that suspends a paid box for hosting content the provider forbids
// is the reason this category exists; it is not covered by the other six.
func TestProhibitedUseIsCovered(t *testing.T) {
	found := false
	for _, name := range categories(t) {
		if name == "Prohibited Use" {
			found = true
		}
	}
	if !found {
		t.Error(`the rubric no longer covers "Prohibited Use"`)
	}
	if !strings.Contains(userPromptTemplate, "suspend or terminate") {
		t.Error("Prohibited Use should name the consequence, not just the restriction")
	}
}
