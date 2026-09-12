package models

import "time"

// ContentLanguageCheck stores one immutable content-version result. The
// composite unique index makes repeated checks idempotent while preserving
// older fingerprints and results from older engine versions.
type ContentLanguageCheck struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	ContentType        string    `gorm:"type:varchar(30);not null;uniqueIndex:idx_language_check_version" json:"content_type"`
	ContentID          uint      `gorm:"not null;uniqueIndex:idx_language_check_version" json:"content_id"`
	CountryCode        string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_language_check_version" json:"country_code"`
	ContentFingerprint string    `gorm:"type:char(64);not null;uniqueIndex:idx_language_check_version" json:"content_fingerprint"`
	EngineVersion      string    `gorm:"type:varchar(32);not null;uniqueIndex:idx_language_check_version" json:"engine_version"`
	Language           string    `gorm:"type:varchar(10);not null;default:'ar'" json:"language"`
	Checked            bool      `gorm:"not null;default:false" json:"checked"`
	ErrorCount         int       `gorm:"not null;default:0" json:"error_count"`
	Blocking           bool      `gorm:"not null;default:false;index" json:"blocking"`
	FindingsJSON       string    `gorm:"type:longtext" json:"-"`
	CheckedAt          time.Time `gorm:"not null;index" json:"checked_at"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (ContentLanguageCheck) TableName() string { return "content_language_checks" }
