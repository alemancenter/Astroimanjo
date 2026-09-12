package contentquality

import (
	"testing"
	"time"

	"github.com/imanjo/fiber-api/internal/models"
)

func TestLanguageHistoryRowRoundTrip(t *testing.T) {
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	result := CheckArabicLanguage("طريقه انشاء الدرس", "انتقل الى الصفحه.")
	result.CheckedAt = &now

	row, err := languageRowFromResult("article", "jo", 42, result, now)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := languageResultFromRow(row)
	if err != nil {
		t.Fatal(err)
	}
	if restored.ContentFingerprint != result.ContentFingerprint ||
		restored.EngineVersion != result.EngineVersion ||
		restored.ErrorCount != result.ErrorCount ||
		len(restored.Findings) != len(result.Findings) {
		t.Fatalf("round trip changed result: before=%+v after=%+v", result, restored)
	}
}

func TestLanguageHistoryRejectsCorruptFindingsJSON(t *testing.T) {
	_, err := languageResultFromRow(models.ContentLanguageCheck{FindingsJSON: "not-json"})
	if err == nil {
		t.Fatal("expected corrupt findings JSON to be rejected and rechecked")
	}
}

func TestLanguageHistoryRetentionKeepsNewestPerContent(t *testing.T) {
	rows := make([]models.ContentLanguageCheck, 0)
	for contentID := uint(1); contentID <= 2; contentID++ {
		for id := uint(1); id <= 4; id++ {
			rows = append(rows, models.ContentLanguageCheck{ID: contentID*10 + id, ContentID: contentID})
		}
	}
	got := languageHistoryIDsToDelete(rows, 2)
	want := []uint{13, 14, 23, 24}
	if len(got) != len(want) {
		t.Fatalf("delete IDs = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("delete IDs = %v, want %v", got, want)
		}
	}
}
