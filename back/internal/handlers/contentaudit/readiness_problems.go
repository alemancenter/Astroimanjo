package contentaudit

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/imanjo/fiber-api/internal/contentquality"
	auditservice "github.com/imanjo/fiber-api/internal/services/contentaudit"
)

const (
	readinessProblemUnaudited              = "unaudited"
	readinessProblemPolicyBlocked          = "policy_blocked"
	readinessProblemAdsNotEligible         = "ads_not_eligible"
	readinessProblemThinContent            = "thin_content"
	readinessProblemUndocumentedAttachment = "undocumented_attachment"
	readinessProblemNeedsEnrichment        = "needs_enrichment"
	readinessProblemMetaDescription        = "meta_description"
	readinessProblemShortTitle             = "short_title"
	readinessProblemLanguageErrors         = "language_errors"
	readinessProblemExactDuplicate         = "exact_duplicate"
	readinessProblemNearDuplicate          = "near_duplicate"
	readinessProblemTemplateSimilar        = "template_similar"
	readinessProblemTitleConflict          = "title_conflict"
	readinessProblemUnpublished            = "unpublished"
)

type readinessProblemDefinition struct {
	Code          string
	Label         string
	Description   string
	Severity      string
	ActionType    string
	Preset        string
	Mode          string
	ModelStrategy string
	Priority      int
}

type readinessItemProblem struct {
	Code          string `json:"code"`
	Label         string `json:"label"`
	Message       string `json:"message"`
	Severity      string `json:"severity"`
	ActionType    string `json:"action_type"`
	Preset        string `json:"preset,omitempty"`
	Mode          string `json:"mode,omitempty"`
	ModelStrategy string `json:"model_strategy,omitempty"`
}

type readinessProblemSummary struct {
	Code          string `json:"code"`
	Label         string `json:"label"`
	Description   string `json:"description"`
	Severity      string `json:"severity"`
	ActionType    string `json:"action_type"`
	Preset        string `json:"preset,omitempty"`
	Mode          string `json:"mode,omitempty"`
	ModelStrategy string `json:"model_strategy,omitempty"`
	Count         int    `json:"count"`
	Priority      int    `json:"-"`
}

type readinessRepairCenter struct {
	AffectedItems   int                       `json:"affected_items"`
	ActionableItems int                       `json:"actionable_items"`
	ManualItems     int                       `json:"manual_items"`
	TotalFindings   int                       `json:"total_findings"`
	RecommendedCode string                    `json:"recommended_code,omitempty"`
	BatchSize       int                       `json:"batch_size"`
	Problems        []readinessProblemSummary `json:"problems"`
}

type readinessRepairCollector struct {
	counts          map[string]int
	affectedItems   int
	actionableItems int
	manualItems     int
}

var readinessProblems = map[string]readinessProblemDefinition{
	readinessProblemUnaudited: {
		Code: readinessProblemUnaudited, Label: "محتوى لم يُفحص بعد",
		Description: "تشغيل تدقيق الجودة أولًا؛ تظل الإعلانات متوقفة حتى وجود قرار محفوظ.",
		Severity:    "high", ActionType: "analyze", Preset: readinessProblemUnaudited,
		Mode: "analyze_only", ModelStrategy: "balanced", Priority: 90,
	},
	readinessProblemPolicyBlocked: {
		Code: readinessProblemPolicyBlocked, Label: "حظر فهرسة أو سياسة",
		Description: "محتوى يحتاج مراجعة نهائية لأنه مرفوض أو يحمل مخاطرة حرجة.",
		Severity:    "critical", ActionType: "full_review", Preset: readinessProblemPolicyBlocked,
		Mode: "full_review", ModelStrategy: "final_review", Priority: 100,
	},
	readinessProblemAdsNotEligible: {
		Code: readinessProblemAdsNotEligible, Label: "مفهرس وغير مؤهل للإعلانات",
		Description: "يوجد قرار تدقيق، لكن المحتوى لم يجتز بوابة أهلية الإعلانات بعد.",
		Severity:    "high", ActionType: "ai_preview", Preset: readinessProblemAdsNotEligible,
		Mode: "fix_preview", ModelStrategy: "quality", Priority: 85,
	},
	readinessProblemThinContent: {
		Code: readinessProblemThinContent, Label: "محتوى قصير جدًا",
		Description: "أقل من 120 كلمة ويحتاج إثراءً تحريريًا حقيقيًا ومعاينة بشرية.",
		Severity:    "high", ActionType: "ai_preview", Preset: readinessProblemThinContent,
		Mode: "fix_preview", ModelStrategy: "quality", Priority: 80,
	},
	readinessProblemUndocumentedAttachment: {
		Code: readinessProblemUndocumentedAttachment, Label: "مرفقات دون شرح كافٍ",
		Description: "الصفحة تحمل ملفات مرفقة لكن نصها أقل من الحد التحريري لصفحات الملفات؛ تبدو كزر تحميل مجرد بلا شرح، وهذا مرتبط بمخاطرة سياسة محتوى منخفض القيمة قرب الإعلانات وليس مجرد قصر عادي.",
		// Preset intentionally reuses the existing "short_file_pages" batch
		// preset (quality_batch_targets.go) instead of its own code, so the
		// repair-center "fix" action routes into the already-working
		// file-aware batch-selection logic rather than an unrecognized preset.
		Severity: "high", ActionType: "ai_preview", Preset: "short_file_pages",
		Mode: "fix_preview", ModelStrategy: "quality", Priority: 82,
	},
	readinessProblemNeedsEnrichment: {
		Code: readinessProblemNeedsEnrichment, Label: "محتوى يحتاج إثراء",
		Description: "بين 120 و299 كلمة؛ يحتاج بنية وشرحًا وقيمة تعليمية أعمق.",
		Severity:    "medium", ActionType: "ai_preview", Preset: readinessProblemNeedsEnrichment,
		Mode: "fix_preview", ModelStrategy: "quality", Priority: 65,
	},
	readinessProblemMetaDescription: {
		Code: readinessProblemMetaDescription, Label: "وصف تعريفي ناقص أو قصير",
		Description: "توليد وصف دقيق من مضمون الصفحة، تطبيقه على الحقل الوصفي فقط، ثم إعادة فحص الجاهزية تلقائيًا.",
		Severity:    "medium", ActionType: "auto_repair", Preset: readinessProblemMetaDescription,
		Mode: "auto_apply", ModelStrategy: "balanced", Priority: 70,
	},
	readinessProblemShortTitle: {
		Code: readinessProblemShortTitle, Label: "عنوان يحتاج مراجعة",
		Description: "العنوان أقصر من الحد التحريري الداخلي ولا يوضح غرض الصفحة جيدًا.",
		Severity:    "medium", ActionType: "ai_preview", Preset: readinessProblemShortTitle,
		Mode: "fix_preview", ModelStrategy: "balanced", Priority: 55,
	},
	readinessProblemLanguageErrors: {
		Code: readinessProblemLanguageErrors, Label: "أخطاء إملائية أو تحريرية",
		Description: "صحّح الأخطاء عالية الثقة الظاهرة في تقرير اللغة ثم أعد فحص أهلية الإعلانات.",
		Severity:    "high", ActionType: "manual", Priority: 83,
	},
	readinessProblemExactDuplicate: {
		Code: readinessProblemExactDuplicate, Label: "محتوى مطابق لمحتوى آخر",
		Description: "يوجد محتوى مطابق أو شبه مطابق؛ راجع الفرق والقيمة الأصلية قبل إبقاء الصفحتين مفهرستين.",
		Severity:    "high", ActionType: "manual", Priority: 84,
	},
	readinessProblemNearDuplicate: {
		Code: readinessProblemNearDuplicate, Label: "شبه تكرار",
		Description: "يوجد تشابه قريب مع محتوى آخر؛ أضف قيمة أصلية أو ادمج الصفحتين بعد مراجعة بشرية.",
		Severity:    "medium", ActionType: "manual", Priority: 62,
	},
	readinessProblemTemplateSimilar: {
		Code: readinessProblemTemplateSimilar, Label: "قالب متكرر",
		Description: "تستخدم الصفحة قالبًا متشابهًا مع صفحات أخرى؛ راجع ما إذا كانت تضيف قيمة مستقلة.",
		Severity:    "medium", ActionType: "manual", Priority: 60,
	},
	readinessProblemTitleConflict: {
		Code: readinessProblemTitleConflict, Label: "تعارض محتمل في العنوان",
		Description: "العنوان مكرر في مخزون المحتوى. راجع الصف أو المادة أو الفصل يدويًا قبل إبقاء الصفحات متنافستين.",
		Severity:    "medium", ActionType: "manual", Priority: 58,
	},
	readinessProblemUnpublished: {
		Code: readinessProblemUnpublished, Label: "غير منشور أو غير فعال",
		Description: "راجع حالة النشر يدويًا؛ المحتوى غير المنشور لا يدخل مسار الإعلانات.",
		Severity:    "low", ActionType: "manual", Priority: 10,
	},
}

func readinessProblemCatalog() map[string]readinessProblemDefinition { return readinessProblems }

func newReadinessRepairCollector() *readinessRepairCollector {
	return &readinessRepairCollector{counts: make(map[string]int)}
}

func classifyReadinessProblems(title, meta string, diagnostics contentquality.Diagnostics, language contentquality.LanguageCheckResult, published bool, gate auditservice.ContentQualityGate, similarity ...inventorySimilaritySignal) []readinessItemProblem {
	catalog := readinessProblemCatalog()
	codes := make([]string, 0, 7)
	messages := make(map[string]string, 7)
	add := func(code, message string) {
		for _, existing := range codes {
			if existing == code {
				return
			}
		}
		codes = append(codes, code)
		messages[code] = message
	}

	if !gate.Audited {
		add(readinessProblemUnaudited, "لم يخضع المحتوى لتدقيق الجودة؛ ابدأ بالتحليل قبل إنشاء أي إصلاح.")
	} else if !gate.Indexable {
		add(readinessProblemPolicyBlocked, "بوابة الجودة تمنع الفهرسة والإعلانات حتى معالجة سبب الرفض أو المخاطرة الحرجة.")
	}

	// Files attached (FilesCount > 0) get their own, wider threshold
	// (DiagnosticShortFileMaxWords) instead of the generic thin_content bar —
	// matching the existing short_file_pages batch preset in
	// quality_batch_targets.go, which already treats file-bearing pages as a
	// distinct category. Checked first so a 150-word file page is never
	// mislabeled as generic "needs_enrichment".
	if diagnostics.FilesCount > 0 && diagnostics.WordCount < contentquality.DiagnosticShortFileMaxWords {
		add(readinessProblemUndocumentedAttachment, "الصفحة تحمل ملفات مرفقة لكن نصها أقل من الحد التحريري لصفحات الملفات؛ تحتاج شرحًا حقيقيًا لمحتوى الملف وليس مجرد زر تحميل.")
	} else if diagnostics.WordCount < contentquality.DiagnosticReviewMinWords {
		add(readinessProblemThinContent, "المحتوى يحتوي على أقل من 120 كلمة ويحتاج مراجعة وإثراءً حقيقيًا.")
	} else if diagnostics.WordCount < contentquality.DiagnosticStrongMinWords {
		add(readinessProblemNeedsEnrichment, "عمق المحتوى متوسط؛ راجع الشرح والبنية والفائدة التعليمية قبل الاعتماد.")
	}
	if utf8.RuneCountInString(strings.TrimSpace(meta)) < contentquality.DiagnosticMetaMinChars {
		add(readinessProblemMetaDescription, "الوصف التعريفي مفقود أو أقصر من 80 حرفًا.")
	}
	if utf8.RuneCountInString(strings.TrimSpace(title)) < contentquality.DiagnosticTitleMinChars {
		add(readinessProblemShortTitle, "العنوان قصير ولا يوضح موضوع الصفحة بالقدر الكافي.")
	}
	if language.Blocking {
		message := fmt.Sprintf("اكتشف المدقق %d خطأً عالي الثقة. التصحيح مطلوب لأهلية الإعلانات ولا يمنع حفظ المحتوى أو نشره.", language.ErrorCount)
		if len(language.Findings) > 0 {
			message += " " + language.Findings[0].Message
		}
		add(readinessProblemLanguageErrors, message)
	}
	if len(similarity) > 0 {
		switch similarity[0].Kind {
		case contentquality.SimilarityKindExact:
			add(readinessProblemExactDuplicate, fmt.Sprintf("مطابقة كاملة مع محتوى آخر (درجة المطابقة %.0f%%)؛ المراجعة اليدوية مطلوبة قبل إبقاء النسختين.", similarity[0].Similarity*100))
		case contentquality.SimilarityKindNear:
			add(readinessProblemNearDuplicate, fmt.Sprintf("شبه تكرار مع محتوى آخر بدرجة %.0f%%؛ أضف قيمة أصلية أو راجع الدمج.", similarity[0].Similarity*100))
		case contentquality.SimilarityKindTemplate:
			add(readinessProblemTemplateSimilar, fmt.Sprintf("تشابه قالبي مع محتوى آخر بدرجة %.0f%%؛ راجع القيمة الخاصة بهذه الصفحة.", similarity[0].Similarity*100))
		}
		if similarity[0].TitleConflict {
			add(readinessProblemTitleConflict, fmt.Sprintf("العنوان مكرر في %d صفحات على الأقل؛ تحقق من الصف والمادة والفصل قبل اتخاذ قرار فهرسة أو دمج.", similarity[0].TitleConflictCount))
		}
	}
	if !published {
		add(readinessProblemUnpublished, "العنصر غير منشور أو غير فعال، لذلك لا يمكن فهرسته أو عرض الإعلانات عليه.")
	}
	if gate.Audited && gate.Indexable && !gate.AdsEligible &&
		!hasProblemCode(codes, readinessProblemThinContent) &&
		!hasProblemCode(codes, readinessProblemUndocumentedAttachment) &&
		!hasProblemCode(codes, readinessProblemNeedsEnrichment) &&
		!hasProblemCode(codes, readinessProblemMetaDescription) &&
		!hasProblemCode(codes, readinessProblemLanguageErrors) &&
		!hasProblemCode(codes, readinessProblemShortTitle) {
		add(readinessProblemAdsNotEligible, "المحتوى مفهرس لكنه لم يستوفِ شروط الاعتماد الداخلية لعرض الإعلانات.")
	}

	problems := make([]readinessItemProblem, 0, len(codes))
	for _, code := range codes {
		definition := catalog[code]
		problems = append(problems, readinessItemProblem{
			Code: code, Label: definition.Label, Message: messages[code], Severity: definition.Severity,
			ActionType: definition.ActionType, Preset: definition.Preset, Mode: definition.Mode,
			ModelStrategy: definition.ModelStrategy,
		})
	}
	sort.SliceStable(problems, func(i, j int) bool {
		return catalog[problems[i].Code].Priority > catalog[problems[j].Code].Priority
	})
	return problems
}

func hasProblemCode(codes []string, code string) bool {
	for _, existing := range codes {
		if existing == code {
			return true
		}
	}
	return false
}

func (c *readinessRepairCollector) Add(item unifiedReadinessItem) {
	if c == nil || len(item.Problems) == 0 {
		return
	}
	c.affectedItems++
	actionable := false
	manual := false
	for _, problem := range item.Problems {
		c.counts[problem.Code]++
		if problem.ActionType == "manual" {
			manual = true
		} else {
			actionable = true
		}
	}
	if actionable {
		c.actionableItems++
	}
	if manual {
		c.manualItems++
	}
}

func (c *readinessRepairCollector) Build() readinessRepairCenter {
	result := readinessRepairCenter{BatchSize: 20, Problems: make([]readinessProblemSummary, 0)}
	if c == nil {
		return result
	}
	result.AffectedItems = c.affectedItems
	result.ActionableItems = c.actionableItems
	result.ManualItems = c.manualItems
	catalog := readinessProblemCatalog()
	for code, count := range c.counts {
		definition, ok := catalog[code]
		if !ok || count <= 0 {
			continue
		}
		result.TotalFindings += count
		result.Problems = append(result.Problems, readinessProblemSummary{
			Code: definition.Code, Label: definition.Label, Description: definition.Description,
			Severity: definition.Severity, ActionType: definition.ActionType, Preset: definition.Preset,
			Mode: definition.Mode, ModelStrategy: definition.ModelStrategy, Count: count, Priority: definition.Priority,
		})
	}
	sort.SliceStable(result.Problems, func(i, j int) bool {
		if result.Problems[i].Priority == result.Problems[j].Priority {
			return result.Problems[i].Count > result.Problems[j].Count
		}
		return result.Problems[i].Priority > result.Problems[j].Priority
	})
	for _, problem := range result.Problems {
		if problem.ActionType != "manual" {
			result.RecommendedCode = problem.Code
			break
		}
	}
	return result
}

func hasReadinessProblem(item unifiedReadinessItem, code string) bool {
	if strings.TrimSpace(code) == "" {
		return true
	}
	for _, problem := range item.Problems {
		if problem.Code == code {
			return true
		}
	}
	return false
}
