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

func TestLanguageFingerprintIgnoresFormattingOnlyHTMLChanges(t *testing.T) {
	first := PlainTextFromHTML("<p>هذا نص <strong>تعليمي</strong>.</p>")
	second := PlainTextFromHTML("<div>هذا نص <b>تعليمي</b>.</div>")
	if first != second {
		t.Fatalf("normalized text differs: %q != %q", first, second)
	}
	if LanguageFingerprint("عنوان", first) != LanguageFingerprint("عنوان", second) {
		t.Fatal("formatting-only HTML changes must not create a new fingerprint")
	}
}

func TestPlainTextFromHTMLPreservesInlineArabicWord(t *testing.T) {
	got := PlainTextFromHTML("<p>هذه م<em>در</em>سة مفيدة.</p><script>الى</script>")
	if got != "هذه مدرسة مفيدة." {
		t.Fatalf("plain text = %q", got)
	}
}

func TestLanguageFingerprintNormalizesEquivalentUnicode(t *testing.T) {
	composed := LanguageFingerprint("عنوان", "\u0623")
	decomposed := LanguageFingerprint("عنوان", "\u0627\u0654")
	if composed != decomposed {
		t.Fatal("canonically equivalent Unicode must share a fingerprint")
	}
}

func TestLanguageFingerprintChangesWithVisibleText(t *testing.T) {
	first := LanguageFingerprint("عنوان", PlainTextFromHTML("<p>النص الأول</p>"))
	second := LanguageFingerprint("عنوان", PlainTextFromHTML("<p>النص الثاني</p>"))
	if first == second {
		t.Fatal("visible text changes must create a new fingerprint")
	}
}

func TestCheckArabicLanguageIncludesEngineAndFingerprint(t *testing.T) {
	result := CheckArabicLanguage("عنوان", "محتوى")
	if result.EngineVersion != LanguageCheckEngineVersion {
		t.Fatalf("engine version = %q", result.EngineVersion)
	}
	if len(result.ContentFingerprint) != 64 {
		t.Fatalf("fingerprint length = %d, want 64", len(result.ContentFingerprint))
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
