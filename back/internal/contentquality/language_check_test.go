package contentquality

import (
	"strings"
	"testing"
)

func TestCheckArabicLanguageFindsHighConfidenceIssues(t *testing.T) {
	result := CheckArabicLanguage(
		"طريقه انشاء الدرس",
		"انتقل الى الصفحه ،ثم اقرأ النص!!",
	)
	if !result.Checked || !result.Blocking {
		t.Fatalf("expected checked blocking result, got %+v", result)
	}
	if result.ErrorCount < 6 {
		t.Fatalf("expected spelling and punctuation findings, got %+v", result.Findings)
	}
	assertSuggestion(t, result, "انشاء", "إنشاء")
	assertSuggestion(t, result, "الى", "إلى")
	assertSuggestion(t, result, "الصفحه", "الصفحة")
}

func TestCheckArabicLanguageKeepsCleanArabicEligible(t *testing.T) {
	result := CheckArabicLanguage(
		"طريقة إنشاء الدرس بصورة صحيحة",
		"انتقل إلى الصفحة، ثم اقرأ النص بعناية.",
	)
	if !result.Checked {
		t.Fatal("expected Arabic text to be checked")
	}
	if result.Blocking || result.ErrorCount != 0 || len(result.Findings) != 0 {
		t.Fatalf("expected clean result, got %+v", result)
	}
}

func TestCheckArabicLanguageCapsReturnedFindingsButCountsAll(t *testing.T) {
	result := CheckArabicLanguage("", strings.Repeat("الى ", MaxLanguageFindings+5))
	if result.ErrorCount != MaxLanguageFindings+5 {
		t.Fatalf("expected all findings counted, got %d", result.ErrorCount)
	}
	if len(result.Findings) != MaxLanguageFindings {
		t.Fatalf("expected capped findings, got %d", len(result.Findings))
	}
}

func assertSuggestion(t *testing.T, result LanguageCheckResult, token, suggestion string) {
	t.Helper()
	for _, finding := range result.Findings {
		if finding.Token == token && finding.Suggestion == suggestion {
			return
		}
	}
	t.Fatalf("missing suggestion %q -> %q in %+v", token, suggestion, result.Findings)
}
