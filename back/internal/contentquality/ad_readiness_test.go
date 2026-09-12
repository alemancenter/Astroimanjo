package contentquality

import (
	"strings"
	"testing"
)

func TestApplyAdReadinessRequirementsOnlyRevokesAds(t *testing.T) {
	base := Gate{Audited: true, Indexable: true, AdsEligible: true, Decision: "approved", Risk: "low", Score: 95, Reasons: []string{"المحتوى مؤهل للإعلانات."}}
	guarded := ApplyAdReadinessRequirements(base, "عنوان قصير", "نص قصير", "")

	if guarded.AdsEligible {
		t.Fatal("incomplete current metadata/content must revoke ad eligibility")
	}
	if !guarded.Indexable {
		t.Fatal("editorial ad requirements must not change indexing")
	}
	if guarded.Decision != base.Decision || guarded.Score != base.Score || guarded.Risk != base.Risk {
		t.Fatalf("guard changed the persisted audit result: %#v", guarded)
	}
}

func TestApplyAdReadinessRequirementsNeverGrantsAds(t *testing.T) {
	base := Unaudited()
	guarded := ApplyAdReadinessRequirements(base, strings.Repeat("عنوان ", 10), strings.Repeat("محتوى ", 350), strings.Repeat("و", 90))
	if guarded.AdsEligible {
		t.Fatal("current-page requirements must never grant eligibility")
	}
}

func TestApplyAdReadinessRequirementsKeepsCompleteApproval(t *testing.T) {
	base := Gate{Audited: true, Indexable: true, AdsEligible: true, Decision: "approved", Risk: "low", Score: 95}
	guarded := ApplyAdReadinessRequirements(base, "عنوان تعليمي واضح وطويل بما يكفي", strings.Repeat("محتوى ", 350), strings.Repeat("و", 90))
	if !guarded.AdsEligible {
		t.Fatalf("complete approved page should remain eligible: %#v", guarded.Reasons)
	}
}

func TestApplyAdReadinessRequirementsRevokesAdsForLanguageErrorsOnly(t *testing.T) {
	base := Gate{Indexable: true, AdsEligible: true, Audited: true, Reasons: []string{"المحتوى مؤهل للإعلانات."}}
	guarded := ApplyAdReadinessRequirements(
		base,
		"طريقه انشاء درس تعليمي واضح ومتكامل",
		strings.Repeat("هذا محتوى تعليمي مفيد يشرح الموضوع بصورة واضحة. ", 70),
		strings.Repeat("وصف تعريفي واضح ودقيق للمحتوى التعليمي المنشور في هذه الصفحة. ", 2),
	)
	if guarded.AdsEligible {
		t.Fatal("language findings must revoke ad eligibility")
	}
	if !guarded.Indexable {
		t.Fatal("language findings must not change indexing")
	}
	if !guarded.Audited {
		t.Fatal("language findings must not change the saved audit state")
	}
}

func TestApplyAdReadinessRequirementsRejectsMissingOrStaleLanguageResult(t *testing.T) {
	title := "عنوان تعليمي واضح وطويل بما يكفي"
	content := strings.Repeat("محتوى تعليمي واضح ومفيد للطالب. ", 80)
	meta := strings.Repeat("وصف تعريفي واضح ودقيق. ", 4)
	base := Gate{Indexable: true, AdsEligible: true, Audited: true}

	for name, language := range map[string]LanguageCheckResult{
		"missing": {},
		"old_engine": {
			Checked: true, EngineVersion: "arabic-v0",
			ContentFingerprint: LanguageFingerprint(title, content),
		},
		"stale_fingerprint": {
			Checked: true, EngineVersion: LanguageCheckEngineVersion,
			ContentFingerprint: LanguageFingerprint(title, content+" تغير"),
		},
	} {
		t.Run(name, func(t *testing.T) {
			guarded := ApplyAdReadinessRequirementsWithLanguage(base, title, content, meta, language)
			if guarded.AdsEligible {
				t.Fatal("missing or stale language result must revoke ad eligibility")
			}
			if !guarded.Indexable {
				t.Fatal("language history state must not change indexing")
			}
		})
	}
}
