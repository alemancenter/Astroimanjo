package contentquality

import (
	"crypto/sha256"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	xhtml "golang.org/x/net/html"
	"golang.org/x/text/unicode/norm"
)

const (
	MaxLanguageFindings        = 25
	LanguageCheckEngineVersion = "arabic-v1"
)

type LanguageFinding struct {
	Field      string `json:"field"`
	Offset     int    `json:"offset"`
	Length     int    `json:"length"`
	Token      string `json:"token"`
	Suggestion string `json:"suggestion,omitempty"`
	Rule       string `json:"rule"`
	Message    string `json:"message"`
}

type LanguageCheckResult struct {
	Language           string            `json:"language"`
	Checked            bool              `json:"checked"`
	ErrorCount         int               `json:"error_count"`
	Blocking           bool              `json:"blocking"`
	EngineVersion      string            `json:"engine_version"`
	ContentFingerprint string            `json:"content_fingerprint"`
	CheckedAt          *time.Time        `json:"checked_at,omitempty"`
	Findings           []LanguageFinding `json:"findings"`
}

var (
	arabicTokenRE        = regexp.MustCompile(`[\p{Arabic}]+`)
	spaceBeforePunctRE   = regexp.MustCompile(`\s+[،؛؟!,:.]`)
	missingAfterPunctRE  = regexp.MustCompile(`[،؛؟!,:][\p{Arabic}]`)
	repeatedPunctRE      = regexp.MustCompile(`[،؛؟!]{2,}`)
	tatweelRE            = regexp.MustCompile(`ـ+`)
	languageWhitespaceRE = regexp.MustCompile(`\s+`)
)

var languageBlockElements = map[string]bool{
	"address": true, "article": true, "aside": true, "blockquote": true,
	"br": true, "div": true, "dl": true, "fieldset": true, "figcaption": true,
	"figure": true, "footer": true, "form": true, "h1": true, "h2": true,
	"h3": true, "h4": true, "h5": true, "h6": true, "header": true,
	"hr": true, "li": true, "main": true, "nav": true, "ol": true,
	"p": true, "pre": true, "section": true, "table": true, "td": true,
	"th": true, "tr": true, "ul": true,
}

var commonArabicMisspellings = map[string]string{
	"الى":    "إلى",
	"انشاء":  "إنشاء",
	"هاذا":   "هذا",
	"هاذه":   "هذه",
	"اللذي":  "الذي",
	"اللتي":  "التي",
	"الذى":   "الذي",
	"لاكن":   "لكن",
	"مسؤل":   "مسؤول",
	"مساله":  "مسألة",
	"مسأله":  "مسألة",
	"شئ":     "شيء",
	"قراءه":  "قراءة",
	"بيئه":   "بيئة",
	"منشأه":  "منشأة",
	"مشكله":  "مشكلة",
	"طريقه":  "طريقة",
	"مدرسه":  "مدرسة",
	"اللغه":  "اللغة",
	"الصفحه": "الصفحة",
}

// CheckArabicLanguage performs a deliberately conservative, deterministic
// Arabic spelling and typography pass. It reports only high-confidence rules;
// it does not attempt grammar correction or silently rewrite user content.
func CheckArabicLanguage(title, plainText string) LanguageCheckResult {
	title = normalizeLanguageWhitespace(title)
	plainText = normalizeLanguageWhitespace(plainText)
	result := LanguageCheckResult{
		Language:           "ar",
		EngineVersion:      LanguageCheckEngineVersion,
		ContentFingerprint: LanguageFingerprint(title, plainText),
		Findings:           make([]LanguageFinding, 0),
	}
	checkLanguageField(&result, "title", title)
	checkLanguageField(&result, "content", plainText)
	result.Checked = containsArabic(title) || containsArabic(plainText)
	result.Blocking = result.ErrorCount > 0
	return result
}

// PlainTextFromHTML is the canonical normalization used for both language
// fingerprints and checks. A formatting-only HTML change therefore does not
// create a new historical language-check version.
func PlainTextFromHTML(value string) string {
	tokenizer := xhtml.NewTokenizer(strings.NewReader(value))
	var text strings.Builder
	skipDepth := 0
	for {
		tokenType := tokenizer.Next()
		switch tokenType {
		case xhtml.ErrorToken:
			return normalizeLanguageWhitespace(text.String())
		case xhtml.StartTagToken:
			token := tokenizer.Token()
			name := strings.ToLower(token.Data)
			if skipDepth > 0 {
				skipDepth++
				continue
			}
			if name == "script" || name == "style" {
				skipDepth = 1
				continue
			}
			if languageBlockElements[name] {
				text.WriteByte(' ')
			}
		case xhtml.EndTagToken:
			token := tokenizer.Token()
			name := strings.ToLower(token.Data)
			if skipDepth > 0 {
				skipDepth--
				continue
			}
			if languageBlockElements[name] {
				text.WriteByte(' ')
			}
		case xhtml.SelfClosingTagToken:
			token := tokenizer.Token()
			if languageBlockElements[strings.ToLower(token.Data)] {
				text.WriteByte(' ')
			}
		case xhtml.TextToken:
			if skipDepth == 0 {
				text.WriteString(tokenizer.Token().Data)
			}
		}
	}
}

func LanguageFingerprint(title, plainText string) string {
	normalized := normalizeLanguageWhitespace(title) + "\x00" + normalizeLanguageWhitespace(plainText)
	return fmt.Sprintf("%x", sha256.Sum256([]byte(normalized)))
}

func normalizeLanguageWhitespace(value string) string {
	value = norm.NFC.String(value)
	return strings.TrimSpace(languageWhitespaceRE.ReplaceAllString(value, " "))
}

func checkLanguageField(result *LanguageCheckResult, field, value string) {
	if result == nil || strings.TrimSpace(value) == "" {
		return
	}
	for _, match := range arabicTokenRE.FindAllStringIndex(value, -1) {
		token := value[match[0]:match[1]]
		suggestion, ok := commonArabicMisspellings[normalizeArabicToken(token)]
		if !ok {
			continue
		}
		addLanguageFinding(result, LanguageFinding{
			Field: field, Offset: match[0], Length: match[1] - match[0],
			Token: token, Suggestion: suggestion, Rule: "common_misspelling",
			Message: fmt.Sprintf("استبدل «%s» بـ«%s».", token, suggestion),
		})
	}
	addPatternFindings(result, field, value, spaceBeforePunctRE, "space_before_punctuation", "احذف المسافة التي تسبق علامة الترقيم.")
	addPatternFindings(result, field, value, missingAfterPunctRE, "missing_space_after_punctuation", "أضف مسافة بعد علامة الترقيم.")
	addPatternFindings(result, field, value, repeatedPunctRE, "repeated_punctuation", "استخدم علامة ترقيم واحدة.")
	addPatternFindings(result, field, value, tatweelRE, "tatweel", "احذف التطويل الزخرفي من النص التحريري.")
}

func addPatternFindings(result *LanguageCheckResult, field, value string, pattern *regexp.Regexp, rule, message string) {
	for _, match := range pattern.FindAllStringIndex(value, -1) {
		addLanguageFinding(result, LanguageFinding{
			Field: field, Offset: match[0], Length: match[1] - match[0],
			Token: value[match[0]:match[1]], Rule: rule, Message: message,
		})
	}
}

func addLanguageFinding(result *LanguageCheckResult, finding LanguageFinding) {
	result.ErrorCount++
	if len(result.Findings) < MaxLanguageFindings {
		result.Findings = append(result.Findings, finding)
	}
}

func containsArabic(value string) bool {
	for _, r := range value {
		if unicode.In(r, unicode.Arabic) {
			return true
		}
	}
	return false
}

func normalizeArabicToken(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.Is(unicode.Mn, r) || r == 'ـ' {
			return -1
		}
		return unicode.ToLower(r)
	}, value)
}
