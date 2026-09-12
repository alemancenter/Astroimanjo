package contentquality

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/imanjo/fiber-api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LanguageCheckInput struct {
	ContentID uint
	Title     string
	Content   string
}

const MaxLanguageHistoryVersions = 20

// ResolveLanguageChecks loads matching historical results in one query,
// evaluates only missing/changed versions, then persists all new versions in
// one batch. Callers never need a query per content item.
func ResolveLanguageChecks(ctx context.Context, db *gorm.DB, contentType, countryCode string, inputs []LanguageCheckInput) (map[uint]LanguageCheckResult, error) {
	results := make(map[uint]LanguageCheckResult, len(inputs))
	if len(inputs) == 0 {
		return results, nil
	}
	if db == nil {
		return nil, fmt.Errorf("language check database is nil")
	}

	contentType = strings.ToLower(strings.TrimSpace(contentType))
	countryCode = strings.ToLower(strings.TrimSpace(countryCode))
	ids := make([]uint, 0, len(inputs))
	fingerprints := make(map[uint]string, len(inputs))
	plainTexts := make(map[uint]string, len(inputs))
	for _, input := range inputs {
		plainText := PlainTextFromHTML(input.Content)
		ids = append(ids, input.ContentID)
		plainTexts[input.ContentID] = plainText
		fingerprints[input.ContentID] = LanguageFingerprint(input.Title, plainText)
	}

	var rows []models.ContentLanguageCheck
	currentFingerprints := make([]string, 0, len(fingerprints))
	for _, fingerprint := range fingerprints {
		currentFingerprints = append(currentFingerprints, fingerprint)
	}
	if err := db.WithContext(ctx).
		Where("content_type = ? AND country_code = ? AND engine_version = ? AND content_id IN ? AND content_fingerprint IN ?", contentType, countryCode, LanguageCheckEngineVersion, ids, currentFingerprints).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		if fingerprints[row.ContentID] != row.ContentFingerprint {
			continue
		}
		result, err := languageResultFromRow(row)
		if err != nil {
			continue
		}
		results[row.ContentID] = result
	}

	now := time.Now().UTC()
	newRows := make([]models.ContentLanguageCheck, 0)
	for _, input := range inputs {
		if _, found := results[input.ContentID]; found {
			continue
		}
		result := CheckArabicLanguage(input.Title, plainTexts[input.ContentID])
		result.CheckedAt = &now
		row, err := languageRowFromResult(contentType, countryCode, input.ContentID, result, now)
		if err != nil {
			return nil, err
		}
		results[input.ContentID] = result
		newRows = append(newRows, row)
	}

	if len(newRows) > 0 {
		err := db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "content_type"}, {Name: "content_id"}, {Name: "country_code"},
				{Name: "content_fingerprint"}, {Name: "engine_version"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"language", "checked", "error_count", "blocking", "findings_json", "checked_at", "updated_at",
			}),
		}).CreateInBatches(&newRows, 100).Error
		if err != nil {
			return nil, err
		}
		if err := pruneLanguageHistory(ctx, db, contentType, countryCode, ids); err != nil {
			return nil, err
		}
	}
	return results, nil
}

func pruneLanguageHistory(ctx context.Context, db *gorm.DB, contentType, countryCode string, contentIDs []uint) error {
	var rows []models.ContentLanguageCheck
	if err := db.WithContext(ctx).
		Select("id", "content_id").
		Where("content_type = ? AND country_code = ? AND content_id IN ?", contentType, countryCode, contentIDs).
		Order("content_id ASC, checked_at DESC, id DESC").
		Find(&rows).Error; err != nil {
		return err
	}
	deleteIDs := languageHistoryIDsToDelete(rows, MaxLanguageHistoryVersions)
	if len(deleteIDs) == 0 {
		return nil
	}
	return db.WithContext(ctx).Where("id IN ?", deleteIDs).Delete(&models.ContentLanguageCheck{}).Error
}

func languageHistoryIDsToDelete(rows []models.ContentLanguageCheck, keep int) []uint {
	if keep < 1 {
		keep = 1
	}
	counts := make(map[uint]int)
	deleteIDs := make([]uint, 0)
	for _, row := range rows {
		counts[row.ContentID]++
		if counts[row.ContentID] > keep {
			deleteIDs = append(deleteIDs, row.ID)
		}
	}
	return deleteIDs
}

func languageRowFromResult(contentType, countryCode string, contentID uint, result LanguageCheckResult, checkedAt time.Time) (models.ContentLanguageCheck, error) {
	findings, err := json.Marshal(result.Findings)
	if err != nil {
		return models.ContentLanguageCheck{}, err
	}
	return models.ContentLanguageCheck{
		ContentType: contentType, ContentID: contentID, CountryCode: countryCode,
		ContentFingerprint: result.ContentFingerprint, EngineVersion: result.EngineVersion,
		Language: result.Language, Checked: result.Checked, ErrorCount: result.ErrorCount,
		Blocking: result.Blocking, FindingsJSON: string(findings), CheckedAt: checkedAt,
	}, nil
}

func languageResultFromRow(row models.ContentLanguageCheck) (LanguageCheckResult, error) {
	var findings []LanguageFinding
	if err := json.Unmarshal([]byte(row.FindingsJSON), &findings); err != nil {
		return LanguageCheckResult{}, err
	}
	checkedAt := row.CheckedAt
	return LanguageCheckResult{
		Language: row.Language, Checked: row.Checked, ErrorCount: row.ErrorCount,
		Blocking: row.Blocking, EngineVersion: row.EngineVersion,
		ContentFingerprint: row.ContentFingerprint, CheckedAt: &checkedAt, Findings: findings,
	}, nil
}
